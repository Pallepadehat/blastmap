import type { MapEdge } from "./types.ts";

export type Adjacency = {
  // file -> files it imports
  imports: Map<string, Set<string>>;
  // file -> files that import it
  importedBy: Map<string, Set<string>>;
};

export function adjacency(edges: MapEdge[]): Adjacency {
  const imports = new Map<string, Set<string>>();
  const importedBy = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, k: string, v: string) => {
    let set = m.get(k);
    if (!set) m.set(k, (set = new Set()));
    set.add(v);
  };
  for (const e of edges) {
    add(imports, e.from, e.to);
    add(importedBy, e.to, e.from);
  }
  return { imports, importedBy };
}

const sorted = (s: Iterable<string> | undefined) => [...(s ?? [])].sort();

export const importsOf = (a: Adjacency, file: string) => sorted(a.imports.get(file));
export const importersOf = (a: Adjacency, file: string) => sorted(a.importedBy.get(file));

// What could break if `file` changes: the files that import it (distance 1),
// and the files that import those (distance 2). Each file appears once, at
// its shortest distance; the file itself never does.
export function blastRadius(a: Adjacency, file: string): { 1: string[]; 2: string[] } {
  const first = new Set(a.importedBy.get(file));
  first.delete(file);
  const second = new Set<string>();
  for (const f of first) {
    for (const g of a.importedBy.get(f) ?? []) {
      if (g !== file && !first.has(g)) second.add(g);
    }
  }
  return { 1: sorted(first), 2: sorted(second) };
}

// Files imported by the most other files.
export function mostImported(a: Adjacency, limit: number): { path: string; importers: number }[] {
  return [...a.importedBy]
    .map(([path, set]) => ({ path, importers: set.size }))
    .sort((x, y) => y.importers - x.importers || (x.path < y.path ? -1 : 1))
    .slice(0, limit);
}

// Imports crossing a folder's boundary, grouped by the folder of the file at
// the other end.
export function folderLines(
  edges: MapEdge[],
  folder: string,
): { incoming: { folder: string; count: number }[]; outgoing: { folder: string; count: number }[] } {
  const inside = (p: string) => folder === "" || p.startsWith(`${folder}/`);
  const dir = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "(root)");
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const e of edges) {
    const from = inside(e.from);
    const to = inside(e.to);
    if (from && !to) outgoing.set(dir(e.to), (outgoing.get(dir(e.to)) ?? 0) + 1);
    if (!from && to) incoming.set(dir(e.from), (incoming.get(dir(e.from)) ?? 0) + 1);
  }
  const list = (m: Map<string, number>) =>
    [...m].map(([f, count]) => ({ folder: f, count })).sort((a, b) => b.count - a.count || (a.folder < b.folder ? -1 : 1));
  return { incoming: list(incoming), outgoing: list(outgoing) };
}
