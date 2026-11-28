import { execute, queryAll, queryOne } from "./db";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locales";

export {
  addDays,
  ceWeekEnd,
  ceWeekStart,
  ceWeekTitle,
  shiftWeek,
  shortDay,
  shortWeekday,
  weekDays,
} from "./ce-dates";
import { ceWeekStart } from "./ce-dates";

/**
 * Calculadora de CE (Clan Expedition), espelhando a planilha da aliança:
 * runs por expedição, estátuas épicas, DS/energia, ouro (só em x2) e a
 * doação combinada dividida pelos participantes.
 */
export const CE_EXPEDITIONS = [
  { no: 11, name: "Ice Demon Deity MAJ" },
  { no: 10, name: "Chakravarti Darkmaur" },
  { no: 9, name: "Soul-Absorbing" },
  { no: 8, name: "Sanguinary" },
  { no: 7, name: "Azure" },
  { no: 6, name: "BTD" },
  { no: 5, name: "Infernal" },
  { no: 4, name: "Redmoon" },
  { no: 3, name: "Hell Rock" },
  { no: 2, name: "Demon Bull" },
  { no: 1, name: "Fox" },
] as const;

export type CeRun = "x0" | "x1" | "x2";

export const CE_RUNS: { value: CeRun; label: string }[] = [
  { value: "x0", label: "x0 · não roda" },
  { value: "x1", label: "x1 · 1 run" },
  { value: "x2", label: "x2 · 2 runs" },
];

export function isCeRun(value: string): value is CeRun {
  return value === "x0" || value === "x1" || value === "x2";
}

/** Plano de runs de um clã: número da CE → quantidade de runs. */
export type CePlan = Record<number, CeRun>;

/** Estátuas épicas: cada run pede 2 × número da CE (x2 dobra). */
export function epicStatues(no: number, run: CeRun): number {
  if (run === "x2") return no * 4;
  if (run === "x1") return no * 2;
  return 0;
}

/** DS e energia exigidos quando a CE entra no plano — não dobram com o x2. */
export function ceCost(no: number, run: CeRun): number {
  return run === "x0" ? 0 : no * 125_000;
}

/** Ouro da CE: 1.000 + 200 por nível, só nas CEs com 2 runs. */
export function ceGold(no: number, run: CeRun): number {
  return run === "x2" ? 1000 + (no - 1) * 200 : 0;
}

/** Taxa do ghost trade: 5% sobre o ouro do CE. */
export const CE_GHOST_TRADE_TAX = 0.05;
/** 6% entra só quando 5% deixaria o ouro com fração. */
export const CE_GHOST_TRADE_TAX_ROUNDED = 0.06;

/** Taxa efetiva: 5% ou, se 5% quebrar o ouro, 6%. */
export function ceGhostTradeTax(gold: number): number {
  if (gold <= 0) return CE_GHOST_TRADE_TAX;
  const fee = gold * CE_GHOST_TRADE_TAX;
  return Math.abs(fee - Math.round(fee)) < 1e-9 ? CE_GHOST_TRADE_TAX : CE_GHOST_TRADE_TAX_ROUNDED;
}

/** Ouro do CE mais a taxa do ghost trade, sempre em ouro inteiro. */
export function ceGoldWithGhostTrade(gold: number): number {
  if (gold <= 0) return 0;
  return gold + Math.ceil(gold * ceGhostTradeTax(gold));
}

export type CeSummary = {
  runs: CePlan;
  statues: number;
  darksteel: number;
  energy: number;
  gold: number;
  requiredGold: number;
};

export function ceSummary(runs: CePlan): CeSummary {
  let statues = 0;
  let darksteel = 0;
  let energy = 0;
  let gold = 0;

  for (const ce of CE_EXPEDITIONS) {
    const run = runs[ce.no] ?? "x0";
    statues += epicStatues(ce.no, run);
    darksteel += ceCost(ce.no, run);
    energy += ceCost(ce.no, run);
    gold += ceGold(ce.no, run);
  }

  return {
    runs,
    statues,
    darksteel,
    energy,
    gold,
    requiredGold: ceGoldWithGhostTrade(gold),
  };
}

/* ------------------------------------------------------------------ */
/* Semanas                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Plano                                                               */
/* ------------------------------------------------------------------ */

export type CePlanRow = {
  id: number;
  server_id: number;
  clan_id: number;
  week_start: string;
  runs: string;
  participants: number;
  updated_at: string;
};

export type CePlanListItem = CePlanRow & {
  clan_name: string;
  donors_gold: number;
  statues: number;
};

export type CePlanState = {
  id: number | null;
  weekStart: string;
  clanId: number;
  runs: CePlan;
  participants: number;
  updatedAt: string | null;
};

/** Clã aliado do servidor, com a contagem de membros sincronizados. */
export type CeClan = {
  id: number;
  name: string;
  members: number;
};

/** Clãs aliados do servidor; cada um recebe seu próprio plano semanal de CE. */
export function ceAlliedClans(serverId: number): CeClan[] {
  return queryAll<CeClan>(
    `SELECT cl.id, cl.name, COUNT(c.id) AS members
     FROM clan_relations r
     JOIN clans cl ON cl.id = r.clan_id
     LEFT JOIN characters c ON c.clan_id = cl.id AND c.server_id = r.server_id AND c.gone_at IS NULL
     WHERE r.server_id = ? AND r.stance = 'ally'
     GROUP BY cl.id, cl.name
     ORDER BY cl.name COLLATE NOCASE ASC`,
    serverId,
  );
}

/** Clã aliado específico; undefined quando não é aliado do servidor. */
export function ceAlliedClan(serverId: number, clanId: number): CeClan | undefined {
  return queryOne<CeClan>(
    `SELECT cl.id, cl.name, COUNT(c.id) AS members
     FROM clan_relations r
     JOIN clans cl ON cl.id = r.clan_id
     LEFT JOIN characters c ON c.clan_id = cl.id AND c.server_id = r.server_id AND c.gone_at IS NULL
     WHERE r.server_id = ? AND r.clan_id = ? AND r.stance = 'ally'
     GROUP BY cl.id, cl.name`,
    serverId,
    clanId,
  );
}

function emptyPlan(): CePlan {
  const runs: CePlan = {};
  for (const ce of CE_EXPEDITIONS) runs[ce.no] = "x0";
  return runs;
}

function parseRuns(raw: string): CePlan {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    data = {};
  }

  const runs = emptyPlan();
  for (const ce of CE_EXPEDITIONS) {
    const value = data[String(ce.no)];
    if (typeof value === "string" && isCeRun(value)) runs[ce.no] = value;
  }
  return runs;
}

function serializeRuns(runs: CePlan): string {
  const data: Record<string, CeRun> = {};
  for (const ce of CE_EXPEDITIONS) data[ce.no] = runs[ce.no] ?? "x0";
  return JSON.stringify(data);
}

export function cePlanRow(
  serverId: number,
  weekStart: string,
  clanId: number,
): CePlanRow | undefined {
  return queryOne<CePlanRow>(
    "SELECT * FROM ce_plans WHERE server_id = ? AND week_start = ? AND clan_id = ?",
    serverId,
    weekStart,
    clanId,
  );
}

/** Plano salvo do clã na semana; sem registro, tudo x0 e os membros do clã como padrão. */
export function getCePlan(serverId: number, weekStart: string, clanId: number): CePlanState {
  const row = cePlanRow(serverId, weekStart, clanId);
  if (!row) {
    return {
      id: null,
      weekStart,
      clanId,
      runs: emptyPlan(),
      participants: ceAlliedClan(serverId, clanId)?.members ?? 0,
      updatedAt: null,
    };
  }

  return {
    id: row.id,
    weekStart: row.week_start,
    clanId: row.clan_id,
    runs: parseRuns(row.runs),
    participants: row.participants,
    updatedAt: row.updated_at,
  };
}

export function listCePlans(serverId: number, limit = 100): CePlanListItem[] {
  const rows = queryAll<CePlanRow & { clan_name: string; donors_gold: number }>(
    `SELECT p.*, cl.name AS clan_name,
            (SELECT COUNT(*) FROM ce_donations d
              JOIN characters dc ON dc.id = d.character_id AND dc.gone_at IS NULL
              WHERE d.plan_id = p.id AND d.gold_done = 1) AS donors_gold
     FROM ce_plans p
     JOIN clans cl ON cl.id = p.clan_id
     WHERE p.server_id = ?
     ORDER BY p.week_start DESC, cl.name COLLATE NOCASE ASC
     LIMIT ?`,
    serverId,
    limit,
  );

  return rows.map((row) => ({
    ...row,
    statues: ceSummary(parseRuns(row.runs)).statues,
  }));
}

export function saveCePlan(input: {
  serverId: number;
  weekStart: string;
  clanId: number;
  runs: CePlan;
  participants: number;
  userId: number;
}): number {
  const existing = cePlanRow(input.serverId, input.weekStart, input.clanId);
  const participants = Math.max(0, Math.round(input.participants));
  const now = new Date().toISOString();

  if (existing) {
    execute(
      `UPDATE ce_plans
       SET runs = ?, participants = ?, updated_by = ?, updated_at = ?
       WHERE id = ?`,
      serializeRuns(input.runs),
      participants,
      input.userId,
      now,
      existing.id,
    );
    return existing.id;
  }

  return execute(
    `INSERT INTO ce_plans (server_id, clan_id, week_start, runs, participants, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.serverId,
    input.clanId,
    input.weekStart,
    serializeRuns(input.runs),
    participants,
    input.userId,
    now,
  ).lastInsertRowid;
}

/** Plano do clã na semana, criando um vazio quando ainda não existe (usado pelas doações). */
export function getOrCreateCePlan(input: {
  serverId: number;
  weekStart: string;
  clanId: number;
  userId: number;
}): number {
  const existing = cePlanRow(input.serverId, input.weekStart, input.clanId);
  if (existing) return existing.id;
  return saveCePlan({
    ...input,
    runs: emptyPlan(),
    participants: ceAlliedClan(input.serverId, input.clanId)?.members ?? 0,
  });
}

/* ------------------------------------------------------------------ */
/* Doações por membro                                                  */
/* ------------------------------------------------------------------ */

export type CeDonor = {
  character_id: number;
  name: string;
  power_score: number;
  clan_id: number;
  clan_name: string;
  /** 1 quando o membro é de outro clã aliado e foi trazido como convidado. */
  is_guest: number;
  gold_done: number;
};

/**
 * Membros do clã do plano mais os convidados de outros clãs aliados, com a
 * marca de ouro daquela semana.
 */
export function ceDonors(serverId: number, clanId: number, planId: number | null): CeDonor[] {
  return queryAll<CeDonor>(
    `SELECT c.id AS character_id, c.name, c.power_score,
            c.clan_id, cl.name AS clan_name,
            CASE WHEN c.clan_id = ? THEN 0 ELSE 1 END AS is_guest,
            COALESCE(d.gold_done, 0) AS gold_done
     FROM characters c
     JOIN clans cl ON cl.id = c.clan_id
     LEFT JOIN ce_donations d ON d.character_id = c.id AND d.plan_id = ?
     WHERE c.server_id = ? AND c.gone_at IS NULL
       AND (c.clan_id = ? OR c.id IN (SELECT character_id FROM ce_plan_guests WHERE plan_id = ?))
     ORDER BY is_guest ASC, c.power_score DESC, c.name COLLATE NOCASE ASC
     LIMIT 300`,
    clanId,
    planId ?? 0,
    serverId,
    clanId,
    planId ?? 0,
  );
}

/** Membro de outro clã aliado que pode entrar como convidado no plano. */
export type CeGuestCandidate = {
  id: number;
  name: string;
  power_score: number;
  clan_id: number;
  clan_name: string;
};

/** Elenco de fora do clã (outros aliados), para escolher um convidado. */
export function ceGuestCandidates(serverId: number, clanId: number): CeGuestCandidate[] {
  return queryAll<CeGuestCandidate>(
    `SELECT c.id, c.name, c.power_score, cl.id AS clan_id, cl.name AS clan_name
     FROM characters c
     JOIN clans cl ON cl.id = c.clan_id
     JOIN clan_relations r
       ON r.server_id = c.server_id AND r.clan_id = c.clan_id AND r.stance = 'ally'
     WHERE c.server_id = ? AND c.clan_id <> ? AND c.gone_at IS NULL
     ORDER BY cl.name COLLATE NOCASE ASC, c.power_score DESC, c.name COLLATE NOCASE ASC
     LIMIT 500`,
    serverId,
    clanId,
  );
}

/** Convidado válido: personagem do servidor, de outro clã aliado. */
export function ceGuestCandidate(
  serverId: number,
  clanId: number,
  characterId: number,
): { id: number; name: string } | undefined {
  return queryOne<{ id: number; name: string }>(
    `SELECT c.id, c.name
     FROM characters c
     JOIN clan_relations r
       ON r.server_id = c.server_id AND r.clan_id = c.clan_id AND r.stance = 'ally'
     WHERE c.server_id = ? AND c.id = ? AND c.clan_id <> ? AND c.gone_at IS NULL`,
    serverId,
    characterId,
    clanId,
  );
}

/** Coloca o membro de outro clã na lista de doações do plano. */
export function addCeGuest(planId: number, characterId: number): void {
  execute(
    `INSERT OR IGNORE INTO ce_plan_guests (plan_id, character_id, added_at)
     VALUES (?, ?, ?)`,
    planId,
    characterId,
    new Date().toISOString(),
  );
}

/** Tira o convidado do plano junto com a doação dele. */
export function removeCeGuest(planId: number, characterId: number): void {
  execute("DELETE FROM ce_plan_guests WHERE plan_id = ? AND character_id = ?", planId, characterId);
  execute("DELETE FROM ce_donations WHERE plan_id = ? AND character_id = ?", planId, characterId);
}

/** Doação permitida para membro do clã do plano ou convidado já registrado. */
export function ceDonorAllowed(
  planId: number,
  characterId: number,
  serverId: number,
  clanId: number,
): boolean {
  if (characterInClan(characterId, serverId, clanId)) return true;
  return Boolean(
    queryOne<{ character_id: number }>(
      "SELECT character_id FROM ce_plan_guests WHERE plan_id = ? AND character_id = ?",
      planId,
      characterId,
    ),
  );
}

/** Confirma que o personagem é do clã e do servidor do plano. */
export function characterInClan(characterId: number, serverId: number, clanId: number): boolean {
  return Boolean(
    queryOne<{ id: number }>(
      "SELECT id FROM characters WHERE id = ? AND server_id = ? AND clan_id = ? AND gone_at IS NULL",
      characterId,
      serverId,
      clanId,
    ),
  );
}

/** Grava a doação de ouro de um membro; desmarcado, a linha sai da tabela. */
export function setCeDonation(input: {
  planId: number;
  characterId: number;
  gold: boolean;
}): void {
  if (!input.gold) {
    execute(
      "DELETE FROM ce_donations WHERE plan_id = ? AND character_id = ?",
      input.planId,
      input.characterId,
    );
    return;
  }

  execute(
    `INSERT INTO ce_donations (plan_id, character_id, gold_done, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(plan_id, character_id) DO UPDATE SET
       gold_done = 1,
       updated_at = excluded.updated_at`,
    input.planId,
    input.characterId,
    new Date().toISOString(),
  );
}
