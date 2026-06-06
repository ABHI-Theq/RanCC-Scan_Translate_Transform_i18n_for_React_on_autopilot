import * as t from "@babel/types";

const REACT_I18NEXT = "react-i18next";
const USE_TRANSLATION = "useTranslation";

/**
 * Injects `import { useTranslation } from "react-i18next";`
 * at the top of the file if not already present.
 * Returns true if the import was added.
 */
export function injectImport(ast: t.File): boolean {
  // check if import already exists
  for (const node of ast.program.body) {
    if (
      t.isImportDeclaration(node) &&
      node.source.value === REACT_I18NEXT &&
      node.specifiers.some(
        (s) =>
          t.isImportSpecifier(s) &&
          t.isIdentifier(s.imported) &&
          s.imported.name === USE_TRANSLATION,
      )
    ) {
      return false; // already present
    }
  }

  const importDecl = t.importDeclaration(
    [
      t.importSpecifier(
        t.identifier(USE_TRANSLATION),
        t.identifier(USE_TRANSLATION),
      ),
    ],
    t.stringLiteral(REACT_I18NEXT),
  );

  // insert before first non-import statement, or at top
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
