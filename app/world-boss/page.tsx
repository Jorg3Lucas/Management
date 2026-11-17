import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { ConfirmButton } from "@/components/ConfirmButton";
import { WorldBossBoard } from "@/components/WorldBossBoard";
import { Flash, StatCard } from "@/components/ui";
import {
  ceWeekEnd,
  ceWeekStart,
  ceWeekTitle,
  shiftWeek,
  shortDay,
  shortWeekday,
  weekDays,
} from "@/lib/ce";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { APP_TIMEZONE } from "@/lib/time";
import {
  WORLD_BOSS_SLOTS,
  ensureWorldBossWeek,
  worldBossAttendance,
  worldBossCustomAttendance,
  worldBossCustomMembers,
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

  // A grade fixa de encontros nasce junto com a semana: as caixas de presença
  // já aparecem prontas. Semanas passadas ficam como foram registradas.
  if (selected && weekStart >= currentWeek) ensureWorldBossWeek(selected.id, weekStart);

  const fights = selected ? worldBossFights(selected.id, weekStart, weekEnd) : [];
  const members = selected ? worldBossMembers(selected.id) : [];
  const attendance = selected ? worldBossAttendance(selected.id, weekStart, weekEnd) : [];
  // Bloco custom: membros que lutam em outros servidores, sem personagem aqui.
  const customMembers = selected ? worldBossCustomMembers(selected.id) : [];
  const customAttendance = selected ? worldBossCustomAttendance(selected.id, weekStart, weekEnd) : [];

  const initial: Record<number, number[]> = {};
  for (const fight of fights) initial[fight.id] = [];
  const memberIds = new Set(members.map((member) => member.character_id));
  const counts = new Map<number, number>();
  for (const row of attendance) {
    if (!memberIds.has(row.character_id)) continue;
    (initial[row.fight_id] ??= []).push(row.character_id);
    counts.set(row.character_id, (counts.get(row.character_id) ?? 0) + 1);
  }

  const initialCustom: Record<number, number[]> = {};
  for (const fight of fights) initialCustom[fight.id] = [];
  const customIds = new Set(customMembers.map((member) => member.id));
  for (const row of customAttendance) {
    if (!customIds.has(row.custom_member_id)) continue;
    (initialCustom[row.fight_id] ??= []).push(row.custom_member_id);
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
  const days = weekDays(weekStart);
  // Horário livre para um encontro extra (fora da grade fixa) do dia padrão.
  const extraTime =
    WORLD_BOSS_SLOTS.map((slot) => slot.at).find(
      (at) => !fights.some((fight) => fight.fought_on === defaultDate && fight.fought_at === at),
    ) ?? "23:00";

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
                  <input id="foughtAt" name="foughtAt" type="time" required defaultValue={extraTime} />
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
              <div className="week-grid">
                {days.map((day) => {
                  const dayFights = fights.filter((fight) => fight.fought_on === day);
                  const dayExtraTime =
                    WORLD_BOSS_SLOTS.map((slot) => slot.at).find(
                      (at) => !dayFights.some((fight) => fight.fought_at === at),
                    ) ?? "23:00";
                  return (
                    <div key={day} className={`week-day${day === today ? " today" : ""}`}>
                      <div className="week-day-head">
                        <span className="week-day-name">{shortWeekday(day, locale)}</span>
                        <span className="week-day-date">{shortDay(day, locale)}</span>
                      </div>
                      <div className="week-day-body">
                        {dayFights.length === 0 ? (
                          <span className="week-day-empty">{t("boss.dayEmpty")}</span>
                        ) : (
                          dayFights.map((fight) => (
                            <div key={fight.id} className="week-fight">
                              <span className="week-fight-time">{fight.fought_at}</span>
                              <div className="week-fight-meta">
                                {fight.label ? <span className="week-fight-label">{fight.label}</span> : null}
                                <span className="week-fight-count">
                                  {t("boss.fightMarks", {
                                    count: formatNumber(fight.attended, locale),
                                    total: formatNumber(members.length, locale),
                                  })}
                                </span>
                              </div>
                              {fight.created_by !== null ? (
                                <form action={deleteWorldBossFightAction} className="week-fight-del">
                                  <input type="hidden" name="fightId" value={fight.id} />
                                  <input type="hidden" name="serverId" value={selected.id} />
                                  <input type="hidden" name="redirectTo" value={returnTo} />
                                  <ConfirmButton
                                    className="week-fight-del-btn"
                                    message={t("boss.deleteConfirm", {
                                      date: shortDay(fight.fought_on, locale),
                                      time: fight.fought_at,
                                    })}
                                  >
                                    ×
                                  </ConfirmButton>
                                </form>
                              ) : null}
                            </div>
                          ))
                        )}
                        <form action={addWorldBossFightAction} className="week-quick">
                          <input type="hidden" name="serverId" value={selected.id} />
                          <input type="hidden" name="redirectTo" value={returnTo} />
                          <input type="hidden" name="foughtOn" value={day} />
                          <input
                            type="time"
                            name="foughtAt"
                            defaultValue={dayExtraTime}
                            required
                            aria-label={t("boss.quickAria", { date: shortDay(day, locale) })}
                          />
                          <button className="btn sm ghost" type="submit" title={t("boss.quickAdd")}>
                            +
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {members.length === 0 ? (
            <div className="alert warn" style={{ marginBottom: 16 }}>
              <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                <span>{t("boss.noMembers", { server: selected.label })}</span>
                <Link className="btn sm" href="/clans">
                  {t("castle.openClans")}
                </Link>
              </div>
            </div>
          ) : null}

          {fights.length === 0 ? (
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
              customMembers={customMembers}
              initialCustom={initialCustom}
            />
          )}
        </>
      ) : null}
    </>
  );
}
