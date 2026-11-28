import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { accessibleServers, canAccessServer, canEditServer, requireUser } from "@/lib/auth";
import { clanTimelineForCharacters, stanceForClan } from "@/lib/clans";
import { formatDuration, formatNumber, formatPower, warTypeLabel } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { characterPeers, movesForPlayer, playerForCharacter } from "@/lib/players";
import {
  getCharacterWithServer,
  powerHistoryForCharacters,
  warSessionsForCharacter,
  warSessionsForCharacters,
} from "@/lib/queries";
import { formatDateTime, nowIso, utcToZonedInput } from "@/lib/time";
import { sessionSeconds, summarizeByCharacter, summarizeByWarServer, totalWarSeconds } from "@/lib/wars";
import { AutoSave } from "@/components/AutoSave";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Flash, SyncBadge } from "@/components/ui";
import { getTeam, listTeams, teamForClan } from "@/lib/teams";
import { assignCharacterTeamAction } from "@/app/teams/actions";
import {
  addWarSessionAction,
  deleteWarSessionAction,
  endWarSessionAction,
  setHomeServerAction,
  updateCharacterAction,
} from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { t } = await getT();
  const { id } = await params;
  const character = getCharacterWithServer(Number(id));
  return { title: character ? `${character.name} — ${character.server_label}` : t("player.metadata") };
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const { id } = await params;
  const flash = await searchParams;
  const characterId = Number(id);

  if (!Number.isFinite(characterId)) notFound();
  const character = getCharacterWithServer(characterId);
  if (!character) notFound();
  if (!canAccessServer(user, character.server_id)) {
    redirect("/players?error=" + encodeURIComponent(t("err.noServerAccess")));
  }

  const servers = accessibleServers(user);
  const sessions = warSessionsForCharacter(character.id);
  const now = Date.now();
  const totalSeconds = totalWarSeconds(sessions, now);
  const activeSession = sessions.find((session) => !session.ended_at) ?? null;
  const activeSeconds = activeSession ? sessionSeconds(activeSession, now) : 0;
  const breakdown = summarizeByWarServer(sessions, now);
  const breakdownLabels = new Map(sessions.map((session) => [session.server_id, session.war_server_label]));
  const path = `/players/${character.id}`;
  const editable = canEditServer(user, character.server_id);
  // Quem administra (admin, dono ou editor) algum servidor liberado também define a casa do jogador,
  // mesmo que o personagem esteja em outro servidor — é a mesma regra de setHomeServerAction.
  const canSetHomeServer = servers.some((server) => canEditServer(user, server.id));
  const clanStance = character.clan_id ? stanceForClan(character.server_id, character.clan_id) : null;
  const player = playerForCharacter(character.id);
  const peers = player
    ? characterPeers(player.id).filter((peer) => peer.id === character.id || canAccessServer(user, peer.server_id))
    : [];
  const playerSessions = peers.length > 0 ? warSessionsForCharacters(peers.map((peer) => peer.id)) : [];
  const playerSeconds = totalWarSeconds(playerSessions, now);
  const secondsByCharacter = summarizeByCharacter(playerSessions, now);
  const playerMoves = player ? movesForPlayer(player.id, 20) : [];
  const peerIds = peers.map((peer) => peer.id);
  const clanTimeline = clanTimelineForCharacters(peerIds, 30);
  const powerTimeline = powerHistoryForCharacters(peerIds, 40);
  const homeServer = player?.home_server_id
    ? servers.find((server) => server.id === player.home_server_id) ?? null
    : null;
  const canManageClanTeams = canEditServer(user, character.server_id);
  const teams = editable ? listTeams(character.server_id) : [];
  const individualTeam = character.team_id ? getTeam(character.team_id) : undefined;
  const clanTeam = character.clan_id ? teamForClan(character.server_id, character.clan_id) : undefined;
  const effectiveTeam = individualTeam ?? clanTeam;
  const className = character.class_name ?? t("player.noClass");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row small muted" style={{ marginBottom: 6 }}>
            <Link href="/players">{t("nav.ranking")}</Link>
            <span>/</span>
            <span>{character.server_label}</span>
          </div>
          <h1 className="page-title">{character.name}</h1>
          <p className="page-sub">
            {character.clan ? `${character.clan} · ` : ""}
            {character.server_label} ({character.server_code}) · {className}
            {character.level ? ` · ${t("player.level", { level: character.level })}` : ""}
          </p>
        </div>
        <div className="head-actions">
          {clanStance ? (
            <span className={`badge ${clanStance === "ally" ? "ok" : clanStance === "enemy" ? "err" : ""}`}>
              {t("player.clanStance", { stance: t(`stance.${clanStance}`) })}
            </span>
          ) : null}
          <SyncBadge status={character.last_seen_at ? "success" : null} locale={locale} />
          {character.sync_locked ? <span className="badge warn">{t("player.syncLocked")}</span> : null}
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      {!editable ? <div className="alert warn">{t("player.readOnly")}</div> : null}

      <div className="hero-strip">
        <div className="hero-item">
          <div className="hero-label">{t("players.colPower")}</div>
          <div className="hero-value mono">{formatPower(character.power_score, locale)}</div>
        </div>
        <div className="divider" />
        <div className="hero-item">
          <div className="hero-label">{t("dash.maxPower")}</div>
          <div className="hero-value mono">{formatPower(character.peak_power, locale)}</div>
          <div className="small muted">
            {character.peak_power_at ? formatDateTime(character.peak_power_at, locale) : ""}
          </div>
        </div>
        <div className="divider" />
        <div className="hero-item">
          <div className="hero-label">{t("player.rankInServer")}</div>
          <div className="hero-value mono">{character.rank_position ?? "—"}</div>
        </div>
        <div className="divider" />
        <div className="hero-item">
          <div className="hero-label">{t("dash.totalWarTime")}</div>
          <div className="hero-value mono">{formatDuration(totalSeconds, locale)}</div>
          <div className="small muted">{t("player.records", { count: sessions.length })}</div>
        </div>
        <div className="divider" />
        <div className="hero-item">
          <div className="hero-label">{t("player.atWarNow")}</div>
          <div className="hero-value">
            {activeSession ? (
              <span className="badge err live">{formatDuration(activeSeconds, locale)}</span>
            ) : (
              <span className="muted">—</span>
            )}
          </div>
          <div className="small muted">
            {activeSession
              ? t("player.since", { date: formatDateTime(activeSession.started_at, locale) })
              : t("player.noOpenWar")}
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("player.dataTitle")}</div>
              <div className="card-sub">{t("player.dataSub")}</div>
            </div>
          </div>
          <div className="card-body">
            <form action={updateCharacterAction} className="form-grid">
              <AutoSave enabled={editable} />
              <input type="hidden" name="characterId" value={character.id} />
              <div className="field">
                <label htmlFor="name">{t("player.name")}</label>
                <input id="name" name="name" type="text" defaultValue={character.name} maxLength={60} required />
              </div>
              <div className="field">
                <label htmlFor="power">{t("players.colPower")}</label>
                <input
                  id="power"
                  name="power"
                  type="text"
                  inputMode="numeric"
                  defaultValue={character.power_score}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="clan">{t("common.clan")}</label>
                <input id="clan" name="clan" type="text" defaultValue={character.clan ?? ""} maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="class">{t("players.colClass")}</label>
                <input
                  id="class"
                  name="className"
                  type="text"
                  list="mir4-classes"
                  defaultValue={character.class_name ?? ""}
                  maxLength={40}
                />
              </div>
              <div className="field">
                <label htmlFor="level">{t("players.levelOptional")}</label>
                <input
                  id="level"
                  name="level"
                  type="text"
                  inputMode="numeric"
                  defaultValue={character.level ?? ""}
                  placeholder={t("players.levelPlaceholder")}
                />
              </div>
              <div className="field">
                <span className="field-label">{t("player.currentRank")}</span>
                <input type="text" value={character.rank_position ?? "—"} readOnly disabled />
              </div>
              <div className="field full">
                <label htmlFor="notes">{t("common.notes")}</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  maxLength={2000}
                  defaultValue={character.notes ?? ""}
                  placeholder={t("player.notesPlaceholder")}
                />
              </div>
              <div className="full">
                <label className="check">
                  <input type="checkbox" name="syncLocked" defaultChecked={Boolean(character.sync_locked)} />
                  {t("player.syncLock")}
                </label>
              </div>
              <div className="full row">
                <span className="small muted">{t("player.powerNote")}</span>
              </div>
            </form>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("player.warTitle")}</div>
              <div className="card-sub">{t("player.warSub")}</div>
            </div>
          </div>
          <div className="card-body">
            <form action={addWarSessionAction} className="form-grid">
              <input type="hidden" name="characterId" value={character.id} />
              <div className="field">
                <label htmlFor="warServer">{t("player.warServerLabel")}</label>
                <select id="warServer" name="warServerId" defaultValue={character.server_id}>
                  {servers.map((server) => (
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
                <label htmlFor="endedAt">{t("player.warEndLabel")}</label>
                <input id="endedAt" name="endedAt" type="datetime-local" />
              </div>
              <div className="field full">
                <label htmlFor="opponent">{t("player.opponent")}</label>
                <input
                  id="opponent"
                  name="opponent"
                  type="text"
                  maxLength={60}
                  placeholder={t("player.opponentPlaceholder")}
                />
              </div>
              <div className="field full">
                <label htmlFor="warNotes">{t("common.notes")}</label>
                <textarea
                  id="warNotes"
                  name="notes"
                  rows={2}
                  maxLength={2000}
                  placeholder={t("player.warNotesPlaceholder")}
                />
              </div>
              <div className="full row">
                <button className="btn primary" type="submit" disabled={!editable}>
                  {t("player.warButton")}
                </button>
                <span className="small muted">{t("player.warNote")}</span>
              </div>
            </form>
          </div>
        </section>
      </div>

      {editable ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <div className="card-title">{t("player.teamTitle")}</div>
              <div className="card-sub">{t("player.teamSub")}</div>
            </div>
            <div className="row">
              {individualTeam ? <span className="badge gold">{t("player.individual")}</span> : null}
              {effectiveTeam ? (
                <span className="badge">
                  <span className="dot" style={{ background: effectiveTeam.color ?? undefined }} />
                  {effectiveTeam.name}
                </span>
              ) : (
                <span className="badge">{t("player.noTeam")}</span>
              )}
            </div>
          </div>
          <div className="card-body stack">
            {teams.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                {t("player.noTeamsCreated", { server: character.server_label })}{" "}
                {canManageClanTeams ? (
                  <Link href={`/teams?server=${character.server_code}`}>{t("player.createTeam")}</Link>
                ) : (
                  t("player.askOwnerTeam")
                )}
              </p>
            ) : (
              <form action={assignCharacterTeamAction} className="filters" style={{ margin: 0 }}>
                <AutoSave delay={400} />
                <input type="hidden" name="characterId" value={character.id} />
                <input type="hidden" name="redirectTo" value={path} />
                <div className="field" style={{ flex: "1 1 240px" }}>
                  <label htmlFor="profileTeam">{t("player.teamOfCharacter")}</label>
                  <select id="profileTeam" name="teamId" defaultValue={character.team_id ?? ""}>
                    <option value="">
                      {clanTeam
                        ? t("player.inheritTeam", { team: clanTeam.name })
                        : t("player.noTeamInherit")}
                    </option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                {canManageClanTeams ? (
                  <Link className="btn ghost" href={`/teams?server=${character.server_code}`}>
                    {t("player.manageTeams")}
                  </Link>
                ) : null}
              </form>
            )}
            <p className="small muted" style={{ margin: 0 }}>
              {t("player.teamNote", { team: clanTeam ? ` (${clanTeam.name})` : "" })}
            </p>
          </div>
        </section>
      ) : null}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">{t("player.warHistory")}</div>
            <div className="card-sub">{t("player.warHistorySub")}</div>
          </div>
          <span className="badge">{t("player.warTotal", { duration: formatDuration(totalSeconds, locale) })}</span>
        </div>
        <div className="table-wrap">
          {sessions.length === 0 ? (
            <div className="empty">
              <strong>{t("player.warEmpty")}</strong>
              {t("player.warEmptyBody")}
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>{t("common.server")}</th>
                  <th>{t("wars.colType")}</th>
                  <th>{t("player.colOpponent")}</th>
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
                      <span className="badge gold">{session.war_server_label}</span>
                    </td>
                    <td className="small">{warTypeLabel(session.war_type, locale)}</td>
                    <td className="small muted">{session.opponent ?? "—"}</td>
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
                            <input type="hidden" name="redirectTo" value={path} />
                            <button className="btn sm" type="submit" disabled={!editable}>
                              {t("wars.end")}
                            </button>
                          </form>
                        ) : null}
                        <form action={deleteWarSessionAction} className="inline-form">
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="redirectTo" value={path} />
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
      </section>

      {player ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <div className="card-title">{t("player.homeTitle")}</div>
              <div className="card-sub">{t("player.homeSub")}</div>
            </div>
            <span className="badge gold">
              {t("player.warTotal", { duration: formatDuration(playerSeconds, locale) })}
            </span>
          </div>
          <div className="card-body stack">
            <div className="spread">
              <div>
                <div className="small muted">{t("player.currentHome")}</div>
                <div className="row" style={{ marginTop: 4 }}>
                  <span className="badge gold" style={{ fontSize: 13, padding: "4px 10px" }}>
                    {homeServer?.label ??
                      (player.home_server_id ? t("player.noAccessServer") : t("player.homeUnset"))}
                  </span>
                  {homeServer ? (
                    <span className="small muted">
                      {homeServer.code} · {homeServer.group_name}
                    </span>
                  ) : null}
                </div>
              </div>
              {canSetHomeServer ? (
                <form action={setHomeServerAction} className="inline-form">
                  <AutoSave delay={400} />
                  <input type="hidden" name="characterId" value={character.id} />
                  <input type="hidden" name="redirectTo" value={path} />
                  <select
                    name="serverId"
                    defaultValue={player.home_server_id ?? character.server_id}
                    aria-label={t("player.homeAria")}
                  >
                    {servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.label}
                      </option>
                    ))}
                  </select>
                </form>
              ) : null}
            </div>

            <div>
              <div className="small muted" style={{ marginBottom: 6 }}>
                {t("player.characters")}
              </div>
              <div className="list">
                {peers.map((peer) => (
                  <div key={peer.id} className="list-row">
                    <div>
                      {peer.id === character.id ? (
                        <span className="player-name">
                          {peer.name} <span className="badge gold">{t("player.thisOne")}</span>
                        </span>
                      ) : (
                        <Link className="player-name" href={`/players/${peer.id}`}>
                          {peer.name}
                        </Link>
                      )}
                      <div className="small muted">
                        {peer.server_label} ·{" "}
                        {peer.last_seen_at
                          ? t("player.seenAt", { date: formatDateTime(peer.last_seen_at, locale) })
                          : t("player.noRecentRecord")}
                      </div>
                    </div>
                    <span className="mono small">
                      {formatDuration(secondsByCharacter.get(peer.id)?.totalSeconds ?? 0, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {player ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <div className="card-title">{t("player.journeyTitle")}</div>
              <div className="card-sub">{t("player.journeySub")}</div>
            </div>
            <div className="row">
              <span className="badge">{t("player.movesBadge", { count: playerMoves.length })}</span>
              <span className="badge">{t("player.clansBadge", { count: clanTimeline.length })}</span>
              <span className="badge">{t("player.capturesBadge", { count: powerTimeline.length })}</span>
            </div>
          </div>
          <div className="card-body stack">
            <div>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span className="small muted">{t("player.serverChanges")}</span>
                <span className="small muted">
                  {t("player.currentHomeInline", {
                    value:
                      homeServer?.label ??
                      (player.home_server_id ? t("player.noAccessServer") : t("player.homeUnsetF")),
                  })}
                </span>
              </div>
              {playerMoves.length === 0 ? (
                <div className="empty">
                  <strong>{t("player.noMoves")}</strong>
                  {t("player.noMovesBody")}
                </div>
              ) : (
                <div className="list">
                  {playerMoves.map((move) => (
                    <div key={move.id} className="list-row">
                      <div>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="muted">{move.from_label ?? t("player.unknownOrigin")}</span>
                          <span className="muted">→</span>
                          <span style={{ fontWeight: 600 }}>{move.to_label}</span>
                          {move.to_server_id === player.home_server_id ? (
                            <span className="badge gold">{t("player.currentHomeBadge")}</span>
                          ) : null}
                        </div>
                        <div className="small muted">{formatDateTime(move.detected_at, locale)}</div>
                      </div>
                      <span
                        className={`badge ${move.status === "confirmed" ? "ok" : move.status === "rejected" ? "err" : "warn"}`}
                      >
                        {move.status === "confirmed"
                          ? t("transfers.confirmed")
                          : move.status === "rejected"
                            ? t("transfers.rejected")
                            : t("player.pending")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span className="small muted">{t("player.pastClans")}</span>
                <span className="small muted">
                  {t("player.currentClan", { clan: character.clan ?? t("common.noClan") })}
                </span>
              </div>
              {clanTimeline.length === 0 ? (
                <div className="empty">
                  <strong>{t("player.noClanHistory")}</strong>
                  {t("player.noClanHistoryBody")}
                </div>
              ) : (
                <div className="list">
                  {clanTimeline.map((entry) => (
                    <div key={`${entry.character_id}-${entry.changed_at}-${entry.clan_name}`} className="list-row">
                      <div>
                        <div className="row" style={{ gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{entry.clan_name}</span>
                          {entry.current ? <span className="badge gold">{t("player.currentBadge")}</span> : null}
                          {entry.previous_clan_name ? (
                            <span className="small muted">
                              {t("player.cameFrom", { clan: entry.previous_clan_name })}
                            </span>
                          ) : null}
                        </div>
                        <div className="small muted">
                          {entry.character_name} · {entry.server_label} ·{" "}
                          {formatDateTime(entry.changed_at, locale)}
                          {entry.source === "manual" ? ` · ${t("player.manual")}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span className="small muted">{t("player.powerHistory")}</span>
                <span className="small muted">{t("player.capturesBadge", { count: powerTimeline.length })}</span>
              </div>
              {powerTimeline.length === 0 ? (
                <div className="empty">{t("player.noPowerHistory")}</div>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t("common.date")}</th>
                        <th>{t("player.colCharacter")}</th>
                        <th className="num">{t("players.colPower")}</th>
                        <th className="num">{t("clanDetail.colRank")}</th>
                        <th>{t("player.colSource")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {powerTimeline.map((entry) => (
                        <tr key={entry.id}>
                          <td className="small nowrap">{formatDateTime(entry.captured_at, locale)}</td>
                          <td className="small">
                            {entry.character_name} <span className="muted">{entry.server_label}</span>
                          </td>
                          <td className="num mono">{formatNumber(entry.power_score, locale)}</td>
                          <td className="num mono muted">{entry.rank_position ?? "—"}</td>
                          <td>
                            <span className={`badge ${entry.source === "manual" ? "gold" : ""}`}>
                              {entry.source === "manual" ? t("player.manual") : t("player.forum")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">{t("player.byWarServer")}</div>
            <div className="card-sub">{t("player.byWarServerSub")}</div>
          </div>
        </div>
        <div className="card-body tight">
          {breakdown.size === 0 ? (
            <div className="empty">{t("player.noWarData")}</div>
          ) : (
            <div className="list">
              {[...breakdown.entries()]
                .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds)
                .map(([serverId, data]) => (
                  <div key={serverId} className="list-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {breakdownLabels.get(serverId) ?? t("player.serverFallback", { id: serverId })}
                      </div>
                      <div className="small muted">{t("player.records", { count: data.sessions })}</div>
                    </div>
                    <span className="mono">{formatDuration(data.totalSeconds, locale)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      <datalist id="mir4-classes">
        <option value="Warrior" />
        <option value="Sorcerer" />
        <option value="Taoist" />
        <option value="Arbalist" />
        <option value="Lancer" />
        <option value="Darkist" />
        <option value="Lionheart" />
        <option value="Spirit Summoner" />
      </datalist>
    </>
  );
}
