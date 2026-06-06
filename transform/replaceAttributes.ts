import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";
import { TRANSLATABLE_ATTRIBUTES } from "../constants";

/**
 * Replaces translatable JSX attribute string literals with {t("key")}.
 * e.g. placeholder="Search" => placeholder={t("search")}
 * Returns the key if replaced, null otherwise.
 */
export function replaceAttribute(
  nodePath: NodePath<t.JSXAttribute>,
  lookup: Map<string, string>,
): string | null {
  const attrName = nodePath.node.name.name;
  if (typeof attrName !== "string") return null;
  if (!TRANSLATABLE_ATTRIBUTES.has(attrName)) return null;

  const value = nodePath.node.value;
  if (!value || !t.isStringLiteral(value)) return null;

  const text = value.value.trim();
  if (!text) return null;

  const key = lookup.get(text);
  if (!key) return null;

  // placeholder={t("key")}
  nodePath.node.value = t.jsxExpressionContainer(
    t.callExpression(t.identifier("t"), [t.stringLiteral(key)]),
  );

  return key;
}
