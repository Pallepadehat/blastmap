import { env } from "../env";
import { github } from "./github";
import { gitlab } from "./gitlab";
import type { HostAdapter, HostId } from "./types";

export * from "./types";

const ADAPTERS: Record<HostId, HostAdapter> = { github, gitlab };

// Hosts the operator configured, in a fixed order.
export function configuredHosts(): HostAdapter[] {
  const e = env();
  return [e.github && github, e.gitlab && gitlab].filter((a): a is HostAdapter => Boolean(a));
}

// The adapter for a host id from a URL or the database, if that host is
// configured. Anything else is null, never a guess.
export function adapterFor(id: string): HostAdapter | null {
  return configuredHosts().find((a) => a.id === id) ?? null;
}

export function isHostId(id: string): id is HostId {
  return Object.hasOwn(ADAPTERS, id);
}
