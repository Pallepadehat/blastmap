# Phase 05 — Framework adapters: file kinds and routes

The map learns what files are. A pluggable place for framework knowledge
gives files a kind by convention and recovers routes from syntax. The first
two adapters are Next.js and NestJS. The parser itself stays framework-blind:
everything here lives in adapters that read what the parser found.

## What it does

### Adapters

- An adapter knows one framework. It says whether a package uses that
  framework, gives kinds to files, and lists routes. Next.js and NestJS are
  the first two. A third framework means a new adapter and no change anywhere
  else.
- A package uses a framework when its `package.json` depends on it: `next`,
  or `@nestjs/core`. In a monorepo this is decided per workspace package, so a
  Next.js app and a NestJS API in the same repository each get their own
  adapter.
- Adapters run as part of mapping, after parsing, while the code is still
  unpacked. Their results are stored with the mapping.

### Kinds

- Every file gets at most one kind, from convention only: where it sits, what
  it's named, or a decorator on a class in it. No content is guessed at. A
  file no convention covers has no kind, and says so.
- Kinds that apply in any repository: test (`*.test.*`, `*.spec.*`, anything
  under `__tests__`), type declaration (`*.d.ts`), and config (`*.config.*` and
  the usual root config files).
- Next.js: page, layout, route handler, middleware, and special file (loading,
  error, not-found, template, default), for both the App and Pages routers.
- NestJS, by decorator: controller, service (`@Injectable`), module, resolver,
  gateway, guard, interceptor, pipe, exception filter, middleware.
- Kinds fall into a handful of colour groups, which are the only new colours:
  entry points (pages, route handlers, controllers, resolvers, gateways),
  logic (services, middleware, guards, interceptors, pipes, filters), wiring
  (layouts, modules), tests, and config and type declarations. A file without
  a kind stays grey.

### On the map

- File boxes show their kind's colour as a thin marker, and their kind's name
  in the detail panel. Folder boxes stay grey, because a folder holds mixed
  kinds.
- The left panel gains a Kinds section under Folders. It lists every kind
  found with its count, grouped by framework, plus the number of files with no
  kind. Choosing a kind highlights its files on the map and fades the rest,
  instantly. Choosing it again clears the highlight.

### Routes

- A route is a method and a full path. It's shown only if both can be read
  from the syntax. Anything not fully recoverable is left out entirely, never
  shown approximately. The Overview says how many route definitions were left
  out, and why.
- Next.js:
  - Page paths and route-handler methods come from the file system and the
    exported `GET`, `POST`, etc.
  - Route groups `(x)` add nothing to the path. Dynamic segments `[id]` become
    `:id`, and catch-alls `[...x]` become `*x`.
  - Parallel and intercepting routes are left out.
  - A `basePath` in the Next config is applied only if it's a plain string
    literal. If it's anything else, that app shows no routes.
- NestJS:
  - The path joins the `@Controller` prefix and the method decorator's path
    (`@Get`, `@Post`, …).
  - A global prefix set with `setGlobalPrefix` and a string literal is applied.
    If one is set any other way, or route modules or versioning reshape paths,
    that app shows no routes.
  - A controller or handler whose path isn't a string literal is left out.
- The Overview lists routes as method, path, and file with line number,
  grouped by app in a monorepo. Choosing one selects its file on the map.

### Existing mappings

Mappings made before this phase have no kinds or routes. They say so, with a
prompt to map the commit again, rather than showing an empty Kinds section.

## Acceptance check

1. Map this repository. Pages, layouts and route handlers have their kinds,
   and the Routes list matches the routes in the code: `/api/health`, the auth
   routes, the progress stream, and the pages.
2. Map a NestJS app, e.g. `lujakob/nestjs-realworld-example-app`.
   Controllers, services and modules have their kinds. Check five routes by
   hand against the decorators, including the global prefix.
3. In the Kinds section, choose Services. Only services stay bright on the
   map. Choose it again and everything returns.
4. A file with no convention shows "no kind" in the detail panel.
5. Add a controller whose path is a variable. Its routes are left out, and the
   Overview counts it as left out, with the reason.
6. Map a monorepo with a Next.js app and a NestJS package. Each gets its own
   kinds and routes, grouped by app.
7. Open a mapping made before this phase. It says to map again, instead of
   showing empty kinds.
8. Run `pnpm parse` on any repository. The parser's output is unchanged and
   mentions no framework.
