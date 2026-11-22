import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { listPlayerJourneys, recentMoves, refreshPlayerLinks } from "@/lib/players";
import { formatDateTime } from "@/lib/time";
import { EmptyState } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("transfers.metadata") };
}

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  page?: string;
};

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { locale, t } = await getT();
  const params = await searchParams;
  refreshPlayerLinks();

  const search = (params.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const journeys = listPlayerJourneys({ search, page, pageSize: 100 });
  const moves = recentMoves(60);

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return suffix ? `/transfers?${suffix}` : "/transfers";
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("nav.admin")}</p>
          <h1 className="page-title">{t("transfers.title")}</h1>
          <p className="page-sub">{t("transfers.sub")}</p>
        </div>
        <div className="head-actions">
          <span className="badge">{t("transfers.playersCount", { count: journeys.total })}</span>
          <span className="badge">{t("transfers.count", { count: moves.length })}</span>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">{t("transfers.playersTitle")}</div>
            <div className="card-sub">{t("transfers.playersSub")}</div>
          </div>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <form className="filters" action="/transfers" method="get">
            <div className="field" style={{ flex: "1 1 260px" }}>
              <label htmlFor="q">{t("common.player")}</label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={search}
                placeholder={t("transfers.searchPlaceholder")}
              />
            </div>
            <button className="btn" type="submit">
              {t("common.filter")}
            </button>
            {search ? (
              <Link className="btn ghost" href="/transfers">
                {t("players.clear")}
              </Link>
            ) : null}
          </form>
        </div>
        <div className="table-wrap">
          {journeys.rows.length === 0 ? (
            <EmptyState title={t("transfers.playersEmpty")}>{t("transfers.playersEmptyBody")}</EmptyState>
          ) : (
            <table className="data table-cards">
              <thead>
                <tr>
                  <th>{t("common.player")}</th>
                  <th>{t("transfers.colPlayerOrigin")}</th>
                  <th>{t("transfers.colPlayerCurrent")}</th>
                  <th>{t("transfers.colLastMove")}</th>
                  <th className="num">{t("transfers.colMoves")}</th>
                </tr>
              </thead>
              <tbody>
                {journeys.rows.map((row) => (
                  <tr key={row.player_id}>
                    <td className="cell-title">
                      {row.character_id ? (
                        <Link className="player-name" href={`/players/${row.character_id}`}>
                          {row.player_name}
                        </Link>
                      ) : (
                        <span className="player-name">{row.player_name}</span>
                      )}
                    </td>
                    <td data-label={t("transfers.colPlayerOrigin")}>
                      {row.origin_label ? (
                        <span className="badge">{row.origin_label}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td data-label={t("transfers.colPlayerCurrent")}>
                      {row.current_label ? (
                        <span className="badge ok">{row.current_label}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="small" data-label={t("transfers.colLastMove")}>
                      {row.last_move_at ? (
                        <>
                          <div>
                            {row.last_move_from_label ?? "—"} → {row.last_move_to_label ?? "—"}
                          </div>
                          <div className="muted nowrap">{formatDateTime(row.last_move_at, locale)}</div>
                        </>
                      ) : (
                        <span className="muted">{t("transfers.noMove")}</span>
                      )}
                    </td>
                    <td className="num mono" data-label={t("transfers.colMoves")}>
                      {row.move_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="spread" style={{ marginBottom: 16 }}>
        <span className="small muted">
          {t("players.pager", {
            page: journeys.page,
            pages: journeys.pages,
            size: journeys.pageSize,
          })}
        </span>
        <div className="row">
          {journeys.page > 1 ? (
            <Link className="btn sm ghost" href={pageHref(journeys.page - 1)}>
              {t("players.prev")}
            </Link>
          ) : (
            <span className="btn sm ghost" style={{ opacity: 0.4 }}>
              {t("players.prev")}
            </span>
          )}
          {journeys.page < journeys.pages ? (
            <Link className="btn sm ghost" href={pageHref(journeys.page + 1)}>
              {t("players.next")}
            </Link>
          ) : (
            <span className="btn sm ghost" style={{ opacity: 0.4 }}>
              {t("players.next")}
            </span>
          )}
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">{t("transfers.history")}</div>
            <div className="card-sub">{t("transfers.historySub")}</div>
          </div>
        </div>
        <div className="table-wrap">
          {moves.length === 0 ? (
            <EmptyState title={t("transfers.empty")}>{t("transfers.emptyBody")}</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>{t("common.player")}</th>
                  <th>{t("transfers.colOrigin")}</th>
                  <th>{t("transfers.colTarget")}</th>
                  <th>{t("transfers.colDetected")}</th>
                  <th>{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((move) => (
                  <tr key={move.id}>
                    <td style={{ fontWeight: 600 }}>
                      {move.character_id ? (
                        <Link href={`/players/${move.character_id}`}>{move.player_name}</Link>
                      ) : (
                        move.player_name
                      )}
                    </td>
                    <td className="small muted">{move.from_label ?? "—"}</td>
                    <td className="small muted">{move.to_label}</td>
                    <td className="small muted nowrap">{formatDateTime(move.detected_at, locale)}</td>
                    <td>
                      <span className={`badge ${move.status === "rejected" ? "err" : "ok"}`}>
                        {move.status === "rejected" ? t("transfers.rejected") : t("transfers.confirmed")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
