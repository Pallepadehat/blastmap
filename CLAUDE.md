# Blastmap

An open-source, self-hosted app that reads a repository from GitHub or GitLab
and draws it as a dependency map. Everything on screen comes from really parsing
the code. The AI explains what the parser found, it never decides what's there.

Why any of these rules exist is in `docs/project-doc.md`. This file is the
rules themselves.

## Stack

Next.js 16 App Router (standalone output), React 19, TypeScript strict. ts-morph
for parsing. React Flow and dagre for the map. better-auth with the GitHub and
GitLab providers, and nothing else. Postgres through Drizzle. Server-Sent Events
for live progress. An OpenAI-compatible SDK through one wrapped client, set by
base URL, optional. Traces stored in our own Postgres. Tailwind v4. pnpm. One
Docker image plus a compose file with Postgres.

UI components are shadcn/ui on Base UI, added with `pnpm dlx shadcn@latest add`
and owned in the repo. Import `cn` from the `cn` package. The theme tokens in
the global stylesheet are ours; don't let the CLI overwrite them, and don't add
`tw-animate-css`, the `shadcn` runtime package or Google fonts.

Next.js 16 and better-auth both change quickly. If you're not certain about an
API, read the docs inside the installed package rather than going from memory.

## Environment

All configuration is environment variables, validated at startup. Missing or
malformed means the app exits naming exactly what. A provider with an ID but no
secret is an error, not a disabled provider. At least one git host is required.

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the public URL of the instance)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — optional pair
- `GITLAB_URL` (defaults to https://gitlab.com), `GITLAB_CLIENT_ID`,
  `GITLAB_CLIENT_SECRET` — optional set
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` — optional; without them the AI panels
  say AI isn't configured and everything else works

Every variable appears in `.env.example` with a one-line comment. Don't add a
variable without asking.

## How we work

Spec driven. Nothing gets built without a spec.

- `docs/project-doc.md` — what this app is and every decision behind it. Read
  the part you need. Don't ask me to paste it.
- `docs/specs/phase-NN.md` — one per phase, written just before it starts.
  Behaviour and an acceptance check, never filenames.
- This file — always true, read on every prompt.

**Starting a phase.** Read this file and that phase's spec. Build what the spec
asks and stop.

**Dropped into a fresh context and don't know where we are?** Look at which
files exist in `docs/specs/`, then the git log. The last commit is the last
phase that passed. Tell me what you've worked out before building on it.

**The acceptance check is mine to run, not yours.** It's a list of things I do
by hand in a browser. Don't automate it, don't install a test runner or browser
driver for it. Build so those things are true, then tell me it's ready.

**What you check before saying a phase is done:** types, lint, build. If the
phase touched the Dockerfile, the compose file or the environment check, also
`docker build`. Anything verifiable from a terminal is yours — running a script
and reading its output counts. Anything needing a browser is mine.

**When a phase comes out wrong, I reset rather than patch.** Prompting on top of
wrong code three times leaves code nobody understands, including you. So if a
spec is ambiguous, say so _before_ you build.

## How to talk to me

Short. If a sentence isn't telling me something I need, cut it.

**Ask with an answer attached.** One specific question, and say which way you'd
go and why. "A or B, I'd take B because it keeps the parser standalone" is
answerable in two seconds. An open question isn't. Never pick a direction
silently, never build both.

**When you need something only I can give you** — an OAuth app registration, a
secret, a value in `.env.local` — say exactly what and exactly where, then stop.

**No walls of text.** Don't summarise every file you touched or restate the plan
back to me. When a phase is done, say what it does and what the check should
show, in a few lines.

**Plain English.** If you're reaching for a bulleted breakdown of something
that's one sentence, it's one sentence.

**Say when something didn't work.** A failure worked around quietly costs me an
hour later.

## How the code is laid out

You pick the file structure. These are about behaviour.

- **The parsing code can't import Next, React, the database client or any host
  code.** Directory path in, data out, runnable from a plain script.
- **Git hosts are adapters behind one interface:** fetch a repository at a ref,
  list the user's readable repositories, answer whether the user can read one.
  No `if (host === ...)` outside an adapter.
- **Fetching downloads the host's archive over its API.** No git binary, no
  shelling out. Unpack to a temp directory, parse, delete.
- **No framework checks inside the parser.** That knowledge lives in an adapter.
- **Graph calculations are pure functions** over a file list and an edge list.
- **Database access happens in server code**, not inside components.
- **Every read of analysis data goes through one data-access layer**, which asks
  the host adapter whether the user can read that repository. No query touching
  analysis tables is written anywhere else.
- **Host tokens are read only inside host adapters**, and stored encrypted. If
  better-auth can't encrypt them itself, tell me before working around it.
- **One place constructs the AI client.** Anywhere else silently skips tracing.
- **One place reads and validates the environment.** Nothing else touches
  `process.env`.

## Conventions

Strict TypeScript, no `any`. If a type is genuinely awkward, tell me rather than
casting.

Comment the decisions, not the syntax.

Every AI call has a cache read inside its trace, so a cache hit shows up as a
recorded run with no model call in it.

One obvious way to do something beats a configurable one. Configuration exists
at the edges — hosts, AI endpoint, database — never for how the core behaves.

Errors from a git host say what was requested and what came back. An expired or
revoked token becomes "sign in again", never a stack trace or an empty list.

The container runs as a non-root user, has a health endpoint, and runs
migrations as a visible step, not inside a request.

The UI is a dense developer tool. Small type, tight spacing, monospace for file
paths. Colour means something or isn't there. Nothing moves unless it was
clicked.

There's a frontend design skill that activates on its own for UI work. Use it,
but the paragraph above overrules it — it will reach for motion, depth and big
type, and this is a tool someone stares at for an hour.

## Things not to do

Breaking one of these is worse than not finishing.

- **Never decide that two files are connected.** An edge exists because the
  parser resolved a real import to a real file. Unresolved gets reported with a
  reason, never guessed.
- **Never invent something to fill a gap.** Skipped file? Say so and count it.
  Route not fully recoverable? Show none. Absent beats approximate.
- **Never send code or data anywhere but the git host and the configured AI
  endpoint.** No telemetry, analytics or third-party tracing, not even anonymous.
- **Never expose a token.** Not to the browser, not in logs, not in an error
  message, not unencrypted in the database.
- **Don't add sign-in methods.** GitHub and GitLab only.
- **Don't request write scopes.** Read-only on every host. Private GitHub
  repositories wait for a GitHub App; don't use the `repo` scope.
- **Don't build our own teams or roles.** Access follows the host.
- **Don't install a package without asking.** Name it, say what for, wait.
- **Don't build ahead of the current phase.** No scaffolding for what's coming,
  including the "later" list in the project doc.
- **Don't grade the code.** No scores, ratings, severity or "issues found". This
  explains a codebase, it doesn't review one.
- **Don't leave the build broken.** Tell me about a failure instead of working
  around it.
- **Don't weaken a check to make it pass.** A check that can't run has to fail
  loudly.
- **Don't read from the database on a loop.** Name your columns, limit list
  reads, push progress over SSE instead of polling.
