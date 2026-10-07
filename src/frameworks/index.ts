import path from "node:path";
import type { ParseResult } from "../parser/index.ts";
import type { FrameworkAdapter } from "./adapter.ts";
import { earlyKind, lateKind } from "./generic.ts";
import { ADAPTERS_VERSION, type KindId } from "./kinds.ts";
import { nest } from "./nest.ts";
import { next } from "./next.ts";
import { filesByPackage, readPackages } from "./packages.ts";
import { Sources } from "./sources.ts";
import type { FrameworkResult } from "./types.ts";

export type * from "./types.ts";
export * from "./kinds.ts";

const ADAPTERS: FrameworkAdapter[] = [next, nest];

// Kinds and routes for a parsed directory. Runs after the parser, over the
// same files, and is as standalone: no app, database or host code, so it runs
// from a plain script. The parser never learns any of this exists.
export async function analyseFrameworks(
  directory: string,
  parsed: Pick<ParseResult, "files" | "coverage">,
): Promise<FrameworkResult> {
  const sources = new Sources(path.resolve(directory));
  const files = parsed.files.map((f) => f.path);
  const kinds = new Map<string, KindId>();
  for (const file of files) {
    const kind = earlyKind(file);
    if (kind) kinds.set(file, kind);
  }

  const packages = readPackages(sources, parsed.coverage.workspacePackages.map((w) => w.dir));
  const owned = filesByPackage(files, packages.map((p) => p.dir));
  const result: FrameworkResult = { version: ADAPTERS_VERSION, apps: [], kinds: {}, routes: [], omitted: [] };

  for (const pkg of packages) {
    for (const adapter of ADAPTERS) {
      if (!adapter.uses(pkg.dependencies)) continue;
      const app = { framework: adapter.id, dir: pkg.dir, name: pkg.name };
      result.apps.push(app);
      const findings = await adapter.analyse({
        app,
        files: (owned.get(pkg.dir) ?? []).filter((f) => !kinds.has(f)),
        sources,
      });
      // First adapter to claim a file wins, should a package use two.
      for (const [file, kind] of findings.kinds) if (!kinds.has(file)) kinds.set(file, kind);
      result.routes.push(...findings.routes);
      result.omitted.push(...findings.omitted);
    }
  }

  for (const file of files) {
    const kind = kinds.get(file) ?? lateKind(file);
    if (kind) result.kinds[file] = kind;
  }
  result.routes.sort((a, b) => cmp(a.app, b.app) || cmp(a.path, b.path) || cmp(a.method, b.method));
  result.omitted.sort((a, b) => cmp(a.file, b.file) || a.line - b.line);
  return result;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
