import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, requireUser } from "@/lib/auth";
import { formatDuration, warTypeLabel } from "@/lib/format";
import { warSessionsForServers } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";
import { sessionSeconds, totalWarSeconds } from "@/lib/wars";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EmptyState, Flash } from "@/components/ui";
import { deleteWarSessionAction, endWarSessionAction } from "../players/actions";

export const metadata: Metadata = { title: "Guerras" };
export const dynamic = "force-dynamic";

export default async function WarsPage({
  searchParams,
}: {
  searchParams: Promise<{ server?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
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
          <p className="eyebrow">Guerras</p>
          <h1 className="page-title">Deslocamentos e tempo de guerra</h1>
          <p className="page-sub">
            Cada registro conta o tempo entre início e fim no servidor onde a batalha aconteceu, mesmo que o jogador
            pertença a outro servidor.
          </p>
        </div>
        <div className="head-actions">
          <span className="badge err live">{activeCount} em andamento</span>
          <span className="badge">{formatDuration(totalSeconds)} acumulados</span>
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      <form className="filters" action="/wars" method="get" style={{ marginBottom: 18 }}>
        <div className="field">
          <label htmlFor="server">Servidor da guerra</label>
          <select id="server" name="server" defaultValue={selected?.code ?? ""}>
            <option value="">Todos os servidores</option>
            {servers.map((server) => (
              <option key={server.id} value={server.code}>
                {server.label} — {server.group_name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" type="submit">
          Filtrar
        </button>
        {selected ? (
          <Link className="btn ghost" href="/wars">
            Limpar
          </Link>
        ) : null}
      </form>

      <div className="card">
        <div className="table-wrap">
          {sessions.length === 0 ? (
            <EmptyState title="Nenhuma guerra registrada">
              Abra a ficha de um jogador em <Link href="/players">Ranking</Link> e use &quot;Registrar guerra&quot;.
            </EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Jogador</th>
                  <th>Servidor de origem</th>
                  <th>Servidor da guerra</th>
                  <th>Tipo</th>
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
                    <td className="small">{warTypeLabel(session.war_type)}</td>
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
                            <input type="hidden" name="redirectTo" value="/wars" />
                            <button className="btn sm" type="submit">
                              Encerrar
                            </button>
                          </form>
                        ) : null}
                        <form action={deleteWarSessionAction} className="inline-form">
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input type="hidden" name="redirectTo" value="/wars" />
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
      </div>
    </>
  );
}
