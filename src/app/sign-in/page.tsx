import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signInWith } from "@/server/actions";
import { adapterFor, configuredHosts } from "@/server/hosts";
import { getViewer } from "@/server/session";

export const metadata: Metadata = { title: "Sign in · Blastmap" };

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ ended?: string; error?: string }>;
}) {
  const { ended, error } = await searchParams;
  if (!ended && (await getViewer())) redirect("/");
  const endedHost = ended ? adapterFor(ended) : null;

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-64 flex-col gap-3">
        <div>
          <h1 className="font-semibold">Blastmap</h1>
          <p className="text-muted-foreground">Sign in with the host your code lives on.</p>
        </div>

        {endedHost && (
          <Alert>
            <AlertDescription>
              {endedHost.label} no longer accepts your sign-in. Sign in again.
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Sign-in failed: <span className="font-mono">{error}</span>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          {configuredHosts().map((host) => (
            <form key={host.id} action={signInWith.bind(null, host.id)}>
              <Button type="submit" variant="outline" className="w-full">
                Sign in with {host.label}
              </Button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
