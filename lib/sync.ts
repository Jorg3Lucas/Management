import { execute, queryAll, queryOne, transaction } from "./db";
import { fetchRankingPage, isRankingEmptyMessage, parseForumRanking, type RankingRow } from "./mir4/forum";
import { ensureClan, logClanChange, normalizeClanKey } from "./clans";
import { detectServerMove, linkCharacterPlayer } from "./players";
import { getServerById } from "./queries";
import type { ClanRow, ServerRow } from "./types";

export type SyncStatus = "success" | "empty" | "error";

export type SyncResult = {
  serverId: number;
  serverCode: string;
  serverLabel: string;
  status: SyncStatus;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  pages: number;
  durationMs: number;
  message: string | null;
};

type SyncCounts = { created: number; updated: number; skipped: number };

function maxPages(): number {
  const value = Number(process.env.SYNC_MAX_PAGES ?? 10);
  if (!Number.isFinite(value)) return 10;
  return Math.min(Math.max(Math.floor(value), 1), 50);
}

function pageDelayMs(): number {
  const value = Number(process.env.SYNC_DELAY_MS ?? 400);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 10_000) : 400;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function upsertRanking(serverId: number, rows: RankingRow[]): SyncCounts {
  const now = new Date().toISOString();
  // O mesmo clã aparece centenas de vezes por rodada: resolve uma vez por nome.
  const clanCache = new Map<string, ClanRow | null>();
  const resolveClan = (name: string | null): ClanRow | null => {
    const key = normalizeClanKey(name ?? "");
    if (!key) return null;
    if (!clanCache.has(key)) clanCache.set(key, ensureClan(name ?? ""));
    return clanCache.get(key) ?? null;
  };

  return transaction(() => {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const existing = queryOne<{
        id: number;
        clan: string | null;
        clan_id: number | null;
        player_id: number | null;
        power_score: number;
        peak_power: number;
        peak_power_at: string | null;
        sync_locked: number;
      }>(
        `SELECT id, clan, clan_id, player_id, power_score, peak_power, peak_power_at, sync_locked
         FROM characters WHERE server_id = ? AND name = ?`,
        serverId,
        row.name,
      );

      const clanRow = resolveClan(row.clan);

      if (!existing) {
        const inserted = execute(
          `INSERT INTO characters
            (server_id, name, clan, clan_id, class_name, level, power_score, peak_power, peak_power_at,
             rank_position, notes, sync_locked, last_seen_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, 0, ?, ?, ?)`,
          serverId,
          row.name,
          row.clan,
          clanRow?.id ?? null,
          row.power,
          row.power,
          now,
          row.rank,
          now,
          now,
          now,
        );
        execute(
          `INSERT INTO power_history (character_id, power_score, rank_position, source, captured_at)
           VALUES (?, ?, ?, 'sync', ?)`,
          inserted.lastInsertRowid,
          row.power,
          row.rank,
          now,
        );
        try {
          const player = linkCharacterPlayer(inserted.lastInsertRowid, row.name, serverId);
          if (player) detectServerMove(player.id, serverId);
        } catch (error) {
          console.error("[sync] falha ao vincular jogador/transferência:", error);
        }

        created += 1;
        continue;
      }

      if (existing.sync_locked) {
        execute("UPDATE characters SET last_seen_at = ? WHERE id = ?", now, existing.id);
        skipped += 1;
        continue;
      }

      const isNewPeak = row.power > existing.peak_power;
      execute(
        `UPDATE characters
         SET clan = COALESCE(?, clan),
             clan_id = COALESCE(?, clan_id),
             power_score = ?,
             rank_position = ?,
             peak_power = ?,
             peak_power_at = ?,
             last_seen_at = ?,
             updated_at = ?
         WHERE id = ?`,
        row.clan,
        clanRow?.id ?? null,
        row.power,
        row.rank,
        Math.max(existing.peak_power, row.power),
        isNewPeak ? now : existing.peak_power_at,
        now,
        now,
        existing.id,
      );

      if (row.clan && normalizeClanKey(row.clan) !== normalizeClanKey(existing.clan ?? "")) {
        logClanChange({
          characterId: existing.id,
          previousName: existing.clan,
          previousId: existing.clan_id,
          nextName: row.clan,
          nextId: clanRow?.id ?? null,
          source: "sync",
          changedAt: now,
        });
      }

      if (existing.player_id === null) {
        try {
          linkCharacterPlayer(existing.id, row.name, serverId);
        } catch (error) {
          console.error("[sync] falha ao vincular jogador:", error);
        }
      }

      if (existing.power_score !== row.power) {
        execute(
          `INSERT INTO power_history (character_id, power_score, rank_position, source, captured_at)
           VALUES (?, ?, ?, 'sync', ?)`,
          existing.id,
          row.power,
          row.rank,
          now,
        );
      }

      updated += 1;
    }

    return { created, updated, skipped };
  });
}

function recordRun(input: {
  serverId: number;
  status: SyncStatus;
  source: string;
  fetched: number;
  counts: SyncCounts;
  message: string | null;
  startedAt: string;
}): void {
  const finishedAt = new Date().toISOString();

  execute(
    `INSERT INTO sync_runs
     (server_id, status, source, rows_fetched, rows_created, rows_updated, message, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.serverId,
    input.status,
    input.source,
    input.fetched,
    input.counts.created,
    input.counts.updated,
    input.message,
    input.startedAt,
    finishedAt,
  );

  execute(
    `UPDATE servers SET last_sync_at = ?, last_sync_status = ?, last_sync_message = ? WHERE id = ?`,
    finishedAt,
    input.status,
    input.message,
    input.serverId,
  );
}

/**
 * Lê o ranking do servidor no fórum oficial e faz upsert dos personagens.
 * Nunca lança: erros são registrados em sync_runs e devolvidos no resultado.
 */
export async function syncServer(
  serverId: number,
  options: { source?: string; maxPages?: number | undefined } = {},
): Promise<SyncResult> {
  const server = getServerById(serverId);
  if (!server) {
    throw new Error(`Servidor ${serverId} não encontrado.`);
  }

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const limit = options.maxPages ?? maxPages();
  const delay = pageDelayMs();
  const source = options.source ?? "forum";

  let fetched = 0;
  let pages = 0;
  let message: string | null = null;

  try {
    const byName = new Map<string, RankingRow>();
    let emptyMessage: string | null = null;

    for (let page = 1; page <= limit; page++) {
      const html = await fetchRankingPage(server, page);
      pages = page;

      if (page === 1 && isRankingEmptyMessage(html) && parseForumRanking(html).length === 0) {
        emptyMessage = "O fórum ainda está compilando o ranking deste servidor.";
      }

      const pageRows = parseForumRanking(html);
      for (const row of pageRows) {
        if (!byName.has(row.name)) byName.set(row.name, row);
      }
      fetched = byName.size;

      if (pageRows.length < 100) break;
      if (page < limit) await sleep(delay);
    }

    const rows = [...byName.values()];
    if (rows.length === 0) {
      const empty = emptyMessage ?? "Nenhum personagem retornado pelo fórum (ranking vazio ou formato mudou).";
      recordRun({
        serverId,
        status: "empty",
        source,
        fetched: 0,
        counts: { created: 0, updated: 0, skipped: 0 },
        message: empty,
        startedAt,
      });
      return {
        serverId,
        serverCode: server.code,
        serverLabel: server.label,
        status: "empty",
        fetched: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        pages,
        durationMs: Date.now() - startedMs,
        message: empty,
      };
    }

    const counts = upsertRanking(serverId, rows);
    message = `${counts.created} novo(s), ${counts.updated} atualizado(s)${
      counts.skipped ? `, ${counts.skipped} protegido(s) contra sync` : ""
    }.`;

    recordRun({
      serverId,
      status: "success",
      source,
      fetched,
      counts,
      message,
      startedAt,
    });

    return {
      serverId,
      serverCode: server.code,
      serverLabel: server.label,
      status: "success",
      fetched,
      ...counts,
      pages,
      durationMs: Date.now() - startedMs,
      message,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    message = detail.slice(0, 500);
    recordRun({
      serverId,
      status: "error",
      source,
      fetched,
      counts: { created: 0, updated: 0, skipped: 0 },
      message,
      startedAt,
    });

    return {
      serverId,
      serverCode: server.code,
      serverLabel: server.label,
      status: "error",
      fetched,
      created: 0,
      updated: 0,
      skipped: 0,
      pages,
      durationMs: Date.now() - startedMs,
      message,
    };
  }
}

export function enabledServers(): ServerRow[] {
  return queryAll<ServerRow>(
    "SELECT * FROM servers WHERE sync_enabled = 1 ORDER BY is_focus DESC, code",
  );
}

export async function syncEnabledServers(source = "agendado"): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const server of enabledServers()) {
    results.push(await syncServer(server.id, { source }));
  }
  return results;
}

export function allServers(): ServerRow[] {
  return queryAll<ServerRow>("SELECT * FROM servers ORDER BY is_focus DESC, code");
}

/** Sincroniza todos os servidores publicados, habilitados ou não. */
export async function syncAllServers(source = "agendado"): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const server of allServers()) {
    results.push(await syncServer(server.id, { source }));
  }
  return results;
}
