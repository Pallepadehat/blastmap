"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import type { Folder } from "@/graph/tree";

// The map's folders as a tree. Opening and closing here is the same state as
// on the canvas, so the two never disagree.
export function FolderTree({
  root,
  open,
  selected,
  onToggle,
  onSelect,
}: {
  root: Folder;
  open: ReadonlySet<string>;
  selected: string | null;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  const row = (folder: Folder, depth: number): React.ReactNode => {
    const isOpen = open.has(folder.path);
    return (
      <li key={folder.path}>
        <div
          className={cn("flex h-6 items-center gap-1 pr-2 hover:bg-accent", folder.path === selected && "bg-accent")}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          <button
            type="button"
            onClick={() => onToggle(folder.path)}
            aria-label={isOpen ? `Close ${folder.path}` : `Open ${folder.path}`}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            {isOpen ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
          </button>
          <button
            type="button"
            onClick={() => onSelect(folder.path)}
            className="min-w-0 flex-1 truncate text-left font-mono text-xs"
            title={folder.path}
          >
            {folder.label}
          </button>
          <span className="text-xs text-muted-foreground tabular-nums">{folder.total}</span>
        </div>
        {isOpen && folder.folders.length > 0 && <ul>{folder.folders.map((f) => row(f, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <nav aria-label="Folders" className="flex flex-col gap-1 py-2">
      <h2 className="px-3 text-xs text-muted-foreground">Folders</h2>
      <ul>{root.folders.map((f) => row(f, 0))}</ul>
      {root.files.length > 0 && (
        <p className="px-3 text-xs text-muted-foreground">
          {root.files.length} {root.files.length === 1 ? "file" : "files"} at the root
        </p>
      )}
    </nav>
  );
}
