import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

export const dynamic = "force-dynamic";

// Up means the process answers and Postgres does too. The reason on failure is
// the driver's message (e.g. connection refused), which never includes the
// password from DATABASE_URL. Drizzle wraps it as "Failed query: ...", so the
// innermost cause is the useful part.
export async function GET() {
  try {
    await db().execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch (err) {
    let cause: unknown = err;
    while (cause instanceof Error && cause.cause !== undefined) cause = cause.cause;
    const reason = cause instanceof Error && cause.message ? cause.message : "unreachable";
    return Response.json({ status: "error", reason: `database: ${reason}` }, { status: 503 });
  }
}
