import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { createPatch } from "diff";

import { loadConfig, getFilePaths } from "../Text_Extractor/method";
import { buildReverseLookup } from "./reverseLookup";
import { transformFile } from "./transformFile";

const BACKUP_DIR = ".edge-backups";

export interface TransformOptions {
  dryRun: boolean;
  backup: boolean;
}

export async function runTransform(options: TransformOptions): Promise<void> {
  const { dryRun, backup } = options;

  console.log(chalk.cyan("\n┌──────────────────────────────────────┐"));
  console.log(chalk.cyan("│      ⚡  Edge Transform (V2)          │"));
  console.log(chalk.cyan("└──────────────────────────────────────┘"));

  if (dryRun) {
    console.log(chalk.yellow("\n  [dry-run] No files will be written.\n"));
  }

  // 1. load config
  console.log(chalk.gray("  → Loading config..."));
  const config = await loadConfig();
  if (!config) {
    console.log(chalk.red("  ✗ No config found. Run `init` first.\n"));
    return;
  }

  // 2. load source locale (en.json)
  const sourceFile = path.join(config.localeDir, `${config.sourceLang}.json`);
  if (!fs.existsSync(sourceFile)) {
    console.log(chalk.red(`  ✗ Source locale not found: ${sourceFile}`));
    console.log(chalk.yellow("  → Run `scan` first.\n"));
    return;
  }

  let localeData: Record<string, string>;
  try {
    localeData = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
  } catch {
    console.log(chalk.red(`  ✗ Failed to parse ${sourceFile}.\n`));
    return;
  }

  if (Object.keys(localeData).length === 0) {
    console.log(chalk.yellow("  ⚠ Source locale is empty. Nothing to transform.\n"));
    return;
  }

  // 3. build reverse lookup  "Hello" => "hello"
  const lookup = buildReverseLookup(localeData);
  console.log(
    chalk.green(`  ✓ Reverse lookup ready`) +
      chalk.gray(` (${lookup.size} entries)`),
  );

  // 4. discover files
  console.log(chalk.gray("  → Discovering files..."));
  const files = await getFilePaths();
  console.log(chalk.green(`  ✓ Found ${files.length} files to process\n`));

  // 5. create backup dir if needed
  if (backup && !dryRun) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(chalk.gray(`  → Backups will be saved to ${BACKUP_DIR}/\n`));
  }

  // 6. process each file
  let modifiedCount = 0;
  let totalKeys = 0;
  const warnings: string[] = [];

  for (const file of files) {
    let source: string;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch (err: any) {
      warnings.push(`Could not read ${file}: ${err.message}`);
      continue;
    }

    let result;
    try {
      result = await transformFile(file, source, lookup);
    } catch (err: any) {
      warnings.push(`Transform error in ${file}: ${err.message}`);
      console.log(chalk.red(`  ✗ ${file}`) + chalk.gray(` — ${err.message}`));
      continue;
    }

    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        warnings.push(`${file}: ${w}`);
      }
    }

    if (!result.changed) continue;

    modifiedCount++;
    totalKeys += result.replacedKeys.length;

    if (dryRun) {
      // show diff
      console.log(chalk.cyan(`\n  ~ ${file}`) + chalk.gray(` (${result.replacedKeys.length} strings)`));
      const patch = createPatch(file, result.original, result.output, "", "");
      for (const line of patch.split("\n").slice(4)) {
        if (line.startsWith("+")) {
          process.stdout.write(chalk.green(line) + "\n");
        } else if (line.startsWith("-")) {
          process.stdout.write(chalk.red(line) + "\n");
        } else if (line.startsWith("@@")) {
          process.stdout.write(chalk.cyan(line) + "\n");
        } else {
          process.stdout.write(chalk.gray(line) + "\n");
        }
      }
    } else {
      // backup original if requested
      if (backup) {
        const backupPath = path.join(BACKUP_DIR, file.replace(/[/\\]/g, "_"));
        try {
          fs.writeFileSync(backupPath, result.original);
        } catch (err: any) {
          warnings.push(`Failed to write backup for ${file}: ${err.message}`);
        }
      }

      // write transformed file
      try {
        fs.writeFileSync(file, result.output);
        console.log(
          chalk.green(`  ✓ ${file}`) +
            chalk.gray(` (${result.replacedKeys.length} strings transformed)`),
        );
      } catch (err: any) {
        warnings.push(`Failed to write ${file}: ${err.message}`);
        console.log(chalk.red(`  ✗ Failed to write ${file}: ${err.message}`));
      }
    }
  }

  // 7. summary
  console.log(chalk.cyan("\n─────────────────────────────────────────"));
  if (dryRun) {
    console.log(chalk.yellow(`  [dry-run] Files that would be modified: ${modifiedCount}`));
    console.log(chalk.yellow(`  [dry-run] Strings that would be transformed: ${totalKeys}`));
  } else {
    console.log(chalk.green(`  Files modified    : ${modifiedCount}`));
    console.log(chalk.green(`  Strings transformed: ${totalKeys}`));
    if (backup && modifiedCount > 0) {
      console.log(chalk.gray(`  Backups saved to  : ${BACKUP_DIR}/`));
    }
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow(`\n  Warnings (${warnings.length}):`));
    for (const w of warnings) {
      console.log(chalk.yellow(`    ⚠ ${w}`));
    }
  }

  console.log(chalk.cyan("\n✨ Transform complete!\n"));
}
