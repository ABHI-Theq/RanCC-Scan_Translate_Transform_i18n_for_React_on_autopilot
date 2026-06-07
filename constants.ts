export const SUPPORTED_LANGUAGES = {
  en: "English",
  hi: "Hindi",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
} as const;

export const TRANSLATABLE_HTML_ATTRIBUTES = new Set([
  "placeholder",
  "title",
  "alt",
  "aria-label",
  "aria-description",
]);

export const TRANSLATABLE_COMPONENT_PROPS = new Set([
  "label",
  "title",
  "message",
  "text",
  "description",
  "helperText",
  "tooltip",
  "caption",
  "emptyMessage",
  "errorMessage",
  "successMessage",
  "warningMessage",
  "header",
  "footer",
  "subtitle",
]);

/**
 * Object property keys whose string values should be extracted as translatable.
 * Handles data-array patterns like:
 *   const items = [{ name: "OpenRouter", usedFor: "...", badge: "Free Tier" }]
 */
export const TRANSLATABLE_DATA_KEYS = new Set([
  // identity / display
  "name",
  "label",
  "title",
  "heading",
  "subheading",
  "subtitle",
  // descriptive
  "description",
  "text",
  "content",
  "summary",
  "detail",
  "body",
  "caption",
  "tagline",
  "note",
  // status / badge
  "badge",
  "status",
  "tag",
  "category",
  // action
  "buttonText",
  "actionLabel",
  "ctaText",
  "linkText",
  // feedback
  "message",
  "errorMessage",
  "successMessage",
  "warningMessage",
  "helperText",
  "placeholder",
  "hint",
  // data-specific
  "usedFor",
  "useCase",
  "purpose",
  "feature",
  "step",
  "instruction",
]);

export const TRANSLATABLE_FUNCTIONS = new Set([
  "alert",
  "confirm",
  "prompt",
  "enqueueSnackbar",
  "showNotification",
  "success",
  "error",
  "warning",
  "info",
]);


export const IGNORE_ATTRIBUTES = new Set([
  "id",
  "key",
  "class",
  "className",
  "type",
  "name",
  "value",
  "defaultValue",
  "src",
  "href",
  "target",
  "rel",
  "role",
  "tabIndex",
  "width",
  "height",
  "size",
  "variant",
  "color",
  "icon",
  "disabled",
  "checked",
  "selected",
  "required",
  "min",
  "max",
  "step",
  "rows",
  "cols",
  "data-testid",
]);
