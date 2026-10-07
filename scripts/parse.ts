// Runs the parser on a directory and prints what it found. For checking the
// parser by hand: `pnpm parse <dir>` for a summary, `--json` for everything.
import path from "node:path";
import { parseDirectory, type ParseResult } from "../src/parser/index.ts";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));

if (!dir) {
  console.error("usage: pnpm parse <directory> [--json]");
  process.exitCode = 2;
} else {
  const started = performance.now();
  const result = await parseDirectory(dir);
  const seconds = (performance.now() - started) / 1000;
  // No process.exit() after printing: it cuts piped output off before it drains.
  console.log(args.includes("--json") ? JSON.stringify(result, null, 2) : summary(dir, result, seconds));
}

function summary(dir: string, result: ParseResult, seconds: number): string {
  const { coverage: c } = result;
  const lines = [
    `${path.resolve(dir)}  ${seconds.toFixed(1)}s`,
    "",
    `files    ${c.files.found} found · ${c.files.parsed} parsed · ${c.files.skipped} skipped${breakdown(c.files.skippedByReason)}`,
    `imports  ${c.imports.found} found · ${c.imports.resolved} resolved · ${c.imports.external} external · ${c.imports.unresolved} unresolved${breakdown(c.imports.unresolvedByReason)}`,
    `edges    ${result.edges.length} distinct`,
  ];

  const section = (title: string, rows: string[]) => {
    if (rows.length > 0) lines.push("", `${title} (${rows.length})`, ...rows.map((r) => `  ${r}`));
  };
  section("workspace packages", c.workspacePackages.map((w) => `${w.name}  ${w.dir}`));
  section(
    "skipped files",
    result.files.flatMap((f) => (f.status === "skipped" ? [`${f.path}  ${f.reason}: ${f.detail}`] : [])),
  );
  section("unresolved imports", result.unresolved.map((u) => `${u.from}  ${u.specifier}  ${u.reason}: ${u.detail}`));
  section("config problems", c.configProblems.map((p) => `${p.file}  ${p.message}`));
  section("symlinked directories, not followed", c.symlinkedDirectories);

  return lines.join("\n");
}

function breakdown(counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([reason, n]) => `${n} ${reason}`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}
