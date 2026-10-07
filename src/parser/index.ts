import fs from "node:fs";
import path from "node:path";
import { Project, ts } from "ts-morph";
import { extractImports } from "./extract.ts";
import { createHost } from "./host.ts";
import { Resolver } from "./resolve.ts";
import { TsconfigLookup } from "./tsconfig.ts";
import type {
  Edge,
  ExternalImport,
  FileEntry,
  ParseResult,
  SkipReason,
  UnresolvedImport,
  UnresolvedReason,
} from "./types.ts";
import { walk } from "./walk.ts";
import { findWorkspacePackages } from "./workspaces.ts";

export type * from "./types.ts";

// Larger files are almost always generated or bundled output.
const MAX_FILE_BYTES = 1024 * 1024;

// Directory path in, files, edges and coverage out. Standalone by design: no
// framework, database, git host or environment, so it runs from a plain script.
export function parseDirectory(directory: string): ParseResult {
  const root = path.resolve(directory);
  if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Not a directory: ${directory}`);
  }

  const host = createHost(root);
  const tsconfigs = new TsconfigLookup(root, host);
  const workspaces = findWorkspacePackages(root, host, tsconfigs.problems);
  const resolver = new Resolver(root, host, tsconfigs, workspaces);
  const walked = walk(root);

  // Parsing only: an in-memory project with no lib files and no resolution,
  // so ts-morph never touches the disk or type-checks anything.
  const project = new Project({
    useInMemoryFileSystem: true,
    skipLoadingLibFiles: true,
    compilerOptions: { allowJs: true, noResolve: true, noLib: true, jsx: ts.JsxEmit.Preserve },
  });

  const files: FileEntry[] = [];
  const toParse: { rel: string; abs: string }[] = [];
  for (const f of walked.files) {
    if (f.symlink) {
      files.push({ path: f.rel, status: "skipped", reason: "symlink", detail: "symbolic links aren't followed" });
    } else if (f.size > MAX_FILE_BYTES) {
      files.push({
        path: f.rel,
        status: "skipped",
        reason: "too-large",
        detail: `${(f.size / 1024 / 1024).toFixed(1)} MB, limit is 1 MB`,
      });
    } else {
      project.createSourceFile(`/${f.rel}`, fs.readFileSync(f.abs, "utf8"));
      toParse.push(f);
    }
  }

  const program = project.getProgram();
  const edges = new Map<string, Edge>();
  const external: ExternalImport[] = [];
  const unresolved: UnresolvedImport[] = [];
  let importsFound = 0;
  let importsResolved = 0;

  for (const f of toParse) {
    const sf = project.getSourceFileOrThrow(`/${f.rel}`);
    const syntaxError = program.getSyntacticDiagnostics(sf)[0];
    if (syntaxError) {
      const message = ts.flattenDiagnosticMessageText(syntaxError.compilerObject.messageText, " ");
      files.push({
        path: f.rel,
        status: "skipped",
        reason: "parse-error",
        detail: `line ${syntaxError.getLineNumber() ?? "?"}: ${message}`,
      });
      continue;
    }
    files.push({ path: f.rel, status: "parsed" });

    for (const raw of extractImports(sf)) {
      importsFound++;
      const r = resolver.resolve(raw, f.abs);
      if (r.type === "edge") {
        importsResolved++;
        const key = `${f.rel}\0${r.to}\0${raw.kind}`;
        const existing = edges.get(key);
        if (existing) existing.typeOnly &&= raw.typeOnly;
        else edges.set(key, { from: f.rel, to: r.to, kind: raw.kind, typeOnly: raw.typeOnly });
      } else if (r.type === "external") {
        external.push({ from: f.rel, specifier: raw.text, kind: raw.kind });
      } else {
        unresolved.push({ from: f.rel, specifier: raw.text, kind: raw.kind, reason: r.reason, detail: r.detail });
      }
    }
  }

  const skipped = files.filter((f) => f.status === "skipped");
  const skippedByReason: Record<SkipReason, number> = { "too-large": 0, "parse-error": 0, symlink: 0 };
  for (const f of skipped) skippedByReason[f.reason]++;
  const unresolvedByReason: Record<UnresolvedReason, number> = {
    "non-literal-specifier": 0,
    "target-missing": 0,
    "not-source-file": 0,
    "workspace-entry-missing": 0,
  };
  for (const u of unresolved) unresolvedByReason[u.reason]++;

  return {
    files: files.sort((a, b) => compare(a.path, b.path)),
    edges: [...edges.values()].sort((a, b) => compare(a.from, b.from) || compare(a.to, b.to) || compare(a.kind, b.kind)),
    external: external.sort((a, b) => compare(a.from, b.from) || compare(a.specifier, b.specifier)),
    unresolved: unresolved.sort((a, b) => compare(a.from, b.from) || compare(a.specifier, b.specifier)),
    coverage: {
      files: { found: files.length, parsed: files.length - skipped.length, skipped: skipped.length, skippedByReason },
      imports: {
        found: importsFound,
        resolved: importsResolved,
        external: external.length,
        unresolved: unresolved.length,
        unresolvedByReason,
      },
      workspacePackages: workspaces.map(({ name, dir }) => ({ name, dir })),
      configProblems: tsconfigs.problems,
      symlinkedDirectories: walked.symlinkedDirectories,
    },
  };
}

// Byte order rather than locale order, so output is identical on every machine.
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
