import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { ImportKind } from "./types.ts";

// One import as written in a file, before resolution. `specifier` is null when
// the argument isn't a string literal; `text` is then what was written.
export type RawImport = { kind: ImportKind; specifier: string | null; text: string; typeOnly: boolean };

export function extractImports(sf: SourceFile): RawImport[] {
  const found: RawImport[] = [];
  const literal = (kind: ImportKind, specifier: string, typeOnly: boolean) =>
    found.push({ kind, specifier, text: specifier, typeOnly });
  // An argument that may or may not be a string literal.
  const dynamic = (kind: ImportKind, arg: Node, typeOnly: boolean) => {
    const specifier = stringLiteral(arg);
    found.push({ kind, specifier, text: specifier ?? arg.getText(), typeOnly });
  };

  for (const decl of sf.getImportDeclarations()) {
    // `import { type A, type B } from "x"` is erased like `import type`, but a
    // default or namespace import alongside keeps it at runtime.
    const named = decl.getNamedImports();
    const allNamedAreTypes =
      named.length > 0 && !decl.getDefaultImport() && !decl.getNamespaceImport() && named.every((n) => n.isTypeOnly());
    literal("import", decl.getModuleSpecifierValue(), decl.isTypeOnly() || allNamedAreTypes);
  }

  for (const decl of sf.getExportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (specifier === undefined) continue; // a local `export { a }`, not a re-export
    const named = decl.getNamedExports();
    const allNamedAreTypes = named.length > 0 && named.every((n) => n.isTypeOnly());
    literal("re-export", specifier, decl.isTypeOnly() || allNamedAreTypes);
  }

  sf.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const callee = node.getExpression();
      const isImport = callee.getKind() === SyntaxKind.ImportKeyword;
      const isRequire = Node.isIdentifier(callee) && callee.getText() === "require";
      const arg = node.getArguments()[0];
      if ((!isImport && !isRequire) || !arg) return;
      dynamic(isImport ? "dynamic-import" : "require", arg, false);
    } else if (Node.isImportEqualsDeclaration(node)) {
      // `import x = require("y")`
      const ref = node.getModuleReference();
      if (!Node.isExternalModuleReference(ref)) return;
      const expr = ref.getExpression();
      if (expr) dynamic("require", expr, node.isTypeOnly());
    } else if (Node.isImportTypeNode(node)) {
      // `typeof import("./x")` in a type position
      const arg = node.getArgument();
      dynamic("import", Node.isLiteralTypeNode(arg) ? arg.getLiteral() : arg, true);
    }
  });

  return found;
}

function stringLiteral(node: Node): string | null {
  return Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node) ? node.getLiteralValue() : null;
}
