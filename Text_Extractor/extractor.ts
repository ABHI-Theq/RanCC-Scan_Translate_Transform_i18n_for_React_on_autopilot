import fs from "fs";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { getFilePaths } from "./method";
import { CSS_KEYWORDS } from "../types";


export interface TranslationEntry {
  key: string;
  value: string;
  file: string;
  line: number;
}



export function isUrl(text: string) {
  return /^(https?:\/\/|www\.)/i.test(text);
}

export function isSvgPath(text: string) {
  return (
    text.length > 40 &&
    /^[MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]+$/.test(text)
  );
}

export function isFilePath(text: string) {
  return (
    text.startsWith("./") ||
    text.startsWith("../") ||
    text.startsWith("/") ||
    /\.(png|jpg|jpeg|gif|svg|webp|ico|json|css|scss)$/i.test(text)
  );
}

export function isEnvVar(text: string) {
  return /^[A-Z0-9_]+$/.test(text);
}

// export function isHexColor(text: string) {
//   return /^#[0-9a-f]{3,8}$/i.test(text);
// }

export function isUuid(text: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    text
  );
}
function isNumeric(text: string) {
  return /^-?\d+(\.\d+)?$/.test(text);
}
function isPercentage(text: string) {
  return /^\d+(\.\d+)?%$/.test(text);
}
function isViewBox(text: string) {
  return /^\d+\s+\d+\s+\d+\s+\d+$/.test(text);
}
function isCssColorFunction(text: string) {
  return /^(rgb|rgba|hsl|hsla)\(/i.test(text);
}
function isHexColor(text: string) {
  return /^#[0-9a-f]{3,8}$/i.test(text);
}

export function isCssClass(text: string) {
  const parts = text.split(/\s+/);
  if (parts.length === 0) return false;

  // if it has multiple space-separated tokens that look like utility classes, it's CSS
  if (parts.length > 2) {
    const utilityLike = parts.every(
      (part) => /^[a-z0-9:_\-[\]/.%!@#${}]+$/i.test(part)
    );
    if (utilityLike) return true;
  }

  return parts.every(
    (part) =>
      /^[a-z0-9:_\-[\]/]+$/i.test(part) &&
      !/[A-Z]/.test(part)
  );
}

export function isCssValue(text: string) {
  // CSS functions: radial-gradient, linear-gradient, blur, drop-shadow, translate, etc.
  if (/^(radial-gradient|linear-gradient|conic-gradient|blur|drop-shadow|translate|rotate|scale|skew|perspective|matrix|url)\s*\(/i.test(text)) return true;
  // CSS transitions / animations: "box-shadow 0.5s ease"
  if (/^\w[\w-]* \d/.test(text) && /\d+(ms|s)\b/.test(text)) return true;
  // pure pixel/em/rem/vh/vw values
  if (/^\d+(\.\d+)?(px|em|rem|vh|vw|%)$/.test(text)) return true;
  // box-shadow shorthand: "0 0 60px 10px ..."
  if (/^[\d\s.,%-]+(px|em|rem)\b/.test(text)) return true;
  return false;
}

export function isSvgData(text: string) {
  // SVG path data: "M 50,50 L 15,20" etc.
  if (/^[MmLlHhVvCcSsQqTtAaZz][\s\d.,MmLlHhVvCcSsQqTtAaZz-]*$/.test(text.trim())) return true;
  // SVG filter/gradient refs: "url(#stream-{value})"
  if (/^url\(#/.test(text)) return true;
  return false;
}

export function isTemplateValue(text: string) {
  // strings that are clearly dynamic placeholders, not real UI text
  // e.g. "{value}px", "stream-group-{value}", "#{value}"
  return /\{[^}]+\}/.test(text) && !/\s{2,}/.test(text) && text.replace(/\{[^}]+\}/g, "").trim().length < 15;
}

export function isCronExpression(text: string) {
  return /^[\d*,\-/]+ [\d*,\-/]+ [\d*,\-/]+ [\d*,\-/]+ [\d*,\-/]+/.test(text.trim());
}

export function isCodeSnippet(text: string) {
  // git commands, shell commands, code strings
  if (/^(git |npm |bun |yarn |pnpm |cd |curl |wget |docker |jerob )/.test(text)) return true;
  // import/require strings
  if (/^(import |require\(|export )/.test(text)) return true;
  // looks like a JSON object
  if (/^\{[\s\S]*\}$/.test(text.trim()) && text.includes(":")) return true;
  return false;
}

export function shouldTranslate(text: string) {
  const value = text.trim();

  if (!value) return false;

  // too short to be meaningful UI text
  if (value.length < 2) return false;

  // must contain at least one real letter
  if (!/[a-zA-Z]/.test(value)) return false;

  if (isUrl(value)) return false;
  if (isSvgPath(value)) return false;
  if (isSvgData(value)) return false;
  if (isNumeric(value)) return false;
  if (isPercentage(value)) return false;
  if (isViewBox(value)) return false;
  if (isHexColor(value)) return false;
  if (isCssColorFunction(value)) return false;
  if (isCssValue(value)) return false;
  if (CSS_KEYWORDS.has(value)) return false;
  if (isFilePath(value)) return false;
  if (isEnvVar(value)) return false;
  if (isCssClass(value)) return false;
  if (isTemplateValue(value)) return false;
  if (isCronExpression(value)) return false;
  if (isCodeSnippet(value)) return false;
  if (isUuid(value)) return false;

  // reject strings that are mostly punctuation/symbols with barely any words
  const wordChars = value.replace(/[^a-zA-Z\s]/g, "").trim();
  if (wordChars.length < 2) return false;

  return true;
}

export function addText(
  texts: Map<string, TranslationEntry>,
  value: string,
  file: string,
  line: number
) {
  const text = value.trim();

  if (!shouldTranslate(text)) return;

  if (texts.has(text)) return;

  texts.set(text, {
    key: text,
    value: text,
    file,
    line,
  });
}

