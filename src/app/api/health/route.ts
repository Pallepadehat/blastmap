import { checkHealth } from "@/server/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkHealth();
  return health.ok
    ? Response.json({ status: "ok" })
    : Response.json({ status: "error", reason: health.reason }, { status: 503 });
}
