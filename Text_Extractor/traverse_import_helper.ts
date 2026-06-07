import traverseImport from "@babel/traverse";

export const traverse =
  (traverseImport as any).default ??
  traverseImport;