import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";

let client: { sql: postgres.Sql; db: PostgresJsDatabase } | undefined;

function connect() {
  if (!client) {
    // A short connect timeout so the health check reports an unreachable
    // database promptly instead of hanging until the prober gives up.
    const sql = postgres(env().databaseUrl, { connect_timeout: 5, onnotice: () => {} });
    client = { sql, db: drizzle(sql) };
  }
  return client;
}

export function db(): PostgresJsDatabase {
  return connect().db;
}
