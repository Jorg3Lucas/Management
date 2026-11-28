import { ceWeekEnd, weekDays } from "./ce";
import { execute, queryAll, queryOne, transaction } from "./db";

/**
 * Presença de World Boss: cada encontro tem data e horário, e a presença é
 * marcada por personagem. O painel acompanha a semana inteira de uma vez.
 */

/**
 * Grade fixa dos world bosses do dia (horário local da app). A semana nasce
 * com esses encontros já criados, então as caixas de presença de cada membro
 * ficam prontas sem precisar cadastrar encontro por encontro.
 */
export const WORLD_BOSS_SLOTS = [
  { at: "00:00", label: "Mirage" },
  { at: "10:00", label: "Lab" },
  { at: "12:00", label: "Valley" },
  { at: "20:00", label: "Lab" },
  { at: "22:00", label: "Valley" },
] as const;

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
     WHERE c.server_id = ? AND c.gone_at IS NULL
     ORDER BY cl.name COLLATE NOCASE ASC, c.power_score DESC, c.name COLLATE NOCASE ASC
     LIMIT ?`,
    serverId,
    limit,
  );

  // O driver do SQLite devolve objetos com protótipo nulo; o client component
  // só aceita objetos simples, então normalizamos as linhas antes de enviar.
  return rows.map((row) => ({ ...row }));
}

/**
 * Membros do bloco custom: quem luta em outros servidores e por isso não está
 * no elenco deste servidor, mas a presença ainda precisa ser acompanhada.
 * O personagem vem do ranking geral do jogo, não de um nome digitado à mão.
 */
export type WorldBossCustomMember = {
  id: number;
  name: string;
  character_id: number | null;
  server_label: string | null;
};

export type WorldBossCustomAttendanceRow = {
  fight_id: number;
  custom_member_id: number;
};

/** Nomes do bloco custom do servidor, em ordem alfabética. */
export function worldBossCustomMembers(serverId: number): WorldBossCustomMember[] {
  return queryAll<WorldBossCustomMember>(
    `SELECT m.id, m.name, m.character_id, s.label AS server_label
     FROM world_boss_custom_members m
     LEFT JOIN characters c ON c.id = m.character_id
     LEFT JOIN servers s ON s.id = c.server_id
     WHERE m.server_id = ? AND (m.character_id IS NULL OR c.gone_at IS NULL)
     ORDER BY m.name COLLATE NOCASE ASC`,
    serverId,
  ).map((row) => ({ ...row }));
}

/** Presenças do bloco custom nos encontros do servidor no intervalo. */
export function worldBossCustomAttendance(
  serverId: number,
  from: string,
  to: string,
): WorldBossCustomAttendanceRow[] {
  return queryAll<WorldBossCustomAttendanceRow>(
    `SELECT a.fight_id, a.custom_member_id
     FROM world_boss_custom_attendance a
     JOIN world_boss_fights f ON f.id = a.fight_id
     WHERE f.server_id = ? AND f.fought_on BETWEEN ? AND ?
     ORDER BY a.fight_id ASC, a.custom_member_id ASC`,
    serverId,
    from,
    to,
  ).map((row) => ({ ...row }));
}

export type WorldBossCustomMemberResult =
  | { ok: true; id: number; name: string }
  | { ok: false; error: string };

export type WorldBossRankingPlayer = {
  id: number;
  name: string;
  power_score: number;
  server_label: string;
};

const WORLD_BOSS_RANKING_MIN_TERM = 2;
const WORLD_BOSS_RANKING_LIMIT = 8;

/**
 * Busca no ranking geral do jogo quem pode entrar no bloco custom: personagens
 * de outros servidores, do maior poder para o menor, sem os que já estão aqui.
 */
export function searchWorldBossRanking(serverId: number, term: string): WorldBossRankingPlayer[] {
  const clean = term.replace(/\s+/g, " ").trim().slice(0, 60);
  if (clean.length < WORLD_BOSS_RANKING_MIN_TERM) return [];

  const like = `%${clean.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  return queryAll<WorldBossRankingPlayer>(
    `SELECT c.id, c.name, c.power_score, s.label AS server_label
     FROM characters c
     JOIN servers s ON s.id = c.server_id
     WHERE c.server_id <> ?
       AND c.gone_at IS NULL
       AND c.name LIKE ? ESCAPE '\\'
       AND NOT EXISTS (
         SELECT 1 FROM world_boss_custom_members m
         WHERE m.server_id = ? AND m.character_id = c.id
       )
     ORDER BY c.power_score DESC, c.rank_position IS NULL, c.rank_position ASC, c.name COLLATE NOCASE ASC
     LIMIT ?`,
    serverId,
    like,
    serverId,
    WORLD_BOSS_RANKING_LIMIT,
  ).map((row) => ({ ...row }));
}

/** Adiciona ao bloco custom um personagem do ranking geral do jogo. */
export function addWorldBossCustomMember(input: {
  serverId: number;
  characterId: number;
}): WorldBossCustomMemberResult {
  if (!Number.isInteger(input.characterId) || input.characterId <= 0) {
    return { ok: false, error: "Selecione um jogador do ranking geral do jogo." };
  }

  const character = queryOne<{ id: number; name: string; server_id: number }>(
    "SELECT id, name, server_id FROM characters WHERE id = ?",
    input.characterId,
  );
  if (!character) {
    return { ok: false, error: "Jogador não encontrado no ranking geral do jogo." };
  }
  if (character.server_id === input.serverId) {
    return { ok: false, error: "Esse jogador é deste servidor: marque a presença dele na tabela acima." };
  }

  const existing = queryOne<{ id: number }>(
    "SELECT id FROM world_boss_custom_members WHERE server_id = ? AND (character_id = ? OR name = ?)",
    input.serverId,
    character.id,
    character.name,
  );
  if (existing) {
    return { ok: false, error: "Esse jogador já está no bloco custom." };
  }

  try {
    const result = execute(
      "INSERT INTO world_boss_custom_members (server_id, character_id, name, created_at) VALUES (?, ?, ?, ?)",
      input.serverId,
      character.id,
      character.name,
      new Date().toISOString(),
    );
    return { ok: true, id: result.lastInsertRowid, name: character.name };
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("UNIQUE");
    return {
      ok: false,
      error: duplicate ? "Esse jogador já está no bloco custom." : "Não foi possível adicionar o membro.",
    };
  }
}

/** Remove um nome do bloco custom (as presenças dele saem junto). */
export function deleteWorldBossCustomMember(id: number, serverId: number): boolean {
  return (
    execute("DELETE FROM world_boss_custom_members WHERE id = ? AND server_id = ?", id, serverId).changes > 0
  );
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

/**
 * Cria os encontros da grade fixa para todos os dias da semana, ignorando os
 * que já existem (inclusive os cadastrados à mão no mesmo dia e horário).
 * Retorna quantos encontros nasceram agora.
 */
export function ensureWorldBossWeek(serverId: number, weekStart: string): number {
  const createdAt = new Date().toISOString();
  let created = 0;

  transaction(() => {
    for (const day of weekDays(weekStart)) {
      for (const slot of WORLD_BOSS_SLOTS) {
        created += execute(
          `INSERT OR IGNORE INTO world_boss_fights (server_id, fought_on, fought_at, label, created_by, created_at)
           VALUES (?, ?, ?, ?, NULL, ?)`,
          serverId,
          day,
          slot.at,
          slot.label,
          createdAt,
        ).changes;
      }
    }
  });

  return created;
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

/** Substitui as presenças do bloco custom dos encontros da semana. */
export function saveWorldBossCustomAttendance(input: {
  serverId: number;
  weekStart: string;
  attendance: Record<string, number[] | undefined>;
}): WorldBossAttendanceSaveResult {
  const fights = worldBossFights(input.serverId, input.weekStart, ceWeekEnd(input.weekStart));
  const fightIds = new Set(fights.map((fight) => fight.id));
  const eligible = new Set(worldBossCustomMembers(input.serverId).map((member) => member.id));

  const entries: { fightId: number; customIds: number[] }[] = [];
  for (const [rawFightId, rawIds] of Object.entries(input.attendance)) {
    const fightId = Number(rawFightId);
    if (!Number.isInteger(fightId) || !fightIds.has(fightId)) {
      return { ok: false, error: "A seleção inclui um encontro que não é desta semana do servidor." };
    }

    const customIds: number[] = [];
    for (const rawId of Array.isArray(rawIds) ? rawIds : []) {
      const customId = Number(rawId);
      if (!Number.isInteger(customId) || customId <= 0 || !eligible.has(customId)) {
        return { ok: false, error: "A seleção inclui um membro que não está no bloco custom deste servidor." };
      }
      if (!customIds.includes(customId)) customIds.push(customId);
    }

    entries.push({ fightId, customIds });
  }

  const now = new Date().toISOString();
  let marks = 0;

  transaction(() => {
    for (const entry of entries) {
      execute("DELETE FROM world_boss_custom_attendance WHERE fight_id = ?", entry.fightId);
      for (const customId of entry.customIds) {
        execute(
          "INSERT INTO world_boss_custom_attendance (fight_id, custom_member_id, created_at) VALUES (?, ?, ?)",
          entry.fightId,
          customId,
          now,
        );
      }
      marks += entry.customIds.length;
    }
  });

  return { ok: true, fights: entries.length, marks };
}
