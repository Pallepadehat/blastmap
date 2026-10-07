# Framework adapters

Blastmap's parser knows nothing about frameworks. Everything framework-specific
lives in an adapter in `src/frameworks`. An adapter gives files a **kind**
(page, controller, service and so on) and recovers **routes** (method and full
path).

Adding a framework means adding one adapter file and registering it. Nothing
else in the codebase changes, and nothing outside `src/frameworks` asks which
framework a repository uses.

- [Supported frameworks](#supported-frameworks)
- [How adapters run](#how-adapters-run)
- [The rules](#the-rules)
- [Adding an adapter, step by step](#adding-an-adapter-step-by-step)
- [Checking it](#checking-it)

## Supported frameworks

| Framework | Detected by       | Kinds                                                                                                              | Routes                                                                                                                                                       |
| --------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js   | `next`            | page, route handler, layout, middleware, special file (loading, error, not-found…), for the App and Pages routers   | Pages as `PAGE`, and route-handler methods from their exports. A literal `basePath` is applied. Parallel, intercepting and Pages Router API routes are left out. |
| NestJS    | `@nestjs/core`    | controller, resolver, gateway, module, service, guard, interceptor, pipe, exception filter, middleware, decided by decorators and interfaces imported from `@nestjs/*` | `@Controller` prefix plus the method decorator's path. A literal global prefix is applied. Versioning, `RouterModule` and non-literal paths are left out. |
| Any       | (always)          | test, type declaration, config                                                                                     | none                                                                                                                                                         |

## How adapters run

1. The parser runs and produces files, edges and coverage. See
   `src/parser`.
2. `analyseFrameworks` in `src/frameworks/index.ts` reads the root
   `package.json` and every workspace package's. A package uses a framework
   when its dependencies include the package the adapter looks for, so a
   monorepo can hold several apps.
3. Tests and type declarations get their kind first. Each adapter then
   analyses the files of each package it applies to. Config is the fallback
   kind for files no adapter claimed.
4. The result (apps, kinds, routes, omitted routes) is stored with the
   mapping, stamped with `ADAPTERS_VERSION`, and the map draws it. A mapping
   stamped with an older version offers "Map again".

An adapter implements this interface (`src/frameworks/adapter.ts`):

```ts
type FrameworkAdapter = {
  id: FrameworkId;
  // From the package's declared dependencies alone.
  uses(dependencies: Set<string>): boolean;
  analyse(ctx: AppContext): Promise<AppFindings>;
};

type AppContext = { app: App; files: string[]; sources: Sources };
type AppFindings = { kinds: Map<string, KindId>; routes: Route[]; omitted: OmittedRoute[] };
```

`ctx.sources.get(path)` returns a ts-morph `SourceFile`, parsed on first use,
for reading syntax. `ctx.sources.read(path)` returns raw text, e.g. for JSON.
`src/frameworks/syntax.ts` has helpers for exported names, string literals and
joining URL paths.

## The rules

These aren't style preferences. An adapter that breaks one won't be merged.

1. **Kinds come from convention only:** where a file sits, what it's named,
   or a decorator or interface on a class in it. Never from what the code seems
   to do. A file no convention covers gets no kind.
2. **Check where a decorator or base comes from.** A `@Controller` only counts
   if it's imported from the framework's own package. A homegrown decorator
   with the same name isn't one.
3. **A route needs both its method and its full path read exactly from the
   syntax.** If any part is computed (a variable, a function call, an array to
   expand), leave the route out and add an `OmittedRoute` with a plain-English
   reason. Never show an approximate route.
4. **App-wide settings that reshape paths** (a global prefix, a base path,
   versioning, route modules) are applied only when they're a plain string
   literal. If they're set any other way, every route in that app is omitted,
   with the reason.
5. **Reuse the existing kinds and colour groups** where they fit. A new kind
   goes in `src/frameworks/kinds.ts` with one of the five groups (entry,
   logic, wiring, test, config). Adding a group means adding a colour, and that
   needs an issue first.
6. **Stay standalone.** Adapters can't import Next, React, the database or app
   code; lint enforces it. No network access, no shelling out, no reading
   outside the repository root.
7. **Don't block the server.** When looping over many files, call
   `yieldToEventLoop()` every 50 files or so (see `nest.ts`).
8. **No framework checks outside the adapter.** The UI reads kinds and routes
   as data. If you find yourself writing `if (framework === ...)` elsewhere,
   the data needs another field instead.

## Adding an adapter, step by step

Say the framework is Express, with id `express`.

1. **Agree the behaviour first.** Open an issue, or write
   `docs/specs/adapter-express.md`, listing:
   - how the framework is detected
   - each kind and the exact convention behind it
   - how routes are read
   - what gets left out, and why
   - an acceptance check against a real public repository

   Blastmap is spec-driven; see [CONTRIBUTING.md](../CONTRIBUTING.md).
2. **Learn the conventions from the framework's own docs,** not from memory.
   Note the syntax each convention leaves behind, since that's all an adapter
   can see.
3. **Register the id and kinds** in `src/frameworks/kinds.ts`: add `express`
   to `FrameworkId` and `FRAMEWORKS`, and add kinds as `"express:router"` and
   so on, each with a label, a plural, a group and `framework: "express"`.
4. **Write `src/frameworks/express.ts`,** exporting an adapter object. Use
   `next.ts` (file-system conventions) and `nest.ts` (decorator conventions) as
   models. Comment each convention with why it's reliable, and each omission
   with why it can't be read.
5. **Register it** in the `ADAPTERS` list in `src/frameworks/index.ts`.
6. **Bump `ADAPTERS_VERSION`** in `src/frameworks/kinds.ts`. Existing mappings
   then offer "Map again" so they pick up the new adapter, instead of quietly
   staying incomplete. Bump it too whenever an adapter changes what it finds.
7. **Update this file's table** and the "Knows …" line in the README.

## Checking it

```sh
pnpm frameworks path/to/a/repo          # apps, kinds, routes, and routes left out
pnpm frameworks path/to/a/repo --json   # everything
pnpm check                              # types, lint, build
```

Before opening a pull request:

- **Fixture:** build a small fixture repository under `/tmp` with one file for
  every kind convention, and one for every case that must be omitted. Check
  each one appears exactly as it should.
- **Real repository:** run it on a real public repository that uses the
  framework, and check at least five routes by hand against the source.
- **Monorepo:** check a monorepo with the framework in one workspace package
  only. Only that package's files get its kinds.
- **Parser:** confirm `pnpm parse` output is unchanged. Adapters never change
  what the parser finds.
