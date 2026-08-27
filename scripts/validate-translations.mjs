#!/usr/bin/env node
// Ensures es/en/pt message files declare exactly the same set of keys.
// A key present in Spanish but missing elsewhere degrades silently at
// runtime (falls back to Spanish) — this script is what actually catches
// that during development/CI instead of leaving it to be noticed by luck.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.resolve(dirname, "../messages");
const locales = ["es", "en", "pt"];

function loadMessages(locale) {
  const raw = readFileSync(path.join(messagesDir, `${locale}.json`), "utf-8");
  return JSON.parse(raw);
}

function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...collectKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const keysByLocale = Object.fromEntries(
  locales.map((locale) => [locale, new Set(collectKeys(loadMessages(locale)))])
);

const baseLocale = "es";
const baseKeys = keysByLocale[baseLocale];

let hasErrors = false;

for (const locale of locales) {
  if (locale === baseLocale) continue;

  const localeKeys = keysByLocale[locale];
  const missing = [...baseKeys].filter((key) => !localeKeys.has(key));
  const extra = [...localeKeys].filter((key) => !baseKeys.has(key));

  if (missing.length > 0) {
    hasErrors = true;
    console.error(`\n[${locale}] Missing ${missing.length} key(s) present in ${baseLocale}:`);
    for (const key of missing) console.error(`  - ${key}`);
  }

  if (extra.length > 0) {
    hasErrors = true;
    console.error(`\n[${locale}] Has ${extra.length} extra key(s) not in ${baseLocale}:`);
    for (const key of extra) console.error(`  - ${key}`);
  }
}

if (hasErrors) {
  console.error("\nTranslation validation failed.");
  process.exit(1);
} else {
  console.log(`Translation keys match across ${locales.join(", ")} (${baseKeys.size} keys each).`);
}
