# Deploying Blastmap

Blastmap is one container plus Postgres. This guide covers the whole path, from
a clean machine to a running instance behind your own domain.

- [What you need](#what-you-need)
- [1. Register the OAuth application](#1-register-the-oauth-application)
- [2. Configure](#2-configure)
- [3. Run](#3-run)
- [Behind a reverse proxy](#behind-a-reverse-proxy)
- [Using your own Postgres](#using-your-own-postgres)
- [Upgrading](#upgrading)
- [Backups](#backups)
- [Health and logs](#health-and-logs)
- [What's stored where](#whats-stored-where)
- [Troubleshooting](#troubleshooting)

## What you need

- Docker with Compose v2.
- A machine the people using it can reach. For a quick local try, your own
  laptop is fine.
- An account on GitHub or GitLab that can register an OAuth application.
- Outbound HTTPS from the container to your git host (`api.github.com` and
  `codeload.github.com`, or your GitLab).

## 1. Register the OAuth application

Sign-in goes through an OAuth application you register on each host you
enable. You can enable GitHub, GitLab, or both. Every scope is read-only.

Below, `BETTER_AUTH_URL` means the public URL people will open, exactly as you
will set it in step 2, e.g. `https://blastmap.example.com` or
`http://localhost:3000`.

### GitHub

1. Go to GitHub → Settings → Developer settings → OAuth Apps → **New OAuth
   App**. For an organization, use the organization's settings instead.
2. **Homepage URL:** `BETTER_AUTH_URL`.
3. **Authorization callback URL:** `BETTER_AUTH_URL/api/auth/callback/github`.
4. Register, then **Generate a new client secret**. Keep the Client ID and the
   secret for step 2.

Blastmap asks GitHub only for your profile and email, never for repository
access, so it maps public repositories. That's deliberate: the scope that
reaches private repositories also grants write access.

### GitLab (gitlab.com or self-hosted)

1. On your GitLab, go to User settings → Applications → **Add new application**.
   Group or instance-wide applications (admin area) work the same way.
2. **Redirect URI:** `BETTER_AUTH_URL/api/auth/callback/gitlab`.
3. Keep **Confidential** ticked. Tick the scopes `read_user` and `read_api`, and
   nothing else.
4. Save. Keep the Application ID and Secret for step 2.

A self-hosted GitLab that signs its users in through Keycloak, LDAP or another
identity provider works without changes: Blastmap only talks to GitLab.

## 2. Configure

```sh
git clone https://github.com/Pallepadehat/blastmap.git
cd blastmap
cp .env.example .env
```

Fill in `.env`:

- **`BETTER_AUTH_SECRET`:** run `openssl rand -base64 32` and paste the
  output. It signs sessions and encrypts the host tokens stored in the
  database. Keep it secret, and keep it stable: changing it signs everyone out
  and makes stored tokens unreadable.
- **`BETTER_AUTH_URL`:** the public URL, with no trailing slash. It must match
  the URL you registered the OAuth application with.
- **Host credentials:** the GitHub pair, the GitLab pair, or both. For
  self-hosted GitLab, also set `GITLAB_URL`, including any base path, e.g.
  `https://git.example.com` or `https://example.com/gitlab`.
- **`DATABASE_URL`:** leave it as it is to use the Postgres in the compose
  file.
- **`AI_*`:** leave empty. AI features aren't built yet.

Every variable has a one-line explanation in `.env.example`.

## 3. Run

```sh
docker compose up -d
docker compose logs -f app
```

The log shows three steps before the server takes requests:

```
[blastmap] environment: ok — hosts: github; ai: not configured
[blastmap] migrations: applying 2
[blastmap] migrations: applied 2
```

If the environment check fails, the container exits and lists every variable
that needs fixing. Fix `.env` and run `docker compose up -d` again.

Open `BETTER_AUTH_URL` and sign in.

The container runs as an unprivileged user and listens on port 3000. The
compose file publishes Postgres on `127.0.0.1:5432` for local development. On a
server, remove that `ports:` entry under `db` if nothing outside the compose
network needs the database, and change the database password in both
`compose.yaml` and `DATABASE_URL`.

## Behind a reverse proxy

Put Blastmap behind your usual reverse proxy for TLS and your domain. Two
things matter:

- **`BETTER_AUTH_URL` is the public `https://` URL**, not the internal one.
- **Don't buffer responses.** Mapping progress streams over Server-Sent Events.
  Blastmap sends `X-Accel-Buffering: no`, which nginx honours, but other proxies
  may need telling.

**Caddy:**

```caddy
blastmap.example.com {
	reverse_proxy localhost:3000 {
		flush_interval -1
	}
}
```

**nginx:**

```nginx
server {
  listen 443 ssl;
  server_name blastmap.example.com;
  # ssl_certificate ... ;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 1h;
  }
}
```

## Using your own Postgres

Use a recent Postgres (the compose file runs 17). Point `DATABASE_URL` at it,
then build and run the image on its own:

```sh
docker build -t blastmap .
docker run -d --name blastmap --env-file .env -p 3000:3000 blastmap
```

Blastmap creates its tables on start. It needs a database it can create tables
in, plus the `drizzle` schema it uses to record which migrations have run.

## Upgrading

```sh
git pull
docker compose up -d --build
docker compose logs -f app
```

Migrations run on start, as a visible step in the log, never inside a request.
Take a [backup](#backups) first.

## Backups

Everything worth keeping is in Postgres:

```sh
docker compose exec db pg_dump -U blastmap blastmap > blastmap-$(date +%F).sql
```

Restore into an empty database:

```sh
docker compose exec -T db psql -U blastmap blastmap < blastmap-2026-01-01.sql
```

Back up `.env` too, or at least `BETTER_AUTH_SECRET`. A restored database is
useless without the secret its tokens were encrypted with. People can sign in
again, but every stored token is lost.

## Health and logs

- **Health:** `GET /api/health` returns `200 {"status":"ok"}` when the app is
  up and can reach Postgres. Otherwise it returns `503` with the reason. The
  image's Docker health check uses it.
- **Logs:** `docker compose logs app`. Host errors name the request and what
  came back, and never contain a token.

## What's stored where

- **Postgres:**
  - users, sessions, and host tokens, encrypted with `BETTER_AUTH_SECRET`
  - mapping results: the file list, edges and coverage for each mapped
    repository and commit
  - no source code
- **Temporary disk:** while a repository is being mapped, its archive is
  unpacked to the container's temporary directory. It's deleted when the
  mapping ends, and at startup if the previous process died mid-mapping. Allow
  free space of about twice the largest repository you'll map.
- **Leaving the instance:** only requests to your git host. Blastmap sends no
  telemetry, and the image turns off Next.js telemetry.

## Troubleshooting

**The container exits straight away.** Read the log. The environment check
names every missing or malformed variable. A provider ID without its secret is
an error, not a disabled provider.

**"redirect_uri mismatch" or similar on the host's sign-in page.** The callback
URL registered with the OAuth application must be exactly
`BETTER_AUTH_URL/api/auth/callback/github` (or `/gitlab`), with the same scheme,
host and port.

**Sign-in loops back to the sign-in page.** `BETTER_AUTH_URL` doesn't match the
URL in the browser. Behind a proxy, it must be the public `https://` URL.

**"no response (… certificate …)" from a self-hosted GitLab.** The container
doesn't trust your GitLab's certificate. Mount your CA bundle into the container
and set `NODE_EXTRA_CA_CERTS` to its path, e.g. in `compose.yaml`:

```yaml
app:
  volumes:
    - ./my-ca.pem:/etc/ssl/my-ca.pem:ro
  environment:
    NODE_EXTRA_CA_CERTS: /etc/ssl/my-ca.pem
```

**Mapping progress never moves, then jumps to done.** A proxy is buffering the
stream. See [Behind a reverse proxy](#behind-a-reverse-proxy).

**"refused before downloading".** The repository is over the 500 MB limit as
the host reports it. That limit is fixed.
