"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { saveWorldBossAttendanceAction } from "@/app/world-boss/actions";
import { formatNumber, formatPower } from "@/lib/format";

type Fight = {
  id: number;
  fought_on: string;
  fought_at: string;
  label: string | null;
};

type Member = {
  character_id: number;
  name: string;
  power_score: number;
  clan_id: number;
  clan_name: string;
};

type Selection = Record<number, Record<number, true>>;

type Props = {
  serverId: number;
  weekStart: string;
  redirectTo: string;
  members: Member[];
  fights: Fight[];
  initial: Record<number, number[]>;
};

/** "2026-11-03" → "03/11" — datas de encontro são só dia, sem fuso. */
function shortDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}` : value;
}

function selectionFrom(initial: Record<number, number[]>, fights: Fight[]): Selection {
  const selection: Selection = {};
  for (const fight of fights) {
    selection[fight.id] = {};
    for (const characterId of initial[fight.id] ?? []) {
      selection[fight.id][characterId] = true;
    }
  }
  return selection;
}

function signature(selection: Selection, fights: Fight[]): string {
  return fights
    .map((fight) => {
      const ids = Object.keys(selection[fight.id] ?? {})
        .map(Number)
        .sort((a, b) => a - b)
        .join(",");
      return `${fight.id}:${ids}`;
    })
    .join("|");
}

export function WorldBossBoard({ serverId, weekStart, redirectTo, members, fights, initial }: Props) {
  const [selection, setSelection] = useState<Selection>(() => selectionFrom(initial, fights));
  const [query, setQuery] = useState("");
  const [clan, setClan] = useState("all");
  const [onlyAttended, setOnlyAttended] = useState(false);

  const initialSignature = useMemo(() => signature(selectionFrom(initial, fights), fights), [initial, fights]);
  const currentSignature = useMemo(() => signature(selection, fights), [selection, fights]);
  const dirty = initialSignature !== currentSignature;

  const marks = useMemo(
    () =>
      fights.reduce((total, fight) => total + Object.keys(selection[fight.id] ?? {}).length, 0),
    [selection, fights],
  );
  const capacity = fights.length * members.length;

  const payload = useMemo(() => {
    const result: Record<number, number[]> = {};
    for (const fight of fights) {
      result[fight.id] = Object.keys(selection[fight.id] ?? {}).map(Number);
    }
    return result;
  }, [selection, fights]);

  const clanStats = useMemo(() => {
    const stats = new Map<number, { id: number; name: string; total: number; attended: number }>();
    for (const member of members) {
      const entry =
        stats.get(member.clan_id) ?? { id: member.clan_id, name: member.clan_name, total: 0, attended: 0 };
      entry.total += 1;
      if (fights.some((fight) => selection[fight.id]?.[member.character_id])) entry.attended += 1;
      stats.set(member.clan_id, entry);
    }
    return Array.from(stats.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
    );
  }, [members, fights, selection]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return members.filter((member) => {
      if (clan !== "all" && String(member.clan_id) !== clan) return false;
      if (term && !member.name.toLocaleLowerCase("pt-BR").includes(term)) return false;
      if (onlyAttended && !fights.some((fight) => selection[fight.id]?.[member.character_id])) return false;
      return true;
    });
  }, [members, clan, query, onlyAttended, fights, selection]);

  function toggle(fightId: number, characterId: number) {
    setSelection((previous) => {
      const next = { ...previous, [fightId]: { ...(previous[fightId] ?? {}) } };
      if (next[fightId][characterId]) delete next[fightId][characterId];
      else next[fightId][characterId] = true;
      return next;
    });
  }

  function toggleColumn(fightId: number) {
    const ids = visible.map((member) => member.character_id);
    const allMarked = ids.length > 0 && ids.every((id) => selection[fightId]?.[id]);
    setSelection((previous) => {
      const next = { ...previous, [fightId]: { ...(previous[fightId] ?? {}) } };
      for (const id of ids) {
        if (allMarked) delete next[fightId][id];
        else next[fightId][id] = true;
      }
      return next;
    });
  }

  return (
    <form action={saveWorldBossAttendanceAction}>
      <input type="hidden" name="serverId" value={serverId} />
      <input type="hidden" name="week" value={weekStart} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="attendance" value={JSON.stringify(payload)} />

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Presenças da semana</div>
            <div className="card-sub">
              Marque quem entrou em cada encontro. O percentual do jogador considera todos os encontros da semana.
            </div>
          </div>
          <div className="row">
            {dirty ? <span className="badge warn">alterações não salvas</span> : null}
            <span className="badge gold">
              {formatNumber(marks)} de {formatNumber(capacity)} presenças
            </span>
            <button className="btn primary" type="submit">
              Salvar presenças
            </button>
          </div>
        </div>

        <div className="card-body" style={{ paddingTop: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
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
                {entry.name} · {formatNumber(entry.attended)}/{formatNumber(entry.total)}
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
                checked={onlyAttended}
                onChange={(event) => setOnlyAttended(event.target.checked)}
              />
              Só com presença
            </label>
            <span className="small muted">
              {formatNumber(visible.length)} de {formatNumber(members.length)} membro(s)
            </span>
            <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setSelection(selectionFrom(initial, fights))}
                disabled={!dirty}
              >
                Desfazer
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setSelection(selectionFrom({}, fights))}
                disabled={marks === 0}
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
                {fights.map((fight) => {
                  const allMarked =
                    visible.length > 0 &&
                    visible.every((member) => selection[fight.id]?.[member.character_id]);
                  const attended = visible.reduce(
                    (total, member) => total + (selection[fight.id]?.[member.character_id] ? 1 : 0),
                    0,
                  );
                  return (
                    <th key={fight.id} style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      <div>
                        {shortDay(fight.fought_on)} · {fight.fought_at}
                      </div>
                      <div className="small muted" style={{ fontWeight: 400 }}>
                        {fight.label ? `${fight.label} · ` : ""}
                        {formatNumber(attended)}/{formatNumber(visible.length)}
                      </div>
                      <label
                        className="small muted"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 400 }}
                      >
                        <input
                          type="checkbox"
                          checked={allMarked}
                          onChange={() => toggleColumn(fight.id)}
                          aria-label={`Marcar todos em ${shortDay(fight.fought_on)} às ${fight.fought_at}`}
                        />
                        todos
                      </label>
                    </th>
                  );
                })}
                <th className="num">Presenças</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5 + fights.length}>
                    <span className="small muted">Nenhum membro encontrado com esses filtros.</span>
                  </td>
                </tr>
              ) : (
                visible.map((member) => {
                  const attended = fights.reduce(
                    (total, fight) => total + (selection[fight.id]?.[member.character_id] ? 1 : 0),
                    0,
                  );
                  const percent = fights.length > 0 ? Math.round((attended / fights.length) * 100) : 0;
                  return (
                    <tr key={member.character_id}>
                      <td>
                        <Link className="player-name" href={`/players/${member.character_id}`}>
                          {member.name}
                        </Link>
                      </td>
                      <td className="small muted">{member.clan_name}</td>
                      <td className="num">{formatPower(member.power_score)}</td>
                      {fights.map((fight) => (
                        <td key={fight.id} style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(selection[fight.id]?.[member.character_id])}
                            onChange={() => toggle(fight.id, member.character_id)}
                            aria-label={`${member.name} em ${shortDay(fight.fought_on)} às ${fight.fought_at}`}
                          />
                        </td>
                      ))}
                      <td className="num">{formatNumber(attended)}</td>
                      <td className="num">{percent}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </form>
  );
}
