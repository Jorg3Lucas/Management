import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, canManageWar, requireUser } from "@/lib/auth";
import { stanceIndex } from "@/lib/clans";
import { formatDuration, warTypeLabel } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { getServerById, listCharacters, listServers, warSessionsForUser } from "@/lib/queries";
import type { ServerRow } from "@/lib/types";
import { formatDateTime, nowIso, utcToZonedInput } from "@/lib/time";
import { groupWarSessions, totalWarWindowSeconds, warWindowSeconds } from "@/lib/wars";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ElapsedTime } from "@/components/ElapsedTime";
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
  const allServers = listServers();

  const editable = servers.filter((server) => canEditServer(user, server.id));
  const stances = stanceIndex(editable.map((server) => server.id));
  const roster =
    editable.length > 0
      ? listCharacters({ serverIds: editable.map((server) => server.id), pageSize: 2000, sort: "name" }).rows.map(
          (row) => ({
            id: row.id,
            name: row.name,
            clan: row.clan,
            server_label: row.server_label,
            ally: row.clan_id !== null && stances.get(`${row.server_id}:${row.clan_id}`) === "ally",
          }),
        )
      : [];

  // Servidores acessíveis mais as guerras que o usuário cadastrou em qualquer
  // servidor do jogo (ele pode enviar o time para fora dos seus servidores).
  const allSessions = warSessionsForUser(user.id, ids, 1000);

  const seenServers = new Set(ids);
  const extraServers: ServerRow[] = [];
  for (const session of allSessions) {
    if (seenServers.has(session.server_id)) continue;
    seenServers.add(session.server_id);
    const server = getServerById(session.server_id);
    if (server) extraServers.push(server);
  }
  const filterServers = [...servers, ...extraServers];

  const requested = (params.server ?? "").toUpperCase();
  const selected = filterServers.find((server) => server.code === requested) ?? null;
  const sessions = selected ? allSessions.filter((session) => session.server_id === selected.id) : allSessions;
  const groups = groupWarSessions(sessions);
  const now = Date.now();
  const active = groups.filter((group) => group.sessions.some((session) => !session.ended_at));
  const closed = groups.filter((group) => group.sessions.every((session) => session.ended_at));
  const totalSeconds = totalWarWindowSeconds(
    groups.map((group) => group.sessions),
    now,
  );

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("wars.eyebrow")}</p>
          <h1 className="page-title">{t("wars.title")}</h1>
          <p className="page-sub">{t("wars.sub")}</p>
        </div>
        <div className="head-actions">
          <span className="badge err live">{t("wars.runningCount", { count: active.length })}</span>
          <span className="badge">{t("wars.total", { duration: formatDuration(totalSeconds, locale) })}</span>
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">{t("wars.activeTitle")}</div>
            <div className="card-sub">{t("wars.activeSub")}</div>
          </div>
        </div>
        {active.length === 0 ? (
          <EmptyState title={t("wars.activeEmpty")}>{t("wars.activeEmptyBody")}</EmptyState>
        ) : (
          <div className="card-body">
            <div className="war-live-grid">
              {active.map((group) => {
                const head = group.sessions[0];
                const editableGroup = canManageWar(user, group.sessions);
                const shown = group.sessions.slice(0, 6);
                const hidden = group.sessions.length - shown.length;

                return (
                  <article className="war-live" key={group.key}>
                    <div className="war-live-head">
                      <span className="badge gold">{head.war_server_label}</span>
                      <span className="small muted">{warTypeLabel(head.war_type, locale)}</span>
                    </div>
                    <div className="war-live-vs">{head.opponent ? `vs ${head.opponent}` : t("wars.noOpponent")}</div>
                    <ElapsedTime since={head.started_at} initialSeconds={warWindowSeconds(group.sessions, now)} />
                    <span className="war-live-meta">
                      {t("wars.liveSince", { time: formatDateTime(head.started_at, locale) })}
                    </span>
                    <div className="war-party">
                      {shown.map((session) => (
                        <Link key={session.id} className="player-name" href={`/players/${session.character_id}`}>
                          {session.character_name}
                        </Link>
                      ))}
                      {hidden > 0 ? <span className="small muted">+{hidden}</span> : null}
                    </div>
                    {editableGroup ? (
                      <div className="war-live-actions">
                        <Link className="btn sm" href={`/wars/${head.id}`}>
                          {t("common.edit")}
                        </Link>
                        <form action={endWarGroupAction} className="inline-form">
                          <input type="hidden" name="sessionId" value={head.id} />
                          <input type="hidden" name="redirectTo" value="/wars" />
                          <button className="btn sm" type="submit">
                            {t("wars.end")}
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <details className="panel" open={groups.length === 0}>
          <summary>{t("wars.newTitle")}</summary>
          <div className="panel-body">
            <p className="small muted" style={{ marginTop: 0 }}>
              {t("wars.newSub")}
            </p>
            <form action={createWarAction} className="form-grid">
              <div className="field">
                <label htmlFor="warServerId">{t("wars.warServer")}</label>
                <select
                  id="warServerId"
                  name="warServerId"
                  defaultValue={selected ? selected.id : allServers[0].id}
                >
                  {allServers.map((server) => (
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
      </details>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">{t("wars.historyTitle")}</div>
            <div className="card-sub">{t("wars.historySub")}</div>
          </div>
          <form className="row" action="/wars" method="get">
            <select name="server" defaultValue={selected?.code ?? ""} aria-label={t("wars.warServer")}>
              <option value="">{t("wars.allServers")}</option>
              {filterServers.map((server) => (
                <option key={server.id} value={server.code}>
                  {server.label} — {server.group_name}
                </option>
              ))}
            </select>
            <button className="btn sm" type="submit">
              {t("common.filter")}
            </button>
            {selected ? (
              <Link className="btn sm ghost" href="/wars">
                {t("players.clear")}
              </Link>
            ) : null}
          </form>
        </div>
        <div className="table-wrap">
          {closed.length === 0 ? (
            <EmptyState title={t("wars.empty")}>{t("wars.emptyBefore")}</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>{t("wars.colWar")}</th>
                  <th>{t("wars.warServer")}</th>
                  <th>{t("wars.colStart")}</th>
                  <th className="num">{t("wars.colDuration")}</th>
                  <th>{t("wars.participants")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {closed.map((group) => {
                  const head = group.sessions[0];
                  const editableGroup = canManageWar(user, group.sessions);
                  const shown = group.sessions.slice(0, 4);
                  const hidden = group.sessions.length - shown.length;

                  return (
                    <tr key={group.key}>
                      <td>
                        <div>{warTypeLabel(head.war_type, locale)}</div>
                        {head.opponent ? <div className="player-clan">vs {head.opponent}</div> : null}
                      </td>
                      <td>
                        <span className="badge gold">{head.war_server_label}</span>
                      </td>
                      <td className="small nowrap">{formatDateTime(head.started_at, locale)}</td>
                      <td className="num mono">{formatDuration(warWindowSeconds(group.sessions, now), locale)}</td>
                      <td>
                        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                          <span className="badge">{t("wars.playerCount", { count: group.sessions.length })}</span>
                          {shown.map((session) => (
                            <Link key={session.id} className="player-name" href={`/players/${session.character_id}`}>
                              {session.character_name}
                            </Link>
                          ))}
                          {hidden > 0 ? <span className="small muted">+{hidden}</span> : null}
                        </div>
                      </td>
                      <td>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          {editableGroup ? (
                            <Link className="btn sm" href={`/wars/${head.id}`}>
                              {t("common.edit")}
                            </Link>
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
      </section>
    </>
  );
}
