import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canAdminServer, isAdmin, requireUser } from "@/lib/auth";
import {
  clanStanceCounts,
  clansInServer,
  listServerClans,
  recentClanChanges,
  refreshClanLinks,
} from "@/lib/clans";
import { formatPower } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { EmptyState, Flash, StatCard } from "@/components/ui";
import { mergeClansAction, setClanStanceAction } from "./actions";

export const metadata: Metadata = { title: "Clãs" };
export const dynamic = "force-dynamic";

export default async function ClansPage({
  searchParams,
}: {
  searchParams: Promise<{ server?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  refreshClanLinks();

  const managed = accessibleServers(user).filter((server) => canAdminServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  const clans = selected ? listServerClans(selected.id) : [];
  const counts = selected ? clanStanceCounts(selected.id) : { ally: 0, neutral: 0, enemy: 0, unset: 0 };
  const changes = selected ? recentClanChanges(selected.id, 15) : [];
  const mergeOptions = selected && isAdmin(user) ? clansInServer(selected.id) : [];
  const returnTo = selected ? `/clans?server=${selected.code}` : "/clans";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Diplomacia</p>
          <h1 className="page-title">Clãs</h1>
          <p className="page-sub">
            Postura de cada clã no servidor e quem trocou de clã. O nome vem do fórum; a classificação é sua.
          </p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/clans?server=${server.code}`}
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
            <StatCard label="Aliados" value={counts.ally} foot="clãs marcados como aliados" />
            <StatCard label="Neutros" value={counts.neutral} foot="clãs marcados como neutros" />
            <StatCard label="Inimigos" value={counts.enemy} foot="clãs marcados como inimigos" />
            <StatCard label="Sem postura" value={counts.unset} foot={`de ${clans.length} clã(s) no ranking`} />
          </div>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">Clãs em {selected.label}</div>
                <div className="card-sub">Membros e poder somam o ranking sincronizado do servidor</div>
              </div>
              <Link className="btn sm ghost" href={`/players?server=${selected.code}`}>
                Ver ranking
              </Link>
            </div>
            <div className="table-wrap">
              {clans.length === 0 ? (
                <EmptyState title="Nenhum clã no ranking deste servidor">
                  Os clãs aparecem depois da primeira sincronização com jogadores que tenham clã.
                </EmptyState>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>Clã</th>
                      <th>Postura</th>
                      <th className="num">Membros</th>
                      <th className="num">Poder total</th>
                      <th className="num">Maior poder</th>
                      <th>Atividade</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {clans.map((clan) => (
                      <tr key={clan.clan_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{clan.clan_name}</div>
                          <div className="player-clan">{clan.stance ? stanceLabel(clan.stance) : "não classificada"}</div>
                        </td>
                        <td>
                          <form action={setClanStanceAction} className="inline-form">
                            <input type="hidden" name="serverId" value={selected.id} />
                            <input type="hidden" name="clanId" value={clan.clan_id} />
                            <input type="hidden" name="redirectTo" value={returnTo} />
                            <select
                              name="stance"
                              defaultValue={clan.stance ?? ""}
                              aria-label={`Postura de ${clan.clan_name}`}
                            >
                              <option value="">Sem postura</option>
                              <option value="ally">Aliado</option>
                              <option value="neutral">Neutro</option>
                              <option value="enemy">Inimigo</option>
                            </select>
                            <button className="btn sm" type="submit">
                              Salvar
                            </button>
                          </form>
                        </td>
                        <td className="num mono">{clan.members}</td>
                        <td className="num mono">{formatPower(clan.total_power)}</td>
                        <td className="num mono muted">{formatPower(clan.top_power)}</td>
                        <td className="small muted nowrap">
                          {clan.last_seen_at ? formatDateTime(clan.last_seen_at) : "—"}
                        </td>
                        <td>
                          <div className="row" style={{ justifyContent: "flex-end" }}>
                            <Link className="btn sm ghost" href={`/players?server=${selected.code}&q=${encodeURIComponent(clan.clan_name)}`}>
                              Jogadores
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <div className="grid cols-2">
            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Trocas de clã recentes</div>
                  <div className="card-sub">Detectadas no sync ou em edição manual</div>
                </div>
                <span className="badge">{changes.length}</span>
              </div>
              <div className="card-body tight">
                {changes.length === 0 ? (
                  <EmptyState title="Nenhuma troca registrada">
                    A partir de agora, quando o fórum mostrar outro clã para um jogador, a mudança aparece aqui.
                  </EmptyState>
                ) : (
                  <div className="list">
                    {changes.map((change) => (
                      <div key={change.id} className="list-row">
                        <div>
                          <Link className="player-name" href={`/players/${change.character_id}`}>
                            {change.character_name}
                          </Link>
                          <div className="small muted">
                            {change.previous_clan_name ?? "sem clã"} → <strong>{change.clan_name}</strong>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="small muted nowrap">{formatDateTime(change.changed_at)}</div>
                          <span className={`badge ${change.source === "manual" ? "gold" : ""}`}>{change.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Nomes variantes</div>
                  <div className="card-sub">Mescle grafias diferentes do mesmo clã</div>
                </div>
              </div>
              <div className="card-body">
                {mergeOptions.length < 2 ? (
                  <p className="small muted">
                    É preciso ter ao menos dois clãs no servidor para vincular um nome variante.
                  </p>
                ) : !isAdmin(user) ? (
                  <p className="small muted">
                    A mescla vale para todos os servidores, então apenas um administrador global pode fazê-la.
                  </p>
                ) : (
                  <form action={mergeClansAction} className="stack">
                    <input type="hidden" name="serverId" value={selected.id} />
                    <input type="hidden" name="redirectTo" value={returnTo} />
                    <div className="field">
                      <label htmlFor="sourceId">Clã variante (será absorvido)</label>
                      <select id="sourceId" name="sourceId" required>
                        {mergeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name} — {option.members} membro(s)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="targetId">Clã definitivo</label>
                      <select id="targetId" name="targetId" required>
                        {mergeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name} — {option.members} membro(s)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="row">
                      <button className="btn primary" type="submit">
                        Vincular clãs
                      </button>
                      <span className="small muted">
                        Personagens, histórico e posturas são reapontados; o nome antigo vira alias.
                      </span>
                    </div>
                  </form>
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}

function stanceLabel(stance: "ally" | "neutral" | "enemy"): string {
  return stance === "ally" ? "aliado" : stance === "neutral" ? "neutro" : "inimigo";
}
