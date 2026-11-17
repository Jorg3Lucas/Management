"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEditServer, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { saveCastlePrizeDistribution } from "@/lib/castle";
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
  redirect(
    back(
      redirectTo,
      "ok",
      `Baú de ${castleMonthTitle(monthStart)} salvo: ${result.assigned} baú(s) para ${result.members} membro(s).`,
    ),
  );
}
