import { execute, queryAll } from "./db";
import { MAX_SLOT_MEMBERS, WORLD_BOSS_SLOT_KEYS } from "./world-boss-maps";

const VALID_KEYS = new Set(WORLD_BOSS_SLOT_KEYS);
const NAME_MAX = 40;

function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

function cleanMembers(members: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const member of members) {
    const name = cleanName(member);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(name);
    if (cleaned.length === MAX_SLOT_MEMBERS) break;
  }
  return cleaned;
}

/** Escalação de todos os mapas, por chave do mapa. */
export function listSlotMembers(): Map<string, string[]> {
  const rows = queryAll<{ slot_key: string; member_name: string }>(
    "SELECT slot_key, member_name FROM world_boss_distribution ORDER BY slot_key, position",
  );
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.slot_key);
    if (list) list.push(row.member_name);
    else map.set(row.slot_key, [row.member_name]);
  }
  return map;
}

/**
 * Substitui os membros de um mapa/horário. Devolve a lista como ficou salva
 * (sem duplicados, no máximo 3) ou `null` se a chave do mapa não existir.
 */
export function saveSlotMembers(slotKey: string, members: string[]): string[] | null {
  if (!VALID_KEYS.has(slotKey)) return null;

  const cleaned = cleanMembers(members);
  const now = new Date().toISOString();

  execute("DELETE FROM world_boss_distribution WHERE slot_key = ?", slotKey);
  cleaned.forEach((member, position) => {
    execute(
      "INSERT INTO world_boss_distribution (slot_key, position, member_name, updated_at) VALUES (?, ?, ?, ?)",
      slotKey,
      position,
      member,
      now,
    );
  });

  return cleaned;
}

/** Nomes conhecidos para sugerir no campo de membro (personagens do ranking). */
export function listMemberSuggestions(limit = 500): string[] {
  const rows = queryAll<{ name: string }>(
    "SELECT DISTINCT name FROM characters WHERE gone_at IS NULL ORDER BY name LIMIT ?",
    limit,
  );
  return rows.map((row) => row.name);
}
