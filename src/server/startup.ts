import { env, EnvError } from "./env";
import { describeDbError } from "./db/errors";
import { runMigrations } from "./db/migrate";

// Validate, then migrate, then let Next start serving. Any failure exits the
// process: a server that's up with a broken environment is worse than one that
// isn't up and says why.
export async function startup(): Promise<void> {
  try {
    const e = env();
    const hosts = [e.github && "github", e.gitlab && `gitlab (${e.gitlab.url})`].filter(Boolean);
    console.log(`[blastmap] environment: ok — hosts: ${hosts.join(", ")}; ai: ${e.ai ? "configured" : "not configured"}`);
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(`[blastmap] environment: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  try {
    await runMigrations();
  } catch (err) {
    console.error(`[blastmap] migrations: failed — ${describeDbError(err)}`);
    process.exit(1);
  }
}
