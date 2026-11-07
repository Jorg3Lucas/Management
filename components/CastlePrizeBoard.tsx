"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { saveCastlePrizesAction } from "@/app/castle/actions";
import {
  CASTLE_PRIZES,
  CASTLE_PRIZE_TOTAL,
  castlePrizeCounts,
  isCastlePrizeKey,
  type CastlePrizeKey,
  type CastlePrizeMember,
} from "@/lib/castle-prizes";
import { formatNumber } from "@/lib/format";

type Props = {
  serverId: number;
  weekStart: string;
  redirectTo: string;
  members: CastlePrizeMember[];
  initial: Record<number, CastlePrizeKey>;
};

export function CastlePrizeBoard({ serverId, weekStart, redirectTo, members, initial }: Props) {
  const [awards, setAwards] = useState<Record<number, CastlePrizeKey>>(initial);
  const [query, setQuery] = useState("");
  const [clan, setClan] = useState("all");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const counts = useMemo(() => castlePrizeCounts(Object.values(awards)), [awards]);
  const assigned = Object.keys(awards).length;
  const dirty = useMemo(() => {
    if (Object.keys(initial).length !== assigned) return true;
    return Object.entries(initial).some(([id, prize]) => awards[Number(id)] !== prize);
  }, [initial, awards, assigned]);

  const clanStats = useMemo(() => {
    const stats = new Map<number, { id: number; name: string; total: number; assigned: number }>();
    for (const member of members) {
      const entry =
        stats.get(member.clan_id) ??
        { id: member.clan_id, name: member.clan_name, total: 0, assigned: 0 };
      entry.total += 1;
      if (awards[member.character_id]) entry.assigned += 1;
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
      if (onlyUnassigned && awards[member.character_id]) return false;
      if (term && !member.name.toLocaleLowerCase("pt-BR").includes(term)) return false;
      return true;
    });
  }, [members, clan, onlyUnassigned, query, awards]);

  function setPrize(characterId: number, value: string) {
    setAwards((previous) => {
      const next = { ...previous };
      if (isCastlePrizeKey(value)) next[characterId] = value;
      else delete next[characterId];
      return next;
    });
  }

  return (
    <form action={saveCastlePrizesAction}>
      <input type="hidden" name="serverId" value={serverId} />
      <input type="hidden" name="week" value={weekStart} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="awards" value={JSON.stringify(awards)} />

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Membros dos clãs aliados</div>
            <div className="card-sub">
              Um prêmio por membro. O contador mostra o que já foi usado e o que ainda sobra.
            </div>
          </div>
          <div className="row">
            {dirty ? <span className="badge warn">alterações não salvas</span> : null}
            <span className="badge gold">
              {formatNumber(assigned)}/{formatNumber(CASTLE_PRIZE_TOTAL)} distribuídos
            </span>
            <button className="btn primary" type="submit">
              Salvar distribuição
            </button>
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
              const used = counts[prize.key];
              const left = prize.total - used;
              const percent = Math.round((used / prize.total) * 100);
              return (
                <div key={prize.key} className="stat" style={{ padding: "13px 15px" }}>
                  <div className="spread">
                    <span className={`prize-key ${prize.key}`}>{prize.label}</span>
                    <span className="small muted">
                      {used}/{prize.total}
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
                <th>Prêmio</th>
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
                  const current = awards[member.character_id];
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
                      <td data-label="Prêmio">
                        <select
                          value={current ?? ""}
                          onChange={(event) => setPrize(member.character_id, event.target.value)}
                          aria-label={`Prêmio de ${member.name}`}
                          style={{ minWidth: 190 }}
                        >
                          <option value="">Sem prêmio</option>
                          {CASTLE_PRIZES.map((prize) => {
                            const available =
                              prize.total - counts[prize.key] + (current === prize.key ? 1 : 0);
                            return (
                              <option key={prize.key} value={prize.key} disabled={available <= 0}>
                                {prize.label} · {available} restante(s)
                                {current === prize.key ? " · atual" : ""}
                              </option>
                            );
                          })}
                        </select>
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
            {formatNumber(assigned)} de {formatNumber(CASTLE_PRIZE_TOTAL)} prêmio(s) do baú usados ·{" "}
            {formatNumber(members.length)} membro(s) elegível(is)
          </span>
          <button className="btn primary" type="submit">
            Salvar distribuição
          </button>
        </div>
      </section>
    </form>
  );
}
