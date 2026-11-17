import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, requireUser } from "@/lib/auth";
import { formatDuration, warTypeLabel } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { warSessionsForServers } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";
import { sessionSeconds, totalWarSeconds } from "@/lib/wars";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EmptyState, Flash } from "@/components/ui";
import { deleteWarSessionAction, endWarSessionAction } from "../players/actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("wars.metadata") };
}

export const dynamic = "force-dynamic";

export default async function WarsPage({
  searchParams,
}: {
  searchParams: Promise<{ server?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const params = await searchParams;
  const servers = accessibleServers(user);
  const ids = servers.map((server) => server.id);

  const requested = (params.server ?? "").toUpperCase();
  const selected = servers.find((server) => server.code === requested) ?? null;

  const allSessions = warSessionsForServers(ids, 1000);
  const sessions = selected ? allSessions.filter((session) => session.server_id === selected.id) : allSessions;
  const now = Date.now();
  const activeCount = sessions.filter((session) => !session.ended_at).length;
  const totalSeconds = totalWarSeconds(sessions, now);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("wars.eyebrow")}</p>
          <h1 className="page-title">{t("wars.title")}</h1>
          <p className="page-sub">{t("wars.sub")}</p>
        </div>
        <div className="head-actions">
          <span className="badge err live">{t("wars.runningCount", { count: activeCount })}</span>
          <span className="badge">{t("wars.total", { duration: formatDuration(totalSeconds, locale) })}</span>
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      <form className="filters" action="/wars" method="get" style={{ marginBottom: 18 }}>
        <div className="field">
          <label htmlFor="server">{t("wars.warServer")}</label>
          <select id="server" name="server" defaultValue={selected?.code ?? ""}>
            <option value="">{t("wars.allServers")}</option>
            {servers.map((server) => (
              <option key={server.id} value={server.code}>
                {server.label} — {server.group_name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" type="submit">
          {t("common.filter")}
        </button>
        {selected ? (
          <Link className="btn ghost" href="/wars">
            {t("players.clear")}
          </Link>
        ) : null}
      </form>

      <div className="card">
        <div className="table-wrap">
          {sessions.length === 0 ? (
            <EmptyState title={t("wars.empty")}>
              {t("wars.emptyBefore")}
              <Link href="/players">{t("nav.ranking")}</Link>
              {t("wars.emptyAfter")}
            </EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>{t("common.player")}</th>
                  <th>{t("wars.colOrigin")}</th>
                  <th>{t("wars.warServer")}</th>
                  <th>{t("wars.colType")}</th>
                  <th>{t("wars.colStart")}</th>
                  <th>{t("wars.colEnd")}</th>
                  <th className="num">{t("wars.colDuration")}</th>
                  <th>{t("common.status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <Link className="player-name" href={`/players/${session.character_id}`}>
                        {session.character_name}
                      </Link>
                      {session.opponent ? <div className="player-clan">vs {session.opponent}</div> : null}
                    </td>
                    <td>
                      <span className="badge">{session.home_server_label}</span>
                    </td>
                    <td>
                      <span className="badge gold">{session.war_server_label}</span>
                    </td>
                    <td className="small">{warTypeLabel(session.war_type, locale)}</td>
                    <td className="small nowrap">{formatDateTime(session.started_at, locale)}</td>
                    <td className="small nowrap">
                      {session.ended_at ? formatDateTime(session.ended_at, locale) : "—"}
                    </td>
                    <td className="num mono">{formatDuration(sessionSeconds(session, now), locale)}</td>
                    <td>
                      {session.ended_at ? (
                        <span className="badge">{t("wars.closed")}</span>
                      ) : (
                        <span className="badge err live">{t("wars.open")}</span>
                      )}
                    </td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        {!session.ended_at ? (
                          <form action={endWarSessionAction} className="inline-form">
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input type="hidden" name="redirectTo" value="/wars" />
                            <button className="btn sm" type="submit">
                              {t("wars.end")}
                            </button>
                          </form>
                        ) : null}
                        <form action={deleteWarSessionAction} className="inline-form">
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="redirectTo" value="/wars" />
                          <ConfirmButton message={t("wars.deleteConfirm")}>{t("common.remove")}</ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
