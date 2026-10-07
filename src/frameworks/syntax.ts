import { Node, type SourceFile } from "ts-morph";

// Names a module exports, with the line each is declared on, read from the
// syntax alone. `export *` can't be enumerated without resolving another
// module, so it's reported rather than guessed at.
export function exportedNames(sf: SourceFile): { names: Map<string, number>; exportsAll: boolean } {
  const names = new Map<string, number>();
  let exportsAll = false;

  for (const statement of sf.getStatements()) {
    const line = statement.getStartLineNumber();
    if (Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement)) {
      const name = statement.getName();
      if (statement.isExported() && !statement.isDefaultExport() && name) names.set(name, line);
    } else if (Node.isVariableStatement(statement) && statement.isExported()) {
      for (const decl of statement.getDeclarations()) {
        const binding = decl.getNameNode();
        if (Node.isIdentifier(binding)) names.set(binding.getText(), line);
        else if (Node.isObjectBindingPattern(binding)) {
          for (const element of binding.getElements()) names.set(element.getName(), line);
        }
      }
    } else if (Node.isExportDeclaration(statement)) {
      if (statement.isNamespaceExport() && !statement.getNamespaceExport()) exportsAll = true;
      for (const spec of statement.getNamedExports()) {
        names.set(spec.getAliasNode()?.getText() ?? spec.getName(), line);
      }
    }
  }
  return { names, exportsAll };
}

// The line of `export default`, or the first line if there isn't one.
export function defaultExportLine(sf: SourceFile): number {
  for (const statement of sf.getStatements()) {
    if (Node.isExportAssignment(statement) && !statement.isExportEquals()) return statement.getStartLineNumber();
    if (
      (Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement)) &&
      statement.isDefaultExport()
    ) {
      return statement.getStartLineNumber();
    }
  }
  return 1;
}

export function stringLiteral(node: Node | undefined): string | null {
  return node && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    ? node.getLiteralValue()
    : null;
}

// URL path parts joined with single slashes, always starting with one.
export function joinUrlPath(...parts: string[]): string {
  return `/${parts.map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/")}`;
}
