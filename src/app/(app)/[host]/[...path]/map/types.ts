// What the server hands the map besides the graph itself.
export type MapMeta = {
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
