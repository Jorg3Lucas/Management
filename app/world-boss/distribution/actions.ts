"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { saveSlotMembers } from "@/lib/world-boss-distribution";

export type SaveSlotResult =
  | { ok: true; members: string[] }
  | { ok: false; error: string };

/** Salva até 3 membros de um mapa do World Boss. */
export async function saveSlotMembersAction(
  slotKey: string,
  members: string[],
): Promise<SaveSlotResult> {
  await requireUser();
  const { t } = await getT();

  if (!Array.isArray(members)) {
    return { ok: false, error: t("boss.slotError") };
  }

  const saved = saveSlotMembers(
    slotKey,
    members.filter((member): member is string => typeof member === "string"),
  );

  if (!saved) {
    return { ok: false, error: t("boss.slotError") };
  }

  revalidatePath("/world-boss/distribution");
  return { ok: true, members: saved };
}
