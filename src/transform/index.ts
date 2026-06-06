import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";

import { loadConfig } from "../../Text_Extractor/method";
import { buildReverseLookup } from "./reverseLookup";
import { transformProject } from "./transformProject";
import { BACKUP_DIR } from "./backup";
import type { TransformOptions } from "./types";

// ── runTransform ──────────────────────────────────────────────────────────────

export async function runTransform(options: TransformOptions): Promise<void> {
  const { dryRun, backup } = options;

  console.log(chalk.cyan("\n┌──────────────────────────────────────┐"));
  console.log(chalk.cyan("│      ⚡  Edge Transform (V2)          │"));
  console.log(chalk.cyan("└──────────────────────────────────────┘"));

  if (dryRun) {
    console.log(chalk.yellow("\n  [dry-run] No files will be written.\n"));
  }

  // 1. config
  console.log(chalk.gray("  → Loading config..."));
  const config = await loadConfig();
  if (!config) {
    console.log(chalk.red("  ✗ No config found. Run `init` first.\n"));
    return;
  }
  console.log(chalk.green("  ✓ Loaded config"));

  // guard: only react-i18next is supported
  if (config.i18nLibrary && config.i18nLibrary !== "react-i18next") {
    console.log(
      chalk.red(`  ✗ Unsupported i18n library: "${config.i18nLibrary}".`) +
        chalk.gray(" Only react-i18next is supported.\n"),
    );
    return;
  }

  // 2. load source locale
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

  console.log(chalk.green(`  ✓ Loaded locale map`) + chalk.gray(` (${Object.keys(localeData).length} keys)`));

  // 3. reverse lookup
  const lookup = buildReverseLookup(localeData);

  // 4. transform all project files
  console.log(chalk.gray("  → Discovering files..."));
  const summary = await transformProject(lookup, options);

  // 5. summary
  console.log(chalk.cyan("\n─────────────────────────────────────────"));
  if (dryRun) {
    console.log(chalk.yellow(`  [dry-run] Files that would be modified : ${summary.modifiedFiles}`));
    console.log(chalk.yellow(`  [dry-run] Strings that would be transformed: ${summary.totalStrings}`));
  } else {
    console.log(chalk.green(`  Files modified     : ${summary.modifiedFiles}`));
    console.log(chalk.green(`  Strings transformed: ${summary.totalStrings}`));
    if (backup && summary.modifiedFiles > 0) {
      console.log(chalk.gray(`  Backups saved to   : ${BACKUP_DIR}/`));
    }
  }

  if (summary.warnings.length > 0) {
    console.log(chalk.yellow(`\n  Warnings (${summary.warnings.length}):`));
    for (const w of summary.warnings) {
      console.log(chalk.yellow(`    ⚠ ${w}`));
    }
  }

  console.log(chalk.cyan("\n✨ Transform complete!\n"));
}

// ── runSetup ──────────────────────────────────────────────────────────────────

const ENTRY_CANDIDATES = [
  "src/main.tsx",
  "src/main.jsx",
  "src/index.tsx",
  "src/index.jsx",
];

const I18N_FILE = "src/i18n.ts";
const I18N_IMPORT = 'import "./i18n";';

export async function runSetup(): Promise<void> {
  console.log(chalk.cyan("\n┌──────────────────────────────────────┐"));
  console.log(chalk.cyan("│      🔧  Edge Setup (react-i18next)   │"));
  console.log(chalk.cyan("└──────────────────────────────────────┘\n"));

  // 1. load config
  console.log(chalk.gray("  → Loading config..."));
  const config = await loadConfig();
  if (!config) {
    console.log(chalk.red("  ✗ No config found. Run `init` first.\n"));
    return;
  }
  console.log(chalk.green("  ✓ Config loaded"));

  // 2. detect entry file
  const entryFile = ENTRY_CANDIDATES.find((f) => fs.existsSync(f));
  if (!entryFile) {
    console.log(
      chalk.red("  ✗ Could not find a React entry file.") +
        chalk.gray(` Checked: ${ENTRY_CANDIDATES.join(", ")}\n`),
    );
    return;
  }
  console.log(chalk.green(`  ✓ Detected entry file: ${entryFile}`));

  // 3. generate i18n.ts
  if (fs.existsSync(I18N_FILE)) {
    console.log(chalk.gray(`  → ${I18N_FILE} already exists, skipping generation.`));
  } else {
    const i18nContent = generateI18nConfig(config.sourceLang, config.targetLang, config.localeDir);
    fs.mkdirSync(path.dirname(I18N_FILE), { recursive: true });
    fs.writeFileSync(I18N_FILE, i18nContent, "utf8");
    console.log(chalk.green(`  ✓ Generated ${I18N_FILE}`));
  }

  // 4. inject import into entry file
  const entryContent = fs.readFileSync(entryFile, "utf8");
  if (entryContent.includes(I18N_IMPORT) || entryContent.includes('import "./i18n"') || entryContent.includes("import './i18n'")) {
    console.log(chalk.gray(`  → i18n import already present in ${entryFile}, skipping.`));
  } else {
    // inject after the last import line
    const lines = entryContent.split("\n");
    const lastImportIdx = lines.reduce(
      (last, line, i) => (line.trimStart().startsWith("import ") ? i : last),
      -1,
    );
    const insertAt = lastImportIdx === -1 ? 0 : lastImportIdx + 1;
    lines.splice(insertAt, 0, I18N_IMPORT);
    fs.writeFileSync(entryFile, lines.join("\n"), "utf8");
    console.log(chalk.green(`  ✓ Injected ${I18N_IMPORT} into ${entryFile}`));
  }

  console.log(chalk.cyan("\n✨ Setup complete!\n"));

  console.log(chalk.bold("  Install required packages in your React project:\n"));
  console.log(
    chalk.white("    npm  ") + chalk.cyan("npm install i18next react-i18next"),
  );
  console.log(
    chalk.white("    yarn ") + chalk.cyan("yarn add i18next react-i18next"),
  );
  console.log(
    chalk.white("    pnpm ") + chalk.cyan("pnpm add i18next react-i18next"),
  );
  console.log(
    chalk.white("    bun  ") + chalk.cyan("bun add i18next react-i18next"),
  );

  console.log(chalk.bold("\n  Then run:\n"));
  console.log(chalk.cyan("    Edge transform") + chalk.gray("            — convert hardcoded strings"));
  console.log(chalk.cyan("    Edge transform --dry-run") + chalk.gray("  — preview changes first"));
  console.log();
}

// ── helpers ───────────────────────────────────────────────────────────────────

function generateI18nConfig(
  sourceLang: string,
  targetLangs: string[],
  localeDir: string,
): string {
  const allLangs = [sourceLang, ...targetLangs.filter((l) => l !== sourceLang)];

  // compute relative path from src/ to localeDir
  const relativeLocaleDir = path
    .relative("src", localeDir)
    .replace(/\\/g, "/");

  const imports = allLangs
    .map((lang) => `import ${lang} from "${relativeLocaleDir}/${lang}.json";`)
    .join("\n");

  const resources = allLangs
    .map((lang) => `    ${lang}: { translation: ${lang} },`)
    .join("\n");

  return `import i18n from "i18next";
import { initReactI18next } from "react-i18next";

${imports}

i18n.use(initReactI18next).init({
  resources: {
${resources}
  },
  lng: localStorage.getItem("lang") ?? "${sourceLang}",
  fallbackLng: "${sourceLang}",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
`;
}
