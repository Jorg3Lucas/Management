import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { ConfirmButton } from "@/components/ConfirmButton";
import { WorldBossBoard } from "@/components/WorldBossBoard";
import { Flash, StatCard } from "@/components/ui";
import { ceWeekEnd, ceWeekStart, ceWeekTitle, shiftWeek, shortDay } from "@/lib/ce";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { APP_TIMEZONE } from "@/lib/time";
import {
  worldBossAttendance,
  worldBossFights,
  worldBossMembers,
} from "@/lib/world-boss";
import { addWorldBossFightAction, deleteWorldBossFightAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("boss.metadata") };
}

export const dynamic = "force-dynamic";

type SearchParams = {
  server?: string;
  week?: string;
  ok?: string;
  error?: string;
};

/** Hoje (AAAA-MM-DD) no fuso da app, para o campo de data do encontro. */
function todayInApp(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function WorldBossPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canEditServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  const currentWeek = ceWeekStart();
  const weekStart = ceWeekStart(params.week ?? currentWeek);
  const weekEnd = ceWeekEnd(weekStart);

  const fights = selected ? worldBossFights(selected.id, weekStart, weekEnd) : [];
  const members = selected ? worldBossMembers(selected.id) : [];
  const attendance = selected ? worldBossAttendance(selected.id, weekStart, weekEnd) : [];

  const initial: Record<number, number[]> = {};
  for (const fight of fights) initial[fight.id] = [];
  const memberIds = new Set(members.map((member) => member.character_id));
  const counts = new Map<number, number>();
  for (const row of attendance) {
    if (!memberIds.has(row.character_id)) continue;
    (initial[row.fight_id] ??= []).push(row.character_id);
    counts.set(row.character_id, (counts.get(row.character_id) ?? 0) + 1);
  }

  const totalMarks = Array.from(counts.values()).reduce((total, count) => total + count, 0);
  const capacity = fights.length * members.length;
  const presenceRate = capacity > 0 ? Math.round((totalMarks / capacity) * 100) : 0;
  const average = fights.length > 0 ? Math.round(totalMarks / fights.length) : 0;

  let topId: number | null = null;
  for (const [characterId, count] of counts) {
    if (topId === null || count > (counts.get(topId) ?? 0)) topId = characterId;
  }
  const top = topId === null ? null : members.find((member) => member.character_id === topId) ?? null;

  const weekHref = (week: string) => `/world-boss?server=${selected?.code ?? ""}&week=${week}`;
  const returnTo = weekHref(weekStart);
  const today = todayInApp();
  const defaultDate = today >= weekStart && today <= weekEnd ? today : weekStart;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("boss.eyebrow")}</p>
          <h1 className="page-title">{t("boss.title")}</h1>
          <p className="page-sub">{t("boss.sub")}</p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/world-boss?server=${server.code}&week=${weekStart}`}
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
          <div className="row" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            <Link className="btn sm ghost" href={weekHref(shiftWeek(weekStart, -1))} aria-label={t("week.prev")}>
              ←
            </Link>
            <span className="badge gold">{ceWeekTitle(weekStart, locale)}</span>
            {weekStart === currentWeek ? <span className="badge">{t("week.current")}</span> : null}
            <Link className="btn sm ghost" href={weekHref(shiftWeek(weekStart, 1))} aria-label={t("week.next")}>
              →
            </Link>
            {weekStart !== currentWeek ? (
              <Link className="btn sm" href={weekHref(currentWeek)}>
                {t("week.goCurrent")}
              </Link>
            ) : null}
          </div>

          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <StatCard
              label={t("boss.statFights")}
              value={formatNumber(fights.length, locale)}
              foot={fights.length === 1 ? t("boss.statFightsFootOne") : t("boss.statFightsFoot")}
            />
            <StatCard
              label={t("boss.statMarks")}
              value={formatNumber(totalMarks, locale)}
              foot={t("boss.statMarksFoot", { rate: presenceRate, capacity: formatNumber(capacity, locale) })}
            />
            <StatCard
              label={t("boss.statAverage")}
              value={formatNumber(average, locale)}
              foot={t("boss.statAverageFoot")}
            />
            <StatCard
              label={t("boss.statTop")}
              value={top ? top.name : "—"}
              foot={
                top
                  ? t("boss.statTopFoot", { count: counts.get(top.character_id) ?? 0, fights: fights.length })
                  : t("boss.statTopNone")
              }
            />
          </div>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">{t("boss.fightsTitle")}</div>
                <div className="card-sub">{t("boss.fightsSub")}</div>
              </div>
              <span className="badge">
                {t("boss.fightsBadge", {
                  fights: formatNumber(fights.length, locale),
                  members: formatNumber(members.length, locale),
                })}
              </span>
            </div>
            <div className="card-body">
              <form action={addWorldBossFightAction} className="form-grid">
                <input type="hidden" name="serverId" value={selected.id} />
                <input type="hidden" name="redirectTo" value={returnTo} />
                <div className="field">
                  <label htmlFor="foughtOn">{t("boss.date")}</label>
                  <input
                    id="foughtOn"
                    name="foughtOn"
                    type="date"
                    required
                    min={weekStart}
                    max={weekEnd}
                    defaultValue={defaultDate}
                  />
                </div>
                <div className="field">
                  <label htmlFor="foughtAt">{t("boss.time")}</label>
                  <input id="foughtAt" name="foughtAt" type="time" required defaultValue="20:00" />
                </div>
                <div className="field">
                  <label htmlFor="label">{t("salary.labelOptional")}</label>
                  <input
                    id="label"
                    name="label"
                    type="text"
                    maxLength={40}
                    placeholder={t("boss.namePlaceholder")}
                  />
                </div>
                <div className="full row">
                  <button className="btn primary" type="submit">
                    {t("boss.addFight")}
                  </button>
                </div>
              </form>
            </div>

            <div className="card-body tight">
              {fights.length === 0 ? (
                <div className="empty">{t("boss.noFights")}</div>
              ) : (
                <div className="list">
                  {fights.map((fight) => (
                    <div key={fight.id} className="list-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {t("boss.fightLine", {
                            date: shortDay(fight.fought_on, locale),
                            time: fight.fought_at,
                          })}
                          {fight.label ? (
                            <span className="badge" style={{ marginLeft: 8 }}>
                              {fight.label}
                            </span>
                          ) : null}
                        </div>
                        <div className="small muted">
                          {t("boss.fightMarks", {
                            count: formatNumber(fight.attended, locale),
                            total: formatNumber(members.length, locale),
                          })}
                        </div>
                      </div>
                      <form action={deleteWorldBossFightAction} className="inline-form">
                        <input type="hidden" name="fightId" value={fight.id} />
                        <input type="hidden" name="serverId" value={selected.id} />
                        <input type="hidden" name="redirectTo" value={returnTo} />
                        <ConfirmButton
                          message={t("boss.deleteConfirm", {
                            date: shortDay(fight.fought_on, locale),
                            time: fight.fought_at,
                          })}
                        >
                          {t("common.remove")}
                        </ConfirmButton>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {members.length === 0 ? (
            <div className="alert warn">
              <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                <span>{t("boss.noMembers", { server: selected.label })}</span>
                <Link className="btn sm" href="/clans">
                  {t("castle.openClans")}
                </Link>
              </div>
            </div>
          ) : fights.length === 0 ? (
            <div className="alert">{t("boss.needFight")}</div>
          ) : (
            <WorldBossBoard
              key={`${selected.id}-${weekStart}`}
              serverId={selected.id}
              weekStart={weekStart}
              redirectTo={returnTo}
              members={members}
              fights={fights}
              initial={initial}
            />
          )}
        </>
      ) : null}
    </>
  );
}
