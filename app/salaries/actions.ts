"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAdminServer, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getServerById } from "@/lib/queries";
import {
  addSalaryEntry,
  addSalaryMembers,
  createSalaryPeriod,
  deleteSalaryEntry,
  deleteSalaryPeriod,
  getSalaryEntry,
  getSalaryPeriod,
  isSalaryPreference,
  isSalaryTier,
  isStoneSplit,
  removeSalaryMember,
  SALARY_TIERS,
  SALARY_VALES,
  setSalaryProductionSlot,
  setSalaryTier,
  stoneSplitLabel,
  teamCharacterIds,
  updateSalaryMember,
  type SalaryPeriodRow,
} from "@/lib/salaries";
import type { SessionUser } from "@/lib/types";

function back(path: string, kind: "ok" | "error", message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(message)}`;
}

function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Valores da planilha vêm com pontos de milhar: "285.300.000" → 285300000. */
function parseAmount(value: FormDataEntryValue | null): number | null {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) return null;
  return amount;
}

function parseWeight(value: FormDataEntryValue | null): number | null {
  const normalized = String(value ?? "").replace(",", ".").trim();
  if (!normalized) return null;
  const weight = Number(normalized);
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) return null;
  return Math.round(weight * 100) / 100;
}

function periodPath(period: Pick<SalaryPeriodRow, "id" | "server_id">): string {
  const server = getServerById(period.server_id);
  return `/salaries?server=${server?.code ?? ""}&period=${period.id}`;
}

/** Carrega a semana e garante que o usuário administra o servidor dela. */
async function requirePeriod(user: SessionUser, periodId: number, path: string): Promise<SalaryPeriodRow> {
  const period = getSalaryPeriod(periodId);
  if (!period) redirect(back(path, "error", "Semana não encontrada."));
  if (!canAdminServer(user, period.server_id)) {
    redirect(back(path, "error", "Apenas quem administra o servidor pode mexer nos salários."));
  }
  return period;
}

export async function createSalaryPeriodAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/salaries");
  const server = getServerById(serverId);

  if (!server || !canAdminServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para administrá-lo."));
  }

  const label = cleanText(formData.get("label"), 40) || null;
  const startsOn = String(formData.get("startsOn") ?? "").trim();
  const endsOn = String(formData.get("endsOn") ?? "").trim();
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(startsOn) || !datePattern.test(endsOn)) {
    redirect(back(redirectTo, "error", "Informe o início e o fim da semana."));
  }
  if (endsOn < startsOn) redirect(back(redirectTo, "error", "O fim precisa ser depois do início."));

  let periodId: number;
  try {
    periodId = createSalaryPeriod({ serverId, label, startsOn, endsOn, userId: user.id });
  } catch (error) {
    const duplicate = error instanceof Error && error.message.includes("UNIQUE");
    redirect(
      back(redirectTo, "error", duplicate ? "Já existe uma semana começando nesse dia." : "Não foi possível criar a semana."),
    );
  }

  logAudit({
    user,
    action: "salary.period",
    entity: "salary_period",
    entityId: periodId,
    serverId,
    detail: `${server.label}: semana ${startsOn} a ${endsOn}`,
  });

  revalidatePath("/salaries");
  redirect(`/salaries?server=${server.code}&period=${periodId}&ok=${encodeURIComponent("Semana criada.")}`);
}

export async function deleteSalaryPeriodAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const periodId = Number(formData.get("periodId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/salaries");
  const period = await requirePeriod(user, periodId, redirectTo);
  const server = getServerById(period.server_id);

  deleteSalaryPeriod(period.id);

  logAudit({
    user,
    action: "salary.period.delete",
    entity: "salary_period",
    entityId: period.id,
    serverId: period.server_id,
    detail: `Semana ${period.starts_on} a ${period.ends_on} removida`,
  });

  revalidatePath("/salaries");
  redirect(
    back(
      `/salaries?server=${server?.code ?? ""}`,
      "ok",
      "Semana removida com produção, custos e elenco.",
    ),
  );
}

export async function addSalaryEntryAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const periodId = Number(formData.get("periodId"));
  const period = await requirePeriod(
    user,
    periodId,
    safePath(formData.get("redirectTo"), "/salaries"),
  );

  const kind = String(formData.get("kind") ?? "");
  if (kind !== "fixed") {
    redirect(back(periodPath(period), "error", "Produção vai nos três espaços de vale; aqui entram só custos."));
  }

  const name = cleanText(formData.get("name"), 60);
  const amount = parseAmount(formData.get("amount"));
  if (!name) redirect(back(periodPath(period), "error", "Informe o nome do lançamento."));
  if (amount === null) redirect(back(periodPath(period), "error", "Informe um valor válido."));

  const entryId = addSalaryEntry({ periodId: period.id, kind, name, amount });

  logAudit({
    user,
    action: "salary.entry",
    entity: "salary_entry",
    entityId: entryId,
    serverId: period.server_id,
    detail: `Custo fixo: ${name} ${amount}`,
  });

  revalidatePath("/salaries");
  redirect(back(periodPath(period), "ok", `Custo lançado: ${name}.`));
}

export async function setSalaryProductionSlotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const periodId = Number(formData.get("periodId"));
  const period = await requirePeriod(
    user,
    periodId,
    safePath(formData.get("redirectTo"), "/salaries"),
  );

  const slot = Number(formData.get("slot"));
  const vale = SALARY_VALES.find((entry) => entry.slot === slot);
  if (!vale) redirect(back(periodPath(period), "error", "Vale inválido."));

  const clear = formData.get("clear") === "1";
  const name = cleanText(formData.get("name"), 60);
  const amount = parseAmount(formData.get("amount"));

  if (clear) {
    setSalaryProductionSlot({ periodId: period.id, slot: vale.slot, name: "", amount: null });
    logAudit({
      user,
      action: "salary.entry.delete",
      entity: "salary_period",
      entityId: period.id,
      serverId: period.server_id,
      detail: `${vale.label} limpo`,
    });
    revalidatePath("/salaries");
    redirect(back(periodPath(period), "ok", `${vale.label} limpo.`));
  }

  if (!name) redirect(back(periodPath(period), "error", `Informe a origem do ${vale.label}.`));
  if (amount === null) redirect(back(periodPath(period), "error", `Informe o valor do ${vale.label}.`));

  setSalaryProductionSlot({ periodId: period.id, slot: vale.slot, name, amount });

  logAudit({
    user,
    action: "salary.entry",
    entity: "salary_period",
    entityId: period.id,
    serverId: period.server_id,
    detail: `${vale.label}: ${name} ${amount}`,
  });

  revalidatePath("/salaries");
  redirect(back(periodPath(period), "ok", `${vale.label} salvo: ${name}.`));
}

export async function deleteSalaryEntryAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const entryId = Number(formData.get("entryId"));
  const entry = getSalaryEntry(entryId);
  const redirectTo = safePath(formData.get("redirectTo"), "/salaries");

  if (!entry) redirect(back(redirectTo, "error", "Lançamento não encontrado."));
  const period = await requirePeriod(user, entry.period_id, redirectTo);

  deleteSalaryEntry(entry.id);

  logAudit({
    user,
    action: "salary.entry.delete",
    entity: "salary_entry",
    entityId: entry.id,
    serverId: period.server_id,
    detail: `${entry.name} (${entry.amount}) removido`,
  });

  revalidatePath("/salaries");
  redirect(back(periodPath(period), "ok", `Lançamento removido: ${entry.name}.`));
}

export async function addSalaryMembersAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const periodId = Number(formData.get("periodId"));
  const period = await requirePeriod(
    user,
    periodId,
    safePath(formData.get("redirectTo"), "/salaries"),
  );

  const characterIds = formData
    .getAll("characterIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (characterIds.length === 0) redirect(back(periodPath(period), "error", "Selecione ao menos um jogador."));

  const added = addSalaryMembers(period.id, period.server_id, characterIds);

  logAudit({
    user,
    action: "salary.member",
    entity: "salary_period",
    entityId: period.id,
    serverId: period.server_id,
    detail: `${added} membro(s) adicionado(s) ao elenco da semana`,
  });

  revalidatePath("/salaries");
  redirect(
    back(
      periodPath(period),
      added > 0 ? "ok" : "error",
      added > 0 ? `${added} jogador(es) adicionado(s) ao elenco.` : "Nenhum jogador novo para adicionar.",
    ),
  );
}

export async function addSalaryTeamAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const periodId = Number(formData.get("periodId"));
  const teamId = Number(formData.get("teamId"));
  const period = await requirePeriod(
    user,
    periodId,
    safePath(formData.get("redirectTo"), "/salaries"),
  );

  if (!Number.isInteger(teamId) || teamId <= 0) {
    redirect(back(periodPath(period), "error", "Selecione um time."));
  }

  const ids = teamCharacterIds(period.server_id, teamId);
  if (ids.length === 0) {
    redirect(back(periodPath(period), "error", "Esse time não tem jogadores no ranking do servidor."));
  }

  const added = addSalaryMembers(period.id, period.server_id, ids);

  logAudit({
    user,
    action: "salary.member",
    entity: "salary_period",
    entityId: period.id,
    serverId: period.server_id,
    detail: `Time ${teamId}: ${added} membro(s) adicionado(s) ao elenco`,
  });

  revalidatePath("/salaries");
  redirect(back(periodPath(period), "ok", `${added} jogador(es) do time adicionado(s).`));
}

export async function updateSalaryMemberAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const periodId = Number(formData.get("periodId"));
  const characterId = Number(formData.get("characterId"));
  const period = await requirePeriod(
    user,
    periodId,
    safePath(formData.get("redirectTo"), "/salaries"),
  );

  const tierRaw = String(formData.get("tier") ?? "");
  if (!isSalaryTier(tierRaw)) redirect(back(periodPath(period), "error", "Coeficiente inválido."));

  const percentRaw = Number(formData.get("sharePercent"));
  if (!Number.isFinite(percentRaw)) redirect(back(periodPath(period), "error", "Percentual inválido."));
  const sharePercent = Math.max(0, Math.min(100, Math.round(percentRaw)));

  const preferenceRaw = String(formData.get("preference") ?? "darksteel");
  if (!isSalaryPreference(preferenceRaw)) {
    redirect(back(periodPath(period), "error", "Preferência inválida."));
  }

  const stoneSplitRaw = String(formData.get("stoneSplit") ?? "half");
  if (!isStoneSplit(stoneSplitRaw)) {
    redirect(back(periodPath(period), "error", "Divisão da pedra inválida."));
  }

  const attendedHeist = formData.get("attendedHeist") === "1";
  const attendedAltar = formData.get("attendedAltar") === "1";
  const attendedVale = formData.get("attendedVale") === "1";
  const attendedCount = [attendedHeist, attendedAltar, attendedVale].filter(Boolean).length;

  const updated = updateSalaryMember({
    periodId: period.id,
    characterId,
    tier: tierRaw,
    sharePercent,
    attendedHeist,
    attendedAltar,
    attendedVale,
    preference: preferenceRaw,
    stoneSplit: stoneSplitRaw,
  });

  if (!updated) redirect(back(periodPath(period), "error", "Jogador não está no elenco desta semana."));

  logAudit({
    user,
    action: "salary.member.update",
    entity: "salary_period",
    entityId: period.id,
    serverId: period.server_id,
    detail: `Personagem ${characterId}: ${tierRaw}, ${sharePercent}%, presenças ${attendedCount}/3, ${
      preferenceRaw === "stone" ? `pedra (${stoneSplitLabel(stoneSplitRaw)})` : preferenceRaw
    }`,
  });

  revalidatePath("/salaries");
  redirect(back(periodPath(period), "ok", "Pagamento do jogador atualizado."));
}

export async function removeSalaryMemberAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const periodId = Number(formData.get("periodId"));
  const characterId = Number(formData.get("characterId"));
  const period = await requirePeriod(
    user,
    periodId,
    safePath(formData.get("redirectTo"), "/salaries"),
  );

  removeSalaryMember(period.id, characterId);

  logAudit({
    user,
    action: "salary.member.remove",
    entity: "salary_period",
    entityId: period.id,
    serverId: period.server_id,
    detail: `Personagem ${characterId} removido do elenco da semana`,
  });

  revalidatePath("/salaries");
  redirect(back(periodPath(period), "ok", "Jogador removido do elenco."));
}

export async function setSalaryWeightsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serverId = Number(formData.get("serverId"));
  const redirectTo = safePath(formData.get("redirectTo"), "/salaries");
  const server = getServerById(serverId);

  if (!server || !canAdminServer(user, serverId)) {
    redirect(back(redirectTo, "error", "Servidor inválido ou sem permissão para administrá-lo."));
  }

  const settings: { tier: (typeof SALARY_TIERS)[number]; weight: number; minPower: number }[] = [];
  for (const tier of SALARY_TIERS) {
    const weight = parseWeight(formData.get(`weight_${tier}`));
    if (weight === null) redirect(back(redirectTo, "error", `Coeficiente da faixa ${tier} inválido.`));

    const minPower = parseAmount(formData.get(`power_${tier}`));
    if (minPower === null) redirect(back(redirectTo, "error", `Poder mínimo da faixa ${tier} inválido.`));

    settings.push({ tier, weight, minPower });
  }

  for (const entry of settings) setSalaryTier(serverId, entry.tier, entry.weight, entry.minPower);

  logAudit({
    user,
    action: "salary.weights",
    entity: "server",
    entityId: serverId,
    serverId,
    detail: settings.map((entry) => `${entry.tier}=×${entry.weight}/poder ${entry.minPower}`).join(", "),
  });

  revalidatePath("/salaries");
  redirect(back(redirectTo, "ok", "Coeficientes e poderes mínimos atualizados."));
}
