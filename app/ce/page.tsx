import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { AutoSave } from "@/components/AutoSave";
import { CopyPlayerName } from "@/components/CopyPlayerName";
import { Flash, StatCard } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/time";
import {
  CE_EXPEDITIONS,
  CE_GHOST_TRADE_TAX,
  CE_GHOST_TRADE_TAX_ROUNDED,
  CE_RUNS,
  ceAlliedClans,
  ceDonors,
  ceGuestCandidates,
  ceSummary,
  ceWeekStart,
  ceWeekTitle,
  epicStatues,
  getCePlan,
  listCePlans,
  shiftWeek,
} from "@/lib/ce";
import { addCeGuestAction, removeCeGuestAction, saveCeDonationAction, saveCePlanAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("ce.metadata") };
}

export const dynamic = "force-dynamic";

type SearchParams = {
  server?: string;
  week?: string;
  clan?: string;
  ok?: string;
  error?: string;
};

export default async function CePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canEditServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  const currentWeek = ceWeekStart();
  const weekStart = ceWeekStart(params.week ?? currentWeek);

  const weeks = selected ? listCePlans(selected.id) : [];
  const alliedClans = selected ? ceAlliedClans(selected.id) : [];
  const clanPlans = alliedClans.map((clan) => {
    const plan = getCePlan(selected!.id, weekStart, clan.id);
    const summary = ceSummary(plan.runs);
    const donors = ceDonors(selected!.id, clan.id, plan.id);
    return {
      clan,
      plan,
      summary,
      donors,
      donated: donors.filter((donor) => donor.gold_done === 1).length,
      expected: plan.participants > 0 ? summary.requiredGold / plan.participants : 0,
    };
  });

  const activeClan =
    clanPlans.find((entry) => String(entry.clan.id) === params.clan) ?? clanPlans[0] ?? null;
  const activeHistory = activeClan
    ? weeks.filter((entry) => entry.clan_id === activeClan.clan.id)
    : [];

  // Gente de outro clã aliado que pode entrar na CE desta semana como convidada.
  const guestCandidates =
    selected && activeClan ? ceGuestCandidates(selected.id, activeClan.clan.id) : [];
  const guestGroups = new Map<string, typeof guestCandidates>();
  for (const candidate of guestCandidates) {
    const list = guestGroups.get(candidate.clan_name) ?? [];
    list.push(candidate);
    guestGroups.set(candidate.clan_name, list);
  }

  const weekHref = (week: string) => `/ce?server=${selected?.code ?? ""}&week=${week}`;
  const clanHref = (clanId: number, week = weekStart) =>
    `/ce?server=${selected?.code ?? ""}&week=${week}&clan=${clanId}`;
  const returnTo = activeClan ? clanHref(activeClan.clan.id) : weekHref(weekStart);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("nav.operation")}</p>
          <h1 className="page-title">{t("ce.title")}</h1>
          <p className="page-sub">{t("ce.sub")}</p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/ce?server=${server.code}&week=${weekStart}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      {managed.length === 0 ? <div className="alert warn">{t("gest.noEditServers")}</div> : null}

      {selected ? (
        <>
          <div className="row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
            <Link
              className="btn sm ghost"
              href={activeClan ? clanHref(activeClan.clan.id, shiftWeek(weekStart, -1)) : weekHref(shiftWeek(weekStart, -1))}
              aria-label={t("week.prev")}
            >
              ←
            </Link>
            <span className="badge gold">{ceWeekTitle(weekStart, locale)}</span>
            {weekStart === currentWeek ? <span className="badge">{t("week.current")}</span> : null}
            <Link
              className="btn sm ghost"
              href={activeClan ? clanHref(activeClan.clan.id, shiftWeek(weekStart, 1)) : weekHref(shiftWeek(weekStart, 1))}
              aria-label={t("week.next")}
            >
              →
            </Link>
            {weekStart !== currentWeek ? (
              <Link className="btn sm" href={activeClan ? clanHref(activeClan.clan.id, currentWeek) : weekHref(currentWeek)}>
                {t("week.goCurrent")}
              </Link>
            ) : null}
            <form className="filters" action="/ce" method="get" style={{ margin: 0 }}>
              <input type="hidden" name="server" value={selected.code} />
              {activeClan ? <input type="hidden" name="clan" value={activeClan.clan.id} /> : null}
              <input type="date" name="week" defaultValue={weekStart} aria-label={t("week.openAria")} />
              <button className="btn sm" type="submit">
                {t("week.open")}
              </button>
            </form>
          </div>

          {clanPlans.length === 0 ? (
            <div className="alert warn">
              <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                <span>{t("ce.noAllied", { server: selected.label })}</span>
                <Link className="btn sm" href="/clans">
                  {t("castle.openClans")}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <section className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <div>
                    <div className="card-title">{t("ce.clanPlans")}</div>
                    <div className="card-sub">{t("ce.clanPlansSub")}</div>
                  </div>
                  <span className="badge">{t("ce.clanCount", { count: clanPlans.length })}</span>
                </div>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t("common.clan")}</th>
                        <th className="num">{t("clans.colMembers")}</th>
                        <th className="num">{t("ce.colStatues")}</th>
                        <th className="num">{t("ce.colDsEnergy")}</th>
                        <th className="num">{t("ce.colGoldGt")}</th>
                        <th className="num">{t("ce.colDonations")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {clanPlans.map((entry) => {
                        const active = activeClan?.clan.id === entry.clan.id;
                        return (
                          <tr
                            key={entry.clan.id}
                            style={active ? { background: "rgba(124, 108, 245, 0.07)" } : undefined}
                          >
                            <td className="cell-title" data-label={t("common.clan")}>
                              <Link className="player-name" href={clanHref(entry.clan.id)}>
                                {entry.clan.name}
                              </Link>{" "}
                              {active ? <span className="badge gold">{t("ce.open")}</span> : null}
                            </td>
                            <td className="num mono" data-label={t("clans.colMembers")}>
                              {formatNumber(entry.clan.members, locale)}
                            </td>
                            <td className="num mono" data-label={t("ce.colStatues")}>
                              {formatNumber(entry.summary.statues, locale)}
                            </td>
                            <td className="num mono" data-label={t("ce.colDsEnergy")}>
                              {formatNumber(entry.summary.darksteel, locale)} /{" "}
                              {formatNumber(entry.summary.energy, locale)}
                            </td>
                            <td className="num mono" data-label={t("ce.colGoldGt")}>
                              {formatNumber(Math.round(entry.summary.requiredGold), locale)}
                            </td>
                            <td className="num mono" data-label={t("ce.colDonations")}>
                              {formatNumber(entry.donated, locale)}/{formatNumber(entry.donors.length, locale)}
                            </td>
                            <td className="num">
                              <Link className={`btn sm ${active ? "primary" : "ghost"}`} href={clanHref(entry.clan.id)}>
                                {t("ce.openAction")}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {activeClan ? (
                <>
                  <div className="row" style={{ marginBottom: 12 }}>
                    <span className="badge gold">{activeClan.clan.name}</span>
                    <span className="small muted">
                      {t("ce.clanLine", {
                        members: formatNumber(activeClan.clan.members, locale),
                        week: ceWeekTitle(weekStart, locale),
                      })}
                    </span>
                    {activeClan.plan.updatedAt ? (
                      <span className="small muted">
                        {t("castle.savedAt", { date: formatDateTime(activeClan.plan.updatedAt, locale) })}
                      </span>
                    ) : (
                      <span className="small muted">{t("ce.notSaved")}</span>
                    )}
                  </div>

                  <div className="grid cols-4" style={{ marginBottom: 16 }}>
                    <StatCard
                      label={t("ce.statStatues")}
                      value={formatNumber(activeClan.summary.statues, locale)}
                      foot={t("ce.statStatuesFoot", { clan: activeClan.clan.name })}
                    />
                    <StatCard
                      label={t("ce.statDarksteel")}
                      value={formatNumber(activeClan.summary.darksteel, locale)}
                      foot={t("ce.fromClan")}
                    />
                    <StatCard
                      label={t("ce.statEnergy")}
                      value={formatNumber(activeClan.summary.energy, locale)}
                      foot={t("ce.fromClan")}
                    />
                    <StatCard
                      label={t("ce.statGold")}
                      value={formatNumber(Math.round(activeClan.summary.requiredGold), locale)}
                      foot={t("ce.statGoldFoot", { gold: formatNumber(activeClan.summary.gold, locale) })}
                    />
                  </div>

                  <div className="ce-detail-grid">
                    <section className="card">
                      <div className="card-head">
                        <div>
                          <div className="card-title">{t("ce.planTitle")}</div>
                          <div className="card-sub">{t("ce.onlyClan", { clan: activeClan.clan.name })}</div>
                        </div>
                        <span className="badge">
                          {t("ce.participantCount", { count: formatNumber(activeClan.plan.participants, locale) })}
                        </span>
                      </div>

                      <form action={saveCePlanAction}>
                        <AutoSave />
                        <input type="hidden" name="serverId" value={selected.id} />
                        <input type="hidden" name="clanId" value={activeClan.clan.id} />
                        <input type="hidden" name="week" value={weekStart} />
                        <input type="hidden" name="redirectTo" value={returnTo} />

                        <div className="card-body row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                          <label className="mini-field narrow">
                            <span>{t("ce.participantsLabel")}</span>
                            <input
                              name="participants"
                              type="number"
                              min={0}
                              max={500}
                              step={1}
                              defaultValue={activeClan.plan.participants}
                              style={{ maxWidth: 120 }}
                            />
                          </label>
                          <span className="small muted" style={{ flex: "1 1 240px" }}>
                            {t("ce.participantsHint", {
                              members: formatNumber(activeClan.clan.members, locale),
                              amount:
                                activeClan.plan.participants > 0
                                  ? formatNumber(Math.round(activeClan.expected), locale)
                                  : "—",
                            })}
                          </span>
                        </div>

                        <div className="table-wrap">
                          <table className="data">
                            <thead>
                              <tr>
                                <th>CE</th>
                                <th>{t("ce.colExpedition")}</th>
                                <th>{t("ce.colClanPlan")}</th>
                                <th className="num">{t("ce.colStatues")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {CE_EXPEDITIONS.map((ce) => {
                                const run = activeClan.plan.runs[ce.no] ?? "x0";
                                return (
                                  <tr key={ce.no}>
                                    <td style={{ fontWeight: 700 }}>CE{ce.no}</td>
                                    <td>{ce.name}</td>
                                    <td>
                                      <select
                                        name={`run_${ce.no}`}
                                        defaultValue={run}
                                        aria-label={t("ce.runsAria", { clan: activeClan.clan.name, no: ce.no })}
                                      >
                                        {CE_RUNS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.value} · {t(`ce.run.${option.value === "x0" ? "none" : option.value === "x1" ? "one" : "two"}`)}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="num mono">{formatNumber(epicStatues(ce.no, run), locale)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="panel-body spread" style={{ gap: 12 }}>
                          <span className="small muted">
                            {t("ce.footer", {
                              statues: formatNumber(activeClan.summary.statues, locale),
                              ds: formatNumber(activeClan.summary.darksteel, locale),
                              energy: formatNumber(activeClan.summary.energy, locale),
                              gold: formatNumber(activeClan.summary.gold, locale),
                              gt: formatNumber(Math.round(activeClan.summary.requiredGold), locale),
                            })}
                          </span>
                        </div>
                      </form>
                    </section>

                    <section className="card">
                      <div className="card-head">
                        <div>
                          <div className="card-title">{t("ce.donationsTitle")}</div>
                          <div className="card-sub">
                            {t("ce.donationsSub", {
                              clan: activeClan.clan.name,
                              amount:
                                activeClan.plan.participants > 0
                                  ? formatNumber(Math.round(activeClan.expected), locale)
                                  : "—",
                            })}
                          </div>
                        </div>
                        <span className="badge gold">
                          {formatNumber(activeClan.donated, locale)}/{formatNumber(activeClan.donors.length, locale)}
                        </span>
                      </div>

                      {activeClan.donors.length === 0 ? (
                        <div className="card-body">
                          <p className="small muted" style={{ margin: 0 }}>
                            {t("ce.noMembersSynced")}
                          </p>
                        </div>
                      ) : (
                        <div className="table-wrap">
                          <table className="data">
                            <thead>
                              <tr>
                                <th>{t("common.player")}</th>
                                <th className="num">{t("players.colPower")}</th>
                                <th>{t("ce.colGold")}</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {activeClan.donors.map((donor) => (
                                <tr
                                  key={donor.character_id}
                                  className={donor.gold_done === 1 ? "row-ok" : undefined}
                                >
                                  <td className="cell-title" data-label={t("common.player")}>
                                    <CopyPlayerName
                                      name={donor.name}
                                      href={`/players/${donor.character_id}`}
                                    />{" "}
                                    {donor.is_guest === 1 ? (
                                      <span className="badge" title={t("ce.guestTag")}>
                                        {donor.clan_name}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="num mono" data-label={t("players.colPower")}>
                                    {formatNumber(donor.power_score, locale)}
                                  </td>
                                  <td data-label={t("ce.colGold")}>
                                    <form action={saveCeDonationAction} className="row" style={{ gap: 8 }}>
                                      <AutoSave delay={300} />
                                      <input type="hidden" name="serverId" value={selected.id} />
                                      <input type="hidden" name="clanId" value={activeClan.clan.id} />
                                      <input type="hidden" name="week" value={weekStart} />
                                      <input type="hidden" name="redirectTo" value={returnTo} />
                                      <input type="hidden" name="characterId" value={donor.character_id} />
                                      <input type="hidden" name="name" value={donor.name} />
                                      <label className="small">
                                        <input
                                          type="checkbox"
                                          name="gold"
                                          value="1"
                                          defaultChecked={donor.gold_done === 1}
                                        />{" "}
                                        {t("ce.donated")}
                                      </label>
                                    </form>
                                  </td>
                                  <td className="cell-action">
                                    {donor.is_guest === 1 ? (
                                      <form
                                        action={removeCeGuestAction}
                                        className="inline-form"
                                        style={{ justifyContent: "flex-end" }}
                                      >
                                        <input type="hidden" name="serverId" value={selected.id} />
                                        <input type="hidden" name="clanId" value={activeClan.clan.id} />
                                        <input type="hidden" name="week" value={weekStart} />
                                        <input type="hidden" name="redirectTo" value={returnTo} />
                                        <input
                                          type="hidden"
                                          name="characterId"
                                          value={donor.character_id}
                                        />
                                        <button
                                          className="btn sm ghost"
                                          type="submit"
                                          title={t("ce.removeGuestHint")}
                                        >
                                          {t("ce.removeGuest")}
                                        </button>
                                      </form>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="card-body" style={{ borderTop: "1px solid var(--border-soft)" }}>
                        {guestCandidates.length === 0 ? (
                          <p className="small muted" style={{ margin: 0 }}>
                            {t("ce.guestEmpty")}
                          </p>
                        ) : (
                          <form action={addCeGuestAction} className="filters" style={{ margin: 0 }}>
                            <input type="hidden" name="serverId" value={selected.id} />
                            <input type="hidden" name="clanId" value={activeClan.clan.id} />
                            <input type="hidden" name="week" value={weekStart} />
                            <input type="hidden" name="redirectTo" value={returnTo} />
                            <div className="field" style={{ flex: "1 1 240px" }}>
                              <label htmlFor="ce-guest">{t("ce.guestLabel")}</label>
                              <select id="ce-guest" name="characterId" defaultValue="" required>
                                <option value="" disabled>
                                  {t("ce.guestPlaceholder")}
                                </option>
                                {Array.from(guestGroups.entries()).map(([clanName, list]) => (
                                  <optgroup key={clanName} label={clanName}>
                                    {list.map((candidate) => (
                                      <option key={candidate.id} value={candidate.id}>
                                        {candidate.name} · {formatNumber(candidate.power_score, locale)}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </div>
                            <button className="btn" type="submit">
                              {t("ce.addGuestAction")}
                            </button>
                          </form>
                        )}
                        <p className="small muted" style={{ marginTop: 8 }}>
                          {t("ce.guestHint", { clan: activeClan.clan.name })}
                        </p>
                      </div>

                      <div className="panel-body">
                        <p className="small muted" style={{ margin: 0 }}>
                          {t("ce.ghostTradeNote", {
                            tax: Math.round(CE_GHOST_TRADE_TAX * 100),
                            rounded: Math.round(CE_GHOST_TRADE_TAX_ROUNDED * 100),
                          })}
                        </p>
                      </div>
                    </section>
                  </div>

                  <details className="panel" style={{ marginTop: 16 }}>
                    <summary>
                      {t("ce.historyTitle", {
                        clan: activeClan.clan.name,
                        count: formatNumber(activeHistory.length, locale),
                      })}
                    </summary>
                    {activeHistory.length > 0 ? (
                      <div className="list">
                        {activeHistory.map((entry) => (
                          <div key={entry.id} className="list-row">
                            <div>
                              <Link className="player-name" href={clanHref(activeClan.clan.id, entry.week_start)}>
                                {ceWeekTitle(entry.week_start, locale)}
                              </Link>
                              <div className="small muted">
                                {t("ce.historyLine", {
                                  statues: formatNumber(entry.statues, locale),
                                  gold: entry.donors_gold,
                                  participants: entry.participants,
                                  count: formatNumber(entry.participants, locale),
                                })}
                              </div>
                            </div>
                            <Link className="btn sm ghost" href={clanHref(activeClan.clan.id, entry.week_start)}>
                              {t("ce.openAction")}
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="panel-body">
                        <p className="small muted" style={{ margin: 0 }}>
                          {t("ce.historyEmpty")}
                        </p>
                      </div>
                    )}
                  </details>
                </>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </>
  );
}
