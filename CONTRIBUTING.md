# Contributing to Blastmap

Thanks for wanting to help. Blastmap is small and opinionated, and a few things
work differently here from most projects. Reading this first saves you a pull
request that can't be merged.

## Before you write code

**Read the rules.** [`CLAUDE.md`](CLAUDE.md) holds the rules the codebase
follows. [`docs/project-doc.md`](docs/project-doc.md) explains the reasoning
behind them. The rules apply to every contribution, human or AI-assisted.

**Some things won't be merged, however well they're built:**

- **Anything that decides two files are connected without the parser
  resolving a real import.** No heuristics, no AI-inferred edges. An unresolved
  import is reported with its reason, never guessed.
- **Scores, grades, severity or "issues found".** Blastmap explains code; it
  doesn't review it.
- **Sign-in methods besides GitHub and GitLab, or teams and roles of our own.**
  Access follows the git host.
- **Telemetry or analytics of any kind,** including anonymous counts, and any
  request that sends code or data somewhere other than the git host or the
  configured AI endpoint.
- **Write scopes on any host,** including GitHub's `repo` scope.
- **New configuration for how the core behaves.** Configuration exists at the
  edges (hosts, AI endpoint, database) only.

**Open an issue before a large change.** Features are built from short written
specs in [`docs/specs/`](docs/specs). Each spec describes behaviour and ends
with an acceptance check. For anything beyond a bug fix, agree on the behaviour
in an issue first, so it can become a spec before it becomes code.

**Ask before adding a dependency.** Name the package and what it's for in the
issue or the pull request description.

## Setting up

You need Node 24, pnpm and Docker.

```sh
git clone https://github.com/Pallepadehat/blastmap.git
cd blastmap
pnpm install
cp .env.example .env.local
```

In `.env.local`, set:

- `DATABASE_URL=postgres://blastmap:blastmap@localhost:5432/blastmap`
- `BETTER_AUTH_SECRET` (run `openssl rand -base64 32`)
- `BETTER_AUTH_URL=http://localhost:3000`
- the credentials of a development OAuth app on GitHub or GitLab (see
  [docs/deployment.md](docs/deployment.md#1-register-the-oauth-application))

Then:

```sh
docker compose up -d db   # Postgres only
pnpm dev                  # the app, with hot reload, on :3000
```

The parser runs on its own, with no database or environment:

```sh
pnpm parse path/to/a/repo          # summary
pnpm parse path/to/a/repo --json   # everything
pnpm frameworks path/to/a/repo     # kinds and routes from the framework adapters
```

## How the code is laid out

- `src/parser`: the standalone parser. Directory in, files, edges and coverage
  out. It can't import Next, React, the database or any host code, and lint
  enforces that.
- `src/frameworks`: framework adapters (Next.js, NestJS) that give files a
  kind and recover routes. Standalone like the parser, and the only place that
  knows any framework exists. A new framework is a new adapter: see
  [docs/adapters.md](docs/adapters.md). With an AI agent, "add an adapter for
  <framework>" runs the project's `add-framework-adapter` skill, which follows
  the same guide. It lives in `.agents/skills`; `.claude/skills` links to it.
- `src/graph`: pure functions over files and edges (folder tree, layout, blast
  radius). Nothing to fetch, nothing to mock.
- `src/server/hosts`: one adapter per git host behind a single interface. Host
  tokens are read only here. There's no `if (host === ...)` anywhere else.
- `src/server/mappings`: the only place analysis data is queried. Every read
  asks the host whether the user can read the repository first.
- `src/server/env.ts`: the only place that reads `process.env`.
- `src/app`: Next.js pages and routes.

## Checks

Before opening a pull request, run:

```sh
pnpm check   # types, lint and build
```

If you touched the Dockerfile, the compose file or the environment check, also
run `docker build .`. CI runs the same checks on every pull request.

## Pull requests

- Branch from `develop` and open the pull request against `develop`. `master`
  only receives releases.
- Keep each pull request to one change, and describe what it does and how you
  checked it.
- Code style: strict TypeScript, no `any`, no casting around a type problem.
  Comments explain decisions, not syntax. Match the surrounding code.
- UI: a dense developer tool. Small type, tight spacing, monospace for paths.
  Colour only where it carries meaning, and no animation that isn't the direct
  result of a click.

## Licensing of contributions

Blastmap is licensed under the [Functional Source License 1.1, ALv2 Future
License](LICENSE.md). By contributing, you agree that your contribution is
licensed under the same terms.

## Conduct

Everyone taking part is expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
