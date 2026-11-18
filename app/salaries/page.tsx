import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { AutoSave } from "@/components/AutoSave";
import { ClearValueButton } from "@/components/ClearValueButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyPlayerName } from "@/components/CopyPlayerName";
import { EmptyState, Flash, StatCard } from "@/components/ui";
import { formatNumber, formatPower, normalizeSearch } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/locales";
import type { T } from "@/lib/i18n";
import {
  listSalaryPeriods,
  periodTitle,
  SALARY_ACTIVITIES,
  SALARY_MEMBER_CAP,
  SALARY_PREFERENCES,
  SALARY_STONE_SPLITS,
  SALARY_TIERS,
  SALARY_VALES,
  salaryAlliedClans,
  salaryCandidates,
  salaryEntries,
  salarySummary,
  salaryTiers,
  salaryValeEntries,
  salaryWeekRange,
  STONE_PRICES,
  stonePurchase,
  stoneSplitValues,
} from "@/lib/salaries";
import type { SalarySummary, StonePurchase } from "@/lib/salaries";
import {
  addAlliedSalaryMembersAction,
  addSalaryEntryAction,
  addSalaryMembersAction,
  createSalaryPeriodAction,
  deleteSalaryEntryAction,
  deleteSalaryPeriodAction,
  removeSalaryMemberAction,
  setSalaryProductionSlotAction,
  setSalaryWeightsAction,
  toggleSalaryPaidAction,
  updateSalaryMemberAction,
} from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("salary.metadata") };
}

export const dynamic = "force-dynamic";

type SearchParams = {
  server?: string;
  period?: string;
  q?: string;
  rq?: string;
  clan?: string;
  tier?: string;
  team?: string;
  pref?: string;
  sort?: string;
  dir?: string;
  presence?: string;
  paid?: string;
  ok?: string;
  error?: string;
};

type SortDir = "asc" | "desc";
type RosterSort = "name" | "power" | "salary" | "presence";
type PresenceFilter = "all" | "with" | "without";
type PaidFilter = "all" | "pending" | "paid";
type TeamFilter = "all" | "none";
type PrefFilter = "all" | "darksteel" | "stone";

function isRosterSort(value: string | undefined): value is RosterSort {
  return value === "name" || value === "power" || value === "salary" || value === "presence";
}

/** Pontos podem ter fração de 1/3; mostra até duas casas. */
function decimal(value: number, locale: Locale): string {
  return value.toLocaleString(INTL_LOCALE[locale], { maximumFractionDigits: 2 });
}

export default async function SalariesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canEditServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;
  const search = (params.q ?? "").trim().slice(0, 60);
  // Filtros do elenco: busca por nome e clã, separados da busca de candidatos.
  const rosterQuery = (params.rq ?? "").trim().slice(0, 60);
  const clanFilter = (params.clan ?? "").trim().slice(0, 60);
  const requestedTier = (params.tier ?? "").trim();
  const tierFilter = (SALARY_TIERS as readonly string[]).includes(requestedTier) ? requestedTier : null;
  const teamFilter: TeamFilter = params.team === "none" ? "none" : "all";
  const prefFilter: PrefFilter =
    params.pref === "darksteel" || params.pref === "stone" ? params.pref : "all";

  const periods = selected ? listSalaryPeriods(selected.id) : [];
  const requestedPeriod = Number(params.period);
  const period = periods.find((entry) => entry.id === requestedPeriod) ?? periods[0] ?? null;

  const tiers = selected && period ? salaryTiers(selected.id) : [];
  const summary = period ? salarySummary(period.id, tiers) : null;
  const vales = period ? salaryValeEntries(period.id) : [];
  const fixedEntries = period ? salaryEntries(period.id, "fixed") : [];
  const candidates = selected ? salaryCandidates(selected.id, search) : [];
  const alliedClans = selected ? salaryAlliedClans(selected.id) : 0;
  // Semana do salário por padrão: quinta a quarta (vale e pagamento).
  const weekDefaults = salaryWeekRange();

  const presence: PresenceFilter =
    params.presence === "with" || params.presence === "without" ? params.presence : "all";
  const paidFilter: PaidFilter = params.paid === "pending" || params.paid === "paid" ? params.paid : "all";
  const sortKey: RosterSort = isRosterSort(params.sort) ? params.sort : "name";
  const sortDir: SortDir = params.dir === "desc" ? "desc" : "asc";

  const members = summary ? summary.members : [];
  const rosterTerm = normalizeSearch(rosterQuery);
  const clanOptions = Array.from(
    new Set(members.map((member) => member.clan).filter((clan): clan is string => Boolean(clan))),
  ).sort((a, b) => a.localeCompare(b, INTL_LOCALE[locale], { sensitivity: "base" }));
  const membersWithTeam = members.filter((member) => Boolean(member.team_name)).length;
  const darksteelMembers = members.filter((member) => member.preference === "darksteel").length;
  const stonePreferenceMembers = members.filter((member) => member.preference === "stone").length;
  const rosterFiltered =
    rosterQuery !== "" ||
    clanFilter !== "" ||
    tierFilter !== null ||
    teamFilter !== "all" ||
    prefFilter !== "all";
  const visibleMembers = members
    .filter((member) =>
      presence === "all" ? true : presence === "with" ? member.attendedCount > 0 : member.attendedCount === 0,
    )
    .filter((member) =>
      paidFilter === "all" ? true : paidFilter === "paid" ? Boolean(member.paid_at) : !member.paid_at,
    )
    .filter((member) => rosterTerm === "" || normalizeSearch(member.name).includes(rosterTerm))
    .filter((member) => clanFilter === "" || member.clan === clanFilter)
    .filter((member) => tierFilter === null || member.tier === tierFilter)
    .filter((member) => teamFilter === "all" || !member.team_name)
    .filter((member) => prefFilter === "all" || member.preference === prefFilter)
    .sort((a, b) => {
      const factor = sortDir === "asc" ? 1 : -1;
      const byName = a.name.localeCompare(b.name, INTL_LOCALE[locale], { sensitivity: "base" });
      if (sortKey === "power") return (a.power_score - b.power_score) * factor || byName;
      if (sortKey === "salary") return (a.salary - b.salary) * factor || byName;
      if (sortKey === "presence") return (a.attendedCount - b.attendedCount) * factor || byName;
      return byName * factor;
    });

  const withPresence = members.filter((member) => member.attendedCount > 0).length;
  const paidMembers = members.filter((member) => member.paid_at).length;
  const visiblePaid = visibleMembers.reduce((sum, member) => sum + member.salary, 0);
  const filtered = presence !== "all" || paidFilter !== "all" || rosterFiltered;

  // Pedras da semana: soma as compras de cada membro, na mesma conversão da tabela.
  const stoneMembers = members.filter((member) => member.preference === "stone" && member.salary > 0);
  const yellow = stoneMembers.reduce(
    (total, member) => addStonePurchase(total, memberStonePurchase(member).yellow),
    stonePurchase(0, "yellow"),
  );
  const purple = stoneMembers.reduce(
    (total, member) => addStonePurchase(total, memberStonePurchase(member).purple),
    stonePurchase(0, "purple"),
  );
  const stones = {
    members: stoneMembers.length,
    half: stoneMembers.filter((member) => member.stone_split === "half").length,
  };
  const stoneLeftover = yellow.leftover + purple.leftover;

  const rosterHref = (overrides: {
    sort?: RosterSort;
    dir?: SortDir;
    presence?: PresenceFilter;
    paid?: PaidFilter;
    rq?: string;
    clan?: string;
    tier?: string | null;
    team?: TeamFilter;
    pref?: PrefFilter;
  }) => {
    const next = {
      sort: sortKey,
      dir: sortDir,
      presence,
      paid: paidFilter,
      rq: rosterQuery,
      clan: clanFilter,
      tier: tierFilter,
      team: teamFilter,
      pref: prefFilter,
      ...overrides,
    };
    const query = new URLSearchParams();
    if (selected) query.set("server", selected.code);
    if (period) query.set("period", String(period.id));
    if (search) query.set("q", search);
    if (next.sort !== "name" || next.dir !== "asc") {
      query.set("sort", next.sort);
      query.set("dir", next.dir);
    }
    if (next.presence !== "all") query.set("presence", next.presence);
    if (next.paid !== "all") query.set("paid", next.paid);
    if (next.rq) query.set("rq", next.rq);
    if (next.clan) query.set("clan", next.clan);
    if (next.tier !== null) query.set("tier", next.tier);
    if (next.team !== "all") query.set("team", next.team);
    if (next.pref !== "all") query.set("pref", next.pref);
    return `/salaries?${query.toString()}`;
  };

  const sortLink = (key: RosterSort) => ({
    href: rosterHref({ sort: key, dir: sortKey === key && sortDir === "asc" ? "desc" : "asc" }),
    className: `th-sort${sortKey === key ? " active" : ""}`,
    mark: sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "",
  });

  const mobileSort = (key: RosterSort, label: string) => {
    const link = sortLink(key);
    return (
      <Link key={key} className={`btn sm${sortKey === key ? " primary" : " ghost"}`} href={link.href}>
        {label}
        {link.mark}
      </Link>
    );
  };

  const returnTo = period
    ? `/salaries?server=${selected?.code ?? ""}&period=${period.id}`
    : selected
      ? `/salaries?server=${selected.code}`
      : "/salaries";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("salary.eyebrow")}</p>
          <h1 className="page-title">{t("salary.title")}</h1>
          <p className="page-sub">{t("salary.sub")}</p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/salaries?server=${server.code}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      {managed.length === 0 ? <div className="alert warn">{t("gest.noServers")}</div> : null}

      {selected ? (
        <>
          {summary ? (
            <div className="grid cols-4" style={{ marginBottom: 16 }}>
              <StatCard
                label={t("salary.statPool")}
                value={formatNumber(summary.pool, locale)}
                foot={t("salary.statPoolFoot", {
                  production: formatNumber(summary.production, locale),
                  costs: formatNumber(summary.fixedCosts, locale),
                })}
              />
              <StatCard
                label={t("salary.statPaid")}
                value={formatNumber(summary.paid, locale)}
                foot={t("salary.statPaidFoot", { attended: summary.attended, members: summary.members.length })}
              />
              <StatCard
                label={t("salary.statLeft")}
                value={formatNumber(summary.leftover, locale)}
                foot={t("salary.statLeftFoot")}
              />
              <StatCard
                label={t("salary.statBase")}
                value={formatNumber(Math.round(summary.base), locale)}
                foot={t("salary.statBaseFoot", { weight: formatNumber(summary.totalWeight, locale) })}
              />
            </div>
          ) : null}

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">{t("salary.weeksTitle", { server: selected.label })}</div>
                <div className="card-sub">{t("salary.weeksSub")}</div>
              </div>
              <div className="row">
                {period ? <span className="badge gold">{periodTitle(period, locale)}</span> : null}
                <span className="badge">{t("salary.weekCount", { count: periods.length })}</span>
              </div>
            </div>
            <div className="card-body">
              <form action={createSalaryPeriodAction} className="form-grid">
                <input type="hidden" name="serverId" value={selected.id} />
                <input type="hidden" name="redirectTo" value={`/salaries?server=${selected.code}`} />
                <div className="field">
                  <label htmlFor="startsOn">{t("salary.startsOn")}</label>
                  <input id="startsOn" name="startsOn" type="date" required defaultValue={weekDefaults.startsOn} />
                </div>
                <div className="field">
                  <label htmlFor="endsOn">{t("salary.endsOn")}</label>
                  <input id="endsOn" name="endsOn" type="date" required defaultValue={weekDefaults.endsOn} />
                </div>
                <div className="field">
                  <label htmlFor="label">{t("salary.labelOptional")}</label>
                  <input
                    id="label"
                    name="label"
                    type="text"
                    maxLength={40}
                    placeholder={t("salary.labelPlaceholder")}
                  />
                </div>
                <div className="full row">
                  <button className="btn primary" type="submit">
                    {t("salary.createWeek")}
                  </button>
                  <span className="small muted">{t("salary.createWeekNote")}</span>
                </div>
              </form>
            </div>
            {periods.length > 0 ? (
              <div className="list" style={{ borderTop: "1px solid var(--border-soft)" }}>
                {periods.map((entry) => (
                  <div key={entry.id} className="list-row">
                    <div>
                      <Link
                        className="player-name"
                        href={`/salaries?server=${selected.code}&period=${entry.id}`}
                      >
                        {periodTitle(entry, locale)}
                      </Link>
                      <div className="small muted">
                        {t("salary.periodLine", {
                          production: formatNumber(entry.production, locale),
                          costs: formatNumber(entry.fixed_costs, locale),
                          members: formatNumber(entry.members, locale),
                        })}
                      </div>
                    </div>
                    <div className="row">
                      <span className="badge">{formatNumber(entry.production - entry.fixed_costs, locale)}</span>
                      {period?.id === entry.id ? <span className="badge gold">{t("salary.weekOpen")}</span> : null}
                      <form action={deleteSalaryPeriodAction} className="inline-form">
                        <input type="hidden" name="periodId" value={entry.id} />
                        <input type="hidden" name="redirectTo" value={returnTo} />
                        <ConfirmButton
                          message={t("salary.deletePeriodConfirm", { period: periodTitle(entry, locale) })}
                        >
                          {t("common.remove")}
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {!period || !summary ? (
            <div className="alert">{t("salary.noWeeks", { server: selected.label })}</div>
          ) : (
            <>
              <div className="grid cols-2" style={{ marginBottom: 16 }}>
                <section className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">{t("salary.valesTitle")}</div>
                      <div className="card-sub">{t("salary.valesSub")}</div>
                    </div>
                    <span className="badge">{formatNumber(summary.production, locale)}</span>
                  </div>
                  <div className="card-body stack">
                    {SALARY_VALES.map((vale) => {
                      const entry = vales[vale.slot - 1];
                      return (
                        <div key={vale.slot}>
                          <div className="small muted" style={{ fontWeight: 600, marginBottom: 4 }}>
                            {vale.label}
                            {entry ? ` · ${formatNumber(entry.amount, locale)}` : ""}
                          </div>
                          <form
                            action={setSalaryProductionSlotAction}
                            className="filters"
                            style={{ margin: 0 }}
                          >
                            <AutoSave delay={500} />
                            <input type="hidden" name="periodId" value={period.id} />
                            <input type="hidden" name="slot" value={vale.slot} />
                            <input type="hidden" name="redirectTo" value={returnTo} />
                            <input
                              name="amount"
                              type="text"
                              inputMode="numeric"
                              defaultValue={entry ? String(entry.amount) : ""}
                              placeholder={t("salary.amountPlaceholder")}
                              aria-label={t("salary.amountAria", { vale: vale.label })}
                              style={{ flex: "1 1 160px" }}
                            />
                            <input type="hidden" name="clear" value="" />
                            {entry ? <ClearValueButton>{t("castleBoard.clear")}</ClearValueButton> : null}
                          </form>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">{t("salary.costsTitle")}</div>
                      <div className="card-sub">{t("salary.costsSub")}</div>
                    </div>
                    <span className="badge">{formatNumber(summary.fixedCosts, locale)}</span>
                  </div>
                  <div className="card-body">
                    <form action={addSalaryEntryAction} className="filters" style={{ marginBottom: 12 }}>
                      <input type="hidden" name="periodId" value={period.id} />
                      <input type="hidden" name="kind" value="fixed" />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <div className="field" style={{ flex: "1 1 160px" }}>
                        <label htmlFor="fixed-name">{t("salary.costLabel")}</label>
                        <input
                          id="fixed-name"
                          name="name"
                          type="text"
                          maxLength={60}
                          required
                          placeholder={t("salary.costPlaceholder")}
                        />
                      </div>
                      <div className="field" style={{ flex: "1 1 140px" }}>
                        <label htmlFor="fixed-amount">{t("salary.valueLabel")}</label>
                        <input
                          id="fixed-amount"
                          name="amount"
                          type="text"
                          inputMode="numeric"
                          required
                          placeholder={t("salary.valuePlaceholder")}
                        />
                      </div>
                      <button className="btn" type="submit">
                        {t("salary.post")}
                      </button>
                    </form>
                    {fixedEntries.length === 0 ? (
                      <p className="small muted">{t("salary.noCosts")}</p>
                    ) : (
                      <div className="list">
                        {fixedEntries.map((entry) => (
                          <div key={entry.id} className="list-row" style={{ padding: "9px 0" }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{entry.name}</div>
                              <div className="small muted mono">{formatNumber(entry.amount, locale)}</div>
                            </div>
                            <form action={deleteSalaryEntryAction} className="inline-form">
                              <input type="hidden" name="entryId" value={entry.id} />
                              <input type="hidden" name="redirectTo" value={returnTo} />
                              <button className="btn sm ghost" type="submit">
                                {t("common.remove")}
                              </button>
                            </form>
                          </div>
                        ))}
                        <div className="list-row" style={{ padding: "9px 0", fontWeight: 650 }}>
                          <span>{t("common.total")}</span>
                          <span className="mono">{formatNumber(summary.fixedCosts, locale)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <div>
                    <div className="card-title">{t("salary.tiersTitle", { server: selected.label })}</div>
                    <div className="card-sub">{t("salary.tiersSub")}</div>
                  </div>
                  {summary.pool < 0 ? <span className="badge err">{t("salary.costsOverProduction")}</span> : null}
                </div>
                <form action={setSalaryWeightsAction}>
                  <AutoSave />
                  <input type="hidden" name="serverId" value={selected.id} />
                  <input type="hidden" name="redirectTo" value={returnTo} />
                  <p className="table-hint">{t("salary.tableHint")}</p>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>{t("salary.colTier")}</th>
                          <th className="num">{t("salary.colMinPower")}</th>
                          <th className="num">{t("salary.colWeight")}</th>
                          <th className="num">{t("salary.colAttended")}</th>
                          <th className="num">{t("salary.colPoints")}</th>
                          <th className="num">{t("salary.colPool")}</th>
                          <th className="num">{t("salary.colSalary")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.tiers.map((tier) => (
                          <tr key={tier.tier}>
                            <td style={{ fontWeight: 700 }}>{tier.tier}</td>
                            <td className="num">
                              <input
                                name={`power_${tier.tier}`}
                                type="text"
                                inputMode="numeric"
                                defaultValue={tier.minPower}
                                aria-label={t("salary.minPowerAria", { tier: tier.tier })}
                                style={{ maxWidth: 104, marginLeft: "auto" }}
                              />
                            </td>
                            <td className="num">
                              <input
                                name={`weight_${tier.tier}`}
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                defaultValue={tier.weight}
                                aria-label={t("salary.weightAria", { tier: tier.tier })}
                                style={{ maxWidth: 90, marginLeft: "auto" }}
                              />
                            </td>
                            <td className="num mono">{tier.members}</td>
                            <td className="num mono">{decimal(tier.points, locale)}</td>
                            <td className="num mono">{formatNumber(Math.round(tier.pool), locale)}</td>
                            <td className="num mono">{formatNumber(Math.floor(tier.salary), locale)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td style={{ fontWeight: 650 }}>{t("common.total")}</td>
                          <td />
                          <td />
                          <td className="num mono">{summary.attended}</td>
                          <td className="num mono">{decimal(summary.totalWeight, locale)}</td>
                          <td className="num mono">{formatNumber(summary.pool, locale)}</td>
                          <td className="num small muted">
                            {t("salary.pointValue", { value: formatNumber(Math.round(summary.base), locale) })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="panel-body row">
                    <span className="small muted">
                      {t("salary.tiersExplain", { cap: formatNumber(SALARY_MEMBER_CAP, locale) })}
                    </span>
                  </div>
                </form>
              </section>

              <section className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <div>
                    <div className="card-title">{t("salary.rosterTitle")}</div>
                    <div className="card-sub">
                      {t("salary.rosterSub", {
                        attended: summary.attended,
                        members: summary.members.length,
                        darksteel: summary.preferences.darksteel,
                        stone: summary.preferences.stone,
                      })}
                    </div>
                  </div>
                  <div className="row">
                    <span className="badge">
                      {summary.attended}/{summary.members.length}
                    </span>
                    <span className="badge gold">
                      {t("salary.paidCount", { paid: paidMembers, total: members.length })}
                    </span>
                  </div>
                </div>
                {members.length > 0 ? (
                  <div className="roster-toolbar">
                    <div className="stack" style={{ gap: 8 }}>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        <span className="small muted">{t("salary.presence")}</span>
                        <Link
                          className={`btn sm${presence === "all" ? " primary" : " ghost"}`}
                          href={rosterHref({ presence: "all" })}
                        >
                          {t("salary.presenceAll", { count: members.length })}
                        </Link>
                        <Link
                          className={`btn sm${presence === "with" ? " primary" : " ghost"}`}
                          href={rosterHref({ presence: "with" })}
                        >
                          {t("salary.presenceWith", { count: withPresence })}
                        </Link>
                        <Link
                          className={`btn sm${presence === "without" ? " primary" : " ghost"}`}
                          href={rosterHref({ presence: "without" })}
                        >
                          {t("salary.presenceWithout", { count: members.length - withPresence })}
                        </Link>
                      </div>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        <span className="small muted">{t("salary.payment")}</span>
                        <Link
                          className={`btn sm${paidFilter === "all" ? " primary" : " ghost"}`}
                          href={rosterHref({ paid: "all" })}
                        >
                          {t("salary.paymentAll", { count: members.length })}
                        </Link>
                        <Link
                          className={`btn sm${paidFilter === "pending" ? " primary" : " ghost"}`}
                          href={rosterHref({ paid: "pending" })}
                        >
                          {t("salary.paymentPending", { count: members.length - paidMembers })}
                        </Link>
                        <Link
                          className={`btn sm${paidFilter === "paid" ? " primary" : " ghost"}`}
                          href={rosterHref({ paid: "paid" })}
                        >
                          {t("salary.paymentPaid", { count: paidMembers })}
                        </Link>
                      </div>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        <span className="small muted">{t("salary.teamFilter")}</span>
                        <Link
                          className={`btn sm${teamFilter === "all" ? " primary" : " ghost"}`}
                          href={rosterHref({ team: "all" })}
                        >
                          {t("salary.teamAll", { count: membersWithTeam })}
                        </Link>
                        <Link
                          className={`btn sm${teamFilter === "none" ? " primary" : " ghost"}`}
                          href={rosterHref({ team: "none" })}
                        >
                          {t("salary.teamNone", { count: members.length - membersWithTeam })}
                        </Link>
                      </div>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        <span className="small muted">{t("salary.prefFilter")}</span>
                        <Link
                          className={`btn sm${prefFilter === "all" ? " primary" : " ghost"}`}
                          href={rosterHref({ pref: "all" })}
                        >
                          {t("salary.prefAll", { count: members.length })}
                        </Link>
                        <Link
                          className={`btn sm${prefFilter === "darksteel" ? " primary" : " ghost"}`}
                          href={rosterHref({ pref: "darksteel" })}
                        >
                          {t("salary.pref.darksteel")} · {darksteelMembers}
                        </Link>
                        <Link
                          className={`btn sm${prefFilter === "stone" ? " primary" : " ghost"}`}
                          href={rosterHref({ pref: "stone" })}
                        >
                          {t("salary.pref.stone")} · {stonePreferenceMembers}
                        </Link>
                      </div>
                      <form className="filters roster-filters" action="/salaries" method="get">
                        <input type="hidden" name="server" value={selected.code} />
                        <input type="hidden" name="period" value={period.id} />
                        {sortKey !== "name" || sortDir !== "asc" ? (
                          <>
                            <input type="hidden" name="sort" value={sortKey} />
                            <input type="hidden" name="dir" value={sortDir} />
                          </>
                        ) : null}
                        {presence !== "all" ? <input type="hidden" name="presence" value={presence} /> : null}
                        {paidFilter !== "all" ? <input type="hidden" name="paid" value={paidFilter} /> : null}
                        {teamFilter !== "all" ? <input type="hidden" name="team" value={teamFilter} /> : null}
                        {prefFilter !== "all" ? <input type="hidden" name="pref" value={prefFilter} /> : null}
                        <div className="field" style={{ flex: "1 1 180px" }}>
                          <label htmlFor="rq">{t("salary.filterName")}</label>
                          <input
                            id="rq"
                            name="rq"
                            type="search"
                            defaultValue={rosterQuery}
                            placeholder={t("salary.filterNamePlaceholder")}
                          />
                        </div>
                        <div className="field" style={{ flex: "1 1 160px" }}>
                          <label htmlFor="roster-clan">{t("salary.filterClan")}</label>
                          <select id="roster-clan" name="clan" defaultValue={clanFilter}>
                            <option value="">{t("salary.clanAll")}</option>
                            {clanOptions.map((clan) => (
                              <option key={clan} value={clan}>
                                {clan}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field" style={{ flex: "1 1 140px" }}>
                          <label htmlFor="roster-tier">{t("salary.filterTier")}</label>
                          <select
                            id="roster-tier"
                            name="tier"
                            defaultValue={tierFilter ?? ""}
                          >
                            <option value="">{t("salary.tierAll")}</option>
                            {summary.tiers.map((tier) => (
                              <option key={tier.tier} value={tier.tier}>
                                {t("salary.tierOption", {
                                  tier: tier.tier,
                                  weight: formatNumber(tier.weight, locale),
                                })}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button className="btn sm" type="submit">
                          {t("common.filter")}
                        </button>
                        {rosterFiltered ? (
                          <Link
                            className="btn sm ghost"
                            href={rosterHref({ rq: "", clan: "", tier: null, team: "all", pref: "all" })}
                          >
                            {t("players.clear")}
                          </Link>
                        ) : null}
                      </form>
                    </div>
                    <span className="small muted">
                      {t("salary.showing", { visible: visibleMembers.length, total: members.length })}
                      {sortKey !== "name" || sortDir !== "asc" ? t("salary.sorted") : ""}
                    </span>
                  </div>
                ) : null}
                {members.length > 0 ? (
                  <div className="roster-sort-mobile">
                    <span className="small muted">{t("salary.sortBy")}</span>
                    {mobileSort("name", t("players.sortName"))}
                    {mobileSort("power", t("players.sortPower"))}
                    {mobileSort("presence", t("salary.presence"))}
                    {mobileSort("salary", t("salary.colSalary"))}
                  </div>
                ) : null}
                {stones.members > 0 ? (
                  <div className="stone-totals">
                    <span className="small muted">{t("salary.stonesTitle")}</span>
                    <span className="stone-color">
                      <span
                        className="badge gold"
                        title={t("salary.stoneYellowTitle", {
                          ds: formatNumber(STONE_PRICES.yellow.ds, locale),
                          points: formatNumber(STONE_PRICES.yellow.clanPoints, locale),
                        })}
                      >
                        {t("salary.stonesYellow", { count: formatNumber(yellow.stones, locale) })}
                      </span>
                      <span className="small muted mono">
                        {formatNumber(yellow.ds, locale)} DS · {formatNumber(yellow.clanPoints, locale)} pts
                      </span>
                    </span>
                    <span className="stone-color">
                      <span
                        className="badge purple"
                        title={t("salary.stonePurpleTitle", {
                          ds: formatNumber(STONE_PRICES.purple.ds, locale),
                          points: formatNumber(STONE_PRICES.purple.clanPoints, locale),
                        })}
                      >
                        {t("salary.stonesPurple", { count: formatNumber(purple.stones, locale) })}
                      </span>
                      <span className="small muted mono">
                        {formatNumber(purple.ds, locale)} DS · {formatNumber(purple.clanPoints, locale)} pts
                      </span>
                    </span>
                    <span className="small muted">
                      {t("salary.stonesMembers", { count: stones.members })}
                      {stones.half > 0 ? ` · ${t("salary.stonesHalf", { count: stones.half })}` : ""} ·{" "}
                      {t("salary.stonesTotal", {
                        ds: formatNumber(yellow.ds + purple.ds, locale),
                        points: formatNumber(yellow.clanPoints + purple.clanPoints, locale),
                      })}
                      {stoneLeftover > 0 ? ` · ${t("salary.stonesLeftover", { ds: formatNumber(stoneLeftover, locale) })}` : ""}
                    </span>
                  </div>
                ) : null}
                <div className="table-wrap">
                  {summary.members.length === 0 ? (
                    <EmptyState title={t("salary.rosterEmpty")}>{t("salary.rosterEmptyBody")}</EmptyState>
                  ) : (
                    <table className="data table-cards">
                      <thead>
                        <tr>
                          <th>
                            <Link className={sortLink("name").className} href={sortLink("name").href}>
                              {t("common.player")}
                              {sortLink("name").mark}
                            </Link>
                          </th>
                          <th>{t("common.clan")}</th>
                          <th className="num">
                            <Link className={sortLink("power").className} href={sortLink("power").href}>
                              {t("players.sortPower")}
                              {sortLink("power").mark}
                            </Link>
                          </th>
                          <th>
                            <Link
                              className={sortLink("presence").className}
                              href={sortLink("presence").href}
                              title={t("salary.sortPresence")}
                            >
                              {t("salary.colAdjust")}
                              {sortLink("presence").mark}
                            </Link>
                          </th>
                          <th className="num">
                            <Link className={sortLink("salary").className} href={sortLink("salary").href}>
                              {t("salary.colSalary")}
                              {sortLink("salary").mark}
                            </Link>
                          </th>
                          <th className="num" title={t("salary.stonesHint")}>
                            {t("salary.colStones")}
                          </th>
                          <th className="num" title={t("salary.paidHint")}>
                            {t("salary.colPaid")}
                          </th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMembers.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="small muted" style={{ textAlign: "center", padding: "18px 14px" }}>
                              {rosterFiltered
                                ? t("salary.noMemberSearch")
                                : presence === "with"
                                  ? t("salary.noMemberWith")
                                  : presence === "without"
                                    ? t("salary.noMemberWithout")
                                    : paidFilter === "paid"
                                      ? t("salary.noMemberPaid")
                                      : t("salary.noMemberPending")}
                            </td>
                          </tr>
                        ) : null}
                        {visibleMembers.map((member) => (
                          <tr key={member.character_id} className={member.paid_at ? "row-ok" : undefined}>
                            <td className="cell-title">
                              <CopyPlayerName name={member.name} href={`/players/${member.character_id}`} />
                              <div className="player-clan">
                                {member.team_name ? (
                                  <span
                                    className="badge"
                                    style={member.team_color ? { color: member.team_color } : undefined}
                                  >
                                    {member.team_name}
                                  </span>
                                ) : (
                                  <span className="muted">{t("salary.noTeam")}</span>
                                )}
                              </div>
                            </td>
                            <td className="small" data-label={t("common.clan")}>
                              {member.clan ?? <span className="muted">{t("common.noClan")}</span>}
                            </td>
                            <td className="num mono" data-label={t("players.colPower")}>
                              {formatPower(member.power_score, locale)}
                            </td>
                            <td className="cell-wide" data-label={t("salary.colAdjust")}>
                              <form action={updateSalaryMemberAction} className="salary-controls">
                                <AutoSave delay={500} />
                                <input type="hidden" name="periodId" value={period.id} />
                                <input type="hidden" name="characterId" value={member.character_id} />
                                <input type="hidden" name="redirectTo" value={rosterHref({})} />
                                <label className="mini-field">
                                  <span>{t("salary.miniTier")}</span>
                                  <select name="tier" defaultValue={member.tier}>
                                    {tiers.map((tier) => (
                                      <option key={tier.tier} value={tier.tier}>
                                        {t("salary.tierOption", {
                                          tier: tier.tier,
                                          weight: formatNumber(tier.weight, locale),
                                        })}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="mini-field narrow">
                                  <span>{t("salary.miniPenalty")}</span>
                                  <input
                                    name="penaltyPercent"
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={5}
                                    defaultValue={100 - member.share_percent}
                                  />
                                </label>
                                <div className="mini-field">
                                  <span>{t("salary.miniPresence")}</span>
                                  <div className="check-chips">
                                    {SALARY_ACTIVITIES.map((activity) => (
                                      <label
                                        key={activity.field}
                                        title={t("salary.activityTitle", { label: t(`salary.activity.${activity.field}`) })}
                                      >
                                        <input
                                          type="checkbox"
                                          name={`attended${activity.field[0].toUpperCase()}${activity.field.slice(1)}`}
                                          value="1"
                                          defaultChecked={member[`attended_${activity.field}` as "attended_heist" | "attended_altar" | "attended_vale"] === 1}
                                        />
                                        {t(`salary.activity.${activity.field}`)}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <label className="mini-field">
                                  <span>{t("salary.miniReward")}</span>
                                  <select name="preference" defaultValue={member.preference}>
                                    {SALARY_PREFERENCES.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {t(`salary.pref.${option.value}`)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                {member.preference === "stone" ? (
                                  <label className="mini-field">
                                    <span>{t("salary.miniStone")}</span>
                                    <select name="stoneSplit" defaultValue={member.stone_split}>
                                      {SALARY_STONE_SPLITS.map((split) => (
                                        <option key={split.value} value={split.value}>
                                          {t(`salary.split.${split.value}`)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : (
                                  <input type="hidden" name="stoneSplit" value={member.stone_split} />
                                )}
                              </form>
                            </td>
                            <td className="num mono" data-label={t("salary.colSalary")}>
                              {member.attendedCount > 0 ? (
                                <>
                                  {formatNumber(member.salary, locale)}
                                  <div className="small muted">
                                    {member.attendedCount}/3
                                    {member.share_percent !== 100
                                      ? ` · ${t("salary.penalty", { percent: 100 - member.share_percent })}`
                                      : ""}
                                  </div>
                                </>
                              ) : (
                                <span className="small muted">{t("salary.noPresence")}</span>
                              )}
                            </td>
                            <td className="num" data-label={t("salary.colStones")}>
                              <MemberStones member={member} locale={locale} t={t} />
                            </td>
                            <td className="cell-action" data-label={t("salary.colPaid")}>
                              <form action={toggleSalaryPaidAction} className="inline-form" style={{ justifyContent: "flex-end" }}>
                                <input type="hidden" name="periodId" value={period.id} />
                                <input type="hidden" name="characterId" value={member.character_id} />
                                <input type="hidden" name="redirectTo" value={rosterHref({})} />
                                <button
                                  type="submit"
                                  className={`btn sm${member.paid_at ? " ok" : " ghost"}`}
                                  aria-pressed={Boolean(member.paid_at)}
                                  title={member.paid_at ? t("salary.markUnpaid") : t("salary.markPaid")}
                                >
                                  {member.paid_at ? t("salary.paidLabel") : t("salary.markPaid")}
                                </button>
                              </form>
                            </td>
                            <td className="cell-action">
                              <form
                                action={removeSalaryMemberAction}
                                className="inline-form"
                                style={{ justifyContent: "flex-end" }}
                              >
                                <input type="hidden" name="periodId" value={period.id} />
                                <input type="hidden" name="characterId" value={member.character_id} />
                                <input type="hidden" name="redirectTo" value={rosterHref({})} />
                                <ConfirmButton message={t("salary.removeConfirm", { player: member.name })}>
                                  {t("common.remove")}
                                </ConfirmButton>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4} style={{ fontWeight: 650 }}>
                            {filtered ? t("salary.totalPaidFiltered") : t("salary.totalPaid")}
                          </td>
                          <td className="num mono" style={{ fontWeight: 650 }}>
                            {formatNumber(visiblePaid, locale)}
                          </td>
                          <td />
                          <td />
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </section>

              <details className="panel">
                <summary>{t("salary.addMembers")}</summary>
                <div className="panel-body stack">
                  <p className="small muted" style={{ margin: 0 }}>
                    {t("salary.onlyAllied", { server: selected.label, count: alliedClans })}{" "}
                    {t("salary.adjustStanceBefore")}
                    <Link href="/clans">{t("nav.clans")}</Link>
                    {t("salary.adjustStanceAfter")}
                  </p>

                  <form action={addAlliedSalaryMembersAction} className="row">
                    <input type="hidden" name="periodId" value={period.id} />
                    <input type="hidden" name="redirectTo" value={returnTo} />
                    <button className="btn primary" type="submit">
                      {t("salary.addAllAllied")}
                    </button>
                    <span className="small muted">{t("salary.addAllNote")}</span>
                  </form>

                  <form className="filters" action="/salaries" method="get">
                    <input type="hidden" name="server" value={selected.code} />
                    <input type="hidden" name="period" value={period.id} />
                    {sortKey !== "name" || sortDir !== "asc" ? (
                      <>
                        <input type="hidden" name="sort" value={sortKey} />
                        <input type="hidden" name="dir" value={sortDir} />
                      </>
                    ) : null}
                    {presence !== "all" ? <input type="hidden" name="presence" value={presence} /> : null}
                    {paidFilter !== "all" ? <input type="hidden" name="paid" value={paidFilter} /> : null}
                    {rosterQuery ? <input type="hidden" name="rq" value={rosterQuery} /> : null}
                    {clanFilter ? <input type="hidden" name="clan" value={clanFilter} /> : null}
                    {tierFilter !== null ? <input type="hidden" name="tier" value={tierFilter} /> : null}
                    {teamFilter !== "all" ? <input type="hidden" name="team" value={teamFilter} /> : null}
                    {prefFilter !== "all" ? <input type="hidden" name="pref" value={prefFilter} /> : null}
                    <div className="field" style={{ flex: "1 1 260px" }}>
                      <label htmlFor="q">{t("salary.searchLabel")}</label>
                      <input
                        id="q"
                        name="q"
                        type="search"
                        defaultValue={search}
                        placeholder={t("salary.searchPlaceholder")}
                      />
                    </div>
                    <button className="btn" type="submit">
                      {t("common.search")}
                    </button>
                    {search ? (
                      <Link className="btn ghost" href={returnTo}>
                        {t("players.clear")}
                      </Link>
                    ) : null}
                  </form>

                  {candidates.length === 0 ? (
                    <p className="small muted">
                      {alliedClans === 0
                        ? t("salary.noClans")
                        : search
                          ? t("salary.noCandidateSearch")
                          : t("salary.noCandidateAll")}
                    </p>
                  ) : (
                    <form action={addSalaryMembersAction} className="stack">
                      <input type="hidden" name="periodId" value={period.id} />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <div className="field" style={{ flex: "0 1 auto" }}>
                        <span>{t("salary.initialPresence")}</span>
                        <div className="check-chips">
                          {SALARY_ACTIVITIES.map((activity) => (
                            <label
                              key={activity.field}
                              title={t("salary.activityTitle", { label: t(`salary.activity.${activity.field}`) })}
                            >
                              <input
                                type="checkbox"
                                name={`attended${activity.field[0].toUpperCase()}${activity.field.slice(1)}`}
                                value="1"
                              />
                              {t(`salary.activity.${activity.field}`)}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="table-wrap">
                        <table className="data">
                          <thead>
                            <tr>
                              <th />
                              <th>{t("common.player")}</th>
                              <th>{t("salary.colClanTeam")}</th>
                              <th className="num">{t("players.colPower")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {candidates.map((candidate) => (
                              <tr key={candidate.id}>
                                <td>
                                  <label className="check">
                                    <input
                                      type="checkbox"
                                      name="characterIds"
                                      value={candidate.id}
                                      aria-label={t("salary.selectAria", { name: candidate.name })}
                                    />
                                  </label>
                                </td>
                                <td>{candidate.name}</td>
                                <td className="small">
                                  {candidate.clan ?? <span className="muted">{t("common.noClan")}</span>}
                                  {candidate.team_name ? (
                                    <span
                                      className="badge"
                                      style={{
                                        marginLeft: 6,
                                        ...(candidate.team_color ? { color: candidate.team_color } : {}),
                                      }}
                                    >
                                      {candidate.team_name}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="num mono">{formatPower(candidate.power_score, locale)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="row">
                        <button className="btn primary" type="submit">
                          {t("salary.addSelected")}
                        </button>
                        <span className="small muted">
                          {t("salary.tierNote", { tiers: SALARY_TIERS.join(" · ") })}
                        </span>
                      </div>
                    </form>
                  )}
                </div>
              </details>
            </>
          )}
        </>
      ) : null}
    </>
  );
}

type RosterMember = SalarySummary["members"][number];

function memberStonePurchase(member: RosterMember) {
  const split = stoneSplitValues(member.salary, member.stone_split);
  return {
    split,
    yellow: stonePurchase(split.yellow, "yellow"),
    purple: stonePurchase(split.purple, "purple"),
  };
}

function addStonePurchase(total: StonePurchase, entry: StonePurchase): StonePurchase {
  return {
    stones: total.stones + entry.stones,
    ds: total.ds + entry.ds,
    clanPoints: total.clanPoints + entry.clanPoints,
    leftover: total.leftover + entry.leftover,
  };
}

/** Quantas pedras de cada cor o membro leva, já convertidas pelo preço da loja. */
function MemberStones({ member, locale, t }: { member: RosterMember; locale: Locale; t: T }) {
  if (member.preference !== "stone") return <span className="small muted">{t("salary.darksteel")}</span>;
  if (member.salary <= 0) return <span className="small muted">—</span>;

  const { split, yellow, purple } = memberStonePurchase(member);

  return (
    <div className="stone-cell">
      <span className="badge gold" title={t("salary.yellowTitle", { value: formatNumber(split.yellow, locale) })}>
        A · {formatNumber(yellow.stones, locale)}
      </span>
      <span className="badge purple" title={t("salary.purpleTitle", { value: formatNumber(split.purple, locale) })}>
        R · {formatNumber(purple.stones, locale)}
      </span>
    </div>
  );
}
