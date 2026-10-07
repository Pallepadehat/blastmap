# Blastmap

A self-hosted app that reads a repository from GitHub or GitLab and draws it as
a dependency map, from really parsing the code.

Early development: right now you can sign in with GitHub or GitLab, list the
repositories you can read there, and open one. Mapping comes next.

## Run it

You need Docker with Compose.

1. `cp .env.example .env`
2. Fill in `.env`:
   - `BETTER_AUTH_SECRET`: run `openssl rand -base64 32` and paste the output.
   - `BETTER_AUTH_URL`: the URL you'll open in the browser. Leave it as
     `http://localhost:3000` for a local run.
   - At least one git host: `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, or
     `GITLAB_CLIENT_ID` and `GITLAB_CLIENT_SECRET`. See
     [Registering the OAuth application](#registering-the-oauth-application).
   - Leave `DATABASE_URL` as it is to use the bundled Postgres.
   - The `AI_*` variables are optional.
3. `docker compose up`

The log shows the environment check, then the migration step. Open
http://localhost:3000. `/api/health` reports whether the app can reach its
database.

If something in `.env` is missing or wrong, the container exits and lists every
variable that needs fixing.

## Registering the OAuth application

Sign-in goes through an OAuth application you register on each host you
enable. In the steps below, `BETTER_AUTH_URL` is the public URL from your
`.env`, e.g. `http://localhost:3000`. Every scope is read-only.

### GitHub

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
   For an organization, use the organization's settings instead.
2. Homepage URL: `BETTER_AUTH_URL`.
3. Authorization callback URL: `BETTER_AUTH_URL/api/auth/callback/github`.
4. Register, then generate a client secret. Put the Client ID and secret in
   `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

Blastmap asks GitHub only for your profile and email, never for repository
access, so it maps public repositories. Private GitHub repositories need a
GitHub App with read-only contents permission, which isn't supported yet.

### GitLab

1. On your GitLab instance go to User settings → Applications (or a group's or
   the admin area's Applications page) → Add new application.
2. Redirect URI: `BETTER_AUTH_URL/api/auth/callback/gitlab`.
3. Keep Confidential ticked. Tick the scopes `read_user` and `read_api`, and
   nothing else.
4. Save. Put the Application ID and Secret in `GITLAB_CLIENT_ID` and
   `GITLAB_CLIENT_SECRET`.
5. For a self-hosted instance, set `GITLAB_URL` to its address, including any
   base path, e.g. `https://git.example.com` or `https://example.com/gitlab`.

## Develop

Node 24 and pnpm. The Docker image is a production build and doesn't hot
reload, so for development run only Postgres in Docker and the app locally:

1. Create `.env.local` with the database's local address. Next prefers it over
   `.env`, and the image never sees it:
   `DATABASE_URL=postgres://blastmap:blastmap@localhost:5432/blastmap`
2. `pnpm install`
3. `docker compose up -d db`
4. `pnpm dev`

`pnpm check` runs types, lint and build.
