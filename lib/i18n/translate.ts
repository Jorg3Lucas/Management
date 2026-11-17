import { DEFAULT_LOCALE, type Locale } from "./locales";
import pt, { type MessageKey } from "./pt";
import en from "./en";
import es from "./es";
import ko from "./ko";

export type { MessageKey };
export type Vars = Record<string, string | number>;

export const dictionaries: Record<Locale, Record<MessageKey, string>> = { pt, en, es, ko };

/**
 * Traduz uma chave. Aceita `{nome}` para interpolação e cai no português
 * (depois na própria chave) se a tradução estiver faltando.
 */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const template = dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type T = (key: MessageKey, vars?: Vars) => string;

export function translator(locale: Locale): T {
  return (key, vars) => translate(locale, key, vars);
}
