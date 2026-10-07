import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HostAuthError, HostRequestError } from "@/server/hosts";
import { requireViewer } from "@/server/session";
import { ago } from "@/lib/format";
import { OpenByPath } from "./open-by-path";
import { RepositoryList, type RepositoryRow } from "./repository-list";

export const metadata: Metadata = { title: "Repositories · Blastmap" };

const PLACEHOLDER = { github: "owner/name or URL", gitlab: "group/project or URL" };

export default async function Repositories() {
  const viewer = await requireViewer();

  const sections = await Promise.all(
    viewer.hosts.map(async ({ adapter, account }) => {
      try {
        const repos = await adapter.listRepositories(account);
        const rows: RepositoryRow[] = repos.map((r) => ({
          path: r.path,
          href: `/${r.host}/${r.path}`,
          visibility: r.visibility,
          defaultBranch: r.defaultBranch,
          updated: ago(r.updatedAt),
        }));
        return { adapter, rows, error: null, signInAgain: false };
      } catch (err) {
        if (err instanceof HostAuthError) return { adapter, rows: [], error: null, signInAgain: true };
        if (err instanceof HostRequestError) return { adapter, rows: [], error: err.message, signInAgain: false };
        throw err;
      }
    }),
  );

  const rejected = sections.find((s) => s.signInAgain);
  if (rejected) redirect(`/session-ended?host=${rejected.adapter.id}`);

  return (
    <main className="flex flex-col gap-6 p-3">
      {sections.length === 0 && (
        <p className="text-muted-foreground">
          You signed in with a host this instance no longer has configured. Sign out and sign in with another.
        </p>
      )}
      {sections.map(({ adapter, rows, error }) => (
        <section key={adapter.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              Repositories{sections.length > 1 && <span className="text-muted-foreground"> · {adapter.label}</span>}
            </h2>
            <OpenByPath host={adapter.id} placeholder={PLACEHOLDER[adapter.id]} />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn&apos;t list repositories</AlertTitle>
              <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
            </Alert>
          ) : (
            <RepositoryList rows={rows} />
          )}
        </section>
      ))}
    </main>
  );
}
