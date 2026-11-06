"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { execute } from "@/lib/db";
import { getServerById } from "@/lib/queries";
import { syncServer } from "@/lib/sync";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export async function toggleServerFlagAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const serverId = Number(formData.get("serverId"));
  const field = String(formData.get("field") ?? "");
  const returnTo = safePath(formData.get("redirectTo"), "/servers");
  const server = getServerById(serverId);

  if (!server) redirect(back(returnTo, "error", "Servidor não encontrado."));
  if (field !== "sync_enabled" && field !== "is_focus") {
    redirect(back(returnTo, "error", "Ação inválida."));
  }

  execute(`UPDATE servers SET ${field} = 1 - ${field} WHERE id = ?`, serverId);

  logAudit({
    user: admin,
    action: "server.flag",
    entity: "server",
    entityId: serverId,
    serverId,
    detail:
      field === "sync_enabled"
        ? `${server.label}: sincronização ${server.sync_enabled ? "desativada" : "ativada"}`
        : `${server.label}: ${server.is_focus ? "fora do foco" : "em foco"}`,
  });

  revalidatePath("/servers");
  revalidatePath("/");
  const message =
    field === "sync_enabled"
      ? `${server.label}: sincronização ${server.sync_enabled ? "desativada" : "ativada"}.`
      : `${server.label}: ${server.is_focus ? "removido do" : "adicionado ao"} foco.`;
  redirect(back(returnTo, "ok", message));
}

export async function syncServerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const serverId = Number(formData.get("serverId"));
  const returnTo = safePath(formData.get("redirectTo"), "/servers");
  const server = getServerById(serverId);

  if (!server) redirect(back(returnTo, "error", "Servidor não encontrado."));

  const result = await syncServer(serverId, { source: "manual" });

  revalidatePath("/servers");
  revalidatePath("/players");
  revalidatePath("/sync");
  revalidatePath("/");

  if (result.status === "error") {
    redirect(back(returnTo, "error", `${server.label}: ${result.message ?? "falha ao sincronizar."}`));
  }
  if (result.status === "empty") {
    redirect(back(returnTo, "error", `${server.label}: ${result.message ?? "ranking vazio."}`));
  }

  redirect(
    back(
      returnTo,
      "ok",
      `${server.label}: ${result.fetched} jogadores lidos, ${result.created} novos, ${result.updated} atualizados.`,
    ),
  );
}
