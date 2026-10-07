// Next calls register() once per server start and waits for it before serving
// requests, which is exactly where the startup checks belong.
export async function register() {
  // Reading NEXT_RUNTIME here is the one exception to "only env.ts reads
  // process.env": it's Next's own flag, not configuration.
  // eslint-disable-next-line no-restricted-properties
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startup } = await import("./server/startup");
    await startup();
  }
}
