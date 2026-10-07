import { isBuiltin } from "node:module";
import path from "node:path";
import { ts } from "ts-morph";
import type { RawImport } from "./extract.ts";
import type { Host } from "./host.ts";
import { isInside, isSourcePath, toRelative } from "./paths.ts";
import { matchesPathsAlias, type ResolutionConfig, type TsconfigLookup } from "./tsconfig.ts";
import type { UnresolvedReason } from "./types.ts";
import { isRecord, type WorkspaceManifest } from "./workspaces.ts";

export type Resolution =
  | { type: "edge"; to: string }
  | { type: "external" }
  | { type: "unresolved"; reason: UnresolvedReason; detail: string };

// Turns one import into an edge, an external import, or an unresolved import
// with a reason. It never picks a file the import doesn't name: every edge is
// a file TypeScript's own resolution, or a mapping declared in a workspace
// package's manifest, leads to.
export class Resolver {
  private readonly root: string;
  private readonly host: Host;
  private readonly tsconfigs: TsconfigLookup;
  // Longest name first, so `@a/b-c` wins over `@a/b` for `@a/b-c/x`.
  private readonly workspaces: WorkspaceManifest[];

  constructor(root: string, host: Host, tsconfigs: TsconfigLookup, workspaces: WorkspaceManifest[]) {
    this.root = root;
    this.host = host;
    this.tsconfigs = tsconfigs;
    this.workspaces = [...workspaces].sort((a, b) => b.name.length - a.name.length);
  }

  resolve(raw: RawImport, fromAbs: string): Resolution {
    if (raw.specifier === null) {
      return { type: "unresolved", reason: "non-literal-specifier", detail: `called with ${raw.text}` };
    }
    const spec = raw.specifier;
    if (spec.startsWith("node:") || isBuiltin(spec)) return { type: "external" };

    // Relative paths, then tsconfig `paths`/`baseUrl`.
    const config = this.tsconfigs.forDirectory(path.dirname(fromAbs));
    const hit = this.tsResolve(spec, fromAbs, config);
    if (hit) return { type: "edge", to: hit };

    if (isRelative(spec)) return this.missingRelative(spec, fromAbs);
    if (matchesPathsAlias(spec, config.options)) {
      return {
        type: "unresolved",
        reason: "target-missing",
        detail: "matches a tsconfig paths alias, but no file exists at its targets",
      };
    }

    const pkg = this.workspaces.find((w) => spec === w.name || spec.startsWith(`${w.name}/`));
    if (pkg) return this.resolveWorkspace(spec, pkg);

    // A bare name that isn't a workspace package. With `baseUrl` this could
    // also be a missing in-repo file; there's no way to tell the two apart
    // from the syntax, and a package is by far the common case.
    return { type: "external" };
  }

  private tsResolve(spec: string, containingFile: string, config: ResolutionConfig): string | undefined {
    const result = ts.resolveModuleName(spec, containingFile, config.options, this.tsHost, config.cache);
    const file = result.resolvedModule?.resolvedFileName;
    return file && isInside(this.root, file) && isSourcePath(file) ? toRelative(this.root, file) : undefined;
  }

  private readonly tsHost: ts.ModuleResolutionHost = {
    fileExists: (p) => this.host.fileExists(p),
    directoryExists: (p) => this.host.directoryExists(p),
    readFile: (p) => this.host.readFile(p),
  };

  private missingRelative(spec: string, fromAbs: string): Resolution {
    const abs = path.resolve(path.dirname(fromAbs), spec);
    if (!isInside(this.root, abs)) {
      return { type: "unresolved", reason: "target-missing", detail: "points outside the directory" };
    }
    const rel = toRelative(this.root, abs);
    if (this.host.fileExists(abs)) {
      return { type: "unresolved", reason: "not-source-file", detail: `${rel} exists but isn't a JS/TS file` };
    }
    return {
      type: "unresolved",
      reason: "target-missing",
      detail: `no file at ${rel}, with any source extension or as a directory index`,
    };
  }

  private resolveWorkspace(spec: string, pkg: WorkspaceManifest): Resolution {
    const subpath = `.${spec.slice(pkg.name.length)}`;
    let candidates: string[];

    if (pkg.exports !== undefined) {
      const targets = exportTargets(pkg.exports, subpath);
      if (targets === null) {
        return {
          type: "unresolved",
          reason: "workspace-entry-missing",
          detail: `${pkg.name} (${pkg.dir}) doesn't export ${subpath}`,
        };
      }
      candidates = targets;
    } else {
      candidates = subpath === "." ? [...pkg.entryFields, "./index"] : [subpath];
    }

    // Every candidate is a target the package author declared, e.g. `types`
    // pointing at source and `import` at build output. The first one present
    // in the repository is a real file the import reaches. No candidate is
    // ever rewritten into a path the manifest doesn't name (dist -> src).
    const manifest = path.join(pkg.absDir, "package.json");
    const config = this.tsconfigs.forDirectory(pkg.absDir);
    for (const candidate of candidates) {
      const relative = candidate.startsWith(".") ? candidate : `./${candidate}`;
      const hit = this.tsResolve(relative, manifest, config);
      if (hit) return { type: "edge", to: hit };
    }

    return {
      type: "unresolved",
      reason: "workspace-entry-missing",
      detail:
        candidates.length === 0
          ? `${pkg.name} (${pkg.dir}) maps ${subpath} to nothing`
          : `${pkg.name} (${pkg.dir}) points at ${candidates.join(", ")}; none is in the repository`,
    };
  }
}

function isRelative(spec: string): boolean {
  return spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/");
}

// The targets a package.json `exports` field gives for a subpath, in the order
// declared, across every condition. Null when the subpath isn't exported.
export function exportTargets(exports: unknown, subpath: string): string[] | null {
  const isSubpathMap = isRecord(exports) && Object.keys(exports).some((k) => k.startsWith("."));
  const map: Record<string, unknown> = isSubpathMap ? exports : { ".": exports };

  if (Object.hasOwn(map, subpath)) return collect(map[subpath]);

  // Subpath patterns: the most specific (longest prefix) match wins, as in Node.
  let best: { key: string; captured: string; prefixLength: number } | undefined;
  for (const key of Object.keys(map)) {
    const star = key.indexOf("*");
    if (star === -1) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (
      subpath.length >= key.length - 1 &&
      subpath.startsWith(prefix) &&
      subpath.endsWith(suffix) &&
      (!best || prefix.length > best.prefixLength)
    ) {
      best = { key, captured: subpath.slice(prefix.length, subpath.length - suffix.length), prefixLength: prefix.length };
    }
  }
  if (!best) return null;
  const { key, captured } = best;
  return collect(map[key]).map((t) => t.replaceAll("*", captured));
}

function collect(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collect);
  if (isRecord(value)) return Object.keys(value).flatMap((k) => collect(value[k]));
  return []; // null: explicitly not exported under this condition
}
