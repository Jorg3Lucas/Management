import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { accessibleServers, canAdminServer, requireUser } from "@/lib/auth";
import {
  clanCandidates,
  clanMembers,
  countClanlessCharacters,
  getClan,
  getServerClan,
  STANCE_LABELS,
} from "@/lib/clans";
import { formatPower } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EmptyState, Flash, StatCard } from "@/components/ui";
import { assignClanPlayerAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const clan = getClan(Number(id));
  return { title: clan ? `Clã ${clan.name}` : "Clã" };
}

export default async function ClanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ server?: string; q?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const clanId = Number(id);

  if (!Number.isFinite(clanId)) notFound();
  const clan = getClan(clanId);
  if (!clan) notFound();

  const managed = accessibleServers(user).filter((server) => canAdminServer(user, server.id));
  if (managed.length === 0) redirect("/clans");

  const requested = (query.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0];
  const summary = getServerClan(selected.id, clanId);
  if (!summary || summary.members === 0) notFound();

  const search = (query.q ?? "").trim().slice(0, 60);
  const members = clanMembers(selected.id, clanId);
  const candidates = clanCandidates(selected.id, clanId, { search, limit: 100 });
  const clanless = countClanlessCharacters(selected.id);
  const path = `/clans/${clanId}?server=${selected.code}`;
  const returnTo = search ? `${path}&q=${encodeURIComponent(search)}` : path;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row small muted" style={{ marginBottom: 6 }}>
            <Link href={`/clans?server=${selected.code}`}>Clãs</Link>
            <span>/</span>
            <span>{selected.label}</span>
          </div>
          <h1 className="page-title">{clan.name}</h1>
          <p className="page-sub">
            Elenco do clã no ranking de {selected.label} e vínculo manual de jogadores.
          </p>
        </div>
        <div className="head-actions">
          {summary.stance ? (
            <span
              className={`badge ${summary.stance === "ally" ? "ok" : summary.stance === "enemy" ? "err" : ""}`}
            >
              {STANCE_LABELS[summary.stance]}
            </span>
          ) : (
            <span className="badge">Sem postura</span>
          )}
          <Link className="btn sm ghost" href={`/players?server=${selected.code}&q=${encodeURIComponent(clan.name)}`}>
            Ver no ranking
          </Link>
        </div>
      </div>

      <Flash ok={query.ok} error={query.error} />

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <StatCard label="Membros no clã" value={summary.members} foot="jogadores do ranking" />
        <StatCard label="Poder total" value={formatPower(summary.total_power)} foot="soma do clã" />
        <StatCard label="Maior poder" value={formatPower(summary.top_power)} foot="jogador mais forte" />
        <StatCard label="Jogadores sem clã" value={clanless} foot={`no servidor ${selected.code}`} />
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Elenco do clã</div>
            <div className="card-sub">
              Ordenado por poder · última atividade {summary.last_seen_at ? formatDateTime(summary.last_seen_at) : "—"}
            </div>
          </div>
          <span className="badge">{members.length}</span>
        </div>
        <div className="table-wrap">
          {members.length === 0 ? (
            <EmptyState title="Nenhum jogador neste clã">
              Vincule jogadores abaixo ou rode a sincronização do servidor.
            </EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th className="rank-cell">#</th>
                  <th>Jogador</th>
                  <th>Classe</th>
                  <th className="num">Poder</th>
                  <th className="num">Rank</th>
                  <th>Visto</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => (
                  <tr key={member.id}>
                    <td className="rank-cell">{index + 1}</td>
                    <td>
                      <Link className="player-name" href={`/players/${member.id}`}>
                        {member.name}
                      </Link>
                      {member.sync_locked ? (
                        <span className="badge warn" style={{ marginLeft: 6 }}>
                          protegido
                        </span>
                      ) : null}
                    </td>
                    <td className="muted small">{member.class_name ?? "—"}</td>
                    <td className="num mono">{formatPower(member.power_score)}</td>
                    <td className="num mono muted">{member.rank_position ?? "—"}</td>
                    <td className="small muted nowrap">
                      {member.last_seen_at ? formatDateTime(member.last_seen_at) : "—"}
                    </td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <form action={assignClanPlayerAction} className="inline-form">
                          <input type="hidden" name="serverId" value={selected.id} />
                          <input type="hidden" name="clanId" value={clanId} />
                          <input type="hidden" name="characterId" value={member.id} />
                          <input type="hidden" name="mode" value="remove" />
                          <input type="hidden" name="redirectTo" value={returnTo} />
                          <ConfirmButton message={`Remover ${member.name} do clã ${clan.name}?`}>
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

      <div className="grid cols-2">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Vincular jogador</div>
              <div className="card-sub">Escolha um personagem do servidor para entrar neste clã</div>
            </div>
          </div>
          <div className="card-body stack">
            <form action={path} method="get" className="inline-form" style={{ flexWrap: "wrap" }}>
              <input type="hidden" name="server" value={selected.code} />
              <input
                name="q"
                type="search"
                defaultValue={search}
                placeholder="Buscar jogador do servidor"
                aria-label="Buscar jogador para vincular"
                style={{ minWidth: 200 }}
              />
              <button className="btn sm" type="submit">
                Buscar
              </button>
              {search ? (
                <Link className="btn sm ghost" href={path}>
                  Limpar
                </Link>
              ) : null}
            </form>

            {candidates.length === 0 ? (
              <p className="small muted">
                {search
                  ? "Nenhum jogador encontrado fora deste clã com essa busca."
                  : "Todos os jogadores do servidor já estão neste clã."}
              </p>
            ) : (
              <form action={assignClanPlayerAction} className="stack">
                <input type="hidden" name="serverId" value={selected.id} />
                <input type="hidden" name="clanId" value={clanId} />
                <input type="hidden" name="mode" value="assign" />
                <input type="hidden" name="redirectTo" value={returnTo} />
                <div className="field">
                  <label htmlFor="characterId">Jogador</label>
                  <select id="characterId" name="characterId" required>
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} · {candidate.clan ?? "sem clã"} · {formatPower(candidate.power_score)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row">
                  <button className="btn primary" type="submit">
                    Vincular ao clã
                  </button>
                  <span className="small muted">
                    A lista traz primeiro quem está sem clã; use a busca para achar os demais.
                  </span>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Como o clã é definido</div>
              <div className="card-sub">Ranking do fórum e ajuste manual</div>
            </div>
          </div>
          <div className="card-body stack small muted">
            <p>
              O clã de cada jogador vem do ranking do fórum a cada sincronização. Jogadores sem clã no ranking ficam
              disponíveis para vínculo manual.
            </p>
            <p>
              Um vínculo manual fica gravado no histórico de trocas de clã com origem <strong>manual</strong>. Quando o
              ranking voltar a informar um clã para o jogador, a sincronização passa a valer e o vínculo manual é
              substituído.
            </p>
            <p>
              Remover um jogador do clã não apaga o personagem: ele continua no ranking, apenas sem clã até o próximo
              sync ou até você vinculá-lo de novo.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
