import { ceWeekEnd } from "./ce";
import { execute, queryAll, queryOne, transaction } from "./db";

/**
 * Presença de World Boss: cada encontro tem data e horário, e a presença é
 * marcada por personagem. O painel acompanha a semana inteira de uma vez.
 */

export const WORLD_BOSS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const WORLD_BOSS_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type WorldBossFightRow = {
  id: number;
  server_id: number;
  fought_on: string;
  fought_at: string;
  label: string | null;
  created_by: number | null;
  created_at: string;
};

export type WorldBossFightSummary = WorldBossFightRow & {
  attended: number;
};

export type WorldBossMember = {
  character_id: number;
  name: string;
  power_score: number;
  clan_id: number;
  clan_name: string;
};

export type WorldBossAttendanceRow = {
  fight_id: number;
  character_id: number;
};

/** Membros dos clãs aliados do servidor, que são quem conta presença. */
export function worldBossMembers(serverId: number, limit = 300): WorldBossMember[] {
  const rows = queryAll<WorldBossMember>(
    `SELECT c.id AS character_id,
            c.name,
            c.power_score,
            cl.id AS clan_id,
            cl.name AS clan_name
     FROM characters c
     JOIN clans cl ON cl.id = c.clan_id
     JOIN clan_relations r
       ON r.server_id = c.server_id AND r.clan_id = c.clan_id AND r.stance = 'ally'
     WHERE c.server_id = ?
     ORDER BY cl.name COLLATE NOCASE ASC, c.power_score DESC, c.name COLLATE NOCASE ASC
     LIMIT ?`,
    serverId,
    limit,
  );

  // O driver do SQLite devolve objetos com protótipo nulo; o client component
  // só aceita objetos simples, então normalizamos as linhas antes de enviar.
  return rows.map((row) => ({ ...row }));
}

/** Encontros do servidor no intervalo (inclusive), com quantas presenças cada um tem. */
export function worldBossFights(serverId: number, from: string, to: string): WorldBossFightSummary[] {
  const rows = queryAll<WorldBossFightSummary>(
    `SELECT f.*,
            (SELECT COUNT(*) FROM world_boss_attendance a WHERE a.fight_id = f.id) AS attended
     FROM world_boss_fights f
     WHERE f.server_id = ? AND f.fought_on BETWEEN ? AND ?
     ORDER BY f.fought_on ASC, f.fought_at ASC, f.id ASC`,
    serverId,
    from,
    to,
  );
  return rows.map((row) => ({ ...row }));
}

/** Presenças marcadas nos encontros do servidor no intervalo. */
export function worldBossAttendance(
  serverId: number,
  from: string,
  to: string,
): WorldBossAttendanceRow[] {
  return queryAll<WorldBossAttendanceRow>(
    `SELECT a.fight_id, a.character_id
     FROM world_boss_attendance a
     JOIN world_boss_fights f ON f.id = a.fight_id
     WHERE f.server_id = ? AND f.fought_on BETWEEN ? AND ?
     ORDER BY a.fight_id ASC, a.character_id ASC`,
    serverId,
    from,
    to,
  );
}

export function getWorldBossFight(id: number): WorldBossFightRow | undefined {
  return queryOne<WorldBossFightRow>("SELECT * FROM world_boss_fights WHERE id = ?", id);
}

export type WorldBossFightResult = { ok: true; id: number } | { ok: false; error: string };

export function createWorldBossFight(input: {
  serverId: number;
  foughtOn: string;
  foughtAt: string;
  label: string | null;
  userId?: number | null;
}): WorldBossFightResult {
  if (!WORLD_BOSS_DATE_PATTERN.test(input.foughtOn)) {
    return { ok: false, error: "Informe uma data válida para o encontro." };
  }
  if (!WORLD_BOSS_TIME_PATTERN.test(input.foughtAt)) {
    return { ok: false, error: "Informe um horário válido (HH:MM) para o encontro." };
  }

  try {
    const result = execute(
      `INSERT INTO world_boss_fights (server_id, fought_on, fought_at, label, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.serverId,
      input.foughtOn,
      input.foughtAt,
      input.label,
      input.userId ?? null,
      new Date().toISOString(),
    );
    return { ok: true, id: result.lastInsertRowid };
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("UNIQUE");
    return {
      ok: false,
      error: duplicate
        ? "Já existe um encontro nesse dia e horário."
        : "Não foi possível registrar o encontro.",
    };
  }
}

export function deleteWorldBossFight(fightId: number, serverId: number): boolean {
  return (
    execute("DELETE FROM world_boss_fights WHERE id = ? AND server_id = ?", fightId, serverId).changes > 0
  );
}

export type WorldBossAttendanceSaveResult =
  | { ok: true; fights: number; marks: number }
  | { ok: false; error: string };

/**
 * Substitui as presenças dos encontros da semana. Só aceita encontros do
 * servidor no intervalo da semana e personagens dos clãs aliados dele.
 */
export function saveWorldBossAttendance(input: {
  serverId: number;
  weekStart: string;
  userId: number;
  attendance: Record<string, number[] | undefined>;
}): WorldBossAttendanceSaveResult {
  const fights = worldBossFights(input.serverId, input.weekStart, ceWeekEnd(input.weekStart));
  const fightIds = new Set(fights.map((fight) => fight.id));
  const eligible = new Set(worldBossMembers(input.serverId).map((member) => member.character_id));

  const entries: { fightId: number; characterIds: number[] }[] = [];
  for (const [rawFightId, rawIds] of Object.entries(input.attendance)) {
    const fightId = Number(rawFightId);
    if (!Number.isInteger(fightId) || !fightIds.has(fightId)) {
      return { ok: false, error: "A seleção inclui um encontro que não é desta semana do servidor." };
    }

    const characterIds: number[] = [];
    for (const rawId of Array.isArray(rawIds) ? rawIds : []) {
      const characterId = Number(rawId);
      if (!Number.isInteger(characterId) || characterId <= 0 || !eligible.has(characterId)) {
        return { ok: false, error: "A seleção inclui um jogador que não é dos clãs aliados deste servidor." };
      }
      if (!characterIds.includes(characterId)) characterIds.push(characterId);
    }

    entries.push({ fightId, characterIds });
  }

  const now = new Date().toISOString();
  let marks = 0;

  transaction(() => {
    for (const entry of entries) {
      execute("DELETE FROM world_boss_attendance WHERE fight_id = ?", entry.fightId);
      for (const characterId of entry.characterIds) {
        execute(
          "INSERT INTO world_boss_attendance (fight_id, character_id, created_at) VALUES (?, ?, ?)",
          entry.fightId,
          characterId,
          now,
        );
      }
      marks += entry.characterIds.length;
    }
  });

  return { ok: true, fights: entries.length, marks };
}
