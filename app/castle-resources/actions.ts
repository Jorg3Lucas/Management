"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addCastleResourceEntry, removeCastleResourceEntry } from "@/lib/castle-resources";
import { canEditServer, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getT } from "@/lib/i18n";
import { castleMonthStart, castleMonthTitle } from "@/lib/castle-prizes";
import { getServerById } from "@/lib/queries";

const PAGE = "/castle-resources";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

/** "1.500.000" → 1500000. */
function amountOf(value: FormDataEntryValue | null): number {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

/** Adiciona um lançamento de darksteel/gold do mês. */
export async function addCastleResourceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), PAGE);
  const monthStart = castleMonthStart(String(formData.get("month") ?? ""));
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para gerenciar os recursos."));
  }

  const label = String(formData.get("label") ?? "").trim().slice(0, 80);
  const darksteel = amountOf(formData.get("darksteel"));
  const gold = amountOf(formData.get("gold"));

  const result = addCastleResourceEntry({ serverId, monthStart, userId: user.id, label, darksteel, gold });
  if (!result.ok) redirect(back(redirectTo, "error", result.error));

  logAudit({
    user,
    action: "castle.resources.add",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: `Recursos de ${castleMonthTitle(monthStart)} · lançamento de ${darksteel} darksteel e ${gold} gold${label ? ` (${label})` : ""}`,
  });

  revalidatePath(PAGE);
  const { m } = await getT();
  redirect(
    back(
      redirectTo,
      "ok",
      m("Lançamento adicionado em {month}: {darksteel} darksteel e {gold} gold.", {
        month: castleMonthTitle(monthStart),
        darksteel,
        gold,
      }),
    ),
  );
}

/** Remove um lançamento do livro do mês. */
export async function removeCastleResourceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), PAGE);
  const monthStart = castleMonthStart(String(formData.get("month") ?? ""));
  const entryId = Number(formData.get("entryId"));
  const server = getServerById(serverId);

  if (!server || !canEditServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para gerenciar os recursos."));
  }
  if (!Number.isInteger(entryId) || entryId <= 0) {
    redirect(back(redirectTo, "error", "Lançamento inválido."));
  }

  const result = removeCastleResourceEntry({ serverId, monthStart, entryId });
  if (!result.ok) redirect(back(redirectTo, "error", result.error));

  logAudit({
    user,
    action: "castle.resources.remove",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: `Recursos de ${castleMonthTitle(monthStart)} · lançamento #${entryId} removido`,
  });

  revalidatePath(PAGE);
  const { m } = await getT();
  redirect(back(redirectTo, "ok", m("Lançamento removido de {month}.", { month: castleMonthTitle(monthStart) })));
}
