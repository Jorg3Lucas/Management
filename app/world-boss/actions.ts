"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAdminServer, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ceWeekStart, shortDay } from "@/lib/ce";
import { getServerById } from "@/lib/queries";
import {
  createWorldBossFight,
  deleteWorldBossFight,
  getWorldBossFight,
  saveWorldBossAttendance,
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

  if (!server || !canAdminServer(user, serverId)) {
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
  redirect(
    back(
      `/world-boss?server=${server.code}&week=${ceWeekStart(foughtOn)}`,
      "ok",
      `Encontro de ${shortDay(foughtOn)} às ${foughtAt} registrado.`,
    ),
  );
}

export async function deleteWorldBossFightAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const fightId = Number(formData.get("fightId"));
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/world-boss");
  const fight = getWorldBossFight(fightId);

  if (!fight || fight.server_id !== serverId || !canAdminServer(user, serverId)) {
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

  if (!server || !canAdminServer(user, serverId)) {
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
