import fs from "node:fs";
import chalk from "chalk";

import { getFilePaths } from "../../Text_Extractor/method";
import { transformFile } from "./transformFile";
import { printDiff } from "./dryRun";
import { ensureBackupDir, backupFile } from "./backup";
import type { TransformOptions, ProjectTransformSummary } from "./types";

/**
 * Discovers all project files and runs the transform pipeline on each.
 * Handles dry-run, backup, writing, and per-file logging.
 */
export async function transformProject(
  lookup: Map<string, string>,
  options: TransformOptions,
): Promise<ProjectTransformSummary> {
  const { dryRun, backup } = options;
  const summary: ProjectTransformSummary = {
    modifiedFiles: 0,
    totalStrings: 0,
    warnings: [],
  };

  // prepare backup dir once upfront
  if (backup && !dryRun) {
    ensureBackupDir();
  }

  const files = await getFilePaths();
  console.log(chalk.green(`  ✓ Found ${files.length} files`));
  console.log();

  for (const file of files) {
    // read
    let source: string;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch (err: any) {
      summary.warnings.push(`Cannot read ${file}: ${err.message}`);
      continue;
    }

    // transform
    let result;
    try {
      result = await transformFile(file, source, lookup);
    } catch (err: any) {
      summary.warnings.push(`Transform error in ${file}: ${err.message}`);
      console.log(chalk.red(`  ✗ ${file}`) + chalk.gray(` — ${err.message}`));
      continue;
    }

    // surface non-fatal warnings
    for (const w of result.warnings) {
      summary.warnings.push(`${file}: ${w}`);
    }

    if (!result.changed) continue;

    summary.modifiedFiles++;
    summary.totalStrings += result.replacedKeys.length;

    if (dryRun) {
      printDiff(result);
      continue;
    }

    // backup original before overwriting
    if (backup) {
      try {
        backupFile(file, result.original);
      } catch (err: any) {
        summary.warnings.push(`Backup failed for ${file}: ${err.message}`);
      }
    }

    // write transformed output
    try {
      fs.writeFileSync(file, result.output, "utf8");
      console.log(
        chalk.green(`  ✓ ${file}`) +
          chalk.gray(` (${result.replacedKeys.length} strings)`),
      );
    } catch (err: any) {
      summary.warnings.push(`Write failed for ${file}: ${err.message}`);
      console.log(chalk.red(`  ✗ ${file}: ${err.message}`));
    }
  }

  return summary;
}
