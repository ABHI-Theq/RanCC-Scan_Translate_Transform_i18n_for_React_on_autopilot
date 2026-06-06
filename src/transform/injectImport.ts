import * as t from "@babel/types";

const SOURCE = "react-i18next";
const SPECIFIER = "useTranslation";

/**
 * Ensures `import { useTranslation } from "react-i18next"` exists in the AST.
 * - If the import declaration is missing, it is added after the last existing import.
 * - If the declaration exists but `useTranslation` is not in the specifiers, it is added.
 * - If already fully present, nothing changes.
 *
 * Returns true if the AST was modified.
 */
export function injectImport(ast: t.File): boolean {
  let existingDecl: t.ImportDeclaration | null = null;

  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node) || node.source.value !== SOURCE) continue;

    const hasSpecifier = node.specifiers.some(
      (s) =>
        t.isImportSpecifier(s) &&
        t.isIdentifier(s.imported) &&
        s.imported.name === SPECIFIER,
    );

    if (hasSpecifier) return false; // already present, nothing to do
    existingDecl = node;
    break;
  }

  if (existingDecl) {
    // add useTranslation to the existing import
    existingDecl.specifiers.push(
      t.importSpecifier(t.identifier(SPECIFIER), t.identifier(SPECIFIER)),
    );
    return true;
  }

  // create a brand new import declaration
  const importDecl = t.importDeclaration(
    [t.importSpecifier(t.identifier(SPECIFIER), t.identifier(SPECIFIER))],
    t.stringLiteral(SOURCE),
  );

  // insert just before the first non-import statement
  const firstNonImport = ast.program.body.findIndex(
    (n) => !t.isImportDeclaration(n),
  );

  if (firstNonImport === -1) {
    ast.program.body.push(importDecl);
  } else {
    ast.program.body.splice(firstNonImport, 0, importDecl);
  }

  return true;
}
