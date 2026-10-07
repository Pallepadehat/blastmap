import type { HostAccount, HostAdapter, Repository } from "../hosts";
import type { Viewer } from "../session";

export type Readable = { adapter: HostAdapter; account: HostAccount; repo: Repository };

// The host's answer is remembered per user and repository for 5 minutes, never
// longer: long enough that a page and its progress stream don't each ask, short
// enough that losing access on the host takes effect soon after.
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 5000;

type Entry = { repo: Repository | null; expires: number };
const globalCache = globalThis as { blastmapAccessCache?: Map<string, Entry> };
const cache = (globalCache.blastmapAccessCache ??= new Map());

// The gate. Every read of mapping data starts here: if the host, asked as this
// user, doesn't say they can read the repository, the answer is null and the
// caller returns nothing. Host errors propagate and are never cached.
export async function readable(viewer: Viewer, host: string, path: string): Promise<Readable | null> {
  const entry = viewer.hosts.find((h) => h.adapter.id === host);
  if (!entry) return null;

  const key = `${viewer.userId}\0${host}\0${path}`;
  const now = Date.now();
  let hit = cache.get(key);
  if (!hit || hit.expires <= now) {
    hit = { repo: await entry.adapter.readableRepository(entry.account, path), expires: now + TTL_MS };
    remember(key, hit, now);
  }
  return hit.repo ? { adapter: entry.adapter, account: entry.account, repo: hit.repo } : null;
}

function remember(key: string, entry: Entry, now: number) {
  if (cache.size >= MAX_ENTRIES) {
    for (const [k, e] of cache) if (e.expires <= now) cache.delete(k);
    // Still full of live entries: drop the oldest rather than grow.
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value ?? "");
  }
  cache.set(key, entry);
}
