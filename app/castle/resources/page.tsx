import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { CastleResourceBoard } from "@/components/CastleResourceBoard";
import { CastleTabs } from "@/components/CastleTabs";
import { Flash } from "@/components/ui";
import { castleResourceMembers, castleResourceUpdatedAt } from "@/lib/castle-resources";
import { castleMonthStart, castleMonthTitle, shiftMonth } from "@/lib/castle-prizes";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("castleRes.metadata") };
}

export const dynamic = "force-dynamic";

type SearchParams = {
  server?: string;
  month?: string;
  ok?: string;
  error?: string;
};

export default async function CastleResourcesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canEditServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  // Os recursos do castelo também são mensais, como o baú.
  const currentMonth = castleMonthStart();
  const monthStart = castleMonthStart(params.month ?? currentMonth);

  const members = selected ? castleResourceMembers(selected.id, monthStart) : [];
  const totalDarksteel = members.reduce((total, member) => total + member.darksteel, 0);
  const totalGold = members.reduce((total, member) => total + member.gold, 0);
  const paid = members.filter((member) => member.darksteel > 0 || member.gold > 0).length;
  const delivered = members.filter((member) => member.delivered_at).length;
  const updatedAt = selected ? castleResourceUpdatedAt(selected.id, monthStart) : null;

  const monthHref = (month: string) => `/castle/resources?server=${selected?.code ?? ""}&month=${month}`;
  const returnTo = monthHref(monthStart);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("castleRes.eyebrow")}</p>
          <h1 className="page-title">{t("castleRes.title")}</h1>
          <p className="page-sub">{t("castleRes.sub")}</p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/castle/resources?server=${server.code}&month=${monthStart}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <CastleTabs active="resources" />

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
            <div className="row" style={{ marginBottom: 12, flexWrap: "wrap" }}>
              <span className="badge">{t("castleRes.membersBadge", { count: formatNumber(members.length, locale) })}</span>
              <span className="badge gold">
                {t("castleRes.darksteelTotal", { value: formatNumber(totalDarksteel, locale) })}
              </span>
              <span className="badge gold">{t("castleRes.goldTotal", { value: formatNumber(totalGold, locale) })}</span>
              <span className="badge">{t("castleRes.paidPageBadge", { count: formatNumber(paid, locale) })}</span>
              <span className="badge">
                {t("castleRes.deliveredPageBadge", {
                  delivered: formatNumber(delivered, locale),
                  paid: formatNumber(paid, locale),
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
            <CastleResourceBoard
              key={`${selected.id}-${monthStart}`}
              serverId={selected.id}
              monthStart={monthStart}
              redirectTo={returnTo}
              members={members}
            />
          )}
        </>
      ) : null}
    </>
  );
}
