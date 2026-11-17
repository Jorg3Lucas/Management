import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { formatDuration, formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { recentSyncRuns } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";
import { enabledServers } from "@/lib/sync";
import { EmptyState, Flash, RichText, StatCard, SyncBadge } from "@/components/ui";
import { syncAllAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("sync.metadata") };
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { locale, t } = await getT();
  const flash = await searchParams;
  const runs = recentSyncRuns(50);
  const servers = enabledServers();
  const lastRun = runs[0];
  const dailyHour = Number(process.env.SYNC_DAILY_HOUR ?? 17);
  const maxPages = Number(process.env.SYNC_MAX_PAGES ?? 10);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("nav.admin")}</p>
          <h1 className="page-title">{t("sync.title")}</h1>
          <p className="page-sub">{t("sync.sub")}</p>
        </div>
        <div className="head-actions">
          <form action={syncAllAction} className="inline-form">
            <button className="btn primary" type="submit">
              {t("sync.syncAll")}
            </button>
          </form>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <StatCard
          label={t("sync.queue")}
          value={servers.length}
          foot={servers.length ? servers.map((server) => server.label).join(", ") : t("sync.queueEmpty")}
        />
        <StatCard
          label={t("sync.lastRun")}
          value={lastRun ? lastRun.server_label ?? "—" : "—"}
          foot={lastRun ? formatDateTime(lastRun.started_at, locale) : t("sync.lastRunNone")}
        />
        <StatCard
          label={t("sync.window")}
          value={t("sync.windowValue", { count: formatNumber(maxPages * 100, locale) })}
          foot={t("sync.windowFoot", { count: maxPages })}
        />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">{t("sync.history")}</div>
            <div className="card-sub">{t("sync.historySub")}</div>
          </div>
        </div>
        <div className="table-wrap">
          {runs.length === 0 ? (
            <EmptyState title={t("sync.empty")}>
              <RichText text={t("sync.emptyBody")} />
            </EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>{t("common.server")}</th>
                  <th>{t("common.status")}</th>
                  <th className="num">{t("sync.colRows")}</th>
                  <th className="num">{t("sync.colCreated")}</th>
                  <th className="num">{t("sync.colUpdated")}</th>
                  <th>{t("wars.colStart")}</th>
                  <th className="num">{t("wars.colDuration")}</th>
                  <th>{t("sync.colMessage")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{run.server_label ?? "—"}</span>
                      <div className="player-clan">{run.server_code ?? ""}</div>
                    </td>
                    <td>
                      <SyncBadge status={run.status} locale={locale} />
                    </td>
                    <td className="num mono">{run.rows_fetched}</td>
                    <td className="num mono">{run.rows_created}</td>
                    <td className="num mono">{run.rows_updated}</td>
                    <td className="small muted nowrap">{formatDateTime(run.started_at, locale)}</td>
                    <td className="num mono">
                      {formatDuration((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000, locale)}
                    </td>
                    <td className="small muted" style={{ maxWidth: 320 }}>
                      {run.message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid cols-2">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("sync.activeServers")}</div>
              <div className="card-sub">{t("sync.activeSub")}</div>
            </div>
            <Link className="btn sm ghost" href="/servers">
              {t("sync.change")}
            </Link>
          </div>
          <div className="card-body tight">
            {servers.length === 0 ? (
              <EmptyState title={t("sync.noActive")}>{t("sync.noActiveBody")}</EmptyState>
            ) : (
              <div className="list">
                {servers.map((server) => (
                  <div key={server.id} className="list-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {server.label} <span className="small muted mono">{server.code}</span>
                      </div>
                      <div className="small muted">
                        {t("servers.forumIds", { group: server.worldgroup_id, world: server.world_id })}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <SyncBadge status={server.last_sync_status} locale={locale} />
                      <div className="small muted">
                        {server.last_sync_at ? formatDateTime(server.last_sync_at, locale) : t("servers.never")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("sync.autoTitle")}</div>
              <div className="card-sub">{t("sync.autoSub")}</div>
            </div>
          </div>
          <div className="card-body stack">
            <p className="small muted">
              <RichText text={t("sync.autoBody1", { hour: dailyHour })} />
            </p>
            <p className="small muted">
              <RichText text={t("sync.autoBody2")} />
            </p>
            <pre className="mono-box">{`curl -X POST "https://seu-dominio/api/sync?server=EU011" \\\n  -H "Authorization: Bearer $SYNC_TOKEN"`}</pre>
            <p className="small muted">
              <RichText text={t("sync.autoBody3")} />
            </p>
            <pre className="mono-box">{`# CLI no servidor\nnpm run sync --all          # todos os 68 servidores\nnpm run sync                # apenas os servidores ativos\nnpm run sync -- EU011 EU021`}</pre>
          </div>
        </section>
      </div>
    </>
  );
}
