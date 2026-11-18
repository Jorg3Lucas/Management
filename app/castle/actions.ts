"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEditServer, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { saveCastlePrizeDistribution, toggleCastlePrizeDelivery } from "@/lib/castle";
import { saveCastleResourceDistribution, type CastleResourceAmount } from "@/lib/castle-resources";
import { getT } from "@/lib/i18n";
import {
  CASTLE_PRIZES,
  castleMonthStart,
  castleMonthTitle,
  isCastlePrizeKey,
  type CastlePrizeKey,
} from "@/lib/castle-prizes";
import { getServerById } from "@/lib/queries";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export async function saveCastlePrizesAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/castle");
  // Chave do período: primeiro dia do mês do baú (o baú é mensal).
  const monthStart = castleMonthStart(String(formData.get("month") ?? ""));
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para distribuir o prêmio."));
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(formData.get("awards") ?? "{}"));
  } catch {
    redirect(back(redirectTo, "error", "Seleção inválida."));
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    redirect(back(redirectTo, "error", "Seleção inválida."));
  }

  const awards: Record<number, CastlePrizeKey[]> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const characterId = Number(key);
    if (!Number.isInteger(characterId) || characterId <= 0) {
      redirect(back(redirectTo, "error", "Seleção inválida."));
    }
    if (value === null || value === undefined) continue;
    if (!Array.isArray(value)) {
      redirect(back(redirectTo, "error", "Seleção inválida."));
    }

    const prizes: CastlePrizeKey[] = [];
    for (const prize of value) {
      if (prize === "" || prize === null || prize === undefined) continue;
      if (!isCastlePrizeKey(prize)) {
        redirect(back(redirectTo, "error", "Há um prêmio inválido na seleção."));
      }
      prizes.push(prize);
    }
    if (prizes.length > 0) awards[characterId] = prizes;
  }

  const result = saveCastlePrizeDistribution({ serverId, monthStart, userId: user.id, awards });
  if (!result.ok) redirect(back(redirectTo, "error", result.error));

  const detail = CASTLE_PRIZES.map(
    (prize) => `${result.counts[prize.key]} ${prize.label.toLowerCase()}`,
  ).join(", ");

  logAudit({
    user,
    action: "castle.prize",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: `Baú de ${castleMonthTitle(monthStart)} · ${result.assigned} baú(s) para ${result.members} membro(s): ${detail}`,
  });

  revalidatePath("/castle");
  const { m } = await getT();
  redirect(
    back(
      redirectTo,
      "ok",
      m("Baú de {month} salvo: {chests} baú(s) para {members} membro(s).", {
        month: castleMonthTitle(monthStart),
        chests: result.assigned,
        members: result.members,
      }),
    ),
  );
}

/** Marca (ou desmarca) a entrega dos baús de um membro no mês. */
export async function toggleCastleDeliveryAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/castle");
  const monthStart = castleMonthStart(String(formData.get("month") ?? ""));
  const characterId = Number(formData.get("characterId"));
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para distribuir o prêmio."));
  }
  if (!Number.isInteger(characterId) || characterId <= 0) {
    redirect(back(redirectTo, "error", "Membro inválido."));
  }

  const result = toggleCastlePrizeDelivery({ serverId, monthStart, characterId, userId: user.id });
  if (!result) redirect(back(redirectTo, "error", "Membro não tem baú neste mês."));

  logAudit({
    user,
    action: result.delivered ? "castle.prize.delivered" : "castle.prize.pending",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: `${result.name}: baús de ${castleMonthTitle(monthStart)} ${result.delivered ? "entregues" : "com entrega desmarcada"}`,
  });

  revalidatePath("/castle");
  const { m } = await getT();
  redirect(
    back(
      redirectTo,
      "ok",
      result.delivered
        ? m("Baús de {name} marcados como entregues.", { name: result.name })
        : m("Entrega dos baús de {name} desmarcada.", { name: result.name }),
    ),
  );
}

/** Salva a distribuição de darksteel e gold do mês. */
export async function saveCastleResourcesAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/castle/resources");
  const monthStart = castleMonthStart(String(formData.get("month") ?? ""));
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para distribuir os recursos."));
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(formData.get("entries") ?? "{}"));
  } catch {
    redirect(back(redirectTo, "error", "Distribuição inválida."));
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    redirect(back(redirectTo, "error", "Distribuição inválida."));
  }

  const entries: Record<number, CastleResourceAmount> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const characterId = Number(key);
    if (!Number.isInteger(characterId) || characterId <= 0) {
      redirect(back(redirectTo, "error", "Distribuição inválida."));
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;

    const record = value as Record<string, unknown>;
    const darksteel = Number(record.darksteel ?? 0);
    const gold = Number(record.gold ?? 0);
    if (!Number.isFinite(darksteel) || !Number.isFinite(gold) || darksteel < 0 || gold < 0) {
      redirect(back(redirectTo, "error", "Informe apenas valores positivos em darksteel e gold."));
    }
    entries[characterId] = { darksteel: Math.trunc(darksteel), gold: Math.trunc(gold), delivered: record.delivered === true };
  }

  const result = saveCastleResourceDistribution({ serverId, monthStart, userId: user.id, entries });
  if (!result.ok) redirect(back(redirectTo, "error", result.error));

  logAudit({
    user,
    action: "castle.resources",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: `Recursos de ${castleMonthTitle(monthStart)} · ${result.darksteel} darksteel e ${result.gold} gold para ${result.members} membro(s), ${result.delivered} entregue(s)`,
  });

  revalidatePath("/castle");
  revalidatePath("/castle/resources");
  const { m } = await getT();
  redirect(
    back(
      redirectTo,
      "ok",
      m("Distribuição de {month} salva: {darksteel} darksteel e {gold} gold para {members} membro(s).", {
        month: castleMonthTitle(monthStart),
        darksteel: result.darksteel,
        gold: result.gold,
        members: result.members,
      }),
    ),
  );
}
