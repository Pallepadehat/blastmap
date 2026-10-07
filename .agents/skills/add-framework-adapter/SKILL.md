---
name: add-framework-adapter
description: Add a framework adapter to Blastmap, so files in projects using that framework get kinds (controller, page, service…) and routes. Use when asked to "add an adapter for X", "support X", "add X kinds/routes", or to extend an existing adapter (Next.js, NestJS) with new conventions.
---

# Add a framework adapter

Blastmap's framework knowledge lives in adapters in `src/frameworks`. Your job
is to add one, or extend one, following the project's rules exactly. Getting
it slightly wrong is worse than not doing it: a guessed kind or an approximate
route breaks the product's central promise.

## Before anything else

1. **Read the rules.** Read `CLAUDE.md` (always true) and `docs/adapters.md`
   (the adapter rules and the step-by-step guide). Then read the existing
   adapters as models:
   - `src/frameworks/next.ts`: conventions from the file system and exports.
   - `src/frameworks/nest.ts`: conventions from decorators and interfaces,
     checked against the framework's imports.
   - `src/frameworks/adapter.ts`, `kinds.ts`, `syntax.ts`, `index.ts`.
2. **Write the spec first.** The project is spec-driven: nothing gets built
   without one. Draft `docs/specs/adapter-<id>.md` with behaviour and an
   acceptance check, never filenames. It covers:
   - **Detection:** which `package.json` dependency means the framework is in
     use.
   - **Kinds:** each kind, the exact convention behind it, and its colour group
     (entry, logic, wiring, test, config). Reuse existing kinds' meaning where
     they fit.
   - **Routes:** how method and full path are read, including app-wide prefixes
     or base paths.
   - **Left out:** every case where a route can't be fully read, with the
     reason the user will see.
   - **Acceptance check:** a real public repository using the framework, five
     routes to verify by hand, and a fixture case for each omission.
3. **Get approval.** Show the user the spec in a few lines. Ask one question
   if anything is genuinely ambiguous, with the answer you'd pick attached.
   Don't write adapter code until they approve. If the user didn't name a
   framework id, propose a short lowercase one (`express`, `remix`, `sveltekit`).
4. **Check the conventions in the framework's own documentation** (current
   version) rather than relying on memory. Conventions change between major
   versions; say which versions the adapter covers.

## Building it

Follow the steps in `docs/adapters.md` → "Adding an adapter, step by step":

1. **Kinds and id:** in `src/frameworks/kinds.ts`, add the id to `FrameworkId`
   and `FRAMEWORKS`, and add kinds as `"<id>:<kind>"`.
2. **The adapter:** write `src/frameworks/<id>.ts` exporting a
   `FrameworkAdapter`. Match the style of `next.ts` and `nest.ts`: comment each
   convention with why it's reliable, and each omission with why it can't be
   read.
3. **Register it:** add it to `ADAPTERS` in `src/frameworks/index.ts`.
4. **Bump `ADAPTERS_VERSION`** in `src/frameworks/kinds.ts` by one. This is
   what makes existing mappings offer "Map again" to pick up the adapter. Bump
   it too when you change what an existing adapter finds.

Hard rules (from `docs/adapters.md`, repeated because they're the ones most
often broken):

- **Kinds from convention only.** Never infer a kind from what code appears to
  do.
- **Verify the source.** A decorator, base class or helper only counts if it's
  imported from the framework's own package.
- **Routes need an exact method and full path from syntax.** Anything computed
  becomes an `OmittedRoute` with a plain-English reason. Never approximate.
- **App-wide path changes** (prefix, base path, versioning, route modules):
  apply them only when they're string literals. Otherwise, omit every route in
  that app, with the reason.
- **Stay standalone and responsive.** No imports of app code (lint enforces
  it), no network, no shelling out. Call `yieldToEventLoop()` every 50 files in
  long loops.
- **No new colour group or new package** without asking the user first.
- **Nothing framework-specific outside the adapter,** including in the UI.

## Checking it

These are yours to run before saying it's done:

1. **Fixture:** build a fixture repository under `/tmp` with one file per kind
   convention and one per omission case, then run `pnpm frameworks /tmp/<fixture>`.
   Every kind and every omission comes out as specified, and nothing else
   gets a kind.
2. **Real repository:** shallow-clone a real public repository that uses the
   framework (`git clone --depth 1`), run `pnpm frameworks` on it, and check at
   least five routes against the source by hand. Show those comparisons to the
   user.
3. **Monorepo:** a monorepo fixture with the framework in one workspace package
   gets kinds only there.
4. **Parser:** `git diff -- src/parser` is empty. Adapters never touch the
   parser.
5. **Build:** `pnpm check` passes (types, lint, build).

## Finishing

1. **Docs:**
   - add the framework to the "Supported frameworks" table in
     `docs/adapters.md`
   - add it to the "Knows …" line in `README.md`
   - list its kinds in the README if that line enumerates them
2. **Tell the user** in a few lines:
   - what the adapter recognises and what it deliberately leaves out
   - the real repository you checked, and the routes you verified
   - anything you couldn't verify
3. Don't commit unless asked. Mention that existing mappings now show "Map
   again" to pick up the adapter, because you bumped `ADAPTERS_VERSION`.
