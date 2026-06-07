#! /usr/bin/env node
import dotenv  from "dotenv"

dotenv.config()
import chalk from "chalk";
import { Command } from "commander";
import { SetConfig } from "./Text_Extractor/config-ask";
import { runScan, runTranslate, runModifyTargetLangs, runCheck, runClean, runStats } from "./Text_Extractor/method";
import { runTransform, runSetup } from "./src/transform/index";

const program = new Command();

program
  .name("RanCC")
  .description("Tool to automatically add translation across your project")
  .version("1.0.0");

program
  .command("init")
  .description("This command setups up the configuration for translation")
  .action(async () => {
    try {
      await SetConfig();
    } catch (error: any) {
      if (error instanceof Error && error.message.includes("cancelled")) {
        console.log(chalk.yellow("\n✓ Exited cleanly\n"));
      } else {
        console.log(chalk.red("Authentication failed"));
        console.log(
          chalk.red(error instanceof Error ? error.message : String(error)),
        );
      }
      process.exit(0);
    }
  });

//get and creat a locale json file of source lan
program
  .command("scan")
  .description("Extract UI strings from your React project")
  .option("--ai", "Use LLM to filter out non-UI strings (uses scanProvider from config)")
  .option("--review", "Interactively approve/reject each extracted string before saving")
  .action(async (opts) => {
    try {
      await runScan({ ai: opts.ai ?? false, review: opts.review ?? false });
    } catch (error) {
      if (error instanceof Error && error.message.includes("cancelled")) {
        console.log(chalk.yellow("\n✓ Exited cleanly\n"));
      } else {
        console.log(chalk.red("✗ Scan failed"));
        console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      }
      process.exit(0);
    }
  });

program.command("translate")
.description("using this command we will generate the translation of texts into all target translation langguages")
.action(async () => {
  try {
    await runTranslate();
  } catch (error) {
    console.log(chalk.red("✗ Translation failed"));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(0);
  }
})

program.command("modify-langs")
  .description("Add or remove target languages from your config")
  .action(async () => {
    try {
      await runModifyTargetLangs();
    } catch (error) {
      console.log(chalk.red("✗ Failed to modify languages"));
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(0);
    }
  });

program.command("check")
  .description("Show untranslated keys for each target language")
  .action(async () => {
    try {
      await runCheck();
    } catch (error) {
      console.log(chalk.red("✗ Check failed"));
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(0);
    }
  });

program.command("clean")
  .description("Remove stale keys from target locale files that no longer exist in source")
  .action(async () => {
    try {
      await runClean();
    } catch (error) {
      console.log(chalk.red("✗ Clean failed"));
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(0);
    }
  });

program.command("stats")
  .description("Show translation statistics across all locale files")
  .option("-v, --verbose", "Show detailed breakdown including file types, duplicate strings, missing keys, and last scan time")
  .action(async (opts) => {
    try {
      await runStats(opts.verbose ?? false);
    } catch (error) {
      console.log(chalk.red("✗ Stats failed"));
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(0);
    }
  });

program.command("setup")
  .description("Generate i18n.ts config and inject import into React entry file")
  .action(async () => {
    try {
      await runSetup();
    } catch (error) {
      console.log(chalk.red("✗ Setup failed"));
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(0);
    }
  });

program.command("transform")
  .description("Transform hardcoded JSX text into react-i18next t() calls (V2)")
  .option("-d, --dry-run", "Preview changes without writing files")
  .option("-b, --backup", "Save originals to .edge-backups/ before modifying")
  .action(async (opts) => {
    try {
      await runTransform({
        dryRun: opts.dryRun ?? false,
        backup: opts.backup ?? false,
      });
    } catch (error) {
      console.log(chalk.red("✗ Transform failed"));
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(0);
    }
  });

await program.parseAsync(process.argv);
