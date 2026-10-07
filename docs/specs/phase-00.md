# Phase 00 — Foundation

The empty app, runnable the way it will always be run, with the checks every
later phase relies on. No sign-in, no parsing, no map. Those are later phases.

## What it does

- A Next.js app that serves one page saying Blastmap is running, in the dense
  greyscale style from the project doc. No shell layout yet; that's its own
  phase.
- Types, lint and build each run from one command and pass. Those three are the
  checks every later phase is held to.
- On startup the environment is validated against the full list in CLAUDE.md,
  even though nothing uses most of it yet, so the operator contract is fixed
  from day one. Missing or malformed values stop the app before it serves
  anything, with a message naming every offending variable. A provider ID
  without its secret (or the reverse) is an error. No git host configured is an
  error. The AI trio is all-or-nothing; partial is an error.
- `.env.example` lists every variable with a one-line comment.
- A health endpoint answers with success when the app is up and can reach
  Postgres, and with failure naming the reason when it can't.
- Postgres through Drizzle, connected but with no tables of our own yet. The
  migration step exists and runs; with nothing to apply it says so.
- One Docker image: multi-stage, standalone output, non-root user. On start it
  validates the environment, runs migrations as a visible step in the logs,
  then starts the server.
- A compose file with the app and Postgres. A filled-in env file plus
  `docker compose up` is the whole first run.
- A README covering exactly that first run, and nothing that doesn't exist yet.

## Acceptance check

1. Copy `.env.example`, fill in a database URL, a secret, a public URL and one
   GitHub ID/secret pair (any values). `docker compose up` shows a validation
   line, a migration line, then the server starting. The page loads.
2. The health endpoint returns success. Stop Postgres; it returns failure with
   the reason.
3. Remove `BETTER_AUTH_SECRET`; the container exits naming it.
4. Set `GITHUB_CLIENT_ID` without `GITHUB_CLIENT_SECRET`; exits naming the
   missing secret.
5. Remove both host pairs; exits saying at least one git host is required.
6. Set only `AI_BASE_URL`; exits naming the two missing AI variables.
7. Inside the running container, the process is not root.
