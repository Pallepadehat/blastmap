"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { MinusIcon } from "lucide-react";
import { useMemo } from "react";
import { cn } from "cn";
import { labelOf, type Placed } from "@/graph/layout";
import type { Box, Line } from "@/graph/view";

export type Focus = {
  // The box the selected file is drawn as.
  box: string;
  // Boxes holding files that import it / that it imports.
  importers: Set<string>;
  imports: Set<string>;
};

type BoxData = { box: Box; dim: boolean; selected: boolean; onClose: () => void };
type BoxNode = Node<BoxData, "box" | "frame">;
type LineData = { count: number; tone: "incoming" | "outgoing" | null; dim: boolean };
type LineEdge = Edge<LineData, "line">;

const TONE = { incoming: "var(--incoming)", outgoing: "var(--outgoing)" };

export function Canvas({
  boxes,
  lines,
  placed,
  focus,
  selectedBox,
  onOpen,
  onClose,
  onSelectFile,
  onSelectFolder,
  onClear,
}: {
  boxes: Box[];
  lines: Line[];
  placed: Map<string, Placed>;
  focus: Focus | null;
  selectedBox: string | null;
  onOpen: (folder: string) => void;
  onClose: (folder: string) => void;
  onSelectFile: (path: string) => void;
  onSelectFolder: (path: string) => void;
  onClear: () => void;
}) {
  const nodes = useMemo<BoxNode[]>(() => {
    const related = (id: string) => !focus || id === focus.box || focus.importers.has(id) || focus.imports.has(id);
    return boxes.map((box) => {
        const at = placed.get(box.id) ?? { x: 0, y: 0, width: 0, height: 0 };
        const parent = box.parent ? placed.get(box.parent) : undefined;
        return {
          id: box.id,
          type: box.kind === "frame" ? "frame" : "box",
          // React Flow places children relative to their parent frame.
          position: { x: at.x - (parent?.x ?? 0), y: at.y - (parent?.y ?? 0) },
          width: at.width,
          height: at.height,
          ...(box.parent && { parentId: box.parent }),
          data: {
            box,
            dim: box.kind !== "frame" && !related(box.id),
            selected: box.id === selectedBox,
            onClose: () => box.kind === "frame" && onClose(box.folder.path),
          },
        };
      });
  }, [boxes, placed, focus, selectedBox, onClose]);

  const edges = useMemo<LineEdge[]>(
    () =>
      lines.map((line) => {
        const tone =
          focus && line.target === focus.box && focus.importers.has(line.source)
            ? "incoming"
            : focus && line.source === focus.box && focus.imports.has(line.target)
              ? "outgoing"
              : null;
        const color = tone ? TONE[tone] : "var(--muted-foreground)";
        return {
          id: line.id,
          source: line.source,
          target: line.target,
          type: "line",
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
          data: { count: line.count, tone, dim: focus !== null && tone === null },
        };
      }),
    [lines, focus],
  );

  return (
    <ReactFlow<BoxNode, LineEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      // Fits once when the map first appears; after that the view only moves
      // when you pan or zoom.
      fitView
      fitViewOptions={{ padding: 0.1 }}
      minZoom={0.05}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onlyRenderVisibleElements
      onNodeClick={(_, node) => {
        const box = node.data.box;
        if (box.kind === "folder") onOpen(box.folder.path);
        else if (box.kind === "file") onSelectFile(box.path);
        else onSelectFolder(box.folder.path);
      }}
      onPaneClick={onClear}
      className="bg-background"
    />
  );
}

function BoxView({ data }: NodeProps<BoxNode>) {
  const { box } = data;
  return (
    <div
      className={cn(
        "flex h-full w-full cursor-pointer flex-col justify-center rounded-md border px-2.5 font-mono text-[11px] leading-tight",
        box.kind === "folder" ? "bg-muted" : "bg-card",
        data.selected && "border-primary ring-1 ring-primary",
        data.dim && "opacity-30",
      )}
      title={box.kind === "file" ? box.path : box.kind === "folder" ? box.folder.path : undefined}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="invisible" />
      <span className="truncate">{labelOf(box)}</span>
      {box.kind === "folder" && <span className="text-[10px] text-muted-foreground">{box.folder.total} files</span>}
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="invisible" />
    </div>
  );
}

// An open folder. Transparent, so the lines drawn beneath it stay visible.
function FrameView({ data }: NodeProps<BoxNode>) {
  const { box } = data;
  if (box.kind !== "frame") return null;
  return (
    <div className={cn("h-full w-full rounded-lg border border-dashed", data.selected && "border-primary")}>
      <div className="flex h-6 cursor-pointer items-center gap-2 px-2 font-mono text-[11px]" title={box.folder.path}>
        <span className="truncate">{box.folder.label}</span>
        <span className="text-[10px] text-muted-foreground">{box.folder.total} files</span>
        <button
          type="button"
          aria-label={`Close ${box.folder.path}`}
          className="nodrag ml-auto rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            data.onClose();
          }}
        >
          <MinusIcon className="size-3" />
        </button>
      </div>
    </div>
  );
}

function LineView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps<LineEdge>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const tone = data?.tone ?? null;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: tone ? TONE[tone] : "var(--muted-foreground)",
          strokeWidth: tone ? 1.75 : 1,
          opacity: data?.dim ? 0.12 : tone ? 1 : 0.55,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className={cn(
            "pointer-events-none absolute rounded bg-background px-1 font-mono text-[10px] text-muted-foreground tabular-nums",
            data?.dim && "opacity-20",
          )}
        >
          {data?.count}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const NODE_TYPES = { box: BoxView, frame: FrameView };
const EDGE_TYPES = { line: LineView };
