import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { CastlePrizeBoard } from "@/components/CastlePrizeBoard";
import { CastleTabs } from "@/components/CastleTabs";
import { Flash } from "@/components/ui";
import { castlePrizeMembers, castlePrizeUpdatedAt } from "@/lib/castle";
import {
  CASTLE_PRIZES,
  CASTLE_PRIZE_TOTAL,
  castleMonthStart,
  castleMonthTitle,
  castlePrizeCounts,
  shiftMonth,
  type CastlePrizeKey,
} from "@/lib/castle-prizes";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("castle.metadata") };
}

export const dynamic = "force-dynamic";

type SearchParams = {
  server?: string;
  month?: string;
  ok?: string;
  error?: string;
};

export default async function CastlePrizePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canEditServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  // O baú do castelo é mensal e é entregue na guerra de castelo.
  const currentMonth = castleMonthStart();
  const monthStart = castleMonthStart(params.month ?? currentMonth);

  const members = selected ? castlePrizeMembers(selected.id, monthStart) : [];
  const initial: Record<number, CastlePrizeKey[]> = {};
  for (const member of members) {
    if (member.prizes.length > 0) initial[member.character_id] = member.prizes;
  }

  const counts = castlePrizeCounts(members.flatMap((member) => member.prizes));
  const assigned = members.reduce((total, member) => total + (member.prizes.length > 0 ? 1 : 0), 0);
  const delivered = members.filter((member) => member.delivered_at).length;
  const usedTotal = CASTLE_PRIZES.reduce((total, prize) => total + counts[prize.key], 0);
  const clanCount = new Set(members.map((member) => member.clan_id)).size;
  const updatedAt = selected ? castlePrizeUpdatedAt(selected.id, monthStart) : null;

  const monthHref = (month: string) => `/castle?server=${selected?.code ?? ""}&month=${month}`;
  const returnTo = monthHref(monthStart);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("castle.eyebrow")}</p>
          <h1 className="page-title">{t("castle.title")}</h1>
          <p className="page-sub">{t("castle.sub")}</p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/castle?server=${server.code}&month=${monthStart}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <CastleTabs active="chests" />

      <Flash ok={params.ok} error={params.error} />

      {managed.length === 0 ? <div className="alert warn">{t("gest.noServers")}</div> : null}

      {selected ? (
        <>
          <div className="row" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            <Link
              className="btn sm ghost"
              href={monthHref(shiftMonth(monthStart, -1))}
              aria-label={t("castle.prevMonth")}
            >
              ←
            </Link>
            <span className="badge gold">{castleMonthTitle(monthStart, locale)}</span>
            {monthStart === currentMonth ? <span className="badge">{t("castle.thisMonth")}</span> : null}
            <Link
              className="btn sm ghost"
              href={monthHref(shiftMonth(monthStart, 1))}
              aria-label={t("castle.nextMonth")}
            >
              →
            </Link>
            {monthStart !== currentMonth ? (
              <Link className="btn sm" href={monthHref(currentMonth)}>
                {t("castle.goCurrent")}
              </Link>
            ) : null}
            {updatedAt ? (
              <span className="small muted">{t("castle.savedAt", { date: formatDateTime(updatedAt, locale) })}</span>
            ) : (
              <span className="small muted">{t("castle.notDistributed")}</span>
            )}
          </div>

          {members.length > 0 ? (
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="badge">
                {t("castle.membersBadge", {
                  members: formatNumber(members.length, locale),
                  clans: formatNumber(clanCount, locale),
                })}
              </span>
              <span className="badge gold">
                {t("castle.usedBadge", {
                  used: formatNumber(usedTotal, locale),
                  total: formatNumber(CASTLE_PRIZE_TOTAL, locale),
                })}
              </span>
              <span className="badge">{t("castle.assignedBadge", { count: formatNumber(assigned, locale) })}</span>
              <span className="badge">
                {t("castle.deliveredBadge", {
                  delivered: formatNumber(delivered, locale),
                  assigned: formatNumber(assigned, locale),
                })}
              </span>
            </div>
          ) : null}

          {members.length === 0 ? (
            <div className="alert warn">
              <div className="spread" style={{ gap: 10, flexWrap: "wrap" }}>
                <span>{t("castle.noMembers", { server: selected.label })}</span>
                <Link className="btn sm" href="/clans">
                  {t("castle.openClans")}
                </Link>
              </div>
            </div>
          ) : (
            <CastlePrizeBoard
              key={`${selected.id}-${monthStart}`}
              serverId={selected.id}
              monthStart={monthStart}
              redirectTo={returnTo}
              members={members}
              initial={initial}
            />
          )}
        </>
      ) : null}
    </>
  );
}
