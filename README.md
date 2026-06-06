# Edge — AI-Powered i18n Automation CLI for React

> Built specifically for React projects. Edge takes the grunt work out of internationalization — from extracting strings to rewriting your components — so you can ship multilingual apps without the manual overhead.

---

## The Problem

If you've ever added i18n to a real React app, you know the pain:

- You have hundreds of components with hardcoded text like `<h1>Welcome Back</h1>` and `placeholder="Search..."`
- You have to hunt down every single string manually across every file
- Create a locale JSON file with consistent, meaningful keys
- Go back and replace every string with `t("welcome_back")` by hand
- Add `const { t } = useTranslation()` to every component that has text
- Add the import at the top of every file
- Then do all of that again for every language you support
- Then keep all of it in sync every time your UI text changes

For a mid-sized React app (50+ components) this process takes **days** and is full of human error — missed strings, inconsistent keys, untranslated languages, stale keys that pile up.

**Edge solves all of it from the terminal.**

---

## Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **CLI:** Commander.js
- **AST:** `@babel/parser`, `@babel/traverse`, `@babel/types`, `@babel/generator`
- **Formatting:** Prettier
- **AI Translation:** Vercel AI SDK (`ai`)
- **Supported Providers:** OpenAI, Groq, Google Gemini, Claude, OpenRouter
- **i18n Library:** react-i18next (V2 transform only)

---

## Installation

```bash
bun install
```

---

## Configuration

Running `Edge init` creates `auto-i18n-config.json` in the current directory:

```json
{
  "sourceLang": "en",
  "targetLang": ["hi", "fr", "de"],
  "provider": "groq",
  "localeDir": "./locales",
  "ignore": ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/build/**"],
  "i18nLibrary": "react-i18next"
}
```

Set your API key in a `.env` file in the project root where you run Edge:

```env
GROQ_API_KEY=your_key_here
# or
OPENAI_API_KEY=your_key_here
# or
GOOGLE_API_KEY=your_key_here
# or
ANTHROPIC_API_KEY=your_key_here
# or
OPENROUTER_API_KEY=your_key_here
```

> Bun automatically loads `.env` from the current working directory — no extra setup needed.

---

## Commands

### `Edge init`

Interactive setup wizard. Prompts for:
- Source language
- Target languages
- Locale directory
- AI provider
- i18n library

Writes `auto-i18n-config.json`.

---

### `Edge scan`

Scans all `.js`, `.jsx`, `.ts`, `.tsx` files in your project using Babel AST. Extracts:
- All JSX text content (`<h1>Hello</h1>`)
- Translatable attributes (`placeholder`, `alt`, `title`, `aria-label`, `aria-description`)

Writes extracted strings to `locales/en.json` (or your configured source locale).

```
┌─────────────────────────────────┐
│      🔍  Starting i18n Scan      │
└─────────────────────────────────┘

  → Loading config...
  ✓ Config loaded (source: en)
  → Scanning project files...

Scanning: src/App.tsx
Scanning: src/components/Navbar.tsx

  ✓ Extracted 42 strings
  → Locale dir ready: ./locales
  ✓ Saved to locales/en.json

✨ Scan complete!
```

---

### `Edge translate`

Translates `en.json` into all configured target languages using your AI provider.

**Incremental** — only translates keys that are missing from an existing target locale file. Already-translated keys are preserved.

- Sends strings in batches of 100 keys per request
- Retries each batch up to 3 times with backoff on failure
- Falls back to source value if a key fails after all retries
- Validates every key in the model response before merging

```
  ▶  Translating → hi (+5 new keys) — 1 chunk
    [████████████████████] 100% (1/1 chunks)
    ✓ Saved locales/hi.json (38 existing + 5 new)
```

---

### `Edge check`

Shows every untranslated key per target language, with the source value alongside each missing key.

```
  ✓ Hindi (hi) — fully translated
  ⚠ French (fr) — 3 untranslated key(s):
      • "contact_support" → "Contact Support"
      • "order_status"    → "Order Status"
      • "delete_account"  → "Delete Account"

⚠ 3 total untranslated key(s). Run `translate` to fix.
```

---

### `Edge clean`

Removes keys from target locale files that no longer exist in the source (`en.json`). Useful after you rename or remove strings.

```
  ✓ Hindi (hi)  — nothing to clean
  ✓ French (fr) — removed 2 stale key(s): "old_key", "unused_label"

✓ Removed 2 stale key(s) total.
```

---

### `Edge stats`

Overview of your translation coverage.

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
en  : 381 / 381 (100%)
hi  : 381 / 381 (100%)
fr  : 378 / 381 (99%)

✓ Done
```

#### `Edge stats --verbose`

Adds file type breakdown, duplicate string count, full list of missing keys, and last scan timestamp.

---

### `Edge modify-langs`

Interactive multi-select to add or remove target languages from your config. Automatically deletes locale files for removed languages.

---

### `Edge setup`  *(V2)*

Generates the `react-i18next` runtime configuration for your React project.

1. Detects your React entry file (`src/main.tsx`, `src/main.jsx`, `src/index.tsx`, `src/index.jsx`)
2. Generates `src/i18n.ts` with all configured languages pre-wired
3. Injects `import "./i18n"` into your entry file (safe — never duplicates)

```ts
// generated src/i18n.ts
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
  interpolation: { escapeValue: false },
});

export default i18n;
```

After setup, it prints install instructions for all package managers:

```
  Install required packages in your React project:

    npm   npm install i18next react-i18next
    yarn  yarn add i18next react-i18next
    pnpm  pnpm add i18next react-i18next
    bun   bun add i18next react-i18next
```

---

### `Edge transform`  *(V2)*

**The core V2 feature.** Rewrites your React source files to replace hardcoded strings with `t()` calls. Fully AST-based — no regex, no string replacement.

#### What it transforms

**JSX text:**
```tsx
// before
<h1>Hello</h1>
<button>Buy Now</button>

// after
<h1>{t("Hello")}</h1>
<button>{t("Buy Now")}</button>
```

**Translatable attributes** (`placeholder`, `alt`, `title`, `aria-label`, `aria-description`):
```tsx
// before
<input placeholder="Search Products" />

// after
<input placeholder={t("Search Products")} />
```

**Hook injection** (if not already present):
```tsx
// before
function App() {
  return <h1>Hello</h1>;
}

// after
function App() {
  const { t } = useTranslation();
  return <h1>{t("Hello")}</h1>;
}
```

**Import injection** (if not already present):
```tsx
import { useTranslation } from "react-i18next";
```

#### What it skips

- `{user.name}` — already an expression
- `{t("hello")}` — already translated
- `` {`${count} items`} `` — template literals
- Strings not found in `en.json` — only transforms known keys
- Ignored attributes: `id`, `key`, `className`, `type`, `name`, `src`, `href`, `value`, etc.

#### Supported component patterns

```tsx
function App() { ... }                // named function declaration
const App = () => { ... }             // arrow function with block body
const App = function() { ... }        // function expression
```

#### Options

```bash
Edge transform              # transform and write files
Edge transform --dry-run    # preview diff, write nothing
Edge transform --backup     # save originals to .edge-backups/ first
```

#### `--dry-run` output

```diff
  ~ src/App.tsx (3 strings)
@@ -4,7 +4,9 @@
 function App() {
+  const { t } = useTranslation();
   return (
-    <h1>Hello</h1>
+    <h1>{t("Hello")}</h1>
   );
 }
```

#### `--backup`

Saves original files to `.edge-backups/` preserving folder structure before overwriting.

```
.edge-backups/
  src/
    App.tsx
    components/
      Navbar.tsx
```

---

## Complete Workflow

```bash
# 1. Set up config (one time)
Edge init

# 2. Extract all hardcoded strings from your codebase
Edge scan

# 3. Translate into all target languages
Edge translate

# 4. Check for any gaps
Edge check

# 5. Wire up react-i18next runtime (one time)
Edge setup

# Install packages printed by setup in your React project
npm install i18next react-i18next

# 6. Rewrite source files to use t()
Edge transform --dry-run   # review first
Edge transform --backup    # then apply

# 7. As your app grows — re-scan and re-translate incrementally
Edge scan
Edge translate             # only new strings get sent to AI

# 8. Clean up stale keys after renames/deletions
Edge clean

# 9. Monitor coverage anytime
Edge stats
Edge stats --verbose
```

---

## Project Structure

```
auto-i18n-ai/
├── index.ts                    CLI entry — all Commander commands
├── constants.ts                Language list, attribute sets
├── types.ts                    TransLationConfig type
├── auto-i18n-config.json       Generated config (gitignore this or commit it)
├── locales/
│   ├── en.json                 Source locale (generated by scan)
│   ├── hi.json                 Target locale (generated by translate)
│   └── fr.json
├── Text_Extractor/
│   ├── method.ts               Core scan, translate, check, clean, stats logic
│   └── config-ask.ts           Interactive init wizard
└── src/
    └── transform/
        ├── types.ts            TransformResult, TransformOptions interfaces
        ├── reverseLookup.ts    Builds value → key map from en.json
        ├── injectImport.ts     AST: inject useTranslation import
        ├── injectHook.ts       AST: inject const { t } = useTranslation()
        ├── replaceJSXText.ts   AST: replace JSX text nodes with t()
        ├── replaceAttributes.ts AST: replace attribute values with t()
        ├── transformFile.ts    Orchestrates parse → traverse → generate → prettier
        ├── transformProject.ts Discovers files, handles I/O, backup, dry-run
        ├── backup.ts           .edge-backups/ management
        ├── dryRun.ts           Coloured unified diff output
        └── index.ts            runTransform() + runSetup() entry points
```

---

## Supported AI Providers

| Provider | Config value | Env variable |
|---|---|---|
| OpenAI | `openai` | `OPENAI_API_KEY` |
| Groq | `groq` | `GROQ_API_KEY` |
| Google Gemini | `google-gemini` | `GOOGLE_API_KEY` |
| Anthropic Claude | `claude` | `ANTHROPIC_API_KEY` |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` |

---

## Supported Languages

English, Hindi, French, German, Spanish, Italian, Portuguese, Russian, Japanese, Korean, Chinese

---

## Notes

- **Transform only acts on strings that exist in `en.json`** — run `scan` before `transform`
- **Transform is idempotent** — running it twice won't double-wrap strings
- **The CLI ignores its own source files** during scan and transform to prevent self-modification
- **Prettier formats output** using your project's own `.prettierrc` if present
- **Bun loads `.env` automatically** — no `dotenv` package needed
