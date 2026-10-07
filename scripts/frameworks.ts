// Runs the parser and then the framework adapters on a directory, and prints
// the kinds and routes found. For checking adapters by hand:
// `pnpm frameworks <dir>`, or `--json` for everything.
import { analyseFrameworks, KINDS, type KindId } from "../src/frameworks/index.ts";
import { parseDirectory } from "../src/parser/index.ts";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));

if (!dir) {
  console.error("usage: pnpm frameworks <directory> [--json]");
  process.exitCode = 2;
} else {
  const result = await analyseFrameworks(dir, await parseDirectory(dir));
  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const counts = new Map<KindId, number>();
    for (const kind of Object.values(result.kinds)) counts.set(kind, (counts.get(kind) ?? 0) + 1);
    const lines = [
      `apps     ${result.apps.map((a) => `${a.framework} ${a.dir || "(root)"}`).join(", ") || "none"}`,
      `kinds    ${[...counts].map(([k, n]) => `${n} ${KINDS[k].plural.toLowerCase()}`).join(", ")}`,
      "",
      `routes (${result.routes.length})`,
      ...result.routes.map((r) => `  ${r.method.padEnd(7)} ${r.path}  ${r.file}:${r.line}`),
    ];
    if (result.omitted.length > 0) {
      lines.push("", `left out (${result.omitted.length})`, ...result.omitted.map((o) => `  ${o.file}:${o.line}  ${o.reason}`));
    }
    console.log(lines.join("\n"));
  }
}
