import { defineConfig } from "drizzle-kit";

// Only used for `pnpm db:generate`. Migrations are applied by the app at
// startup, so drizzle-kit never needs a database connection.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
});
