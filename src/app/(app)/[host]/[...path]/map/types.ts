import { ADAPTERS_VERSION, KINDS, type KindId } from "@/frameworks/kinds";
import type { FrameworkResult } from "@/frameworks/types";

// What the server hands the map besides the graph itself.
export type MapMeta = {
  host: string;
  hostLabel: string;
  repoPath: string;
  branch: string;
  commit: string;
  // Append an encoded repository-relative path for a link to the host.
  fileUrlPrefix: string;
  coverageHref: string;
  imports: { found: number; resolved: number; external: number; unresolved: number };
};

export type Selection = { kind: "file"; path: string } | { kind: "folder"; path: string } | null;

export const fileUrl = (prefix: string, path: string) => prefix + path.split("/").map(encodeURIComponent).join("/");

// Which files the map singles out: one kind, files with no kind, or none.
export type KindFilter = KindId | "none" | null;

export const kindColor = (kind: KindId) => `var(--kind-${KINDS[kind].group})`;

// Mapped before the current framework adapters: offer "Map again". Written as
// "not at least current" so results stored before versions existed (no
// version field at all) count as outdated too.
export const isOutdated = (frameworks: FrameworkResult | null) =>
  !frameworks || !(frameworks.version >= ADAPTERS_VERSION);
