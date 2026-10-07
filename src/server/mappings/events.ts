import type { MappingProgress, MappingStatus } from "./table";

// What the progress stream sends: a full snapshot each time, so a client that
// joins late or misses one is never out of step.
export type MappingState = {
  status: MappingStatus;
  progress: MappingProgress | null;
  error: string | null;
};

export const isFinished = (s: MappingStatus) => s === "done" || s === "failed";

type Listener = (state: MappingState) => void;

// In-process, because mappings run in this process (no workers, no queue
// service). Kept on globalThis so dev-mode module reloads share one bus with
// the runner.
const globalBus = globalThis as { blastmapMappingBus?: Map<string, Set<Listener>> };
const listeners = (globalBus.blastmapMappingBus ??= new Map());

export function publish(mappingId: string, state: MappingState): void {
  for (const listener of listeners.get(mappingId) ?? []) listener(state);
}

export function subscribe(mappingId: string, listener: Listener): () => void {
  let set = listeners.get(mappingId);
  if (!set) listeners.set(mappingId, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(mappingId);
  };
}
