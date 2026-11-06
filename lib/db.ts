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

    CREATE TABLE IF NOT EXISTS clans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clan_aliases (
      alias_key TEXT PRIMARY KEY,
      clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clan_relations (
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
      stance TEXT NOT NULL CHECK (stance IN ('ally', 'neutral', 'enemy')),
      notes TEXT,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (server_id, clan_id)
    );

    CREATE TABLE IF NOT EXISTS server_territories (
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      territory TEXT NOT NULL,
      clan_id INTEGER REFERENCES clans(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (server_id, territory)
    );

    CREATE TABLE IF NOT EXISTS territory_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      territory TEXT NOT NULL,
      previous_clan_id INTEGER REFERENCES clans(id) ON DELETE SET NULL,
      previous_clan_name TEXT,
      clan_id INTEGER REFERENCES clans(id) ON DELETE SET NULL,
      clan_name TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_territory_history_server ON territory_history (server_id, changed_at DESC);

    CREATE TABLE IF NOT EXISTS sabuk_wins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
      won_on TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      UNIQUE (server_id, won_on)
    );

    CREATE INDEX IF NOT EXISTS idx_sabuk_wins_server ON sabuk_wins (server_id, won_on DESC);

    CREATE TABLE IF NOT EXISTS character_clan_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      previous_clan_name TEXT,
      previous_clan_id INTEGER REFERENCES clans(id) ON DELETE SET NULL,
      clan_name TEXT NOT NULL,
      clan_id INTEGER REFERENCES clans(id) ON DELETE SET NULL,
      source TEXT NOT NULL,
      changed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_clan_history_character ON character_clan_history (character_id, changed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_clan_history_changed ON character_clan_history (changed_at DESC);

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (server_id, name)
    );

    CREATE TABLE IF NOT EXISTS clan_teams (
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      clan_id INTEGER NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (server_id, clan_id)
    );

    CREATE INDEX IF NOT EXISTS idx_clan_teams_team ON clan_teams (team_id);

    CREATE TABLE IF NOT EXISTS salary_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      label TEXT,
      starts_on TEXT NOT NULL,
      ends_on TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      UNIQUE (server_id, starts_on)
    );

    CREATE INDEX IF NOT EXISTS idx_salary_periods_server ON salary_periods (server_id, starts_on DESC);

    CREATE TABLE IF NOT EXISTS salary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL REFERENCES salary_periods(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('production', 'fixed')),
      slot INTEGER,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_salary_entries_period ON salary_entries (period_id, kind);

    CREATE TABLE IF NOT EXISTS salary_members (
      period_id INTEGER NOT NULL REFERENCES salary_periods(id) ON DELETE CASCADE,
      character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      tier TEXT NOT NULL DEFAULT 'A',
      share_percent INTEGER NOT NULL DEFAULT 100,
      attended_heist INTEGER NOT NULL DEFAULT 0,
      attended_altar INTEGER NOT NULL DEFAULT 0,
      attended_vale INTEGER NOT NULL DEFAULT 0,
      preference TEXT NOT NULL DEFAULT 'darksteel',
      stone_split TEXT NOT NULL DEFAULT 'half',
      note TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (period_id, character_id)
    );

    CREATE INDEX IF NOT EXISTS idx_salary_members_character ON salary_members (character_id);

    CREATE TABLE IF NOT EXISTS salary_tiers (
      server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      tier TEXT NOT NULL,
      weight REAL NOT NULL,
      min_power INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (server_id, tier)
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_key TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      home_server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS server_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      from_server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
      to_server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      detected_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
      source TEXT NOT NULL DEFAULT 'sync',
      confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      decided_at TEXT,
      note TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_server_moves_status ON server_moves (status, detected_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_server_moves_pending ON server_moves (player_id, to_server_id)
      WHERE status = 'pending';

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      server_id INTEGER REFERENCES servers(id) ON DELETE SET NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);
  `);

  // Colunas adicionadas depois da primeira versão do schema.
  ensureColumn(db, "characters", "clan_id", "INTEGER REFERENCES clans(id)");
  ensureColumn(db, "characters", "player_id", "INTEGER REFERENCES players(id)");
  ensureColumn(db, "characters", "team_id", "INTEGER REFERENCES teams(id) ON DELETE SET NULL");
  ensureColumn(db, "user_servers", "role", "TEXT NOT NULL DEFAULT 'editor'");
  ensureColumn(db, "salary_entries", "slot", "INTEGER");
  ensureColumn(db, "salary_members", "preference", "TEXT NOT NULL DEFAULT 'darksteel'");
  ensureColumn(db, "salary_members", "stone_split", "TEXT NOT NULL DEFAULT 'half'");
  ensureColumn(db, "salary_members", "attended_heist", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "salary_members", "attended_altar", "INTEGER NOT NULL DEFAULT 0");
  const valeAdded = ensureColumn(db, "salary_members", "attended_vale", "INTEGER NOT NULL DEFAULT 0");
  const powerAdded = ensureColumn(db, "salary_tiers", "min_power", "INTEGER NOT NULL DEFAULT 0");

  // Presença única antiga vira presença no vale; faixas criadas antes ganham o poder mínimo padrão.
  if (valeAdded && hasColumn(db, "salary_members", "attended")) {
    db.exec("UPDATE salary_members SET attended_vale = attended");
  }
  if (powerAdded) {
    db.exec("UPDATE salary_tiers SET min_power = 500000 WHERE tier = 'A'");
    db.exec("UPDATE salary_tiers SET min_power = 450000 WHERE tier = 'B'");
    db.exec("UPDATE salary_tiers SET min_power = 390000 WHERE tier = 'C'");
    db.exec("UPDATE salary_tiers SET min_power = 350000 WHERE tier = 'D'");
    db.exec("UPDATE salary_tiers SET min_power = 0 WHERE tier = 'E'");
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_characters_clan ON characters (server_id, clan_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_characters_player ON characters (player_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_clan_relations_server ON clan_relations (server_id, stance)");
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_entries_slot ON salary_entries (period_id, slot) WHERE slot IS NOT NULL",
  );
  backfillSalarySlots(db);

  // Transferência não passa mais por aprovação: pendências antigas são aplicadas agora.
  confirmLegacyPendingMoves(db);
}

function confirmLegacyPendingMoves(db: DatabaseSync): void {
  const pending = db
    .prepare("SELECT id, player_id, to_server_id, detected_at FROM server_moves WHERE status = 'pending' ORDER BY detected_at ASC")
    .all() as unknown as { id: number; player_id: number; to_server_id: number; detected_at: string }[];
  if (pending.length === 0) return;

  const now = new Date().toISOString();
  const confirm = db.prepare("UPDATE server_moves SET status = 'confirmed', decided_at = ? WHERE id = ?");
  const moveHome = db.prepare("UPDATE players SET home_server_id = ?, updated_at = ? WHERE id = ?");
  for (const move of pending) {
    confirm.run(move.detected_at, move.id);
    moveHome.run(move.to_server_id, now, move.player_id);
  }
}

/** Lançamentos de produção antigos (antes dos três vales) recebem os espaços livres. */
function backfillSalarySlots(db: DatabaseSync): void {
  const rows = db
    .prepare(
      "SELECT id, period_id FROM salary_entries WHERE kind = 'production' AND slot IS NULL ORDER BY period_id, id",
    )
    .all() as unknown as { id: number; period_id: number }[];
  if (rows.length === 0) return;

  const update = db.prepare("UPDATE salary_entries SET slot = ? WHERE id = ?");
  const used = new Map<number, Set<number>>();
  for (const row of rows) {
    let taken = used.get(row.period_id);
    if (!taken) {
      const existing = db
        .prepare("SELECT slot FROM salary_entries WHERE period_id = ? AND slot IS NOT NULL")
        .all(row.period_id) as unknown as { slot: number }[];
      taken = new Set(existing.map((entry) => entry.slot));
      used.set(row.period_id, taken);
    }
    const slot = [1, 2, 3].find((candidate) => !taken.has(candidate));
    if (slot === undefined) continue;
    taken.add(slot);
    update.run(slot, row.id);
  }
}

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

/** Adiciona a coluna se faltar; retorna true quando ela acabou de ser criada. */
function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string): boolean {
  if (hasColumn(db, table, column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
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
