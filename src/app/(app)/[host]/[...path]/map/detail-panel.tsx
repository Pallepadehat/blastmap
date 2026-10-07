"use client";

import { cn } from "cn";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FRAMEWORKS, KINDS } from "@/frameworks/kinds";
import type { FrameworkResult, Route } from "@/frameworks/types";
import { blastRadius, folderLines, importersOf, importsOf, mostImported, type Adjacency } from "@/graph/analysis";
import type { MapData } from "@/graph/types";
import { Outdated } from "./outdated";
import { fileUrl, isOutdated, kindColor, type MapMeta, type Selection } from "./types";

type Props = {
  data: MapData;
  frameworks: FrameworkResult | null;
  adj: Adjacency;
  meta: MapMeta;
  selection: Selection;
  onSelectFile: (path: string) => void;
};

// The right panel: the selection. Every number here is arithmetic over the
// edge list the browser already holds, so it appears with no request.
// Overview is the only tab for now; the chat tab joins it later.
export function DetailPanel(props: Props) {
  return (
    <Tabs defaultValue="overview" className="flex h-full flex-col gap-0">
      <TabsList className="m-2 w-[calc(100%-1rem)]">
        <TabsTrigger value="overview">Overview</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {props.selection?.kind === "file" ? (
          <FileDetail {...props} path={props.selection.path} />
        ) : props.selection?.kind === "folder" ? (
          <FolderDetail {...props} path={props.selection.path} />
        ) : (
          <Overview {...props} />
        )}
      </TabsContent>
    </Tabs>
  );
}

function Overview({ data, frameworks, adj, meta, onSelectFile }: Props) {
  const top = mostImported(adj, 10);
  const apps = frameworks?.apps ?? [];
  const facts: [string, string][] = [];
  if (apps.length > 0) {
    const several = apps.length > 1;
    facts.push(["Framework", apps.map((a) => `${FRAMEWORKS[a.framework]}${several ? ` (${a.dir || "root"})` : ""}`).join(", ")]);
  }
  facts.push(
    ["Files", String(data.files.length)],
    ["Imports", `${meta.imports.found} (${meta.imports.resolved} between files here)`],
    ["Edges", String(data.edges.length)],
  );
  if (frameworks) facts.push(["Routes", String(frameworks.routes.length)]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-mono font-semibold">{meta.repoPath}</h2>
        <Facts rows={facts} />
      </div>
      {isOutdated(frameworks) && <Outdated meta={meta} frameworks={frameworks} />}
      {frameworks && <Routes frameworks={frameworks} onSelectFile={onSelectFile} />}
      <Section title="Most imported" count={top.length} note="by files importing it">
        {top.map((t) => (
          <FileRow key={t.path} path={t.path} onSelect={onSelectFile} trailing={String(t.importers)} />
        ))}
      </Section>
    </div>
  );
}

// Routes recovered from syntax, grouped by app in a monorepo, then the ones
// left out and why.
function Routes({ frameworks, onSelectFile }: { frameworks: FrameworkResult; onSelectFile: (path: string) => void }) {
  const byApp = new Map<string, Route[]>();
  for (const r of frameworks.routes) byApp.set(r.app, [...(byApp.get(r.app) ?? []), r]);
  const several = frameworks.apps.length > 1;

  return (
    <>
      <Section title="Routes" count={frameworks.routes.length} note="method · path · where">
        {[...byApp].map(([app, routes]) => (
          <li key={app} className="flex flex-col">
            {several && <span className="py-0.5 font-mono text-xs text-muted-foreground">{app || "(root)"}</span>}
            <ul className="flex flex-col">
              {routes.map((r) => (
                <li key={`${r.method} ${r.path} ${r.file}:${r.line}`}>
                  <button
                    type="button"
                    onClick={() => onSelectFile(r.file)}
                    className="grid w-full grid-cols-[3.5rem_1fr] gap-x-2 rounded px-1 py-0.5 text-left font-mono text-xs hover:bg-accent"
                    title={`${r.file}:${r.line}`}
                  >
                    <span className={cn(r.method === "PAGE" && "text-muted-foreground")}>{r.method}</span>
                    <span className="break-all">{r.path}</span>
                    <span />
                    <span className="truncate text-muted-foreground">
                      {r.file}:{r.line}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </Section>
      {frameworks.omitted.length > 0 && (
        <Section title="Routes left out" count={frameworks.omitted.length} note="not fully readable from the code">
          {frameworks.omitted.map((o) => (
            <li key={`${o.file}:${o.line}:${o.reason}`}>
              <button
                type="button"
                onClick={() => onSelectFile(o.file)}
                className="flex w-full flex-col rounded px-1 py-0.5 text-left text-xs hover:bg-accent"
              >
                <span className="truncate font-mono">
                  {o.file}:{o.line}
                </span>
                <span className="text-muted-foreground">{o.reason}</span>
              </button>
            </li>
          ))}
        </Section>
      )}
    </>
  );
}

function FileDetail({ data, frameworks, adj, meta, path, onSelectFile }: Props & { path: string }) {
  const kind = frameworks?.kinds[path];
  const imports = importsOf(adj, path);
  const importers = importersOf(adj, path);
  const blast = blastRadius(adj, path);
  const unresolved = data.unresolved.filter((u) => u.from === path);
  const skipped = data.files.find((f) => f.path === path)?.skipped ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-mono font-semibold break-all">{path}</h2>
        <a
          href={fileUrl(meta.fileUrlPrefix, path)}
          className="w-fit text-xs text-primary underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Open on {meta.hostLabel} at {meta.commit.slice(0, 7)}
        </a>
        {skipped && <p className="text-xs text-muted-foreground">Skipped by the parser; see the coverage report.</p>}
        <Facts
          rows={[
            ["Imports", String(imports.length)],
            ["Imported by", String(importers.length)],
          ]}
        />
        {frameworks && (
          <p className="flex items-center gap-1.5 text-xs">
            {kind ? (
              <>
                <span aria-hidden className="size-2 rounded-sm" style={{ backgroundColor: kindColor(kind) }} />
                {KINDS[kind].label}
                {KINDS[kind].framework && <span className="text-muted-foreground">· {FRAMEWORKS[KINDS[kind].framework]}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">No kind: no convention covers this file</span>
            )}
          </p>
        )}
      </div>
      <Section title="Blast radius" count={blast[1].length + blast[2].length} note="files that import it">
        <Distance label="Distance 1" files={blast[1]} onSelect={onSelectFile} />
        <Distance label="Distance 2" files={blast[2]} onSelect={onSelectFile} />
      </Section>
      <Section title="Imports" count={imports.length} tone="outgoing">
        {imports.map((f) => (
          <FileRow key={f} path={f} onSelect={onSelectFile} />
        ))}
      </Section>
      <Section title="Imported by" count={importers.length} tone="incoming">
        {importers.map((f) => (
          <FileRow key={f} path={f} onSelect={onSelectFile} />
        ))}
      </Section>
      {unresolved.length > 0 && (
        <Section title="Unresolved imports" count={unresolved.length}>
          {unresolved.map((u, i) => (
            <li key={i} className="flex flex-col py-0.5 text-xs">
              <span className="font-mono">{u.specifier}</span>
              <span className="text-muted-foreground">{u.detail}</span>
            </li>
          ))}
        </Section>
      )}
    </div>
  );
}

function FolderDetail({ data, path }: Props & { path: string }) {
  const lines = folderLines(data.edges, path);
  const files = data.files.filter((f) => f.path.startsWith(`${path}/`)).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-mono font-semibold break-all">{path}</h2>
        <Facts rows={[["Files", String(files)]]} />
      </div>
      <Section title="Imported from" count={lines.incoming.length} tone="incoming" note="folders importing files here">
        {lines.incoming.map((l) => (
          <FolderRow key={l.folder} folder={l.folder} count={l.count} />
        ))}
      </Section>
      <Section title="Imports into" count={lines.outgoing.length} tone="outgoing" note="folders files here import">
        {lines.outgoing.map((l) => (
          <FolderRow key={l.folder} folder={l.folder} count={l.count} />
        ))}
      </Section>
    </div>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs tabular-nums">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  title,
  count,
  note,
  tone,
  children,
}: {
  title: string;
  count: number;
  note?: string;
  tone?: "incoming" | "outgoing";
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="flex items-baseline gap-1.5 text-xs font-semibold">
        {tone && (
          <span
            aria-hidden
            className={tone === "incoming" ? "size-2 rounded-full bg-incoming" : "size-2 rounded-full bg-outgoing"}
          />
        )}
        {title}
        <span className="font-normal text-muted-foreground tabular-nums">{count}</span>
        {note && <span className="ml-auto font-normal text-muted-foreground">{note}</span>}
      </h3>
      {count === 0 ? <p className="text-xs text-muted-foreground">None.</p> : <ul className="flex flex-col">{children}</ul>}
    </section>
  );
}

function Distance({ label, files, onSelect }: { label: string; files: string[]; onSelect: (path: string) => void }) {
  return (
    <li className="flex flex-col">
      <span className="py-0.5 text-xs text-muted-foreground tabular-nums">
        {label} · {files.length}
      </span>
      <ul className="flex flex-col">
        {files.map((f) => (
          <FileRow key={f} path={f} onSelect={onSelect} />
        ))}
      </ul>
    </li>
  );
}

function FileRow({ path, onSelect, trailing }: { path: string; onSelect: (path: string) => void; trailing?: string }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(path)}
        className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left font-mono text-xs hover:bg-accent"
        title={path}
      >
        <span className="min-w-0 flex-1 truncate">{path}</span>
        {trailing && <span className="text-muted-foreground tabular-nums">{trailing}</span>}
      </button>
    </li>
  );
}

function FolderRow({ folder, count }: { folder: string; count: number }) {
  return (
    <li className="flex items-baseline gap-2 px-1 py-0.5 font-mono text-xs">
      <span className="min-w-0 flex-1 truncate">{folder}</span>
      <span className="text-muted-foreground tabular-nums">{count}</span>
    </li>
  );
}
