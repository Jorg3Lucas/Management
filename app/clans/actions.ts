"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { canAdminServer, requireAdmin, requireUser } from "@/lib/auth";
import { getClan, isClanStance, mergeClans, STANCE_LABELS } from "@/lib/clans";
import { execute } from "@/lib/db";
import { getServerById } from "@/lib/queries";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export async function setClanStanceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const clanId = Number(formData.get("clanId"));
  const stanceRaw = String(formData.get("stance") ?? "");
  const returnTo = safePath(formData.get("redirectTo"), "/clans");

  const server = getServerById(serverId);
  const clan = getClan(clanId);
  if (!server || !clan) redirect(back(returnTo, "error", "Clã ou servidor inválido."));
  if (!canAdminServer(user, serverId)) {
    redirect(back(returnTo, "error", "Apenas o dono do servidor pode definir a postura dos clãs."));
  }

  if (stanceRaw === "") {
    execute("DELETE FROM clan_relations WHERE server_id = ? AND clan_id = ?", serverId, clanId);
    logAudit({
      user,
      action: "clan.stance",
      entity: "clan",
      entityId: clanId,
      serverId,
      detail: `${clan.name}: postura removida`,
    });
    revalidatePath("/clans");
    revalidatePath("/players");
    redirect(back(returnTo, "ok", `${clan.name}: postura removida.`));
  }

  if (!isClanStance(stanceRaw)) redirect(back(returnTo, "error", "Postura inválida."));

  execute(
    `INSERT INTO clan_relations (server_id, clan_id, stance, notes, updated_by, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?)
     ON CONFLICT(server_id, clan_id) DO UPDATE SET
       stance = excluded.stance,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`,
    serverId,
    clanId,
    stanceRaw,
    user.id,
    new Date().toISOString(),
  );

  logAudit({
    user,
    action: "clan.stance",
    entity: "clan",
    entityId: clanId,
    serverId,
    detail: `${clan.name}: ${STANCE_LABELS[stanceRaw]}`,
  });

  revalidatePath("/clans");
  revalidatePath("/players");
  revalidatePath("/");
  redirect(back(returnTo, "ok", `${clan.name}: ${STANCE_LABELS[stanceRaw]}.`));
}

export async function mergeClansAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const serverId = Number(formData.get("serverId"));
  const sourceId = Number(formData.get("sourceId"));
  const targetId = Number(formData.get("targetId"));
  const returnTo = safePath(formData.get("redirectTo"), "/clans");

  const source = getClan(sourceId);
  const target = getClan(targetId);
  if (!source || !target) redirect(back(returnTo, "error", "Selecione dois clãs válidos."));
  if (source.id === target.id) redirect(back(returnTo, "error", "Escolha clãs diferentes para mesclar."));

  const result = mergeClans(source.id, target.id);

  logAudit({
    user: admin,
    action: "clan.merge",
    entity: "clan",
    entityId: target.id,
    serverId: Number.isFinite(serverId) ? serverId : null,
    detail: `${source.name} → ${target.name} (${result.characters} personagem(ns))`,
  });

  revalidatePath("/clans");
  revalidatePath("/players");
  redirect(
    back(
      returnTo,
      "ok",
      `${source.name} agora é tratado como ${target.name}: ${result.characters} personagem(ns) reapontado(s).`,
    ),
  );
}
