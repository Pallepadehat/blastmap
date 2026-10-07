import { and, desc, eq, sql } from "drizzle-orm";
import { ADAPTERS_VERSION, type FrameworkResult } from "@/frameworks";
import type { ParseResult } from "@/parser";
import { db } from "../db/client";
import type { Branch } from "../hosts";
import type { Viewer } from "../session";
import { readable, type Readable } from "./access";
import { isFinished, subscribe, type MappingState } from "./events";
import { enqueue, isQueuedOrRunning } from "./runner";
import { mapping, type MappingProgress, type MappingStatus } from "./table";

// The data-access layer for mappings. Every function starts at the gate in
// access.ts and returns null when the host doesn't say the viewer can read the
// repository. Nothing outside this directory queries the mapping table.

export { failInterrupted, SIZE_LIMIT_BYTES } from "./runner";
export { isFinished, type MappingState } from "./events";
export type { MappingProgress, MappingStatus } from "./table";

export type MappingSummary = {
  branch: string;
  commit: string;
  status: MappingStatus;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
};

export type MappingDetail = MappingSummary & {
  progress: MappingProgress | null;
  // Only once it's done.
  result: ParseResult | null;
  // Only once it's done, and null for mappings made before the framework
  // adapters existed.
  frameworks: FrameworkResult | null;
};

const RECENT_LIMIT = 20;

const COMMIT = /^[0-9a-f]{7,64}$/;

const summaryColumns = {
  branch: mapping.branch,
  commit: mapping.commit,
  status: mapping.status,
  error: mapping.error,
  createdAt: mapping.createdAt,
  finishedAt: mapping.finishedAt,
};

// The repository page: the repository itself, its branches, and its most
// recent mappings.
export async function repositoryOverview(
  viewer: Viewer,
  host: string,
  path: string,
): Promise<(Readable & { branches: Branch[]; mappings: MappingSummary[] }) | null> {
  const r = await readable(viewer, host, path);
  if (!r) return null;
  const [branches, mappings] = await Promise.all([
    r.adapter.listBranches(r.account, r.repo),
    db()
      .select(summaryColumns)
      .from(mapping)
      .where(and(eq(mapping.host, host), eq(mapping.repoPath, r.repo.path)))
      .orderBy(desc(mapping.createdAt))
      .limit(RECENT_LIMIT),
  ]);
  return { ...r, branches, mappings };
}

export async function mappingDetail(
  viewer: Viewer,
  host: string,
  path: string,
  commit: string,
): Promise<MappingDetail | null> {
  if (!COMMIT.test(commit)) return null;
  const r = await readable(viewer, host, path);
  if (!r) return null;
  const [row] = await db()
    .select({ ...summaryColumns, progress: mapping.progress })
    .from(mapping)
    .where(where(host, r.repo.path, commit))
    .limit(1);
  if (!row) return null;

  // The result can be megabytes; read it only when there is one to show.
  if (row.status !== "done") return { ...row, result: null, frameworks: null };
  const [full] = await db()
    .select({ result: mapping.result, frameworks: mapping.frameworks })
    .from(mapping)
    .where(where(host, r.repo.path, commit))
    .limit(1);
  return { ...row, result: full?.result ?? null, frameworks: full?.frameworks ?? null };
}

export type StartResult = { commit: string } | { error: string };

// Resolves the branch to its commit now and maps that commit, unless it's
// already mapped or on its way. A failed mapping of the same commit is
// started again.
export async function startMapping(
  viewer: Viewer,
  host: string,
  path: string,
  branch: string,
): Promise<StartResult | null> {
  const r = await readable(viewer, host, path);
  if (!r) return null;

  const commit = await r.adapter.branchCommit(r.account, r.repo.path, branch);
  if (!commit) return { error: `There's no branch ${branch} on ${r.adapter.label}.` };

  const [row] = await db()
    .insert(mapping)
    .values({
      id: crypto.randomUUID(),
      host,
      repoPath: r.repo.path,
      commit,
      branch,
      status: "queued",
      startedBy: viewer.userId,
    })
    .onConflictDoUpdate({
      target: [mapping.host, mapping.repoPath, mapping.commit],
      // Touch the row so we learn its id and status either way.
      set: { updatedAt: new Date() },
    })
    .returning({ id: mapping.id, status: mapping.status });
  if (!row) throw new Error("mapping row was not written");

  const stale = !isFinished(row.status) && !isQueuedOrRunning(row.id);
  if (row.status === "failed" || stale) {
    await db()
      .update(mapping)
      .set({ status: "queued", progress: null, error: null, branch, startedBy: viewer.userId, finishedAt: null })
      .where(eq(mapping.id, row.id));
  }
  if (row.status === "failed" || stale || row.status === "queued") {
    enqueue({ id: row.id, host, path: r.repo.path, commit, account: r.account });
  }
  return { commit };
}

// Maps a commit again when its mapping predates the current framework adapters
// (none at all, or an older ADAPTERS_VERSION), so it picks up their kinds and
// routes. Anything else is left alone: a commit's code doesn't change, so
// mapping it again would give the same answer.
export async function remapOutdated(viewer: Viewer, host: string, path: string, commit: string): Promise<boolean | null> {
  if (!COMMIT.test(commit)) return null;
  const r = await readable(viewer, host, path);
  if (!r) return null;
  const [row] = await db()
    .update(mapping)
    .set({ status: "queued", progress: null, error: null, startedBy: viewer.userId, finishedAt: null })
    .where(
      and(
        where(host, r.repo.path, commit),
        eq(mapping.status, "done"),
        sql`coalesce((${mapping.frameworks}->>'version')::int, 0) < ${ADAPTERS_VERSION}`,
      ),
    )
    .returning({ id: mapping.id });
  if (!row) return false;
  enqueue({ id: row.id, host, path: r.repo.path, commit, account: r.account });
  return true;
}

export type MappingFeed = {
  initial: MappingState;
  // Delivers every state published after `initial` was read, then live ones.
  listen(listener: (state: MappingState) => void): () => void;
};

// The live progress stream's source. It subscribes before reading the current
// state, so nothing published in between is lost.
export async function mappingFeed(
  viewer: Viewer,
  host: string,
  path: string,
  commit: string,
): Promise<MappingFeed | null> {
  if (!COMMIT.test(commit)) return null;
  const r = await readable(viewer, host, path);
  if (!r) return null;

  const [idRow] = await db()
    .select({ id: mapping.id })
    .from(mapping)
    .where(where(host, r.repo.path, commit))
    .limit(1);
  if (!idRow) return null;

  const buffered: MappingState[] = [];
  let deliver: ((state: MappingState) => void) | null = null;
  const unsubscribe = subscribe(idRow.id, (state) => (deliver ? deliver(state) : buffered.push(state)));

  const [row] = await db()
    .select({ status: mapping.status, progress: mapping.progress, error: mapping.error })
    .from(mapping)
    .where(eq(mapping.id, idRow.id))
    .limit(1);
  if (!row) {
    unsubscribe();
    return null;
  }

  return {
    initial: { status: row.status, progress: row.progress, error: row.error },
    listen(listener) {
      deliver = listener;
      for (const state of buffered.splice(0)) listener(state);
      return unsubscribe;
    },
  };
}

function where(host: string, repoPath: string, commit: string) {
  return and(eq(mapping.host, host), eq(mapping.repoPath, repoPath), eq(mapping.commit, commit));
}
