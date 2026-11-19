import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { addCastleResourceAction, removeCastleResourceAction } from "./actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Flash } from "@/components/ui";
import { castleResourceEntries, castleResourceUpdatedAt } from "@/lib/castle-resources";
import { castleMonthStart, castleMonthTitle, shiftMonth } from "@/lib/castle-prizes";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/time";

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

  // O livro de recursos é mensal, como o baú do castelo.
  const currentMonth = castleMonthStart();
  const monthStart = castleMonthStart(params.month ?? currentMonth);

  const entries = selected ? castleResourceEntries(selected.id, monthStart) : [];
  const totalDarksteel = entries.reduce((total, entry) => total + entry.darksteel, 0);
  const totalGold = entries.reduce((total, entry) => total + entry.gold, 0);
  const updatedAt = selected ? castleResourceUpdatedAt(selected.id, monthStart) : null;

  const monthHref = (month: string) => `/castle-resources?server=${selected?.code ?? ""}&month=${month}`;
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
              href={`/castle-resources?server=${server.code}&month=${monthStart}`}
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
            <Link className="btn sm ghost" href={monthHref(shiftMonth(monthStart, -1))} aria-label={t("castle.prevMonth")}>
              ←
            </Link>
            <span className="badge gold">{castleMonthTitle(monthStart, locale)}</span>
            {monthStart === currentMonth ? <span className="badge">{t("castle.thisMonth")}</span> : null}
            <Link className="btn sm ghost" href={monthHref(shiftMonth(monthStart, 1))} aria-label={t("castle.nextMonth")}>
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

          <div className="row" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            <span className="badge gold">
              {t("castleRes.darksteelTotal", { value: formatNumber(totalDarksteel, locale) })}
            </span>
            <span className="badge gold">{t("castleRes.goldTotal", { value: formatNumber(totalGold, locale) })}</span>
            <span className="badge">{t("castleRes.entriesBadge", { count: formatNumber(entries.length, locale) })}</span>
          </div>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-title">{t("castleRes.addTitle")}</div>
                <div className="card-sub">{t("castleRes.addSub")}</div>
              </div>
            </div>
            <div className="card-body">
              <form action={addCastleResourceAction} className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input type="hidden" name="serverId" value={selected.id} />
                <input type="hidden" name="month" value={monthStart} />
                <input type="hidden" name="redirectTo" value={returnTo} />

                <div className="field" style={{ flex: "1 1 260px" }}>
                  <label htmlFor="label">{t("castleRes.label")}</label>
                  <input
                    id="label"
                    name="label"
                    type="text"
                    maxLength={80}
                    placeholder={t("castleRes.labelPlaceholder")}
                  />
                </div>
                <div className="field" style={{ flex: "0 1 170px" }}>
                  <label htmlFor="darksteel">{t("castleRes.darksteel")}</label>
                  <input id="darksteel" name="darksteel" type="text" inputMode="numeric" placeholder="0" />
                </div>
                <div className="field" style={{ flex: "0 1 170px" }}>
                  <label htmlFor="gold">{t("castleRes.gold")}</label>
                  <input id="gold" name="gold" type="text" inputMode="numeric" placeholder="0" />
                </div>
                <button className="btn primary" type="submit" style={{ alignSelf: "flex-end" }}>
                  {t("castleRes.add")}
                </button>
              </form>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <div className="card-title">{t("castleRes.listTitle")}</div>
                <div className="card-sub">{t("castleRes.listSub")}</div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("castleRes.colDate")}</th>
                    <th>{t("castleRes.colLabel")}</th>
                    <th className="num">{t("castleRes.darksteel")}</th>
                    <th className="num">{t("castleRes.gold")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <span className="small muted">{t("castleRes.empty")}</span>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="mono" data-label={t("castleRes.colDate")}>
                          {formatDate(entry.created_at, locale)}
                        </td>
                        <td data-label={t("castleRes.colLabel")}>
                          {entry.label ? entry.label : <span className="small muted">{t("castleRes.noLabel")}</span>}
                        </td>
                        <td className="num mono" data-label={t("castleRes.darksteel")}>
                          {formatNumber(entry.darksteel, locale)}
                        </td>
                        <td className="num mono" data-label={t("castleRes.gold")}>
                          {formatNumber(entry.gold, locale)}
                        </td>
                        <td className="cell-action">
                          <form action={removeCastleResourceAction}>
                            <input type="hidden" name="serverId" value={selected.id} />
                            <input type="hidden" name="month" value={monthStart} />
                            <input type="hidden" name="entryId" value={entry.id} />
                            <input type="hidden" name="redirectTo" value={returnTo} />
                            <ConfirmButton message={t("castleRes.removeConfirm")}>{t("castleRes.remove")}</ConfirmButton>
                          </form>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {entries.length > 0 ? (
                  <tfoot>
                    <tr>
                      <td colSpan={2}>{t("common.total")}</td>
                      <td className="num mono">{formatNumber(totalDarksteel, locale)}</td>
                      <td className="num mono">{formatNumber(totalGold, locale)}</td>
                      <td />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>

            <div className="panel-body">
              <span className="small muted">{t("castleRes.footer")}</span>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
