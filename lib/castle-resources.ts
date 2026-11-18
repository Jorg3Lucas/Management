import { execute, queryAll, queryOne, transaction } from "./db";

/**
 * Recursos do castelo (darksteel e gold): o que cada membro dos clãs aliados
 * recebe no mês. Os valores são livres — quem decide as fatias é quem
 * administra o servidor —, mas o total fica registrado e a entrega é marcada
 * por membro.
 */
export type CastleResourceMember = {
  character_id: number;
  name: string;
  clan_id: number;
  clan_name: string;
  darksteel: number;
  gold: number;
  delivered_at: string | null;
};

export type CastleResourceAmount = {
  darksteel: number;
  gold: number;
  delivered: boolean;
};

export const CASTLE_RESOURCE_MAX = 1_000_000_000_000;

/** Todos os membros dos clãs aliados do servidor, com os valores do mês. */
export function castleResourceMembers(serverId: number, monthStart: string): CastleResourceMember[] {
  const rows = queryAll<Omit<CastleResourceMember, "darksteel" | "gold" | "delivered_at">>(
    `SELECT c.id AS character_id, c.name,
            cl.id AS clan_id, cl.name AS clan_name
     FROM characters c
     JOIN clans cl ON cl.id = c.clan_id
     JOIN clan_relations r
       ON r.server_id = c.server_id AND r.clan_id = c.clan_id AND r.stance = 'ally'
     WHERE c.server_id = ?
     ORDER BY cl.name COLLATE NOCASE ASC, c.name COLLATE NOCASE ASC`,
    serverId,
  );

  const awards = queryAll<{
    character_id: number;
    darksteel: number;
    gold: number;
    delivered_at: string | null;
  }>(
    `SELECT character_id, darksteel, gold, delivered_at
     FROM castle_resource_awards
     WHERE server_id = ? AND month_start = ?`,
    serverId,
    monthStart,
  );
  const byCharacter = new Map(awards.map((row) => [row.character_id, row]));

  // O driver do SQLite devolve objetos com protótipo nulo; normalizamos para
  // os objetos simples que o client component aceita.
  return rows.map((row) => {
    const award = byCharacter.get(row.character_id);
    return {
      ...row,
      darksteel: award?.darksteel ?? 0,
      gold: award?.gold ?? 0,
      delivered_at: award?.delivered_at ?? null,
    };
  });
}

/** Momento do último salvamento da distribuição de recursos no mês. */
export function castleResourceUpdatedAt(serverId: number, monthStart: string): string | null {
  const row = queryOne<{ updated_at: string | null }>(
    "SELECT MAX(updated_at) AS updated_at FROM castle_resource_awards WHERE server_id = ? AND month_start = ?",
    serverId,
    monthStart,
  );
  return row?.updated_at ?? null;
}

export type CastleResourceSaveResult =
  | { ok: true; darksteel: number; gold: number; members: number; delivered: number }
  | { ok: false; error: string };

/**
 * Substitui a distribuição de recursos do mês. Só aceita membros dos clãs
 * aliados do servidor; linhas zeradas saem da tabela.
 */
export function saveCastleResourceDistribution(input: {
  serverId: number;
  monthStart: string;
  userId: number;
  entries: Record<number, CastleResourceAmount | null | undefined>;
}): CastleResourceSaveResult {
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

  const previous = new Map(
    queryAll<{ character_id: number; delivered_at: string | null }>(
      "SELECT character_id, delivered_at FROM castle_resource_awards WHERE server_id = ? AND month_start = ?",
      input.serverId,
      input.monthStart,
    ).map((row) => [row.character_id, row.delivered_at]),
  );

  const rows: { characterId: number; darksteel: number; gold: number; deliveredAt: string | null }[] = [];

  for (const [rawId, entry] of Object.entries(input.entries)) {
    if (!entry) continue;

    const characterId = Number(rawId);
    if (!Number.isInteger(characterId) || characterId <= 0 || !eligible.has(characterId)) {
      return { ok: false, error: "A distribuição inclui um membro que não é dos clãs aliados deste servidor." };
    }

    const darksteel = Math.trunc(Number(entry.darksteel ?? 0));
    const gold = Math.trunc(Number(entry.gold ?? 0));
    if (!Number.isFinite(darksteel) || !Number.isFinite(gold) || darksteel < 0 || gold < 0) {
      return { ok: false, error: "Informe apenas valores positivos em darksteel e gold." };
    }
    if (darksteel > CASTLE_RESOURCE_MAX || gold > CASTLE_RESOURCE_MAX) {
      return { ok: false, error: "Valor acima do limite permitido." };
    }
    if (darksteel === 0 && gold === 0) continue;

    const wasDeliveredAt = previous.get(characterId) ?? null;
    const deliveredAt = entry.delivered ? wasDeliveredAt ?? new Date().toISOString() : null;
    rows.push({ characterId, darksteel, gold, deliveredAt });
  }

  const now = new Date().toISOString();
  transaction(() => {
    execute(
      "DELETE FROM castle_resource_awards WHERE server_id = ? AND month_start = ?",
      input.serverId,
      input.monthStart,
    );
    for (const row of rows) {
      execute(
        `INSERT INTO castle_resource_awards
           (server_id, month_start, character_id, darksteel, gold, delivered_by, delivered_at, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        input.serverId,
        input.monthStart,
        row.characterId,
        row.darksteel,
        row.gold,
        row.deliveredAt ? input.userId : null,
        row.deliveredAt,
        input.userId,
        now,
      );
    }
  });

  return {
    ok: true,
    darksteel: rows.reduce((total, row) => total + row.darksteel, 0),
    gold: rows.reduce((total, row) => total + row.gold, 0),
    members: rows.length,
    delivered: rows.filter((row) => row.deliveredAt).length,
  };
}
