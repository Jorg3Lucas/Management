"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/locales";
import { translator, type T } from "@/lib/i18n/translate";

type I18nValue = { locale: Locale; t: T };

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ locale, t: translator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Idioma + t() dentro de componentes client. */
export function useT(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT precisa estar dentro de <I18nProvider>.");
  return ctx;
}
