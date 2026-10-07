import { Badge } from "@/components/ui/badge";
import { checkHealth } from "@/server/health";

// Checked on every load, so the page never shows a stale status.
export const dynamic = "force-dynamic";

export default async function Home() {
  const health = await checkHealth();

  return (
    <main className="flex flex-col gap-1.5 p-4">
      <div className="flex items-center gap-2">
        <h1 className="font-semibold">Blastmap</h1>
        {/* Healthy is the normal state, so it stays grey; only failure gets colour. */}
        <Badge variant={health.ok ? "outline" : "destructive"}>
          {health.ok ? "healthy" : "unhealthy"}
        </Badge>
      </div>
      {!health.ok && (
        <p className="font-mono text-xs text-destructive">{health.reason}</p>
      )}
      <p className="text-muted-foreground">
        Same check as{" "}
        <a
          href="/api/health"
          className="font-mono underline-offset-4 hover:underline"
        >
          /api/health
        </a>
        .
      </p>
    </main>
  );
}
