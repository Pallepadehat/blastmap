import type { KindId } from "./kinds.ts";

const TEST = /\.(test|spec)\.[cm]?[jt]sx?$/;
const TYPES = /\.d\.[cm]?ts$/;
const CONFIG = /(^|\/)([^/]+\.config|\.eslintrc|\.prettierrc|\.babelrc|babel\.config)\.[cm]?[jt]s$/;

// Kinds that need no framework. Tests and type declarations are decided
// before any adapter runs, so a test file is a test even if it happens to sit
// where a framework expects something else. Config is decided after, as the
// fallback for files no adapter claimed.
export function earlyKind(file: string): KindId | null {
  if (TEST.test(file) || file.split("/").includes("__tests__")) return "test";
  if (TYPES.test(file)) return "types";
  return null;
}

export function lateKind(file: string): KindId | null {
  return CONFIG.test(file) ? "config" : null;
}
