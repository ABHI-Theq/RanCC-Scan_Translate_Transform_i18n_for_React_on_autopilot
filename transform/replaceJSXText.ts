import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";

/**
 * Replaces a JSXText node with {t("key")} if its trimmed value
 * exists in the reverse lookup map.
 * Returns the key if replaced, null otherwise.
 */
export function replaceJSXText(
  nodePath: NodePath<t.JSXText>,
  lookup: Map<string, string>,
): string | null {
  const text = nodePath.node.value.trim();
  if (!text) return null;

  const key = lookup.get(text);
  if (!key) return null;

  // {t("key")}
  const expr = t.jsxExpressionContainer(
    t.callExpression(t.identifier("t"), [t.stringLiteral(key)]),
  );

  nodePath.replaceWith(expr);
  return key;
}
