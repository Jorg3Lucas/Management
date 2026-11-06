import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canAdminServer, requireUser } from "@/lib/auth";
import { formatPower } from "@/lib/format";
import { TEAM_COLORS, listTeams, teamClans, teamForce, unassignedClans } from "@/lib/teams";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Flash, StatCard } from "@/components/ui";
import { assignTeamClanAction, createTeamAction, deleteTeamAction, updateTeamAction } from "./actions";

export const metadata: Metadata = { title: "Times" };
export const dynamic = "force-dynamic";

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ server?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canAdminServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  const teams = selected ? listTeams(selected.id) : [];
  const force = selected ? teamForce(selected.id) : [];
  const free = selected ? unassignedClans(selected.id) : [];
  const clanLists = new Map<number, ReturnType<typeof teamClans>>();
  if (selected) {
    for (const team of force) clanLists.set(team.team_id, teamClans(team.team_id));
  }

  const membersInTeams = force.reduce((sum, team) => sum + team.members, 0);
  const powerInTeams = force.reduce((sum, team) => sum + team.total_power, 0);
  const returnTo = selected ? `/teams?server=${selected.code}` : "/teams";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Diplomacia</p>
          <h1 className="page-title">Times</h1>
          <p className="page-sub">
            Times agrupam clãs do servidor. O jogador entra no time do clã em que está, então o painel se atualiza
            sozinho a cada sincronização.
          </p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/teams?server=${server.code}`}
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
            <StatCard label="Times" value={teams.length} foot={`em ${selected.label}`} />
            <StatCard label="Jogadores em times" value={membersInTeams.toLocaleString("pt-BR")} foot="herdados do clã" />
            <StatCard label="Poder em times" value={formatPower(powerInTeams)} foot="soma do ranking sincronizado" />
            <StatCard label="Clãs sem time" value={free.length} foot="ainda não vinculados" />
          </div>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">Novo time</div>
                <div className="card-sub">Nome e cor aparecem nos cards de força</div>
              </div>
            </div>
            <div className="card-body">
              <form action={createTeamAction} className="form-grid">
                <input type="hidden" name="serverId" value={selected.id} />
                <input type="hidden" name="redirectTo" value={returnTo} />
                <div className="field">
                  <label htmlFor="teamName">Nome do time</label>
                  <input id="teamName" name="name" type="text" maxLength={40} required placeholder="Ex.: Bloco A" />
                </div>
                <div className="field">
                  <label htmlFor="teamColor">Cor</label>
                  <select id="teamColor" name="color" defaultValue={TEAM_COLORS[0].value}>
                    {TEAM_COLORS.map((color) => (
                      <option key={color.value} value={color.value}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="full row">
                  <button className="btn primary" type="submit">
                    Criar time
                  </button>
                </div>
              </form>
            </div>
          </section>

          {force.length === 0 ? (
            <div className="alert">
              Nenhum time criado em {selected.label}. Crie o primeiro acima e vincule os clãs que jogam com ele.
            </div>
          ) : null}

          {force.map((team) => {
            const clans = clanLists.get(team.team_id) ?? [];
            return (
              <section key={team.team_id} className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <div className="row" style={{ gap: 10 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 99,
                        background: team.color ?? "var(--muted-2)",
                        display: "inline-block",
                      }}
                    />
                    <div>
                      <div className="card-title">{team.team_name}</div>
                      <div className="card-sub">
                        {team.clans} clã(s) · {team.members} jogador(es) · maior poder {formatPower(team.top_power)}
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <span className="badge">{formatPower(team.total_power)} de poder</span>
                    <form action={deleteTeamAction} className="inline-form">
                      <input type="hidden" name="teamId" value={team.team_id} />
                      <input type="hidden" name="serverId" value={selected.id} />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <ConfirmButton message={`Remover o time ${team.team_name}? Os clãs voltam para "sem time".`}>
                        Remover
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
                <div className="card-body tight">
                  {clans.length === 0 ? (
                    <div className="empty">Nenhum clã vinculado a este time.</div>
                  ) : (
                    <div className="list">
                      {clans.map((clan) => (
                        <div key={clan.clan_id} className="list-row">
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {clan.clan_name}{" "}
                              {clan.stance ? (
                                <span
                                  className={`badge ${clan.stance === "ally" ? "ok" : clan.stance === "enemy" ? "err" : ""}`}
                                >
                                  {clan.stance === "ally" ? "aliado" : clan.stance === "neutral" ? "neutro" : "inimigo"}
                                </span>
                              ) : null}
                            </div>
                            <div className="small muted">
                              {clan.members} jogador(es) · {formatPower(clan.total_power)} de poder
                            </div>
                          </div>
                          <form action={assignTeamClanAction} className="inline-form">
                            <input type="hidden" name="serverId" value={selected.id} />
                            <input type="hidden" name="clanId" value={clan.clan_id} />
                            <input type="hidden" name="teamId" value="" />
                            <input type="hidden" name="redirectTo" value={returnTo} />
                            <button className="btn sm ghost" type="submit">
                              Desvincular
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="list-row" style={{ borderTop: "1px solid var(--border-soft)", flexWrap: "wrap" }}>
                    {free.length === 0 ? (
                      <span className="small muted">Todos os clãs do servidor já estão em um time.</span>
                    ) : (
                      <form action={assignTeamClanAction} className="inline-form" style={{ flexWrap: "wrap" }}>
                        <input type="hidden" name="serverId" value={selected.id} />
                        <input type="hidden" name="teamId" value={team.team_id} />
                        <input type="hidden" name="redirectTo" value={returnTo} />
                        <select name="clanId" required aria-label={`Clã para vincular a ${team.team_name}`}>
                          {free.map((clan) => (
                            <option key={clan.clan_id} value={clan.clan_id}>
                              {clan.clan_name} — {clan.members} jogador(es)
                            </option>
                          ))}
                        </select>
                        <button className="btn sm" type="submit">
                          Vincular clã
                        </button>
                      </form>
                    )}
                  </div>

                  <div className="list-row" style={{ borderTop: "1px solid var(--border-soft)", flexWrap: "wrap" }}>
                    <form action={updateTeamAction} className="inline-form" style={{ flexWrap: "wrap" }}>
                      <input type="hidden" name="teamId" value={team.team_id} />
                      <input type="hidden" name="serverId" value={selected.id} />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <input
                        name="name"
                        type="text"
                        defaultValue={team.team_name}
                        maxLength={40}
                        required
                        aria-label={`Nome do time ${team.team_name}`}
                        style={{ maxWidth: 220 }}
                      />
                      <select name="color" defaultValue={team.color ?? TEAM_COLORS[0].value} aria-label="Cor do time">
                        {TEAM_COLORS.map((color) => (
                          <option key={color.value} value={color.value}>
                            {color.label}
                          </option>
                        ))}
                      </select>
                      <button className="btn sm" type="submit">
                        Salvar time
                      </button>
                    </form>
                  </div>
                </div>
              </section>
            );
          })}

          {free.length > 0 ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Clãs sem time</div>
                  <div className="card-sub">Vincule pelo card do time; aqui ficam os que faltam</div>
                </div>
                <span className="badge warn">{free.length}</span>
              </div>
              <div className="card-body tight">
                <div className="list">
                  {free.map((clan) => (
                    <div key={clan.clan_id} className="list-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>{clan.clan_name}</div>
                        <div className="small muted">
                          {clan.members} jogador(es) · {formatPower(clan.total_power)} de poder
                        </div>
                      </div>
                      {teams.length === 0 ? (
                        <span className="small muted">Crie um time primeiro</span>
                      ) : (
                        <form action={assignTeamClanAction} className="inline-form">
                          <input type="hidden" name="serverId" value={selected.id} />
                          <input type="hidden" name="clanId" value={clan.clan_id} />
                          <input type="hidden" name="redirectTo" value={returnTo} />
                          <select name="teamId" required aria-label={`Time de ${clan.clan_name}`}>
                            {teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                          <button className="btn sm" type="submit">
                            Vincular
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
