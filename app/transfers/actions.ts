"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { confirmMove, getMove, rejectMove } from "@/lib/players";

function back(kind: "ok" | "error", message: string): string {
  return `/transfers?${kind}=${encodeURIComponent(message)}`;
}

export async function confirmMoveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const moveId = Number(formData.get("moveId"));
  if (!getMove(moveId)) redirect(back("error", "Transferência não encontrada."));

  const move = confirmMove(moveId, admin.id);
  if (!move) redirect(back("error", "Esta transferência já foi decidida."));

  logAudit({
    user: admin,
    action: "transfer.confirm",
    entity: "player",
    entityId: move.player_id,
    serverId: move.to_server_id,
    detail: `${move.player_name}: ${move.from_label ?? "?"} → ${move.to_label}`,
  });

  revalidatePath("/transfers");
  revalidatePath("/");
  redirect(back("ok", `Transferência de ${move.player_name} confirmada.`));
}

export async function rejectMoveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const moveId = Number(formData.get("moveId"));
  if (!getMove(moveId)) redirect(back("error", "Transferência não encontrada."));

  const move = rejectMove(moveId, admin.id);
  if (!move) redirect(back("error", "Esta transferência já foi decidida."));

  logAudit({
    user: admin,
    action: "transfer.reject",
    entity: "player",
    entityId: move.player_id,
    serverId: move.to_server_id,
    detail: `${move.player_name}: ${move.from_label ?? "?"} → ${move.to_label}`,
  });

  revalidatePath("/transfers");
  redirect(back("ok", `Transferência de ${move.player_name} rejeitada.`));
}
