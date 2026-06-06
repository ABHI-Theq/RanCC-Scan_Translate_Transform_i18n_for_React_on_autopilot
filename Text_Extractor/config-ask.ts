import { isCancel, multiselect, select, text, cancel } from "@clack/prompts";
import chalk from "chalk";
import { SUPPORTED_LANGUAGES } from "../constants";
import { DEFAULTIGNORE, type TransLationConfig } from "../types";
import { saveConfig } from "./method";

export type TranslationConfig = {
  sourceLanguage: string;
  targetLanguages: string[];
  provider: "openai";
  localeDir: string;
};

export const SetConfig = async () => {
  console.log(chalk.blue.bold("\n🌍 Translation Config\n"));

  const sourceLanguage = await select({
    message: "Select source language",
    options: Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
      value: code,
      label: name,
    })),
  });

  if (isCancel(sourceLanguage)) {
    cancel("Translation setup cancelled");
    process.exit(0);
  }

  const targetLanguages = await multiselect({
    message: "Select target language(s)",
    options: Object.entries(SUPPORTED_LANGUAGES)
      .filter(([code]) => code !== sourceLanguage)
      .map(([code, name]) => ({
        value: code,
        label: name,
      })),
    required: true,
  });

  if (isCancel(targetLanguages)) {
    cancel("Translation setup cancelled");
    process.exit(0);
  }

  const localeDir = await text({
    message: "Locale directory",
    placeholder: "./locales",
    defaultValue: "./locales",
  });

  if (isCancel(localeDir)) {
    cancel("Translation setup cancelled");
    process.exit(0);
  }

  const provider = await select({
    message: "Select translation provider",
    options: [
      {
        value: "openai",
        label: "OpenAI",
      },
      { value: "google-gemini", label: "Gemini" },
      { value: "claude", label: "Claude" },
      { value: "openrouter", label: "Openrouter" },
      { value: "groq", label: "Groq" },
    ],
  });

  if (isCancel(provider)) {
    cancel("Translation setup cancelled");
    process.exit(0);
  }

  const i18nLib=await select({
    message:"Select Which Library to work with",
    options:[
      {value:"react-i18next",label:"react-i18next"},
            // {value:"next-intl",label:"next-intl"}
    ]
  })
   if (isCancel(i18nLib)) {
    cancel("Translation setup cancelled");
    process.exit(0);
  }

  const config: TransLationConfig = {
    sourceLang: sourceLanguage,
    targetLang: targetLanguages,
    provider: provider,
    localeDir: localeDir,
    ignore: DEFAULTIGNORE,
    i18nLibrary:i18nLib
  };

  try {
    await saveConfig(config);

    console.log(chalk.green("(❁´◡`❁)") + " Configuration Setup Done");
  } catch (err: any) {
    console.log(chalk.red.bold("Error: " + (err.message ?? err)));
    return;
  }

  return;
};
