import type { FrameworkId, KindId } from "./kinds.ts";
import type { Sources } from "./sources.ts";
import type { App, OmittedRoute, Route } from "./types.ts";

export type AppContext = {
  app: App;
  // Repository-relative paths of the files that belong to this app, minus
  // those already given a kind (tests and type declarations).
  files: string[];
  sources: Sources;
};

export type AppFindings = {
  kinds: Map<string, KindId>;
  routes: Route[];
  omitted: OmittedRoute[];
};

// Everything one framework knows. Adding a framework means adding an adapter;
// nothing else changes, and nothing outside adapters asks which framework a
// repository uses.
export type FrameworkAdapter = {
  id: FrameworkId;
  // From the package's declared dependencies alone.
  uses(dependencies: Set<string>): boolean;
  analyse(ctx: AppContext): Promise<AppFindings>;
};
