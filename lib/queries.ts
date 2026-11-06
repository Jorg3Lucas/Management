import { queryAll, queryOne } from "./db";
import type {
  CharacterWithServer,
  ClanStance,
  PowerHistoryRow,
  ServerRow,
  SyncRunRow,
  WarSessionWithNames,
} from "./types";

export function getServerById(id: number): ServerRow | undefined {
  return queryOne<ServerRow>("SELECT * FROM servers WHERE id = ?", id);
}

export function getServerByCode(code: string): ServerRow | undefined {
  return queryOne<ServerRow>("SELECT * FROM servers WHERE code = ?", code);
}

export function listServers(): ServerRow[] {
  return queryAll<ServerRow>(
    `SELECT * FROM servers
     ORDER BY is_focus DESC, CASE WHEN group_name = 'EU1' THEN 0 ELSE 1 END, group_name, code`,
  );
}

export function serversByIds(ids: number[]): ServerRow[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return queryAll<ServerRow>(
    `SELECT * FROM servers WHERE id IN (${placeholders})
     ORDER BY is_focus DESC, CASE WHEN group_name = 'EU1' THEN 0 ELSE 1 END, group_name, code`,
    ...ids,
  );
}

export type CharacterListOptions = {
  serverIds: number[];
  serverId?: number;
  search?: string;
  sort?: "power" | "rank" | "name" | "recent";
  /** Filtra pela postura diplomática do clã no servidor do personagem. */
  stance?: ClanStance;
  page?: number;
  pageSize?: number;
};

export function listCharacters(options: CharacterListOptions): {
  rows: CharacterWithServer[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
} {
  const pageSize = options.pageSize ?? 50;
  const page = Math.max(1, options.page ?? 1);
  const ids = options.serverId ? [options.serverId] : options.serverIds;

  if (ids.length === 0) {
    return { rows: [], total: 0, page, pageSize, pages: 0 };
  }

  const filters: string[] = [`c.server_id IN (${ids.map(() => "?").join(",")})`];
  const params: (string | number | null)[] = [...ids];

  if (options.search) {
    filters.push("(c.name LIKE ? OR c.clan LIKE ?)");
    const term = `%${options.search}%`;
    params.push(term, term);
  }

  if (options.stance) {
    filters.push(
      `EXISTS (SELECT 1 FROM clan_relations cr
               WHERE cr.server_id = c.server_id AND cr.clan_id = c.clan_id AND cr.stance = ?)`,
    );
    params.push(options.stance);
  }

  const where = filters.join(" AND ");
  const count = queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM characters c WHERE ${where}`,
    ...params,
  );

  const order =
    options.sort === "rank"
      ? "c.rank_position IS NULL, c.rank_position ASC, c.power_score DESC"
      : options.sort === "name"
        ? "c.name COLLATE NOCASE ASC"
        : options.sort === "recent"
          ? "c.updated_at DESC"
          : "c.power_score DESC, c.rank_position ASC";

  const offset = (page - 1) * pageSize;
  const rows = queryAll<CharacterWithServer>(
    `SELECT c.*, s.code AS server_code, s.label AS server_label, s.group_name
     FROM characters c
     JOIN servers s ON s.id = c.server_id
     WHERE ${where}
     ORDER BY ${order}
     LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset,
  );

  const total = count?.total ?? 0;
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function getCharacterWithServer(id: number): CharacterWithServer | undefined {
  return queryOne<CharacterWithServer>(
    `SELECT c.*, s.code AS server_code, s.label AS server_label, s.group_name
     FROM characters c JOIN servers s ON s.id = c.server_id
     WHERE c.id = ?`,
    id,
  );
}

export function topCharacters(serverId: number, limit = 5): CharacterWithServer[] {
  return queryAll<CharacterWithServer>(
    `SELECT c.*, s.code AS server_code, s.label AS server_label, s.group_name
     FROM characters c JOIN servers s ON s.id = c.server_id
     WHERE c.server_id = ?
     ORDER BY c.power_score DESC, c.rank_position ASC
     LIMIT ?`,
    serverId,
    limit,
  );
}

export function charactersByServer(serverId: number): { id: number; name: string }[] {
  return queryAll<{ id: number; name: string }>(
    "SELECT id, name FROM characters WHERE server_id = ? ORDER BY power_score DESC",
    serverId,
  );
}

export function warSessionsForServers(serverIds: number[], limit = 500): WarSessionWithNames[] {
  if (serverIds.length === 0) return [];
  return queryAll<WarSessionWithNames>(
    `SELECT w.*, c.name AS character_name,
            hs.code AS home_server_code, hs.label AS home_server_label,
            ws.code AS war_server_code, ws.label AS war_server_label
     FROM war_sessions w
     JOIN characters c ON c.id = w.character_id
     JOIN servers hs ON hs.id = c.server_id
     JOIN servers ws ON ws.id = w.server_id
     WHERE c.server_id IN (${serverIds.map(() => "?").join(",")})
     ORDER BY (w.ended_at IS NULL) DESC, w.started_at DESC
     LIMIT ?`,
    ...serverIds,
    limit,
  );
}

export function warSessionsForCharacters(characterIds: number[]): WarSessionWithNames[] {
  if (characterIds.length === 0) return [];
  return queryAll<WarSessionWithNames>(
    `SELECT w.*, c.name AS character_name,
            hs.code AS home_server_code, hs.label AS home_server_label,
            ws.code AS war_server_code, ws.label AS war_server_label
     FROM war_sessions w
     JOIN characters c ON c.id = w.character_id
     JOIN servers hs ON hs.id = c.server_id
     JOIN servers ws ON ws.id = w.server_id
     WHERE w.character_id IN (${characterIds.map(() => "?").join(",")})
     ORDER BY (w.ended_at IS NULL) DESC, w.started_at DESC`,
    ...characterIds,
  );
}

export function warSessionsForCharacter(characterId: number): WarSessionWithNames[] {
  return queryAll<WarSessionWithNames>(
    `SELECT w.*, c.name AS character_name,
            hs.code AS home_server_code, hs.label AS home_server_label,
            ws.code AS war_server_code, ws.label AS war_server_label
     FROM war_sessions w
     JOIN characters c ON c.id = w.character_id
     JOIN servers hs ON hs.id = c.server_id
     JOIN servers ws ON ws.id = w.server_id
     WHERE w.character_id = ?
     ORDER BY (w.ended_at IS NULL) DESC, w.started_at DESC`,
    characterId,
  );
}

export function powerHistory(characterId: number, limit = 30): PowerHistoryRow[] {
  return queryAll<PowerHistoryRow>(
    `SELECT * FROM power_history
     WHERE character_id = ?
     ORDER BY captured_at DESC
     LIMIT ?`,
    characterId,
    limit,
  );
}

export type SyncRunWithServer = SyncRunRow & { server_code: string | null; server_label: string | null };

export function recentSyncRuns(limit = 20, serverIds?: number[]): SyncRunWithServer[] {
  if (serverIds && serverIds.length === 0) return [];
  const filter = serverIds ? `WHERE r.server_id IN (${serverIds.map(() => "?").join(",")})` : "";
  return queryAll<SyncRunWithServer>(
    `SELECT r.*, s.code AS server_code, s.label AS server_label
     FROM sync_runs r LEFT JOIN servers s ON s.id = r.server_id
     ${filter}
     ORDER BY r.started_at DESC
     LIMIT ?`,
    ...(serverIds ?? []),
    limit,
  );
}

export type DailySyncFailure = {
  serverId: number | null;
  serverCode: string | null;
  serverLabel: string | null;
  message: string | null;
  startedAt: string;
};

export type DailySyncRunSummary = {
  startedAt: string;
  finishedAt: string;
  /** Servidores registrados nesta rodada. */
  total: number;
  ok: number;
  empty: number;
  failed: number;
  failures: DailySyncFailure[];
};

/** Fuso da rodada diária — o agendador usa o mesmo. */
const DAILY_RUN_TIMEZONE = "America/Sao_Paulo";

/** Dia local (Brasília) em que a rodada começou, para agrupar as execuções de uma mesma noite. */
function dailyRunDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_RUN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Última rodada diária (source = 'agendado') e os servidores que falharam nela.
 * As execuções de uma rodada são agrupadas pelo dia local em que começaram.
 */
export function lastDailySyncRun(serverIds?: number[]): DailySyncRunSummary | undefined {
  if (serverIds && serverIds.length === 0) return undefined;

  const filter = serverIds ? `AND r.server_id IN (${serverIds.map(() => "?").join(",")})` : "";
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const rows = queryAll<SyncRunWithServer>(
    `SELECT r.*, s.code AS server_code, s.label AS server_label
     FROM sync_runs r LEFT JOIN servers s ON s.id = r.server_id
     WHERE r.source = 'agendado' AND r.started_at >= ? ${filter}
     ORDER BY r.started_at ASC`,
    since,
    ...(serverIds ?? []),
  );
  if (rows.length === 0) return undefined;

  const dayKey = dailyRunDayKey(rows[rows.length - 1].started_at);
  const batch = rows.filter((row) => dailyRunDayKey(row.started_at) === dayKey);
  const failures = batch
    .filter((row) => row.status === "error")
    .map((row) => ({
      serverId: row.server_id,
      serverCode: row.server_code,
      serverLabel: row.server_label,
      message: row.message,
      startedAt: row.started_at,
    }));

  return {
    startedAt: batch[0].started_at,
    finishedAt: batch.reduce((latest, row) => (row.finished_at > latest ? row.finished_at : latest), batch[0].finished_at),
    total: batch.length,
    ok: batch.filter((row) => row.status === "success").length,
    empty: batch.filter((row) => row.status === "empty").length,
    failed: failures.length,
    failures,
  };
}

export function serverPlayerCounts(): Map<number, number> {
  const rows = queryAll<{ server_id: number; total: number }>(
    "SELECT server_id, COUNT(*) AS total FROM characters GROUP BY server_id",
  );
  return new Map(rows.map((row) => [row.server_id, row.total]));
}

export function countCharactersForServers(serverIds: number[]): number {
  if (serverIds.length === 0) return 0;
  const row = queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM characters WHERE server_id IN (${serverIds.map(() => "?").join(",")})`,
    ...serverIds,
  );
  return row?.total ?? 0;
}
