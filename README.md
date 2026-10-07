# Blastmap

A self-hosted app that reads a repository from GitHub or GitLab and draws it as
a dependency map, from really parsing the code.

Early development: right now it starts, checks its configuration and database,
and serves a placeholder page.

## Run it

You need Docker with Compose.

1. `cp .env.example .env`
2. Fill in `.env`:
   - `BETTER_AUTH_SECRET`: run `openssl rand -base64 32` and paste the output.
   - `BETTER_AUTH_URL`: the URL you'll open in the browser. Leave it as
     `http://localhost:3000` for a local run.
   - At least one git host: `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, or
     `GITLAB_CLIENT_ID` and `GITLAB_CLIENT_SECRET`.
   - Leave `DATABASE_URL` as it is to use the bundled Postgres.
   - The `AI_*` variables are optional.
3. `docker compose up`

The log shows the environment check, then the migration step. Open
http://localhost:3000. `/api/health` reports whether the app can reach its
database.

If something in `.env` is missing or wrong, the container exits and lists every
variable that needs fixing.

## Develop

Node 24 and pnpm. `pnpm install`, then `pnpm dev` with the same variables
exported or in `.env.local`. `pnpm check` runs types, lint and build.
