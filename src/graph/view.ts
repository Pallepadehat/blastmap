import type { MapEdge } from "./types.ts";
import type { Folder } from "./tree.ts";

// What's on the canvas for a given set of open folders. The root is always
// open and never drawn.

export type Box =
  | { kind: "folder"; id: string; folder: Folder; parent: string | null }
  | { kind: "file"; id: string; path: string; parent: string | null }
  // An open folder: drawn as a frame around its contents.
  | { kind: "frame"; id: string; folder: Folder; parent: string | null };

export type Line = { id: string; source: string; target: string; count: number };

export const folderId = (path: string) => `d:${path}`;
export const fileId = (path: string) => `f:${path}`;

export type View = {
  boxes: Box[];
  lines: Line[];
  // The box each file is drawn as: itself, or the closed folder it's inside.
  boxOf: Map<string, string>;
};

export function view(root: Folder, open: ReadonlySet<string>, edges: MapEdge[]): View {
  const boxes: Box[] = [];
  const boxOf = new Map<string, string>();

  const markAll = (folder: Folder, id: string) => {
    for (const f of folder.files) boxOf.set(f, id);
    for (const sub of folder.folders) markAll(sub, id);
  };

  const visit = (folder: Folder, frame: string | null) => {
    for (const sub of folder.folders) {
      if (open.has(sub.path)) {
        const id = folderId(sub.path);
        boxes.push({ kind: "frame", id, folder: sub, parent: frame });
        visit(sub, id);
      } else {
        const id = folderId(sub.path);
        boxes.push({ kind: "folder", id, folder: sub, parent: frame });
        markAll(sub, id);
      }
    }
    for (const file of folder.files) {
      const id = fileId(file);
      boxes.push({ kind: "file", id, path: file, parent: frame });
      boxOf.set(file, id);
    }
  };
  visit(root, null);

  return { boxes, lines: lines(edges, boxOf), boxOf };
}

// One line per pair of boxes with at least one import between their files,
// counting the imports. Imports within one box aren't drawn.
function lines(edges: MapEdge[], boxOf: Map<string, string>): Line[] {
  const counts = new Map<string, Line>();
  for (const e of edges) {
    const source = boxOf.get(e.from);
    const target = boxOf.get(e.to);
    if (!source || !target || source === target) continue;
    const id = `${source}->${target}`;
    const line = counts.get(id);
    if (line) line.count++;
    else counts.set(id, { id, source, target, count: 1 });
  }
  return [...counts.values()];
}

// Boxes on the canvas: closed folders, files, and the frames of open folders.
export function boxCount(root: Folder, open: ReadonlySet<string>): number {
  let n = 0;
  const visit = (folder: Folder) => {
    n += folder.files.length;
    for (const sub of folder.folders) {
      n++;
      if (open.has(sub.path)) visit(sub);
    }
  };
  visit(root);
  return n;
}

export const MAX_FIRST_VIEW_BOXES = 60;

// The first view: open the folders holding the most files first, and stop
// before opening one would put more than 60 boxes on the canvas. The cap is a
// fixed, visible rule rather than a tuned heuristic, so it's easy to reason
// about and to change.
export function firstView(root: Folder): Set<string> {
  const open = new Set<string>();
  let boxes = boxCount(root, open);
  const closed = [...root.folders];

  for (;;) {
    closed.sort((a, b) => b.total - a.total || (a.path < b.path ? -1 : 1));
    const next = closed.shift();
    if (!next) break;
    // Opening swaps nothing out: the folder stays as a frame and its contents
    // join it.
    const added = next.files.length + next.folders.length;
    if (boxes + added > MAX_FIRST_VIEW_BOXES) break;
    open.add(next.path);
    boxes += added;
    closed.push(...next.folders);
  }
  return open;
}
