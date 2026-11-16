import fs from "node:fs";
import path from "node:path";
import { getDb } from "../lib/db";
import { compactDb, pruneHistory } from "../lib/maintenance";

const dbFile = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "mir4.db");

function sizeOf(file: string): number {
  return fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0;
}

function totalSize(): number {
  return sizeOf(dbFile) + sizeOf(`${dbFile}-wal`) + sizeOf(`${dbFile}-shm`);
}

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const before = totalSize();
getDb();
const pruned = pruneHistory();
compactDb();
const after = totalSize();

console.log(`Banco: ${dbFile}`);
console.log(
  `Removidos ${pruned.powerRows} histórico(s) de poder (retenção ${pruned.historyDays}d) e ` +
    `${pruned.syncRuns} execução(ões) de sync (retenção ${pruned.runDays}d).`,
);
console.log(`Tamanho: ${mb(before)} -> ${mb(after)} (liberado ${mb(Math.max(before - after, 0))}).`);
