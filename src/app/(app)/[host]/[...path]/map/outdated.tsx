import { Button } from "@/components/ui/button";
import { remapCommit } from "@/server/actions";
import type { FrameworkResult } from "@/frameworks/types";
import type { MapMeta } from "./types";

// On a mapping made before the current framework adapters. Without any
// results it stands in for them, so an empty list is never mistaken for "none
// found"; with older results it sits alongside them.
export function Outdated({ meta, frameworks }: { meta: MapMeta; frameworks: FrameworkResult | null }) {
  return (
    <div className="flex flex-col items-start gap-1.5 text-xs text-muted-foreground">
      <p>
        {frameworks
          ? "Mapped with older framework adapters, so kinds and routes may be incomplete. Map this commit again to update them."
          : "Mapped before kinds and routes existed. Map this commit again to see them."}
      </p>
      <form action={remapCommit.bind(null, meta.host, meta.repoPath, meta.commit)}>
        <Button type="submit" size="xs" variant="outline">
          Map again
        </Button>
      </form>
    </div>
  );
}
