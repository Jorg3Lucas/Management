import { stanceForClan } from "./clans";
import { execute, queryAll, queryOne } from "./db";
import type { ClanStance } from "./types";

/** Cookie com o último servidor aberto na página Times. */
export const TEAM_SERVER_COOKIE = "mir4_teams_server";

export type TeamRow = {
  id: number;
  server_id: number;
  name: string;
  color: string | null;
  created_at: string;
};

export const TEAM_COLORS = [
  { value: "#e5b45f", label: "Dourado" },
  { value: "#5ad1c8", label: "Ciano" },
  { value: "#f0776c", label: "Vermelho" },
  { value: "#8f7bf0", label: "Roxo" },
  { value: "#56d68a", label: "Verde" },
  { value: "#8d9bb0", label: "Cinza" },
] as const;

export function isValidTeamColor(value: string): boolean {
  return TEAM_COLORS.some((color) => color.value === value);
}

export function listTeams(serverId: number): TeamRow[] {
  return queryAll<TeamRow>(
    "SELECT * FROM teams WHERE server_id = ? ORDER BY name COLLATE NOCASE ASC",
    serverId,
  );
}

export function getTeam(id: number): TeamRow | undefined {
  return queryOne<TeamRow>("SELECT * FROM teams WHERE id = ?", id);
}

/** Time ao qual o clã pertence no servidor (o vínculo é por clã, não por personagem). */
export function teamForClan(serverId: number, clanId: number): TeamRow | undefined {
  return queryOne<TeamRow>(
    `SELECT t.* FROM teams t
     JOIN clan_teams ct ON ct.team_id = t.id
     WHERE ct.server_id = ? AND ct.clan_id = ?
     LIMIT 1`,
    serverId,
    clanId,
  );
}

export function createTeam(input: {
  serverId: number;
  name: string;
  color: string;
  createdBy?: number | null;
}): TeamRow {
  const now = new Date().toISOString();
  const created = execute(
    "INSERT INTO teams (server_id, name, color, created_at) VALUES (?, ?, ?, ?)",
    input.serverId,
    input.name,
    input.color,
    now,
  );
  return {
    id: created.lastInsertRowid,
    server_id: input.serverId,
    name: input.name,
    color: input.color,
    created_at: now,
  };
}

export function updateTeam(teamId: number, name: string, color: string): void {
  execute("UPDATE teams SET name = ?, color = ? WHERE id = ?", name, color, teamId);
}

export function deleteTeam(teamId: number): void {
  // clan_teams tem FK ON DELETE CASCADE: os clãs voltam para "sem time".
  execute("DELETE FROM teams WHERE id = ?", teamId);
}

/**
 * Vincula um clã ao time do servidor (ou desvincula com teamId = null).
 * O time é a aliança do servidor: só clãs com postura "aliado" entram.
 * Retorna falso quando o clã não é aliado ou o time não pertence ao servidor.
 */
export function assignClanTeam(input: {
  serverId: number;
  clanId: number;
  teamId: number | null;
  userId?: number | null;
}): boolean {
  if (input.teamId === null) {
    execute("DELETE FROM clan_teams WHERE server_id = ? AND clan_id = ?", input.serverId, input.clanId);
    return true;
  }

  if (stanceForClan(input.serverId, input.clanId) !== "ally") return false;

  const team = getTeam(input.teamId);
  if (!team || team.server_id !== input.serverId) return false;

  execute(
    `INSERT INTO clan_teams (server_id, clan_id, team_id, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(server_id, clan_id) DO UPDATE SET
       team_id = excluded.team_id,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`,
    input.serverId,
    input.clanId,
    input.teamId,
    input.userId ?? null,
    new Date().toISOString(),
  );
  return true;
}

/**
 * Define o time individual do personagem. teamId = null volta a herdar o time do clã.
 * O time precisa pertencer ao mesmo servidor do personagem.
 */
export function assignCharacterTeam(input: {
  characterId: number;
  serverId: number;
  teamId: number | null;
}): boolean {
  const character = queryOne<{ server_id: number }>("SELECT server_id FROM characters WHERE id = ?", input.characterId);
  if (!character || character.server_id !== input.serverId) return false;

  if (input.teamId !== null) {
    const team = getTeam(input.teamId);
    if (!team || team.server_id !== input.serverId) return false;
  }

  execute("UPDATE characters SET team_id = ? WHERE id = ?", input.teamId, input.characterId);
  return true;
}

export type TeamForceRow = {
  team_id: number;
  team_name: string;
  color: string | null;
  clans: number;
  members: number;
  total_power: number;
  top_power: number;
};

/**
 * Força de cada time do servidor, somando o ranking sincronizado.
 * Só contam clãs aliados: um clã que vira inimigo/neutro sai do time sozinho.
 */
export function teamForce(serverId: number): TeamForceRow[] {
  return queryAll<TeamForceRow>(
    `WITH ally_links AS (
       SELECT ct.server_id, ct.clan_id, ct.team_id
       FROM clan_teams ct
       JOIN clan_relations r
         ON r.server_id = ct.server_id AND r.clan_id = ct.clan_id AND r.stance = 'ally'
     ), effective AS (
       SELECT ch.id, ch.server_id, ch.power_score,
              COALESCE(ch.team_id, al.team_id) AS team_id
       FROM characters ch
       LEFT JOIN ally_links al ON al.server_id = ch.server_id AND al.clan_id = ch.clan_id
     )
     SELECT t.id AS team_id,
            t.name AS team_name,
            t.color AS color,
            (SELECT COUNT(*) FROM ally_links al2
              WHERE al2.team_id = t.id AND al2.server_id = t.server_id) AS clans,
            COUNT(e.id) AS members,
            COALESCE(SUM(e.power_score), 0) AS total_power,
            COALESCE(MAX(e.power_score), 0) AS top_power
     FROM teams t
     LEFT JOIN effective e ON e.team_id = t.id AND e.server_id = t.server_id
     WHERE t.server_id = ?
     GROUP BY t.id
     ORDER BY total_power DESC, t.name COLLATE NOCASE ASC`,
    serverId,
  );
}

export type TeamClanRow = {
  clan_id: number;
  clan_name: string;
  members: number;
  total_power: number;
  top_power: number;
  stance: ClanStance | null;
};

export function teamClans(teamId: number): TeamClanRow[] {
  return queryAll<TeamClanRow>(
    `SELECT c.id AS clan_id,
            c.name AS clan_name,
            COUNT(ch.id) AS members,
            COALESCE(SUM(ch.power_score), 0) AS total_power,
            COALESCE(MAX(ch.power_score), 0) AS top_power,
            r.stance AS stance
     FROM clan_teams ct
     JOIN clans c ON c.id = ct.clan_id
     LEFT JOIN characters ch ON ch.server_id = ct.server_id AND ch.clan_id = ct.clan_id
       AND COALESCE(ch.team_id, ct.team_id) = ct.team_id
     LEFT JOIN clan_relations r ON r.server_id = ct.server_id AND r.clan_id = ct.clan_id
     WHERE ct.team_id = ? AND r.stance = 'ally'
     GROUP BY c.id
     ORDER BY total_power DESC`,
    teamId,
  );
}

export type TeamMemberRow = {
  character_id: number;
  character_name: string;
  clan_name: string;
  power_score: number;
};

/** Todos os jogadores dos clãs aliados que compõem o time, do mais forte ao mais fraco. */
export function teamMembers(teamId: number): TeamMemberRow[] {
  return queryAll<TeamMemberRow>(
    `SELECT ch.id AS character_id,
            ch.name AS character_name,
            c.name AS clan_name,
            ch.power_score
     FROM clan_teams ct
     JOIN clans c ON c.id = ct.clan_id
     JOIN clan_relations r
       ON r.server_id = ct.server_id AND r.clan_id = ct.clan_id AND r.stance = 'ally'
     JOIN characters ch ON ch.server_id = ct.server_id AND ch.clan_id = ct.clan_id
       AND COALESCE(ch.team_id, ct.team_id) = ct.team_id
     WHERE ct.team_id = ?
     ORDER BY ch.power_score DESC, ch.name COLLATE NOCASE ASC`,
    teamId,
  );
}

export type AllianceMemberRow = {
  clan_id: number;
  clan_name: string;
  character_id: number;
  character_name: string;
  power_score: number;
};

/**
 * O time do servidor é a própria aliança: todos os jogadores dos clãs com postura
 * "aliado" entram automaticamente, sem precisar criar time nem vincular clã.
 * Ordenado por clã e, dentro do clã, do jogador mais forte ao mais fraco.
 */
export function allianceRoster(serverId: number): AllianceMemberRow[] {
  return queryAll<AllianceMemberRow>(
    `SELECT c.id AS clan_id,
            c.name AS clan_name,
            ch.id AS character_id,
            ch.name AS character_name,
            ch.power_score
     FROM characters ch
     JOIN clans c ON c.id = ch.clan_id
     JOIN clan_relations r
       ON r.server_id = ch.server_id AND r.clan_id = ch.clan_id AND r.stance = 'ally'
     WHERE ch.server_id = ?
     ORDER BY c.name COLLATE NOCASE ASC, ch.power_score DESC, ch.name COLLATE NOCASE ASC`,
    serverId,
  );
}

/** Nome do time automático de um servidor: o time é a própria aliança. */
export const ALLIANCE_TEAM_NAME = "Aliança";

/**
 * O time do servidor é a aliança: não existe criação manual. Garante o time do
 * servidor (criado na primeira visita) e coloca todo clã aliado dentro dele, para
 * que ficha do jogador e salários enxerguem o mesmo time.
 */
export function ensureAllianceTeam(serverId: number): TeamRow | null {
  let team = queryOne<TeamRow>("SELECT * FROM teams WHERE server_id = ? ORDER BY id ASC LIMIT 1", serverId);

  if (!team) {
    const allies = queryOne<{ total: number }>(
      "SELECT COUNT(*) AS total FROM clan_relations WHERE server_id = ? AND stance = 'ally'",
      serverId,
    );
    if (!allies || allies.total === 0) return null;

    const now = new Date().toISOString();
    try {
      const created = execute(
        "INSERT INTO teams (server_id, name, color, created_at) VALUES (?, ?, ?, ?)",
        serverId,
        ALLIANCE_TEAM_NAME,
        TEAM_COLORS[0].value,
        now,
      );
      team = {
        id: created.lastInsertRowid,
        server_id: serverId,
        name: ALLIANCE_TEAM_NAME,
        color: TEAM_COLORS[0].value,
        created_at: now,
      };
    } catch {
      // Duas visitas simultâneas: a primeira já criou o time.
      team = queryOne<TeamRow>("SELECT * FROM teams WHERE server_id = ? ORDER BY id ASC LIMIT 1", serverId);
      if (!team) return null;
    }
  }

  execute(
    `INSERT INTO clan_teams (server_id, clan_id, team_id, updated_at)
     SELECT r.server_id, r.clan_id, ?, ?
     FROM clan_relations r
     WHERE r.server_id = ? AND r.stance = 'ally'
       AND NOT EXISTS (
         SELECT 1 FROM clan_teams ct WHERE ct.server_id = r.server_id AND ct.clan_id = r.clan_id
       )`,
    team.id,
    new Date().toISOString(),
    serverId,
  );

  return team;
}

export type TeamIndividualRow = {
  character_id: number;
  character_name: string;
  clan_name: string | null;
  power_score: number;
  rank_position: number | null;
};

/** Personagens com vínculo individual neste time (fora do vínculo por clã). */
export function teamIndividualMembers(teamId: number): TeamIndividualRow[] {
  return queryAll<TeamIndividualRow>(
    `SELECT c.id AS character_id,
            c.name AS character_name,
            c.clan AS clan_name,
            c.power_score,
            c.rank_position
     FROM characters c
     WHERE c.team_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM clan_teams ct
         JOIN clan_relations r
           ON r.server_id = ct.server_id AND r.clan_id = ct.clan_id AND r.stance = 'ally'
         WHERE ct.server_id = c.server_id AND ct.clan_id = c.clan_id AND ct.team_id = c.team_id
       )
     ORDER BY c.power_score DESC, c.name COLLATE NOCASE ASC`,
    teamId,
  );
}

export type UnassignedClanRow = {
  clan_id: number;
  clan_name: string;
  members: number;
  total_power: number;
};

/** Clãs aliados que têm jogadores no servidor mas ainda não estão em nenhum time. */
export function unassignedClans(serverId: number): UnassignedClanRow[] {
  return queryAll<UnassignedClanRow>(
    `SELECT c.id AS clan_id,
            c.name AS clan_name,
            COUNT(ch.id) AS members,
            COALESCE(SUM(ch.power_score), 0) AS total_power
     FROM characters ch
     JOIN clans c ON c.id = ch.clan_id
     JOIN clan_relations r
       ON r.server_id = ch.server_id AND r.clan_id = ch.clan_id AND r.stance = 'ally'
     LEFT JOIN clan_teams ct ON ct.server_id = ch.server_id AND ct.clan_id = ch.clan_id
     WHERE ch.server_id = ? AND ct.team_id IS NULL AND ch.team_id IS NULL
     GROUP BY c.id
     HAVING COUNT(ch.id) > 0
     ORDER BY total_power DESC`,
    serverId,
  );
}
