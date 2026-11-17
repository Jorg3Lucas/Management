import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { formatDuration, warTypeLabel } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { listCharacters, warSessionsForServers } from "@/lib/queries";
import { formatDateTime, nowIso, utcToZonedInput } from "@/lib/time";
import { groupWarSessions, sessionSeconds, totalWarSeconds } from "@/lib/wars";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EmptyState, Flash } from "@/components/ui";
import { WarPartyPicker } from "@/components/WarPartyPicker";
import { createWarAction, deleteWarGroupAction, endWarGroupAction } from "./actions";

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

  const editable = servers.filter((server) => canEditServer(user, server.id));
  const warServers = editable.length > 0 ? editable : [];
  const roster =
    editable.length > 0
      ? listCharacters({ serverIds: editable.map((server) => server.id), pageSize: 2000, sort: "name" }).rows.map(
          (row) => ({
            id: row.id,
            name: row.name,
            clan: row.clan,
            server_label: row.server_label,
          }),
        )
      : [];

  const allSessions = warSessionsForServers(ids, 1000);
  const sessions = selected ? allSessions.filter((session) => session.server_id === selected.id) : allSessions;
  const groups = groupWarSessions(sessions);
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

      {warServers.length === 0 || roster.length === 0 ? (
        <div className="alert warn" style={{ marginBottom: 16 }}>
          {t("wars.noEditableServers")}
        </div>
      ) : (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <div className="card-title">{t("wars.newTitle")}</div>
              <div className="card-sub">{t("wars.newSub")}</div>
            </div>
          </div>
          <div className="card-body">
            <form action={createWarAction} className="form-grid">
              <div className="field">
                <label htmlFor="warServerId">{t("wars.warServer")}</label>
                <select
                  id="warServerId"
                  name="warServerId"
                  defaultValue={selected && canEditServer(user, selected.id) ? selected.id : warServers[0].id}
                >
                  {warServers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.label} — {server.group_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="warType">{t("wars.colType")}</label>
                <select id="warType" name="warType" defaultValue="server_war">
                  <option value="server_war">{t("warType.server")}</option>
                  <option value="clan_war">{t("warType.clan")}</option>
                  <option value="castle_siege">{t("warType.siege")}</option>
                  <option value="hidden_valley">{t("warType.valley")}</option>
                  <option value="sabuk">{t("warType.sabuk")}</option>
                  <option value="other">{t("warType.other")}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="startedAt">{t("wars.colStart")}</label>
                <input
                  id="startedAt"
                  name="startedAt"
                  type="datetime-local"
                  defaultValue={utcToZonedInput(nowIso())}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="endedAt">{t("wars.colEnd")}</label>
                <input id="endedAt" name="endedAt" type="datetime-local" />
              </div>
              <div className="field">
                <label htmlFor="opponent">{t("player.opponent")}</label>
                <input
                  id="opponent"
                  name="opponent"
                  type="text"
                  maxLength={60}
                  placeholder={t("player.opponentPlaceholder")}
                />
              </div>
              <div className="field">
                <label htmlFor="notes">{t("common.notes")}</label>
                <input id="notes" name="notes" type="text" maxLength={2000} />
              </div>
              <div className="field full">
                <label>{t("wars.participants")}</label>
                <WarPartyPicker members={roster} />
              </div>
              <div className="full row">
                <button className="btn primary" type="submit">
                  {t("wars.createWar")}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      <div className="card">
        <div className="table-wrap">
          {groups.length === 0 ? (
            <EmptyState title={t("wars.empty")}>{t("wars.emptyBefore")}</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>{t("wars.colWar")}</th>
                  <th>{t("wars.warServer")}</th>
                  <th>{t("wars.colType")}</th>
                  <th>{t("wars.colStart")}</th>
                  <th className="num">{t("wars.colDuration")}</th>
                  <th>{t("wars.participants")}</th>
                  <th>{t("common.status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const head = group.sessions[0];
                  const open = group.sessions.some((session) => !session.ended_at);
                  const seconds = group.sessions.reduce((sum, session) => sum + sessionSeconds(session, now), 0);
                  const editableGroup = canEditServer(user, head.server_id);
                  return (
                    <tr key={group.key}>
                      <td>
                        <div className="war-party">
                          {group.sessions.map((session) => (
                            <Link key={session.id} className="player-name" href={`/players/${session.character_id}`}>
                              {session.character_name}
                            </Link>
                          ))}
                        </div>
                        {head.opponent ? <div className="player-clan">vs {head.opponent}</div> : null}
                      </td>
                      <td>
                        <span className="badge gold">{head.war_server_label}</span>
                      </td>
                      <td className="small">{warTypeLabel(head.war_type, locale)}</td>
                      <td className="small nowrap">
                        {formatDateTime(head.started_at, locale)}
                        {head.ended_at ? (
                          <div className="player-clan">{formatDateTime(head.ended_at, locale)}</div>
                        ) : null}
                      </td>
                      <td className="num mono">{formatDuration(seconds, locale)}</td>
                      <td>
                        <span className="badge">{t("wars.playerCount", { count: group.sessions.length })}</span>
                      </td>
                      <td>
                        {open ? (
                          <span className="badge err live">{t("wars.open")}</span>
                        ) : (
                          <span className="badge">{t("wars.closed")}</span>
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          {editableGroup ? (
                            <Link className="btn sm" href={`/wars/${head.id}`}>
                              {t("common.edit")}
                            </Link>
                          ) : null}
                          {open ? (
                            <form action={endWarGroupAction} className="inline-form">
                              <input type="hidden" name="sessionId" value={head.id} />
                              <input type="hidden" name="redirectTo" value="/wars" />
                              <button className="btn sm" type="submit">
                                {t("wars.end")}
                              </button>
                            </form>
                          ) : null}
                          {editableGroup ? (
                            <form action={deleteWarGroupAction} className="inline-form">
                              <input type="hidden" name="sessionId" value={head.id} />
                              <input type="hidden" name="redirectTo" value="/wars" />
                              <ConfirmButton message={t("wars.deleteGroupConfirm", { count: group.sessions.length })}>
                                {t("common.remove")}
                              </ConfirmButton>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
