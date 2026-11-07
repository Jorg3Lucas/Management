import { execute, queryAll, queryOne, transaction } from "./db";
import {
  CASTLE_PRIZES,
  castlePrizeCounts,
  isCastlePrizeKey,
  type CastlePrizeCounts,
  type CastlePrizeKey,
  type CastlePrizeMember,
} from "./castle-prizes";

/**
 * Todos os membros dos clãs aliados do servidor, juntos, com o prêmio já
 * escolhido na semana. Cada membro pode receber no máximo um prêmio.
 */
export function castlePrizeMembers(serverId: number, weekStart: string): CastlePrizeMember[] {
  const rows = queryAll<CastlePrizeMember>(
    `SELECT c.id AS character_id, c.name, c.power_score,
            cl.id AS clan_id, cl.name AS clan_name,
            a.prize
     FROM characters c
     JOIN clans cl ON cl.id = c.clan_id
     JOIN clan_relations r
       ON r.server_id = c.server_id AND r.clan_id = c.clan_id AND r.stance = 'ally'
     LEFT JOIN castle_prize_awards a
       ON a.server_id = c.server_id AND a.week_start = ? AND a.character_id = c.id
     WHERE c.server_id = ?
     ORDER BY cl.name COLLATE NOCASE ASC, c.power_score DESC, c.name COLLATE NOCASE ASC`,
    weekStart,
    serverId,
  );

  // O driver do SQLite devolve objetos com protótipo nulo; o client component
  // só aceita objetos simples, então normalizamos as linhas antes de enviar.
  return rows.map((row) => ({ ...row }));
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
  | { ok: true; assigned: number; counts: CastlePrizeCounts }
  | { ok: false; error: string };

/**
 * Substitui a distribuição da semana. Só aceita membros dos clãs aliados do
 * servidor e recusa quando alguma raridade passa do total do baú.
 */
export function saveCastlePrizeDistribution(input: {
  serverId: number;
  weekStart: string;
  userId: number;
  awards: Record<number, CastlePrizeKey | null | undefined>;
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

  for (const [rawId, prize] of Object.entries(input.awards)) {
    if (prize === null || prize === undefined) continue;

    const characterId = Number(rawId);
    if (!Number.isInteger(characterId) || characterId <= 0 || !eligible.has(characterId)) {
      return { ok: false, error: "A seleção inclui um membro que não é dos clãs aliados deste servidor." };
    }
    if (!isCastlePrizeKey(prize)) {
      return { ok: false, error: "Há um prêmio inválido na seleção." };
    }

    chosen.push({ characterId, prize });
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

  return { ok: true, assigned: chosen.length, counts };
}
