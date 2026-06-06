import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";

/**
 * Injects `const { t } = useTranslation();` at the top of a
 * React component function body if not already present.
 * Returns true if injected.
 */
export function injectHookIntoBody(
  bodyPath: NodePath<t.BlockStatement>,
): boolean {
  const body = bodyPath.node.body;

  // check if hook already present
  const alreadyPresent = body.some((stmt) => {
    if (!t.isVariableDeclaration(stmt)) return false;
    return stmt.declarations.some((decl) => {
      if (!t.isVariableDeclarator(decl)) return false;
      if (!t.isObjectPattern(decl.id)) return false;
      return decl.id.properties.some(
        (p) =>
          t.isObjectProperty(p) &&
          t.isIdentifier(p.key) &&
          p.key.name === "t",
      );
    });
  });

  if (alreadyPresent) return false;

  // const { t } = useTranslation();
  const hookDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      t.objectPattern([
        t.objectProperty(
          t.identifier("t"),
          t.identifier("t"),
          false,
          true, // shorthand
        ),
      ]),
      t.callExpression(t.identifier("useTranslation"), []),
    ),
  ]);

  // insert at top of function body, after any existing variable declarations
  // that are not JSX returns (to keep hooks at top)
  body.unshift(hookDecl);
  return true;
}
