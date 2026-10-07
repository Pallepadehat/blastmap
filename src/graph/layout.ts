import dagre from "@dagrejs/dagre";
import { fileName } from "./tree.ts";
import type { Box, Line } from "./view.ts";

export type Placed = { id: string; x: number; y: number; width: number; height: number };

// Sizes are estimated from label length rather than measured in the DOM, so
// layout is a pure function that runs before anything renders. Labels are
// monospace at 11px: about 6.7px a character.
const CHAR = 6.7;
const PAD_X = 20;
export const BOX_HEIGHT = { file: 28, folder: 40 };
// Room at the top of an open folder's frame for its header.
export const FRAME_HEADER = 24;
const FRAME_PAD = 12;

export function labelOf(box: Box): string {
  if (box.kind === "file") return fileName(box.path);
  return box.folder.label;
}

function size(box: Box): { width: number; height: number } {
  if (box.kind === "file") return { width: labelOf(box).length * CHAR + PAD_X, height: BOX_HEIGHT.file };
  const files = `${box.folder.total} files`;
  return { width: Math.max(labelOf(box).length, files.length) * CHAR + PAD_X, height: BOX_HEIGHT.folder };
}

// Positions for every box, in absolute coordinates (top-left corner). Frames
// get the bounds dagre gives their cluster, grown to fit a header and padding.
export function layout(boxes: Box[], lines: Line[]): Map<string, Placed> {
  const g = new dagre.graphlib.Graph({ compound: true, multigraph: false });
  g.setGraph({ rankdir: "TB", nodesep: 24, ranksep: 56, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const box of boxes) {
    if (box.kind === "frame") g.setNode(box.id, { width: 0, height: 0 });
    else g.setNode(box.id, size(box));
  }
  for (const box of boxes) if (box.parent) g.setParent(box.id, box.parent);
  for (const line of lines) g.setEdge(line.source, line.target);

  dagre.layout(g);

  const placed = new Map<string, Placed>();
  for (const box of boxes) {
    const n = g.node(box.id);
    const x = n.x ?? 0;
    const y = n.y ?? 0;
    placed.set(box.id, { id: box.id, x: x - n.width / 2, y: y - n.height / 2, width: n.width, height: n.height });
  }

  // Grow frames, innermost first, so each encloses its children plus padding
  // and a header. Dagre's cluster bounds are tight and leave no header room.
  const parentOf = new Map(boxes.map((b) => [b.id, b.parent]));
  const depth = (b: Box): number => {
    let d = 0;
    for (let p = b.parent; p; p = parentOf.get(p) ?? null) d++;
    return d;
  };
  const children = new Map<string, Placed[]>();
  for (const b of boxes) {
    const at = placed.get(b.id);
    if (b.parent && at) children.set(b.parent, [...(children.get(b.parent) ?? []), at]);
  }
  const frames = boxes.filter((b) => b.kind === "frame").sort((a, b) => depth(b) - depth(a));
  for (const frame of frames) {
    // Read back after each frame grows, so an outer frame sees its inner
    // frames at their final size.
    const kids = (children.get(frame.id) ?? []).map((k) => placed.get(k.id) ?? k);
    if (kids.length === 0) continue;
    const left = Math.min(...kids.map((k) => k.x)) - FRAME_PAD;
    const top = Math.min(...kids.map((k) => k.y)) - FRAME_PAD - FRAME_HEADER;
    const right = Math.max(...kids.map((k) => k.x + k.width)) + FRAME_PAD;
    const bottom = Math.max(...kids.map((k) => k.y + k.height)) + FRAME_PAD;
    const minWidth = labelOf(frame).length * CHAR + 48;
    placed.set(frame.id, { id: frame.id, x: left, y: top, width: Math.max(right - left, minWidth), height: bottom - top });
  }
  return placed;
}
