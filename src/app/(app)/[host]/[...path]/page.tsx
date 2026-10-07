import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
import { TopBar } from "@/components/top-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MapData } from "@/graph/types";
import type { ParseResult } from "@/parser";
import { ago, shortCommit } from "@/lib/format";
import { HostAuthError, HostRequestError } from "@/server/hosts";
import { mappingDetail, repositoryOverview, type MappingDetail } from "@/server/mappings";
import { requireViewer } from "@/server/session";
import { CoverageReport } from "./coverage-report";
import { MapForm } from "./map-form";
import { MapShell } from "./map/map-shell";
import { MappingProgress } from "./mapping-progress";

type Params = Promise<{ host: string; path: string[] }>;
type SearchParams = Promise<{ commit?: string; view?: string; file?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  // Only what's already in the URL, so the title can't leak anything either.
  const { path } = await params;
  return { title: `${path.join("/")} · Blastmap` };
}

export default async function RepositoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const { host, path: segments } = await params;
  const { commit, view, file } = await searchParams;
  const path = segments.join("/");

  let loaded;
  try {
    const overview = await repositoryOverview(viewer, host, path);
    const detail = overview && commit ? await mappingDetail(viewer, host, path, commit) : null;
    loaded = { overview, detail };
  } catch (err) {
    if (err instanceof HostAuthError) redirect(`/session-ended?host=${err.host}`);
    if (!(err instanceof HostRequestError)) throw err;
    return (
      <>
        <TopBar viewer={viewer} crumbs={[{ label: path, mono: true }]} />
        <main className="p-3">
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t reach the host</AlertTitle>
            <AlertDescription className="font-mono text-xs">{err.message}</AlertDescription>
          </Alert>
        </main>
      </>
    );
  }

  // Can't read it and doesn't exist look the same, so a private repository's
  // existence never leaks. The same goes for a mapping of it.
  const { overview, detail } = loaded;
  if (!overview || (commit && !detail)) notFound();
  const { adapter, repo, branches, mappings } = overview;
  const base = `/${host}/${repo.path}`;
  const repoCrumb = { label: repo.path, href: base, mono: true };

  // A finished mapping opens as the map; its coverage report is one link away.
  if (detail?.status === "done" && detail.result && view !== "coverage") {
    const crumbs = [repoCrumb, { label: `${detail.branch} @ ${shortCommit(detail.commit)}`, mono: true, muted: true }];
    return (
      <>
        <TopBar viewer={viewer} crumbs={crumbs} />
        <MapShell
          data={mapData(detail.result)}
          initialFile={file ?? null}
          meta={{
            hostLabel: adapter.label,
            repoPath: repo.path,
            branch: detail.branch,
            commit: detail.commit,
            fileUrlPrefix: adapter.fileUrlPrefix(repo, detail.commit),
            coverageHref: `${base}?commit=${detail.commit}&view=coverage`,
            imports: detail.result.coverage.imports,
          }}
        />
      </>
    );
  }

  return (
    <>
    <TopBar viewer={viewer} crumbs={[repoCrumb]} />
    <main className="flex flex-col gap-5 overflow-y-auto p-3">
      <header className="flex flex-col gap-0.5">
        <h1 className="font-mono font-semibold">
          <Link href={base} className="hover:underline">
            {repo.path}
          </Link>
        </h1>
        <p className="text-xs text-muted-foreground">
          {adapter.label} · {repo.visibility} · default branch{" "}
          <span className="font-mono">{repo.defaultBranch ?? "none"}</span> ·{" "}
          <a href={repo.webUrl} className="text-primary underline-offset-4 hover:underline">
            open on {adapter.label}
          </a>
        </p>
      </header>

      <MapForm host={host} path={repo.path} branches={branches.map((b) => b.name)} />

      {detail && commit && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs">
            <span className="font-mono font-semibold">{detail.branch}</span>{" "}
            <span className="font-mono text-muted-foreground">@ {shortCommit(detail.commit)}</span>
            <span className="text-muted-foreground"> · started {ago(detail.createdAt)}</span>
            {detail.status === "done" && (
              <>
                {" · "}
                <Link href={`${base}?commit=${detail.commit}`} className="text-primary underline-offset-4 hover:underline">
                  open the map
                </Link>
              </>
            )}
          </h2>
          <MappingBody detail={detail} src={`/api/mapping-events${base}?commit=${commit}`} />
        </section>
      )}

      <section className="flex flex-col gap-1">
        <h2 className="text-xs font-semibold">
          Mappings <span className="font-normal text-muted-foreground tabular-nums">{mappings.length}</span>
        </h2>
        {mappings.length === 0 ? (
          <p className="text-muted-foreground">Not mapped yet.</p>
        ) : (
          <ul className="flex flex-col border-y">
            {mappings.map((m) => (
              <li key={m.commit} className="border-b last:border-b-0">
                <Link
                  href={`${base}?commit=${m.commit}`}
                  className={cn(
                    "grid h-7 grid-cols-[1fr_5rem_5rem_4rem] items-center gap-3 px-2 hover:bg-accent",
                    m.commit === commit && "bg-accent",
                  )}
                >
                  <span className="truncate font-mono">{m.branch}</span>
                  <span className="font-mono text-xs text-muted-foreground">{shortCommit(m.commit)}</span>
                  <span className={cn("text-xs", m.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
                    {m.status}
                  </span>
                  <span className="text-right text-xs text-muted-foreground tabular-nums">{ago(m.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
    </>
  );
}

// The parser's result, slimmed to what the map needs in the browser: no
// external imports, and one edge per pair of files whatever the import kind.
function mapData(result: ParseResult): MapData {
  const seen = new Set<string>();
  const edges = result.edges.filter((e) => {
    const key = `${e.from}\0${e.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    files: result.files.map((f) => ({ path: f.path, skipped: f.status === "skipped" })),
    edges: edges.map((e) => ({ from: e.from, to: e.to })),
    unresolved: result.unresolved.map(({ from, specifier, reason, detail }) => ({ from, specifier, reason, detail })),
  };
}

function MappingBody({ detail, src }: { detail: MappingDetail; src: string }) {
  if (detail.status === "done" && detail.result) return <CoverageReport result={detail.result} />;
  if (detail.status === "failed") {
    return (
      <Alert variant="destructive" className="w-fit">
        <AlertTitle>Mapping failed</AlertTitle>
        <AlertDescription className="font-mono text-xs">{detail.error}</AlertDescription>
      </Alert>
    );
  }
  return (
    <MappingProgress
      key={src}
      src={src}
      initial={{ status: detail.status, progress: detail.progress, error: detail.error }}
    />
  );
}
