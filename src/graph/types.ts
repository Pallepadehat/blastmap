// What the map works from: the parser's files and edges, slimmed to what the
// browser needs. Every calculation in src/graph is a pure function over these,
// with nothing to fetch and nothing to mock.

export type MapFile = { path: string; skipped: boolean };

// One per importing file and imported file, whatever the kind of import.
export type MapEdge = { from: string; to: string };

export type MapUnresolved = { from: string; specifier: string; reason: string; detail: string };

export type MapData = {
  files: MapFile[];
  edges: MapEdge[];
  unresolved: MapUnresolved[];
};
