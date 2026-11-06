import { execute, queryAll, queryOne, transaction } from "./db";
import type { ClanRow, ClanStance } from "./types";

export const CLAN_STANCES: ClanStance[] = ["ally", "neutral", "enemy"];

export const STANCE_LABELS: Record<ClanStance, string> = {
  ally: "Aliado",
  neutral: "Neutro",
  enemy: "Inimigo",
};

export function isClanStance(value: string): value is ClanStance {
  return (CLAN_STANCES as string[]).includes(value);
}

/** Nomes que o fórum devolve quando o jogador não tem clã — não são clãs de verdade. */
const PLACEHOLDER_CLAN_KEYS = new Set(["-", "--", "—", "–", "n/a", "na", "none", "sem cla", "sem clã"]);

/**
 * Chave de comparação de clãs.
 * O fórum devolve o nome com espaços duplicados, caracteres invisíveis e caixa variada,
 * então comparar o texto cru criaria um clã novo a cada sync.
 */
export function normalizeClanKey(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Nome de exibição limpo (sem inventar maiúsculas que o jogo não usa). */
export function cleanClanName(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function getClan(id: number): ClanRow | undefined {
  return queryOne<ClanRow>("SELECT * FROM clans WHERE id = ?", id);
}

/** Busca por nome normalizado ou alias e cria o clã quando ainda não existe. */
export function ensureClan(rawName: string): ClanRow | null {
  const name = cleanClanName(rawName);
  const key = normalizeClanKey(name);
  if (!key || PLACEHOLDER_CLAN_KEYS.has(key)) return null;

  const found =
    queryOne<ClanRow>("SELECT * FROM clans WHERE name_key = ?", key) ??
    queryOne<ClanRow>(
      `SELECT c.* FROM clans c JOIN clan_aliases a ON a.clan_id = c.id WHERE a.alias_key = ?`,
      key,
    );
  if (found) return found;

  const now = new Date().toISOString();
  const created = execute("INSERT INTO clans (name, name_key, created_at) VALUES (?, ?, ?)", name, key, now);
  return { id: created.lastInsertRowid, name, name_key: key, created_at: now };
}

let linksChecked = false;

/**
 * Liga personagens antigos ao clã correspondente (dados anteriores à tabela de clãs).
 * Roda uma vez por processo: sync e edição manual já gravam `clan_id` daqui para frente.
 */
export function refreshClanLinks(): number {
  if (linksChecked) return 0;
  linksChecked = true;

  const rows = queryAll<{ id: number; clan: string }>(
    `SELECT id, clan FROM characters
     WHERE clan IS NOT NULL AND TRIM(clan) <> ''
       AND clan_id IS NULL`,
  );
  if (rows.length === 0) return 0;

  return transaction(() => {
    let linked = 0;
    for (const row of rows) {
      const clan = ensureClan(row.clan);
      if (!clan) continue;
      execute("UPDATE characters SET clan_id = ? WHERE id = ?", clan.id, row.id);
      linked += 1;
    }
    return linked;
  });
}

/** Registra a troca de clã de um personagem (sync ou edição manual). */
export function logClanChange(input: {
  characterId: number;
  previousName: string | null;
  previousId: number | null;
  nextName: string | null;
  nextId: number | null;
  source: string;
  changedAt?: string;
}): void {
  const nextName = cleanClanName(input.nextName ?? "");
  if (!nextName) return;
  if (normalizeClanKey(nextName) === normalizeClanKey(input.previousName ?? "")) return;

  execute(
    `INSERT INTO character_clan_history
      (character_id, previous_clan_name, previous_clan_id, clan_name, clan_id, source, changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.characterId,
    input.previousName,
    input.previousId,
    nextName,
    input.nextId,
    input.source,
    input.changedAt ?? new Date().toISOString(),
  );
}

export type ClanChangeRow = {
  id: number;
  character_id: number;
  character_name: string;
  previous_clan_name: string | null;
  clan_name: string;
  source: string;
  changed_at: string;
};

export function clanHistoryForCharacter(characterId: number, limit = 10): ClanChangeRow[] {
  return queryAll<ClanChangeRow>(
    `SELECT h.id, h.character_id, ch.name AS character_name,
            h.previous_clan_name, h.clan_name, h.source, h.changed_at
     FROM character_clan_history h
     JOIN characters ch ON ch.id = h.character_id
     WHERE h.character_id = ?
     ORDER BY h.changed_at DESC
     LIMIT ?`,
    characterId,
    limit,
  );
}

export function recentClanChanges(serverId: number, limit = 20): ClanChangeRow[] {
  return queryAll<ClanChangeRow>(
    `SELECT h.id, h.character_id, ch.name AS character_name,
            h.previous_clan_name, h.clan_name, h.source, h.changed_at
     FROM character_clan_history h
     JOIN characters ch ON ch.id = h.character_id
     WHERE ch.server_id = ?
     ORDER BY h.changed_at DESC
     LIMIT ?`,
    serverId,
    limit,
  );
}

export type ServerClanRow = {
  clan_id: number;
  clan_name: string;
  stance: ClanStance | null;
  members: number;
  total_power: number;
  top_power: number;
  last_seen_at: string | null;
};

/** Clãs que aparecem no ranking do servidor, com postura e força. */
export function listServerClans(serverId: number): ServerClanRow[] {
  return queryAll<ServerClanRow>(
    `SELECT c.id AS clan_id,
            c.name AS clan_name,
            r.stance AS stance,
            COUNT(ch.id) AS members,
            COALESCE(SUM(ch.power_score), 0) AS total_power,
            COALESCE(MAX(ch.power_score), 0) AS top_power,
            MAX(ch.last_seen_at) AS last_seen_at
     FROM characters ch
     JOIN clans c ON c.id = ch.clan_id
     LEFT JOIN clan_relations r ON r.server_id = ch.server_id AND r.clan_id = c.id
     WHERE ch.server_id = ?
     GROUP BY c.id
     ORDER BY CASE r.stance WHEN 'enemy' THEN 0 WHEN 'ally' THEN 1 WHEN 'neutral' THEN 2 ELSE 3 END,
              total_power DESC`,
    serverId,
  );
}

export function clanStanceCounts(serverId: number): { ally: number; neutral: number; enemy: number; unset: number } {
  const counts = { ally: 0, neutral: 0, enemy: 0, unset: 0 };
  const rows = queryAll<{ stance: ClanStance; total: number }>(
    "SELECT stance, COUNT(*) AS total FROM clan_relations WHERE server_id = ? GROUP BY stance",
    serverId,
  );
  for (const row of rows) counts[row.stance] = row.total;

  const total = queryOne<{ total: number }>(
    "SELECT COUNT(DISTINCT clan_id) AS total FROM characters WHERE server_id = ? AND clan_id IS NOT NULL",
    serverId,
  );
  const marked = counts.ally + counts.neutral + counts.enemy;
  counts.unset = Math.max(0, (total?.total ?? 0) - marked);
  return counts;
}

/** Postura de um clã em um servidor (nulo = ainda não classificada). */
export function stanceForClan(serverId: number, clanId: number): ClanStance | null {
  const row = queryOne<{ stance: ClanStance }>(
    "SELECT stance FROM clan_relations WHERE server_id = ? AND clan_id = ?",
    serverId,
    clanId,
  );
  return row?.stance ?? null;
}

/** Índice `${serverId}:${clanId}` → postura, para listas que misturam servidores. */
export function stanceIndex(serverIds: number[]): Map<string, ClanStance> {
  if (serverIds.length === 0) return new Map();
  const rows = queryAll<{ server_id: number; clan_id: number; stance: ClanStance }>(
    `SELECT server_id, clan_id, stance FROM clan_relations
     WHERE server_id IN (${serverIds.map(() => "?").join(",")})`,
    ...serverIds,
  );
  return new Map(rows.map((row) => [`${row.server_id}:${row.clan_id}`, row.stance]));
}

export type ClanOption = { id: number; name: string; members: number };

/** Clãs presentes no servidor, para os seletores de vínculo. */
export function clansInServer(serverId: number): ClanOption[] {
  return queryAll<ClanOption>(
    `SELECT c.id, c.name, COUNT(ch.id) AS members
     FROM clans c
     JOIN characters ch ON ch.clan_id = c.id
     WHERE ch.server_id = ?
     GROUP BY c.id
     ORDER BY c.name COLLATE NOCASE ASC`,
    serverId,
  );
}

/**
 * Absorve um clã variante em outro: move personagens, histórico e posturas,
 * registra o nome antigo como alias e apaga o registro duplicado.
 */
export function mergeClans(sourceId: number, targetId: number): { characters: number; relations: number } {
  if (sourceId === targetId) return { characters: 0, relations: 0 };
  const source = getClan(sourceId);
  const target = getClan(targetId);
  if (!source || !target) return { characters: 0, relations: 0 };

  return transaction(() => {
    const characters = execute(
      "UPDATE characters SET clan_id = ? WHERE clan_id = ?",
      target.id,
      source.id,
    ).changes;

    const relations = queryAll<{
      server_id: number;
      stance: ClanStance;
      notes: string | null;
      updated_by: number | null;
      updated_at: string;
    }>(
      "SELECT server_id, stance, notes, updated_by, updated_at FROM clan_relations WHERE clan_id = ?",
      source.id,
    );

    let moved = 0;
    for (const relation of relations) {
      moved += execute(
        `INSERT OR IGNORE INTO clan_relations (server_id, clan_id, stance, notes, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        relation.server_id,
        target.id,
        relation.stance,
        relation.notes,
        relation.updated_by,
        relation.updated_at,
      ).changes;
    }

    execute("UPDATE clan_aliases SET clan_id = ? WHERE clan_id = ?", target.id, source.id);
    execute(
      "INSERT OR REPLACE INTO clan_aliases (alias_key, clan_id) VALUES (?, ?)",
      source.name_key,
      target.id,
    );
    execute("UPDATE character_clan_history SET clan_id = ? WHERE clan_id = ?", target.id, source.id);
    execute("UPDATE character_clan_history SET previous_clan_id = ? WHERE previous_clan_id = ?", target.id, source.id);
    execute("DELETE FROM clan_relations WHERE clan_id = ?", source.id);
    execute("DELETE FROM clans WHERE id = ?", source.id);

    return { characters, relations: moved };
  });
}
