import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "./password";
import { FOCUS_CODES, FORUM_SERVERS, serverLabel } from "./mir4/servers";

type Param = string | number | null;

const globalForDb = globalThis as unknown as { __mir4db?: DatabaseSync };

function dbPath(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "mir4.db");
}

export function getDb(): DatabaseSync {
  if (globalForDb.__mir4db) return globalForDb.__mir4db;

  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  seed(db);

  globalForDb.__mir4db = db;
  return db;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      group_name TEXT NOT NULL,
      worldgroup_id INTEGER NOT NULL,
      world_id INTEGER NOT NULL,
      is_focus INTEGER NOT NULL DEFAULT 0,
      sync_enabled INTEGER NOT NULL DEFAULT 0,
      last_sync_at TEXT,
      last_sync_status TEXT,
      last_sync_message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'USER')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_servers (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, server_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      clan TEXT,
      class_name TEXT,
      level INTEGER,
      power_score INTEGER NOT NULL DEFAULT 0,
      peak_power INTEGER NOT NULL DEFAULT 0,
      peak_power_at TEXT,
      rank_position INTEGER,
      notes TEXT,
      sync_locked INTEGER NOT NULL DEFAULT 0,
      last_seen_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (server_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_characters_server_power ON characters (server_id, power_score DESC);
    CREATE INDEX IF NOT EXISTS idx_characters_name ON characters (name);

    CREATE TABLE IF NOT EXISTS power_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      power_score INTEGER NOT NULL,
      rank_position INTEGER,
      source TEXT NOT NULL,
      captured_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_power_history_character ON power_history (character_id, captured_at DESC);

    CREATE TABLE IF NOT EXISTS war_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      server_id INTEGER NOT NULL REFERENCES servers(id),
      war_type TEXT NOT NULL DEFAULT 'server_war',
      opponent TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_war_sessions_character ON war_sessions (character_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_war_sessions_server ON war_sessions (server_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_war_sessions_open ON war_sessions (ended_at);

    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      rows_fetched INTEGER NOT NULL DEFAULT 0,
      rows_created INTEGER NOT NULL DEFAULT 0,
      rows_updated INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON sync_runs (started_at DESC);
  `);
}

function seed(db: DatabaseSync) {
  const now = new Date().toISOString();

  const upsertServer = db.prepare(`
    INSERT INTO servers (code, label, group_name, worldgroup_id, world_id, is_focus, sync_enabled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      label = excluded.label,
      group_name = excluded.group_name,
      worldgroup_id = excluded.worldgroup_id,
      world_id = excluded.world_id
  `);

  for (const server of FORUM_SERVERS) {
    const focused = FOCUS_CODES.includes(server.code) ? 1 : 0;
    upsertServer.run(
      server.code,
      serverLabel(server.code),
      server.groupName,
      server.worldgroupId,
      server.worldId,
      focused,
      focused,
      now,
    );
  }

  const userCount = db.prepare("SELECT COUNT(*) AS total FROM users").get() as { total: number };
  if (userCount.total === 0) {
    const password = process.env.ADMIN_PASSWORD || "admin123";
    db.prepare(
      `INSERT INTO users (username, display_name, password_hash, role, active, created_at)
       VALUES (?, ?, ?, 'ADMIN', 1, ?)`,
    ).run("admin", "Administrador", hashPassword(password), now);
  }

  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
}

export function queryAll<T>(sql: string, ...params: Param[]): T[] {
  const stmt = getDb().prepare(sql);
  return stmt.all(...params) as unknown as T[];
}

export function queryOne<T>(sql: string, ...params: Param[]): T | undefined {
  const stmt = getDb().prepare(sql);
  return stmt.get(...params) as unknown as T | undefined;
}

export function execute(sql: string, ...params: Param[]): { changes: number; lastInsertRowid: number } {
  const stmt = getDb().prepare(sql);
  const result = stmt.run(...params);
  return {
    changes: Number(result.changes),
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
