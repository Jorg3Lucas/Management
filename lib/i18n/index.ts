import { cookies } from "next/headers";
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locales";
import { translateMessage, type MessageTranslator } from "./messages";
import { translate, type MessageKey, type T, type Vars } from "./translate";

export * from "./locales";
export { dictionaries, translate } from "./translate";
export { translateMessage } from "./messages";
export type { MessageKey, T, Vars } from "./translate";
export type { MessageTranslator } from "./messages";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export type Translator = {
  locale: Locale;
  intl: string;
  t: T;
  /** Traduz as mensagens de retorno das server actions (indexadas pelo texto em pt). */
  m: MessageTranslator;
};

/** Para server components e server actions: idioma atual + funções de tradução. */
export async function getT(): Promise<Translator> {
  const locale = await getLocale();
  return {
    locale,
    intl: INTL_LOCALE[locale],
    t: (key: MessageKey, vars?: Vars) => translate(locale, key, vars),
    m: (message: string, vars?: Vars) => translateMessage(locale, message, vars),
  };
}
