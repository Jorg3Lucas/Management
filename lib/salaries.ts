import { execute, queryAll, queryOne, transaction } from "./db";

/**
 * Distribuição semanal do vale, no formato da planilha EU11 Masterfile:
 * produção dos três vales menos custos fixos, dividida por coeficiente entre os clãs aliados.
 * Cada atividade (heist, altar, vale) vale 1/3 do pagamento da faixa.
 */

export const SALARY_TIERS = ["A", "B", "C", "D", "E"] as const;
export type SalaryTier = (typeof SALARY_TIERS)[number];

/** Peso de cada faixa — aba COEFFICIENT da planilha (D vale 2,5). */
export const DEFAULT_SALARY_WEIGHTS: Record<SalaryTier, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2.5,
  E: 2,
};

/** Poder mínimo sugerido para cada faixa; editável por servidor. */
export const DEFAULT_SALARY_MIN_POWER: Record<SalaryTier, number> = {
  A: 500_000,
  B: 450_000,
  C: 390_000,
  D: 350_000,
  E: 0,
};

/** Os três vales da semana ocupam espaços fixos. */
export const SALARY_VALES = [
  { slot: 1, label: "1º vale" },
  { slot: 2, label: "2º vale" },
  { slot: 3, label: "3º vale" },
] as const;

/** Atividades que contam presença; cada uma paga 1/3 da faixa. */
export const SALARY_ACTIVITIES = [
  { field: "heist", label: "Heist" },
  { field: "altar", label: "Altar" },
  { field: "vale", label: "Vale" },
] as const;

/** Recompensa que o membro prefere receber pela participação. */
export const SALARY_PREFERENCES = [
  { value: "darksteel", label: "Darksteel" },
  { value: "stone", label: "Pedra" },
] as const;

export type SalaryPreference = (typeof SALARY_PREFERENCES)[number]["value"];

/** Para quem recebe pedra: quanto vai de amarela e quanto vai de roxa. */
export const SALARY_STONE_SPLITS = [
  { value: "half", label: "50% amarela + 50% roxa" },
  { value: "yellow", label: "100% amarela" },
  { value: "purple", label: "100% roxa" },
] as const;

/** Preço de compra das pedras na loja de clã: DS e pontos de clã por pedra. */
export const STONE_PRICES = {
  yellow: { ds: 2000, clanPoints: 160 },
  purple: { ds: 4500, clanPoints: 375 },
} as const;

export type StoneColor = keyof typeof STONE_PRICES;

export type StonePurchase = {
  stones: number;
  ds: number;
  clanPoints: number;
  /** Parte do valor que não fecha uma pedra inteira. */
  leftover: number;
};

/** Quantas pedras inteiras um valor de salário compra e quanto isso custa de fato. */
export function stonePurchase(value: number, color: StoneColor): StonePurchase {
  const price = STONE_PRICES[color];
  if (value <= 0) return { stones: 0, ds: 0, clanPoints: 0, leftover: 0 };
  const stones = Math.floor(value / price.ds);
  return {
    stones,
    ds: stones * price.ds,
    clanPoints: stones * price.clanPoints,
    leftover: value - stones * price.ds,
  };
}

export type StoneSplit = (typeof SALARY_STONE_SPLITS)[number]["value"];

export function isStoneSplit(value: string): value is StoneSplit {
  return SALARY_STONE_SPLITS.some((entry) => entry.value === value);
}

export function stoneSplitLabel(value: string): string {
  return SALARY_STONE_SPLITS.find((entry) => entry.value === value)?.label ?? value;
}

/** Divide o valor de um salário em pedra entre as cores (50/50 sem perder unidade). */
export function stoneSplitValues(value: number, split: StoneSplit): { yellow: number; purple: number } {
  if (value <= 0) return { yellow: 0, purple: 0 };
  if (split === "yellow") return { yellow: value, purple: 0 };
  if (split === "purple") return { yellow: 0, purple: value };
  const yellow = Math.floor(value / 2);
  return { yellow, purple: value - yellow };
}

export function isSalaryTier(value: string): value is SalaryTier {
  return (SALARY_TIERS as readonly string[]).includes(value);
}

export function isSalaryPreference(value: string): value is SalaryPreference {
  return SALARY_PREFERENCES.some((entry) => entry.value === value);
}

export function preferenceLabel(value: string): string {
  return SALARY_PREFERENCES.find((entry) => entry.value === value)?.label ?? value;
}

export type SalaryPeriodRow = {
  id: number;
  server_id: number;
  label: string | null;
  starts_on: string;
  ends_on: string;
  created_by: number | null;
  created_at: string;
};

export type SalaryPeriodSummaryRow = SalaryPeriodRow & {
  production: number;
  fixed_costs: number;
  members: number;
};

export type SalaryEntryRow = {
  id: number;
  period_id: number;
  kind: "production" | "fixed";
  slot: number | null;
  name: string;
  amount: number;
  note: string | null;
  created_at: string;
};

export type SalaryTierSetting = {
  tier: SalaryTier;
  weight: number;
  minPower: number;
};

export type SalaryMemberRow = {
  character_id: number;
  name: string;
  clan: string | null;
  power_score: number;
  tier: SalaryTier;
  share_percent: number;
  attended_heist: number;
  attended_altar: number;
  attended_vale: number;
  preference: SalaryPreference;
  stone_split: StoneSplit;
  note: string | null;
  team_name: string | null;
  team_color: string | null;
};

export type SalaryTierSummary = {
  tier: SalaryTier;
  weight: number;
  minPower: number;
  members: number;
  points: number;
  pool: number;
  salary: number;
};

export type SalarySummary = {
  production: number;
  fixedCosts: number;
  pool: number;
  totalWeight: number;
  base: number;
  tiers: SalaryTierSummary[];
  members: (SalaryMemberRow & { weight: number; attendedCount: number; salary: number })[];
  attended: number;
  preferences: Record<SalaryPreference, number>;
  paid: number;
  leftover: number;
};

/** "2026-11-03" → "03/11" — datas de semana são só dia, sem fuso. */
export function shortDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}` : value;
}

export function periodTitle(period: Pick<SalaryPeriodRow, "label" | "starts_on" | "ends_on">): string {
  const range = `${shortDay(period.starts_on)} – ${shortDay(period.ends_on)}`;
  return period.label ? `${period.label} (${range})` : range;
}

export function listSalaryPeriods(serverId: number, limit = 24): SalaryPeriodSummaryRow[] {
  return queryAll<SalaryPeriodSummaryRow>(
    `SELECT p.*,
            (SELECT COALESCE(SUM(e.amount), 0) FROM salary_entries e
              WHERE e.period_id = p.id AND e.kind = 'production') AS production,
            (SELECT COALESCE(SUM(e.amount), 0) FROM salary_entries e
              WHERE e.period_id = p.id AND e.kind = 'fixed') AS fixed_costs,
            (SELECT COUNT(*) FROM salary_members m WHERE m.period_id = p.id) AS members
     FROM salary_periods p
     WHERE p.server_id = ?
     ORDER BY p.starts_on DESC, p.id DESC
     LIMIT ?`,
    serverId,
    limit,
  );
}

export function getSalaryPeriod(id: number): SalaryPeriodRow | undefined {
  return queryOne<SalaryPeriodRow>("SELECT * FROM salary_periods WHERE id = ?", id);
}

export function createSalaryPeriod(input: {
  serverId: number;
  label: string | null;
  startsOn: string;
  endsOn: string;
  userId?: number | null;
}): number {
  const result = execute(
    `INSERT INTO salary_periods (server_id, label, starts_on, ends_on, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.serverId,
    input.label,
    input.startsOn,
    input.endsOn,
    input.userId ?? null,
    new Date().toISOString(),
  );
  return result.lastInsertRowid;
}

export function deleteSalaryPeriod(periodId: number): void {
  execute("DELETE FROM salary_periods WHERE id = ?", periodId);
}

export function salaryEntries(periodId: number, kind: "production" | "fixed"): SalaryEntryRow[] {
  return queryAll<SalaryEntryRow>(
    "SELECT * FROM salary_entries WHERE period_id = ? AND kind = ? ORDER BY COALESCE(slot, 9) ASC, amount DESC, id ASC",
    periodId,
    kind,
  );
}

/** Os três espaços de vale da semana, na ordem 1–3 (vazio quando ainda não lançado). */
export function salaryValeEntries(periodId: number): (SalaryEntryRow | undefined)[] {
  const rows = queryAll<SalaryEntryRow>(
    "SELECT * FROM salary_entries WHERE period_id = ? AND kind = 'production' ORDER BY slot ASC, id ASC",
    periodId,
  );
  const bySlot = new Map(rows.map((row) => [row.slot ?? 0, row]));
  return SALARY_VALES.map((vale) => bySlot.get(vale.slot));
}

/** Grava o vale no espaço dele; sem valor, o espaço fica vazio. */
export function setSalaryProductionSlot(input: {
  periodId: number;
  slot: number;
  name: string;
  amount: number | null;
}): void {
  transaction(() => {
    execute(
      "DELETE FROM salary_entries WHERE period_id = ? AND kind = 'production' AND slot = ?",
      input.periodId,
      input.slot,
    );
    if (input.amount === null || input.amount <= 0) return;
    execute(
      `INSERT INTO salary_entries (period_id, kind, slot, name, amount, note, created_at)
       VALUES (?, 'production', ?, ?, ?, NULL, ?)`,
      input.periodId,
      input.slot,
      input.name,
      input.amount,
      new Date().toISOString(),
    );
  });
}

export function addSalaryEntry(input: {
  periodId: number;
  kind: "production" | "fixed";
  name: string;
  amount: number;
  note?: string | null;
  slot?: number | null;
}): number {
  const result = execute(
    `INSERT INTO salary_entries (period_id, kind, slot, name, amount, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.periodId,
    input.kind,
    input.slot ?? null,
    input.name,
    input.amount,
    input.note ?? null,
    new Date().toISOString(),
  );
  return result.lastInsertRowid;
}

export function getSalaryEntry(id: number): SalaryEntryRow | undefined {
  return queryOne<SalaryEntryRow>("SELECT * FROM salary_entries WHERE id = ?", id);
}

export function deleteSalaryEntry(id: number): void {
  execute("DELETE FROM salary_entries WHERE id = ?", id);
}

/** Faixa sugerida pelo poder, respeitando os poderes mínimos configurados. */
export function tierForPower(power: number, tiers?: SalaryTierSetting[]): SalaryTier {
  const settings =
    tiers ??
    SALARY_TIERS.map((tier) => ({
      tier,
      weight: DEFAULT_SALARY_WEIGHTS[tier],
      minPower: DEFAULT_SALARY_MIN_POWER[tier],
    }));

  const sorted = [...settings].sort(
    (a, b) => b.minPower - a.minPower || SALARY_TIERS.indexOf(a.tier) - SALARY_TIERS.indexOf(b.tier),
  );
  for (const setting of sorted) {
    if (power >= setting.minPower) return setting.tier;
  }
  return sorted[sorted.length - 1]?.tier ?? "E";
}

/** Coeficientes do servidor; cria as faixas padrão na primeira leitura. */
export function salaryTiers(serverId: number): SalaryTierSetting[] {
  for (const tier of SALARY_TIERS) {
    execute(
      "INSERT OR IGNORE INTO salary_tiers (server_id, tier, weight, min_power) VALUES (?, ?, ?, ?)",
      serverId,
      tier,
      DEFAULT_SALARY_WEIGHTS[tier],
      DEFAULT_SALARY_MIN_POWER[tier],
    );
  }

  const rows = queryAll<{ tier: string; weight: number; min_power: number }>(
    "SELECT tier, weight, min_power FROM salary_tiers WHERE server_id = ?",
    serverId,
  );
  const settings = new Map(rows.map((row) => [row.tier, row]));
  return SALARY_TIERS.map((tier) => {
    const row = settings.get(tier);
    return {
      tier,
      weight: row?.weight ?? DEFAULT_SALARY_WEIGHTS[tier],
      minPower: row?.min_power ?? DEFAULT_SALARY_MIN_POWER[tier],
    };
  });
}

export function setSalaryTier(serverId: number, tier: SalaryTier, weight: number, minPower: number): void {
  execute(
    `INSERT INTO salary_tiers (server_id, tier, weight, min_power)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(server_id, tier) DO UPDATE SET weight = excluded.weight, min_power = excluded.min_power`,
    serverId,
    tier,
    weight,
    Math.max(0, Math.round(minPower)),
  );
}

export function salaryMembers(periodId: number): SalaryMemberRow[] {
  return queryAll<SalaryMemberRow>(
    `SELECT m.character_id,
            c.name,
            c.clan,
            c.power_score,
            m.tier,
            m.share_percent,
            m.attended_heist,
            m.attended_altar,
            m.attended_vale,
            m.preference,
            m.stone_split,
            m.note,
            t.name AS team_name,
            t.color AS team_color
     FROM salary_members m
     JOIN characters c ON c.id = m.character_id
     LEFT JOIN clan_teams ct ON ct.server_id = c.server_id AND ct.clan_id = c.clan_id
     LEFT JOIN teams t ON t.id = ct.team_id
     WHERE m.period_id = ?
     ORDER BY c.power_score DESC, c.name COLLATE NOCASE ASC`,
    periodId,
  );
}

/**
 * Adiciona personagens aliados do servidor ao elenco, já na faixa do poder mínimo configurado.
 * As presenças começam vazias: o admin marca heist, altar e vale depois.
 */
export function addSalaryMembers(periodId: number, serverId: number, characterIds: number[]): number {
  const ids = Array.from(new Set(characterIds.filter((id) => Number.isInteger(id) && id > 0))).slice(0, 300);
  if (ids.length === 0) return 0;

  const placeholders = ids.map(() => "?").join(",");
  const tiers = salaryTiers(serverId);
  const rows = queryAll<{ id: number; power_score: number }>(
    `SELECT c.id, c.power_score
     FROM characters c
     JOIN clan_relations r ON r.server_id = c.server_id AND r.clan_id = c.clan_id AND r.stance = 'ally'
     WHERE c.server_id = ? AND c.id IN (${placeholders})`,
    serverId,
    ...ids,
  );
  if (rows.length === 0) return 0;

  const now = new Date().toISOString();
  return transaction(() => {
    let added = 0;
    for (const row of rows) {
      added += execute(
        `INSERT OR IGNORE INTO salary_members
           (period_id, character_id, tier, share_percent, attended_heist, attended_altar, attended_vale, preference, updated_at)
         VALUES (?, ?, ?, 100, 0, 0, 0, 'darksteel', ?)`,
        periodId,
        row.id,
        tierForPower(row.power_score, tiers),
        now,
      ).changes;
    }
    return added;
  });
}

export function updateSalaryMember(input: {
  periodId: number;
  characterId: number;
  tier: SalaryTier;
  sharePercent: number;
  attendedHeist: boolean;
  attendedAltar: boolean;
  attendedVale: boolean;
  preference: SalaryPreference;
  stoneSplit: StoneSplit;
}): boolean {
  const result = execute(
    `UPDATE salary_members
     SET tier = ?, share_percent = ?, attended_heist = ?, attended_altar = ?, attended_vale = ?,
         preference = ?, stone_split = ?, updated_at = ?
     WHERE period_id = ? AND character_id = ?`,
    input.tier,
    Math.max(0, Math.min(100, Math.round(input.sharePercent))),
    input.attendedHeist ? 1 : 0,
    input.attendedAltar ? 1 : 0,
    input.attendedVale ? 1 : 0,
    input.preference,
    input.stoneSplit,
    new Date().toISOString(),
    input.periodId,
    input.characterId,
  );
  return result.changes > 0;
}

export function removeSalaryMember(periodId: number, characterId: number): void {
  execute("DELETE FROM salary_members WHERE period_id = ? AND character_id = ?", periodId, characterId);
}

/** Quantos clãs do servidor estão marcados como aliados. */
export function salaryAlliedClans(serverId: number): number {
  return (
    queryOne<{ total: number }>(
      "SELECT COUNT(*) AS total FROM clan_relations WHERE server_id = ? AND stance = 'ally'",
      serverId,
    )?.total ?? 0
  );
}

export type SalaryCandidateRow = {
  id: number;
  name: string;
  clan: string | null;
  power_score: number;
  team_name: string | null;
  team_color: string | null;
};

/** Jogadores aliados do servidor que ainda não estão no elenco da semana. */
export function salaryCandidates(
  periodId: number,
  serverId: number,
  search: string,
  limit = 200,
): SalaryCandidateRow[] {
  const terms: string[] = [];
  let filter = "";
  if (search) {
    filter = "AND (c.name LIKE ? OR c.clan LIKE ?)";
    const term = `%${search}%`;
    terms.push(term, term);
  }

  return queryAll<SalaryCandidateRow>(
    `SELECT c.id, c.name, c.clan, c.power_score,
            t.name AS team_name, t.color AS team_color
     FROM characters c
     JOIN clan_relations r ON r.server_id = c.server_id AND r.clan_id = c.clan_id AND r.stance = 'ally'
     LEFT JOIN clan_teams ct ON ct.server_id = c.server_id AND ct.clan_id = c.clan_id
     LEFT JOIN teams t ON t.id = ct.team_id
     WHERE c.server_id = ?
       AND c.id NOT IN (SELECT m.character_id FROM salary_members m WHERE m.period_id = ?)
       ${filter}
     ORDER BY c.power_score DESC, c.name COLLATE NOCASE ASC
     LIMIT ?`,
    serverId,
    periodId,
    ...terms,
    limit,
  );
}

/** Personagens aliados do servidor que pertencem ao time (clãs vinculados ao time). */
export function teamCharacterIds(serverId: number, teamId: number, limit = 300): number[] {
  return queryAll<{ id: number }>(
    `SELECT c.id
     FROM characters c
     JOIN clan_relations r ON r.server_id = c.server_id AND r.clan_id = c.clan_id AND r.stance = 'ally'
     JOIN clan_teams ct ON ct.server_id = c.server_id AND ct.clan_id = c.clan_id
     WHERE c.server_id = ? AND ct.team_id = ?
     ORDER BY c.power_score DESC
     LIMIT ?`,
    serverId,
    teamId,
    limit,
  ).map((row) => row.id);
}

/**
 * Fecha as contas da semana: prêmio, coeficientes e salário de cada membro.
 * Cada presença (heist, altar, vale) vale 1/3 do pagamento da faixa.
 */
export function salarySummary(periodId: number, tiers: SalaryTierSetting[]): SalarySummary {
  const production =
    queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM salary_entries WHERE period_id = ? AND kind = 'production'",
      periodId,
    )?.total ?? 0;

  const fixedCosts =
    queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM salary_entries WHERE period_id = ? AND kind = 'fixed'",
      periodId,
    )?.total ?? 0;

  const pool = production - fixedCosts;
  const weightByTier = new Map(tiers.map((entry) => [entry.tier, entry.weight]));
  const members = salaryMembers(periodId).map((member) => ({
    ...member,
    attendedCount:
      (member.attended_heist === 1 ? 1 : 0) +
      (member.attended_altar === 1 ? 1 : 0) +
      (member.attended_vale === 1 ? 1 : 0),
  }));

  let totalWeight = 0;
  for (const member of members) {
    totalWeight += ((weightByTier.get(member.tier) ?? 0) * member.attendedCount) / 3;
  }

  const base = totalWeight > 0 ? pool / totalWeight : 0;

  const counts = new Map<SalaryTier, number>();
  const points = new Map<SalaryTier, number>();
  for (const member of members) {
    if (member.attendedCount === 0) continue;
    const weight = weightByTier.get(member.tier) ?? 0;
    counts.set(member.tier, (counts.get(member.tier) ?? 0) + 1);
    points.set(member.tier, (points.get(member.tier) ?? 0) + (weight * member.attendedCount) / 3);
  }

  const tierSummaries: SalaryTierSummary[] = tiers.map((entry) => {
    const count = counts.get(entry.tier) ?? 0;
    const tierPoints = points.get(entry.tier) ?? 0;
    return {
      tier: entry.tier,
      weight: entry.weight,
      minPower: entry.minPower,
      members: count,
      points: tierPoints,
      pool: totalWeight > 0 ? (pool * tierPoints) / totalWeight : 0,
      salary: entry.weight * base,
    };
  });

  const preferences: Record<SalaryPreference, number> = { darksteel: 0, stone: 0 };
  for (const member of members) {
    if (member.attendedCount === 0) continue;
    preferences[member.preference] += 1;
  }

  const priced = members.map((member) => {
    const weight = weightByTier.get(member.tier) ?? 0;
    const salary =
      totalWeight > 0 && member.attendedCount > 0
        ? Math.floor(
            (weight * pool * member.share_percent * member.attendedCount) / (totalWeight * 100 * 3),
          )
        : 0;
    return { ...member, weight, salary };
  });

  const paid = priced.reduce((sum, member) => sum + member.salary, 0);

  return {
    production,
    fixedCosts,
    pool,
    totalWeight,
    base,
    tiers: tierSummaries,
    members: priced,
    attended: members.filter((member) => member.attendedCount > 0).length,
    preferences,
    paid,
    leftover: pool - paid,
  };
}
