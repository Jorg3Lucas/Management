import Link from "next/link";
import { accessibleServerIds, accessibleServers, canEditServer, isAdmin, requireUser } from "@/lib/auth";
import { formatDuration, formatNumber, formatPower } from "@/lib/format";
import { getT } from "@/lib/i18n";
import {
  countCharactersForServers,
  lastDailySyncRun,
  recentSyncRuns,
  serverPlayerCounts,
  topCharacters,
  warSessionsForServers,
} from "@/lib/queries";
import { formatDateTime } from "@/lib/time";
import { summarizeByCharacter, summarizeByServer, totalWarSeconds } from "@/lib/wars";
import { EmptyState, Flash, StatCard, SyncBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const flash = await searchParams;

  const ids = accessibleServerIds(user);
  const servers = accessibleServers(user);
  const now = Date.now();

  const sessions = warSessionsForServers(ids, 5000);
  const warByServer = summarizeByServer(sessions, now);
  const warByCharacter = summarizeByCharacter(sessions, now);
  const activeWars = sessions.filter((session) => !session.ended_at);
  const playerCounts = serverPlayerCounts();
  const totalPlayers = countCharactersForServers(ids);
  const runs = recentSyncRuns(6, ids);
  const daily = lastDailySyncRun(ids);

  const serverCards = servers.map((server) => {
    const war = warByServer.get(server.id);
    const top = topCharacters(server.id, 5);
    return {
      server,
      players: playerCounts.get(server.id) ?? 0,
      topPlayer: top[0],
      top,
      warSeconds: war?.totalSeconds ?? 0,
      activeWars: war?.activeCount ?? 0,
    };
  });

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("nav.operation")}</p>
          <h1 className="page-title">{t("nav.dashboard")}</h1>
          <p className="page-sub">{t("dash.sub")}</p>
        </div>
        <div className="head-actions">
          <span className="badge">{t("dash.serversAllowed", { count: servers.length })}</span>
          {isAdmin(user) ? (
            <Link className="btn" href="/sync">
              {t("dash.syncHistory")}
            </Link>
          ) : null}
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      {serverCards.length === 0 ? <div className="alert warn">{t("dash.noServers")}</div> : null}

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        {serverCards.map(({ server, players, topPlayer, warSeconds, activeWars }) => (
          <section key={server.id} className="card server-card highlight">
            <div className="server-head">
              <div>
                <div className="server-name">
                  {server.label}
                  <span className="server-code">{server.code}</span>
                </div>
                <div className="card-sub">
                  {server.group_name} · {t("dash.world", { id: server.world_id })}
                </div>
              </div>
              <SyncBadge status={server.last_sync_status} locale={locale} />
            </div>

            <div className="server-metrics">
              <div className="metric">
                <div className="metric-label">{t("dash.players")}</div>
                <div className="metric-value">{formatNumber(players, locale)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">{t("dash.maxPower")}</div>
                <div className="metric-value">{topPlayer ? formatPower(topPlayer.power_score, locale) : "—"}</div>
              </div>
              <div className="metric">
                <div className="metric-label">{t("dash.warTime")}</div>
                <div className="metric-value">{formatDuration(warSeconds, locale)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">{t("dash.activeWars")}</div>
                <div className="metric-value">{activeWars}</div>
              </div>
            </div>

            <div className="server-foot">
              <span>
                {server.last_sync_at
                  ? t("dash.syncAt", { date: formatDateTime(server.last_sync_at, locale) })
                  : t("dash.awaitingSync")}
              </span>
              <Link className="btn sm ghost" href={`/players?server=${server.code}`}>
                {t("dash.viewRanking")}
              </Link>
            </div>
          </section>
        ))}
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <StatCard
          label={t("dash.trackedPlayers")}
          value={formatNumber(totalPlayers, locale)}
          foot={t("dash.trackedPlayersFoot")}
        />
        <StatCard
          label={t("dash.totalWarTime")}
          value={formatDuration(totalWarSeconds(sessions, now), locale)}
          foot={t("dash.battles", { count: sessions.length })}
        />
        <StatCard
          label={t("dash.warsRunning")}
          value={activeWars.length}
          foot={activeWars.length > 0 ? t("dash.warsRunningFoot") : t("dash.warsRunningNone")}
        />
        <StatCard
          label={t("dash.serversSyncing")}
          value={servers.filter((server) => server.sync_enabled).length}
          foot={t("dash.serversSyncingFoot", { count: servers.length })}
        />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">{t("dash.dailyTitle")}</div>
            <div className="card-sub">{t("dash.dailySub")}</div>
          </div>
          {daily ? (
            <span className={`badge ${daily.failed > 0 || daily.total < servers.length ? "warn" : "ok"}`}>
              {daily.failed > 0
                ? t("dash.dailyFailed", { count: daily.failed })
                : daily.total < servers.length
                  ? t("dash.dailyPartial")
                  : t("dash.dailyNoFailures")}
            </span>
          ) : null}
        </div>
        <div className="card-body">
          {!daily ? (
            <EmptyState title={t("dash.dailyNotRun")}>{t("dash.dailyNotRunBody")}</EmptyState>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              <div className="spread">
                <div>
                  <div className="small muted">{t("dash.lastRun")}</div>
                  <div style={{ fontWeight: 650 }}>
                    {formatDateTime(daily.startedAt, locale, "America/Sao_Paulo")}
                  </div>
                  <div className="small muted">
                    {t("dash.runDuration", {
                      duration: formatDuration(
                        (Date.parse(daily.finishedAt) - Date.parse(daily.startedAt)) / 1000,
                        locale,
                      ),
                      count: daily.total,
                    })}
                  </div>
                </div>
                <div className="tag-list">
                  <span className="badge ok">{t("dash.dailyOk", { count: daily.ok })}</span>
                  <span className="badge warn">{t("dash.dailyEmpty", { count: daily.empty })}</span>
                  <span className={`badge ${daily.failed > 0 ? "err" : ""}`}>
                    {t("dash.dailyErr", { count: daily.failed })}
                  </span>
                </div>
              </div>

              {daily.total < servers.length ? (
                <div className="small" style={{ color: "var(--warn)" }}>
                  {t("dash.dailyIncomplete", { done: daily.total, total: servers.length })}
                </div>
              ) : null}

              {daily.failures.length === 0 ? (
                <div className="small muted">{t("dash.dailyAllOk")}</div>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  {daily.failures.map((failure) => (
                    <div key={`${failure.serverId ?? "sem-servidor"}-${failure.startedAt}`} className="spread">
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {failure.serverLabel ?? t("dash.serverRemoved")}{" "}
                          <span className="small muted mono">{failure.serverCode ?? ""}</span>
                        </div>
                        <div className="small muted">{failure.message ?? t("dash.errorNoDetail")}</div>
                      </div>
                      <span className="small muted nowrap">
                        {formatDateTime(failure.startedAt, locale, "America/Sao_Paulo")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        {serverCards.map(({ server, top }) => (
          <section key={server.id} className="card">
            <div className="card-head">
              <div>
                <div className="card-title">{t("dash.topPower", { server: server.label })}</div>
                <div className="card-sub">{t("dash.topPowerSub")}</div>
              </div>
              <Link className="btn sm ghost" href={`/players?server=${server.code}`}>
                {t("dash.viewAll")}
              </Link>
            </div>
            <div className="card-body tight">
              {top.length === 0 ? (
                <EmptyState title={t("dash.noPlayers")}>
                  {t("dash.noPlayersBody", { server: server.label })}
                </EmptyState>
              ) : (
                <div className="list">
                  {top.map((character, index) => (
                    <div key={character.id} className="list-row">
                      <div className="player-cell">
                        <span className={`rank-cell${index < 3 ? " top" : ""}`} style={{ width: 24 }}>
                          {character.rank_position ?? index + 1}
                        </span>
                        <div>
                          <Link className="player-name" href={`/players/${character.id}`}>
                            {character.name}
                          </Link>
                          <div className="player-clan">
                            {character.clan && character.clan_id && canEditServer(user, character.server_id) ? (
                              <Link
                                className="clan-link"
                                href={`/clans/${character.clan_id}?server=${character.server_code}`}
                              >
                                {character.clan}
                              </Link>
                            ) : (
                              (character.clan ?? t("common.noClan"))
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="mono" style={{ fontWeight: 650 }}>
                          {formatPower(character.power_score, locale)}
                        </div>
                        <div className="small muted">
                          {t("dash.atWar", {
                            duration: formatDuration(warByCharacter.get(character.id)?.totalSeconds ?? 0, locale),
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="grid cols-2">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("dash.openWars")}</div>
              <div className="card-sub">{t("dash.openWarsSub")}</div>
            </div>
            <Link className="btn sm ghost" href="/wars">
              {t("dash.openWarsAll")}
            </Link>
          </div>
          <div className="card-body tight">
            {activeWars.length === 0 ? (
              <EmptyState title={t("dash.noOpenWars")}>{t("dash.noOpenWarsBody")}</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t("common.player")}</th>
                      <th>{t("dash.warServer")}</th>
                      <th className="num">{t("common.time")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeWars.slice(0, 6).map((session) => (
                      <tr key={session.id}>
                        <td>
                          <Link className="player-name" href={`/players/${session.character_id}`}>
                            {session.character_name}
                          </Link>
                          <div className="player-clan">{session.home_server_label}</div>
                        </td>
                        <td>
                          <span className="badge gold">{session.war_server_label}</span>
                        </td>
                        <td className="num mono">
                          {formatDuration((now - Date.parse(session.started_at)) / 1000, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("dash.recentSyncs")}</div>
              <div className="card-sub">{t("dash.recentSyncsSub")}</div>
            </div>
            {isAdmin(user) ? (
              <Link className="btn sm ghost" href="/sync">
                {t("dash.syncDetails")}
              </Link>
            ) : null}
          </div>
          <div className="card-body tight">
            {runs.length === 0 ? (
              <EmptyState title={t("dash.noSyncs")}>
                {isAdmin(user) ? t("dash.noSyncsAdmin") : t("dash.noSyncsUser")}
              </EmptyState>
            ) : (
              <div className="list">
                {runs.map((run) => (
                  <div key={run.id} className="list-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {run.server_label ?? "—"}{" "}
                        <span className={`badge ${run.status === "success" ? "ok" : run.status === "error" ? "err" : "warn"}`}>
                          {run.status}
                        </span>
                      </div>
                      <div className="small muted">
                        {formatDateTime(run.started_at, locale)} · {t("dash.rowsFetched", { count: run.rows_fetched })}
                      </div>
                    </div>
                    <div className="small muted mono">
                      {formatDuration((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000, locale)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
