import { execute, queryAll, queryOne } from "./db";

/**
 * Darksteel e gold do castelo: o dono do servidor registra os lançamentos do
 * mês (quanto saiu e uma anotação livre), sem vincular nada a membros.
 */
export type CastleResourceEntry = {
  id: number;
  label: string;
  darksteel: number;
  gold: number;
  created_at: string;
};

export const CASTLE_RESOURCE_MAX = 1_000_000_000_000;
export const CASTLE_RESOURCE_LABEL_MAX = 80;

/** Lançamentos do mês, do mais antigo para o mais recente. */
export function castleResourceEntries(serverId: number, monthStart: string): CastleResourceEntry[] {
  const rows = queryAll<{
    id: number;
    label: string | null;
    darksteel: number;
    gold: number;
    created_at: string;
  }>(
    `SELECT id, label, darksteel, gold, created_at
     FROM castle_resource_entries
     WHERE server_id = ? AND month_start = ?
     ORDER BY created_at ASC, id ASC`,
    serverId,
    monthStart,
  );

  // O driver do SQLite devolve objetos com protótipo nulo.
  return rows.map((row) => ({
    id: row.id,
    label: row.label ?? "",
    darksteel: row.darksteel,
    gold: row.gold,
    created_at: row.created_at,
  }));
}

/** Momento do último lançamento do mês (null quando não há nenhum). */
export function castleResourceUpdatedAt(serverId: number, monthStart: string): string | null {
  const row = queryOne<{ updated_at: string | null }>(
    "SELECT MAX(created_at) AS updated_at FROM castle_resource_entries WHERE server_id = ? AND month_start = ?",
    serverId,
    monthStart,
  );
  return row?.updated_at ?? null;
}

export type CastleResourceResult = { ok: true } | { ok: false; error: string };

/** Registra um lançamento da distribuição do mês. */
export function addCastleResourceEntry(input: {
  serverId: number;
  monthStart: string;
  userId: number;
  label: string;
  darksteel: number;
  gold: number;
}): CastleResourceResult {
  const darksteel = Math.trunc(Number(input.darksteel));
  const gold = Math.trunc(Number(input.gold));

  if (!Number.isFinite(darksteel) || !Number.isFinite(gold) || darksteel < 0 || gold < 0) {
    return { ok: false, error: "Informe apenas valores positivos em darksteel e gold." };
  }
  if (darksteel > CASTLE_RESOURCE_MAX || gold > CASTLE_RESOURCE_MAX) {
    return { ok: false, error: "Valor acima do limite permitido." };
  }
  if (darksteel === 0 && gold === 0) {
    return { ok: false, error: "Informe darksteel ou gold no lançamento." };
  }

  execute(
    `INSERT INTO castle_resource_entries
       (server_id, month_start, label, darksteel, gold, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.serverId,
    input.monthStart,
    input.label,
    darksteel,
    gold,
    input.userId,
    new Date().toISOString(),
  );

  return { ok: true };
}

/** Remove um lançamento do mês; recusa se ele não pertence a esse servidor/mês. */
export function removeCastleResourceEntry(input: {
  serverId: number;
  monthStart: string;
  entryId: number;
}): CastleResourceResult {
  const row = queryOne<{ id: number }>(
    "SELECT id FROM castle_resource_entries WHERE id = ? AND server_id = ? AND month_start = ?",
    input.entryId,
    input.serverId,
    input.monthStart,
  );
  if (!row) return { ok: false, error: "Lançamento não encontrado neste mês." };

  execute("DELETE FROM castle_resource_entries WHERE id = ?", input.entryId);
  return { ok: true };
}
