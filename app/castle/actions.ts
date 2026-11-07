"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAdminServer, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ceWeekStart } from "@/lib/ce";
import { saveCastlePrizeDistribution } from "@/lib/castle";
import { CASTLE_PRIZES, isCastlePrizeKey, type CastlePrizeKey } from "@/lib/castle-prizes";
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
  const weekStart = ceWeekStart(String(formData.get("week") ?? ""));
  const server = getServerById(serverId);

  if (!server || !canAdminServer(user, serverId)) {
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

  const awards: Record<number, CastlePrizeKey> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const characterId = Number(key);
    if (!Number.isInteger(characterId) || characterId <= 0) {
      redirect(back(redirectTo, "error", "Seleção inválida."));
    }
    if (value === "" || value === null || value === undefined) continue;
    if (!isCastlePrizeKey(value)) {
      redirect(back(redirectTo, "error", "Há um prêmio inválido na seleção."));
    }
    awards[characterId] = value;
  }

  const result = saveCastlePrizeDistribution({ serverId, weekStart, userId: user.id, awards });
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
    detail: `Semana ${weekStart} · ${result.assigned} prêmio(s) distribuído(s): ${detail}`,
  });

  revalidatePath("/castle");
  redirect(back(redirectTo, "ok", `Distribuição salva: ${result.assigned} membro(s) com prêmio.`));
}
