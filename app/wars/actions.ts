"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEditServer, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { execute, transaction } from "@/lib/db";
import { WAR_TYPES } from "@/lib/format";
import { getT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/pt";
import { getCharacterWithServer, getServerById, warGroupSessions } from "@/lib/queries";
import { zonedInputToUtc } from "@/lib/time";
import type { SessionUser } from "@/lib/types";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const raw = String(value ?? "").trim();
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

type T = Awaited<ReturnType<typeof getT>>["t"];

type WarInput = {
  characterIds: number[];
  serverId: number;
  warType: string;
  started: Date;
  ended: Date | null;
  opponent: string | null;
  notes: string | null;
};

function parseWarForm(formData: FormData, t: T): { war: WarInput } | { error: string } {
  const warServerId = Number(formData.get("warServerId"));
  if (!getServerById(warServerId)) return { error: t("war.errServer") };

  const warType = String(formData.get("warType") ?? "server_war");
  if (!(warType in WAR_TYPES)) return { error: t("war.errType") };

  const started = zonedInputToUtc(String(formData.get("startedAt") ?? ""));
  if (!started) return { error: t("war.errStart") };

  const endedRaw = String(formData.get("endedAt") ?? "").trim();
  const ended = endedRaw ? zonedInputToUtc(endedRaw) : null;
  if (endedRaw && !ended) return { error: t("war.errEnd") };
  if (ended && ended.getTime() <= started.getTime()) return { error: t("war.errEndOrder") };

  const characterIds = [
    ...new Set(
      formData
        .getAll("characterIds")
        .map((value) => Number(value))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (characterIds.length === 0) return { error: t("war.errPlayers") };

  return {
    war: {
      characterIds,
      serverId: warServerId,
      warType,
      started,
      ended,
      opponent: cleanText(formData.get("opponent"), 60) || null,
      notes: String(formData.get("notes") ?? "").trim().slice(0, 2000) || null,
    },
  };
}

/** Confere o servidor da guerra e o servidor casa de cada jogador. */
function checkPermissions(
  user: SessionUser,
  war: WarInput,
  allowed: Set<number> = new Set(),
): { error?: MessageKey } {
  if (!canEditServer(user, war.serverId)) return { error: "war.errServer" };
  for (const characterId of war.characterIds) {
    const character = getCharacterWithServer(characterId);
    if (!character) return { error: "war.errPlayer" };
    // Quem já está na guerra continua valendo mesmo sem permissão no servidor casa.
    if (!allowed.has(characterId) && !canEditServer(user, character.server_id)) {
      return { error: "war.errPlayer" };
    }
  }
  return {};
}

function insertSession(war: WarInput, characterId: number, userId: number, now: string): void {
  execute(
    `INSERT INTO war_sessions
      (character_id, server_id, war_type, opponent, started_at, ended_at, notes, source, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
    characterId,
    war.serverId,
    war.warType,
    war.opponent,
    war.started.toISOString(),
    war.ended ? war.ended.toISOString() : null,
    war.notes,
    userId,
    now,
  );
}

function revalidateWars(): void {
  revalidatePath("/wars");
  revalidatePath("/players");
  revalidatePath("/");
}

export async function createWarAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const { t } = await getT();
  const parsed = parseWarForm(formData, t);
  if ("error" in parsed) redirect(back("/wars", "error", parsed.error));

  const { war } = parsed;
  const permissions = checkPermissions(user, war);
  if (permissions.error) redirect(back("/wars", "error", t(permissions.error)));

  const now = new Date().toISOString();
  transaction(() => {
    for (const characterId of war.characterIds) insertSession(war, characterId, user.id, now);
  });

  logAudit({
    user,
    action: "war.create",
    entity: "war",
    entityId: war.characterIds[0],
    serverId: war.serverId,
    detail: `${war.warType} · ${war.characterIds.length} jogador(es)${war.opponent ? ` vs ${war.opponent}` : ""}`,
  });

  revalidateWars();
  redirect(back("/wars", "ok", t("war.created", { count: war.characterIds.length })));
}

export async function updateWarAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const { t } = await getT();
  const sessionId = Number(formData.get("sessionId"));
  const group = warGroupSessions(sessionId);
  const editPath = `/wars/${sessionId}`;

  if (group.length === 0) redirect(back("/wars", "error", t("war.notFound")));

  const parsed = parseWarForm(formData, t);
  if ("error" in parsed) redirect(back(editPath, "error", parsed.error));

  const { war } = parsed;
  const current = new Set(group.map((session) => session.character_id));
  const permissions = checkPermissions(user, war, current);
  if (permissions.error) redirect(back(editPath, "error", t(permissions.error)));

  const keep = new Set(war.characterIds);
  const now = new Date().toISOString();

  transaction(() => {
    for (const session of group) {
      if (keep.has(session.character_id)) {
        execute(
          `UPDATE war_sessions
           SET server_id = ?, war_type = ?, opponent = ?, started_at = ?, ended_at = ?, notes = ?
           WHERE id = ?`,
          war.serverId,
          war.warType,
          war.opponent,
          war.started.toISOString(),
          war.ended ? war.ended.toISOString() : null,
          war.notes,
          session.id,
        );
      } else {
        execute("DELETE FROM war_sessions WHERE id = ?", session.id);
      }
    }
    for (const characterId of war.characterIds) {
      if (!current.has(characterId)) insertSession(war, characterId, user.id, now);
    }
  });

  logAudit({
    user,
    action: "war.update",
    entity: "war",
    entityId: sessionId,
    serverId: war.serverId,
    detail: `${war.warType} · ${war.characterIds.length} jogador(es)${war.opponent ? ` vs ${war.opponent}` : ""}`,
  });

  revalidateWars();
  redirect(back(editPath, "ok", t("war.updated", { count: war.characterIds.length })));
}

export async function endWarGroupAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const { t } = await getT();
  const sessionId = Number(formData.get("sessionId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/wars");
  const group = warGroupSessions(sessionId);

  if (group.length === 0) redirect(back(redirectTo, "error", t("war.notFound")));
  if (!canEditServer(user, group[0].server_id)) {
    redirect(back(redirectTo, "error", t("war.noPermission")));
  }

  const open = group.filter((session) => !session.ended_at);
  if (open.length === 0) redirect(back(redirectTo, "error", t("war.alreadyEnded")));

  const now = new Date();
  if (now.getTime() <= Date.parse(open[0].started_at)) {
    redirect(back(redirectTo, "error", t("war.futureStart")));
  }

  execute(
    "UPDATE war_sessions SET ended_at = ? WHERE ended_at IS NULL AND id IN (" +
      open.map(() => "?").join(", ") +
      ")",
    now.toISOString(),
    ...open.map((session) => session.id),
  );

  revalidateWars();
  redirect(back(redirectTo, "ok", t("war.ended", { count: open.length })));
}

export async function deleteWarGroupAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const { t } = await getT();
  const sessionId = Number(formData.get("sessionId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/wars");
  const group = warGroupSessions(sessionId);

  if (group.length === 0) redirect(back(redirectTo, "error", t("war.notFound")));
  if (!canEditServer(user, group[0].server_id)) {
    redirect(back(redirectTo, "error", t("war.noPermission")));
  }

  execute(
    "DELETE FROM war_sessions WHERE id IN (" + group.map(() => "?").join(", ") + ")",
    ...group.map((session) => session.id),
  );

  revalidateWars();
  redirect(back(redirectTo, "ok", t("war.removed")));
}
