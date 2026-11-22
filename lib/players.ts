import { execute, queryAll, queryOne, transaction } from "./db";
import type { CharacterWithServer } from "./types";

/** Se o personagem foi visto em outro servidor dentro desta janela, a mudança é sugerida. */
const MOVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type PlayerRow = {
  id: number;
  name_key: string;
  display_name: string;
  home_server_id: number | null;
  created_at: string;
  updated_at: string;
};

export type ServerMoveStatus = "pending" | "confirmed" | "rejected";

export type ServerMoveView = {
  id: number;
  player_id: number;
  player_name: string;
  from_server_id: number | null;
  from_label: string | null;
  from_code: string | null;
  to_server_id: number;
  to_label: string;
  to_code: string;
  detected_at: string;
  status: ServerMoveStatus;
  source: string;
  note: string | null;
  decided_at: string | null;
  character_id: number | null;
};

/** Chave de identidade do jogador: o mesmo nome em servidores diferentes é a mesma pessoa. */
export function normalizePlayerKey(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function ensurePlayer(rawName: string): PlayerRow | null {
  const display = rawName
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const key = normalizePlayerKey(display);
  if (!key) return null;

  const found = queryOne<PlayerRow>("SELECT * FROM players WHERE name_key = ?", key);
  if (found) return found;

  const now = new Date().toISOString();
  const created = execute(
    "INSERT INTO players (name_key, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    key,
    display,
    now,
    now,
  );
  return { id: created.lastInsertRowid, name_key: key, display_name: display, home_server_id: null, created_at: now, updated_at: now };
}

export function playerForCharacter(characterId: number): PlayerRow | undefined {
  return queryOne<PlayerRow>(
    `SELECT p.* FROM players p
     JOIN characters c ON c.player_id = p.id
     WHERE c.id = ?`,
    characterId,
  );
}

export function getPlayer(playerId: number): PlayerRow | undefined {
  return queryOne<PlayerRow>("SELECT * FROM players WHERE id = ?", playerId);
}

/** Liga o personagem à identidade do jogador e define o servidor casa quando ainda está vazio. */
export function linkCharacterPlayer(characterId: number, name: string, serverId: number): PlayerRow | null {
  const player = ensurePlayer(name);
  if (!player) return null;

  execute("UPDATE characters SET player_id = ? WHERE id = ?", player.id, characterId);

  if (player.home_server_id === null) {
    const now = new Date().toISOString();
    execute("UPDATE players SET home_server_id = ?, updated_at = ? WHERE id = ?", serverId, now, player.id);
    player.home_server_id = serverId;
  }
  return player;
}

/**
 * Registra e aplica a transferência quando o jogador aparece em um servidor novo
 * e o mesmo nome foi visto em outro servidor recentemente. Não existe aprovação:
 * a mudança é confirmada na hora e o servidor casa passa a ser o novo servidor.
 */
export function detectServerMove(playerId: number, toServerId: number): number | null {
  const previous = queryOne<{ server_id: number; last_seen_at: string | null }>(
    `SELECT server_id, last_seen_at FROM characters
     WHERE player_id = ? AND server_id <> ? AND last_seen_at IS NOT NULL
     ORDER BY last_seen_at DESC
     LIMIT 1`,
    playerId,
    toServerId,
  );
  if (!previous?.last_seen_at) return null;

  const age = Date.now() - Date.parse(previous.last_seen_at);
  if (!Number.isFinite(age) || age > MOVE_WINDOW_MS) return null;

  const now = new Date().toISOString();
  transaction(() => {
    execute(
      `INSERT INTO server_moves
        (player_id, from_server_id, to_server_id, detected_at, status, source, decided_at)
       VALUES (?, ?, ?, ?, 'confirmed', 'sync', ?)`,
      playerId,
      previous.server_id,
      toServerId,
      now,
      now,
    );
    execute("UPDATE players SET home_server_id = ?, updated_at = ? WHERE id = ?", toServerId, now, playerId);
  });
  return previous.server_id;
}

/** Todos os personagens do jogador, com o servidor de cada um. */
export function characterPeers(playerId: number): CharacterWithServer[] {
  return queryAll<CharacterWithServer>(
    `SELECT c.*, s.code AS server_code, s.label AS server_label, s.group_name
     FROM characters c
     JOIN servers s ON s.id = c.server_id
     WHERE c.player_id = ?
     ORDER BY (c.last_seen_at IS NULL), c.last_seen_at DESC`,
    playerId,
  );
}

let linksChecked = false;

/** Liga personagens antigos à identidade do jogador (dados anteriores à tabela de jogadores). */
export function refreshPlayerLinks(): number {
  if (linksChecked) return 0;
  linksChecked = true;

  const rows = queryAll<{ id: number; name: string; server_id: number }>(
    "SELECT id, name, server_id FROM characters WHERE player_id IS NULL ORDER BY id ASC",
  );
  if (rows.length === 0) return 0;

  return transaction(() => {
    let linked = 0;
    for (const row of rows) {
      if (linkCharacterPlayer(row.id, row.name, row.server_id)) linked += 1;
    }
    return linked;
  });
}

const MOVE_SELECT = `
  SELECT m.id, m.player_id, m.from_server_id, m.to_server_id, m.detected_at,
         m.status, m.source, m.note, m.decided_at,
         p.display_name AS player_name,
         fs.label AS from_label, fs.code AS from_code,
         ts.label AS to_label, ts.code AS to_code,
         c.id AS character_id
  FROM server_moves m
  JOIN players p ON p.id = m.player_id
  LEFT JOIN servers fs ON fs.id = m.from_server_id
  JOIN servers ts ON ts.id = m.to_server_id
  LEFT JOIN characters c ON c.player_id = m.player_id AND c.server_id = m.to_server_id
`;

/** Transferências detectadas na sincronização, já aplicadas automaticamente. */
export function recentMoves(limit = 60): ServerMoveView[] {
  return queryAll<ServerMoveView>(
    `${MOVE_SELECT} WHERE m.status <> 'pending' ORDER BY m.detected_at DESC LIMIT ?`,
    limit,
  );
}

export type PlayerJourneyRow = {
  player_id: number;
  player_name: string;
  origin_server_id: number | null;
  origin_label: string | null;
  origin_code: string | null;
  current_server_id: number | null;
  current_label: string | null;
  current_code: string | null;
  character_id: number | null;
  move_count: number;
  last_move_at: string | null;
  last_move_from_label: string | null;
  last_move_to_label: string | null;
};

/**
 * Todos os jogadores do jogo com o servidor onde foram vistos primeiro
 * (origem) e o servidor atual (casa), independente de existir registro em
 * server_moves. É o panorama completo usado na aba de transferências.
 */
export function listPlayerJourneys(
  options: { search?: string; page?: number; pageSize?: number } = {},
): { rows: PlayerJourneyRow[]; total: number; page: number; pageSize: number; pages: number } {
  const pageSize = options.pageSize ?? 100;
  const page = Math.max(1, options.page ?? 1);
  const search = (options.search ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

  const filters: string[] = [];
  const params: (string | number)[] = [];
  if (search) {
    filters.push("p.display_name LIKE ? ESCAPE '\\'");
    params.push(`%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  const total = queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM players p ${where}`, ...params)?.total ?? 0;

  const rows = queryAll<PlayerJourneyRow>(
    `SELECT
       p.id AS player_id,
       p.display_name AS player_name,
       os.id AS origin_server_id, os.label AS origin_label, os.code AS origin_code,
       cs.id AS current_server_id, cs.label AS current_label, cs.code AS current_code,
       cur.id AS character_id,
       (SELECT COUNT(*) FROM server_moves m WHERE m.player_id = p.id AND m.status <> 'pending') AS move_count,
       lm.detected_at AS last_move_at,
       lf.label AS last_move_from_label,
       lt.label AS last_move_to_label
     FROM players p
     LEFT JOIN servers os ON os.id = (
       SELECT c.server_id FROM characters c
       WHERE c.player_id = p.id
       ORDER BY c.created_at ASC, c.id ASC
       LIMIT 1
     )
     LEFT JOIN servers cs ON cs.id = COALESCE(
       p.home_server_id,
       (SELECT c.server_id FROM characters c
        WHERE c.player_id = p.id
        ORDER BY (c.last_seen_at IS NULL), c.last_seen_at DESC, c.id DESC
        LIMIT 1)
     )
     LEFT JOIN characters cur ON cur.id = (
       SELECT c.id FROM characters c
       WHERE c.player_id = p.id AND c.server_id = cs.id
       ORDER BY (c.last_seen_at IS NULL), c.last_seen_at DESC, c.id DESC
       LIMIT 1
     )
     LEFT JOIN server_moves lm ON lm.id = (
       SELECT m.id FROM server_moves m
       WHERE m.player_id = p.id AND m.status <> 'pending'
       ORDER BY m.detected_at DESC, m.id DESC
       LIMIT 1
     )
     LEFT JOIN servers lf ON lf.id = lm.from_server_id
     LEFT JOIN servers lt ON lt.id = lm.to_server_id
     ${where}
     ORDER BY p.display_name COLLATE NOCASE ASC
     LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  );

  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function movesForPlayer(playerId: number, limit = 10): ServerMoveView[] {
  return queryAll<ServerMoveView>(
    `${MOVE_SELECT} WHERE m.player_id = ? ORDER BY m.detected_at DESC LIMIT ?`,
    playerId,
    limit,
  );
}

/** Define o servidor casa manualmente. */
export function setHomeServer(playerId: number, serverId: number): void {
  execute("UPDATE players SET home_server_id = ?, updated_at = ? WHERE id = ?", serverId, new Date().toISOString(), playerId);
}

