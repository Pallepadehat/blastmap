import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { describeDbError } from "./db/errors";

export type Health = { ok: true } | { ok: false; reason: string };

// Healthy means the process answers and Postgres does too.
export async function checkHealth(): Promise<Health> {
  try {
    await db().execute(sql`select 1`);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `database: ${describeDbError(err)}` };
  }
}
