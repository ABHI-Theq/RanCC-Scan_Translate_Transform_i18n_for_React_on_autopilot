import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";
import prettier from "prettier";

import { injectImport } from "./injectImport";
import { injectHookIntoBody } from "./injectHook";
import { replaceJSXText } from "./replaceJSXText";
import { replaceAttribute } from "./replaceAttributes";

export type TransformResult = {
  /** file path */
  file: string;
  /** whether any changes were made */
  changed: boolean;
  /** list of i18n keys that were substituted */
  replacedKeys: string[];
  /** original source code */
  original: string;
  /** transformed source code (same as original if unchanged) */
  output: string;
  /** any non-fatal warnings */
  warnings: string[];
};

/**
 * Parses, transforms, and formats a single source file.
 * Does not write to disk — caller decides based on dry-run flag.
 */
export async function transformFile(
  filePath: string,
  source: string,
  lookup: Map<string, string>,
): Promise<TransformResult> {
  const result: TransformResult = {
    file: filePath,
    changed: false,
    replacedKeys: [],
    original: source,
    output: source,
    warnings: [],
  };

  // ── Parse ────────────────────────────────────────────────────────────────
  let ast: t.File;
  try {
    ast = parser.parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
  } catch (err: any) {
    result.warnings.push(`Parse error: ${err.message}`);
    return result;
  }

  // ── Track which component bodies need the hook ────────────────────────────
  // We collect body paths of components that had at least one replacement,
  // then inject the hook in a second pass to avoid mutating while traversing.
  const componentBodiesNeedingHook = new Set<NodePath<t.BlockStatement>>();
  const replaced = new Set<string>();

  // ── Traverse ─────────────────────────────────────────────────────────────
  traverse(ast, {
    JSXText(path) {
      const key = replaceJSXText(path, lookup);
      if (key) {
        replaced.add(key);
        const bodyPath = findEnclosingComponentBody(path);
        if (bodyPath) componentBodiesNeedingHook.add(bodyPath);
      }
    },

    JSXAttribute(path) {
      const key = replaceAttribute(path, lookup);
      if (key) {
        replaced.add(key);
        const bodyPath = findEnclosingComponentBody(path);
        if (bodyPath) componentBodiesNeedingHook.add(bodyPath);
      }
    },
  });

  if (replaced.size === 0) {
    return result; // nothing to do
  }

  // ── Inject hook into each component that had replacements ─────────────────
  for (const bodyPath of componentBodiesNeedingHook) {
    injectHookIntoBody(bodyPath);
  }

  // ── Inject import at file level ───────────────────────────────────────────
  injectImport(ast);

  // ── Generate ─────────────────────────────────────────────────────────────
  const { code: rawCode } = generate(ast, {
    retainLines: false,
    concise: false,
    jsescOption: { minimal: true },
  }, source);

  // ── Format with Prettier ──────────────────────────────────────────────────
  let formatted = rawCode;
  try {
    const prettierConfig = await prettier.resolveConfig(filePath) ?? {};
    formatted = await prettier.format(rawCode, {
      ...prettierConfig,
      filepath: filePath,
    });
  } catch {
    // prettier failure is non-fatal — use raw generated code
    result.warnings.push("Prettier formatting failed, using raw output");
  }

  result.changed = true;
  result.replacedKeys = [...replaced];
  result.output = formatted;
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Walks up the AST from a given path to find the BlockStatement
 * of the nearest React component (function or arrow function).
 */
function findEnclosingComponentBody(
  nodePath: NodePath,
): NodePath<t.BlockStatement> | null {
  let current: NodePath | null = nodePath.parentPath;

  while (current) {
    // function App() { ... }
    if (
      current.isFunctionDeclaration() &&
      current.node.id &&
      /^[A-Z]/.test(current.node.id.name) &&
      current.get("body").isBlockStatement()
    ) {
      return current.get("body") as NodePath<t.BlockStatement>;
    }

    // const App = () => { ... }  or  const App = function() { ... }
    if (current.isVariableDeclarator()) {
      const id = current.node.id;
      if (
        t.isIdentifier(id) &&
        /^[A-Z]/.test(id.name)
      ) {
        const init = current.node.init;
        if (
          (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) &&
          t.isBlockStatement(init.body)
        ) {
          // get the body path
          const initPath = current.get("init") as NodePath<
            t.ArrowFunctionExpression | t.FunctionExpression
          >;
          return initPath.get("body") as NodePath<t.BlockStatement>;
        }
      }
    }

    current = current.parentPath;
  }

  return null;
}
