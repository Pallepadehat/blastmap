import path from "node:path";

export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export function isSourcePath(p: string): boolean {
  return SOURCE_EXTENSIONS.includes(path.extname(p));
}

export function toRelative(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join("/");
}

// Everything the parser reads goes through this check. node_modules is
// excluded even when present on disk, so a directory parses the same whether
// or not dependencies happen to be installed — an archive from a git host
// never has them.
export function isInside(root: string, abs: string): boolean {
  const rel = path.relative(root, abs);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return rel === "";
  return !rel.split(path.sep).includes("node_modules");
}
