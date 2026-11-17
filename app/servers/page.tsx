import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { listServers, serverPlayerCounts } from "@/lib/queries";
import { groupServers } from "@/lib/server-groups";
import { formatDateTime } from "@/lib/time";
import { Flash, RichText, SyncBadge } from "@/components/ui";
import { syncServerAction, toggleServerFlagAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("servers.metadata") };
}

export const dynamic = "force-dynamic";

export default async function ServersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { locale, t } = await getT();
  const flash = await searchParams;
  const servers = listServers();
  const counts = serverPlayerCounts();
  const groups = groupServers(servers);
  const enabledCount = servers.filter((server) => server.sync_enabled).length;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("nav.admin")}</p>
          <h1 className="page-title">{t("servers.title")}</h1>
          <p className="page-sub">{t("servers.sub")}</p>
        </div>
        <div className="head-actions">
          <span className="badge ok">{t("servers.syncing", { count: enabledCount })}</span>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <div className="alert">
        <RichText text={t("servers.alert")} />
      </div>

      {groups.map(([group, list]) => (
        <section key={group} className="server-list-group">
          <div className="group-title">
            {group} <span className="muted">· {t("servers.groupCount", { count: list.length })}</span>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("common.server")}</th>
                    <th>{t("servers.colForumIds")}</th>
                    <th className="num">{t("common.players")}</th>
                    <th>{t("nav.sync")}</th>
                    <th>{t("servers.colLastResult")}</th>
                    <th className="num" style={{ textAlign: "right" }}>
                      {t("common.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((server) => (
                    <tr key={server.id}>
                      <td>
                        <div className="row" style={{ gap: 7 }}>
                          <span style={{ fontWeight: 650 }}>{server.label}</span>
                          <span className="small muted">{server.code}</span>
                        </div>
                        {server.last_sync_message ? (
                          <div className="player-clan" title={server.last_sync_message}>
                            {server.last_sync_message}
                          </div>
                        ) : null}
                      </td>
                      <td className="small muted mono nowrap">
                        {t("servers.forumIds", { group: server.worldgroup_id, world: server.world_id })}
                      </td>
                      <td className="num mono">{counts.get(server.id) ?? 0}</td>
                      <td>
                        <form action={toggleServerFlagAction} className="inline-form">
                          <input type="hidden" name="serverId" value={server.id} />
                          <input type="hidden" name="field" value="sync_enabled" />
                          <input type="hidden" name="redirectTo" value="/servers" />
                          <button className={`btn sm${server.sync_enabled ? "" : " ghost"}`} type="submit">
                            {server.sync_enabled ? t("servers.enabled") : t("servers.disabled")}
                          </button>
                        </form>
                      </td>
                      <td>
                        <div className="stack" style={{ gap: 5 }}>
                          <SyncBadge status={server.last_sync_status} locale={locale} />
                          <span className="small muted">
                            {server.last_sync_at ? formatDateTime(server.last_sync_at, locale) : t("servers.never")}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <form action={syncServerAction} className="inline-form">
                            <input type="hidden" name="serverId" value={server.id} />
                            <input type="hidden" name="redirectTo" value="/servers" />
                            <button className="btn sm" type="submit">
                              {t("servers.syncNow")}
                            </button>
                          </form>
                          <Link className="btn sm ghost" href={`/players?server=${server.code}`}>
                            {t("servers.view")}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
