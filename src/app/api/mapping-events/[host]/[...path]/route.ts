import { HostAuthError, HostRequestError } from "@/server/hosts";
import { isFinished, mappingFeed, type MappingState } from "@/server/mappings";
import { getViewer } from "@/server/session";

export const dynamic = "force-dynamic";

// Keeps proxies from closing an idle stream while a long step runs.
const HEARTBEAT_MS = 15_000;

// Live progress for one mapping, as Server-Sent Events. Goes through the same
// gate as the page: no access means a bare 404, with nothing streamed.
export async function GET(request: Request, { params }: { params: Promise<{ host: string; path: string[] }> }) {
  const viewer = await getViewer();
  if (!viewer) return notFound();
  const { host, path } = await params;
  const commit = new URL(request.url).searchParams.get("commit") ?? "";

  let feed;
  try {
    feed = await mappingFeed(viewer, host, path.join("/"), commit);
  } catch (err) {
    if (err instanceof HostAuthError || err instanceof HostRequestError) {
      return new Response(null, { status: 503 });
    }
    throw err;
  }
  if (!feed) return notFound();
  const { initial, listen } = feed;

  const encoder = new TextEncoder();
  let stop = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let stopped = false;
      let unsubscribe = () => {};
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": keep-alive\n\n")), HEARTBEAT_MS);
      stop = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };
      const send = (state: MappingState) => {
        if (stopped) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`));
        if (isFinished(state.status)) stop();
      };
      request.signal.addEventListener("abort", () => stop());

      send(initial);
      unsubscribe = listen(send);
      // Already finished (in `initial` or a buffered state): release it now.
      if (stopped) unsubscribe();
    },
    cancel() {
      stop();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      // Stops nginx-style proxies buffering the stream.
      "X-Accel-Buffering": "no",
    },
  });
}

function notFound() {
  return new Response("Not found", { status: 404 });
}
