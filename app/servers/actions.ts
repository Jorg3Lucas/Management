"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { execute } from "@/lib/db";
import { getT } from "@/lib/i18n";
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
  if (field !== "sync_enabled") {
    redirect(back(returnTo, "error", "Ação inválida."));
  }

  execute("UPDATE servers SET sync_enabled = 1 - sync_enabled WHERE id = ?", serverId);

  logAudit({
    user: admin,
    action: "server.flag",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: `${server.label}: sincronização ${server.sync_enabled ? "desativada" : "ativada"}`,
  });

  revalidatePath("/servers");
  revalidatePath("/");
  const { m } = await getT();
  const message = m(
    server.sync_enabled ? "{label}: sincronização desativada." : "{label}: sincronização ativada.",
    { label: server.label },
  );
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

  const { m } = await getT();
  if (result.status === "error") {
    redirect(back(returnTo, "error", `${server.label}: ${m(result.message ?? "falha ao sincronizar.")}`));
  }
  if (result.status === "empty") {
    redirect(back(returnTo, "error", `${server.label}: ${m(result.message ?? "ranking vazio.")}`));
  }

  redirect(
    back(
      returnTo,
      "ok",
      m("{label}: {read} jogadores lidos, {created} novos, {updated} atualizados.", {
        label: server.label,
        read: result.fetched,
        created: result.created,
        updated: result.updated,
      }),
    ),
  );
}
