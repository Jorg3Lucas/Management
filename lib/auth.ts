import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { execute, queryAll, queryOne } from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { Role, ServerRow, SessionUser, UserRow } from "./types";

const COOKIE_NAME = "mir4_session";
const SESSION_DAYS = 7;

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  execute(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    token,
    userId,
    createdAt.toISOString(),
    expiresAt.toISOString(),
  );

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) execute("DELETE FROM sessions WHERE token = ?", token);
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const row = queryOne<{
    id: number;
    username: string;
    display_name: string;
    role: Role;
    active: number;
  }>(
    `SELECT u.id, u.username, u.display_name, u.role, u.active
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token,
    new Date().toISOString(),
  );

  if (!row || !row.active) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/?error=" + encodeURIComponent("Acesso restrito a administradores."));
  return user;
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN";
}

/** IDs de servidores que o usuário pode ver/editar. Admin vê todos. */
export function accessibleServerIds(user: SessionUser): number[] {
  if (user.role === "ADMIN") {
    return queryAll<{ id: number }>("SELECT id FROM servers ORDER BY id").map((row) => row.id);
  }
  return queryAll<{ server_id: number }>(
    "SELECT server_id FROM user_servers WHERE user_id = ? ORDER BY server_id",
    user.id,
  ).map((row) => row.server_id);
}

export function accessibleServers(user: SessionUser): ServerRow[] {
  if (user.role === "ADMIN") {
    return queryAll<ServerRow>(
      `SELECT * FROM servers
       ORDER BY is_focus DESC, CASE WHEN group_name = 'EU1' THEN 0 ELSE 1 END, group_name, code`,
    );
  }
  return queryAll<ServerRow>(
    `SELECT s.* FROM servers s
     JOIN user_servers us ON us.server_id = s.id
     WHERE us.user_id = ?
     ORDER BY s.is_focus DESC, CASE WHEN s.group_name = 'EU1' THEN 0 ELSE 1 END, s.group_name, s.code`,
    user.id,
  );
}

export function canAccessServer(user: SessionUser, serverId: number): boolean {
  if (user.role === "ADMIN") return true;
  const row = queryOne<{ server_id: number }>(
    "SELECT server_id FROM user_servers WHERE user_id = ? AND server_id = ?",
    user.id,
    serverId,
  );
  return Boolean(row);
}

export function assertServerAccess(user: SessionUser, serverId: number): void {
  if (!canAccessServer(user, serverId)) {
    redirect("/players?error=" + encodeURIComponent("Você não tem acesso a esse servidor."));
  }
}

export function listUsers(): (UserRow & { server_count: number })[] {
  return queryAll<UserRow & { server_count: number }>(
    `SELECT u.*, COUNT(us.server_id) AS server_count
     FROM users u
     LEFT JOIN user_servers us ON us.user_id = u.id
     GROUP BY u.id
     ORDER BY u.role = 'ADMIN' DESC, u.username`,
  );
}

export function userServerIds(userId: number): number[] {
  return queryAll<{ server_id: number }>(
    "SELECT server_id FROM user_servers WHERE user_id = ?",
    userId,
  ).map((row) => row.server_id);
}

export function getUserById(id: number): UserRow | undefined {
  return queryOne<UserRow>("SELECT * FROM users WHERE id = ?", id);
}

export function countAdmins(): number {
  const row = queryOne<{ total: number }>("SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' AND active = 1");
  return row?.total ?? 0;
}

export function createUser(input: {
  username: string;
  displayName: string;
  password: string;
  role: Role;
}): number {
  const result = execute(
    `INSERT INTO users (username, display_name, password_hash, role, active, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
    input.username,
    input.displayName,
    hashPassword(input.password),
    input.role,
    new Date().toISOString(),
  );
  return result.lastInsertRowid;
}

export function setUserServers(userId: number, serverIds: number[]): void {
  execute("DELETE FROM user_servers WHERE user_id = ?", userId);
  for (const serverId of serverIds) {
    execute("INSERT OR IGNORE INTO user_servers (user_id, server_id) VALUES (?, ?)", userId, serverId);
  }
}

export function resetUserPassword(userId: number, password: string): void {
  execute(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    hashPassword(password),
    userId,
  );
  // Derruba sessões antigas do usuário.
  execute("DELETE FROM sessions WHERE user_id = ?", userId);
}

export function setUserActive(userId: number, active: boolean): void {
  execute("UPDATE users SET active = ? WHERE id = ?", active ? 1 : 0, userId);
  if (!active) execute("DELETE FROM sessions WHERE user_id = ?", userId);
}

export function verifyCredentials(username: string, password: string): UserRow | null {
  const user = queryOne<UserRow & { password_hash: string }>(
    "SELECT * FROM users WHERE username = ? COLLATE NOCASE",
    username,
  );
  if (!user || !user.active) return null;
  return verifyPassword(password, user.password_hash) ? user : null;
}
