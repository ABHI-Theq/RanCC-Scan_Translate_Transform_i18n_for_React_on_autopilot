export type TransLationConfig={
    sourceLang:string,
    targetLang:string[],
    provider:string,
    localeDir:string,
    ignore:string[],
    i18nLibrary:string
}

export const DEFAULTIGNORE=[ "**/node_modules/**",
        "**/.next/**",
        "**/dist/**",
        "**/build/**"]