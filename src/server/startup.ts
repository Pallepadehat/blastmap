import { env, EnvError } from "./env";
import { describeDbError } from "./db/errors";
import { runMigrations } from "./db/migrate";
import { failInterrupted } from "./mappings";

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

  // Mappings run in this process, so any left in progress belonged to the
  // previous one and will never finish.
  const interrupted = await failInterrupted();
  if (interrupted > 0) console.log(`[blastmap] mappings: ${interrupted} interrupted by the restart, marked failed`);
}
