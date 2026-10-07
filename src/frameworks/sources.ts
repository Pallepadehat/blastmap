import fs from "node:fs";
import path from "node:path";
import { Project, ts, type SourceFile } from "ts-morph";

// Larger files are generated or bundled; the parser skips them too.
const MAX_FILE_BYTES = 1024 * 1024;

// Syntax trees for the files adapters look inside, parsed on first request.
// Like the parser: an in-memory project, nothing resolved or type-checked, and
// nothing read outside the repository root.
export class Sources {
  private readonly root: string;
  private readonly project = new Project({
    useInMemoryFileSystem: true,
    skipLoadingLibFiles: true,
    compilerOptions: { allowJs: true, noResolve: true, noLib: true, jsx: ts.JsxEmit.Preserve },
  });
  private readonly parsed = new Map<string, SourceFile | null>();

  constructor(root: string) {
    this.root = root;
  }

  // Null for a file that's missing, too large, or outside the root.
  get(rel: string): SourceFile | null {
    const known = this.parsed.get(rel);
    if (known !== undefined) return known;
    const text = this.read(rel);
    const sf = text === null ? null : this.project.createSourceFile(`/${rel}`, text, { overwrite: true });
    this.parsed.set(rel, sf);
    return sf;
  }

  read(rel: string): string | null {
    const abs = path.resolve(this.root, rel);
    if (path.relative(this.root, abs).startsWith("..")) return null;
    const stat = fs.statSync(abs, { throwIfNoEntry: false });
    if (!stat?.isFile() || stat.size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(abs, "utf8");
  }
}

// Gives the event loop a turn, so a server stays responsive while adapters
// read through a large repository.
export const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve));
