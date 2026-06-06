import * as babelParser from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import type { NodePath } from "@babel/traverse";
import prettier from "prettier";

import { injectImport } from "./injectImport";
import { injectHookIntoBody } from "./injectHook";
import { replaceJSXText } from "./replaceJSXText";
import { replaceAttribute } from "./replaceAttributes";
import type { TransformResult } from "./types";

/**
 * Parses, transforms, and formats a single source file.
 * Pure function — does NOT read from or write to disk.
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

  // ── 1. Parse ─────────────────────────────────────────────────────────────
  let ast: t.File;
  try {
    ast = babelParser.parse(source, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      strictMode: false,
    });
  } catch (err: any) {
    result.warnings.push(`Parse error: ${err.message}`);
    return result;
  }

  // ── 2. Traverse & replace ─────────────────────────────────────────────────
  // Collect component bodies that need the hook injected after traversal
  // to avoid modifying the tree while we're still walking it.
  const bodiesNeedingHook = new Set<NodePath<t.BlockStatement>>();
  const replacedKeys = new Set<string>();

  traverse(ast, {
    JSXText(path) {
      const key = replaceJSXText(path, lookup);
      if (!key) return;
      replacedKeys.add(key);
      const body = findEnclosingComponentBody(path);
      if (body) {
        bodiesNeedingHook.add(body);
      } else {
        result.warnings.push(
          `Could not find enclosing React component for JSXText "${key}" — hook not injected`,
        );
      }
    },

    JSXAttribute(path) {
      const key = replaceAttribute(path, lookup);
      if (!key) return;
      replacedKeys.add(key);
      const body = findEnclosingComponentBody(path);
      if (body) {
        bodiesNeedingHook.add(body);
      } else {
        result.warnings.push(
          `Could not find enclosing React component for attribute key "${key}" — hook not injected`,
        );
      }
    },
  });

  if (replacedKeys.size === 0) return result; // nothing changed

  // ── 3. Inject hook into affected component bodies ─────────────────────────
  for (const body of bodiesNeedingHook) {
    injectHookIntoBody(body);
  }

  // ── 4. Inject import at file level ────────────────────────────────────────
  injectImport(ast);

  // ── 5. Generate code ──────────────────────────────────────────────────────
  const { code: rawCode } = generate(
    ast,
    { retainLines: false, concise: false, jsescOption: { minimal: true } },
    source,
  );

  // ── 6. Format with Prettier ───────────────────────────────────────────────
  let formatted = rawCode;
  try {
    const config = (await prettier.resolveConfig(filePath)) ?? {};
    formatted = await prettier.format(rawCode, {
      ...config,
      filepath: filePath,
    });
  } catch {
    result.warnings.push("Prettier formatting failed — using raw Babel output");
  }

  result.changed = true;
  result.replacedKeys = [...replacedKeys];
  result.output = formatted;
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Walks up the path tree to find the BlockStatement body of the nearest
 * React component. Supports:
 *   function App() { ... }
 *   const App = () => { ... }
 *   const App = function() { ... }
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
      isComponentName(current.node.id.name)
    ) {
      const body = current.get("body");
      if ((body as NodePath).isBlockStatement()) {
        return body as NodePath<t.BlockStatement>;
      }
    }

    // const App = () => { ... }  or  const App = function() { ... }
    if (current.isVariableDeclarator()) {
      const { id, init } = current.node;
      if (
        t.isIdentifier(id) &&
        isComponentName(id.name) &&
        (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) &&
        t.isBlockStatement(init.body)
      ) {
        const initPath = current.get("init") as NodePath<
          t.ArrowFunctionExpression | t.FunctionExpression
        >;
        return initPath.get("body") as NodePath<t.BlockStatement>;
      }
    }

    current = current.parentPath;
  }

  return null;
}

function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}
