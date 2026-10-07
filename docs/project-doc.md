# Blastmap

The product decisions behind this build, written before it starts, with the
reasoning attached. The reasoning matters more than the decision — you'll hit
forks this doesn't cover, and you'll need to know which way the thinking was
leaning.

Read the part you need before you build something. Don't read it all at once,
and don't paste it into a prompt.

## What it is

An open-source, self-hosted app. Run it with Docker, sign in with GitHub or
GitLab, pick a repository you can read there, and get a map of it. Folders as
boxes, imports as lines between them. Open a folder into its files. Select a
file and see what it imports, what imports it, and what breaks two levels out
if it changes. Ask for an explanation and get a paragraph written from that file
and its real neighbours.

Then a panel where you can ask the repository a question and watch it look the
answer up.

## The problem

Codebases now routinely contain code nobody on the team has read. An agent wrote
it, someone confirmed it worked, it shipped. That is a reasonable way to work and
it is not going to stop — but it accumulates structure nobody chose. Files that
import through three layers of re-exports. A utility forty files depend on. A
module nothing has referenced in months.

The questions that follow are structural. What is this file, what depends on it,
what breaks if it changes. Answering them today means reading imports one file at
a time and holding the results in working memory, which stops working at around
thirty files and stops being attempted at all somewhere past a hundred.

## Who it's for

A developer opening a codebase they didn't write — most often one they built
themselves with an agent, across many sessions, and can no longer hold in their
head. They can read code fine. What they can't see is its shape.

And the team around them. A repository is mapped once and everyone who can read
it starts from the map. Who can read it is decided by the place the code already
lives — GitHub or GitLab — not by a second permission system.

And whoever runs the instance: one person at a company, with Docker and twenty
minutes, who should not need to read the source to get it working.

This description is the test every feature gets measured against. When something
tempting comes up — a quality score, a rating, a review panel — the question is
whether the person described above wants it. Usually they don't. They want to
know what depends on this file.

## Why this hasn't stuck before

Codebase visualisation is not a new idea and the track record is bad. CodeSee
built close to this with real funding behind it and is gone. Sourcetrail ran for
years as a desktop tool and was archived.

The most likely explanation: both were selling a map of a codebase the user had
already read. A map you could have drawn yourself is a nice-to-have, and
nice-to-haves lose. What changed is that people now ship code they have never
read, which turns the same artifact into something needed on a specific
afternoon for a specific reason.

The current generation of AI tools mostly hand the repository to a hosted model
and let it describe the structure. That is fast to build, and it means sending
your code to someone else. This project does the opposite on both counts: the
structure comes from parsing, and the whole thing runs on your own machines.

That's the bet. It is a bet, and it should be stated as one.

## The rule everything rests on

**Every box and every line comes from really parsing the code.**

The AI may explain and label. It may never decide that two files are connected,
and it may never walk the graph when arithmetic can do it instead.

The reason, bluntly: a dependency graph that is ninety percent right is worse
than no graph, because there's no way to tell which ten percent is wrong. The
moment a model is allowed to guess at an edge, every edge becomes a maybe, and
the product is a nice-looking picture.

Pressure to break this will come from two directions. "AI code analysis" pulls
toward letting the model reason about structure. Anything calling itself a code
tool drifts toward becoming a code reviewer. Both are refused — and in an
open-source project, both will arrive as pull requests.

## The second rule

**Code goes to the git host it came from and the AI endpoint the operator
configured. Nowhere else.**

No telemetry, no analytics, no third-party tracing, no hosted service that sees
file contents. Traces live in the instance's own database. Self-hosting is the
reason someone picks this over a hosted tool, so this rule is the product, not a
policy around it.

## The third rule

**Configurable at the edges, fixed at the core.**

An operator chooses which git hosts are enabled, which AI endpoint to use, and
where the database is. Nobody configures what counts as an edge, whether the AI
may guess structure, or whether there's a scoring mode. One obvious behaviour
beats a set of toggles, and every option is a combination someone has to keep
working.

## Scope

- **Sign-in with GitHub or GitLab, and nothing else.** The account you sign in
  with is the account whose access decides what you can map. An operator enables
  one or both. GitLab can be gitlab.com or a self-hosted instance, including one
  that itself signs people in through Keycloak or another identity provider —
  that sits behind GitLab and is not our concern.
- **The signed-in user's own token fetches repositories and answers access
  questions.** No server-wide token. Tokens are stored encrypted, read only on
  the server, and never reach the browser.
- **GitLab: public and private repositories**, with read-only scopes.
- **GitHub: public repositories only in v1.** GitHub's OAuth scope for private
  repositories also grants write access, which is more than a read-only tool
  should hold. Private GitHub support waits for a GitHub App with read-only
  contents permission.
- **Access mirrors the host.** A map is visible to a user only if their host says
  they can read that repository. Analyses are shared: mapped once per repository
  and commit, visible to everyone who passes that check.
- Choosing a repository and a branch to map.
- Parsing every file — imports, re-exports and dynamic imports become edges.
  `require()` as well, because a large amount of real code still uses it.
- Workspace monorepos (pnpm, yarn, npm workspaces). Imports between packages in
  the same repository resolve to real files.
- A pluggable place for framework knowledge, so knowing what a Next.js route
  looks like never leaks into the parser itself.
- Fan-in and fan-out per file.
- The map: folders folding into boxes, expanding into files, selection,
  highlighting, and a detail panel.
- Blast radius and dependency chain, as arithmetic over the edge list.
- Coverage reporting — how much of the repository was parsed, and why the rest
  wasn't.
- Live progress during parsing, because parsing a real repository is not
  instant.
- **AI is optional.** With no AI endpoint configured, the map, blast radius and
  coverage all work, and the AI panels say plainly that AI isn't set up. With
  one configured: explaining a file with a cache that isn't optional, labelling
  files convention couldn't identify, a chat panel answered by an agent that
  looks facts up rather than recalling them, and a check that the AI never names
  a file that doesn't exist.
- **Deployment as one Docker image** plus a compose file with Postgres, so a
  first run is `docker compose up` and a filled-in env file.

## Later, once the above works

Written down so the direction is known. None of it gets built early, and none of
it gets scaffolded for.

- **Private GitHub repositories** through a GitHub App with read-only contents
  permission.
- **The parser as its own package** with a CLI, usable in CI or other tools
  without the app.
- **Parsing in CI.** That CLI runs on pushes to the default branch and sends its
  result to an instance. No size limit from a single process, maps always
  current.
- **Blast radius on pull and merge requests.** A CI job compares the branch with
  its target and comments with the facts: these changed files, these files that
  import them, two levels out. A list, never a verdict.
- **Edges across repositories**, for internal shared packages, resolved to files
  in another mapped repository. If that repository isn't mapped, the import is
  reported unresolved with that reason.
- **Structural diff** between two commits: which edges appeared, which went.
- **CODEOWNERS overlay**, as information about who to ask, not as judgement.
- **A published image** in a container registry, built from tagged releases.

## Out of scope, and why

Each of these is something a model — or a contributor — will propose, because
each of them sounds like an improvement. The reason matters more than the
refusal.

- **Scores, grades, severity badges, "three issues found".** This tool explains
  a codebase; it does not review one. Once there's a number, people argue with
  the number instead of reading the map. This applies to pull request comments
  too.
- **Letting the agent traverse the graph itself.** It picks a starting point and
  a direction; the same arithmetic that draws the canvas does the walk. If the
  model does the walking, invented structure comes straight back in.
- **Other sign-in methods.** No email and password, no generic OIDC, no Google.
  The git host account is the one that matters, because it's the one that
  decides access. A second identity would need a link to the first and a way to
  go wrong.
- **Our own organizations, teams or roles.** The host already knows who can read
  what. A second copy drifts out of date and becomes the bug.
- **Other git hosts in v1.** Bitbucket, Gitea and the rest fit the host adapter
  later; they are not v1.
- **Approximate routes.** If a route's method and full path can't both be
  recovered from the syntax, show nothing. A wrong route is the same failure as
  an invented edge.
- **Workers, queues, a second service.** One app container and Postgres. If a
  repository is too large, that is a limit to state honestly — the CI parser
  later is the answer, not an architecture built around it now.
- **Telemetry of any kind**, including anonymous usage counts. See the second
  rule.
- **Languages beyond TypeScript and JavaScript.** Getting one language genuinely
  right is the entire proposition.

## How it works

No folder names here — the structure is yours to choose. These are constraints
on behaviour.

**The parser is standalone.** It takes a directory path and returns files, edges
and a coverage report. It does not know the web framework exists, does not know
the database exists, does not know any git host exists, and must run from a
plain script with nothing else running. If it can't run standalone, the layering
is wrong — and the package and CI plans later depend on exactly this.

**Git hosts are adapters.** Each host adapter does three things: fetch a
repository at a ref into a directory, list repositories the user can read, and
answer whether the user can read a given one. GitHub and GitLab are two
implementations of the same interface. An `if (host === ...)` outside an adapter
means the interface has failed.

**Fetching downloads an archive, not a clone.** Both hosts serve a repository at
a ref as a tarball over their API. That needs no git binary in the image and no
shelling out. The archive is unpacked to a temporary directory, parsed, and
deleted.

**Framework knowledge is an adapter, not a branch.** Knowing that a file in a
particular position is a page is Next.js knowledge and belongs in an adapter. An
`if (framework === ...)` inside parsing code means the interface built to prevent
exactly that has failed.

**Graph calculations are pure functions** over a list of files and a list of
edges. No data fetching inside them, nothing to mock in order to check them.

**Identity is better-auth with the GitHub and GitLab providers.** better-auth
owns the session and stores each user's host token. Tokens are encrypted at rest.
Nothing outside the host adapters reads a token.

**The database is Postgres, accessed through Drizzle.** better-auth's tables
live there too.

**Access is decided in one place.** Every read of an analysis goes through a
single server-side data-access layer, and no query touching analysis data is
written outside it. That layer asks the user's host adapter whether they can
read the repository. The answer may be cached for a few minutes per user and
repository, never longer, and the cache is stated in the code. A query written
anywhere else is a bypass, even if it happens to return the right rows.

**Parsing runs in the app process.** Progress is written to the analysis row as
it goes and streamed to the browser over Server-Sent Events, so a reload picks
up where it was. Repositories above a size limit are refused before download,
with the limit and the repository's size in the message.

**Every AI call is traced and cached**, with the cache read inside the traced
function, so a cache hit appears as a recorded run containing no model call.
That's what makes the cache verifiable rather than assumed. Traces live in the
instance's own database.

**The AI client is OpenAI-compatible and configured by base URL.** That covers
hosted providers and local ones like Ollama or vLLM. Which one is an operator
decision, made in the environment, never in the code.

**Configuration is environment variables, checked at startup.** The app
validates its environment before it serves anything, and if something required
is missing or malformed it exits with a message naming exactly what. At least one
git host must be enabled. A half-configured provider — an ID without a secret —
is an error, not a disabled provider.

**The container is boring.** A multi-stage build producing Next.js standalone
output, running as a non-root user, with a health endpoint. Database migrations
run as an explicit step the operator can see in the logs, not silently inside a
request. It works behind a reverse proxy at whatever public URL the operator
sets.

## The interface

A dense developer tool, not a dashboard. Small type, tight spacing, monospace for
anything that is a file path. Someone using this is scanning a lot of names at
once, and the layout should assume that rather than fighting it.

**Colour carries meaning or it isn't there.** Two things earn colour. Direction:
what flows _into_ a file and what flows _out_ of it are different colours,
because that distinction is the entire reason to look at an edge. And kind: a
file gets a colour for what sort of thing it is, with enough hues to separate a
handful of categories and no more. Everything else — surfaces, borders, body
text — is greyscale.

**The palette starts at four decisions.** One blue as the accent, for selection
and anything interactive. Green for incoming, amber for outgoing. Surfaces near
white in light mode, near black in dark. Everything else derives from those —
pick sensible values, keep them consistent, and don't ask about each one.

**Dark and light, and the user's choice wins.** Three states: follow the system,
force light, force dark. The choice survives a reload. Both palettes are real
palettes rather than one of them inverted.

**Nothing moves on its own.** Motion happens because something was clicked. No
ambient animation, no pulsing, no drifting graph.

**Anything derivable from the edge list is instant.** If an answer is arithmetic
over data the browser already holds, it appears immediately — no spinner, no
network request. Putting a spinner in front of a calculation teaches people to
distrust the fast paths, which are most of them.

**Links point at things.** A selected file has a URL. Pasting it into a pull
request discussion should open the map with that file selected, and a link from
a file to its host should open it at the mapped ref.

**The shell gets built once.** Where the panels sit, and what each one is for, is
settled in an early phase. Later phases add to those panels; they don't rearrange
them. Specific placement lives in the phase specs.

## Where this is likely to go wrong

**Folding folders into readable boxes.** A large repository has to collapse into
something legible, and the threshold has to be solved for rather than guessed.
Expect at least one wrong answer here before a right one.

**Import resolution.** Path aliases, index files, re-exports, workspace
packages. The risk isn't failure — it's _silent_ failure. A repository built on
barrel files or workspace links loses most of its edges and still renders a
clean, confident, wrong picture. This is the one place loud reporting wins over
a tidy interface.

**Self-hosted GitLab.** Internal certificates, proxies, unusual base paths,
older versions. When a host call fails, the error says what was requested and
what came back — never a generic "couldn't load repository".

**Token lifetime.** GitLab tokens expire and need refreshing; a revoked token
must turn into "sign in again", not a stack trace or a silently empty list.

**First-run setup.** Registering an OAuth application on a host, getting the
callback URL right, and filling the env file is where self-hosters give up. The
startup check and the README are the product here as much as the map is.

**Measuring whether the AI output is any good.** Reading a few outputs and
judging them fine is not measurement. The requirement is that answer quality
becomes a number; the method for producing that number is genuinely open, and
it is the least settled part of this plan.

## What has to be true before a release

Not "it looks right". Specifics:

- From a clean machine, `docker compose up` with a filled-in env file reaches a
  working sign-in page, following only the README.
- With a required variable missing, the container exits and names it.
- Pointed at a known repository, five files checked by hand match what the
  parser claims they import — including at least one import across workspace
  packages.
- Coverage states what was skipped and why, and the number is believable.
- Signed in as someone who can't read a repository on its host, that
  repository's map does not come back from the server at all — not hidden by the
  interface, absent from the response.
- No token appears in the browser, in a log line, or unencrypted in the
  database.
- With AI unconfigured, everything except the AI panels works.
- No request carrying source code goes anywhere except the git host and the
  configured AI endpoint.
- An explanation never names a file absent from the repository, and that is
  demonstrated by a check rather than asserted.
- The chat panel shows what it looked up before it answers. An answer arriving
  with no lookups behind it is the exact failure this tool exists to prevent.
