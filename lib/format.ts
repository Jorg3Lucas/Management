import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "./i18n/locales";
import { translate } from "./i18n/translate";

export function formatNumber(value: number | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

export function formatPower(value: number | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

export function formatDuration(totalSeconds: number, locale: Locale = DEFAULT_LOCALE): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return translate(locale, "unit.seconds", { n: seconds });

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return [
    days > 0 ? translate(locale, "unit.days", { n: days }) : null,
    days > 0 || hours > 0 ? translate(locale, "unit.hours", { n: hours }) : null,
    translate(locale, "unit.minutes", { n: minutes }),
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatHours(totalSeconds: number): string {
  return `${(totalSeconds / 3600).toFixed(1)}h`;
}

export function classifyStatus(status: string | null): "ok" | "warn" | "error" | "muted" {
  if (status === "success") return "ok";
  if (status === "empty") return "warn";
  if (status === "error") return "error";
  return "muted";
}

export const WAR_TYPES: Record<string, string> = {
  server_war: "Guerra de servidor",
  clan_war: "Guerra de clã",
  castle_siege: "Cerco ao castelo",
  hidden_valley: "Vale Escondido",
  sabuk: "Sabuk Clash",
  other: "Outra",
};

const WAR_TYPE_KEYS = {
  server_war: "warType.server",
  clan_war: "warType.clan",
  castle_siege: "warType.siege",
  hidden_valley: "warType.valley",
  sabuk: "warType.sabuk",
  other: "warType.other",
} as const;

export function warTypeLabel(type: string, locale: Locale = DEFAULT_LOCALE): string {
  const key = WAR_TYPE_KEYS[type as keyof typeof WAR_TYPE_KEYS];
  if (!key) return type;
  return translate(locale, key);
}
