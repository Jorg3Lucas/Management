"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEditServer, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getServerById } from "@/lib/queries";
import {
  CE_EXPEDITIONS,
  ceAlliedClan,
  ceSummary,
  ceWeekStart,
  characterInClan,
  getOrCreateCePlan,
  isCeRun,
  saveCePlan,
  setCeDonation,
  type CePlan,
} from "@/lib/ce";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function readRuns(formData: FormData): CePlan {
  const runs: CePlan = {};
  for (const ce of CE_EXPEDITIONS) {
    const value = String(formData.get(`run_${ce.no}`) ?? "x0");
    runs[ce.no] = isCeRun(value) ? value : "x0";
  }
  return runs;
}

export async function saveCePlanAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const clanId = Number(formData.get("clanId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/ce");
  const weekStart = ceWeekStart(String(formData.get("week") ?? ""));
  const server = getServerById(serverId);
  const clan = ceAlliedClan(serverId, clanId);

  if (!server || !canEditServer(user, serverId) || !clan) {
    redirect(back(redirectTo, "error", "Clã aliado inválido ou sem permissão para editar o servidor."));
  }

  const runs = readRuns(formData);

  const participantsRaw = Number(formData.get("participants"));
  const participants = Number.isFinite(participantsRaw)
    ? Math.max(0, Math.min(500, Math.round(participantsRaw)))
    : 0;

  saveCePlan({ serverId, weekStart, clanId, runs, participants, userId: user.id });

  const summary = ceSummary(runs);

  logAudit({
    user,
    action: "ce.plan",
    entity: "clan",
    entityId: clanId,
    serverId,
    detail: `Semana ${weekStart} · ${clan.name}: ${summary.statues} estátua(s), DS ${summary.darksteel}, energia ${summary.energy}, ouro ${summary.gold} (ghost trade ${Math.round(summary.requiredGold)}), ${participants} participante(s)`,
  });

  revalidatePath("/ce");
  redirect(back(redirectTo, "ok", `Plano de ${clan.name} salvo.`));
}

export async function saveCeDonationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const clanId = Number(formData.get("clanId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/ce");
  const weekStart = ceWeekStart(String(formData.get("week") ?? ""));
  const characterId = Number(formData.get("characterId"));
  const name = String(formData.get("name") ?? "");
  const server = getServerById(serverId);
  const clan = ceAlliedClan(serverId, clanId);

  if (!server || !canEditServer(user, serverId) || !clan) {
    redirect(back(redirectTo, "error", "Clã aliado inválido ou sem permissão para editar o servidor."));
  }
  if (
    !Number.isFinite(characterId) ||
    characterId <= 0 ||
    !characterInClan(characterId, serverId, clanId)
  ) {
    redirect(back(redirectTo, "error", "Membro inválido para este clã."));
  }

  const gold = formData.get("gold") === "1";
  const planId = getOrCreateCePlan({ serverId, weekStart, clanId, userId: user.id });

  setCeDonation({ planId, characterId, gold });

  logAudit({
    user,
    action: "ce.donation",
    entity: "clan",
    entityId: clanId,
    serverId,
    detail: `Semana ${weekStart} · ${clan.name}: ${name || `personagem ${characterId}`} — ouro ${gold ? "doado" : "pendente"}`,
  });

  revalidatePath("/ce");
  redirect(back(redirectTo, "ok", "Doação atualizada."));
}
