/**
 * Prêmio do castelo: um baú mensal com quantidades fixas por raridade,
 * entregue na guerra de castelo. Este módulo é puro (sem banco) para poder
 * ser importado por componentes client.
 */
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "./i18n/locales";
import { todayInApp } from "./time";
export const CASTLE_PRIZES = [
  { key: "legendary", label: "Lendário", total: 1 },
  { key: "epic", label: "Épico", total: 3 },
  { key: "rare", label: "Raro", total: 5 },
  { key: "uncommon", label: "Incomum", total: 10 },
  { key: "common", label: "Comum", total: 50 },
] as const;

export type CastlePrizeKey = (typeof CASTLE_PRIZES)[number]["key"];

export type CastlePrizeCounts = Record<CastlePrizeKey, number>;

/** Prêmios já escolhidos para um membro no mês: no máximo um de cada raridade. */
export type CastlePrizeMember = {
  character_id: number;
  name: string;
  power_score: number;
  clan_id: number;
  clan_name: string;
  prizes: CastlePrizeKey[];
  /** Quando os baús do mês foram entregues; null enquanto pendentes. */
  delivered_at: string | null;
};

const PRIZE_ORDER = new Map<string, number>(CASTLE_PRIZES.map((prize, index) => [prize.key, index]));

/** Sempre na ordem do baú (lendário → comum) e sem repetir raridade. */
export function sortCastlePrizes(prizes: Iterable<CastlePrizeKey>): CastlePrizeKey[] {
  return Array.from(new Set(prizes)).sort(
    (a, b) => (PRIZE_ORDER.get(a) ?? 0) - (PRIZE_ORDER.get(b) ?? 0),
  );
}

export const CASTLE_PRIZE_TOTAL = CASTLE_PRIZES.reduce((total, prize) => total + prize.total, 0);

/**
 * Chave do período do baú: o baú é mensal, então vale o primeiro dia do mês.
 * Aceita "2026-11", "2026-11-18" ou vazio (mês atual no fuso da app).
 */
export function castleMonthStart(value?: string | null): string {
  const raw = value && /^\d{4}-\d{2}(-\d{2})?$/.test(value) ? value : todayInApp();
  const match = /^(\d{4})-(\d{2})/.exec(raw);
  const month = Number(match?.[2] ?? 0);
  if (!match || month < 1 || month > 12) return castleMonthStart(null);
  return `${match[1]}-${match[2]}-01`;
}

/** Anda meses para frente ou para trás a partir do primeiro dia do mês. */
export function shiftMonth(start: string, months: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return start;
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

/** "2026-11-01" → "Novembro/2026" (no idioma atual). */
export function castleMonthTitle(start: string, locale: Locale = DEFAULT_LOCALE): string {
  const date = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return start;
  const formatted = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(date);
  return `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`;
}

/** "2026-11-01" → "2026-11", para nomes de arquivo. */
export function castleMonthSlug(start: string): string {
  return start.slice(0, 7);
}

export function isCastlePrizeKey(value: unknown): value is CastlePrizeKey {
  return CASTLE_PRIZES.some((prize) => prize.key === value);
}

export function castlePrizeCounts(prizes: Iterable<CastlePrizeKey>): CastlePrizeCounts {
  const counts: CastlePrizeCounts = {
    legendary: 0,
    epic: 0,
    rare: 0,
    uncommon: 0,
    common: 0,
  };

  for (const prize of prizes) {
    if (isCastlePrizeKey(prize)) counts[prize] += 1;
  }

  return counts;
}
