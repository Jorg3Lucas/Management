"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEditServer, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ceWeekStart, shortDay } from "@/lib/ce";
import { getT } from "@/lib/i18n";
import { getServerById } from "@/lib/queries";
import {
  WORLD_BOSS_CUSTOM_NAME_MAX,
  addWorldBossCustomMember,
  createWorldBossFight,
  deleteWorldBossCustomMember,
  deleteWorldBossFight,
  getWorldBossFight,
  saveWorldBossAttendance,
  saveWorldBossCustomAttendance,
} from "@/lib/world-boss";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function addWorldBossFightAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/world-boss");
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para registrar encontros."));
  }

  const foughtOn = String(formData.get("foughtOn") ?? "").trim();
  const foughtAt = String(formData.get("foughtAt") ?? "").trim();
  const label = cleanText(formData.get("label"), 40) || null;

  const result = createWorldBossFight({ serverId, foughtOn, foughtAt, label, userId: user.id });
  if (!result.ok) redirect(back(redirectTo, "error", result.error));

  logAudit({
    user,
    action: "worldboss.fight",
    entity: "world_boss_fight",
    entityId: result.id,
    serverId,
    detail: `${server.label}: encontro em ${shortDay(foughtOn)} às ${foughtAt}${label ? ` (${label})` : ""}`,
  });

  revalidatePath("/world-boss");
  const { m } = await getT();
  redirect(
    back(
      `/world-boss?server=${server.code}&week=${ceWeekStart(foughtOn)}`,
      "ok",
      m("Encontro de {date} às {time} registrado.", {
        date: shortDay(foughtOn),
        time: foughtAt,
      }),
    ),
  );
}

export async function deleteWorldBossFightAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const fightId = Number(formData.get("fightId"));
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/world-boss");
  const fight = getWorldBossFight(fightId);

  if (!fight || fight.server_id !== serverId || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Encontro inválido ou sem permissão para removê-lo."));
  }

  deleteWorldBossFight(fight.id, serverId);

  logAudit({
    user,
    action: "worldboss.fight.delete",
    entity: "world_boss_fight",
    entityId: fight.id,
    serverId,
    detail: `Encontro de ${shortDay(fight.fought_on)} às ${fight.fought_at} removido com as presenças`,
  });

  revalidatePath("/world-boss");
  redirect(back(redirectTo, "ok", "Encontro removido junto com as presenças dele."));
}

export async function saveWorldBossAttendanceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/world-boss");
  const weekStart = ceWeekStart(String(formData.get("week") ?? ""));
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para marcar presenças."));
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(formData.get("attendance") ?? "{}"));
  } catch {
    redirect(back(redirectTo, "error", "Seleção de presenças inválida."));
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    redirect(back(redirectTo, "error", "Seleção de presenças inválida."));
  }

  const attendance: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(value)) {
      redirect(back(redirectTo, "error", "Seleção de presenças inválida."));
    }
    attendance[key] = value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry) && entry > 0);
  }

  const result = saveWorldBossAttendance({ serverId, weekStart, userId: user.id, attendance });
  if (!result.ok) redirect(back(redirectTo, "error", result.error));

  logAudit({
    user,
    action: "worldboss.attendance",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: `Semana ${weekStart}: ${result.marks} presença(s) em ${result.fights} encontro(s)`,
  });

  revalidatePath("/world-boss");
  redirect(
    back(
      redirectTo,
      "ok",
      `Presenças salvas: ${result.marks} marcação(ões) em ${result.fights} encontro(s).`,
    ),
  );
}

/** Adiciona um nome ao bloco custom (membros que lutam em outros servidores). */
export async function addWorldBossCustomMemberAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/world-boss");
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para montar o bloco custom."));
  }

  const name = cleanText(formData.get("name"), WORLD_BOSS_CUSTOM_NAME_MAX);
  const result = addWorldBossCustomMember({ serverId, name });
  if (!result.ok) redirect(back(redirectTo, "error", result.error));

  logAudit({
    user,
    action: "worldboss.custom.add",
    entity: "world_boss_custom_member",
    entityId: result.id,
    serverId,
    detail: `${server.label}: "${name}" entrou no bloco custom`,
  });

  revalidatePath("/world-boss");
  const { m } = await getT();
  redirect(back(redirectTo, "ok", m("{name} entrou no bloco custom.", { name })));
}

/** Tira um nome do bloco custom, junto com as presenças que ele tinha. */
export async function deleteWorldBossCustomMemberAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/world-boss");
  const customId = Number(formData.get("customId"));
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Sem permissão para mexer no bloco custom deste servidor."));
  }

  if (!Number.isInteger(customId) || !deleteWorldBossCustomMember(customId, serverId)) {
    redirect(back(redirectTo, "error", "Membro inválido ou sem permissão para removê-lo."));
  }

  logAudit({
    user,
    action: "worldboss.custom.delete",
    entity: "world_boss_custom_member",
    entityId: customId,
    serverId,
    detail: `${server.label}: um nome saiu do bloco custom com as presenças dele`,
  });

  revalidatePath("/world-boss");
  redirect(back(redirectTo, "ok", "Membro removido do bloco custom junto com as presenças dele."));
}

/** Salva as presenças do bloco custom da semana. */
export async function saveWorldBossCustomAttendanceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/world-boss");
  const weekStart = ceWeekStart(String(formData.get("week") ?? ""));
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para marcar presenças."));
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(formData.get("customAttendance") ?? "{}"));
  } catch {
    redirect(back(redirectTo, "error", "Seleção de presenças inválida."));
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    redirect(back(redirectTo, "error", "Seleção de presenças inválida."));
  }

  const attendance: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(value)) {
      redirect(back(redirectTo, "error", "Seleção de presenças inválida."));
    }
    attendance[key] = value
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry) && entry > 0);
  }

  const result = saveWorldBossCustomAttendance({ serverId, weekStart, attendance });
  if (!result.ok) redirect(back(redirectTo, "error", result.error));

  logAudit({
    user,
    action: "worldboss.custom.attendance",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: `Semana ${weekStart}: ${result.marks} presença(s) do bloco custom em ${result.fights} encontro(s)`,
  });

  revalidatePath("/world-boss");
  const { m } = await getT();
  redirect(
    back(
      redirectTo,
      "ok",
      m("Presenças do bloco custom salvas: {marks} em {fights} encontro(s).", {
        marks: result.marks,
        fights: result.fights,
      }),
    ),
  );
}
