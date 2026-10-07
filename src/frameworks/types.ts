import type { FrameworkId, KindId } from "./kinds.ts";

// What the framework adapters found, stored with a mapping next to the
// parser's result. Paths are relative to the repository root, like the
// parser's.

// One package that uses a framework: the repository root, or a workspace
// package in a monorepo.
export type App = { framework: FrameworkId; dir: string; name: string };

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

// "PAGE" is a page you navigate to, not an HTTP method; "ALL" is NestJS's
// @All(), which answers every method.
export type RouteMethod = (typeof HTTP_METHODS)[number] | "ALL" | "PAGE";

export type Route = { app: string; method: RouteMethod; path: string; file: string; line: number };

// A route definition that couldn't be fully read from the syntax, so it isn't
// shown. Absent beats approximate; this says what's absent and why.
export type OmittedRoute = { app: string; file: string; line: number; reason: string };

export type FrameworkResult = {
  // ADAPTERS_VERSION when this was produced.
  version: number;
  apps: App[];
  // Only files that have a kind. Every other file has none.
  kinds: Record<string, KindId>;
  routes: Route[];
  omitted: OmittedRoute[];
};
