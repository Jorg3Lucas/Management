import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { accessibleServers, canAccessServer, canEditServer, requireUser } from "@/lib/auth";
import { clanTimelineForCharacters, stanceForClan } from "@/lib/clans";
import { formatDuration, formatNumber, formatPower, warTypeLabel } from "@/lib/format";
import { characterPeers, movesForPlayer, playerForCharacter } from "@/lib/players";
import {
  getCharacterWithServer,
  powerHistoryForCharacters,
  warSessionsForCharacter,
  warSessionsForCharacters,
} from "@/lib/queries";
import { formatDateTime, nowIso, utcToZonedInput } from "@/lib/time";
import { sessionSeconds, summarizeByCharacter, summarizeByWarServer, totalWarSeconds } from "@/lib/wars";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Flash, SyncBadge } from "@/components/ui";
import {
  addWarSessionAction,
  deleteWarSessionAction,
  endWarSessionAction,
  setHomeServerAction,
  updateCharacterAction,
} from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const character = getCharacterWithServer(Number(id));
  return { title: character ? `${character.name} — ${character.server_label}` : "Jogador" };
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const flash = await searchParams;
  const characterId = Number(id);

  if (!Number.isFinite(characterId)) notFound();
  const character = getCharacterWithServer(characterId);
  if (!character) notFound();
  if (!canAccessServer(user, character.server_id)) {
    redirect("/players?error=" + encodeURIComponent("Você não tem acesso a esse servidor."));
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

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row small muted" style={{ marginBottom: 6 }}>
            <Link href="/players">Ranking</Link>
            <span>/</span>
            <span>{character.server_label}</span>
          </div>
          <h1 className="page-title">{character.name}</h1>
          <p className="page-sub">
            {character.clan ? `${character.clan} · ` : ""}
            {character.server_label} ({character.server_code}) · {character.class_name ?? "classe não informada"}
            {character.level ? ` · nível ${character.level}` : ""}
          </p>
        </div>
        <div className="head-actions">
          {clanStance ? (
            <span className={`badge ${clanStance === "ally" ? "ok" : clanStance === "enemy" ? "err" : ""}`}>
              Clã {clanStance === "ally" ? "aliado" : clanStance === "neutral" ? "neutro" : "inimigo"}
            </span>
          ) : null}
          <SyncBadge status={character.last_seen_at ? "success" : null} />
          {character.sync_locked ? <span className="badge warn">Protegido contra sync</span> : null}
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      {!editable ? (
        <div className="alert warn">
          Você tem acesso somente leitura neste servidor. Peça ao dono do servidor ou a um administrador para editar
          jogadores e guerras.
        </div>
      ) : null}

      <div className="hero-strip">
        <div className="hero-item">
          <div className="hero-label">Poder atual</div>
          <div className="hero-value mono">{formatPower(character.power_score)}</div>
        </div>
        <div className="divider" />
        <div className="hero-item">
          <div className="hero-label">Poder máximo</div>
          <div className="hero-value mono">{formatPower(character.peak_power)}</div>
          <div className="small muted">{character.peak_power_at ? formatDateTime(character.peak_power_at) : ""}</div>
        </div>
        <div className="divider" />
        <div className="hero-item">
          <div className="hero-label">Rank no servidor</div>
          <div className="hero-value mono">{character.rank_position ?? "—"}</div>
        </div>
        <div className="divider" />
        <div className="hero-item">
          <div className="hero-label">Tempo total em guerra</div>
          <div className="hero-value mono">{formatDuration(totalSeconds)}</div>
          <div className="small muted">{sessions.length} registro(s)</div>
        </div>
        <div className="divider" />
        <div className="hero-item">
          <div className="hero-label">Em guerra agora</div>
          <div className="hero-value">
            {activeSession ? (
              <span className="badge err live">{formatDuration(activeSeconds)}</span>
            ) : (
              <span className="muted">—</span>
            )}
          </div>
          <div className="small muted">
            {activeSession ? `desde ${formatDateTime(activeSession.started_at)}` : "nenhuma guerra aberta"}
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Dados do jogador</div>
              <div className="card-sub">Edição manual tem prioridade quando o registro está protegido</div>
            </div>
          </div>
          <div className="card-body">
            <form action={updateCharacterAction} className="form-grid">
              <input type="hidden" name="characterId" value={character.id} />
              <div className="field">
                <label htmlFor="name">Nome</label>
                <input id="name" name="name" type="text" defaultValue={character.name} maxLength={60} required />
              </div>
              <div className="field">
                <label htmlFor="power">Poder atual</label>
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
                <label htmlFor="clan">Clã</label>
                <input id="clan" name="clan" type="text" defaultValue={character.clan ?? ""} maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="class">Classe</label>
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
                <label htmlFor="level">Nível</label>
                <input
                  id="level"
                  name="level"
                  type="text"
                  inputMode="numeric"
                  defaultValue={character.level ?? ""}
                  placeholder="Ex.: 200"
                />
              </div>
              <div className="field">
                <span className="field-label">Ranking atual</span>
                <input type="text" value={character.rank_position ?? "—"} readOnly disabled />
              </div>
              <div className="field full">
                <label htmlFor="notes">Observações</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  maxLength={2000}
                  defaultValue={character.notes ?? ""}
                  placeholder="Ex.: jogador mudou de servidor, nome antigo, combinados de guerra..."
                />
              </div>
              <div className="full">
                <label className="check">
                  <input type="checkbox" name="syncLocked" defaultChecked={Boolean(character.sync_locked)} />
                  Proteger contra a sincronização automática (o coletor não altera poder/rank deste jogador)
                </label>
              </div>
              <div className="full row">
                <button className="btn primary" type="submit" disabled={!editable}>
                  Salvar alterações
                </button>
                <span className="small muted">Cada mudança de poder entra no histórico com origem manual.</span>
              </div>
            </form>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Registrar guerra</div>
              <div className="card-sub">Acompanhe deslocamentos para outros servidores</div>
            </div>
          </div>
          <div className="card-body">
            <form action={addWarSessionAction} className="form-grid">
              <input type="hidden" name="characterId" value={character.id} />
              <div className="field">
                <label htmlFor="warServer">Servidor onde ocorreu</label>
                <select id="warServer" name="warServerId" defaultValue={character.server_id}>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.label} — {server.group_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="warType">Tipo</label>
                <select id="warType" name="warType" defaultValue="server_war">
                  <option value="server_war">Guerra de servidor</option>
                  <option value="clan_war">Guerra de clã</option>
                  <option value="castle_siege">Cerco ao castelo</option>
                  <option value="hidden_valley">Vale Escondido</option>
                  <option value="sabuk">Sabuk Clash</option>
                  <option value="other">Outra</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="startedAt">Início</label>
                <input
                  id="startedAt"
                  name="startedAt"
                  type="datetime-local"
                  defaultValue={utcToZonedInput(nowIso())}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="endedAt">Fim (vazio = em andamento)</label>
                <input id="endedAt" name="endedAt" type="datetime-local" />
              </div>
              <div className="field full">
                <label htmlFor="opponent">Servidor/clã adversário (opcional)</label>
                <input id="opponent" name="opponent" type="text" maxLength={60} placeholder="Ex.: EU21" />
              </div>
              <div className="field full">
                <label htmlFor="warNotes">Observações</label>
                <textarea id="warNotes" name="notes" rows={2} maxLength={2000} placeholder="Ex.: entrou na guerra às 21h, saiu 23h30" />
              </div>
              <div className="full row">
                <button className="btn primary" type="submit" disabled={!editable}>
                  Registrar guerra
                </button>
                <span className="small muted">Deixe o fim vazio para contar o tempo em aberto.</span>
              </div>
            </form>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Histórico de guerras</div>
            <div className="card-sub">Tempo contado por servidor onde a guerra aconteceu</div>
          </div>
          <span className="badge">{formatDuration(totalSeconds)} no total</span>
        </div>
        <div className="table-wrap">
          {sessions.length === 0 ? (
            <div className="empty">
              <strong>Nenhuma guerra registrada</strong>
              Use o formulário acima para registrar o primeiro deslocamento.
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Servidor</th>
                  <th>Tipo</th>
                  <th>Adversário</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th className="num">Duração</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <span className="badge gold">{session.war_server_label}</span>
                    </td>
                    <td className="small">{warTypeLabel(session.war_type)}</td>
                    <td className="small muted">{session.opponent ?? "—"}</td>
                    <td className="small nowrap">{formatDateTime(session.started_at)}</td>
                    <td className="small nowrap">{session.ended_at ? formatDateTime(session.ended_at) : "—"}</td>
                    <td className="num mono">{formatDuration(sessionSeconds(session, now))}</td>
                    <td>
                      {session.ended_at ? (
                        <span className="badge">Encerrada</span>
                      ) : (
                        <span className="badge err live">Em andamento</span>
                      )}
                    </td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        {!session.ended_at ? (
                          <form action={endWarSessionAction} className="inline-form">
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input type="hidden" name="redirectTo" value={path} />
                            <button className="btn sm" type="submit" disabled={!editable}>
                              Encerrar
                            </button>
                          </form>
                        ) : null}
                        <form action={deleteWarSessionAction} className="inline-form">
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="redirectTo" value={path} />
                          <ConfirmButton message="Remover este registro de guerra? Essa ação não pode ser desfeita.">
                            Remover
                          </ConfirmButton>
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
              <div className="card-title">Jogador e servidor casa</div>
              <div className="card-sub">Tempo de guerra somado entre os personagens desta mesma pessoa</div>
            </div>
            <span className="badge gold">{formatDuration(playerSeconds)} no total</span>
          </div>
          <div className="card-body stack">
            <div className="spread">
              <div>
                <div className="small muted">Servidor casa atual</div>
                <div className="row" style={{ marginTop: 4 }}>
                  <span className="badge gold" style={{ fontSize: 13, padding: "4px 10px" }}>
                    {homeServer?.label ?? (player.home_server_id ? "servidor sem acesso" : "não definido")}
                  </span>
                  {homeServer ? (
                    <span className="small muted">
                      {homeServer.code} · {homeServer.group_name}
                    </span>
                  ) : null}
                </div>
              </div>
              {editable ? (
                <form action={setHomeServerAction} className="inline-form">
                  <input type="hidden" name="characterId" value={character.id} />
                  <input type="hidden" name="redirectTo" value={path} />
                  <select
                    name="serverId"
                    defaultValue={player.home_server_id ?? character.server_id}
                    aria-label="Servidor casa"
                  >
                    {servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.label}
                      </option>
                    ))}
                  </select>
                  <button className="btn sm" type="submit">
                    Salvar casa
                  </button>
                </form>
              ) : null}
            </div>

            <div>
              <div className="small muted" style={{ marginBottom: 6 }}>
                Personagens deste jogador
              </div>
              <div className="list">
                {peers.map((peer) => (
                  <div key={peer.id} className="list-row">
                    <div>
                      {peer.id === character.id ? (
                        <span className="player-name">
                          {peer.name} <span className="badge gold">este</span>
                        </span>
                      ) : (
                        <Link className="player-name" href={`/players/${peer.id}`}>
                          {peer.name}
                        </Link>
                      )}
                      <div className="small muted">
                        {peer.server_label} ·{" "}
                        {peer.last_seen_at ? `visto ${formatDateTime(peer.last_seen_at)}` : "sem registro recente"}
                      </div>
                    </div>
                    <span className="mono small">
                      {formatDuration(secondsByCharacter.get(peer.id)?.totalSeconds ?? 0)}
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
              <div className="card-title">Histórico do jogador</div>
              <div className="card-sub">
                Servidores, clãs e poder somando todos os personagens deste jogador
              </div>
            </div>
            <div className="row">
              <span className="badge">{playerMoves.length} transferência(s)</span>
              <span className="badge">{clanTimeline.length} clã(s)</span>
              <span className="badge">{powerTimeline.length} captura(s)</span>
            </div>
          </div>
          <div className="card-body stack">
            <div>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span className="small muted">Mudanças de servidor</span>
                <span className="small muted">
                  casa atual: {homeServer?.label ?? (player.home_server_id ? "servidor sem acesso" : "não definida")}
                </span>
              </div>
              {playerMoves.length === 0 ? (
                <div className="empty">
                  <strong>Nenhuma mudança de servidor detectada</strong>
                  Quando este jogador aparecer em outro servidor, a troca entra aqui automaticamente.
                </div>
              ) : (
                <div className="list">
                  {playerMoves.map((move) => (
                    <div key={move.id} className="list-row">
                      <div>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="muted">{move.from_label ?? "origem desconhecida"}</span>
                          <span className="muted">→</span>
                          <span style={{ fontWeight: 600 }}>{move.to_label}</span>
                          {move.to_server_id === player.home_server_id ? (
                            <span className="badge gold">casa atual</span>
                          ) : null}
                        </div>
                        <div className="small muted">{formatDateTime(move.detected_at)}</div>
                      </div>
                      <span
                        className={`badge ${move.status === "confirmed" ? "ok" : move.status === "rejected" ? "err" : "warn"}`}
                      >
                        {move.status === "confirmed"
                          ? "confirmada"
                          : move.status === "rejected"
                            ? "rejeitada"
                            : "pendente"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span className="small muted">Clãs em que esteve</span>
                <span className="small muted">atual: {character.clan ?? "sem clã"}</span>
              </div>
              {clanTimeline.length === 0 ? (
                <div className="empty">
                  <strong>Sem clã registrado</strong>
                  O histórico começa quando o jogador entra em um clã.
                </div>
              ) : (
                <div className="list">
                  {clanTimeline.map((entry) => (
                    <div key={`${entry.character_id}-${entry.changed_at}-${entry.clan_name}`} className="list-row">
                      <div>
                        <div className="row" style={{ gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{entry.clan_name}</span>
                          {entry.current ? <span className="badge gold">atual</span> : null}
                          {entry.previous_clan_name ? (
                            <span className="small muted">veio de {entry.previous_clan_name}</span>
                          ) : null}
                        </div>
                        <div className="small muted">
                          {entry.character_name} · {entry.server_label} · {formatDateTime(entry.changed_at)}
                          {entry.source === "manual" ? " · manual" : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span className="small muted">Histórico de poder</span>
                <span className="small muted">{powerTimeline.length} captura(s)</span>
              </div>
              {powerTimeline.length === 0 ? (
                <div className="empty">Sem histórico de poder.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Personagem</th>
                        <th className="num">Poder</th>
                        <th className="num">Rank</th>
                        <th>Origem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {powerTimeline.map((entry) => (
                        <tr key={entry.id}>
                          <td className="small nowrap">{formatDateTime(entry.captured_at)}</td>
                          <td className="small">
                            {entry.character_name} <span className="muted">{entry.server_label}</span>
                          </td>
                          <td className="num mono">{formatNumber(entry.power_score)}</td>
                          <td className="num mono muted">{entry.rank_position ?? "—"}</td>
                          <td>
                            <span className={`badge ${entry.source === "manual" ? "gold" : ""}`}>
                              {entry.source === "manual" ? "manual" : "fórum"}
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
            <div className="card-title">Por servidor de guerra</div>
            <div className="card-sub">Onde o tempo foi gasto</div>
          </div>
        </div>
        <div className="card-body tight">
          {breakdown.size === 0 ? (
            <div className="empty">Sem dados de guerra.</div>
          ) : (
            <div className="list">
              {[...breakdown.entries()]
                .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds)
                .map(([serverId, data]) => (
                  <div key={serverId} className="list-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{breakdownLabels.get(serverId) ?? `Servidor ${serverId}`}</div>
                      <div className="small muted">{data.sessions} registro(s)</div>
                    </div>
                    <span className="mono">{formatDuration(data.totalSeconds)}</span>
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
      </datalist>
    </>
  );
}
