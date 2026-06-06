import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";

/**
 * Replaces a JSXText node with `{t("key")}` if the trimmed text
 * exists in the reverse lookup map.
 *
 * Skips whitespace-only nodes silently.
 * Returns the matched i18n key, or null if no replacement was made.
 */
export function replaceJSXText(
  nodePath: NodePath<t.JSXText>,
  lookup: Map<string, string>,
): string | null {
  const raw = nodePath.node.value;
  const text = raw.trim();
  if (!text) return null;

  const key = lookup.get(text);
  if (!key) return null;

  nodePath.replaceWith(
    t.jsxExpressionContainer(
      t.callExpression(t.identifier("t"), [t.stringLiteral(key)]),
    ),
  );

  return key;
}
