import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";

/**
 * Injects `const { t } = useTranslation();` at the very top of a React
 * component's BlockStatement body, unless the hook is already declared.
 *
 * Returns true if the AST was modified.
 */
export function injectHookIntoBody(
  bodyPath: NodePath<t.BlockStatement>,
): boolean {
  if (hasHookDeclaration(bodyPath.node)) return false;

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

  bodyPath.node.body.unshift(hookDecl);
  return true;
}

/** Returns true if `const { t } = useTranslation()` already exists in body. */
function hasHookDeclaration(block: t.BlockStatement): boolean {
  return block.body.some((stmt) => {
    if (!t.isVariableDeclaration(stmt)) return false;
    return stmt.declarations.some(
      (decl) =>
        t.isVariableDeclarator(decl) &&
        t.isObjectPattern(decl.id) &&
        decl.id.properties.some(
          (p) =>
            t.isObjectProperty(p) &&
            t.isIdentifier(p.key) &&
            p.key.name === "t",
        ),
    );
  });
}
