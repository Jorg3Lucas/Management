import Link from "next/link";
import { accessibleServerIds, accessibleServers, canAdminServer, isAdmin, requireUser } from "@/lib/auth";
import { formatDuration, formatPower } from "@/lib/format";
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
  const flash = await searchParams;

  const ids = accessibleServerIds(user);
  const servers = accessibleServers(user);
  const focusServers = servers.filter((server) => server.is_focus);
  const now = Date.now();

  const sessions = warSessionsForServers(ids, 5000);
  const warByServer = summarizeByServer(sessions, now);
  const warByCharacter = summarizeByCharacter(sessions, now);
  const activeWars = sessions.filter((session) => !session.ended_at);
  const playerCounts = serverPlayerCounts();
  const totalPlayers = countCharactersForServers(ids);
  const runs = recentSyncRuns(6, ids);
  const daily = lastDailySyncRun(ids);

  const focusCards = focusServers.map((server) => {
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
          <p className="eyebrow">Operação</p>
          <h1 className="page-title">Visão geral</h1>
          <p className="page-sub">Ranking do fórum, deslocamentos de guerra e acessos em um só lugar.</p>
        </div>
        <div className="head-actions">
          <span className="badge">{servers.length} servidor(es) liberado(s)</span>
          {isAdmin(user) ? (
            <Link className="btn" href="/sync">
              Histórico de sync
            </Link>
          ) : null}
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      {focusCards.length === 0 ? (
        <div className="alert warn">
          Nenhum dos servidores foco (EU11 / EU21) está liberado para o seu usuário. Peça ao administrador para ajustar
          seu acesso.
        </div>
      ) : null}

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        {focusCards.map(({ server, players, topPlayer, warSeconds, activeWars }) => (
          <section key={server.id} className="card server-card highlight">
            <div className="server-head">
              <div>
                <div className="server-name">
                  {server.label}
                  <span className="server-code">{server.code}</span>
                </div>
                <div className="card-sub">
                  {server.group_name} · mundo {server.world_id}
                </div>
              </div>
              <SyncBadge status={server.last_sync_status} />
            </div>

            <div className="server-metrics">
              <div className="metric">
                <div className="metric-label">Jogadores</div>
                <div className="metric-value">{players.toLocaleString("pt-BR")}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Poder máximo</div>
                <div className="metric-value">{topPlayer ? formatPower(topPlayer.power_score) : "—"}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Tempo em guerra</div>
                <div className="metric-value">{formatDuration(warSeconds)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Guerras ativas</div>
                <div className="metric-value">{activeWars}</div>
              </div>
            </div>

            <div className="server-foot">
              <span>
                {server.last_sync_at ? `Sync ${formatDateTime(server.last_sync_at)}` : "Aguardando primeira sincronização"}
              </span>
              <Link className="btn sm ghost" href={`/players?server=${server.code}`}>
                Ver ranking
              </Link>
            </div>
          </section>
        ))}
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <StatCard
          label="Jogadores rastreados"
          value={totalPlayers.toLocaleString("pt-BR")}
          foot="nos servidores liberados"
        />
        <StatCard label="Tempo total em guerra" value={formatDuration(totalWarSeconds(sessions, now))} foot={`${sessions.length} batalha(s) registrada(s)`} />
        <StatCard
          label="Guerras em andamento"
          value={activeWars.length}
          foot={activeWars.length > 0 ? "jogadores em campo agora" : "nenhum jogador em guerra"}
        />
        <StatCard
          label="Servidores sincronizando"
          value={servers.filter((server) => server.sync_enabled).length}
          foot={`de ${servers.length} liberados`}
        />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Rodada diária automática</div>
            <div className="card-sub">Todos os servidores, todos os dias às 17h de Brasília</div>
          </div>
          {daily ? (
            <span className={`badge ${daily.failed > 0 || daily.total < servers.length ? "warn" : "ok"}`}>
              {daily.failed > 0 ? `${daily.failed} com erro` : daily.total < servers.length ? "rodada parcial" : "sem falhas"}
            </span>
          ) : null}
        </div>
        <div className="card-body">
          {!daily ? (
            <EmptyState title="A rodada diária ainda não executou">
              Ela roda sozinha às 17h (horário de Brasília) enquanto o app estiver em execução contínua.
            </EmptyState>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              <div className="spread">
                <div>
                  <div className="small muted">Última rodada</div>
                  <div style={{ fontWeight: 650 }}>{formatDateTime(daily.startedAt, "America/Sao_Paulo")}</div>
                  <div className="small muted">
                    {formatDuration((Date.parse(daily.finishedAt) - Date.parse(daily.startedAt)) / 1000)} de duração ·{" "}
                    {daily.total} servidor(es) registrado(s)
                  </div>
                </div>
                <div className="tag-list">
                  <span className="badge ok">{daily.ok} sincronizado(s)</span>
                  <span className="badge warn">{daily.empty} sem dados</span>
                  <span className={`badge ${daily.failed > 0 ? "err" : ""}`}>{daily.failed} com erro</span>
                </div>
              </div>

              {daily.total < servers.length ? (
                <div className="small" style={{ color: "var(--warn)" }}>
                  Rodada incompleta: {daily.total} de {servers.length} servidores registrados até agora.
                </div>
              ) : null}

              {daily.failures.length === 0 ? (
                <div className="small muted">Nenhum servidor falhou na última rodada.</div>
              ) : (
                <div className="stack" style={{ gap: 8 }}>
                  {daily.failures.map((failure) => (
                    <div key={`${failure.serverId ?? "sem-servidor"}-${failure.startedAt}`} className="spread">
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {failure.serverLabel ?? "Servidor removido"}{" "}
                          <span className="small muted mono">{failure.serverCode ?? ""}</span>
                        </div>
                        <div className="small muted">{failure.message ?? "erro sem detalhe"}</div>
                      </div>
                      <span className="small muted nowrap">
                        {formatDateTime(failure.startedAt, "America/Sao_Paulo")}
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
        {focusCards.map(({ server, top }) => (
          <section key={server.id} className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Top poder — {server.label}</div>
                <div className="card-sub">Ranking atual vindo do fórum</div>
              </div>
              <Link className="btn sm ghost" href={`/players?server=${server.code}`}>
                Ver tudo
              </Link>
            </div>
            <div className="card-body tight">
              {top.length === 0 ? (
                <EmptyState title="Nenhum jogador sincronizado">
                  Rode a sincronização para puxar o ranking de {server.label}.
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
                            {character.clan && character.clan_id && canAdminServer(user, character.server_id) ? (
                              <Link
                                className="clan-link"
                                href={`/clans/${character.clan_id}?server=${character.server_code}`}
                              >
                                {character.clan}
                              </Link>
                            ) : (
                              (character.clan ?? "sem clã")
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="mono" style={{ fontWeight: 650 }}>
                          {formatPower(character.power_score)}
                        </div>
                        <div className="small muted">
                          {formatDuration(warByCharacter.get(character.id)?.totalSeconds ?? 0)} em guerra
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
              <div className="card-title">Guerras em andamento</div>
              <div className="card-sub">Jogadores com batalha aberta</div>
            </div>
            <Link className="btn sm ghost" href="/wars">
              Todas
            </Link>
          </div>
          <div className="card-body tight">
            {activeWars.length === 0 ? (
              <EmptyState title="Nenhuma guerra aberta">
                Registre uma guerra no perfil do jogador para começar a contar o tempo.
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Jogador</th>
                      <th>Servidor da guerra</th>
                      <th className="num">Tempo</th>
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
                          {formatDuration((now - Date.parse(session.started_at)) / 1000)}
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
              <div className="card-title">Sincronizações recentes</div>
              <div className="card-sub">Últimas execuções do coletor do fórum</div>
            </div>
            {isAdmin(user) ? (
              <Link className="btn sm ghost" href="/sync">
                Detalhes
              </Link>
            ) : null}
          </div>
          <div className="card-body tight">
            {runs.length === 0 ? (
              <EmptyState title="Nenhuma sincronização ainda">
                {isAdmin(user) ? "Use Servidores ou Sincronização para rodar a primeira coleta." : "O administrador ainda não rodou a coleta."}
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
                        {formatDateTime(run.started_at)} · {run.rows_fetched} linha(s)
                      </div>
                    </div>
                    <div className="small muted mono">{formatDuration((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000)}</div>
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
