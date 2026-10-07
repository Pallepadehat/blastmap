// The parser's output. Plain data, so it can be printed, stored or sent
// anywhere without the parser's own code coming along. Every path is relative
// to the parsed directory and uses forward slashes.

export type SkipReason = "too-large" | "parse-error" | "symlink";

export type FileEntry =
  | { path: string; status: "parsed" }
  | { path: string; status: "skipped"; reason: SkipReason; detail: string };

export type ImportKind = "import" | "re-export" | "dynamic-import" | "require";

export type Edge = {
  from: string;
  to: string;
  kind: ImportKind;
  // True only if every import of this kind between these two files is type-only.
  typeOnly: boolean;
};

export type ExternalImport = { from: string; specifier: string; kind: ImportKind };

export type UnresolvedReason =
  | "non-literal-specifier"
  | "target-missing"
  | "not-source-file"
  | "workspace-entry-missing";

export type UnresolvedImport = {
  from: string;
  // For a non-literal specifier, the expression's source text.
  specifier: string;
  kind: ImportKind;
  reason: UnresolvedReason;
  detail: string;
};

export type WorkspacePackage = { name: string; dir: string };

// A config file the parser read and couldn't fully use, e.g. a tsconfig that
// extends a package that isn't in the directory. Resolution carries on without
// it, so this is where to look when aliases don't resolve.
export type ConfigProblem = { file: string; message: string };

export type Coverage = {
  files: {
    found: number;
    parsed: number;
    skipped: number;
    skippedByReason: Record<SkipReason, number>;
  };
  // Counts import statements and calls, not distinct edges.
  imports: {
    found: number;
    resolved: number;
    external: number;
    unresolved: number;
    unresolvedByReason: Record<UnresolvedReason, number>;
  };
  workspacePackages: WorkspacePackage[];
  configProblems: ConfigProblem[];
  // Symlinked directories aren't followed: they can loop, and they can point
  // outside the directory being parsed.
  symlinkedDirectories: string[];
};

export type ParseResult = {
  files: FileEntry[];
  edges: Edge[];
  external: ExternalImport[];
  unresolved: UnresolvedImport[];
  coverage: Coverage;
};
