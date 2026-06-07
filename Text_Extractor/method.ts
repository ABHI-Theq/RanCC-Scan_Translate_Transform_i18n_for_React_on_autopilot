import fg from "fast-glob";
import fs from "node:fs";
import path from "node:path";
import parser from "@babel/parser";
import { SUPPORTED_LANGUAGES, TRANSLATABLE_COMPONENT_PROPS, TRANSLATABLE_DATA_KEYS, TRANSLATABLE_FUNCTIONS, TRANSLATABLE_HTML_ATTRIBUTES } from "../constants";
import type { TransLationConfig } from "../types";
import chalk from "chalk";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import {traverse} from "./traverse_import_helper"
import { addText, type TranslationEntry } from "./extractor";
import dotenv from "dotenv";

function getModel(provider: string) {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })("gpt-4o-mini");
    case "google-gemini":
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY })("gemini-3.1-flash-lite-preview");
    case "claude":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })("claude-3-5-haiku-latest");
    case "groq":
      return createGroq({ apiKey: process.env.GROQ_API_KEY })("llama-3.3-70b-versatile");
    case "openrouter":
      return createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
      })("openai/gpt-4o-mini");
    default:
      throw new Error(`Unsupported provider: "${provider}"`);
  }
}

export async function getFilePaths() {
  return await fg(["**/*.{js,jsx,ts,tsx}"], {
    ignore: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      // exclude the CLI's own source so transform doesn't rewrite itself
  "**/*.config.js",
  "**/*.config.ts",
  "**/eslint.config.js",
    ],
    cwd: process.cwd(),
  });
}

export async function loadConfig(){

  try{
    if(fs.existsSync("auto-i18n-config.json")){
      const raw=fs.readFileSync("auto-i18n-config.json","utf8")
      return JSON.parse(raw) as TransLationConfig
    }else{
      return null
    }

  }catch(err){
    console.log(chalk.red("Err: "+err))
    return null;
  }
}
export async function folderExists(folder_name: string){

  if(fs.existsSync(folder_name)) return;
  
  fs.mkdirSync(folder_name,{recursive:true})

  return
}
export async function saveConfig(config: TransLationConfig) {
  try {
    fs.writeFileSync(
      "auto-i18n-config.json",
      JSON.stringify(config, null, 2),
      "utf-8",
    );
    console.log(chalk.green("✓ Configuration created"));
  } catch (err: any) {
    console.log(chalk.red("Error: " + (err.message ?? err)));
    return;
  }
}


export async function scanFiles() {
  const files = await getFilePaths();

  const texts = new Map<string, TranslationEntry>();

  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");

    let ast;

    try {
      ast = parser.parse(code, {
        sourceType: "unambiguous",
        plugins: [
          "jsx",
          "typescript",
          "classProperties",
          "decorators-legacy",
        ],
      });
    } catch (err) {
      console.warn(`Failed parsing ${file}`);
      continue;
    }

    console.log(`Scanning ${file}`);

    traverse(ast, {
      // <h1>Hello World</h1>
      JSXText(path: any) {
        addText(
          texts,
          path.node.value,
          file,
          path.node.loc?.start.line ?? 0
        );
      },

      // placeholder="Search" | alt="Logo" | title="..." | aria-label="..."
      JSXAttribute(path: any) {
        const attrName = path.node.name?.name;

        if (typeof attrName !== "string") return;

        const isHtmlAttr = TRANSLATABLE_HTML_ATTRIBUTES.has(attrName);
        const isComponentProp = TRANSLATABLE_COMPONENT_PROPS.has(attrName);

        if (!isHtmlAttr && !isComponentProp) return;

        const value = path.node.value;
        if (!value) return;

        // plain string: placeholder="Search"
        if (value.type === "StringLiteral") {
          addText(texts, value.value, file, value.loc?.start.line ?? 0);
        }

        // expression string: placeholder={"Search"}
        if (
          value.type === "JSXExpressionContainer" &&
          value.expression?.type === "StringLiteral"
        ) {
          addText(texts, value.expression.value, file, value.expression.loc?.start.line ?? 0);
        }
      },

      // alert("message") | toast.error("...") | enqueueSnackbar("...")
      CallExpression(path: any) {
        const callee = path.node.callee;
        let functionName: string | undefined;

        if (callee.type === "Identifier") {
          functionName = callee.name;
        } else if (
          callee.type === "MemberExpression" &&
          callee.property?.type === "Identifier"
        ) {
          functionName = callee.property.name;
        }

        if (!functionName || !TRANSLATABLE_FUNCTIONS.has(functionName)) return;

        const firstArg = path.node.arguments?.[0];
        if (firstArg?.type === "StringLiteral") {
          addText(texts, firstArg.value, file, firstArg.loc?.start.line ?? 0);
        }
      },

      // Data array patterns:
      // const items = [{ name: "OpenRouter", usedFor: "...", badge: "Free Tier" }]
      // Only extracts values from keys listed in TRANSLATABLE_DATA_KEYS
      ObjectProperty(path: any) {
        const keyNode = path.node.key;
        const valueNode = path.node.value;

        // get key name — handles both { name: "x" } and { "name": "x" }
        const keyName =
          keyNode?.type === "Identifier" ? keyNode.name :
          keyNode?.type === "StringLiteral" ? keyNode.value :
          null;

        if (!keyName) return;
        if (!TRANSLATABLE_DATA_KEYS.has(keyName)) return;
        if (valueNode?.type !== "StringLiteral") return;

        addText(texts, valueNode.value, file, valueNode.loc?.start.line ?? 0);
      },
    });
  }

  console.log(
    `\n✓ Extracted ${texts.size} unique strings\n`
  );

  // return the full entries map so callers have file+line context
  return texts;
}

// ── helpers ───────────────────────────────────────────────────────────────────

/** Converts the internal Map to the flat locale JSON format. */
function entriesToLocale(entries: Map<string, TranslationEntry>): Record<string, string> {
  return Object.fromEntries([...entries.entries()].map(([k, v]) => [k, v.value]));
}

// ── LLM filter ────────────────────────────────────────────────────────────────

/**
 * Returns true if the API key env var for the given provider is set and non-empty.
 */
function hasApiKey(provider: string): boolean {
  switch (provider) {
    case "openai":        return !!process.env.OPENAI_API_KEY;
    case "google-gemini": return !!process.env.GOOGLE_API_KEY;
    case "claude":        return !!process.env.ANTHROPIC_API_KEY;
    case "groq":          return !!process.env.GROQ_API_KEY;
    case "openrouter":    return !!process.env.OPENROUTER_API_KEY;
    default:              return false;
  }
}

/**
 * Sends candidate strings to the LLM in batches and asks it to filter down
 * to only strings that are visible UI text a user would read.
 * Passes file path + line number as context so the LLM can make better decisions.
 * Uses config.scanProvider (falls back to config.provider).
 * If no API key is set, returns candidates unchanged.
 */
export async function llmFilterStrings(
  candidates: Map<string, TranslationEntry>,
  config: TransLationConfig,
): Promise<Map<string, TranslationEntry>> {
  const provider = config.scanProvider || config.provider;

  if (!hasApiKey(provider)) {
    console.log(
      chalk.yellow(`  ⚠ No API key found for scan provider "${provider}" — skipping LLM filter.`) +
        chalk.gray(" Add the key to .env to enable AI filtering."),
    );
    return candidates;
  }

  const model = getModel(provider);
  const BATCH = 80;
  const MAX_RETRIES = 2;
  const allEntries = [...candidates.entries()];
  const confirmed = new Map<string, TranslationEntry>();

  console.log(chalk.gray(`  → Running LLM filter on ${allEntries.length} candidates via ${provider}...`));

  for (let i = 0; i < allEntries.length; i += BATCH) {
    const slice = allEntries.slice(i, i + BATCH);

    // send rich context to the LLM: { value, file, line }
    const batchPayload: Record<string, { value: string; file: string; line: number }> = {};
    for (const [key, entry] of slice) {
      batchPayload[key] = { value: entry.value, file: entry.file, line: entry.line };
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { text } = await generateText({
          model,
          prompt: `You are helping with React app internationalization.

Below is a JSON object of candidate strings extracted from a React codebase.
Each entry includes the string value, the source file it came from, and the line number.
Use the file name and line number as context clues — strings in component files on JSX-heavy lines are more likely to be UI text.

Your job: return ONLY the keys whose strings are visible UI text that an end user would actually read in the browser.

REJECT:
- CSS class names or Tailwind utility strings (e.g. "flex items-center gap-2")
- CSS values (e.g. "radial-gradient(...)", "0.5s ease", "blur(60px)")
- SVG path data (e.g. "M 50,50 L 15,20")
- Technical IDs, model slugs, API identifiers (e.g. "gpt-4o-mini", "openrouter/free")
- Cron expressions (e.g. "0 9 * * *")
- Shell/code commands (e.g. "npm install", "git clone ...")
- Config values, env vars
- Template placeholders with no surrounding words (e.g. "{value}px")
- Color codes, hex, rgba
- Single letters or numbers only

KEEP:
- Headings, labels, descriptions, badge text
- Button labels, nav items, error/success messages
- Any text a real user reads in the UI

Return ONLY a valid JSON array of the keys to KEEP.
No explanation. No markdown. Just a JSON array of strings.

Candidates:
${JSON.stringify(batchPayload, null, 2)}`,
        });

        const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim();
        const keysToKeep = JSON.parse(cleaned) as string[];

        if (!Array.isArray(keysToKeep)) throw new Error("Expected JSON array");

        for (const key of keysToKeep) {
          const entry = candidates.get(key);
          if (entry) confirmed.set(key, entry);
        }
        break;
      } catch (err: any) {
        if (attempt === MAX_RETRIES) {
          console.log(chalk.yellow(`\n    ⚠ LLM filter batch failed, keeping all. (${err.message})`));
          for (const [key, entry] of slice) confirmed.set(key, entry);
        } else {
          await new Promise((r) => setTimeout(r, attempt * 600));
        }
      }
    }

    const done = Math.min(i + BATCH, allEntries.length);
    const pct = Math.round((done / allEntries.length) * 100);
    const filled = Math.floor(pct / 5);
    const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(20 - filled));
    process.stdout.write(`\r    [${bar}] ${chalk.yellow(`${pct}%`)} ${chalk.gray(`(${done}/${allEntries.length})`)}`);
  }

  process.stdout.write("\n");
  return confirmed;
}

/**
 * Interactively presents each string to the developer for approval.
 * Y = keep, N = discard. Ctrl+C saves progress so far.
 */
export async function reviewStrings(
  entries: Map<string, TranslationEntry>,
): Promise<Map<string, TranslationEntry>> {
  const { confirm, isCancel } = await import("@clack/prompts");
  const allEntries = [...entries.entries()];
  const approved = new Map<string, TranslationEntry>();

  console.log(chalk.cyan(`\n  Reviewing ${allEntries.length} extracted strings.`));
  console.log(chalk.gray("  Y = keep, N = discard. Ctrl+C saves progress.\n"));

  for (let idx = 0; idx < allEntries.length; idx++) {
    const [key, entry] = allEntries[idx]!;
    const prefix = chalk.gray(`  [${idx + 1}/${allEntries.length}]`);
    const location = chalk.dim(`${entry.file}:${entry.line}`);
    console.log(`${prefix} ${chalk.white(key)} ${location}`);

    const keep = await confirm({ message: "Keep?" });

    if (isCancel(keep)) {
      console.log(chalk.yellow("\n  Review interrupted — saving approved strings so far.\n"));
      break;
    }

    if (keep === true) approved.set(key, entry);
  }

  return approved;
}

export interface ScanOptions {
  ai: boolean;
  review: boolean;
}

export async function runScan(options: ScanOptions = { ai: false, review: false }) {
  const { ai, review } = options;

  console.log(chalk.cyan("\n┌─────────────────────────────────┐"));
  console.log(chalk.cyan("│      🔍  Starting i18n Scan      │"));
  console.log(chalk.cyan("└─────────────────────────────────┘\n"));

  // load config
  console.log(chalk.gray("  → Loading config..."));
  const config = await loadConfig();
  if (config === null) {
    console.log(chalk.red("  ✗ No config found. Run `init` first.\n"));
    return;
  }
  console.log(chalk.green(`  ✓ Config loaded`) + chalk.gray(` (source: ${config.sourceLang})`));

  const scanProvider = config.scanProvider || config.provider;

  if (ai) {
    if (hasApiKey(scanProvider)) {
      console.log(chalk.cyan(`  ✦ AI filter enabled`) + chalk.gray(` (provider: ${scanProvider})\n`));
    } else {
      console.log(
        chalk.yellow(`  ⚠ --ai requested but no key for "${scanProvider}" — using heuristic filter only.\n`),
      );
    }
  }

  if (review) {
    console.log(chalk.cyan("  ✦ Review mode — you will approve each string interactively\n"));
  }

  // scan files — returns rich Map<string, TranslationEntry>
  console.log(chalk.gray("  → Scanning project files...\n"));
  let entries = await scanFiles();
  const rawCount = entries.size;
  console.log(chalk.green(`  ✓ Extracted ${chalk.bold(rawCount)} candidate strings`));

  // LLM filter pass (auto-skips if no key)
  if (ai) {
    console.log(chalk.gray("\n  → Filtering with AI...\n"));
    entries = await llmFilterStrings(entries, config);
    const filteredCount = entries.size;
    console.log(
      chalk.green(`  ✓ AI kept ${chalk.bold(filteredCount)} strings`) +
        chalk.gray(` (removed ${rawCount - filteredCount} non-UI strings)`),
    );
  }

  // interactive review pass
  if (review) {
    entries = await reviewStrings(entries);
    console.log(chalk.green(`  ✓ Review complete — ${entries.size} strings approved`));
  }

  // convert to flat locale JSON
  const allTexts = entriesToLocale(entries);
  const count = Object.keys(allTexts).length;

  // ensure locale dir exists
  await folderExists(config.localeDir);
  console.log(chalk.gray(`  → Locale dir ready: ${config.localeDir}`));

  // write file
  const FILE_PATH = path.join(config.localeDir, `${config.sourceLang}.json`);
  fs.writeFileSync(FILE_PATH, JSON.stringify(allTexts, null, 2));
  console.log(chalk.green(`  ✓ Saved ${chalk.bold(count)} strings to `) + chalk.cyan(FILE_PATH));

  console.log(chalk.cyan("\n✨ Scan complete!\n"));
}



// splits a flat object into chunks of `size` keys each
function chunkObject(
  obj: Record<string, string>,
  size: number,
): Record<string, string>[] {
  const entries = Object.entries(obj);
  const chunks: Record<string, string>[] = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(Object.fromEntries(entries.slice(i, i + size)));
  }
  return chunks;
}

// attempts to parse JSON from model output, stripping markdown fences if present
function safeParseJSON(raw: string): Record<string, string> | null {
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

//run translate command function
export async function runTranslate() {
  console.log(chalk.cyan("\n┌──────────────────────────────────────┐"));
  console.log(chalk.cyan("│      🌍  Starting i18n Translate      │"));
  console.log(chalk.cyan("└──────────────────────────────────────┘\n"));

  console.log(chalk.gray("loading key "))
  dotenv.config()
  
  // 1. load config
  console.log(chalk.gray("  → Loading config..."));
  const config = await loadConfig();
  if (!config) {
    console.log(chalk.red("  ✗ No config found. Run `init` first.\n"));
    return;
  }
  console.log(
    chalk.green("  ✓ Config loaded") +
      chalk.gray(` (${config.sourceLang} → ${config.targetLang.join(", ")}) via ${config.provider}`),
  );

  // 2. read source locale file
  const sourceFile = path.join(config.localeDir, `${config.sourceLang}.json`);
  if (!fs.existsSync(sourceFile)) {
    console.log(chalk.red(`  ✗ Source file not found: ${sourceFile}`));
    console.log(chalk.yellow("  → Run `scan` first to generate it.\n"));
    return;
  }

  let sourceTexts: Record<string, string>;
  try {
    sourceTexts = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
  } catch {
    console.log(chalk.red(`  ✗ Failed to parse ${sourceFile}. Is it valid JSON?\n`));
    return;
  }

  const totalKeys = Object.keys(sourceTexts).length;
  if (totalKeys === 0) {
    console.log(chalk.yellow("  ⚠ Source file is empty. Nothing to translate.\n"));
    return;
  }
  console.log(
    chalk.green(`  ✓ Loaded ${chalk.bold(totalKeys)} strings from `) + chalk.cyan(sourceFile),
  );

  // 3. resolve model
  let model: ReturnType<typeof getModel>;
  try {
    model = getModel(config.provider);
    console.log(chalk.green(`  ✓ Provider ready`) + chalk.gray(` (${config.provider})`));
  } catch (err: any) {
    console.log(chalk.red(`  ✗ ${err.message}\n`));
    return;
  }

  await folderExists(config.localeDir);

  const CHUNK_SIZE = 100;
  const MAX_RETRIES = 3;

  // 4. translate into each target language
  for (const lang of config.targetLang) {
    const outFile = path.join(config.localeDir, `${lang}.json`);

    // --- incremental: load existing translations if file exists ---
    let existing: Record<string, string> = {};
    if (fs.existsSync(outFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(outFile, "utf8"));
      } catch {
        console.log(chalk.yellow(`  ⚠ Could not parse existing ${outFile}, will retranslate fully.`));
        existing = {};
      }
    }

    // find keys present in source but missing from existing translation
    const missingKeys = Object.keys(sourceTexts).filter((k) => !(k in existing));

    const langLabel = (SUPPORTED_LANGUAGES as Record<string, string>)[lang] ?? lang;

    if (missingKeys.length === 0) {
      console.log(
        chalk.green(`  ✓ ${chalk.bold(langLabel)}`) +
          chalk.gray(` already up to date — no new keys to translate`),
      );
      continue;
    }

    // build subset of source that needs translating
    const toTranslate = Object.fromEntries(missingKeys.map((k) => [k, sourceTexts[k]!]));
    const chunks = chunkObject(toTranslate, CHUNK_SIZE);

    const isIncremental = Object.keys(existing).length > 0;
    console.log(
      chalk.cyan(`\n  ▶  Translating → ${chalk.bold(lang)}`) +
        (isIncremental
          ? chalk.yellow(` (+${missingKeys.length} new keys)`)
          : chalk.gray(` (${totalKeys} keys)`)) +
        chalk.gray(` — ${chunks.length} chunk${chunks.length > 1 ? "s" : ""}`),
    );

    const newlyTranslated: Record<string, string> = {};
    let doneChunks = 0;
    let failedKeys = 0;

    for (const chunk of chunks) {
      let success = false;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { text } = await generateText({
            model,
            prompt: `Translate all JSON values from "${config.sourceLang}" to "${langLabel}".
Rules:
- Return ONLY valid JSON with no markdown, no explanation.
- Keep all keys exactly as-is.
- Preserve placeholders like {name}, {{count}}, %s, %d unchanged.
- Match the tone (formal/informal) of the source text.

JSON:
${JSON.stringify(chunk, null, 2)}`,
          });

          const parsed = safeParseJSON(text);
          if (!parsed) throw new Error("Model returned non-JSON output");

          for (const [k, v] of Object.entries(chunk)) {
            newlyTranslated[k] = typeof parsed[k] === "string" ? parsed[k] : v;
            if (typeof parsed[k] !== "string") failedKeys++;
          }

          success = true;
          break;
        } catch (err: any) {
          if (attempt === MAX_RETRIES) {
            for (const [k, v] of Object.entries(chunk)) {
              newlyTranslated[k] = v;
              failedKeys++;
            }
            console.log(
              chalk.yellow(`\n    ⚠ Chunk failed after ${MAX_RETRIES} attempts, using source fallback. (${err.message})`),
            );
          } else {
            await new Promise((r) => setTimeout(r, attempt * 500));
          }
        }
      }

      if (success) doneChunks++;

      const pct = Math.round((doneChunks / chunks.length) * 100);
      const filled = Math.floor(pct / 5);
      const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(20 - filled));
      process.stdout.write(
        `\r    [${bar}] ${chalk.yellow(`${pct}%`)} ${chalk.gray(`(${doneChunks}/${chunks.length} chunks)`)}`,
      );
    }

    process.stdout.write("\n");

    if (failedKeys > 0) {
      console.log(chalk.yellow(`    ⚠ ${failedKeys} key(s) fell back to source text`));
    }

    // merge: existing + newly translated, preserving source key order
    const merged: Record<string, string> = {};
    for (const k of Object.keys(sourceTexts)) {
      merged[k] = newlyTranslated[k] ?? existing[k] ?? sourceTexts[k]!;
    }

    fs.writeFileSync(outFile, JSON.stringify(merged, null, 2));
    console.log(
      chalk.green(`    ✓ Saved `) +
        chalk.cyan(outFile) +
        chalk.gray(isIncremental ? ` (${Object.keys(existing).length} existing + ${missingKeys.length} new)` : ""),
    );
  }

  console.log(chalk.cyan("\n✨ Translation complete!\n"));
}

export async function runModifyTargetLangs() {
  const { multiselect, isCancel, cancel } = await import("@clack/prompts");

  console.log(chalk.cyan("\n┌──────────────────────────────────────────┐"));
  console.log(chalk.cyan("│      ✏️   Modify Target Languages         │"));
  console.log(chalk.cyan("└──────────────────────────────────────────┘\n"));

  // 1. load config
  const config = await loadConfig();
  if (!config) {
    console.log(chalk.red("  ✗ No config found. Run `init` first.\n"));
    return;
  }
  console.log(
    chalk.gray(`  Current targets: `) + chalk.cyan(config.targetLang.join(", "))
  );

  // 2. prompt — pre-select existing targets
  const selected = await multiselect({
    message: "Select target languages (space to toggle, enter to confirm)",
    options: Object.entries(SUPPORTED_LANGUAGES)
      .filter(([code]) => code !== config.sourceLang)
      .map(([code, name]) => ({
        value: code,
        label: name,
        hint: config.targetLang.includes(code) ? "currently selected" : undefined,
      })),
    initialValues: config.targetLang,
    required: true,
  });

  if (isCancel(selected)) {
    cancel("Cancelled");
    return;
  }

  const newTargets = selected as string[];

  // 3. diff — what was added / removed
  const added = newTargets.filter((l) => !config.targetLang.includes(l));
  const removed = config.targetLang.filter((l) => !newTargets.includes(l));

  if (added.length === 0 && removed.length === 0) {
    console.log(chalk.gray("\n  No changes made.\n"));
    return;
  }

  if (added.length > 0)
    console.log(chalk.green(`  + Adding:   `) + added.map((l) => (SUPPORTED_LANGUAGES as Record<string, string>)[l] ?? l).join(", "));
  if (removed.length > 0)
    console.log(chalk.red(`  - Removing: `) + removed.map((l) => (SUPPORTED_LANGUAGES as Record<string, string>)[l] ?? l).join(", "));

  // 4. save updated config
  config.targetLang = newTargets;
  await saveConfig(config);

  // 5. clean up locale files for removed languages
  for (const lang of removed) {
    const langFile = path.join(config.localeDir, `${lang}.json`);
    if (fs.existsSync(langFile)) {
      fs.rmSync(langFile);
      console.log(chalk.gray(`  → Removed locale file: ${langFile}`));
    }
  }

  console.log(chalk.cyan("\n✨ Target languages updated!\n"));
}

// ─── check: show untranslated keys per target language ───────────────────────

export async function runCheck() {
  console.log(chalk.cyan("\n┌──────────────────────────────────────┐"));
  console.log(chalk.cyan("│      🔎  Checking Translations        │"));
  console.log(chalk.cyan("└──────────────────────────────────────┘\n"));

  const config = await loadConfig();
  if (!config) {
    console.log(chalk.red("  ✗ No config found. Run `init` first.\n"));
    return;
  }

  const sourceFile = path.join(config.localeDir, `${config.sourceLang}.json`);
  if (!fs.existsSync(sourceFile)) {
    console.log(chalk.red(`  ✗ Source file not found: ${sourceFile}`));
    console.log(chalk.yellow("  → Run `scan` first.\n"));
    return;
  }

  let sourceTexts: Record<string, string>;
  try {
    sourceTexts = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
  } catch {
    console.log(chalk.red(`  ✗ Failed to parse ${sourceFile}.\n`));
    return;
  }

  const sourceKeys = new Set(Object.keys(sourceTexts));
  let totalMissing = 0;

  for (const lang of config.targetLang) {
    const langLabel = (SUPPORTED_LANGUAGES as Record<string, string>)[lang] ?? lang;
    const outFile = path.join(config.localeDir, `${lang}.json`);

    if (!fs.existsSync(outFile)) {
      console.log(chalk.red(`  ✗ ${chalk.bold(langLabel)} (${lang})`) + chalk.gray(` — file missing, run \`translate\``));
      totalMissing += sourceKeys.size;
      continue;
    }

    let existing: Record<string, string>;
    try {
      existing = JSON.parse(fs.readFileSync(outFile, "utf8"));
    } catch {
      console.log(chalk.red(`  ✗ ${langLabel}: failed to parse ${outFile}`));
      continue;
    }

    const missing = [...sourceKeys].filter((k) => !(k in existing));

    if (missing.length === 0) {
      console.log(chalk.green(`  ✓ ${chalk.bold(langLabel)} (${lang})`) + chalk.gray(" — fully translated"));
    } else {
      totalMissing += missing.length;
      console.log(chalk.yellow(`  ⚠ ${chalk.bold(langLabel)} (${lang})`) + chalk.red(` — ${missing.length} untranslated key(s):`));
      for (const key of missing) {
        console.log(chalk.gray(`      • "${key}"`) + chalk.dim(` → "${sourceTexts[key]}"`));
      }
    }
  }

  console.log();
  if (totalMissing === 0) {
    console.log(chalk.green("✓ All translations are complete!\n"));
  } else {
    console.log(chalk.yellow(`⚠ ${totalMissing} total untranslated key(s). Run \`translate\` to fix.\n`));
  }
}

// ─── clean: remove keys from target JSONs that no longer exist in source ─────

export async function runClean() {
  console.log(chalk.cyan("\n┌──────────────────────────────────────┐"));
  console.log(chalk.cyan("│      🧹  Cleaning Locale Files        │"));
  console.log(chalk.cyan("└──────────────────────────────────────┘\n"));

  const config = await loadConfig();
  if (!config) {
    console.log(chalk.red("  ✗ No config found. Run `init` first.\n"));
    return;
  }

  const sourceFile = path.join(config.localeDir, `${config.sourceLang}.json`);
  if (!fs.existsSync(sourceFile)) {
    console.log(chalk.red(`  ✗ Source file not found: ${sourceFile}`));
    console.log(chalk.yellow("  → Run `scan` first.\n"));
    return;
  }

  let sourceTexts: Record<string, string>;
  try {
    sourceTexts = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
  } catch {
    console.log(chalk.red(`  ✗ Failed to parse ${sourceFile}.\n`));
    return;
  }

  const sourceKeys = new Set(Object.keys(sourceTexts));
  let totalRemoved = 0;

  for (const lang of config.targetLang) {
    const langLabel = (SUPPORTED_LANGUAGES as Record<string, string>)[lang] ?? lang;
    const outFile = path.join(config.localeDir, `${lang}.json`);

    if (!fs.existsSync(outFile)) {
      console.log(chalk.gray(`  — ${langLabel} (${lang}): file not found, skipping`));
      continue;
    }

    let existing: Record<string, string>;
    try {
      existing = JSON.parse(fs.readFileSync(outFile, "utf8"));
    } catch {
      console.log(chalk.red(`  ✗ ${langLabel}: failed to parse ${outFile}, skipping`));
      continue;
    }

    const staleKeys = Object.keys(existing).filter((k) => !sourceKeys.has(k));

    if (staleKeys.length === 0) {
      console.log(chalk.green(`  ✓ ${chalk.bold(langLabel)} (${lang})`) + chalk.gray(" — nothing to clean"));
      continue;
    }

    // remove stale keys
    for (const k of staleKeys) {
      delete existing[k];
    }

    try {
      fs.writeFileSync(outFile, JSON.stringify(existing, null, 2));
      totalRemoved += staleKeys.length;
      console.log(
        chalk.green(`  ✓ ${chalk.bold(langLabel)} (${lang})`) +
          chalk.gray(` — removed ${staleKeys.length} stale key(s): `) +
          chalk.dim(staleKeys.map((k) => `"${k}"`).join(", ")),
      );
    } catch (err: any) {
      console.log(chalk.red(`  ✗ ${langLabel}: failed to write ${outFile} — ${err.message}`));
    }
  }

  console.log();
  if (totalRemoved === 0) {
    console.log(chalk.green("✓ All locale files are clean.\n"));
  } else {
    console.log(chalk.green(`✓ Removed ${totalRemoved} stale key(s) total.\n`));
  }
}

// ─── stats: full project translation statistics ───────────────────────────────

export async function runStats(verbose = false) {
  const config = await loadConfig();
  if (!config) {
    console.log(chalk.red("\n  ✗ No config found. Run `init` first.\n"));
    return;
  }

  const sourceFile = path.join(config.localeDir, `${config.sourceLang}.json`);
  if (!fs.existsSync(sourceFile)) {
    console.log(chalk.red(`\n  ✗ Source file not found: ${sourceFile}`));
    console.log(chalk.yellow("  → Run `scan` first.\n"));
    return;
  }

  let sourceTexts: Record<string, string>;
  try {
    sourceTexts = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
  } catch {
    console.log(chalk.red(`\n  ✗ Failed to parse ${sourceFile}.\n`));
    return;
  }

  const totalKeys = Object.keys(sourceTexts).length;
  const scannedFiles = await getFilePaths();
  const divider = chalk.gray("─".repeat(40));

  console.log(chalk.cyan("\n┌──────────────────────────────────────┐"));
  console.log(chalk.cyan("│          📊 i18n Statistics           │"));
  console.log(chalk.cyan("└──────────────────────────────────────┘"));

  // ── Project ──────────────────────────────
  console.log(chalk.bold("\nProject"));
  console.log(divider);
  console.log(row("Files Scanned", String(scannedFiles.length)));

  if (verbose) {
    const byExt: Record<string, number> = {};
    for (const f of scannedFiles) {
      const ext = path.extname(f).replace(".", "").toUpperCase() + " Files";
      byExt[ext] = (byExt[ext] ?? 0) + 1;
    }
    for (const [ext, count] of Object.entries(byExt).sort()) {
      console.log(row(`  ${ext}`, String(count)));
    }
  }

  // ── Strings ───────────────────────────────
  if (verbose) {
    // count values that appear more than once across all source entries
    const valueCounts: Record<string, number> = {};
    for (const v of Object.values(sourceTexts)) {
      valueCounts[v] = (valueCounts[v] ?? 0) + 1;
    }
    const duplicates = Object.values(valueCounts).filter((c) => c > 1).reduce((acc, c) => acc + (c - 1), 0);

    console.log(chalk.bold("\nStrings"));
    console.log(divider);
    console.log(row("Unique Strings", String(totalKeys)));
    console.log(row("Duplicate Strings", String(duplicates)));
  } else {
    console.log(row("Strings Extracted", String(totalKeys)));
    console.log(row("Source Language", config.sourceLang));
  }

  // ── Locales ───────────────────────────────
  type LangStat = { lang: string; label: string; keys: number; missing: string[] };
  const stats: LangStat[] = [];

  console.log(chalk.bold("\nLocales"));
  console.log(divider);
  console.log(row(`${config.sourceLang}.json`, String(totalKeys)));

  for (const lang of config.targetLang) {
    const langLabel = (SUPPORTED_LANGUAGES as Record<string, string>)[lang] ?? lang;
    const outFile = path.join(config.localeDir, `${lang}.json`);

    if (!fs.existsSync(outFile)) {
      stats.push({ lang, label: langLabel, keys: 0, missing: Object.keys(sourceTexts) });
      console.log(row(`${lang}.json`, chalk.red("not found")));
      continue;
    }

    let existing: Record<string, string>;
    try {
      existing = JSON.parse(fs.readFileSync(outFile, "utf8"));
    } catch {
      stats.push({ lang, label: langLabel, keys: 0, missing: Object.keys(sourceTexts) });
      console.log(row(`${lang}.json`, chalk.red("parse error")));
      continue;
    }

    const missing = Object.keys(sourceTexts).filter((k) => !(k in existing));
    stats.push({ lang, label: langLabel, keys: Object.keys(existing).length, missing });
    console.log(row(`${lang}.json`, String(Object.keys(existing).length)));
  }

  // ── Missing Keys ──────────────────────────
  console.log(chalk.bold("\nMissing Keys"));
  console.log(divider);

  const anyMissing = stats.some((s) => s.missing.length > 0);
  if (!anyMissing) {
    console.log(chalk.green("  All languages fully translated"));
  } else {
    for (const s of stats) {
      if (s.missing.length === 0) continue;
      console.log(chalk.yellow(`${s.lang}:`));
      if (verbose) {
        for (const k of s.missing) {
          console.log(chalk.gray(`  - ${k}`));
        }
      } else {
        console.log(chalk.gray(`  ${s.missing.length} key(s) missing — run \`check\` for details`));
      }
    }
  }

  // ── Coverage ──────────────────────────────
  console.log(chalk.bold("\nCoverage"));
  console.log(divider);

  // source lang always 100%
  console.log(
    `${config.sourceLang.padEnd(4)}: ${chalk.white(`${totalKeys} / ${totalKeys}`)} ${chalk.green("(100%)")}`,
  );

  for (const s of stats) {
    const translated = totalKeys - s.missing.length;
    const pct = totalKeys === 0 ? 100 : Math.round((translated / totalKeys) * 100);
    const pctLabel = pct === 100 ? chalk.green(`(${pct}%)`) : chalk.yellow(`(${pct}%)`);
    console.log(`${s.lang.padEnd(4)}: ${chalk.white(`${translated} / ${totalKeys}`)} ${pctLabel}`);
  }

  if (verbose) {
    // ── Last Scan ────────────────────────────
    const sourceStat = fs.statSync(sourceFile);
    const scannedAt = sourceStat.mtime
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);

    console.log(chalk.bold("\nLast Scan"));
    console.log(divider);
    console.log(row("Generated At", scannedAt));
  }

  console.log(chalk.green("\n✓ Done\n"));
}

function row(label: string, value: string): string {
  return chalk.gray(label.padEnd(20)) + ": " + chalk.white(value);
}
