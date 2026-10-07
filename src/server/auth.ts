import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db/client";
import * as schema from "./db/schema";
import { env } from "./env";

function createAuth() {
  const e = env();
  return betterAuth({
    baseURL: e.betterAuthUrl,
    secret: e.betterAuthSecret,
    database: drizzleAdapter(db(), { provider: "pg", schema }),
    // GitHub and GitLab only, no email or password (CLAUDE.md).
    emailAndPassword: { enabled: false },
    socialProviders: {
      ...(e.github && {
        github: {
          clientId: e.github.clientId,
          clientSecret: e.github.clientSecret,
          // The defaults are `read:user` and `user:email`. Never `repo`: it
          // grants write access, so private GitHub repositories wait for a
          // GitHub App with read-only contents permission.
          mapProfileToUser: (profile) => ({ name: profile.login }),
        },
      }),
      ...(e.gitlab && {
        gitlab: {
          clientId: e.gitlab.clientId,
          clientSecret: e.gitlab.clientSecret,
          issuer: e.gitlab.url,
          // `read_user` is the default. `read_api` lists projects and reads
          // their code; there is no narrower read scope that does both.
          scope: ["read_api"],
          mapProfileToUser: (profile) => ({ name: profile.username }),
        },
      }),
    },
    account: { encryptOAuthTokens: true },
    // These endpoints return a host token to whoever holds the session
    // cookie, i.e. the browser. Tokens are read only on the server, by the
    // host adapters, through `auth().api`, which these paths don't affect.
    disabledPaths: ["/get-access-token", "/refresh-token"],
    telemetry: { enabled: false },
    // Must be last: lets server actions set the session cookie.
    plugins: [nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

// Built on first use rather than at import, so `next build` doesn't need the
// environment.
export function auth() {
  instance ??= createAuth();
  return instance;
}
