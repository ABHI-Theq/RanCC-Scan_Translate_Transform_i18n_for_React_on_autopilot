import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";

import {
  TRANSLATABLE_HTML_ATTRIBUTES,
  TRANSLATABLE_COMPONENT_PROPS,
} from "../../constants";

/**
 * Replaces translatable JSX attribute string literals with {t("key")}
 *
 * Examples:
 *   placeholder="Search"
 *     => placeholder={t("search")}
 *
 *   label="Save"
 *     => label={t("save")}
 */
export function replaceAttribute(
  nodePath: NodePath<t.JSXAttribute>,
  lookup: Map<string, string>,
): string | null {
  const attrName = nodePath.node.name.name;

  if (typeof attrName !== "string") {
    return null;
  }

  const isHtmlAttribute =
    TRANSLATABLE_HTML_ATTRIBUTES.has(attrName);

  const isComponentProp =
    TRANSLATABLE_COMPONENT_PROPS.has(attrName);

  if (!isHtmlAttribute && !isComponentProp) {
    return null;
  }

  const value = nodePath.node.value;

  if (!value || !t.isStringLiteral(value)) {
    return null;
  }

  const text = value.value.trim();

  if (!text) {
    return null;
  }

  const key = lookup.get(text);

  if (!key) {
    return null;
  }

  nodePath.node.value = t.jsxExpressionContainer(
    t.callExpression(
      t.identifier("t"),
      [t.stringLiteral(key)],
    ),
  );

  return key;
}