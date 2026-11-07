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
  SALARY_MEMBER_CAP,
  SALARY_PREFERENCES,
  SALARY_STONE_SPLITS,
  SALARY_TIERS,
  SALARY_VALES,
  salaryAlliedClans,
  salaryCandidates,
  salaryEntries,
  salarySummary,
  salaryTiers,
  salaryValeEntries,
  STONE_PRICES,
  stonePurchase,
  stoneSplitValues,
} from "@/lib/salaries";
import type { SalarySummary, StonePurchase } from "@/lib/salaries";
import { APP_TIMEZONE } from "@/lib/time";
import {
  addAlliedSalaryMembersAction,
  addSalaryEntryAction,
  addSalaryMembersAction,
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

type SearchParams = {
  server?: string;
  period?: string;
  q?: string;
  sort?: string;
  dir?: string;
  presence?: string;
  ok?: string;
  error?: string;
};

type SortDir = "asc" | "desc";
type RosterSort = "name" | "power" | "salary" | "presence";
type PresenceFilter = "all" | "with" | "without";

function isRosterSort(value: string | undefined): value is RosterSort {
  return value === "name" || value === "power" || value === "salary" || value === "presence";
}

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
  const candidates = selected ? salaryCandidates(selected.id, search) : [];
  const alliedClans = selected ? salaryAlliedClans(selected.id) : 0;

  const presence: PresenceFilter =
    params.presence === "with" || params.presence === "without" ? params.presence : "all";
  const sortKey: RosterSort = isRosterSort(params.sort) ? params.sort : "name";
  const sortDir: SortDir = params.dir === "desc" ? "desc" : "asc";

  const members = summary ? summary.members : [];
  const visibleMembers = members
    .filter((member) =>
      presence === "all" ? true : presence === "with" ? member.attendedCount > 0 : member.attendedCount === 0,
    )
    .sort((a, b) => {
      const factor = sortDir === "asc" ? 1 : -1;
      const byName = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      if (sortKey === "power") return (a.power_score - b.power_score) * factor || byName;
      if (sortKey === "salary") return (a.salary - b.salary) * factor || byName;
      if (sortKey === "presence") return (a.attendedCount - b.attendedCount) * factor || byName;
      return byName * factor;
    });

  const withPresence = members.filter((member) => member.attendedCount > 0).length;
  const visiblePaid = visibleMembers.reduce((sum, member) => sum + member.salary, 0);
  const filtered = presence !== "all";

  // Pedras da semana: soma as compras de cada membro, na mesma conversão da tabela.
  const stoneMembers = members.filter((member) => member.preference === "stone" && member.salary > 0);
  const yellow = stoneMembers.reduce(
    (total, member) => addStonePurchase(total, memberStonePurchase(member).yellow),
    stonePurchase(0, "yellow"),
  );
  const purple = stoneMembers.reduce(
    (total, member) => addStonePurchase(total, memberStonePurchase(member).purple),
    stonePurchase(0, "purple"),
  );
  const stones = {
    members: stoneMembers.length,
    half: stoneMembers.filter((member) => member.stone_split === "half").length,
  };
  const stoneLeftover = yellow.leftover + purple.leftover;

  const rosterHref = (overrides: { sort?: RosterSort; dir?: SortDir; presence?: PresenceFilter }) => {
    const next = { sort: sortKey, dir: sortDir, presence, ...overrides };
    const query = new URLSearchParams();
    if (selected) query.set("server", selected.code);
    if (period) query.set("period", String(period.id));
    if (search) query.set("q", search);
    if (next.sort !== "name" || next.dir !== "asc") {
      query.set("sort", next.sort);
      query.set("dir", next.dir);
    }
    if (next.presence !== "all") query.set("presence", next.presence);
    return `/salaries?${query.toString()}`;
  };

  const sortLink = (key: RosterSort) => ({
    href: rosterHref({ sort: key, dir: sortKey === key && sortDir === "asc" ? "desc" : "asc" }),
    className: `th-sort${sortKey === key ? " active" : ""}`,
    mark: sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "",
  });

  const mobileSort = (key: RosterSort, label: string) => {
    const link = sortLink(key);
    return (
      <Link key={key} className={`btn sm${sortKey === key ? " primary" : " ghost"}`} href={link.href}>
        {label}
        {link.mark}
      </Link>
    );
  };

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
              <div className="row">
                {period ? <span className="badge gold">{periodTitle(period)}</span> : null}
                <span className="badge">{periods.length} semana(s)</span>
              </div>
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
                  <span className="small muted">
                    A semana já nasce com todo o elenco dos clãs aliados; a produção e os custos são lançados nela e
                    você só marca as presenças.
                  </span>
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
                      <div className="card-sub">Redmoon, Snake e Bicheon são fixos; lance só o valor da produção</div>
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
                              name="amount"
                              type="text"
                              inputMode="numeric"
                              defaultValue={entry ? String(entry.amount) : ""}
                              placeholder="Valor"
                              aria-label={`Valor do ${vale.label}`}
                              style={{ flex: "1 1 160px" }}
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
                  <p className="table-hint">Deslize a tabela para o lado para ver todas as colunas →</p>
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
                      Prêmio por ponto = (vales − custos) ÷ soma dos coeficientes ponderados pelas presenças. Cada membro
                      recebe no máximo {formatNumber(SALARY_MEMBER_CAP)} DS; o excedente vai para os demais,
                      proporcionalmente aos pontos. A penalidade de um membro sai do salário dele e também é
                      redistribuída entre quem não tem penalidade.
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
                {members.length > 0 ? (
                  <div className="roster-toolbar">
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      <span className="small muted">Presença</span>
                      <Link
                        className={`btn sm${presence === "all" ? " primary" : " ghost"}`}
                        href={rosterHref({ presence: "all" })}
                      >
                        Todos · {members.length}
                      </Link>
                      <Link
                        className={`btn sm${presence === "with" ? " primary" : " ghost"}`}
                        href={rosterHref({ presence: "with" })}
                      >
                        Com presença · {withPresence}
                      </Link>
                      <Link
                        className={`btn sm${presence === "without" ? " primary" : " ghost"}`}
                        href={rosterHref({ presence: "without" })}
                      >
                        Sem presença · {members.length - withPresence}
                      </Link>
                    </div>
                    <span className="small muted">
                      Mostrando {visibleMembers.length} de {members.length}
                      {sortKey !== "name" || sortDir !== "asc" ? " · ordenado" : ""}
                    </span>
                  </div>
                ) : null}
                {members.length > 0 ? (
                  <div className="roster-sort-mobile">
                    <span className="small muted">Ordenar</span>
                    {mobileSort("name", "Nome")}
                    {mobileSort("power", "Poder")}
                    {mobileSort("presence", "Presença")}
                    {mobileSort("salary", "Salário")}
                  </div>
                ) : null}
                {stones.members > 0 ? (
                  <div className="stone-totals">
                    <span className="small muted">Pedras da semana</span>
                    <span className="stone-color">
                      <span
                        className="badge gold"
                        title={`${formatNumber(STONE_PRICES.yellow.ds)} DS + ${formatNumber(STONE_PRICES.yellow.clanPoints)} pontos de clã por pedra amarela`}
                      >
                        Amarela · {formatNumber(yellow.stones)} pedra(s)
                      </span>
                      <span className="small muted mono">
                        {formatNumber(yellow.ds)} DS · {formatNumber(yellow.clanPoints)} pts
                      </span>
                    </span>
                    <span className="stone-color">
                      <span
                        className="badge purple"
                        title={`${formatNumber(STONE_PRICES.purple.ds)} DS + ${formatNumber(STONE_PRICES.purple.clanPoints)} pontos de clã por pedra roxa`}
                      >
                        Roxa · {formatNumber(purple.stones)} pedra(s)
                      </span>
                      <span className="small muted mono">
                        {formatNumber(purple.ds)} DS · {formatNumber(purple.clanPoints)} pts
                      </span>
                    </span>
                    <span className="small muted">
                      {stones.members} membro(s) em pedra
                      {stones.half > 0 ? ` · ${stones.half} em 50/50` : ""} · total{" "}
                      {formatNumber(yellow.ds + purple.ds)} DS e{" "}
                      {formatNumber(yellow.clanPoints + purple.clanPoints)} pontos de clã
                      {stoneLeftover > 0 ? ` · sobra ${formatNumber(stoneLeftover)} DS (não fecha 1 pedra)` : ""}
                    </span>
                  </div>
                ) : null}
                <div className="table-wrap">
                  {summary.members.length === 0 ? (
                    <EmptyState title="Nenhum jogador no elenco desta semana">
                      Adicione membros aliados no painel abaixo, selecionando do ranking ou um time inteiro.
                    </EmptyState>
                  ) : (
                    <table className="data table-cards">
                      <thead>
                        <tr>
                          <th>
                            <Link className={sortLink("name").className} href={sortLink("name").href}>
                              Jogador{sortLink("name").mark}
                            </Link>
                          </th>
                          <th>Clã</th>
                          <th className="num">
                            <Link className={sortLink("power").className} href={sortLink("power").href}>
                              Poder{sortLink("power").mark}
                            </Link>
                          </th>
                          <th>
                            <Link
                              className={sortLink("presence").className}
                              href={sortLink("presence").href}
                              title="Ordenar por presenças"
                            >
                              Ajustes da semana{sortLink("presence").mark}
                            </Link>
                          </th>
                          <th className="num">
                            <Link className={sortLink("salary").className} href={sortLink("salary").href}>
                              Salário{sortLink("salary").mark}
                            </Link>
                          </th>
                          <th className="num" title="Pedras amarelas (A) e roxas (R) que o membro recebe">
                            Pedras A/R
                          </th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMembers.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="small muted" style={{ textAlign: "center", padding: "18px 14px" }}>
                              Nenhum membro {presence === "with" ? "com" : "sem"} presença nesta semana.
                            </td>
                          </tr>
                        ) : null}
                        {visibleMembers.map((member) => (
                          <tr key={member.character_id}>
                            <td className="cell-title">
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
                                  <span className="muted">sem time</span>
                                )}
                              </div>
                            </td>
                            <td className="small" data-label="Clã">
                              {member.clan ?? <span className="muted">sem clã</span>}
                            </td>
                            <td className="num mono" data-label="Poder">
                              {formatPower(member.power_score)}
                            </td>
                            <td className="cell-wide" data-label="Ajustes da semana">
                              <form action={updateSalaryMemberAction} className="salary-controls">
                                <input type="hidden" name="periodId" value={period.id} />
                                <input type="hidden" name="characterId" value={member.character_id} />
                                <input type="hidden" name="redirectTo" value={returnTo} />
                                <label className="mini-field">
                                  <span>Faixa</span>
                                  <select name="tier" defaultValue={member.tier}>
                                    {tiers.map((tier) => (
                                      <option key={tier.tier} value={tier.tier}>
                                        {tier.tier} · ×{formatNumber(tier.weight)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="mini-field narrow">
                                  <span>Penalidade %</span>
                                  <input
                                    name="penaltyPercent"
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={5}
                                    defaultValue={100 - member.share_percent}
                                  />
                                </label>
                                <div className="mini-field">
                                  <span>Presenças</span>
                                  <div className="check-chips">
                                    {SALARY_ACTIVITIES.map((activity) => (
                                      <label key={activity.field} title={`${activity.label} — vale 1/3 da faixa`}>
                                        <input
                                          type="checkbox"
                                          name={`attended${activity.field[0].toUpperCase()}${activity.field.slice(1)}`}
                                          value="1"
                                          defaultChecked={member[`attended_${activity.field}` as "attended_heist" | "attended_altar" | "attended_vale"] === 1}
                                        />
                                        {activity.label}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <label className="mini-field">
                                  <span>Recompensa</span>
                                  <select name="preference" defaultValue={member.preference}>
                                    {SALARY_PREFERENCES.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                {member.preference === "stone" ? (
                                  <label className="mini-field">
                                    <span>Pedra</span>
                                    <select name="stoneSplit" defaultValue={member.stone_split}>
                                      {SALARY_STONE_SPLITS.map((split) => (
                                        <option key={split.value} value={split.value}>
                                          {split.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                ) : (
                                  <input type="hidden" name="stoneSplit" value={member.stone_split} />
                                )}
                                <button className="btn sm" type="submit">
                                  Salvar
                                </button>
                              </form>
                            </td>
                            <td className="num mono" data-label="Salário">
                              {member.attendedCount > 0 ? (
                                <>
                                  {formatNumber(member.salary)}
                                  <div className="small muted">
                                    {member.attendedCount}/3
                                    {member.share_percent !== 100
                                      ? ` · −${100 - member.share_percent}% de penalidade`
                                      : ""}
                                  </div>
                                </>
                              ) : (
                                <span className="small muted">sem presença</span>
                              )}
                            </td>
                            <td className="num" data-label="Pedras A/R">
                              <MemberStones member={member} />
                            </td>
                            <td className="cell-action">
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
                            {filtered ? "Total pago (filtro)" : "Total pago"}
                          </td>
                          <td className="num mono" style={{ fontWeight: 650 }}>
                            {formatNumber(visiblePaid)}
                          </td>
                          <td />
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

                  <form action={addAlliedSalaryMembersAction} className="row">
                    <input type="hidden" name="periodId" value={period.id} />
                    <input type="hidden" name="redirectTo" value={returnTo} />
                    <button className="btn primary" type="submit">
                      Adicionar todos os aliados
                    </button>
                    <span className="small muted">
                      Coloca no elenco, de uma vez, todos os jogadores dos clãs aliados que ainda não estão na semana.
                    </span>
                  </form>

                  <form className="filters" action="/salaries" method="get">
                    <input type="hidden" name="server" value={selected.code} />
                    <input type="hidden" name="period" value={period.id} />
                    {sortKey !== "name" || sortDir !== "asc" ? (
                      <>
                        <input type="hidden" name="sort" value={sortKey} />
                        <input type="hidden" name="dir" value={sortDir} />
                      </>
                    ) : null}
                    {presence !== "all" ? <input type="hidden" name="presence" value={presence} /> : null}
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

                  {candidates.length === 0 ? (
                    <p className="small muted">
                      {alliedClans === 0
                        ? "Nenhum clã aliado marcado neste servidor, então não há ninguém para adicionar."
                        : search
                          ? "Nenhum jogador aliado com essa busca."
                          : "Todos os jogadores aliados deste servidor já estão no elenco."}
                    </p>
                  ) : (
                    <form action={addSalaryMembersAction} className="stack">
                      <input type="hidden" name="periodId" value={period.id} />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <div className="field" style={{ flex: "0 1 auto" }}>
                        <span>Presenças iniciais</span>
                        <div className="check-chips">
                          {SALARY_ACTIVITIES.map((activity) => (
                            <label key={activity.field} title={`${activity.label} — vale 1/3 da faixa`}>
                              <input
                                type="checkbox"
                                name={`attended${activity.field[0].toUpperCase()}${activity.field.slice(1)}`}
                                value="1"
                              />
                              {activity.label}
                            </label>
                          ))}
                        </div>
                      </div>
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

type RosterMember = SalarySummary["members"][number];

function memberStonePurchase(member: RosterMember) {
  const split = stoneSplitValues(member.salary, member.stone_split);
  return {
    split,
    yellow: stonePurchase(split.yellow, "yellow"),
    purple: stonePurchase(split.purple, "purple"),
  };
}

function addStonePurchase(total: StonePurchase, entry: StonePurchase): StonePurchase {
  return {
    stones: total.stones + entry.stones,
    ds: total.ds + entry.ds,
    clanPoints: total.clanPoints + entry.clanPoints,
    leftover: total.leftover + entry.leftover,
  };
}

/** Quantas pedras de cada cor o membro leva, já convertidas pelo preço da loja. */
function MemberStones({ member }: { member: RosterMember }) {
  if (member.preference !== "stone") return <span className="small muted">darksteel</span>;
  if (member.salary <= 0) return <span className="small muted">—</span>;

  const { split, yellow, purple } = memberStonePurchase(member);

  return (
    <div className="stone-cell">
      <span className="badge gold" title={`${formatNumber(split.yellow)} em pedra amarela`}>
        A · {formatNumber(yellow.stones)}
      </span>
      <span className="badge purple" title={`${formatNumber(split.purple)} em pedra roxa`}>
        R · {formatNumber(purple.stones)}
      </span>
    </div>
  );
}
