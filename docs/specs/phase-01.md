# Phase 01 — Parser

The standalone parser. A directory goes in; files, import edges and a coverage
report come out. No UI, no database, no git host. This is the part the whole
product rests on, so it's built and checked on its own before anything draws it.

## What it does

- Takes a directory path and returns plain data: the list of files, the list of
  edges, and a coverage report. Same directory in, same output out, sorted, with
  paths relative to the directory root using forward slashes.
- Runs from a plain script with nothing else running: no environment variables,
  no database, no Next. The lint setup fails if parsing code imports Next,
  React, the database client or anything host-related.
- A development script runs the parser on a directory and prints a readable
  summary, plus the full result as JSON on request. This is for checking, not
  the CI-ready CLI from the "later" list.

### Files

- Every `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs` and `.cjs` file is
  a file in the result, `.d.ts` included.
- `node_modules` and `.git` are never walked. Nothing else is silently ignored.
- A file is skipped, with the reason recorded, if it's over 1 MB or fails to
  parse. Skipped files still appear in the coverage report. Other files are
  unaffected.

### Edges

An edge goes from one file to another only when an import in the first resolves
to the second, and the second exists in the directory. Each edge records its
kind:

- static `import`, including side-effect imports (`import "./x"`)
- re-export (`export … from`)
- dynamic `import()` with a string literal
- `require()` with a string literal

An edge also records whether it's type-only. Type imports are real
dependencies, because changing a type breaks the importer at compile time.

Edges point at the file named in the import. A barrel file is a file with
edges, and the parser doesn't look through it. Following chains is graph
arithmetic for a later phase.

### Resolution

In order:

- Relative paths, with extension and `index` file resolution the way
  TypeScript resolves them, including `.js` specifiers that point at `.ts`
  source.
- `paths` and `baseUrl` from the nearest `tsconfig.json`/`jsconfig.json`,
  following `extends`.
- Workspace packages declared in `pnpm-workspace.yaml` or in the `workspaces`
  field of the root `package.json` (npm and yarn). An import of a workspace
  package's name, or a subpath of it, resolves through that package's
  `exports`, then `types`/`main`, to a file in the repository.

Every import that doesn't become an edge is accounted for as one of two things:

- **External**: a Node built-in, or a package that isn't in the repository.
  This is counted but isn't a problem.
- **Unresolved**: anything else, with a reason. The reasons are: the
  specifier isn't a string literal; the relative or aliased target doesn't
  exist; or the workspace package's entry points at a file that isn't in the
  repository. Each one lists the file, the specifier and the reason.

### Coverage report

- Files found, parsed, and skipped, with the skipped count broken down by
  reason.
- Imports found, split into edges, external and unresolved, with unresolved
  broken down by reason.
- Workspace packages detected, by name and directory.

## Acceptance check

1. Run the script on this repository. The summary reads as believable. Pick
   five files, read their imports by hand, and confirm the edges match exactly,
   with every external import counted as external.
2. Run it on a pnpm monorepo where one package imports another. At least one
   edge crosses packages and lands on a real source file.
3. Add a file with a syntax error. It shows as skipped with the parse error,
   and every other file's edges are unchanged.
4. Add `import(someVariable)` to a file. It shows as unresolved with the reason
   that the specifier isn't a literal.
5. Add `import "./does-not-exist"`. It shows as unresolved with the reason that
   the target doesn't exist.
6. Run the script with no `.env` and Postgres stopped. It still works.
