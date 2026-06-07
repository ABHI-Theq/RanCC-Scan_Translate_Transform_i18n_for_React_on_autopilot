<div align="center">

# 🌐 RanCC

### The i18n automation CLI built for React developers.

**Stop writing `t("key")` by hand. RanCC scans your React codebase, translates with AI, and rewrites your components — fully automated.**

[![npm](https://img.shields.io/npm/v/rancc?color=6366f1&style=flat-square)](https://www.npmjs.com/package/rancc)
[![license](https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square)](./LICENSE)
[![built with bun](https://img.shields.io/badge/runtime-bun-f9f1e1?style=flat-square)](https://bun.sh)
[![react](https://img.shields.io/badge/framework-React-61DAFB?style=flat-square&logo=react)](https://react.dev)

</div>

---

## React First

RanCC is designed exclusively for **React** projects using **react-i18next**. Every feature — scanning, transforming, and the runtime setup — is built around React's component model, JSX syntax, and the hooks-based API of react-i18next.

It does not support Vue, Angular, Svelte, React Native, or next-intl. React + react-i18next is the one thing it does, and it does it completely.

---

## The Problem Every React Developer Faces

You build a React app in English. It works. Then the requirement comes: support Hindi, French, German. Now you face this:

```tsx
// Your current components — hundreds of them
function HeroSection() {
  return (
    <>
      <h1>Welcome Back</h1>
      <p>The fastest way to build your product</p>
      <button>Get Started</button>
      <input placeholder="Search products..." />
    </>
  );
}
```

To internationalize this manually you have to:

1. Hunt every hardcoded string across 50+ components
2. Create a `locales/en.json` with consistent keys
3. Replace every string with `t("welcome_back")` by hand
4. Add `const { t } = useTranslation()` to every component
5. Add `import { useTranslation } from 'react-i18next'` to every file
6. Translate the JSON into every target language — one key at a time
7. Repeat this every time your UI text changes
8. Keep all locale files in sync when you rename or delete strings

For a mid-sized app, this process takes **days** and produces inconsistent results.

**RanCC automates every single step.**

```tsx
// After running: rancc scan && rancc translate && rancc transform
import { useTranslation } from "react-i18next";

function HeroSection() {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t("Welcome Back")}</h1>
      <p>{t("The fastest way to build your product")}</p>
      <button>{t("Get Started")}</button>
      <input placeholder={t("Search products...")} />
    </>
  );
}
```

---

## Installation

```bash
npm install -g rancc
# or
bun add -g rancc
# or
pnpm add -g rancc
```

---

## Quick Start

```bash
# 1. Run in your React project root
rancc init

# 2. Extract all UI strings from your source files
rancc scan

# 3. AI-translate into all target languages
rancc translate

# 4. Generate i18n.ts and inject import into your entry file
rancc setup

# 5. Install react-i18next in your React project (printed by setup)
npm install i18next react-i18next

# 6. Rewrite components to use t()
rancc transform --dry-run    # preview first
rancc transform --backup     # then apply
```

That's it. Your React app is now internationalized.

---

## Configuration

Running `rancc init` creates `auto-i18n-config.json` in your project root:

```json
{
  "sourceLang": "en",
  "targetLang": ["hi", "fr", "de"],
  "provider": "groq",
  "scanProvider": "groq",
  "localeDir": "./locales",
  "i18nLibrary": "react-i18next",
  "ignore": [
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**"
  ]
}
```

| Field | Description |
|---|---|
| `sourceLang` | Source language code (e.g. `"en"`) |
| `targetLang` | Array of target language codes |
| `provider` | AI provider used by `rancc translate` |
| `scanProvider` | AI provider used by `rancc scan --ai` (can differ from translate) |
| `localeDir` | Directory where locale JSON files are stored |
| `i18nLibrary` | i18n library (`"react-i18next"` only) |
| `ignore` | Glob patterns to exclude from scanning |

### API Keys

Add your API key to a `.env` file in the project root where you run RanCC:

```env
GROQ_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
```

Key formats and where to get them:

| Provider | Env variable | Key format | Get your key |
|---|---|---|---|
| OpenAI | `OPENAI_API_KEY` | `sk-...` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Groq | `GROQ_API_KEY` | `gsk_...` | [console.groq.com/keys](https://console.groq.com/keys) |
| Google Gemini | `GOOGLE_API_KEY` | `AIzaSy...` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Anthropic Claude | `ANTHROPIC_API_KEY` | `sk-ant-...` | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| OpenRouter | `OPENROUTER_API_KEY` | `sk-or-...` | [openrouter.ai/keys](https://openrouter.ai/keys) |

> Bun automatically loads `.env` from the current working directory — no `dotenv` configuration needed.

---

## Commands In Depth

---

### `rancc init`

> 🧙 Interactive configuration wizard

Walks you through setting up the project configuration. Prompts for:

- Source language (the language your app is currently written in)
- Target languages (what you want to translate into)
- Locale directory path
- i18n library selection
- **Translation provider** — which AI to use for `rancc translate`
- **Scan provider** — which AI to use for `rancc scan --ai` (can be a cheaper/faster model like Groq)

Writes `auto-i18n-config.json` and shows a summary:

```
(❁´◡`❁) Configuration setup done!

  Translate provider : groq
  Scan provider      : groq
  Locale dir         : ./locales
  Source language    : en
  Target languages   : hi, fr, de
```

---

### `rancc scan`

> 🔍 Extract UI strings from your React codebase using Babel AST

Parses every `.js`, `.jsx`, `.ts`, `.tsx` file and extracts strings that are likely UI text. Uses a multi-layer approach:

#### What gets extracted

**JSX text content:**
```tsx
<h1>Hello World</h1>          // ✅ extracted
<p>Click here to continue</p> // ✅ extracted
```

**Translatable HTML attributes:**
```tsx
<input placeholder="Search..."  /> // ✅ extracted
<img alt="Profile photo" />        // ✅ extracted
<button title="Close panel" />     // ✅ extracted
<div aria-label="Navigation" />    // ✅ extracted
```

**Data array patterns — object property keys:**
```tsx
// ✅ extracted: name, usedFor, badge, description, label, title...
const features = [
  { name: "AI Agent", description: "Autonomous coding", badge: "New" },
]
```

**Notification/alert calls:**
```tsx
toast.error("Something went wrong")  // ✅ extracted
alert("Are you sure?")               // ✅ extracted
enqueueSnackbar("Saved!")            // ✅ extracted
```

#### What gets filtered out (heuristic)

The AST extractor automatically discards:
- Tailwind/CSS class strings (`"flex items-center gap-2"`)
- CSS values (`"radial-gradient(...)"`, `"0.5s ease"`)
- SVG path data (`"M 50,50 L 15,20"`)
- Hex colors, rgba strings
- URL strings
- File paths
- Cron expressions (`"0 9 * * *"`)
- Shell/code commands (`"npm install ..."`)
- Template placeholders (`"{value}px"`, `"stream-{id}"`)
- Model IDs and API slugs (`"gpt-4o-mini"`, `"openrouter/free"`)
- Pure numbers, env var names, UUIDs

#### Scan flags

```bash
rancc scan              # Fast, heuristic-only — always works, no API needed
rancc scan --ai         # AST + LLM verification pass
rancc scan --review     # AST + interactive developer approval
rancc scan --ai --review  # All three layers combined
```

#### `--ai` flag — LLM-powered verification

When `--ai` is passed, RanCC sends extracted candidates to your `scanProvider` in batches of 80. Each entry includes the **string value**, **source file path**, and **line number** so the model has full context:

```json
{
  "Free Tier": { "value": "Free Tier", "file": "src/Providers.tsx", "line": 18 },
  "openrouter/free": { "value": "openrouter/free", "file": "src/Providers.tsx", "line": 19 }
}
```

The LLM sees that `"Free Tier"` on line 18 is a badge label (keep) and `"openrouter/free"` on line 19 is a config slug (reject). This context makes the filter dramatically more accurate than heuristics alone.

If the API key for `scanProvider` is not set in `.env`, `--ai` degrades gracefully to heuristic-only with a warning — it never crashes.

#### `--review` flag — developer approval

Presents every extracted string one by one in the terminal. You press `Y` to keep or `N` to discard. Shows file path and line number next to each string:

```
  [1/42] Welcome Back   src/HeroSection.tsx:8
  Keep? › Yes

  [2/42] flex items-center gap-2   src/Navbar.tsx:12
  Keep? › No
```

Ctrl+C saves progress so far — you won't lose approved strings if you stop midway.

---

### `rancc translate`

> 🌍 AI-powered translation with incremental updates

Translates your source locale (`en.json`) into every configured target language using your AI provider.

#### Incremental translation

Only new strings are translated. If `hi.json` already exists with 380 keys and you added 5 new strings, only those 5 get sent to the AI. Existing translations are preserved.

```
  ▶  Translating → Hindi (+5 new keys) — 1 chunk
    [████████████████████] 100% (1/1 chunks)
    ✓ Saved locales/hi.json (380 existing + 5 new)
```

#### Batch processing

Strings are sent in batches of 100 to stay within context limits. Each batch:
- Retries up to 3× with exponential backoff on failure
- Validates every key in the model response before merging
- Falls back to the source value for any key the model drops or fails

The final merged file preserves the original source key order.

---

### `rancc check`

> 🔎 Show every untranslated key per language

```
  ✓ Hindi (hi)   — fully translated
  ⚠ French (fr)  — 3 untranslated key(s):
      • "contact_support"  → "Contact Support"
      • "order_status"     → "Order Status"
      • "delete_account"   → "Delete Account"

⚠ 3 total untranslated key(s). Run `translate` to fix.
```

Shows the source value alongside each missing key so you know exactly what needs translating.

---

### `rancc clean`

> 🧹 Remove stale keys from locale files

After you rename or delete strings in your React app, re-run `scan` to update `en.json`, then run `clean` to remove the deleted keys from all target locale files.

```
  ✓ Hindi (hi)   — removed 2 stale key(s): "old_hero_title", "unused_cta"
  ✓ French (fr)  — nothing to clean

✓ Removed 2 stale key(s) total.
```

---

### `rancc stats`

> 📊 Translation coverage dashboard

```
┌──────────────────────────────────────┐
│          📊 i18n Statistics           │
└──────────────────────────────────────┘

Project
────────────────────────────────────────
Files Scanned        : 34
Strings Extracted    : 381
Source Language      : en

Locales
────────────────────────────────────────
en.json              : 381
hi.json              : 381
fr.json              : 378

Missing Keys
────────────────────────────────────────
fr:
  3 key(s) missing — run `check` for details

Coverage
────────────────────────────────────────
en  : 381 / 381  (100%)
hi  : 381 / 381  (100%)
fr  : 378 / 381   (99%)

✓ Done
```

#### `rancc stats --verbose`

Adds:
- File type breakdown (JS/JSX/TS/TSX counts)
- Duplicate string count
- Full list of missing keys per language
- Last scan timestamp (from source file mtime)

---

### `rancc modify-langs`

> ✏️ Add or remove target languages interactively

Opens a multi-select prompt pre-checked with your current targets. Make changes and confirm. RanCC:
- Updates `auto-i18n-config.json`
- Deletes locale files for removed languages
- Leaves existing locale files for added languages (they'll be created on next `translate`)

---

### `rancc setup`

> 🔧 Wire up react-i18next in your React project

This is a one-time command that bootstraps the react-i18next runtime configuration for your React app.

**What it does:**

1. **Detects your React entry file** — checks `src/main.tsx`, `src/main.jsx`, `src/index.tsx`, `src/index.jsx`
2. **Generates `src/i18n.ts`** — a complete react-i18next configuration pre-wired with all your configured languages
3. **Injects `import "./i18n"`** into your entry file after the last existing import (never duplicates)

**Generated `src/i18n.ts`:**

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en.json";
import hi from "../locales/hi.json";
import fr from "../locales/fr.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    fr: { translation: fr },
  },
  lng: localStorage.getItem("lang") ?? "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already handles XSS
  },
});

export default i18n;
```

After running `setup`, it prints install instructions for all package managers:

```
  Install required packages in your React project:

    npm   npm install i18next react-i18next
    yarn  yarn add i18next react-i18next
    pnpm  pnpm add i18next react-i18next
    bun   bun add i18next react-i18next
```

---

### `rancc transform`

> ⚡ Rewrite React components to use t() — fully AST-based

The core V2 feature. Traverses every React source file and rewrites hardcoded UI strings into `t()` calls. Automatically injects the `useTranslation` hook and import. **Only transforms strings that exist in your source locale (`en.json`)** — nothing else is touched.

#### Everything is AST-based

RanCC uses `@babel/parser`, `@babel/traverse`, `@babel/types`, and `@babel/generator`. Zero regex rewriting. Zero string replacement. Every transformation is a proper AST mutation, which means:
- Correct handling of JSX edge cases
- No risk of corrupting code structure
- Output is formatted with your project's own Prettier config

#### JSX text transformation

```tsx
// Before
<h1>Welcome Back</h1>
<button>Get Started</button>

// After
<h1>{t("Welcome Back")}</h1>
<button>{t("Get Started")}</button>
```

#### Attribute transformation

Supported attributes: `placeholder`, `alt`, `title`, `aria-label`, `aria-description`

```tsx
// Before
<input placeholder="Search products..." />
<img alt="Profile photo" />

// After
<input placeholder={t("Search products...")} />
<img alt={t("Profile photo")} />
```

#### Hook injection

If `const { t } = useTranslation()` is not already in the component, it is injected at the top of the function body:

```tsx
// Before
function HeroSection() {
  return <h1>Welcome</h1>;
}

// After
function HeroSection() {
  const { t } = useTranslation();
  return <h1>{t("Welcome")}</h1>;
}
```

Hook injection is **never duplicated** — if it already exists, it is skipped.

#### Import injection

If `import { useTranslation } from "react-i18next"` is missing, it is added after the last existing import. Never duplicated.

#### Supported component patterns

```tsx
function App() { ... }              // ✅ named function declaration
const App = () => { ... }           // ✅ arrow function with block body
const App = function() { ... }      // ✅ function expression
```

#### What is never touched

```tsx
{user.name}          // expression — already dynamic
{t("hello")}         // already translated
{`${count} items`}   // template literal
value={someVar}      // non-string attribute
// Ignored attributes: id, key, className, type, name, src, href, value, role...
```

#### Options

```bash
rancc transform               # transform and write files in place
rancc transform --dry-run     # show coloured diff, write nothing
rancc transform --backup      # save originals to .edge-backups/ before overwriting
```

#### `--dry-run` output

```diff
  ~ src/HeroSection.tsx (3 strings)
@@ -3,7 +3,8 @@

 function HeroSection() {
+  const { t } = useTranslation();
   return (
-    <h1>Welcome Back</h1>
+    <h1>{t("Welcome Back")}</h1>
   );
 }
```

#### `--backup`

Creates `.edge-backups/` and mirrors your project structure inside it before any file is overwritten:

```
.edge-backups/
  src/
    HeroSection.tsx
    components/
      Navbar.tsx
      Footer.tsx
```

---

## Complete Workflow

```bash
# ── First time setup ───────────────────────────────────────────────────────

rancc init                   # configure providers, languages, locale dir

rancc scan                   # extract strings (heuristic)
rancc scan --ai              # or: AST + AI verification (recommended)
rancc scan --ai --review     # or: AST + AI + you approve each one

rancc translate              # AI-translate into all target languages

rancc setup                  # generate src/i18n.ts, inject import

# Install in your React project:
npm install i18next react-i18next

rancc transform --dry-run    # preview what will be rewritten
rancc transform --backup     # apply transformations with backup

# ── Ongoing maintenance ────────────────────────────────────────────────────

rancc scan                   # after adding new UI text
rancc translate              # only new strings are sent to AI
rancc clean                  # after removing/renaming strings
rancc check                  # verify coverage
rancc stats                  # dashboard overview
rancc stats --verbose        # detailed report
```

---

## Scan Pipeline In Detail

The scan goes through up to three layers, each optional:

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 1: AST Extraction                   │
│  Babel parses every .js/.jsx/.ts/.tsx file                  │
│  Extracts from: JSXText, translatable attributes,           │
│  data object keys, alert/toast calls                        │
│  Heuristic filters remove CSS, SVG, cron, code snippets     │
└─────────────────────┬───────────────────────────────────────┘
                      │  Map<string, { value, file, line }>
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 2: LLM Verification (--ai)               │
│  Batches of 80 strings sent to scanProvider                 │
│  Each entry includes file path + line number as context     │
│  Model returns array of keys to KEEP                        │
│  Auto-skips gracefully if API key not set                   │
└─────────────────────┬───────────────────────────────────────┘
                      │  Map<string, TranslationEntry>
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Layer 3: Developer Review (--review)              │
│  Each string shown with file:line context                   │
│  Y = keep, N = discard                                      │
│  Ctrl+C saves progress                                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
                locales/en.json
```

---

## Supported AI Providers

| Provider | Config value | Env variable | Recommended for |
|---|---|---|---|
| OpenAI | `openai` | `OPENAI_API_KEY` | Translate |
| Groq | `groq` | `GROQ_API_KEY` | Scan filter (fast + free tier) |
| Google Gemini | `google-gemini` | `GOOGLE_API_KEY` | Translate |
| Anthropic Claude | `claude` | `ANTHROPIC_API_KEY` | Translate (highest quality) |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | Both |

You can use different providers for scan and translate. A common setup:
- `scanProvider: "groq"` — fast, cheap, handles classification well
- `provider: "claude"` — higher quality for actual translation

---

## Supported Languages

English · Hindi · French · German · Spanish · Italian · Portuguese · Russian · Japanese · Korean · Chinese

---

## Project Structure

```
rancc/
├── index.ts                      CLI entry — all Commander commands
├── constants.ts                  Language list, attribute sets, data key sets
├── types.ts                      TransLationConfig type, CSS_KEYWORDS
│
├── Text_Extractor/
│   ├── method.ts                 Core logic: scan, translate, check, clean,
│   │                             stats, llmFilterStrings, reviewStrings
│   ├── extractor.ts              shouldTranslate() filters, addText()
│   ├── config-ask.ts             Interactive init wizard
│   └── traverse_import_helper.ts Babel traverse ESM compatibility shim
│
└── src/transform/
    ├── types.ts                  TransformResult, TransformOptions interfaces
    ├── reverseLookup.ts          Builds value → key map from en.json
    ├── injectImport.ts           AST: inject/merge useTranslation import
    ├── injectHook.ts             AST: inject const { t } = useTranslation()
    ├── replaceJSXText.ts         AST: replace JSX text nodes with t()
    ├── replaceAttributes.ts      AST: replace attribute values with t()
    ├── transformFile.ts          Orchestrates parse → traverse → generate → prettier
    ├── transformProject.ts       File discovery, I/O, backup, per-file logging
    ├── backup.ts                 .edge-backups/ folder management
    ├── dryRun.ts                 Coloured unified diff output
    └── index.ts                  runTransform() + runSetup() entry points
```

---

## Local Development

Since RanCC runs on Bun, you can test changes directly without building:

```bash
bun index.ts scan
bun index.ts translate
bun index.ts transform --dry-run
```

Or link it globally for testing as a real CLI:

```bash
bun link

# Then from any React project:
rancc scan
rancc transform
```

Build for publishing:

```bash
bun run build
npm publish --access=public
```

---

## Notes

- **Transform is idempotent** — running it twice won't double-wrap strings already wrapped in `t()`
- **Only known strings are transformed** — if a string isn't in `en.json`, it is never touched
- **RanCC excludes its own source** — `getFilePaths` ignores `Text_Extractor/`, `src/transform/`, config files, so running in the RanCC repo itself is safe
- **Prettier respects your project** — output is formatted using `prettier.resolveConfig(filePath)`, so your existing `.prettierrc` is honoured
- **Bun loads `.env` automatically** — no dotenv configuration needed when using Bun

---

## License

MIT © 2026
