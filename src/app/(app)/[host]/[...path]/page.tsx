import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HostAuthError, HostRequestError, type Repository } from "@/server/hosts";
import { requireViewer } from "@/server/session";

type Params = Promise<{ host: string; path: string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  // Only what's already in the URL, so the title can't leak anything either.
  const { path } = await params;
  return { title: `${path.join("/")} · Blastmap` };
}

export default async function RepositoryPage({ params }: { params: Params }) {
  const viewer = await requireViewer();
  const { host, path } = await params;

  // Only a host you're signed in with can answer for you.
  const entry = viewer.hosts.find((h) => h.adapter.id === host);
  if (!entry) notFound();

  let repo: Repository | null;
  let error: string | null = null;
  let signInAgain = false;
  try {
    repo = await entry.adapter.readableRepository(entry.account, path.join("/"));
  } catch (err) {
    repo = null;
    if (err instanceof HostAuthError) signInAgain = true;
    else if (err instanceof HostRequestError) error = err.message;
    else throw err;
  }
  if (signInAgain) redirect(`/session-ended?host=${host}`);

  if (error) {
    return (
      <main className="p-3">
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t reach {entry.adapter.label}</AlertTitle>
          <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
        </Alert>
      </main>
    );
  }

  // Can't read it and doesn't exist look the same, so a private repository's
  // existence never leaks.
  if (!repo) notFound();

  return (
    <main className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-mono font-semibold">{repo.path}</h1>
        <dl className="grid w-fit grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-xs">
          <dt className="text-muted-foreground">Host</dt>
          <dd>{entry.adapter.label}</dd>
          <dt className="text-muted-foreground">Visibility</dt>
          <dd>{repo.visibility}</dd>
          <dt className="text-muted-foreground">Default branch</dt>
          <dd className="font-mono">{repo.defaultBranch ?? "none (empty repository)"}</dd>
        </dl>
      </div>
      <a href={repo.webUrl} className="w-fit text-xs text-primary underline-offset-4 hover:underline">
        Open on {entry.adapter.label}
      </a>
      <p className="text-muted-foreground">Mapping isn&apos;t built yet.</p>
    </main>
  );
}
