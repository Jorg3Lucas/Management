import { execute, queryAll } from "./db";
import type { SessionUser } from "./types";

export type AuditEntry = {
  id: number;
  user_id: number | null;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  server_id: number | null;
  server_label: string | null;
  detail: string | null;
  created_at: string;
};

/**
 * Registra uma alteração administrativa.
 * Nunca lança: auditoria não pode derrubar a operação que ela descreve.
 */
export function logAudit(input: {
  user?: Pick<SessionUser, "id" | "username"> | null;
  action: string;
  entity: string;
  entityId?: number | string | null;
  serverId?: number | null;
  detail?: string | null;
}): void {
  try {
    execute(
      `INSERT INTO audit_log (user_id, actor, action, entity, entity_id, server_id, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.user?.id ?? null,
      input.user?.username ?? null,
      input.action,
      input.entity,
      input.entityId === null || input.entityId === undefined ? null : String(input.entityId),
      input.serverId ?? null,
      input.detail ? input.detail.slice(0, 500) : null,
      new Date().toISOString(),
    );
  } catch (error) {
    console.error("[audit] falha ao registrar alteração:", error);
  }
}

export function recentAudit(limit = 150, serverIds?: number[]): AuditEntry[] {
  if (serverIds && serverIds.length === 0) return [];
  const filter = serverIds ? `WHERE a.server_id IN (${serverIds.map(() => "?").join(",")})` : "";
  return queryAll<AuditEntry>(
    `SELECT a.*, s.label AS server_label
     FROM audit_log a
     LEFT JOIN servers s ON s.id = a.server_id
     ${filter}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ?`,
    ...(serverIds ?? []),
    limit,
  );
}
