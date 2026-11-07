/**
 * Prêmio do castelo: um baú semanal com quantidades fixas por raridade.
 * Este módulo é puro (sem banco) para poder ser importado por componentes client.
 */
export const CASTLE_PRIZES = [
  { key: "legendary", label: "Lendário", total: 1 },
  { key: "epic", label: "Épico", total: 3 },
  { key: "rare", label: "Raro", total: 5 },
  { key: "uncommon", label: "Incomum", total: 10 },
  { key: "common", label: "Comum", total: 50 },
] as const;

export type CastlePrizeKey = (typeof CASTLE_PRIZES)[number]["key"];

export type CastlePrizeCounts = Record<CastlePrizeKey, number>;

/** Prêmio já escolhido para um membro na semana. */
export type CastlePrizeMember = {
  character_id: number;
  name: string;
  power_score: number;
  clan_id: number;
  clan_name: string;
  prize: CastlePrizeKey | null;
};

export const CASTLE_PRIZE_TOTAL = CASTLE_PRIZES.reduce((total, prize) => total + prize.total, 0);

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
