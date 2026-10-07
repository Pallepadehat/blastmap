"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { bytes } from "@/lib/format";
import type { MappingState } from "@/server/mappings";

const STEPS = ["queued", "downloading", "unpacking", "parsing", "saving"] as const;

// Live progress over Server-Sent Events. The stream starts with the current
// state, so a reload or a second tab picks up wherever the mapping is. When
// it finishes, the page re-renders on the server to show the result.
export function MappingProgress({ src, initial }: { src: string; initial: MappingState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const events = new EventSource(src);
    events.onmessage = (e: MessageEvent<string>) => {
      const next: MappingState = JSON.parse(e.data);
      setState(next);
      if (next.status === "done" || next.status === "failed") {
        events.close();
        router.refresh();
      }
    };
    // EventSource retries dropped connections itself; CLOSED means the server
    // refused it outright.
    events.onerror = () => setLost(events.readyState === EventSource.CLOSED);
    return () => events.close();
  }, [src, router]);

  const current = STEPS.findIndex((s) => s === state.status);

  return (
    <div className="flex flex-col gap-1.5">
      <ol className="flex items-center gap-1.5 text-xs">
        {STEPS.map((step, i) => (
          <li key={step} className={cn(i === current ? "font-medium text-foreground" : "text-muted-foreground")}>
            {i > 0 && <span className="mr-1.5 text-muted-foreground">›</span>}
            {step}
          </li>
        ))}
      </ol>
      <p className="font-mono text-xs tabular-nums">{detail(state)}</p>
      {lost && <p className="text-xs text-muted-foreground">Lost the live connection. Reload to see where it is.</p>}
    </div>
  );
}

function detail({ status, progress }: MappingState): string {
  if (progress?.step === "downloading") {
    return progress.totalBytes
      ? `${bytes(progress.bytes)} of ${bytes(progress.totalBytes)}`
      : `${bytes(progress.bytes)} so far`;
  }
  if (progress?.step === "parsing") {
    return `read ${progress.read} of ${progress.total} files · resolved ${progress.resolved} of ${progress.total}`;
  }
  if (status === "queued") return "waiting for the mapping ahead of it";
  return "";
}
