import { execute, getDb } from "./db";

/**
 * Manutenção do banco: o coletor diário grava uma linha de `power_history` para
 * cada jogador que mudou de poder e uma linha de `sync_runs` por servidor, o que
 * faria o SQLite crescer indefinidamente. Podar o que é antigo mantém o arquivo
 * estável (as páginas liberadas voltam a ser usadas pelos próximos syncs).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? fallback);
  return Number.isFinite(raw) ? Math.floor(raw) : fallback;
}

export type PruneResult = {
  powerRows: number;
  syncRuns: number;
  historyDays: number;
  runDays: number;
};

/** Remove histórico de poder e execuções de sync mais antigos que a retenção. */
export function pruneHistory(now: Date = new Date()): PruneResult {
  const historyDays = envInt("HISTORY_RETENTION_DAYS", 180);
  const runDays = envInt("SYNC_RUNS_RETENTION_DAYS", 60);
  const result: PruneResult = { powerRows: 0, syncRuns: 0, historyDays, runDays };

  if (historyDays > 0) {
    const cutoff = new Date(now.getTime() - historyDays * DAY_MS).toISOString();
    result.powerRows = execute("DELETE FROM power_history WHERE captured_at < ?", cutoff).changes;
  }

  if (runDays > 0) {
    const cutoff = new Date(now.getTime() - runDays * DAY_MS).toISOString();
    result.syncRuns = execute("DELETE FROM sync_runs WHERE started_at < ?", cutoff).changes;
  }

  return result;
}

/**
 * Devolve ao sistema de arquivos o espaço livre do banco. `VACUUM` reescreve o
 * arquivo inteiro e precisa de acesso exclusivo — rode com o site parado
 * (`pm2 stop` / `npm run compact`). O WAL é truncado no fim.
 */
export function compactDb(): void {
  const db = getDb();
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.exec("VACUUM");
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
}

/** Poda automática (sem VACUUM). Nunca lança: manutenção não pode derrubar o servidor. */
export function runMaintenance(context: string): void {
  try {
    const result = pruneHistory();
    if (result.powerRows > 0 || result.syncRuns > 0) {
      console.log(
        `[manutenção] ${context}: ${result.powerRows} histórico(s) de poder e ${result.syncRuns} ` +
          `execução(ões) antigas removidos (retenção ${result.historyDays}d / ${result.runDays}d).`,
      );
    }
    // Sem isso o arquivo -wal fica grande mesmo com poucas escritas.
    getDb().exec("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch (error) {
    console.error("[manutenção] falha ao podar histórico:", error);
  }
}
