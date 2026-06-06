import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";
import { TRANSLATABLE_ATTRIBUTES } from "../../constants";

/**
 * Replaces a translatable JSX attribute's string-literal value with `{t("key")}`.
 *
 * Only acts on attributes in TRANSLATABLE_ATTRIBUTES (placeholder, alt, title, …).
 * Skips expression containers, template literals, and anything non-static.
 *
 * Returns the matched i18n key, or null if no replacement was made.
 */
export function replaceAttribute(
  nodePath: NodePath<t.JSXAttribute>,
  lookup: Map<string, string>,
): string | null {
  const nameNode = nodePath.node.name;
  const attrName =
    t.isJSXIdentifier(nameNode) ? nameNode.name :
    t.isJSXNamespacedName(nameNode) ? `${nameNode.namespace.name}:${nameNode.name.name}` :
    null;

  if (!attrName) return null;
  if (!TRANSLATABLE_ATTRIBUTES.has(attrName)) return null;

  const value = nodePath.node.value;

  // only transform plain string literals — ignore {expr}, template literals, etc.
  if (!value || !t.isStringLiteral(value)) return null;

  const text = value.value.trim();
  if (!text) return null;

  const key = lookup.get(text);
  if (!key) return null;

  nodePath.node.value = t.jsxExpressionContainer(
    t.callExpression(t.identifier("t"), [t.stringLiteral(key)]),
  );

  return key;
}
