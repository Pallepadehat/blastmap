"use client";

import { cn } from "cn";
import { FRAMEWORKS, KIND_IDS, KINDS, type FrameworkId, type KindId } from "@/frameworks/kinds";
import type { FrameworkResult } from "@/frameworks/types";
import { Outdated } from "./outdated";
import { isOutdated, kindColor, type KindFilter, type MapMeta } from "./types";

// The kinds found, with counts, grouped by framework. Choosing one singles its
// files out on the map; choosing it again clears that.
export function KindList({
  frameworks,
  fileCount,
  filter,
  meta,
  onFilter,
}: {
  frameworks: FrameworkResult | null;
  fileCount: number;
  filter: KindFilter;
  meta: MapMeta;
  onFilter: (filter: KindFilter) => void;
}) {
  if (!frameworks) {
    return (
      <Section title="Kinds">
        <div className="px-3">
          <Outdated meta={meta} frameworks={null} />
        </div>
      </Section>
    );
  }

  const counts = new Map<KindId, number>();
  for (const kind of Object.values(frameworks.kinds)) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  const unkinded = fileCount - Object.keys(frameworks.kinds).length;
  const groups: { label: string; framework: FrameworkId | null }[] = [
    ...[...new Set(frameworks.apps.map((a) => a.framework))].map((f) => ({ label: FRAMEWORKS[f], framework: f })),
    { label: "Any project", framework: null },
  ];
  const toggle = (next: KindFilter) => onFilter(filter === next ? null : next);

  return (
    <Section title="Kinds">
      {groups.map(({ label, framework }) => {
        const kinds = KIND_IDS.filter((k) => KINDS[k].framework === framework && (counts.get(k) ?? 0) > 0);
        if (kinds.length === 0) return null;
        return (
          <div key={label} className="flex flex-col">
            <h3 className="px-3 pt-1 text-[11px] text-muted-foreground">{label}</h3>
            <ul>
              {kinds.map((k) => (
                <Row key={k} active={filter === k} onClick={() => toggle(k)} color={kindColor(k)} label={KINDS[k].plural} count={counts.get(k) ?? 0} />
              ))}
            </ul>
          </div>
        );
      })}
      <ul>
        <Row active={filter === "none"} onClick={() => toggle("none")} color={null} label="No kind" count={unkinded} />
      </ul>
      {isOutdated(frameworks) && (
        <div className="px-3 pt-1">
          <Outdated meta={meta} frameworks={frameworks} />
        </div>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1 border-t py-2">
      <h2 className="px-3 text-xs text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  active,
  onClick,
  color,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  color: string | null;
  label: string;
  count: number;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn("flex h-6 w-full items-center gap-2 px-3 text-left text-xs hover:bg-accent", active && "bg-accent")}
      >
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-sm", !color && "border border-muted-foreground")}
          style={color ? { backgroundColor: color } : undefined}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-muted-foreground tabular-nums">{count}</span>
      </button>
    </li>
  );
}
