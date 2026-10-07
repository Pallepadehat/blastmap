import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { Host } from "./host.ts";
import { toRelative } from "./paths.ts";
import type { ConfigProblem, WorkspacePackage } from "./types.ts";

export type WorkspaceManifest = WorkspacePackage & {
  absDir: string;
  exports: unknown;
  entryFields: string[];
};

// Workspace packages declared at the root: pnpm-workspace.yaml, or the
// `workspaces` field of package.json (npm and yarn).
export function findWorkspacePackages(
  root: string,
  host: Host,
  problems: ConfigProblem[],
): WorkspaceManifest[] {
  const patterns = [...pnpmPatterns(root, host, problems), ...packageJsonPatterns(root, host, problems)];
  if (patterns.length === 0) return [];

  const include = patterns.filter((p) => !p.startsWith("!"));
  const exclude = patterns.filter((p) => p.startsWith("!")).map((p) => p.slice(1));
  const excluded = new Set(exclude.flatMap((p) => glob(root, p)));

  const dirs = [...new Set(include.flatMap((p) => glob(root, p)))].filter((d) => !excluded.has(d)).sort();
  const byName = new Map<string, WorkspaceManifest>();

  for (const rel of dirs) {
    const absDir = path.join(root, rel);
    const manifestPath = path.join(absDir, "package.json");
    const manifest = readJson(manifestPath, host, root, problems);
    if (!isRecord(manifest) || typeof manifest.name !== "string") continue;

    const existing = byName.get(manifest.name);
    if (existing) {
      problems.push({
        file: toRelative(root, manifestPath),
        message: `workspace package name ${manifest.name} is already used by ${existing.dir}; ignoring this one`,
      });
      continue;
    }
    byName.set(manifest.name, {
      name: manifest.name,
      dir: toRelative(root, absDir),
      absDir,
      exports: manifest.exports,
      // Entry fields in the order TypeScript and bundlers consult them.
      entryFields: ["types", "typings", "module", "main"]
        .map((f) => manifest[f])
        .filter((v): v is string => typeof v === "string"),
    });
  }

  return [...byName.values()];
}

function pnpmPatterns(root: string, host: Host, problems: ConfigProblem[]): string[] {
  const file = path.join(root, "pnpm-workspace.yaml");
  const text = host.readFile(file);
  if (text === undefined) return [];
  try {
    const doc: unknown = parseYaml(text);
    return isRecord(doc) ? strings(doc.packages) : [];
  } catch (err) {
    problems.push({ file: "pnpm-workspace.yaml", message: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

function packageJsonPatterns(root: string, host: Host, problems: ConfigProblem[]): string[] {
  const manifest = readJson(path.join(root, "package.json"), host, root, problems);
  if (!isRecord(manifest)) return [];
  const ws = manifest.workspaces;
  return Array.isArray(ws) ? strings(ws) : isRecord(ws) ? strings(ws.packages) : [];
}

function glob(root: string, pattern: string): string[] {
  const clean = pattern.replace(/\/+$/, "");
  return fs
    .globSync(clean, { cwd: root, exclude: (p) => path.basename(String(p)) === "node_modules" })
    .map((p) => p.split(path.sep).join("/"))
    .filter((p) => !p.split("/").includes("node_modules"));
}

function readJson(file: string, host: Host, root: string, problems: ConfigProblem[]): unknown {
  const text = host.readFile(file);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch (err) {
    problems.push({ file: toRelative(root, file), message: err instanceof Error ? err.message : String(err) });
    return undefined;
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}
