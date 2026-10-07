import { z } from "zod";

// The only module that reads process.env. Everything else imports `env()`.
// Validation happens once at startup (see instrumentation.ts); a bad environment
// stops the process before it serves anything.

// Compose passes unset variables from an env file as empty strings. Treat those
// as absent so "set but blank" reports as missing rather than malformed.
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());
const optionalUrl = z.preprocess((v) => (v === "" ? undefined : v), z.url().optional());

const raw = z.object({
  DATABASE_URL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .string({ error: "is required" })
      .regex(/^postgres(ql)?:\/\//, "must be a postgres:// or postgresql:// URL"),
  ),
  BETTER_AUTH_SECRET: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string({ error: "is required" }).min(32, "must be at least 32 characters"),
  ),
  BETTER_AUTH_URL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.url({ error: (i) => (i.input === undefined ? "is required" : "must be a URL") }),
  ),
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  GITLAB_URL: optionalUrl,
  GITLAB_CLIENT_ID: optional,
  GITLAB_CLIENT_SECRET: optional,
  AI_BASE_URL: optionalUrl,
  AI_API_KEY: optional,
  AI_MODEL: optional,
});

type Raw = z.infer<typeof raw>;

export type Env = {
  databaseUrl: string;
  betterAuthSecret: string;
  betterAuthUrl: string;
  github: { clientId: string; clientSecret: string } | null;
  gitlab: { url: string; clientId: string; clientSecret: string } | null;
  ai: { baseUrl: string; apiKey: string; model: string } | null;
};

export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "EnvError";
  }
}

function parse(source: NodeJS.ProcessEnv): Env {
  const problems: string[] = [];
  const result = raw.safeParse(source);
  if (!result.success) {
    for (const issue of result.error.issues) problems.push(`${String(issue.path[0])} ${issue.message}`);
  }

  // A group of variables is all set or all unset. Partial means the operator
  // meant to enable something and got it wrong, so it's an error, not
  // "disabled". These look at presence only, so they still run when a format
  // check above failed and the operator sees every problem in one go.
  const present = (k: string) => typeof source[k] === "string" && source[k] !== "";
  const allOrNone = (keys: (keyof Raw)[]): boolean => {
    const missing = keys.filter((k) => !present(k));
    if (missing.length === keys.length) return false;
    const set = keys.filter(present);
    for (const k of missing) problems.push(`${k} is required when ${set.join(", ")} is set`);
    return missing.length === 0;
  };

  const hasGithub = allOrNone(["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]);
  // GITLAB_URL has a default, so on its own it doesn't enable GitLab, but
  // setting it without credentials is still a half-configured provider.
  const hasGitlab = allOrNone(
    present("GITLAB_URL")
      ? ["GITLAB_URL", "GITLAB_CLIENT_ID", "GITLAB_CLIENT_SECRET"]
      : ["GITLAB_CLIENT_ID", "GITLAB_CLIENT_SECRET"],
  );
  const hasAi = allOrNone(["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"]);

  // better-auth sends usage telemetry if this is set, whatever its own config
  // says. Nothing leaves the instance except to the git host and the AI
  // endpoint, so refuse to start rather than quietly allow it.
  if (present("BETTER_AUTH_TELEMETRY")) {
    problems.push("BETTER_AUTH_TELEMETRY must not be set: Blastmap sends no telemetry");
  }

  const hostKeys = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITLAB_URL", "GITLAB_CLIENT_ID", "GITLAB_CLIENT_SECRET"] as const;
  if (!hostKeys.some(present)) {
    problems.push(
      "at least one git host is required: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, or GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET",
    );
  }

  if (!result.success || problems.length > 0) throw new EnvError(problems);
  const r = result.data;

  return {
    databaseUrl: r.DATABASE_URL,
    betterAuthSecret: r.BETTER_AUTH_SECRET,
    betterAuthUrl: r.BETTER_AUTH_URL,
    github: hasGithub ? { clientId: r.GITHUB_CLIENT_ID!, clientSecret: r.GITHUB_CLIENT_SECRET! } : null,
    gitlab: hasGitlab
      ? {
          url: r.GITLAB_URL ?? "https://gitlab.com",
          clientId: r.GITLAB_CLIENT_ID!,
          clientSecret: r.GITLAB_CLIENT_SECRET!,
        }
      : null,
    ai: hasAi ? { baseUrl: r.AI_BASE_URL!, apiKey: r.AI_API_KEY!, model: r.AI_MODEL! } : null,
  };
}

let cached: Env | undefined;

// Parsed lazily rather than at import, so `next build` (which imports server
// modules to collect routes) doesn't need a production environment.
export function env(): Env {
  cached ??= parse(process.env);
  return cached;
}
