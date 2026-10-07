import path from "node:path";
import { ts } from "ts-morph";
import type { Host } from "./host.ts";
import { toRelative } from "./paths.ts";
import type { ConfigProblem } from "./types.ts";

const CONFIG_NAMES = ["tsconfig.json", "jsconfig.json"];

// "No inputs were found": expected, because we never let TypeScript enumerate
// files; we only want the compiler options.
const NO_INPUTS = 18003;

export type ResolutionConfig = {
  options: ts.CompilerOptions;
  cache: ts.ModuleResolutionCache;
};

// Finds and parses the nearest tsconfig/jsconfig for each directory, once.
export class TsconfigLookup {
  private byDir = new Map<string, ResolutionConfig>();
  private byConfig = new Map<string, ResolutionConfig>();
  readonly problems: ConfigProblem[] = [];
  private readonly root: string;
  private readonly host: Host;

  constructor(root: string, host: Host) {
    this.root = root;
    this.host = host;
  }

  forDirectory(dir: string): ResolutionConfig {
    const known = this.byDir.get(dir);
    if (known) return known;

    let config: ResolutionConfig;
    const file = CONFIG_NAMES.map((n) => path.join(dir, n)).find((f) => this.host.fileExists(f));
    if (file) {
      config = this.load(file);
    } else if (dir === this.root) {
      config = this.build({});
    } else {
      config = this.forDirectory(path.dirname(dir));
    }
    this.byDir.set(dir, config);
    return config;
  }

  private load(file: string): ResolutionConfig {
    const known = this.byConfig.get(file);
    if (known) return known;

    const read = ts.readConfigFile(file, (p) => this.host.readFile(p));
    let options: ts.CompilerOptions = {};
    if (read.error) {
      this.report(file, read.error);
    } else {
      const parsed = ts.parseJsonConfigFileContent(
        read.config,
        {
          useCaseSensitiveFileNames: true,
          readDirectory: () => [],
          fileExists: (p) => this.host.fileExists(p),
          readFile: (p) => this.host.readFile(p),
        },
        path.dirname(file),
        undefined,
        file,
      );
      for (const err of parsed.errors) if (err.code !== NO_INPUTS) this.report(file, err);
      options = parsed.options;
    }

    const config = this.build(options);
    this.byConfig.set(file, config);
    return config;
  }

  // Only `paths`/`baseUrl` (and what TypeScript derives from them) are taken
  // from the project. Resolution mode is fixed to the most permissive one so a
  // relative import resolves the way the project's own bundler would see it.
  private build(project: ts.CompilerOptions): ResolutionConfig {
    const options: ts.CompilerOptions = {
      ...project,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: true,
      resolveJsonModule: false,
    };
    return { options, cache: ts.createModuleResolutionCache(this.root, (s) => s, options) };
  }

  private report(file: string, diagnostic: ts.Diagnostic) {
    this.problems.push({
      file: toRelative(this.root, file),
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
    });
  }
}

// Whether a specifier is covered by a `paths` pattern. An alias that matches
// but doesn't resolve is a missing target, not an external package.
export function matchesPathsAlias(specifier: string, options: ts.CompilerOptions): boolean {
  for (const pattern of Object.keys(options.paths ?? {})) {
    const star = pattern.indexOf("*");
    if (star === -1) {
      if (specifier === pattern) return true;
    } else if (
      specifier.length >= pattern.length - 1 &&
      specifier.startsWith(pattern.slice(0, star)) &&
      specifier.endsWith(pattern.slice(star + 1))
    ) {
      return true;
    }
  }
  return false;
}
