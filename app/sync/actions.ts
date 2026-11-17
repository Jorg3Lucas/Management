"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { syncEnabledServers } from "@/lib/sync";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

export async function syncAllAction(): Promise<void> {
  await requireAdmin();

  const results = await syncEnabledServers("manual");
  const successful = results.filter((result) => result.status === "success");
  const failed = results.filter((result) => result.status !== "success");
  const created = results.reduce((sum, result) => sum + result.created, 0);
  const updated = results.reduce((sum, result) => sum + result.updated, 0);

  revalidatePath("/sync");
  revalidatePath("/servers");
  revalidatePath("/players");
  revalidatePath("/");

  if (results.length === 0) {
    redirect(back("/sync", "error", "Nenhum servidor está com a sincronização ativada."));
  }

  const { m } = await getT();
  if (failed.length > 0) {
    const detail = failed.map((result) => `${result.serverLabel}: ${result.message ?? result.status}`).join(" | ");
    redirect(
      back(
        "/sync",
        "error",
        m("Servidores com falha: {failed}. {detail}", { failed: failed.length, detail }),
      ),
    );
  }

  redirect(
    back(
      "/sync",
      "ok",
      m("Servidores sincronizados: {count} · novos: {created} · atualizados: {updated}.", {
        count: successful.length,
        created,
        updated,
      }),
    ),
  );
}
