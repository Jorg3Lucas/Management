"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { canEditServer, requireAdmin, requireUser } from "@/lib/auth";
import { getClan, isClanStance, logClanChange, mergeClans, STANCE_LABELS } from "@/lib/clans";
import { execute, queryOne } from "@/lib/db";
import { getT } from "@/lib/i18n";
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
  if (!canEditServer(user, serverId)) {
    redirect(back(returnTo, "error", "Sem permissão para definir a postura dos clãs neste servidor."));
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
    const { m } = await getT();
    redirect(back(returnTo, "ok", m("{clan}: postura removida.", { clan: clan.name })));
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
  const { t, m } = await getT();
  redirect(back(returnTo, "ok", m("{clan}: {stance}.", { clan: clan.name, stance: t(`stance.${stanceRaw}`) })));
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
  const { m } = await getT();
  redirect(
    back(
      returnTo,
      "ok",
      m("{source} agora é tratado como {target}: {count} personagem(ns) reapontado(s).", {
        source: source.name,
        target: target.name,
        count: result.characters,
      }),
    ),
  );
}

/**
 * Vincula um jogador do servidor ao clã ou o remove dele.
 * A origem é manual: o ranking do fórum pode reatribuir na próxima sincronização.
 */
export async function assignClanPlayerAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const clanId = Number(formData.get("clanId"));
  const characterId = Number(formData.get("characterId"));
  const mode = String(formData.get("mode") ?? "assign");
  const returnTo = safePath(formData.get("redirectTo"), "/clans");

  const server = getServerById(serverId);
  const clan = getClan(clanId);
  if (!server || !clan) redirect(back(returnTo, "error", "Clã ou servidor inválido."));
  if (!canEditServer(user, serverId)) {
    redirect(back(returnTo, "error", "Sem permissão para vincular jogadores aos clãs neste servidor."));
  }

  const character = queryOne<{
    id: number;
    name: string;
    clan: string | null;
    clan_id: number | null;
    server_id: number;
  }>("SELECT id, name, clan, clan_id, server_id FROM characters WHERE id = ?", characterId);

  if (!character || character.server_id !== serverId) {
    redirect(back(returnTo, "error", "Jogador não encontrado neste servidor."));
  }

  const now = new Date().toISOString();

  if (mode === "remove") {
    if (character.clan_id !== clanId) {
      const { m } = await getT();
      redirect(back(returnTo, "error", m("{player} não está em {clan}.", { player: character.name, clan: clan.name })));
    }

    execute("UPDATE characters SET clan = NULL, clan_id = NULL, updated_at = ? WHERE id = ?", now, character.id);

    logAudit({
      user,
      action: "clan.player",
      entity: "character",
      entityId: character.id,
      serverId,
      detail: `${character.name} removido de ${clan.name}`,
    });

    revalidatePath(`/clans/${clanId}`);
    revalidatePath("/clans");
    revalidatePath("/players");
    revalidatePath("/teams");
    const { m } = await getT();
    redirect(back(returnTo, "ok", m("{player} saiu de {clan}.", { player: character.name, clan: clan.name })));
  }

  if (character.clan_id === clanId) {
    const { m } = await getT();
    redirect(back(returnTo, "error", m("{player} já está em {clan}.", { player: character.name, clan: clan.name })));
  }

  execute(
    "UPDATE characters SET clan = ?, clan_id = ?, updated_at = ? WHERE id = ?",
    clan.name,
    clan.id,
    now,
    character.id,
  );

  logClanChange({
    characterId: character.id,
    previousName: character.clan,
    previousId: character.clan_id,
    nextName: clan.name,
    nextId: clan.id,
    source: "manual",
    changedAt: now,
  });

  logAudit({
    user,
    action: "clan.player",
    entity: "character",
    entityId: character.id,
    serverId,
    detail: `${character.name}: clã ${character.clan ?? "sem clã"} → ${clan.name}`,
  });

  revalidatePath(`/clans/${clanId}`);
  revalidatePath("/clans");
  revalidatePath("/players");
  revalidatePath("/teams");
  const { m } = await getT();
  redirect(back(returnTo, "ok", m("{player} vinculado a {clan}.", { player: character.name, clan: clan.name })));
}
