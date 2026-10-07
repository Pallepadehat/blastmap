// Every kind a file can have, and the colour group it belongs to. Plain data
// with no imports, so the browser can use it to draw and label the map.

// Bumped whenever an adapter is added or changes what it finds. A mapping
// stored with an older version is offered "Map again" to pick up the change;
// without this, adding an adapter would leave every existing mapping silently
// incomplete.
export const ADAPTERS_VERSION = 1;

export type KindGroup = "entry" | "logic" | "wiring" | "test" | "config";

export type FrameworkId = "next" | "nest";

export const FRAMEWORKS: Record<FrameworkId, string> = { next: "Next.js", nest: "NestJS" };

type KindInfo = { label: string; plural: string; group: KindGroup; framework: FrameworkId | null };

export const KINDS = {
  // Any repository.
  test: { label: "Test", plural: "Tests", group: "test", framework: null },
  types: { label: "Type declaration", plural: "Type declarations", group: "config", framework: null },
  config: { label: "Config", plural: "Config", group: "config", framework: null },

  "next:page": { label: "Page", plural: "Pages", group: "entry", framework: "next" },
  "next:route": { label: "Route handler", plural: "Route handlers", group: "entry", framework: "next" },
  "next:layout": { label: "Layout", plural: "Layouts", group: "wiring", framework: "next" },
  "next:middleware": { label: "Middleware", plural: "Middleware", group: "logic", framework: "next" },
  "next:special": { label: "Special file", plural: "Special files", group: "wiring", framework: "next" },

  "nest:controller": { label: "Controller", plural: "Controllers", group: "entry", framework: "nest" },
  "nest:resolver": { label: "Resolver", plural: "Resolvers", group: "entry", framework: "nest" },
  "nest:gateway": { label: "Gateway", plural: "Gateways", group: "entry", framework: "nest" },
  "nest:module": { label: "Module", plural: "Modules", group: "wiring", framework: "nest" },
  "nest:service": { label: "Service", plural: "Services", group: "logic", framework: "nest" },
  "nest:guard": { label: "Guard", plural: "Guards", group: "logic", framework: "nest" },
  "nest:interceptor": { label: "Interceptor", plural: "Interceptors", group: "logic", framework: "nest" },
  "nest:pipe": { label: "Pipe", plural: "Pipes", group: "logic", framework: "nest" },
  "nest:filter": { label: "Exception filter", plural: "Exception filters", group: "logic", framework: "nest" },
  "nest:middleware": { label: "Middleware", plural: "Middleware", group: "logic", framework: "nest" },
} as const satisfies Record<string, KindInfo>;

export type KindId = keyof typeof KINDS;

export const KIND_IDS = Object.keys(KINDS).filter((k): k is KindId => Object.hasOwn(KINDS, k));

export const isKindId = (value: string): value is KindId => Object.hasOwn(KINDS, value);
