import path from "node:path";
import { Node } from "ts-morph";
import type { AppContext, AppFindings, FrameworkAdapter } from "./adapter.ts";
import type { KindId } from "./kinds.ts";
import { withinPackage } from "./packages.ts";
import { yieldToEventLoop } from "./sources.ts";
import { defaultExportLine, exportedNames, joinUrlPath, stringLiteral } from "./syntax.ts";
import { HTTP_METHODS } from "./types.ts";

const APP_DIRS = ["src/app", "app"];
const PAGES_DIRS = ["src/pages", "pages"];
const PAGE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const SPECIAL = new Set(["loading", "error", "global-error", "not-found", "template", "default", "forbidden", "unauthorized"]);
const MIDDLEWARE = new Set(["middleware", "proxy"]);
const CONFIG_FILES = ["next.config.ts", "next.config.mts", "next.config.js", "next.config.mjs", "next.config.cjs"];

export const next: FrameworkAdapter = {
  id: "next",
  uses: (deps) => deps.has("next"),

  async analyse(ctx: AppContext): Promise<AppFindings> {
    const findings: AppFindings = { kinds: new Map(), routes: [], omitted: [] };
    const basePath = readBasePath(ctx);

    for (const file of ctx.files) {
      const rel = withinPackage(ctx.app.dir, file);
      const ext = path.extname(rel);
      if (!PAGE_EXTENSIONS.has(ext)) continue;
      const name = path.basename(rel, ext);
      const dir = path.dirname(rel);

      if ((dir === "." || dir === "src") && MIDDLEWARE.has(name)) {
        findings.kinds.set(file, "next:middleware");
        continue;
      }
      const appRoot = APP_DIRS.find((d) => rel.startsWith(`${d}/`));
      if (appRoot) {
        await appRouterFile(ctx, findings, file, rel.slice(appRoot.length + 1), name, basePath);
        continue;
      }
      const pagesRoot = PAGES_DIRS.find((d) => rel.startsWith(`${d}/`));
      if (pagesRoot) pagesRouterFile(ctx, findings, file, rel.slice(pagesRoot.length + 1, -ext.length), basePath);
    }
    return findings;
  },
};

type BasePath = { prefix: string } | { blocked: string };

// `basePath` shifts every route, so it's applied only when it's a plain string
// in the config. Anything computed blocks every route in the app instead.
function readBasePath(ctx: AppContext): BasePath {
  for (const name of CONFIG_FILES) {
    const sf = ctx.sources.get(ctx.app.dir ? `${ctx.app.dir}/${name}` : name);
    if (!sf) continue;
    for (const node of sf.getDescendants()) {
      const isBasePath =
        (Node.isPropertyAssignment(node) || Node.isShorthandPropertyAssignment(node)) && node.getName() === "basePath";
      if (!isBasePath) continue;
      const value = Node.isPropertyAssignment(node) ? stringLiteral(node.getInitializer()) : null;
      return value === null ? { blocked: `${name} sets basePath to something other than a string literal` } : { prefix: value };
    }
    return { prefix: "" };
  }
  return { prefix: "" };
}

async function appRouterFile(
  ctx: AppContext,
  findings: AppFindings,
  file: string,
  inner: string,
  name: string,
  basePath: BasePath,
) {
  const kind: KindId | null =
    name === "page" ? "next:page" : name === "route" ? "next:route" : name === "layout" ? "next:layout" : SPECIAL.has(name) ? "next:special" : null;
  if (!kind) return;

  const segments = path.dirname(inner) === "." ? [] : path.dirname(inner).split("/");
  // Folders starting with _ are private: nothing in them is routable.
  if (segments.some((s) => s.startsWith("_"))) return;
  findings.kinds.set(file, kind);
  if (kind !== "next:page" && kind !== "next:route") return;

  const sf = ctx.sources.get(file);
  await yieldToEventLoop();
  const omit = (line: number, reason: string) => findings.omitted.push({ app: ctx.app.dir, file, line, reason });
  if (!sf) return omit(1, "the file couldn't be read");

  const urlPath = appRouterPath(segments);
  if ("blocked" in urlPath) return omit(1, urlPath.blocked);
  if ("blocked" in basePath) return omit(1, basePath.blocked);
  const full = joinUrlPath(basePath.prefix, urlPath.path);

  if (kind === "next:page") {
    findings.routes.push({ app: ctx.app.dir, method: "PAGE", path: full, file, line: defaultExportLine(sf) });
    return;
  }
  const { names, exportsAll } = exportedNames(sf);
  if (exportsAll) return omit(1, "re-exports everything from another module, so its methods can't be read");
  for (const method of HTTP_METHODS) {
    const line = names.get(method);
    if (line !== undefined) findings.routes.push({ app: ctx.app.dir, method, path: full, file, line });
  }
}

// App Router folders to a URL path. Route groups add nothing; parallel and
// intercepting routes are left out, because their URL depends on navigation
// state, not on the file system alone.
function appRouterPath(segments: string[]): { path: string } | { blocked: string } {
  const parts: string[] = [];
  for (const s of segments) {
    if (s.startsWith("@")) return { blocked: `${s} is a parallel route slot` };
    if (/^\(\.{1,3}\)/.test(s)) return { blocked: `${s} is an intercepting route` };
    if (s.startsWith("(") && s.endsWith(")")) continue;
    parts.push(dynamicSegment(s));
  }
  return { path: `/${parts.join("/")}` };
}

function pagesRouterFile(ctx: AppContext, findings: AppFindings, file: string, inner: string, basePath: BasePath) {
  const segments = inner.split("/");
  const omit = (reason: string) => findings.omitted.push({ app: ctx.app.dir, file, line: 1, reason });

  if (segments[0] === "api") {
    findings.kinds.set(file, "next:route");
    // A Pages Router API route answers every method unless its body checks
    // req.method; there's nothing declarative to read.
    return omit("Pages Router API routes don't declare their methods");
  }
  if (segments.length === 1 && segments[0]?.startsWith("_")) {
    findings.kinds.set(file, "next:special");
    return;
  }
  findings.kinds.set(file, "next:page");
  if ("blocked" in basePath) return omit(basePath.blocked);

  const parts = segments.at(-1) === "index" ? segments.slice(0, -1) : segments;
  const sf = ctx.sources.get(file);
  findings.routes.push({
    app: ctx.app.dir,
    method: "PAGE",
    path: joinUrlPath(basePath.prefix, `/${parts.map(dynamicSegment).join("/")}`),
    file,
    line: sf ? defaultExportLine(sf) : 1,
  });
}

function dynamicSegment(s: string): string {
  const optionalCatchAll = /^\[\[\.\.\.(.+)\]\]$/.exec(s);
  if (optionalCatchAll) return `*${optionalCatchAll[1]}?`;
  const catchAll = /^\[\.\.\.(.+)\]$/.exec(s);
  if (catchAll) return `*${catchAll[1]}`;
  const dynamic = /^\[(.+)\]$/.exec(s);
  return dynamic ? `:${dynamic[1]}` : s;
}

