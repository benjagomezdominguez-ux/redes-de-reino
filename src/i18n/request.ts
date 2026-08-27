import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import esMessages from "../../messages/es.json";
import enMessages from "../../messages/en.json";
import ptMessages from "../../messages/pt.json";

const messagesByLocale = {
  es: esMessages,
  en: enMessages,
  pt: ptMessages,
} as const;

// Deep-merges a locale's messages onto Spanish so a key that's missing in
// en/pt silently falls back to the Spanish copy instead of ever reaching
// the user as "MISSING_MESSAGE" — see rule 22 (no roto por falta de
// traducción). Missing keys are still logged in development, see below.
export function withSpanishFallback(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
  path: string[] = []
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(base)) {
    const baseValue = base[key];
    const overrideValue = override[key];
    const currentPath = [...path, key];

    if (
      typeof baseValue === "object" &&
      baseValue !== null &&
      !Array.isArray(baseValue)
    ) {
      result[key] = withSpanishFallback(
        baseValue as Record<string, unknown>,
        (overrideValue as Record<string, unknown>) ?? {},
        currentPath
      );
    } else if (overrideValue === undefined) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[i18n] Missing translation for "${currentPath.join(".")}" — falling back to Spanish.`
        );
      }
      result[key] = baseValue;
    } else {
      result[key] = overrideValue;
    }
  }

  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const messages =
    locale === "es"
      ? esMessages
      : withSpanishFallback(esMessages, messagesByLocale[locale as "en" | "pt"]);

  return { locale, messages };
});
