import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canAdminServer, requireUser } from "@/lib/auth";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EmptyState, Flash, StatCard } from "@/components/ui";
import { formatNumber, formatPower } from "@/lib/format";
import {
  listSalaryPeriods,
  periodTitle,
  SALARY_ACTIVITIES,
  SALARY_PREFERENCES,
  SALARY_TIERS,
  SALARY_VALES,
  salaryAlliedClans,
  salaryCandidates,
  salaryEntries,
  salarySummary,
  salaryTiers,
  salaryValeEntries,
} from "@/lib/salaries";
import { listTeams } from "@/lib/teams";
import { APP_TIMEZONE } from "@/lib/time";
import {
  addSalaryEntryAction,
  addSalaryMembersAction,
  addSalaryTeamAction,
  createSalaryPeriodAction,
  deleteSalaryEntryAction,
  deleteSalaryPeriodAction,
  removeSalaryMemberAction,
  setSalaryProductionSlotAction,
  setSalaryWeightsAction,
  updateSalaryMemberAction,
} from "./actions";

export const metadata: Metadata = { title: "Salários" };
export const dynamic = "force-dynamic";

type SearchParams = { server?: string; period?: string; q?: string; ok?: string; error?: string };

/** Data de hoje (ou do dia somado) no fuso da app, para os campos de semana. */
function dayInput(offsetDays = 0): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

/** Pontos podem ter fração de 1/3; mostra até duas casas. */
function decimal(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export default async function SalariesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canAdminServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;
  const search = (params.q ?? "").trim().slice(0, 60);

  const periods = selected ? listSalaryPeriods(selected.id) : [];
  const requestedPeriod = Number(params.period);
  const period = periods.find((entry) => entry.id === requestedPeriod) ?? periods[0] ?? null;

  const tiers = selected && period ? salaryTiers(selected.id) : [];
  const summary = period ? salarySummary(period.id, tiers) : null;
  const vales = period ? salaryValeEntries(period.id) : [];
  const fixedEntries = period ? salaryEntries(period.id, "fixed") : [];
  const candidates = selected && period ? salaryCandidates(period.id, selected.id, search) : [];
  const alliedClans = selected ? salaryAlliedClans(selected.id) : 0;
  const teams = selected ? listTeams(selected.id) : [];

  const returnTo = period
    ? `/salaries?server=${selected?.code ?? ""}&period=${period.id}`
    : selected
      ? `/salaries?server=${selected.code}`
      : "/salaries";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Economia</p>
          <h1 className="page-title">Salários do vale</h1>
          <p className="page-sub">
            Produção dos três vales menos os custos, dividida por coeficiente entre os membros dos clãs aliados.
          </p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/salaries?server=${server.code}`}
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
          {summary ? (
            <div className="grid cols-4" style={{ marginBottom: 16 }}>
              <StatCard
                label="Prêmio da semana"
                value={formatNumber(summary.pool)}
                foot={`${formatNumber(summary.production)} de produção − ${formatNumber(summary.fixedCosts)} de custos`}
              />
              <StatCard
                label="Pago pelo elenco"
                value={formatNumber(summary.paid)}
                foot={`${summary.attended} de ${summary.members.length} participaram`}
              />
              <StatCard
                label="Não distribuído"
                value={formatNumber(summary.leftover)}
                foot="sobra de arredondamento e dos percentuais"
              />
              <StatCard
                label="Prêmio por ponto"
                value={formatNumber(Math.round(summary.base))}
                foot={`soma dos coeficientes: ${formatNumber(summary.totalWeight)}`}
              />
            </div>
          ) : null}

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">Semanas de {selected.label}</div>
                <div className="card-sub">A semana mais recente abre por padrão; cada uma guarda seus próprios números</div>
              </div>
              <span className="badge">{periods.length}</span>
            </div>
            <div className="card-body">
              <form action={createSalaryPeriodAction} className="form-grid">
                <input type="hidden" name="serverId" value={selected.id} />
                <input type="hidden" name="redirectTo" value={`/salaries?server=${selected.code}`} />
                <div className="field">
                  <label htmlFor="startsOn">Início da semana</label>
                  <input id="startsOn" name="startsOn" type="date" required defaultValue={dayInput()} />
                </div>
                <div className="field">
                  <label htmlFor="endsOn">Fim da semana</label>
                  <input id="endsOn" name="endsOn" type="date" required defaultValue={dayInput(6)} />
                </div>
                <div className="field">
                  <label htmlFor="label">Nome (opcional)</label>
                  <input id="label" name="label" type="text" maxLength={40} placeholder="Ex.: Vale 12" />
                </div>
                <div className="full row">
                  <button className="btn primary" type="submit">
                    Criar semana
                  </button>
                  <span className="small muted">A produção e os custos são lançados na semana criada.</span>
                </div>
              </form>
            </div>
            {periods.length > 0 ? (
              <div className="list" style={{ borderTop: "1px solid var(--border-soft)" }}>
                {periods.map((entry) => (
                  <div key={entry.id} className="list-row">
                    <div>
                      <Link
                        className="player-name"
                        href={`/salaries?server=${selected.code}&period=${entry.id}`}
                      >
                        {periodTitle(entry)}
                      </Link>
                      <div className="small muted">
                        Produção {formatNumber(entry.production)} · custos {formatNumber(entry.fixed_costs)} ·{" "}
                        {entry.members} membro(s)
                      </div>
                    </div>
                    <div className="row">
                      <span className="badge">{formatNumber(entry.production - entry.fixed_costs)}</span>
                      {period?.id === entry.id ? <span className="badge gold">aberta</span> : null}
                      <form action={deleteSalaryPeriodAction} className="inline-form">
                        <input type="hidden" name="periodId" value={entry.id} />
                        <input type="hidden" name="redirectTo" value={returnTo} />
                        <ConfirmButton message={`Remover a semana ${periodTitle(entry)} com vales, custos e elenco?`}>
                          Remover
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {!period || !summary ? (
            <div className="alert">Nenhuma semana criada em {selected.label}. Crie a primeira acima.</div>
          ) : (
            <>
              <div className="grid cols-2" style={{ marginBottom: 16 }}>
                <section className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">Vales da semana</div>
                      <div className="card-sub">Um espaço para cada vale: origem e valor coletado</div>
                    </div>
                    <span className="badge">{formatNumber(summary.production)}</span>
                  </div>
                  <div className="card-body stack">
                    {SALARY_VALES.map((vale) => {
                      const entry = vales[vale.slot - 1];
                      return (
                        <div key={vale.slot}>
                          <div className="small muted" style={{ fontWeight: 600, marginBottom: 4 }}>
                            {vale.label}
                            {entry ? ` · ${formatNumber(entry.amount)}` : ""}
                          </div>
                          <form
                            action={setSalaryProductionSlotAction}
                            className="filters"
                            style={{ margin: 0 }}
                          >
                            <input type="hidden" name="periodId" value={period.id} />
                            <input type="hidden" name="slot" value={vale.slot} />
                            <input type="hidden" name="redirectTo" value={returnTo} />
                            <input
                              name="name"
                              type="text"
                              maxLength={60}
                              defaultValue={entry?.name ?? ""}
                              placeholder="Origem (REDMOON)"
                              aria-label={`Origem do ${vale.label}`}
                              style={{ flex: "1 1 130px" }}
                            />
                            <input
                              name="amount"
                              type="text"
                              inputMode="numeric"
                              defaultValue={entry ? String(entry.amount) : ""}
                              placeholder="Valor"
                              aria-label={`Valor do ${vale.label}`}
                              style={{ flex: "1 1 110px" }}
                            />
                            <button className="btn sm" type="submit">
                              Salvar
                            </button>
                            {entry ? (
                              <button className="btn sm ghost" type="submit" name="clear" value="1" formNoValidate>
                                Limpar
                              </button>
                            ) : null}
                          </form>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">Custos da semana</div>
                      <div className="card-sub">Elder, staff e outros pagamentos descontados antes da divisão</div>
                    </div>
                    <span className="badge">{formatNumber(summary.fixedCosts)}</span>
                  </div>
                  <div className="card-body">
                    <form action={addSalaryEntryAction} className="filters" style={{ marginBottom: 12 }}>
                      <input type="hidden" name="periodId" value={period.id} />
                      <input type="hidden" name="kind" value="fixed" />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <div className="field" style={{ flex: "1 1 160px" }}>
                        <label htmlFor="fixed-name">Custo</label>
                        <input id="fixed-name" name="name" type="text" maxLength={60} required placeholder="Elder" />
                      </div>
                      <div className="field" style={{ flex: "1 1 140px" }}>
                        <label htmlFor="fixed-amount">Valor</label>
                        <input
                          id="fixed-amount"
                          name="amount"
                          type="text"
                          inputMode="numeric"
                          required
                          placeholder="10.000.000"
                        />
                      </div>
                      <button className="btn" type="submit">
                        Lançar
                      </button>
                    </form>
                    {fixedEntries.length === 0 ? (
                      <p className="small muted">Nenhum custo lançado nesta semana.</p>
                    ) : (
                      <div className="list">
                        {fixedEntries.map((entry) => (
                          <div key={entry.id} className="list-row" style={{ padding: "9px 0" }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{entry.name}</div>
                              <div className="small muted mono">{formatNumber(entry.amount)}</div>
                            </div>
                            <form action={deleteSalaryEntryAction} className="inline-form">
                              <input type="hidden" name="entryId" value={entry.id} />
                              <input type="hidden" name="redirectTo" value={returnTo} />
                              <button className="btn sm ghost" type="submit">
                                Remover
                              </button>
                            </form>
                          </div>
                        ))}
                        <div className="list-row" style={{ padding: "9px 0", fontWeight: 650 }}>
                          <span>Total</span>
                          <span className="mono">{formatNumber(summary.fixedCosts)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <section className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <div>
                    <div className="card-title">Coeficientes de {selected.label}</div>
                    <div className="card-sub">
                      Poder mínimo define a faixa; heist, altar e vale pagam 1/3 cada
                    </div>
                  </div>
                  {summary.pool < 0 ? <span className="badge err">custos maiores que a produção</span> : null}
                </div>
                <form action={setSalaryWeightsAction}>
                  <input type="hidden" name="serverId" value={selected.id} />
                  <input type="hidden" name="redirectTo" value={returnTo} />
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Faixa</th>
                          <th className="num">Poder mínimo</th>
                          <th className="num">Coeficiente</th>
                          <th className="num">Com presença</th>
                          <th className="num">Pontos</th>
                          <th className="num">Fatia do prêmio</th>
                          <th className="num">Salário por membro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.tiers.map((tier) => (
                          <tr key={tier.tier}>
                            <td style={{ fontWeight: 700 }}>{tier.tier}</td>
                            <td className="num">
                              <input
                                name={`power_${tier.tier}`}
                                type="text"
                                inputMode="numeric"
                                defaultValue={tier.minPower}
                                aria-label={`Poder mínimo da faixa ${tier.tier}`}
                                style={{ maxWidth: 104, marginLeft: "auto" }}
                              />
                            </td>
                            <td className="num">
                              <input
                                name={`weight_${tier.tier}`}
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                defaultValue={tier.weight}
                                aria-label={`Coeficiente da faixa ${tier.tier}`}
                                style={{ maxWidth: 90, marginLeft: "auto" }}
                              />
                            </td>
                            <td className="num mono">{tier.members}</td>
                            <td className="num mono">{decimal(tier.points)}</td>
                            <td className="num mono">{formatNumber(Math.round(tier.pool))}</td>
                            <td className="num mono">{formatNumber(Math.floor(tier.salary))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td style={{ fontWeight: 650 }}>Total</td>
                          <td />
                          <td />
                          <td className="num mono">{summary.attended}</td>
                          <td className="num mono">{decimal(summary.totalWeight)}</td>
                          <td className="num mono">{formatNumber(summary.pool)}</td>
                          <td className="num small muted">1 ponto = {formatNumber(Math.round(summary.base))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="panel-body row">
                    <button className="btn" type="submit">
                      Salvar coeficientes
                    </button>
                    <span className="small muted">
                      Prêmio por ponto = (vales − custos) ÷ soma dos coeficientes ponderados pelas presenças.
                    </span>
                  </div>
                </form>
              </section>

              <section className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <div>
                    <div className="card-title">Elenco da semana</div>
                    <div className="card-sub">
                      {summary.attended} de {summary.members.length} com presença · {summary.preferences.darksteel}{" "}
                      querem darksteel · {summary.preferences.stone} querem pedra
                    </div>
                  </div>
                  <span className="badge">
                    {summary.attended}/{summary.members.length}
                  </span>
                </div>
                <div className="table-wrap">
                  {summary.members.length === 0 ? (
                    <EmptyState title="Nenhum jogador no elenco desta semana">
                      Adicione membros aliados no painel abaixo, selecionando do ranking ou um time inteiro.
                    </EmptyState>
                  ) : (
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Jogador</th>
                          <th>Clã / time</th>
                          <th className="num">Poder</th>
                          <th>Faixa · % · heist · altar · vale · preferência</th>
                          <th className="num">Salário</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {summary.members.map((member) => (
                          <tr key={member.character_id}>
                            <td>
                              <Link className="player-name" href={`/players/${member.character_id}`}>
                                {member.name}
                              </Link>
                              <div className="player-clan">
                                {member.team_name ? (
                                  <span
                                    className="badge"
                                    style={member.team_color ? { color: member.team_color } : undefined}
                                  >
                                    {member.team_name}
                                  </span>
                                ) : (
                                  "sem time"
                                )}
                              </div>
                            </td>
                            <td className="small">
                              {member.clan ?? <span className="muted">sem clã</span>}
                            </td>
                            <td className="num mono">{formatPower(member.power_score)}</td>
                            <td>
                              <form
                                action={updateSalaryMemberAction}
                                className="inline-form"
                                style={{ flexWrap: "wrap", gap: 6 }}
                              >
                                <input type="hidden" name="periodId" value={period.id} />
                                <input type="hidden" name="characterId" value={member.character_id} />
                                <input type="hidden" name="redirectTo" value={returnTo} />
                                <select
                                  name="tier"
                                  defaultValue={member.tier}
                                  aria-label={`Faixa de ${member.name}`}
                                  style={{ maxWidth: 92 }}
                                >
                                  {tiers.map((tier) => (
                                    <option key={tier.tier} value={tier.tier}>
                                      {tier.tier} · ×{formatNumber(tier.weight)}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  name="sharePercent"
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={5}
                                  defaultValue={member.share_percent}
                                  aria-label={`Percentual pago a ${member.name}`}
                                  style={{ maxWidth: 70 }}
                                />
                                {SALARY_ACTIVITIES.map((activity) => (
                                  <label key={activity.field} className="check" title={activity.label}>
                                    <input
                                      type="checkbox"
                                      name={`attended${activity.field[0].toUpperCase()}${activity.field.slice(1)}`}
                                      value="1"
                                      defaultChecked={
                                        member[`attended_${activity.field}` as "attended_heist" | "attended_altar" | "attended_vale"] === 1
                                      }
                                    />
                                    {activity.label.toLowerCase()}
                                  </label>
                                ))}
                                <select
                                  name="preference"
                                  defaultValue={member.preference}
                                  aria-label={`Recompensa preferida de ${member.name}`}
                                  style={{ maxWidth: 116 }}
                                >
                                  {SALARY_PREFERENCES.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <button className="btn sm" type="submit">
                                  Salvar
                                </button>
                              </form>
                            </td>
                            <td className="num mono">
                              {member.attendedCount > 0 ? (
                                <>
                                  {formatNumber(member.salary)}
                                  <div className="small muted">
                                    {member.attendedCount}/3
                                    {member.share_percent !== 100 ? ` · ${member.share_percent}%` : ""}
                                  </div>
                                </>
                              ) : (
                                <span className="small muted">sem presença</span>
                              )}
                            </td>
                            <td>
                              <form
                                action={removeSalaryMemberAction}
                                className="inline-form"
                                style={{ justifyContent: "flex-end" }}
                              >
                                <input type="hidden" name="periodId" value={period.id} />
                                <input type="hidden" name="characterId" value={member.character_id} />
                                <input type="hidden" name="redirectTo" value={returnTo} />
                                <ConfirmButton message={`Remover ${member.name} do elenco desta semana?`}>
                                  Remover
                                </ConfirmButton>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4} style={{ fontWeight: 650 }}>
                            Total pago
                          </td>
                          <td className="num mono" style={{ fontWeight: 650 }}>
                            {formatNumber(summary.paid)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </section>

              <details className="panel">
                <summary>Adicionar membros ao elenco</summary>
                <div className="panel-body stack">
                  <p className="small muted" style={{ margin: 0 }}>
                    Só aparecem jogadores dos clãs aliados de {selected.label} ({alliedClans} clã(s) marcado(s)).
                    Ajuste a postura dos clãs em <Link href="/clans">Clãs</Link>.
                  </p>

                  <form className="filters" action="/salaries" method="get">
                    <input type="hidden" name="server" value={selected.code} />
                    <input type="hidden" name="period" value={period.id} />
                    <div className="field" style={{ flex: "1 1 260px" }}>
                      <label htmlFor="q">Buscar jogador ou clã</label>
                      <input id="q" name="q" type="search" defaultValue={search} placeholder="Ex.: Arke" />
                    </div>
                    <button className="btn" type="submit">
                      Buscar
                    </button>
                    {search ? (
                      <Link className="btn ghost" href={returnTo}>
                        Limpar
                      </Link>
                    ) : null}
                  </form>

                  {teams.length > 0 ? (
                    <form action={addSalaryTeamAction} className="filters">
                      <input type="hidden" name="periodId" value={period.id} />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <div className="field" style={{ flex: "1 1 220px" }}>
                        <label htmlFor="teamId">Adicionar time inteiro</label>
                        <select id="teamId" name="teamId" required>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button className="btn" type="submit">
                        Adicionar time
                      </button>
                      <span className="small muted">Entram os jogadores aliados dos clãs do time.</span>
                    </form>
                  ) : null}

                  {candidates.length === 0 ? (
                    <p className="small muted">
                      {alliedClans === 0
                        ? "Nenhum clã aliado marcado neste servidor, então não há ninguém para adicionar."
                        : search
                          ? "Nenhum jogador aliado fora do elenco com essa busca."
                          : "Todos os jogadores aliados deste servidor já estão no elenco."}
                    </p>
                  ) : (
                    <form action={addSalaryMembersAction} className="stack">
                      <input type="hidden" name="periodId" value={period.id} />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <div className="table-wrap">
                        <table className="data">
                          <thead>
                            <tr>
                              <th />
                              <th>Jogador</th>
                              <th>Clã / time</th>
                              <th className="num">Poder</th>
                            </tr>
                          </thead>
                          <tbody>
                            {candidates.map((candidate) => (
                              <tr key={candidate.id}>
                                <td>
                                  <label className="check">
                                    <input
                                      type="checkbox"
                                      name="characterIds"
                                      value={candidate.id}
                                      aria-label={`Selecionar ${candidate.name}`}
                                    />
                                  </label>
                                </td>
                                <td>{candidate.name}</td>
                                <td className="small">
                                  {candidate.clan ?? <span className="muted">sem clã</span>}
                                  {candidate.team_name ? (
                                    <span
                                      className="badge"
                                      style={{
                                        marginLeft: 6,
                                        ...(candidate.team_color ? { color: candidate.team_color } : {}),
                                      }}
                                    >
                                      {candidate.team_name}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="num mono">{formatPower(candidate.power_score)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="row">
                        <button className="btn primary" type="submit">
                          Adicionar selecionados
                        </button>
                        <span className="small muted">
                          A faixa inicial vem do poder mínimo de cada coeficiente ({SALARY_TIERS.join(" · ")}); ajuste
                          depois na tabela do elenco.
                        </span>
                      </div>
                    </form>
                  )}
                </div>
              </details>
            </>
          )}
        </>
      ) : null}
    </>
  );
}
