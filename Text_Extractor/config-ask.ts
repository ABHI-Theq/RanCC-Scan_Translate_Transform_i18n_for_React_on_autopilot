import { isCancel, multiselect, select, text, cancel } from "@clack/prompts";
import chalk from "chalk";
import { SUPPORTED_LANGUAGES } from "../constants";
import { DEFAULTIGNORE, type TransLationConfig } from "../types";
import { saveConfig } from "./method";

const PROVIDER_OPTIONS = [
  {
    value: "openai",
    label: "OpenAI         (OPENAI_API_KEY)",
    hint: "sk-...  →  platform.openai.com/api-keys",
  },
  {
    value: "google-gemini",
    label: "Google Gemini  (GOOGLE_API_KEY)",
    hint: "AIzaSy...  →  aistudio.google.com/apikey",
  },
  {
    value: "claude",
    label: "Anthropic      (ANTHROPIC_API_KEY)",
    hint: "sk-ant-...  →  console.anthropic.com/settings/keys",
  },
  {
    value: "openrouter",
    label: "OpenRouter     (OPENROUTER_API_KEY)",
    hint: "sk-or-...  →  openrouter.ai/keys",
  },
  {
    value: "groq",
    label: "Groq           (GROQ_API_KEY)",
    hint: "gsk_...  →  console.groq.com/keys",
  },
];

export const SetConfig = async () => {
  console.log(chalk.blue.bold("\n🌍 RanCC — i18n Config Setup\n"));

  // ── source language ────────────────────────────────────────────────────────
  const sourceLanguage = await select({
    message: "Select source language",
    options: Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
      value: code,
      label: name,
    })),
  });
  if (isCancel(sourceLanguage)) { cancel("Cancelled"); process.exit(0); }

  // ── target languages ───────────────────────────────────────────────────────
  const targetLanguages = await multiselect({
    message: "Select target language(s)",
    options: Object.entries(SUPPORTED_LANGUAGES)
      .filter(([code]) => code !== sourceLanguage)
      .map(([code, name]) => ({ value: code, label: name })),
    required: true,
  });
  if (isCancel(targetLanguages)) { cancel("Cancelled"); process.exit(0); }

  // ── locale directory ───────────────────────────────────────────────────────
  const localeDir = await text({
    message: "Locale directory",
    placeholder: "./locales",
    defaultValue: "./locales",
  });
  if (isCancel(localeDir)) { cancel("Cancelled"); process.exit(0); }

  // ── i18n library ───────────────────────────────────────────────────────────
  const i18nLib = await select({
    message: "Select i18n library",
    options: [
      { value: "react-i18next", label: "react-i18next" },
    ],
  });
  if (isCancel(i18nLib)) { cancel("Cancelled"); process.exit(0); }

  // ── translate provider ─────────────────────────────────────────────────────
  console.log(chalk.gray("\n  ─ Translation provider (used by `rancc translate`) ─"));
  const translateProvider = await select({
    message: "Select AI provider for translation",
    options: PROVIDER_OPTIONS,
  });
  if (isCancel(translateProvider)) { cancel("Cancelled"); process.exit(0); }

  // show key format hint for selected translate provider
  const translateHint = PROVIDER_OPTIONS.find((p) => p.value === translateProvider)?.hint;
  if (translateHint) {
    console.log(chalk.gray(`    Get your API key → ${translateHint.split("→")[1]?.trim()}`));
    console.log(chalk.gray(`    Key format: ${translateHint.split("→")[0]?.trim()}`));
  }

  // ── scan provider ──────────────────────────────────────────────────────────
  console.log(chalk.gray("\n  ─ Scan provider (used by `rancc scan --ai`) ─"));
  console.log(chalk.gray("    Tip: Groq is free and fast for this task\n"));
  const scanProvider = await select({
    message: "Select AI provider for scan filtering",
    options: [
      { value: "same", label: `Same as translation provider (${translateProvider})`, hint: "" },
      ...PROVIDER_OPTIONS,
    ],
  });
  if (isCancel(scanProvider)) { cancel("Cancelled"); process.exit(0); }

  // show key format hint for selected scan provider
  if (scanProvider !== "same") {
    const scanHint = PROVIDER_OPTIONS.find((p) => p.value === scanProvider)?.hint;
    if (scanHint) {
      console.log(chalk.gray(`    Get your API key → ${scanHint.split("→")[1]?.trim()}`));
      console.log(chalk.gray(`    Key format: ${scanHint.split("→")[0]?.trim()}`));
    }
  }

  const resolvedScanProvider =
    scanProvider === "same" ? (translateProvider as string) : (scanProvider as string);

  const config: TransLationConfig = {
    sourceLang: sourceLanguage as string,
    targetLang: targetLanguages as string[],
    provider: translateProvider as string,
    scanProvider: resolvedScanProvider,
    localeDir: localeDir as string,
    ignore: DEFAULTIGNORE,
    i18nLibrary: i18nLib as string,
  };

  try {
    await saveConfig(config);
    console.log(chalk.green("\n(❁´◡`❁) Configuration setup done!\n"));
    console.log(chalk.gray("  Translate provider : ") + chalk.cyan(config.provider));
    console.log(chalk.gray("  Scan provider      : ") + chalk.cyan(config.scanProvider));
    console.log(chalk.gray("  Locale dir         : ") + chalk.cyan(config.localeDir));
    console.log(chalk.gray("  Source language    : ") + chalk.cyan(config.sourceLang));
    console.log(chalk.gray("  Target languages   : ") + chalk.cyan(config.targetLang.join(", ")));
    console.log();
  } catch (err: any) {
    console.log(chalk.red.bold("Error: " + (err.message ?? err)));
    return;
  }
};
