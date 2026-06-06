import chalk from "chalk";
import { createPatch } from "diff";
import type { TransformResult } from "./types";

/**
 * Prints a coloured unified diff for a single transformed file.
 * Called only when --dry-run is active; nothing is written to disk.
 */
export function printDiff(result: TransformResult): void {
  const patch = createPatch(
    result.file,
    result.original,
    result.output,
    "original",
    "transformed",
  );

  console.log(
    chalk.cyan(`\n  ~ ${result.file}`) +
      chalk.gray(` (${result.replacedKeys.length} string(s))`),
  );

  for (const line of patch.split("\n")) {
    // skip the --- / +++ file header lines
    if (line.startsWith("--- ") || line.startsWith("+++ ")) continue;
    if (line.startsWith("+")) {
      process.stdout.write(chalk.green(line) + "\n");
    } else if (line.startsWith("-")) {
      process.stdout.write(chalk.red(line) + "\n");
    } else if (line.startsWith("@@")) {
      process.stdout.write(chalk.cyan(line) + "\n");
    } else if (line.startsWith("Index:") || line.startsWith("=====")) {
      continue; // skip unified diff header
    } else {
      process.stdout.write(chalk.gray(line) + "\n");
    }
  }
}
