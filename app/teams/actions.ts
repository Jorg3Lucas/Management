"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { canAdminServer, requireUser } from "@/lib/auth";
import { getClan } from "@/lib/clans";
import { getServerById } from "@/lib/queries";
import {
  assignClanTeam,
  createTeam,
  deleteTeam,
  getTeam,
  isValidTeamColor,
  TEAM_COLORS,
  updateTeam,
} from "@/lib/teams";

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

export async function createTeamAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const returnTo = safePath(formData.get("redirectTo"), "/teams");
  const server = getServerById(serverId);
  const name = cleanText(formData.get("name"), 40);
  const color = String(formData.get("color") ?? TEAM_COLORS[0].value);

  if (!server) redirect(back(returnTo, "error", "Servidor inválido."));
  if (!canAdminServer(user, serverId)) {
    redirect(back(returnTo, "error", "Apenas o dono do servidor pode criar times."));
  }
  if (name.length < 2) redirect(back(returnTo, "error", "Informe um nome de time com pelo menos 2 caracteres."));
  if (!isValidTeamColor(color)) redirect(back(returnTo, "error", "Cor inválida."));

  let teamId: number;
  try {
    teamId = createTeam({ serverId, name, color }).id;
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("UNIQUE");
    redirect(
      back(
        returnTo,
        "error",
        duplicate ? "Já existe um time com esse nome neste servidor." : "Não foi possível criar o time.",
      ),
    );
  }

  logAudit({
    user,
    action: "team.create",
    entity: "team",
    entityId: teamId,
    serverId,
    detail: `${name} em ${server.label}`,
  });

  revalidatePath("/teams");
  redirect(back(returnTo, "ok", `Time ${name} criado.`));
}

export async function updateTeamAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const teamId = Number(formData.get("teamId"));
  const serverId = Number(formData.get("serverId"));
  const returnTo = safePath(formData.get("redirectTo"), "/teams");
  const team = getTeam(teamId);
  const name = cleanText(formData.get("name"), 40);
  const color = String(formData.get("color") ?? "");

  if (!team || team.server_id !== serverId) redirect(back(returnTo, "error", "Time inválido."));
  if (!canAdminServer(user, serverId)) {
    redirect(back(returnTo, "error", "Apenas o dono do servidor pode editar times."));
  }
  if (name.length < 2) redirect(back(returnTo, "error", "Informe um nome de time com pelo menos 2 caracteres."));
  if (!isValidTeamColor(color)) redirect(back(returnTo, "error", "Cor inválida."));

  try {
    updateTeam(teamId, name, color);
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("UNIQUE");
    redirect(
      back(returnTo, "error", duplicate ? "Já existe um time com esse nome neste servidor." : "Não foi possível salvar."),
    );
  }

  logAudit({
    user,
    action: "team.update",
    entity: "team",
    entityId: teamId,
    serverId,
    detail: `${team.name} → ${name}`,
  });

  revalidatePath("/teams");
  redirect(back(returnTo, "ok", `Time ${name} atualizado.`));
}

export async function deleteTeamAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const teamId = Number(formData.get("teamId"));
  const serverId = Number(formData.get("serverId"));
  const returnTo = safePath(formData.get("redirectTo"), "/teams");
  const team = getTeam(teamId);

  if (!team || team.server_id !== serverId) redirect(back(returnTo, "error", "Time inválido."));
  if (!canAdminServer(user, serverId)) {
    redirect(back(returnTo, "error", "Apenas o dono do servidor pode remover times."));
  }

  deleteTeam(teamId);

  logAudit({
    user,
    action: "team.delete",
    entity: "team",
    entityId: teamId,
    serverId,
    detail: `${team.name} removido; clãs voltaram para "sem time"`,
  });

  revalidatePath("/teams");
  redirect(back(returnTo, "ok", `Time ${team.name} removido.`));
}

export async function assignTeamClanAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const clanId = Number(formData.get("clanId"));
  const rawTeamId = String(formData.get("teamId") ?? "").trim();
  const returnTo = safePath(formData.get("redirectTo"), "/teams");

  const server = getServerById(serverId);
  const clan = getClan(clanId);
  if (!server || !clan) redirect(back(returnTo, "error", "Clã ou servidor inválido."));
  if (!canAdminServer(user, serverId)) {
    redirect(back(returnTo, "error", "Apenas o dono do servidor pode vincular clãs a times."));
  }

  const teamId = rawTeamId === "" ? null : Number(rawTeamId);
  if (teamId !== null && !getTeam(teamId)) redirect(back(returnTo, "error", "Time inválido."));

  const ok = assignClanTeam({ serverId, clanId, teamId, userId: user.id });
  if (!ok) redirect(back(returnTo, "error", "O time escolhido não pertence a este servidor."));

  const team = teamId === null ? null : getTeam(teamId);
  logAudit({
    user,
    action: "team.clan",
    entity: "clan",
    entityId: clanId,
    serverId,
    detail: team ? `${clan.name} → ${team.name}` : `${clan.name} sem time`,
  });

  revalidatePath("/teams");
  revalidatePath("/clans");
  redirect(back(returnTo, "ok", team ? `${clan.name} agora está em ${team.name}.` : `${clan.name} sem time.`));
}
