import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { recentMoves, refreshPlayerLinks } from "@/lib/players";
import { formatDateTime } from "@/lib/time";
import { EmptyState } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("transfers.metadata") };
}

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  await requireAdmin();
  const { locale, t } = await getT();
  refreshPlayerLinks();

  const moves = recentMoves(60);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("nav.admin")}</p>
          <h1 className="page-title">{t("transfers.title")}</h1>
          <p className="page-sub">{t("transfers.sub")}</p>
        </div>
        <div className="head-actions">
          <span className="badge">{t("transfers.count", { count: moves.length })}</span>
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
