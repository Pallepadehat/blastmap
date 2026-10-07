import type { ParseResult, SkipReason, UnresolvedReason } from "@/parser";

const SKIP_LABEL: Record<SkipReason, string> = {
  "too-large": "over 1 MB",
  "parse-error": "syntax error",
  symlink: "symbolic link",
};

const UNRESOLVED_LABEL: Record<UnresolvedReason, string> = {
  "non-literal-specifier": "specifier isn't a string literal",
  "target-missing": "target doesn't exist",
  "not-source-file": "not a JS/TS file",
  "workspace-entry-missing": "workspace entry not in the repository",
};

const SKIP_REASONS: SkipReason[] = ["too-large", "parse-error", "symlink"];
const UNRESOLVED_REASONS: UnresolvedReason[] = [
  "target-missing",
  "workspace-entry-missing",
  "not-source-file",
  "non-literal-specifier",
];

// What the parser covered and what it couldn't, all of it. The gaps are
// listed in full, because a tidy summary over a silent gap is the failure
// this report exists to prevent.
export function CoverageReport({ result }: { result: ParseResult }) {
  const c = result.coverage;
  const skipped = result.files.flatMap((f) => (f.status === "skipped" ? [f] : []));
  const unresolvedReasons = UNRESOLVED_REASONS.filter((r) => c.imports.unresolvedByReason[r] > 0);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid w-fit grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-xs tabular-nums">
        <dt className="text-muted-foreground">Files</dt>
        <dd>
          {c.files.found} found · {c.files.parsed} parsed · {c.files.skipped} skipped
          {breakdown(SKIP_REASONS, c.files.skippedByReason, SKIP_LABEL)}
        </dd>
        <dt className="text-muted-foreground">Imports</dt>
        <dd>
          {c.imports.found} found · {c.imports.resolved} resolved · {c.imports.external} external ·{" "}
          {c.imports.unresolved} unresolved
        </dd>
        <dt className="text-muted-foreground">Edges</dt>
        <dd>{result.edges.length}</dd>
      </dl>

      {unresolvedReasons.map((reason) => (
        <Section key={reason} title={`Unresolved: ${UNRESOLVED_LABEL[reason]}`} count={c.imports.unresolvedByReason[reason]}>
          {result.unresolved
            .filter((u) => u.reason === reason)
            .map((u, i) => (
              <Row key={i} cells={[u.from, u.specifier]} detail={u.detail} />
            ))}
        </Section>
      ))}

      <Section title="Skipped files" count={skipped.length}>
        {skipped.map((f) => (
          <Row key={f.path} cells={[f.path, SKIP_LABEL[f.reason]]} detail={f.detail} />
        ))}
      </Section>

      <Section title="Workspace packages" count={c.workspacePackages.length}>
        {c.workspacePackages.map((w) => (
          <Row key={w.name} cells={[w.name, w.dir]} />
        ))}
      </Section>

      <Section title="Config problems" count={c.configProblems.length}>
        {c.configProblems.map((p, i) => (
          <Row key={i} cells={[p.file]} detail={p.message} />
        ))}
      </Section>

      <Section title="Symlinked directories, not followed" count={c.symlinkedDirectories.length}>
        {c.symlinkedDirectories.map((d) => (
          <Row key={d} cells={[d]} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold">
        {title} <span className="font-normal text-muted-foreground tabular-nums">{count}</span>
      </h3>
      <ul className="flex flex-col border-y text-xs">{children}</ul>
    </section>
  );
}

function Row({ cells, detail }: { cells: string[]; detail?: string }) {
  return (
    <li className="flex min-h-6 flex-wrap items-baseline gap-x-3 border-b px-2 py-0.5 last:border-b-0">
      {cells.map((cell, i) => (
        <span key={i} className="font-mono">
          {cell}
        </span>
      ))}
      {detail && <span className="text-muted-foreground">{detail}</span>}
    </li>
  );
}

function breakdown<K extends string>(keys: K[], counts: Record<K, number>, labels: Record<K, string>): string {
  const parts = keys.filter((k) => counts[k] > 0).map((k) => `${counts[k]} ${labels[k]}`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}
