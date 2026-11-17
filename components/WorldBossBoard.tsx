"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveWorldBossAttendanceAction } from "@/app/world-boss/actions";
import { useT } from "@/components/I18nProvider";
import { KeepScroll } from "@/components/KeepScroll";
import { shortDay } from "@/lib/ce-dates";
import { formatNumber, formatPower } from "@/lib/format";
import { INTL_LOCALE } from "@/lib/i18n/locales";

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
  const { locale, t } = useT();
  const [selection, setSelection] = useState<Selection>(() => selectionFrom(initial, fights));
  const [query, setQuery] = useState("");
  const [clan, setClan] = useState("all");
  const [onlyAttended, setOnlyAttended] = useState(false);

  const initialSignature = useMemo(() => signature(selectionFrom(initial, fights), fights), [initial, fights]);
  const currentSignature = useMemo(() => signature(selection, fights), [selection, fights]);
  const dirty = initialSignature !== currentSignature;

  const formRef = useRef<HTMLFormElement>(null);
  const collator = useMemo(() => new Intl.Collator(INTL_LOCALE[locale], { sensitivity: "base" }), [locale]);

  // Salva sozinho pouco depois da última presença marcada.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => formRef.current?.requestSubmit(), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, selection]);

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
    return Array.from(stats.values()).sort((a, b) => collator.compare(a.name, b.name));
  }, [members, fights, selection, collator]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase(INTL_LOCALE[locale]);
    return members.filter((member) => {
      if (clan !== "all" && String(member.clan_id) !== clan) return false;
      if (term && !member.name.toLocaleLowerCase(INTL_LOCALE[locale]).includes(term)) return false;
      if (onlyAttended && !fights.some((fight) => selection[fight.id]?.[member.character_id])) return false;
      return true;
    });
  }, [members, clan, query, onlyAttended, fights, selection, locale]);

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
    <form ref={formRef} action={saveWorldBossAttendanceAction}>
      <KeepScroll />
      <input type="hidden" name="serverId" value={serverId} />
      <input type="hidden" name="week" value={weekStart} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="attendance" value={JSON.stringify(payload)} />

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">{t("bossBoard.title")}</div>
            <div className="card-sub">{t("bossBoard.sub")}</div>
          </div>
          <div className="row">
            {dirty ? <span className="badge warn">{t("castleBoard.unsaved")}</span> : null}
            <span className="badge gold">
              {t("bossBoard.marks", {
                marks: formatNumber(marks, locale),
                capacity: formatNumber(capacity, locale),
              })}
            </span>
          </div>
        </div>

        <div className="card-body" style={{ paddingTop: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`btn sm${clan === "all" ? " primary" : " ghost"}`}
              onClick={() => setClan("all")}
            >
              {t("castleBoard.all", { count: formatNumber(members.length, locale) })}
            </button>
            {clanStats.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`btn sm${clan === String(entry.id) ? " primary" : " ghost"}`}
                onClick={() => setClan(String(entry.id))}
              >
                {entry.name} · {formatNumber(entry.attended, locale)}/{formatNumber(entry.total, locale)}
              </button>
            ))}
          </div>

          <div className="row" style={{ gap: 10, marginTop: 10 }}>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("castleBoard.searchPlaceholder")}
              aria-label={t("castleBoard.searchAria")}
              style={{ maxWidth: 240 }}
            />
            <label className="small" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={onlyAttended}
                onChange={(event) => setOnlyAttended(event.target.checked)}
              />
              {t("bossBoard.onlyAttended")}
            </label>
            <span className="small muted">
              {t("castleBoard.visible", {
                visible: formatNumber(visible.length, locale),
                total: formatNumber(members.length, locale),
              })}
            </span>
            <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setSelection(selectionFrom(initial, fights))}
                disabled={!dirty}
              >
                {t("castleBoard.undo")}
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setSelection(selectionFrom({}, fights))}
                disabled={marks === 0}
              >
                {t("castleBoard.clear")}
              </button>
            </span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("common.player")}</th>
                <th>{t("common.clan")}</th>
                <th className="num">{t("players.colPower")}</th>
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
                        {shortDay(fight.fought_on, locale)} · {fight.fought_at}
                      </div>
                      <div className="small muted" style={{ fontWeight: 400 }}>
                        {fight.label ? `${fight.label} · ` : ""}
                        {formatNumber(attended, locale)}/{formatNumber(visible.length, locale)}
                      </div>
                      <label
                        className="small muted"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 400 }}
                      >
                        <input
                          type="checkbox"
                          checked={allMarked}
                          onChange={() => toggleColumn(fight.id)}
                          aria-label={t("bossBoard.markAllAria", {
                            date: shortDay(fight.fought_on, locale),
                            time: fight.fought_at,
                          })}
                        />
                        {t("bossBoard.all")}
                      </label>
                    </th>
                  );
                })}
                <th className="num">{t("bossBoard.colMarks")}</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5 + fights.length}>
                    <span className="small muted">{t("castleBoard.noMember")}</span>
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
                      <td className="num">{formatPower(member.power_score, locale)}</td>
                      {fights.map((fight) => (
                        <td key={fight.id} style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(selection[fight.id]?.[member.character_id])}
                            onChange={() => toggle(fight.id, member.character_id)}
                            aria-label={t("bossBoard.memberAria", {
                              name: member.name,
                              date: shortDay(fight.fought_on, locale),
                              time: fight.fought_at,
                            })}
                          />
                        </td>
                      ))}
                      <td className="num">{formatNumber(attended, locale)}</td>
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
