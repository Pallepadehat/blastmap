import type { Sources } from "./sources.ts";

// A package that might use a framework: the repository root, or one of the
// workspace packages the parser found.
export type Package = { dir: string; name: string; dependencies: Set<string> };

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies"];

export function readPackages(sources: Sources, workspaceDirs: string[]): Package[] {
  const dirs = ["", ...workspaceDirs.filter((d) => d !== "")];
  return dirs.flatMap((dir) => {
    const text = sources.read(dir ? `${dir}/package.json` : "package.json");
    if (text === null) return [];
    let manifest: unknown;
    try {
      manifest = JSON.parse(text);
    } catch {
      return []; // the parser already reports unreadable manifests
    }
    if (typeof manifest !== "object" || manifest === null) return [];
    const record: Record<string, unknown> = { ...manifest };
    const dependencies = new Set<string>();
    for (const field of DEPENDENCY_FIELDS) {
      const deps = record[field];
      if (typeof deps === "object" && deps !== null) for (const name of Object.keys(deps)) dependencies.add(name);
    }
    const name = typeof record.name === "string" ? record.name : dir || "(root)";
    return [{ dir, name, dependencies }];
  });
}

// Each file belongs to the innermost package containing it, so a workspace
// package's files aren't also counted as the root package's.
export function filesByPackage(files: string[], dirs: string[]): Map<string, string[]> {
  const byDepth = [...dirs].sort((a, b) => b.length - a.length);
  const owned = new Map<string, string[]>(dirs.map((d) => [d, []]));
  for (const file of files) {
    const dir = byDepth.find((d) => d === "" || file.startsWith(`${d}/`));
    if (dir !== undefined) owned.get(dir)?.push(file);
  }
  return owned;
}

// A path relative to a package directory, for matching conventions like
// "app/page.tsx" wherever the package sits in the repository.
export const withinPackage = (dir: string, file: string) => (dir === "" ? file : file.slice(dir.length + 1));
