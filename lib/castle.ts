import { execute, queryAll, queryOne, transaction } from "./db";
import {
  CASTLE_PRIZES,
  castlePrizeCounts,
  isCastlePrizeKey,
  sortCastlePrizes,
  type CastlePrizeCounts,
  type CastlePrizeKey,
  type CastlePrizeMember,
} from "./castle-prizes";

/**
 * Todos os membros dos clãs aliados do servidor, juntos, com os prêmios já
 * escolhidos na semana. Cada membro pode receber vários baús, mas só um de
 * cada raridade.
 */
export function castlePrizeMembers(serverId: number, weekStart: string): CastlePrizeMember[] {
  const rows = queryAll<Omit<CastlePrizeMember, "prizes">>(
    `SELECT c.id AS character_id, c.name, c.power_score,
            cl.id AS clan_id, cl.name AS clan_name
     FROM characters c
     JOIN clans cl ON cl.id = c.clan_id
     JOIN clan_relations r
       ON r.server_id = c.server_id AND r.clan_id = c.clan_id AND r.stance = 'ally'
     WHERE c.server_id = ?
     ORDER BY cl.name COLLATE NOCASE ASC, c.power_score DESC, c.name COLLATE NOCASE ASC`,
    serverId,
  );

  const awards = queryAll<{ character_id: number; prize: string }>(
    "SELECT character_id, prize FROM castle_prize_awards WHERE server_id = ? AND week_start = ?",
    serverId,
    weekStart,
  );

  const byCharacter = new Map<number, CastlePrizeKey[]>();
  for (const award of awards) {
    if (!isCastlePrizeKey(award.prize)) continue;
    const list = byCharacter.get(award.character_id) ?? [];
    list.push(award.prize);
    byCharacter.set(award.character_id, list);
  }

  // O driver do SQLite devolve objetos com protótipo nulo; o client component
  // só aceita objetos simples, então normalizamos as linhas antes de enviar.
  return rows.map((row) => ({
    ...row,
    prizes: sortCastlePrizes(byCharacter.get(row.character_id) ?? []),
  }));
}

/** Momento do último salvamento da distribuição na semana. */
export function castlePrizeUpdatedAt(serverId: number, weekStart: string): string | null {
  const row = queryOne<{ updated_at: string | null }>(
    "SELECT MAX(updated_at) AS updated_at FROM castle_prize_awards WHERE server_id = ? AND week_start = ?",
    serverId,
    weekStart,
  );
  return row?.updated_at ?? null;
}

export type CastlePrizeSaveResult =
  | { ok: true; assigned: number; members: number; counts: CastlePrizeCounts }
  | { ok: false; error: string };

/**
 * Substitui a distribuição da semana. Só aceita membros dos clãs aliados do
 * servidor, no máximo um baú de cada raridade por membro, e recusa quando
 * alguma raridade passa do total do baú.
 */
export function saveCastlePrizeDistribution(input: {
  serverId: number;
  weekStart: string;
  userId: number;
  awards: Record<number, CastlePrizeKey[] | null | undefined>;
}): CastlePrizeSaveResult {
  const eligible = new Set(
    queryAll<{ id: number }>(
      `SELECT c.id
       FROM characters c
       JOIN clan_relations r
         ON r.server_id = c.server_id AND r.clan_id = c.clan_id AND r.stance = 'ally'
       WHERE c.server_id = ?`,
      input.serverId,
    ).map((row) => row.id),
  );

  const chosen: { characterId: number; prize: CastlePrizeKey }[] = [];

  for (const [rawId, prizes] of Object.entries(input.awards)) {
    if (!prizes || prizes.length === 0) continue;

    const characterId = Number(rawId);
    if (!Number.isInteger(characterId) || characterId <= 0 || !eligible.has(characterId)) {
      return { ok: false, error: "A seleção inclui um membro que não é dos clãs aliados deste servidor." };
    }

    const unique = new Set<CastlePrizeKey>();
    for (const prize of prizes) {
      if (!isCastlePrizeKey(prize)) {
        return { ok: false, error: "Há um prêmio inválido na seleção." };
      }
      if (unique.has(prize)) {
        return { ok: false, error: "Cada membro só pode receber um baú de cada raridade." };
      }
      unique.add(prize);
      chosen.push({ characterId, prize });
    }
  }

  const counts = castlePrizeCounts(chosen.map((entry) => entry.prize));
  for (const prize of CASTLE_PRIZES) {
    if (counts[prize.key] > prize.total) {
      return {
        ok: false,
        error: `Passou do limite de ${prize.label.toLowerCase()}: o baú tem ${prize.total}.`,
      };
    }
  }

  const now = new Date().toISOString();
  transaction(() => {
    execute(
      "DELETE FROM castle_prize_awards WHERE server_id = ? AND week_start = ?",
      input.serverId,
      input.weekStart,
    );
    for (const entry of chosen) {
      execute(
        `INSERT INTO castle_prize_awards (server_id, week_start, character_id, prize, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        input.serverId,
        input.weekStart,
        entry.characterId,
        entry.prize,
        input.userId,
        now,
      );
    }
  });

  const members = new Set(chosen.map((entry) => entry.characterId)).size;
  return { ok: true, assigned: chosen.length, members, counts };
}
