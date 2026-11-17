"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveCastlePrizesAction } from "@/app/castle/actions";
import { KeepScroll } from "@/components/KeepScroll";
import {
  CASTLE_PRIZES,
  CASTLE_PRIZE_TOTAL,
  castlePrizeCounts,
  sortCastlePrizes,
  type CastlePrizeKey,
  type CastlePrizeMember,
} from "@/lib/castle-prizes";
import { formatNumber } from "@/lib/format";

type Awards = Record<number, CastlePrizeKey[]>;

type Props = {
  serverId: number;
  weekStart: string;
  redirectTo: string;
  members: CastlePrizeMember[];
  initial: Awards;
};

/** Mesmos prêmios nas mesmas pessoas — a ordem não importa. */
function sameAwards(a: Awards, b: Awards): boolean {
  const ids = Object.keys(a);
  if (ids.length !== Object.keys(b).length) return false;
  return ids.every((id) => {
    const current = a[Number(id)] ?? [];
    const saved = b[Number(id)] ?? [];
    return current.length === saved.length && current.every((prize) => saved.includes(prize));
  });
}

export function CastlePrizeBoard({ serverId, weekStart, redirectTo, members, initial }: Props) {
  const [awards, setAwards] = useState<Awards>(initial);
  const [query, setQuery] = useState("");
  const [clan, setClan] = useState("all");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const lists = useMemo(() => Object.values(awards), [awards]);
  const counts = useMemo(() => castlePrizeCounts(lists.flat()), [lists]);
  const assigned = lists.filter((list) => list.length > 0).length;
  const used = CASTLE_PRIZES.reduce((total, prize) => total + counts[prize.key], 0);
  const dirty = useMemo(() => !sameAwards(initial, awards), [initial, awards]);

  // Salva sozinho pouco depois da última mudança de prêmio.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => formRef.current?.requestSubmit(), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, awards]);

  const clanStats = useMemo(() => {
    const stats = new Map<number, { id: number; name: string; total: number; assigned: number }>();
    for (const member of members) {
      const entry =
        stats.get(member.clan_id) ??
        { id: member.clan_id, name: member.clan_name, total: 0, assigned: 0 };
      entry.total += 1;
      if ((awards[member.character_id] ?? []).length > 0) entry.assigned += 1;
      stats.set(member.clan_id, entry);
    }
    return Array.from(stats.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
  }, [members, awards]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return members.filter((member) => {
      if (clan !== "all" && String(member.clan_id) !== clan) return false;
      if (onlyUnassigned && (awards[member.character_id] ?? []).length > 0) return false;
      if (term && !member.name.toLocaleLowerCase("pt-BR").includes(term)) return false;
      return true;
    });
  }, [members, clan, onlyUnassigned, query, awards]);

  // Resumo por jogador: quem recebeu o quê, na ordem de quem levou mais baús.
  const summary = useMemo(() => {
    const rows = members
      .map((member) => {
        const picks = awards[member.character_id] ?? [];
        return { member, counts: castlePrizeCounts(picks), total: picks.length };
      })
      .filter((row) => row.total > 0)
      .sort(
        (a, b) =>
          b.total - a.total ||
          b.counts.legendary - a.counts.legendary ||
          b.counts.epic - a.counts.epic ||
          a.member.name.localeCompare(b.member.name, "pt-BR", { sensitivity: "base" }),
      );

    const totals = castlePrizeCounts([]);
    for (const row of rows) {
      for (const prize of CASTLE_PRIZES) totals[prize.key] += row.counts[prize.key];
    }

    return { rows, totals, totalChests: rows.reduce((total, row) => total + row.total, 0) };
  }, [members, awards]);

  function exportCsv() {
    const quote = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const lines = [
      ["Jogador", "Clã", ...CASTLE_PRIZES.map((prize) => prize.label), "Total"],
      ...summary.rows.map((row) => [
        row.member.name,
        row.member.clan_name,
        ...CASTLE_PRIZES.map((prize) => String(row.counts[prize.key])),
        String(row.total),
      ]),
      [
        "TOTAL",
        "",
        ...CASTLE_PRIZES.map((prize) => String(summary.totals[prize.key])),
        String(summary.totalChests),
      ],
    ];

    const csv = lines.map((line) => line.map((cell) => quote(cell)).join(";")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `premio-castelo-${weekStart}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function togglePrize(characterId: number, prize: CastlePrizeKey) {
    setAwards((previous) => {
      const current = previous[characterId] ?? [];
      const next = current.includes(prize)
        ? current.filter((entry) => entry !== prize)
        : [...current, prize];
      const copy = { ...previous };
      if (next.length > 0) copy[characterId] = sortCastlePrizes(next);
      else delete copy[characterId];
      return copy;
    });
  }

  return (
    <form ref={formRef} action={saveCastlePrizesAction}>
      <KeepScroll />
      <input type="hidden" name="serverId" value={serverId} />
      <input type="hidden" name="week" value={weekStart} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="awards" value={JSON.stringify(awards)} />

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Membros dos clãs aliados</div>
            <div className="card-sub">
              Cada membro pode receber vários baús, mas só um de cada raridade. O contador mostra o que
              já foi usado e o que ainda sobra.
            </div>
          </div>
          <div className="row">
            {dirty ? <span className="badge warn">alterações não salvas</span> : null}
            <span className="badge gold">
              {formatNumber(used)}/{formatNumber(CASTLE_PRIZE_TOTAL)} baú(s) distribuídos
            </span>
          </div>
        </div>

        <div className="card-body">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            {CASTLE_PRIZES.map((prize) => {
              const prizeUsed = counts[prize.key];
              const left = prize.total - prizeUsed;
              const percent = Math.round((prizeUsed / prize.total) * 100);
              return (
                <div key={prize.key} className="stat" style={{ padding: "13px 15px" }}>
                  <div className="spread">
                    <span className={`prize-key ${prize.key}`}>{prize.label}</span>
                    <span className="small muted">
                      {prizeUsed}/{prize.total}
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 650, marginTop: 6 }}>
                    {formatNumber(left)}
                  </div>
                  <div className="small muted">{left === 1 ? "restante" : "restantes"}</div>
                  <div className={`prize-meter ${prize.key}`} aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="card-body"
          style={{
            borderTop: "1px solid var(--border-soft)",
            paddingTop: 14,
            paddingBottom: 14,
          }}
        >
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className={`btn sm${clan === "all" ? " primary" : " ghost"}`}
              onClick={() => setClan("all")}
            >
              Todos · {formatNumber(members.length)}
            </button>
            {clanStats.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`btn sm${clan === String(entry.id) ? " primary" : " ghost"}`}
                onClick={() => setClan(String(entry.id))}
              >
                {entry.name} · {formatNumber(entry.assigned)}/{formatNumber(entry.total)}
              </button>
            ))}
          </div>

          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar jogador..."
              aria-label="Buscar jogador"
              style={{ maxWidth: 240 }}
            />
            <label className="small" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={onlyUnassigned}
                onChange={(event) => setOnlyUnassigned(event.target.checked)}
              />
              Só sem prêmio
            </label>
            <span className="small muted">
              {formatNumber(visible.length)} de {formatNumber(members.length)} membro(s)
            </span>
            <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setAwards(initial)}
                disabled={!dirty}
              >
                Desfazer
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setAwards({})}
                disabled={assigned === 0}
              >
                Limpar
              </button>
            </span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Clã</th>
                <th className="num">Poder</th>
                <th>Prêmios</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <span className="small muted">Nenhum membro encontrado com esses filtros.</span>
                  </td>
                </tr>
              ) : (
                visible.map((member) => {
                  const current = awards[member.character_id] ?? [];
                  return (
                    <tr key={member.character_id}>
                      <td className="cell-title" data-label="Jogador">
                        <Link className="player-name" href={`/players/${member.character_id}`}>
                          {member.name}
                        </Link>
                      </td>
                      <td data-label="Clã">
                        <span className="badge">{member.clan_name}</span>
                      </td>
                      <td className="num mono" data-label="Poder">
                        {formatNumber(member.power_score)}
                      </td>
                      <td data-label="Prêmios">
                        <div className="prize-picks">
                          {CASTLE_PRIZES.map((prize) => {
                            const on = current.includes(prize.key);
                            const left = prize.total - counts[prize.key];
                            return (
                              <button
                                key={prize.key}
                                type="button"
                                className={`prize-pick ${prize.key}${on ? " on" : ""}`}
                                onClick={() => togglePrize(member.character_id, prize.key)}
                                disabled={!on && left <= 0}
                                aria-pressed={on}
                                title={`${prize.label} · ${left} restante(s) no baú`}
                              >
                                {prize.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="panel-body spread">
          <span className="small muted">
            {formatNumber(used)} de {formatNumber(CASTLE_PRIZE_TOTAL)} baú(s) usados ·{" "}
            {formatNumber(assigned)} membro(s) com prêmio · {formatNumber(members.length)} elegível(is)
          </span>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Resumo por jogador e raridade</div>
            <div className="card-sub">
              Quem recebeu o quê nesta semana, ordenado por quantidade de baús. O CSV abre no Excel com
              uma coluna por raridade.
            </div>
          </div>
          <div className="row">
            <span className="badge">{formatNumber(summary.rows.length)} jogador(es) com baú</span>
            <button
              type="button"
              className="btn sm ghost"
              onClick={exportCsv}
              disabled={summary.rows.length === 0}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Clã</th>
                {CASTLE_PRIZES.map((prize) => (
                  <th key={prize.key} className="num">
                    {prize.label}
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.length === 0 ? (
                <tr>
                  <td colSpan={CASTLE_PRIZES.length + 3}>
                    <span className="small muted">Nenhum baú distribuído nesta semana ainda.</span>
                  </td>
                </tr>
              ) : (
                summary.rows.map((row) => (
                  <tr key={row.member.character_id}>
                    <td className="cell-title" data-label="Jogador">
                      <Link className="player-name" href={`/players/${row.member.character_id}`}>
                        {row.member.name}
                      </Link>
                    </td>
                    <td data-label="Clã">
                      <span className="badge">{row.member.clan_name}</span>
                    </td>
                    {CASTLE_PRIZES.map((prize) => (
                      <td key={prize.key} className="num mono" data-label={prize.label}>
                        {row.counts[prize.key] > 0 ? (
                          <span className={`prize-count ${prize.key}`}>{row.counts[prize.key]}</span>
                        ) : (
                          <span className="muted">–</span>
                        )}
                      </td>
                    ))}
                    <td className="num mono" data-label="Total">
                      {formatNumber(row.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {summary.rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  {CASTLE_PRIZES.map((prize) => (
                    <td key={prize.key} className="num mono">
                      {formatNumber(summary.totals[prize.key])}
                    </td>
                  ))}
                  <td className="num mono">{formatNumber(summary.totalChests)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </form>
  );
}
