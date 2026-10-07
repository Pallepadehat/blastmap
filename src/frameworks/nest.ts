import { Node, SyntaxKind, type ClassDeclaration, type Decorator, type SourceFile } from "ts-morph";
import type { AppContext, AppFindings, FrameworkAdapter } from "./adapter.ts";
import type { KindId } from "./kinds.ts";
import { yieldToEventLoop } from "./sources.ts";
import { joinUrlPath, stringLiteral } from "./syntax.ts";
import type { RouteMethod } from "./types.ts";

const YIELD_EVERY = 50;

const HTTP_DECORATORS: Record<string, RouteMethod> = {
  Get: "GET",
  Post: "POST",
  Put: "PUT",
  Patch: "PATCH",
  Delete: "DELETE",
  Head: "HEAD",
  Options: "OPTIONS",
  All: "ALL",
};

// When a file holds several decorated classes, the most significant decides
// its kind.
const PRECEDENCE: KindId[] = [
  "nest:controller",
  "nest:resolver",
  "nest:gateway",
  "nest:module",
  "nest:guard",
  "nest:interceptor",
  "nest:pipe",
  "nest:filter",
  "nest:middleware",
  "nest:service",
];

export const nest: FrameworkAdapter = {
  id: "nest",
  uses: (deps) => deps.has("@nestjs/core"),

  async analyse(ctx: AppContext): Promise<AppFindings> {
    const findings: AppFindings = { kinds: new Map(), routes: [], omitted: [] };
    const files = ctx.files.filter((f) => /\.[cm]?ts$/.test(f));
    const controllers: { file: string; sf: SourceFile; cls: ClassDeclaration; nest: NestNames }[] = [];
    const appWide: AppWide = { prefix: "", blocked: null };

    for (const [i, file] of files.entries()) {
      if (i % YIELD_EVERY === 0) await yieldToEventLoop();
      const sf = ctx.sources.get(file);
      if (!sf) continue;
      const nest = nestNames(sf);
      if (nest.size === 0) continue;

      readAppWideRouting(sf, file, appWide);
      const kinds = sf.getClasses().flatMap((cls) => {
        const kind = classKind(cls, nest);
        if (kind === "nest:controller") controllers.push({ file, sf, cls, nest });
        return kind ? [kind] : [];
      });
      const kind = PRECEDENCE.find((k) => kinds.includes(k));
      if (kind) findings.kinds.set(file, kind);
    }

    // Routes last: a global prefix in main.ts applies to controllers read
    // before it.
    for (const { file, cls, nest } of controllers) controllerRoutes(ctx, findings, file, cls, nest, appWide);
    return findings;
  },
};

// Identifiers this file imports from a @nestjs/* package. A decorator only
// counts if it comes from NestJS, so a homegrown @Controller is never taken
// for one.
type NestNames = Map<string, string>;

function nestNames(sf: SourceFile): NestNames {
  const names: NestNames = new Map();
  for (const decl of sf.getImportDeclarations()) {
    if (!decl.getModuleSpecifierValue().startsWith("@nestjs/")) continue;
    for (const spec of decl.getNamedImports()) {
      names.set(spec.getAliasNode()?.getText() ?? spec.getName(), spec.getName());
    }
  }
  return names;
}

// A node's NestJS decorators, keyed by their name in @nestjs (whatever they
// were imported as).
function decoratorsOf(node: { getDecorators(): Decorator[] }, nest: NestNames): Map<string, Decorator> {
  const found = new Map<string, Decorator>();
  for (const d of node.getDecorators()) {
    const original = nest.get(d.getName());
    if (original) found.set(original, d);
  }
  return found;
}

function classKind(cls: ClassDeclaration, nest: NestNames): KindId | null {
  const decorators = decoratorsOf(cls, nest);
  const implemented = new Set(
    cls.getImplements().flatMap((i) => {
      const original = nest.get(i.getExpression().getText());
      return original ? [original] : [];
    }),
  );
  if (decorators.has("Controller")) return "nest:controller";
  if (decorators.has("Resolver")) return "nest:resolver";
  if (decorators.has("WebSocketGateway")) return "nest:gateway";
  if (decorators.has("Module")) return "nest:module";
  if (decorators.has("Catch")) return "nest:filter";
  if (implemented.has("CanActivate")) return "nest:guard";
  if (implemented.has("NestInterceptor")) return "nest:interceptor";
  if (implemented.has("PipeTransform")) return "nest:pipe";
  if (implemented.has("NestMiddleware")) return "nest:middleware";
  if (decorators.has("Injectable")) return "nest:service";
  return null;
}

// Things set up once for the whole app that change every route's path. A
// literal global prefix is applied; anything we can't read exactly blocks the
// app's routes rather than letting them show a wrong path.
type AppWide = { prefix: string; blocked: string | null };

function readAppWideRouting(sf: SourceFile, file: string, appWide: AppWide) {
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) continue;
    const method = callee.getName();
    const where = `${file}:${call.getStartLineNumber()}`;

    if (method === "setGlobalPrefix") {
      const [prefix, options] = call.getArguments();
      const value = stringLiteral(prefix);
      if (value === null) appWide.blocked = `the global prefix at ${where} isn't a string literal`;
      else if (options) appWide.blocked = `the global prefix at ${where} has options that exclude some routes`;
      else appWide.prefix = value;
    } else if (method === "enableVersioning") {
      appWide.blocked = `versioning is enabled at ${where}`;
    } else if (callee.getExpression().getText() === "RouterModule" && method === "register") {
      appWide.blocked = `RouterModule reshapes paths at ${where}`;
    }
  }
}

function controllerRoutes(
  ctx: AppContext,
  findings: AppFindings,
  file: string,
  cls: ClassDeclaration,
  nest: NestNames,
  appWide: AppWide,
) {
  const app = ctx.app.dir;
  const controller = decoratorsOf(cls, nest).get("Controller");
  if (!controller) return;
  const omit = (line: number, reason: string) => findings.omitted.push({ app, file, line, reason });
  const classLine = controller.getStartLineNumber();

  if (appWide.blocked) return omit(classLine, appWide.blocked);
  const prefix = controllerPrefix(controller);
  if ("blocked" in prefix) return omit(classLine, prefix.blocked);

  for (const handler of cls.getMethods()) {
    for (const [name, decorator] of decoratorsOf(handler, nest)) {
      const method = HTTP_DECORATORS[name];
      if (!method) continue;
      const line = decorator.getStartLineNumber();
      const [arg] = decorator.getArguments();
      const sub = arg === undefined ? "" : stringLiteral(arg);
      if (sub === null) {
        omit(line, `@${name}() on ${handler.getName()} has a path that isn't a string literal`);
        continue;
      }
      findings.routes.push({ app, method, path: joinUrlPath(appWide.prefix, prefix.path, sub), file, line });
    }
  }
}

function controllerPrefix(decorator: Decorator): { path: string } | { blocked: string } {
  const [arg] = decorator.getArguments();
  if (arg === undefined) return { path: "" };
  const literal = stringLiteral(arg);
  if (literal !== null) return { path: literal };
  if (Node.isObjectLiteralExpression(arg)) {
    const names = arg.getProperties().map((p) => (Node.isPropertyAssignment(p) ? p.getName() : p.getText()));
    if (names.some((n) => n !== "path")) return { blocked: `@Controller() options other than path (${names.join(", ")}) change its routes` };
    const path = arg.getProperty("path");
    const value = path && Node.isPropertyAssignment(path) ? stringLiteral(path.getInitializer()) : null;
    if (value !== null) return { path: value };
  }
  return { blocked: "the @Controller() path isn't a string literal" };
}

