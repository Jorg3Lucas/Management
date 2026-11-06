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

/** Define o servidor casa de vários jogadores de uma vez. Retorna quantos foram alterados. */
export function bulkSetHomeServer(playerIds: number[], serverId: number): number {
  if (playerIds.length === 0) return 0;
  const now = new Date().toISOString();
  return transaction(() => {
    let changed = 0;
    for (const playerId of playerIds) {
      changed += execute(
        "UPDATE players SET home_server_id = ?, updated_at = ? WHERE id = ?",
        serverId,
        now,
        playerId,
      ).changes;
    }
    return changed;
  });
}

export function playersByIds(playerIds: number[]): PlayerRow[] {
  if (playerIds.length === 0) return [];
  return queryAll<PlayerRow>(
    `SELECT * FROM players WHERE id IN (${playerIds.map(() => "?").join(",")})`,
    ...playerIds,
  );
}

/** Personagem de um jogador que tem servidor casa definido, com clã e time no servidor em que está. */
export type HomeServerMemberRow = {
  player_id: number;
  player_name: string;
  home_server_id: number;
  character_id: number;
  character_name: string;
  server_id: number;
  server_code: string;
  server_label: string;
  clan_id: number | null;
  clan_name: string | null;
  team_id: number | null;
  team_name: string | null;
  team_color: string | null;
  power_score: number;
  rank_position: number | null;
  last_seen_at: string | null;
  /** 1 quando o personagem está no próprio servidor casa. */
  in_home_server: number;
};

/**
 * Todos os personagens dos jogadores cujo servidor casa é o informado,
 * inclusive os que estão em outros servidores, com clã, time e poder de cada um.
 */
export function homeServerMembers(serverId: number, search = "", limit = 500): HomeServerMemberRow[] {
  const filters = ["p.home_server_id = ?"];
  const params: (string | number)[] = [serverId];

  if (search) {
    filters.push("(p.display_name LIKE ? OR c.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  return queryAll<HomeServerMemberRow>(
    `SELECT p.id AS player_id,
            p.display_name AS player_name,
            p.home_server_id,
            c.id AS character_id,
            c.name AS character_name,
            s.id AS server_id,
            s.code AS server_code,
            s.label AS server_label,
            c.clan_id,
            cl.name AS clan_name,
            ct.team_id,
            t.name AS team_name,
            t.color AS team_color,
            c.power_score,
            c.rank_position,
            c.last_seen_at,
            CASE WHEN c.server_id = p.home_server_id THEN 1 ELSE 0 END AS in_home_server
     FROM players p
     JOIN characters c ON c.player_id = p.id
     JOIN servers s ON s.id = c.server_id
     LEFT JOIN clans cl ON cl.id = c.clan_id
     LEFT JOIN clan_teams ct ON ct.server_id = c.server_id AND ct.clan_id = c.clan_id
     LEFT JOIN teams t ON t.id = ct.team_id
     WHERE ${filters.join(" AND ")}
     ORDER BY p.display_name COLLATE NOCASE ASC, c.power_score DESC
     LIMIT ?`,
    ...params,
    limit,
  );
}

export type HomeServerCandidateRow = {
  player_id: number;
  player_name: string;
  home_label: string | null;
  home_code: string | null;
  characters_here: number;
  power_here: number;
};

/** Jogadores com personagem no servidor que ainda não têm este servidor como casa. */
export function homeServerCandidates(serverId: number, search = "", limit = 200): HomeServerCandidateRow[] {
  const filters = ["c.server_id = ?", "(p.home_server_id IS NULL OR p.home_server_id <> ?)"];
  const params: (string | number)[] = [serverId, serverId];

  if (search) {
    filters.push("(p.display_name LIKE ? OR c.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  return queryAll<HomeServerCandidateRow>(
    `SELECT p.id AS player_id,
            p.display_name AS player_name,
            hs.label AS home_label,
            hs.code AS home_code,
            COUNT(c.id) AS characters_here,
            MAX(c.power_score) AS power_here
     FROM players p
     JOIN characters c ON c.player_id = p.id
     LEFT JOIN servers hs ON hs.id = p.home_server_id
     WHERE ${filters.join(" AND ")}
     GROUP BY p.id
     ORDER BY (p.home_server_id IS NOT NULL), power_here DESC
     LIMIT ?`,
    ...params,
    limit,
  );
}
