import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "./i18n/locales";
import { APP_TIMEZONE } from "./time";

/**
 * Matemática de semana do CE, sem banco — os componentes client precisam
 * destas funções e não podem arrastar `lib/db` (node:fs) para o browser.
 */

/** Hoje (AAAA-MM-DD) no fuso da app. */
function todayInApp(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Segunda-feira da semana de uma data; sem data válida, a semana atual. */
export function ceWeekStart(value?: string | null): string {
  const raw = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayInApp();
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return ceWeekStart(null);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function shiftWeek(start: string, weeks: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

export function ceWeekEnd(start: string): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

/** "2026-11-03" → "03/11" — datas de semana são só dia, sem fuso. */
export function shortDay(value: string, locale: Locale = DEFAULT_LOCALE): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function ceWeekTitle(start: string, locale: Locale = DEFAULT_LOCALE): string {
  return `${shortDay(start, locale)} – ${shortDay(ceWeekEnd(start), locale)}`;
}
