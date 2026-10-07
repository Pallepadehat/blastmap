import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cn } from "cn";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ago, shortCommit } from "@/lib/format";
import { HostAuthError, HostRequestError } from "@/server/hosts";
import { mappingDetail, repositoryOverview, type MappingDetail } from "@/server/mappings";
import { requireViewer } from "@/server/session";
import { CoverageReport } from "./coverage-report";
import { MapForm } from "./map-form";
import { MappingProgress } from "./mapping-progress";

type Params = Promise<{ host: string; path: string[] }>;
type SearchParams = Promise<{ commit?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  // Only what's already in the URL, so the title can't leak anything either.
  const { path } = await params;
  return { title: `${path.join("/")} · Blastmap` };
}

export default async function RepositoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const viewer = await requireViewer();
  const { host, path: segments } = await params;
  const { commit } = await searchParams;
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
      <main className="p-3">
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t reach the host</AlertTitle>
          <AlertDescription className="font-mono text-xs">{err.message}</AlertDescription>
        </Alert>
      </main>
    );
  }

  // Can't read it and doesn't exist look the same, so a private repository's
  // existence never leaks. The same goes for a mapping of it.
  const { overview, detail } = loaded;
  if (!overview || (commit && !detail)) notFound();
  const { adapter, repo, branches, mappings } = overview;
  const base = `/${host}/${repo.path}`;

  return (
    <main className="flex flex-col gap-5 p-3">
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
  );
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
