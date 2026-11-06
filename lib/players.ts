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
 * Registra uma sugestão de transferência quando o jogador aparece em um servidor novo
 * e o mesmo nome foi visto em outro servidor recentemente. Não aplica nada: só cria a pendência.
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

  const pending = queryOne<{ id: number }>(
    "SELECT id FROM server_moves WHERE player_id = ? AND to_server_id = ? AND status = 'pending'",
    playerId,
    toServerId,
  );
  if (pending) return null;

  execute(
    `INSERT INTO server_moves (player_id, from_server_id, to_server_id, detected_at, status, source)
     VALUES (?, ?, ?, ?, 'pending', 'sync')`,
    playerId,
    previous.server_id,
    toServerId,
    new Date().toISOString(),
  );
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

export function pendingMoves(limit = 40): ServerMoveView[] {
  return queryAll<ServerMoveView>(
    `${MOVE_SELECT} WHERE m.status = 'pending' ORDER BY m.detected_at DESC LIMIT ?`,
    limit,
  );
}

export function decidedMoves(limit = 40): ServerMoveView[] {
  return queryAll<ServerMoveView>(
    `${MOVE_SELECT} WHERE m.status <> 'pending' ORDER BY m.decided_at DESC, m.detected_at DESC LIMIT ?`,
    limit,
  );
}

export function movesForPlayer(playerId: number, limit = 10): ServerMoveView[] {
  return queryAll<ServerMoveView>(
    `${MOVE_SELECT} WHERE m.player_id = ? ORDER BY m.detected_at DESC LIMIT ?`,
    playerId,
    limit,
  );
}

export function getMove(moveId: number): ServerMoveView | undefined {
  return queryOne<ServerMoveView>(`${MOVE_SELECT} WHERE m.id = ?`, moveId);
}

/** Confirma a transferência: marca a decisão e move o servidor casa do jogador. */
export function confirmMove(moveId: number, userId: number): ServerMoveView | null {
  const move = getMove(moveId);
  if (!move || move.status !== "pending") return null;

  return transaction(() => {
    const now = new Date().toISOString();
    execute(
      "UPDATE server_moves SET status = 'confirmed', confirmed_by = ?, decided_at = ? WHERE id = ? AND status = 'pending'",
      userId,
      now,
      moveId,
    );
    execute("UPDATE players SET home_server_id = ?, updated_at = ? WHERE id = ?", move.to_server_id, now, move.player_id);
    return getMove(moveId) ?? null;
  });
}

export function rejectMove(moveId: number, userId: number): ServerMoveView | null {
  const move = getMove(moveId);
  if (!move || move.status !== "pending") return null;

  execute(
    "UPDATE server_moves SET status = 'rejected', confirmed_by = ?, decided_at = ? WHERE id = ? AND status = 'pending'",
    userId,
    new Date().toISOString(),
    moveId,
  );
  return getMove(moveId) ?? null;
}

/** Define o servidor casa manualmente. */
export function setHomeServer(playerId: number, serverId: number): void {
  execute("UPDATE players SET home_server_id = ?, updated_at = ? WHERE id = ?", serverId, new Date().toISOString(), playerId);
}
