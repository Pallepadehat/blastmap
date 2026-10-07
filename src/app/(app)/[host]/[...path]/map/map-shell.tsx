"use client";

import { ReactFlowProvider } from "@xyflow/react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { adjacency } from "@/graph/analysis";
import { layout } from "@/graph/layout";
import { buildTree, foldersAbove } from "@/graph/tree";
import type { MapData } from "@/graph/types";
import type { FrameworkResult } from "@/frameworks/types";
import { firstView, folderId, view } from "@/graph/view";
import { Canvas, type Focus } from "./canvas";
import { DetailPanel } from "./detail-panel";
import { FolderTree } from "./folder-tree";
import { KindList } from "./kind-list";
import { kindColor, type KindFilter, type MapMeta, type Selection } from "./types";

// The map's shell: folders on the left, canvas in the centre, the selection on
// the right. Everything after the first render happens here in the browser.
export function MapShell({
  data,
  frameworks,
  meta,
  initialFile,
}: {
  data: MapData;
  frameworks: FrameworkResult | null;
  meta: MapMeta;
  initialFile: string | null;
}) {
  const tree = useMemo(() => buildTree(data.files.map((f) => f.path)), [data]);
  const adj = useMemo(() => adjacency(data.edges), [data]);
  const known = useMemo(() => new Set(data.files.map((f) => f.path)), [data]);

  const startFile = initialFile && known.has(initialFile) ? initialFile : null;
  const [open, setOpen] = useState<ReadonlySet<string>>(() => withAncestors(firstView(tree.root), startFile, tree.byPath));
  const [selection, setSelection] = useState<Selection>(startFile ? { kind: "file", path: startFile } : null);

  const v = useMemo(() => view(tree.root, open, data.edges), [tree, open, data.edges]);
  const placed = useMemo(() => layout(v.boxes, v.lines), [v]);

  const focus = useMemo<Focus | null>(() => {
    if (selection?.kind !== "file") return null;
    const box = v.boxOf.get(selection.path);
    if (!box) return null;
    const boxesOf = (files: Set<string> | undefined) =>
      new Set([...(files ?? [])].flatMap((f) => v.boxOf.get(f) ?? []).filter((b) => b !== box));
    return { box, importers: boxesOf(adj.importedBy.get(selection.path)), imports: boxesOf(adj.imports.get(selection.path)) };
  }, [selection, v, adj]);

  // A kind singled out in the left panel: the boxes holding any of its files
  // stay bright.
  const [kindFilter, setKindFilter] = useState<KindFilter>(null);
  const bright = useMemo(() => {
    if (!kindFilter || !frameworks) return null;
    const boxes = new Set<string>();
    for (const f of data.files) {
      const kind = frameworks.kinds[f.path];
      const matches = kindFilter === "none" ? kind === undefined : kind === kindFilter;
      const box = matches ? v.boxOf.get(f.path) : undefined;
      if (box) boxes.add(box);
    }
    return boxes;
  }, [kindFilter, frameworks, data.files, v]);
  const colorOf = useCallback(
    (path: string) => {
      const kind = frameworks?.kinds[path];
      return kind ? kindColor(kind) : null;
    },
    [frameworks],
  );

  const selectedBox =
    selection?.kind === "file" ? (v.boxOf.get(selection.path) ?? null) : selection ? folderId(selection.path) : null;

  const selectFile = useCallback(
    (path: string) => {
      setSelection({ kind: "file", path });
      setOpen((prev) => withAncestors(prev, path, tree.byPath));
      writeFileParam(path);
    },
    [tree],
  );
  const selectFolder = useCallback((path: string) => {
    setSelection({ kind: "folder", path });
    writeFileParam(null);
  }, []);
  const clear = useCallback(() => {
    setSelection(null);
    writeFileParam(null);
  }, []);
  const setFolder = useCallback((path: string, isOpen: boolean) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);
  const openFolder = useCallback((path: string) => setFolder(path, true), [setFolder]);
  const closeFolder = useCallback((path: string) => setFolder(path, false), [setFolder]);

  const intoRepo = meta.imports.resolved + meta.imports.unresolved;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr_22rem]">
      <aside className="min-h-0 overflow-y-auto border-r">
        <FolderTree
          root={tree.root}
          open={open}
          selected={selection?.kind === "folder" ? selection.path : null}
          onToggle={(path) => setFolder(path, !open.has(path))}
          onSelect={selectFolder}
        />
        <KindList
          frameworks={frameworks}
          fileCount={data.files.length}
          filter={kindFilter}
          meta={meta}
          onFilter={setKindFilter}
        />
      </aside>

      <section className="relative min-h-0" aria-label="Map">
        {meta.imports.unresolved > 0 && (
          <Link
            href={meta.coverageHref}
            className="absolute top-2 left-2 z-10 rounded-md border bg-card px-2 py-1 text-xs hover:bg-accent"
          >
            Graph is partial: {meta.imports.resolved} of {intoRepo} imports into this repository resolved
          </Link>
        )}
        <ReactFlowProvider>
          <Canvas
            boxes={v.boxes}
            lines={v.lines}
            placed={placed}
            focus={focus}
            bright={bright}
            colorOf={colorOf}
            selectedBox={selectedBox}
            onOpen={openFolder}
            onClose={closeFolder}
            onSelectFile={selectFile}
            onSelectFolder={selectFolder}
            onClear={clear}
          />
        </ReactFlowProvider>
      </section>

      <aside className="min-h-0 border-l">
        <DetailPanel data={data} frameworks={frameworks} adj={adj} meta={meta} selection={selection} onSelectFile={selectFile} />
      </aside>
    </div>
  );
}

function withAncestors(
  open: ReadonlySet<string>,
  file: string | null,
  byPath: Parameters<typeof foldersAbove>[1],
): ReadonlySet<string> {
  if (!file) return open;
  const above = foldersAbove(file, byPath);
  if (above.every((f) => open.has(f.path))) return open;
  return new Set([...open, ...above.map((f) => f.path)]);
}

// The selected file lives in the URL, so the address can be shared. Updated
// with the history API directly: no navigation, no request.
function writeFileParam(file: string | null) {
  const url = new URL(window.location.href);
  if (file) url.searchParams.set("file", file);
  else url.searchParams.delete("file");
  window.history.replaceState(null, "", url);
}
