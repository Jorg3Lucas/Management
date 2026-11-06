import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canAdminServer, requireUser } from "@/lib/auth";
import { formatDuration, formatPower } from "@/lib/format";
import { homeServerCandidates, homeServerMembers, refreshPlayerLinks } from "@/lib/players";
import { warSessionsForCharacters } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";
import { summarizeByCharacter, totalWarSeconds } from "@/lib/wars";
import { EmptyState, Flash, StatCard } from "@/components/ui";
import { setHomeServerBulkAction } from "../actions";

export const metadata: Metadata = { title: "Servidor casa" };
export const dynamic = "force-dynamic";

type SearchParams = { server?: string; q?: string; ok?: string; error?: string };

export default async function HomeServerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const params = await searchParams;
  refreshPlayerLinks();

  const managed = accessibleServers(user).filter((server) => canAdminServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;
  const search = (params.q ?? "").trim().slice(0, 60);

  const rows = selected ? homeServerMembers(selected.id, search) : [];
  const candidates = selected ? homeServerCandidates(selected.id, search) : [];
  const sessions = warSessionsForCharacters(Array.from(new Set(rows.map((row) => row.character_id))));
  const warByCharacter = summarizeByCharacter(sessions);
  const now = Date.now();

  const roster = new Map<number, { playerId: number; name: string; characters: typeof rows }>();
  for (const row of rows) {
    const group = roster.get(row.player_id) ?? { playerId: row.player_id, name: row.player_name, characters: [] };
    group.characters.push(row);
    roster.set(row.player_id, group);
  }
  const groups = Array.from(roster.values());
  const elsewhere = rows.filter((row) => !row.in_home_server).length;
  const totalSeconds = totalWarSeconds(sessions, now);
  const returnTo = selected ? `/players/home?server=${selected.code}` : "/players/home";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Jogadores</p>
          <h1 className="page-title">Servidor casa</h1>
          <p className="page-sub">
            Quem pertence ao servidor e onde os personagens dessa pessoa estão: servidor, clã, time, poder e tempo de
            guerra.
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn sm ghost" href="/players">
            Ranking
          </Link>
          {managed.slice(0, 5).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/players/home?server=${server.code}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      {managed.length === 0 ? (
        <div className="alert warn">
          Você não administra nenhum servidor. Peça ao administrador para marcar você como dono de um servidor em
          Usuários.
        </div>
      ) : null}

      {selected ? (
        <>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <StatCard label="Jogadores" value={groups.length} foot={`com casa em ${selected.label}`} />
            <StatCard
              label="Personagens"
              value={rows.length}
              foot={`${elsewhere} em outros servidores`}
            />
            <StatCard
              label="Tempo de guerra"
              value={formatDuration(totalSeconds)}
              foot={`${sessions.length} batalha(s) registrada(s)`}
            />
            <StatCard
              label="Sem esta casa"
              value={candidates.length}
              foot={`para atribuir em ${selected.label} (lista até 200)`}
            />
          </div>

          <form className="filters" style={{ marginBottom: 18 }} action="/players/home" method="get">
            <input type="hidden" name="server" value={selected.code} />
            <div className="field" style={{ flex: "1 1 260px" }}>
              <label htmlFor="q">Buscar jogador ou personagem</label>
              <input id="q" name="q" type="search" defaultValue={search} placeholder="Ex.: Garfil" />
            </div>
            <button className="btn" type="submit">
              Buscar
            </button>
            {search ? (
              <Link className="btn ghost" href={`/players/home?server=${selected.code}`}>
                Limpar
              </Link>
            ) : null}
          </form>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">Membros de {selected.label}</div>
                <div className="card-sub">
                  Personagens de cada jogador em qualquer servidor, com o time do clã naquele servidor
                </div>
              </div>
              <span className="badge">{groups.length} jogador(es)</span>
            </div>
            <div className="table-wrap">
              {groups.length === 0 ? (
                <EmptyState title="Nenhum jogador com casa neste servidor">
                  {search
                    ? "Nenhum resultado para a busca."
                    : "Defina o servidor casa dos jogadores na atribuição em massa abaixo."}
                </EmptyState>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>Jogador</th>
                      <th>Onde está</th>
                      <th>Clã / time</th>
                      <th className="num">Poder</th>
                      <th className="num">Guerra</th>
                      <th>Última atividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => {
                      const warTotal = group.characters.reduce(
                        (sum, row) => sum + (warByCharacter.get(row.character_id)?.totalSeconds ?? 0),
                        0,
                      );
                      const anchor = group.characters.find((row) => row.in_home_server) ?? group.characters[0];
                      const servers = new Set(group.characters.map((row) => row.server_label));
                      return group.characters.map((row, index) => (
                        <tr key={row.character_id}>
                          {index === 0 ? (
                            <td rowSpan={group.characters.length}>
                              <Link className="player-name" href={`/players/${anchor.character_id}`}>
                                {group.name}
                              </Link>
                              <div className="player-clan">
                                {group.characters.length} personagem(ns) em {servers.size} servidor(es)
                              </div>
                              <div className="small muted">
                                {warTotal > 0 ? `${formatDuration(warTotal)} em guerra` : "sem guerra registrada"}
                              </div>
                            </td>
                          ) : null}
                          <td>
                            <span className="badge">{row.server_label}</span>
                            {row.in_home_server ? (
                              <span className="badge ok" style={{ marginLeft: 6 }}>
                                casa
                              </span>
                            ) : null}
                            <div className="small muted">
                              {row.rank_position ? `#${row.rank_position} no servidor` : "fora do rank"}
                            </div>
                          </td>
                          <td>
                            {row.clan_name ? (
                              <span>{row.clan_name}</span>
                            ) : (
                              <span className="muted">sem clã</span>
                            )}
                            <div className="player-clan">
                              {row.team_name ? (
                                <span className="badge" style={row.team_color ? { color: row.team_color } : undefined}>
                                  {row.team_name}
                                </span>
                              ) : (
                                "sem time"
                              )}
                            </div>
                          </td>
                          <td className="num mono">{formatPower(row.power_score)}</td>
                          <td className="num mono">
                            {formatDuration(warByCharacter.get(row.character_id)?.totalSeconds ?? 0)}
                            {warByCharacter.get(row.character_id)?.activeCount ? (
                              <div className="small muted">em campo</div>
                            ) : null}
                          </td>
                          <td className="small muted nowrap">
                            {row.last_seen_at ? formatDateTime(row.last_seen_at) : "sem registro"}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {rows.length >= 500 ? (
              <div className="panel-body small muted">Exibindo os primeiros 500 personagens. Refine a busca.</div>
            ) : null}
          </section>

          <details className="panel" open>
            <summary>Definir servidor casa em massa</summary>
            <div className="panel-body">
              {candidates.length === 0 ? (
                <p className="small muted">
                  Todos os jogadores com personagem em {selected.label} já têm este servidor como casa.
                </p>
              ) : (
                <form action={setHomeServerBulkAction} className="stack">
                  <input type="hidden" name="serverId" value={selected.id} />
                  <input type="hidden" name="redirectTo" value={returnTo} />
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th />
                          <th>Jogador</th>
                          <th>Casa atual</th>
                          <th className="num">Personagens aqui</th>
                          <th className="num">Poder</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((candidate) => (
                          <tr key={candidate.player_id}>
                            <td>
                              <label className="check">
                                <input
                                  type="checkbox"
                                  name="playerIds"
                                  value={candidate.player_id}
                                  aria-label={`Selecionar ${candidate.player_name}`}
                                />
                              </label>
                            </td>
                            <td>{candidate.player_name}</td>
                            <td>
                              {candidate.home_label ? (
                                <span className="badge">{candidate.home_label}</span>
                              ) : (
                                <span className="badge warn">sem casa</span>
                              )}
                            </td>
                            <td className="num mono">{candidate.characters_here}</td>
                            <td className="num mono">{formatPower(candidate.power_here)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="row">
                    <button className="btn primary" type="submit">
                      Definir {selected.label} como casa
                    </button>
                    <span className="small muted">
                      Marca os jogadores selecionados como pertencentes a {selected.label}. Quem já tem casa em outro
                      servidor passa a ter esta.
                    </span>
                  </div>
                </form>
              )}
            </div>
          </details>
        </>
      ) : null}
    </>
  );
}
