export const LOCALES = ["pt", "en", "es", "ko"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt";

export const LOCALE_COOKIE = "mir4_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
  ko: "한국어",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  pt: "PT",
  en: "EN",
  es: "ES",
  ko: "KO",
};

/** Código BCP-47 usado no <html lang> e no Intl. */
export const INTL_LOCALE: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  ko: "ko-KR",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function htmlLang(locale: Locale): string {
  return INTL_LOCALE[locale];
}
