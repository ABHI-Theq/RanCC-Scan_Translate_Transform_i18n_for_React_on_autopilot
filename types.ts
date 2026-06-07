export type TransLationConfig={
    sourceLang:string,
    targetLang:string[],
    provider:string,       // AI provider for translation
    scanProvider:string,   // AI provider for scan LLM filter (can be same or different)
    localeDir:string,
    ignore:string[],
    i18nLibrary:string
}

export const DEFAULTIGNORE=[
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      // exclude the CLI's own source so transform doesn't rewrite itself
  "**/*.config.js",
  "**/*.config.ts",
  "**/eslint.config.js",
    ]

export const CSS_KEYWORDS = new Set([
  "none",
  "auto",
  "inherit",
  "initial",
  "unset",
  "transparent",
  "currentColor",
  "block",
  "inline",
  "flex",
  "grid",
]);