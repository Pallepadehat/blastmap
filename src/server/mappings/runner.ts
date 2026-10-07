import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { extract } from "tar";
import { analyseFrameworks, type FrameworkResult } from "@/frameworks";
import { parseDirectory, type ParseResult } from "@/parser";
import { db } from "../db/client";
import { adapterFor, HostAuthError, HostRequestError, type HostAccount, type HostAdapter } from "../hosts";
import { publish } from "./events";
import { mapping, type MappingProgress, type MappingStatus } from "./table";

// A fixed limit, not configuration: one process parses one repository at a
// time, and this is the size it can be trusted with. Bigger repositories wait
// for the CI parser.
export const SIZE_LIMIT_BYTES = 500 * 1024 * 1024;

// How often a running step writes its progress to the database: the row only
// needs to be current enough for someone who reloads.
const PERSIST_EVERY_MS = 1000;

// How often progress goes to live subscribers. A download reports every network
// chunk, which is far more often than anyone can read.
const PUBLISH_EVERY_MS = 100;

const TEMP_PREFIX = "blastmap-";

export type Job = { id: string; host: string; path: string; commit: string; account: HostAccount };

// One mapping at a time, in the order they were asked for. The job at the
// front is the one running. Kept on globalThis so a dev-mode module reload
// doesn't start a second queue.
const globalQueue = globalThis as { blastmapQueue?: { jobs: Job[]; draining: boolean } };
const queue = (globalQueue.blastmapQueue ??= { jobs: [], draining: false });

export function enqueue(job: Job): void {
  if (isQueuedOrRunning(job.id)) return;
  queue.jobs.push(job);
  void drain();
}

export function isQueuedOrRunning(id: string): boolean {
  return queue.jobs.some((j) => j.id === id);
}

async function drain() {
  if (queue.draining) return;
  queue.draining = true;
  try {
    for (let job = queue.jobs[0]; job; job = queue.jobs[0]) {
      await run(job);
      queue.jobs.shift();
    }
  } finally {
    queue.draining = false;
  }
}

class StepFailure extends Error {}

async function run(job: Job) {
  const reporter = new Reporter(job.id);
  const adapter = adapterFor(job.host);
  let dir: string | null = null;
  // Named in the failure message, so it says which step failed.
  let step = "checking the repository";

  // run() never throws: every failure, including the temporary directory not
  // being created, ends up on the mapping row.
  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
    if (!adapter) throw new StepFailure(`${job.host} is no longer configured on this instance`);

    // Size first, so an oversized repository is refused before any download.
    const repo = await adapter.readableRepository(job.account, job.path);
    if (!repo) throw new StepFailure("the user who started this mapping can no longer read the repository");
    if (repo.sizeBytes !== null && repo.sizeBytes > SIZE_LIMIT_BYTES) {
      throw new StepFailure(
        `refused before downloading: ${adapter.label} reports the repository as ${megabytes(repo.sizeBytes)}; the limit is ${megabytes(SIZE_LIMIT_BYTES)}`,
      );
    }

    step = "downloading";
    await reporter.step("downloading", { step: "downloading", bytes: 0, totalBytes: null });
    const archiveFile = path.join(dir, "archive.tar.gz");
    await download(adapter, job, archiveFile, reporter);

    step = "unpacking";
    await reporter.step("unpacking", null);
    const source = path.join(dir, "source");
    await fs.mkdir(source);
    // Host archives put everything under one top-level directory; strip it so
    // paths are relative to the repository root. tar refuses entries that
    // would land outside `source`.
    await extract({ file: archiveFile, cwd: source, strip: 1 });
    await fs.rm(archiveFile);

    step = "parsing";
    await reporter.step("parsing", { step: "parsing", total: 0, read: 0, resolved: 0 });
    const result = await parseDirectory(source, {
      onProgress: (p) => reporter.progress({ step: "parsing", ...p }),
    });
    await reporter.flush();
    // Kinds and routes, from the same unpacked files. Part of the parsing
    // step: it's quick next to parsing, and a separate step would only flash by.
    const frameworks = await analyseFrameworks(source, result);

    step = "saving";
    await reporter.step("saving", null);
    await reporter.done(result, frameworks);
  } catch (err) {
    await reporter.fail(`${step}: ${describe(err, adapter)}`);
  } finally {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  }
}

// Streams the archive to disk, counting bytes, and stops as soon as it passes
// the limit, whatever the host said the size was.
async function download(adapter: HostAdapter, job: Job, file: string, reporter: Reporter) {
  const archive = await adapter.archive(job.account, job.path, job.commit);
  const handle = await fs.open(file, "w");
  let bytes = 0;
  try {
    for await (const chunk of archive.body) {
      bytes += chunk.byteLength;
      if (bytes > SIZE_LIMIT_BYTES) {
        throw new StepFailure(`the archive passed the ${megabytes(SIZE_LIMIT_BYTES)} limit while downloading`);
      }
      await handle.write(chunk);
      reporter.progress({ step: "downloading", bytes, totalBytes: archive.length });
    }
  } finally {
    await handle.close();
  }
  await reporter.flush();
}

// Writes status changes straight away and progress at most once a second, and
// publishes everything to live subscribers. Writes are chained so they land in
// the order they were made: a slow progress write can never overwrite a later
// step.
class Reporter {
  private status: MappingStatus = "queued";
  private latest: MappingProgress | null = null;
  private lastWrite = 0;
  private lastPublish = 0;
  private writes: Promise<unknown> = Promise.resolve();
  private readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  async step(status: MappingStatus, progress: MappingProgress | null) {
    this.status = status;
    this.latest = progress;
    this.publishNow();
    await this.write({ status, progress });
  }

  progress(progress: MappingProgress) {
    this.latest = progress;
    const now = Date.now();
    if (now - this.lastPublish >= PUBLISH_EVERY_MS) this.publishNow();
    if (now - this.lastWrite >= PERSIST_EVERY_MS) void this.write({ status: this.status, progress });
  }

  // The last progress of a step, which throttling may have held back.
  async flush() {
    this.publishNow();
    await this.write({ status: this.status, progress: this.latest });
  }

  async done(result: ParseResult, frameworks: FrameworkResult) {
    await this.write({ status: "done", progress: null, error: null, result, frameworks, finishedAt: new Date() });
    publish(this.id, { status: "done", progress: null, error: null });
  }

  async fail(error: string) {
    await this.write({ status: "failed", progress: null, error, finishedAt: new Date() });
    publish(this.id, { status: "failed", progress: null, error });
  }

  private publishNow() {
    this.lastPublish = Date.now();
    publish(this.id, { status: this.status, progress: this.latest, error: null });
  }

  private write(values: Partial<typeof mapping.$inferInsert>): Promise<unknown> {
    this.lastWrite = Date.now();
    const next = this.writes.then(() =>
      db()
        .update(mapping)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(mapping.id, this.id)),
    );
    // A failed progress write mustn't block the writes after it.
    this.writes = next.catch(() => {});
    return next;
  }
}

// At startup nothing is running yet, so anything still marked as in progress
// was cut off by the previous process ending, along with its temporary
// directory, which a killed process never got to delete.
export async function failInterrupted(): Promise<number> {
  const tmp = os.tmpdir();
  for (const name of await fs.readdir(tmp)) {
    if (name.startsWith(TEMP_PREFIX)) await fs.rm(path.join(tmp, name), { recursive: true, force: true });
  }

  const rows = await db()
    .update(mapping)
    .set({
      status: "failed",
      progress: null,
      error: "interrupted by a restart",
      finishedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(inArray(mapping.status, ["queued", "downloading", "unpacking", "parsing", "saving"]))
    .returning({ id: mapping.id });
  return rows.length;
}

function describe(err: unknown, adapter: HostAdapter | null): string {
  if (err instanceof StepFailure || err instanceof HostRequestError) return err.message;
  if (err instanceof HostAuthError) {
    return `${adapter?.label ?? err.host} no longer accepts the sign-in of the user who started this mapping`;
  }
  return err instanceof Error ? err.message : String(err);
}

function megabytes(bytes: number): string {
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}
