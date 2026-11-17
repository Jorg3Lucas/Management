import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "./i18n/locales";

const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Lisbon";

export const APP_TIMEZONE = DEFAULT_TIMEZONE;

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Interpreta "2026-11-04T21:30" como horário de parede no fuso da app. */
export function zonedInputToUtc(value: string, timeZone = DEFAULT_TIMEZONE): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi, 0);
  let ts = wall - zoneOffsetMs(new Date(wall), timeZone);
  ts = wall - zoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/** Valor para <input type="datetime-local"> no fuso da app. */
export function utcToZonedInput(iso: string | null, timeZone = DEFAULT_TIMEZONE): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = partsInZone(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatDateTime(
  iso: string | null,
  locale: Locale = DEFAULT_LOCALE,
  timeZone = DEFAULT_TIMEZONE,
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(
  iso: string | null,
  locale: Locale = DEFAULT_LOCALE,
  timeZone = DEFAULT_TIMEZONE,
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Dia de hoje no fuso da app, como "YYYY-MM-DD". */
export function todayInApp(timeZone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
