"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { canAdminServer, requireUser } from "@/lib/auth";
import { getClan } from "@/lib/clans";
import { getServerById } from "@/lib/queries";
import {
  deleteSabukWin,
  formatSabukDate,
  isTerritoryKey,
  recordSabukWin,
  setTerritoryOwner,
  territoryName,
} from "@/lib/territories";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function parseEventDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? value : null;
}

export async function recordSabukWinAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const clanId = Number(formData.get("clanId"));
  const wonOn = parseEventDate(String(formData.get("wonOn") ?? "").trim());
  const returnTo = safePath(formData.get("redirectTo"), "/territories");

  const server = getServerById(serverId);
  if (!server) redirect(back(returnTo, "error", "Servidor inválido."));
  if (!canAdminServer(user, serverId)) {
    redirect(back(returnTo, "error", "Apenas o líder do servidor pode registrar o Sabuk Clash."));
  }

  const clan = getClan(clanId);
  if (!clan) redirect(back(returnTo, "error", "Clã não encontrado."));
  if (!wonOn) redirect(back(returnTo, "error", "Informe a data da rodada."));

  recordSabukWin({ serverId, clanId: clan.id, wonOn, userId: user.id });

  logAudit({
    user,
    action: "sabuk.win",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: `Sabuk Clash ${formatSabukDate(wonOn)}: ${clan.name}`,
  });

  revalidatePath("/territories");
  revalidatePath("/");
  redirect(back(returnTo, "ok", `Sabuk Clash ${formatSabukDate(wonOn)}: ${clan.name}.`));
}

export async function deleteSabukWinAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const winId = Number(formData.get("winId"));
  const returnTo = safePath(formData.get("redirectTo"), "/territories");

  if (!getServerById(serverId) || !Number.isFinite(winId)) {
    redirect(back(returnTo, "error", "Registro inválido."));
  }
  if (!canAdminServer(user, serverId)) {
    redirect(back(returnTo, "error", "Apenas o líder do servidor pode remover o Sabuk Clash."));
  }

  deleteSabukWin(winId, serverId);

  logAudit({
    user,
    action: "sabuk.remove",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: `Registro de Sabuk Clash removido (#${winId})`,
  });

  revalidatePath("/territories");
  redirect(back(returnTo, "ok", "Registro de Sabuk Clash removido."));
}

export async function setTerritoryOwnerAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const territory = String(formData.get("territory") ?? "");
  const clanRaw = String(formData.get("clanId") ?? "").trim();
  const returnTo = safePath(formData.get("redirectTo"), "/territories");

  const server = getServerById(serverId);
  if (!server || !isTerritoryKey(territory)) redirect(back(returnTo, "error", "Território ou servidor inválido."));
  if (!canAdminServer(user, serverId)) {
    redirect(back(returnTo, "error", "Apenas o líder do servidor pode registrar os territórios."));
  }

  const clanId = clanRaw === "" ? null : Number(clanRaw);
  if (clanId !== null && !Number.isFinite(clanId)) {
    redirect(back(returnTo, "error", "Clã inválido."));
  }
  const clan = clanId === null ? null : getClan(clanId);
  if (clanId !== null && !clan) redirect(back(returnTo, "error", "Clã não encontrado."));

  const changed = setTerritoryOwner({ serverId, territory, clanId: clan?.id ?? null, userId: user.id });

  if (changed) {
    logAudit({
      user,
      action: "territory.owner",
      entity: "server",
      entityId: serverId,
      serverId,
      detail: `${territoryName(territory)}: ${clan ? clan.name : "sem dono"}`,
    });
    revalidatePath("/territories");
    revalidatePath("/");
  }

  redirect(
    back(
      returnTo,
      "ok",
      changed
        ? `${territoryName(territory)}: ${clan ? clan.name : "sem dono"}.`
        : `${territoryName(territory)}: dono já era ${clan ? clan.name : "sem dono"}.`,
    ),
  );
}
