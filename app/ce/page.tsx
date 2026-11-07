import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { Flash, StatCard } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import {
  CE_EXPEDITIONS,
  CE_GHOST_TRADE_TAX,
  CE_GHOST_TRADE_TAX_ROUNDED,
  CE_RUNS,
  ceAlliedClans,
  ceDonors,
  ceSummary,
  ceWeekStart,
  ceWeekTitle,
  epicStatues,
  getCePlan,
  listCePlans,
  shiftWeek,
} from "@/lib/ce";
import { saveCeDonationAction, saveCePlanAction } from "./actions";

export const metadata: Metadata = { title: "CE" };
export const dynamic = "force-dynamic";

type SearchParams = {
  server?: string;
  week?: string;
  clan?: string;
  ok?: string;
  error?: string;
};

export default async function CePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canEditServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  const currentWeek = ceWeekStart();
  const weekStart = ceWeekStart(params.week ?? currentWeek);

  const weeks = selected ? listCePlans(selected.id) : [];
  const alliedClans = selected ? ceAlliedClans(selected.id) : [];
  const clanPlans = alliedClans.map((clan) => {
    const plan = getCePlan(selected!.id, weekStart, clan.id);
    const summary = ceSummary(plan.runs);
    const donors = ceDonors(selected!.id, clan.id, plan.id);
    return {
      clan,
      plan,
      summary,
      donors,
      donated: donors.filter((donor) => donor.gold_done === 1).length,
      expected: plan.participants > 0 ? summary.requiredGold / plan.participants : 0,
    };
  });

  const activeClan =
    clanPlans.find((entry) => String(entry.clan.id) === params.clan) ?? clanPlans[0] ?? null;
  const activeHistory = activeClan
    ? weeks.filter((entry) => entry.clan_id === activeClan.clan.id)
    : [];

  const weekHref = (week: string) => `/ce?server=${selected?.code ?? ""}&week=${week}`;
  const clanHref = (clanId: number, week = weekStart) =>
    `/ce?server=${selected?.code ?? ""}&week=${week}&clan=${clanId}`;
  const returnTo = activeClan ? clanHref(activeClan.clan.id) : weekHref(weekStart);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Operação</p>
          <h1 className="page-title">Calculadora de CE</h1>
          <p className="page-sub">
            Cada clã aliado tem seu próprio plano, recursos e doações. Escolha um clã para trabalhar.
          </p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/ce?server=${server.code}&week=${weekStart}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      {managed.length === 0 ? (
        <div className="alert warn">
          Você não edita nenhum servidor. Peça ao administrador para liberar acesso em Usuários.
        </div>
      ) : null}

      {selected ? (
        <>
          <div className="row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
            <Link
              className="btn sm ghost"
              href={activeClan ? clanHref(activeClan.clan.id, shiftWeek(weekStart, -1)) : weekHref(shiftWeek(weekStart, -1))}
              aria-label="Semana anterior"
            >
              ←
            </Link>
            <span className="badge gold">{ceWeekTitle(weekStart)}</span>
            {weekStart === currentWeek ? <span className="badge">semana atual</span> : null}
            <Link
              className="btn sm ghost"
              href={activeClan ? clanHref(activeClan.clan.id, shiftWeek(weekStart, 1)) : weekHref(shiftWeek(weekStart, 1))}
              aria-label="Próxima semana"
            >
              →
            </Link>
            {weekStart !== currentWeek ? (
              <Link className="btn sm" href={activeClan ? clanHref(activeClan.clan.id, currentWeek) : weekHref(currentWeek)}>
                Ir para a semana atual
              </Link>
            ) : null}
            <form className="filters" action="/ce" method="get" style={{ margin: 0 }}>
              <input type="hidden" name="server" value={selected.code} />
              {activeClan ? <input type="hidden" name="clan" value={activeClan.clan.id} /> : null}
              <input type="date" name="week" defaultValue={weekStart} aria-label="Abrir semana" />
              <button className="btn sm" type="submit">
                Abrir semana
              </button>
            </form>
          </div>

          {clanPlans.length === 0 ? (
            <div className="alert warn">
              Nenhum clã aliado em {selected.label}. Marque os clãs aliados em <Link href="/clans">Clãs</Link> para
              criar um plano por clã.
            </div>
          ) : (
            <>
              <section className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <div>
                    <div className="card-title">Clãs aliados na semana</div>
                    <div className="card-sub">
                      Valores de cada clã, sem soma entre eles. Abra um clã para editar o plano e as doações.
                    </div>
                  </div>
                  <span className="badge">{clanPlans.length} clã(s)</span>
                </div>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Clã</th>
                        <th className="num">Membros</th>
                        <th className="num">Estátuas</th>
                        <th className="num">DS / energia</th>
                        <th className="num">Ouro c/ GT</th>
                        <th className="num">Doações</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {clanPlans.map((entry) => {
                        const active = activeClan?.clan.id === entry.clan.id;
                        return (
                          <tr
                            key={entry.clan.id}
                            style={active ? { background: "rgba(124, 108, 245, 0.07)" } : undefined}
                          >
                            <td className="cell-title" data-label="Clã">
                              <Link className="player-name" href={clanHref(entry.clan.id)}>
                                {entry.clan.name}
                              </Link>{" "}
                              {active ? <span className="badge gold">aberto</span> : null}
                            </td>
                            <td className="num mono" data-label="Membros">
                              {formatNumber(entry.clan.members)}
                            </td>
                            <td className="num mono" data-label="Estátuas">
                              {formatNumber(entry.summary.statues)}
                            </td>
                            <td className="num mono" data-label="DS / energia">
                              {formatNumber(entry.summary.darksteel)} / {formatNumber(entry.summary.energy)}
                            </td>
                            <td className="num mono" data-label="Ouro c/ GT">
                              {formatNumber(Math.round(entry.summary.requiredGold))}
                            </td>
                            <td className="num mono" data-label="Doações">
                              {formatNumber(entry.donated)}/{formatNumber(entry.donors.length)}
                            </td>
                            <td className="num">
                              <Link className={`btn sm ${active ? "primary" : "ghost"}`} href={clanHref(entry.clan.id)}>
                                Abrir
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {activeClan ? (
                <>
                  <div className="row" style={{ marginBottom: 12 }}>
                    <span className="badge gold">{activeClan.clan.name}</span>
                    <span className="small muted">
                      {formatNumber(activeClan.clan.members)} membro(s) · {ceWeekTitle(weekStart)}
                    </span>
                    {activeClan.plan.updatedAt ? (
                      <span className="small muted">salvo em {formatDateTime(activeClan.plan.updatedAt)}</span>
                    ) : (
                      <span className="small muted">ainda não salvo</span>
                    )}
                  </div>

                  <div className="grid cols-4" style={{ marginBottom: 16 }}>
                    <StatCard
                      label="Estátuas épicas"
                      value={formatNumber(activeClan.summary.statues)}
                      foot={`planejadas por ${activeClan.clan.name}`}
                    />
                    <StatCard
                      label="Darksteel"
                      value={formatNumber(activeClan.summary.darksteel)}
                      foot="deste clã"
                    />
                    <StatCard
                      label="Energia"
                      value={formatNumber(activeClan.summary.energy)}
                      foot="deste clã"
                    />
                    <StatCard
                      label="Ouro c/ ghost trade"
                      value={formatNumber(Math.round(activeClan.summary.requiredGold))}
                      foot={`ouro das CEs x2: ${formatNumber(activeClan.summary.gold)}`}
                    />
                  </div>

                  <div className="ce-detail-grid">
                    <section className="card">
                      <div className="card-head">
                        <div>
                          <div className="card-title">Plano de runs</div>
                          <div className="card-sub">Somente {activeClan.clan.name}</div>
                        </div>
                        <span className="badge">
                          {formatNumber(activeClan.plan.participants)} participante(s)
                        </span>
                      </div>

                      <form action={saveCePlanAction}>
                        <input type="hidden" name="serverId" value={selected.id} />
                        <input type="hidden" name="clanId" value={activeClan.clan.id} />
                        <input type="hidden" name="week" value={weekStart} />
                        <input type="hidden" name="redirectTo" value={returnTo} />

                        <div className="card-body row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                          <label className="mini-field narrow">
                            <span>Participantes</span>
                            <input
                              name="participants"
                              type="number"
                              min={0}
                              max={500}
                              step={1}
                              defaultValue={activeClan.plan.participants}
                              style={{ maxWidth: 120 }}
                            />
                          </label>
                          <span className="small muted" style={{ flex: "1 1 240px" }}>
                            Padrão: {formatNumber(activeClan.clan.members)} jogador(es) do clã. Doação esperada de
                            ouro:{" "}
                            {activeClan.plan.participants > 0
                              ? formatNumber(Math.round(activeClan.expected))
                              : "—"}{" "}
                            por membro.
                          </span>
                        </div>

                        <div className="table-wrap">
                          <table className="data">
                            <thead>
                              <tr>
                                <th>CE</th>
                                <th>Expedição</th>
                                <th>Plano do clã</th>
                                <th className="num">Estátuas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {CE_EXPEDITIONS.map((ce) => {
                                const run = activeClan.plan.runs[ce.no] ?? "x0";
                                return (
                                  <tr key={ce.no}>
                                    <td style={{ fontWeight: 700 }}>CE{ce.no}</td>
                                    <td>{ce.name}</td>
                                    <td>
                                      <select
                                        name={`run_${ce.no}`}
                                        defaultValue={run}
                                        aria-label={`Runs de ${activeClan.clan.name} na CE${ce.no}`}
                                      >
                                        {CE_RUNS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="num mono">{formatNumber(epicStatues(ce.no, run))}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="panel-body spread" style={{ gap: 12 }}>
                          <button className="btn primary" type="submit">
                            Salvar plano do clã
                          </button>
                          <span className="small muted">
                            Estátuas {formatNumber(activeClan.summary.statues)} · DS{" "}
                            {formatNumber(activeClan.summary.darksteel)} · energia{" "}
                            {formatNumber(activeClan.summary.energy)} · ouro{" "}
                            {formatNumber(activeClan.summary.gold)} · ghost trade{" "}
                            {formatNumber(Math.round(activeClan.summary.requiredGold))}
                          </span>
                        </div>
                      </form>
                    </section>

                    <section className="card">
                      <div className="card-head">
                        <div>
                          <div className="card-title">Doações de ouro</div>
                          <div className="card-sub">
                            Membros de {activeClan.clan.name} · esperado{" "}
                            {activeClan.plan.participants > 0
                              ? formatNumber(Math.round(activeClan.expected))
                              : "—"}{" "}
                            por membro
                          </div>
                        </div>
                        <span className="badge gold">
                          {formatNumber(activeClan.donated)}/{formatNumber(activeClan.donors.length)}
                        </span>
                      </div>

                      {activeClan.donors.length === 0 ? (
                        <div className="card-body">
                          <p className="small muted" style={{ margin: 0 }}>
                            Nenhum membro sincronizado neste clã.
                          </p>
                        </div>
                      ) : (
                        <div className="table-wrap">
                          <table className="data">
                            <thead>
                              <tr>
                                <th>Jogador</th>
                                <th className="num">Poder</th>
                                <th>Ouro</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeClan.donors.map((donor) => (
                                <tr key={donor.character_id}>
                                  <td className="cell-title" data-label="Jogador">
                                    <Link className="player-name" href={`/players/${donor.character_id}`}>
                                      {donor.name}
                                    </Link>
                                  </td>
                                  <td className="num mono" data-label="Poder">
                                    {formatNumber(donor.power_score)}
                                  </td>
                                  <td data-label="Ouro">
                                    <form action={saveCeDonationAction} className="row" style={{ gap: 8 }}>
                                      <input type="hidden" name="serverId" value={selected.id} />
                                      <input type="hidden" name="clanId" value={activeClan.clan.id} />
                                      <input type="hidden" name="week" value={weekStart} />
                                      <input type="hidden" name="redirectTo" value={returnTo} />
                                      <input type="hidden" name="characterId" value={donor.character_id} />
                                      <input type="hidden" name="name" value={donor.name} />
                                      <label className="small">
                                        <input
                                          type="checkbox"
                                          name="gold"
                                          value="1"
                                          defaultChecked={donor.gold_done === 1}
                                        />{" "}
                                        Já doou
                                      </label>
                                      <button className="btn sm" type="submit">
                                        Salvar
                                      </button>
                                    </form>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="panel-body">
                        <p className="small muted" style={{ margin: 0 }}>
                          Ouro só conta em CE x2; o ghost trade cobra{" "}
                          {Math.round(CE_GHOST_TRADE_TAX * 100)}% e arredonda para{" "}
                          {Math.round(CE_GHOST_TRADE_TAX_ROUNDED * 100)}% quando necessário para fechar em ouro
                          inteiro.
                        </p>
                      </div>
                    </section>
                  </div>

                  <details className="panel" style={{ marginTop: 16 }}>
                    <summary>
                      Histórico de {activeClan.clan.name} · {activeHistory.length} semana(s)
                    </summary>
                    {activeHistory.length > 0 ? (
                      <div className="list">
                        {activeHistory.map((entry) => (
                          <div key={entry.id} className="list-row">
                            <div>
                              <Link className="player-name" href={clanHref(activeClan.clan.id, entry.week_start)}>
                                {ceWeekTitle(entry.week_start)}
                              </Link>
                              <div className="small muted">
                                {formatNumber(entry.statues)} estátua(s) · ouro{" "}
                                {entry.donors_gold}/{entry.participants} ·{" "}
                                {formatNumber(entry.participants)} participante(s)
                              </div>
                            </div>
                            <Link className="btn sm ghost" href={clanHref(activeClan.clan.id, entry.week_start)}>
                              Abrir
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="panel-body">
                        <p className="small muted" style={{ margin: 0 }}>
                          Nenhum plano salvo para este clã ainda. Preencha as runs acima e salve para começar o
                          histórico.
                        </p>
                      </div>
                    )}
                  </details>
                </>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </>
  );
}
