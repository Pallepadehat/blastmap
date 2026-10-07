# Blastmap

Blastmap is a self-hosted app. It reads a repository from GitHub or GitLab and
draws it as a dependency map. Every box and every line comes from really
parsing the code. Nothing is guessed, and when something can't be resolved, the
map says so.

Sign in with the host your code lives on and pick a repository you can read.
You get folders as boxes and imports as lines. Select a file to see what it
imports, what imports it, and what breaks two levels out if it changes.

> **Status: early development.** Signing in, mapping a repository, the coverage
> report and the map all work. Framework awareness (routes, file roles) and the
> AI panels are still to come. Expect breaking changes until a first release.

## What it does

- **Maps TypeScript and JavaScript.** It reads imports, re-exports, dynamic
  imports and `require()` calls. It resolves relative paths, tsconfig `paths`
  aliases and workspace packages (pnpm, yarn, npm).
- **Never guesses an edge.** A line exists only because an import resolved to a
  real file. Every import that didn't resolve is listed with its reason in a
  coverage report, and the map tells you when it's partial.
- **Shows the blast radius.** For any file you see its importers, and theirs
  one level further out. This is arithmetic in your browser, not a model's
  opinion.
- **Lets the host decide access.** You sign in with GitHub or GitLab, including
  self-hosted GitLab. You see a repository's map only if that host says you can
  read the repository. There's no second permission system to keep in sync.
- **Keeps your code on your machines.** Code goes only to the git host it came
  from and, once AI features land, to the AI endpoint you configure. No
  telemetry, no analytics, no third-party tracing.

### What it deliberately doesn't do

Blastmap explains a codebase; it doesn't review one. There are no scores,
grades or "issues found". It also has no sign-in method besides GitHub and
GitLab, and no teams or roles of its own. The reasoning behind these choices is
in [`docs/project-doc.md`](docs/project-doc.md).

## Quick start

You need Docker with Compose, and an OAuth application registered on GitHub or
GitLab.

```sh
git clone https://github.com/Pallepadehat/blastmap.git
cd blastmap
cp .env.example .env
# Fill in .env: see "Configuration" below
docker compose up
```

Open http://localhost:3000 and sign in.

The full guide covers registering the OAuth application, running behind a
reverse proxy, upgrading and backups: **[docs/deployment.md](docs/deployment.md)**.

## Configuration

All configuration is environment variables. They're checked at startup, and
anything missing or malformed stops the container with a message naming every
variable that needs fixing.

| Variable                                     | Required                    | Purpose                                                                                     |
| -------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | yes                         | Postgres connection URL. The compose file's database is `postgres://blastmap:blastmap@db:5432/blastmap`. |
| `BETTER_AUTH_SECRET`                         | yes                         | At least 32 random characters. Signs sessions and encrypts stored tokens. `openssl rand -base64 32` |
| `BETTER_AUTH_URL`                            | yes                         | The public URL people open, e.g. `https://blastmap.example.com`.                            |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`   | one host required           | GitHub OAuth app. Set both or neither.                                                      |
| `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`   | one host required           | GitLab application. Set both or neither.                                                    |
| `GITLAB_URL`                                 | no                          | A self-hosted GitLab's address. Defaults to `https://gitlab.com`.                           |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`      | no                          | An OpenAI-compatible endpoint. Set all three or none. Not used yet.                         |

## Limits

- **Size:** repositories over 500 MB, as the host reports them, are refused
  before downloading. For GitHub, that figure includes git history.
- **Concurrency:** one repository is mapped at a time per instance; others
  queue.
- **GitHub repositories:** only public ones. GitHub's OAuth scope for private
  repositories also grants write access, which a read-only tool shouldn't hold.
  Private repositories will come through a GitHub App.
- **Languages:** TypeScript and JavaScript only.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first: the
project works from written specs, and a few rules aren't negotiable. Report
security issues privately, as described in [SECURITY.md](SECURITY.md).

## License

Blastmap is licensed under the
[Functional Source License, Version 1.1, ALv2 Future License](LICENSE.md)
(FSL-1.1-ALv2).

In plain terms:

- **You can:** use it, self-host it for yourself or your company, read it,
  modify it, and contribute back.
- **You can't:** sell it, or offer it as a product or service that competes with
  Blastmap.
- **Two years on:** each release becomes available under the Apache License 2.0,
  with no restrictions.

This is a summary, not legal advice; [LICENSE.md](LICENSE.md) is what counts.
