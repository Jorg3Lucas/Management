import { execute, queryAll, queryOne } from "./db";
import type { ClanStance } from "./types";

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
 * Retorna falso quando o time não pertence ao servidor informado.
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

export type TeamForceRow = {
  team_id: number;
  team_name: string;
  color: string | null;
  clans: number;
  members: number;
  total_power: number;
  top_power: number;
};

/** Força de cada time do servidor, somando o ranking sincronizado. */
export function teamForce(serverId: number): TeamForceRow[] {
  return queryAll<TeamForceRow>(
    `SELECT t.id AS team_id,
            t.name AS team_name,
            t.color AS color,
            COUNT(DISTINCT ct.clan_id) AS clans,
            COUNT(ch.id) AS members,
            COALESCE(SUM(ch.power_score), 0) AS total_power,
            COALESCE(MAX(ch.power_score), 0) AS top_power
     FROM teams t
     LEFT JOIN clan_teams ct ON ct.team_id = t.id AND ct.server_id = t.server_id
     LEFT JOIN characters ch ON ch.server_id = t.server_id AND ch.clan_id = ct.clan_id
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
     LEFT JOIN clan_relations r ON r.server_id = ct.server_id AND r.clan_id = ct.clan_id
     WHERE ct.team_id = ?
     GROUP BY c.id
     ORDER BY total_power DESC`,
    teamId,
  );
}

export type UnassignedClanRow = {
  clan_id: number;
  clan_name: string;
  members: number;
  total_power: number;
};

/** Clãs que têm jogadores no servidor mas ainda não estão em nenhum time. */
export function unassignedClans(serverId: number): UnassignedClanRow[] {
  return queryAll<UnassignedClanRow>(
    `SELECT c.id AS clan_id,
            c.name AS clan_name,
            COUNT(ch.id) AS members,
            COALESCE(SUM(ch.power_score), 0) AS total_power
     FROM characters ch
     JOIN clans c ON c.id = ch.clan_id
     LEFT JOIN clan_teams ct ON ct.server_id = ch.server_id AND ct.clan_id = ch.clan_id
     WHERE ch.server_id = ? AND ct.team_id IS NULL
     GROUP BY c.id
     ORDER BY total_power DESC`,
    serverId,
  );
}
