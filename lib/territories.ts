import { execute, queryAll, queryOne, transaction } from "./db";

/** Castelo e vales disputados em cada servidor. */
export const TERRITORIES = [
  { key: "castle_bicheon", name: "Castelo de Bicheon", short: "Castelo", kind: "castle", hint: "Cerco ao castelo" },
  { key: "valley_bicheon", name: "Vale de Bicheon", short: "Bicheon", kind: "valley", hint: "Vale de caça" },
  { key: "valley_redmoon", name: "Vale de Redmoon", short: "Redmoon", kind: "valley", hint: "Vale de caça" },
  { key: "valley_serpent", name: "Vale de Serpentes", short: "Serpentes", kind: "valley", hint: "Vale de caça" },
] as const;

export type TerritoryKey = (typeof TERRITORIES)[number]["key"];

export function isTerritoryKey(value: string): value is TerritoryKey {
  return TERRITORIES.some((territory) => territory.key === value);
}

export function territoryName(key: string): string {
  return TERRITORIES.find((territory) => territory.key === key)?.name ?? key;
}

export type TerritoryOwner = {
  territory: string;
  clan_id: number;
  clan_name: string;
  members: number;
  total_power: number;
  updated_at: string;
  updated_by_name: string | null;
};

/** Dono registrado de cada território do servidor, com a força atual do clã no ranking. */
export function territoryOwners(serverId: number): Map<string, TerritoryOwner> {
  const rows = queryAll<TerritoryOwner>(
    `SELECT t.territory,
            t.clan_id,
            c.name AS clan_name,
            COALESCE((SELECT COUNT(*) FROM characters ch
                      WHERE ch.server_id = t.server_id AND ch.clan_id = t.clan_id), 0) AS members,
            COALESCE((SELECT SUM(ch.power_score) FROM characters ch
                      WHERE ch.server_id = t.server_id AND ch.clan_id = t.clan_id), 0) AS total_power,
            t.updated_at,
            u.display_name AS updated_by_name
     FROM server_territories t
     JOIN clans c ON c.id = t.clan_id
     LEFT JOIN users u ON u.id = t.updated_by
     WHERE t.server_id = ?`,
    serverId,
  );
  return new Map(rows.map((row) => [row.territory, row]));
}

export type TerritoryOwnerBrief = {
  territory: string;
  clan_id: number;
  clan_name: string;
};

/** Donos de todos os territórios dos servidores informados, por servidor. */
export function territoryOwnersByServer(serverIds: number[]): Map<number, Map<string, TerritoryOwnerBrief>> {
  const byServer = new Map<number, Map<string, TerritoryOwnerBrief>>();
  if (serverIds.length === 0) return byServer;

  const rows = queryAll<TerritoryOwnerBrief & { server_id: number }>(
    `SELECT t.server_id, t.territory, t.clan_id, c.name AS clan_name
     FROM server_territories t
     JOIN clans c ON c.id = t.clan_id
     WHERE t.server_id IN (${serverIds.map(() => "?").join(",")})`,
    ...serverIds,
  );

  for (const row of rows) {
    let owners = byServer.get(row.server_id);
    if (!owners) {
      owners = new Map();
      byServer.set(row.server_id, owners);
    }
    owners.set(row.territory, { territory: row.territory, clan_id: row.clan_id, clan_name: row.clan_name });
  }
  return byServer;
}

export type SabukWin = {
  id: number;
  server_id: number;
  clan_id: number;
  clan_name: string;
  won_on: string;
  created_by_name: string | null;
  created_at: string;
};

/** Data (AAAA-MM-DD) exibida como DD/MM/AAAA, sem conversão de fuso. */
export function formatSabukDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** Rodadas de Sabuk Clash registradas no servidor, da mais recente para a mais antiga. */
export function recentSabukWins(serverId: number, limit = 10): SabukWin[] {
  return queryAll<SabukWin>(
    `SELECT w.id, w.server_id, w.clan_id, c.name AS clan_name, w.won_on,
            u.display_name AS created_by_name, w.created_at
     FROM sabuk_wins w
     JOIN clans c ON c.id = w.clan_id
     LEFT JOIN users u ON u.id = w.created_by
     WHERE w.server_id = ?
     ORDER BY w.won_on DESC, w.id DESC
     LIMIT ?`,
    serverId,
    limit,
  );
}

/** Registra o vencedor de uma rodada; repetir a data substitui o vencedor daquela rodada. */
export function recordSabukWin(input: {
  serverId: number;
  clanId: number;
  wonOn: string;
  userId: number | null;
}): void {
  execute(
    `INSERT INTO sabuk_wins (server_id, clan_id, won_on, created_by, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(server_id, won_on) DO UPDATE SET
       clan_id = excluded.clan_id,
       created_by = excluded.created_by,
       created_at = excluded.created_at`,
    input.serverId,
    input.clanId,
    input.wonOn,
    input.userId,
    new Date().toISOString(),
  );
}

/** Remove uma rodada registrada por engano. */
export function deleteSabukWin(id: number, serverId: number): void {
  execute("DELETE FROM sabuk_wins WHERE id = ? AND server_id = ?", id, serverId);
}

export type TerritoryHistoryRow = {
  id: number;
  territory: string;
  previous_clan_name: string | null;
  clan_name: string | null;
  changed_at: string;
  changed_by_name: string | null;
};

/** Trocas de dono registradas no servidor, da mais recente para a mais antiga. */
export function territoryHistory(serverId: number, limit = 15): TerritoryHistoryRow[] {
  return queryAll<TerritoryHistoryRow>(
    `SELECT h.id, h.territory, h.previous_clan_name, h.clan_name, h.changed_at,
            u.display_name AS changed_by_name
     FROM territory_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.server_id = ?
     ORDER BY h.changed_at DESC, h.id DESC
     LIMIT ?`,
    serverId,
    limit,
  );
}

/**
 * Registra o clã dono do território; clanId nulo remove o registro.
 * Cada mudança entra em `territory_history`. Retorna falso quando nada mudou.
 */
export function setTerritoryOwner(input: {
  serverId: number;
  territory: string;
  clanId: number | null;
  userId: number | null;
}): boolean {
  const current = queryOne<{ clan_id: number | null; clan_name: string | null }>(
    `SELECT t.clan_id, c.name AS clan_name
     FROM server_territories t
     LEFT JOIN clans c ON c.id = t.clan_id
     WHERE t.server_id = ? AND t.territory = ?`,
    input.serverId,
    input.territory,
  );
  const previousId = current?.clan_id ?? null;
  if (previousId === input.clanId) return false;

  const nextName =
    input.clanId === null
      ? null
      : (queryOne<{ name: string }>("SELECT name FROM clans WHERE id = ?", input.clanId)?.name ?? null);
  const now = new Date().toISOString();

  transaction(() => {
    if (input.clanId === null) {
      execute("DELETE FROM server_territories WHERE server_id = ? AND territory = ?", input.serverId, input.territory);
    } else {
      execute(
        `INSERT INTO server_territories (server_id, territory, clan_id, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(server_id, territory) DO UPDATE SET
           clan_id = excluded.clan_id,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`,
        input.serverId,
        input.territory,
        input.clanId,
        input.userId,
        now,
      );
    }

    execute(
      `INSERT INTO territory_history
        (server_id, territory, previous_clan_id, previous_clan_name, clan_id, clan_name, source, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
      input.serverId,
      input.territory,
      previousId,
      current?.clan_name ?? null,
      input.clanId,
      nextName,
      input.userId,
      now,
    );
  });

  return true;
}
