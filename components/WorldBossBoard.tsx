"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveWorldBossAttendanceAction } from "@/app/world-boss/actions";
import { useT } from "@/components/I18nProvider";
import { KeepScroll } from "@/components/KeepScroll";
import { shortDay, shortWeekday } from "@/lib/ce-dates";
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

type CustomMember = {
  id: number;
  name: string;
};

type Selection = Record<number, Record<number, true>>;

type Props = {
  serverId: number;
  weekStart: string;
  redirectTo: string;
  members: Member[];
  fights: Fight[];
  initial: Record<number, number[]>;
  customMembers: CustomMember[];
  initialCustom: Record<number, number[]>;
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

export function WorldBossBoard({
  serverId,
  weekStart,
  redirectTo,
  members,
  fights,
  initial,
  customMembers,
  initialCustom,
}: Props) {
  const { locale, t } = useT();
  const [selection, setSelection] = useState<Selection>(() => selectionFrom(initial, fights));
  const [customSelection, setCustomSelection] = useState<Selection>(() => selectionFrom(initialCustom, fights));
  const [query, setQuery] = useState("");
  const [clan, setClan] = useState("all");
  const [onlyAttended, setOnlyAttended] = useState(false);

  const initialSignature = useMemo(() => signature(selectionFrom(initial, fights), fights), [initial, fights]);
  const currentSignature = useMemo(() => signature(selection, fights), [selection, fights]);
  const dirty = initialSignature !== currentSignature;

  const initialCustomSignature = useMemo(
    () => signature(selectionFrom(initialCustom, fights), fights),
    [initialCustom, fights],
  );
  const customSignatureValue = useMemo(() => signature(customSelection, fights), [customSelection, fights]);
  const dirtyCustom = initialCustomSignature !== customSignatureValue;

  const formRef = useRef<HTMLFormElement>(null);
  const customFormRef = useRef<HTMLFormElement>(null);
  const collator = useMemo(() => new Intl.Collator(INTL_LOCALE[locale], { sensitivity: "base" }), [locale]);

  // Salva sozinho pouco depois da última presença marcada.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => formRef.current?.requestSubmit(), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, selection]);  useEffect(() => {
    if (!dirtyCustom) return;
    const timer = window.setTimeout(() => customFormRef.current?.requestSubmit(), 900);
    return () => window.clearTimeout(timer);
  }, [dirtyCustom, customSelection]);

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

  const customMarks = useMemo(
    () =>
      fights.reduce((total, fight) => total + Object.keys(customSelection[fight.id] ?? {}).length, 0),
    [customSelection, fights],
  );
  const customPayload = useMemo(() => {
    const result: Record<number, number[]> = {};
    for (const fight of fights) {
      result[fight.id] = Object.keys(customSelection[fight.id] ?? {}).map(Number);
    }
    return result;
  }, [customSelection, fights]);

  // Encontros agrupados por dia: a tabela mostra o dia por cima e os horários abaixo.
  const dayGroups = useMemo(() => {
    const groups: { day: string; fights: Fight[] }[] = [];
    for (const fight of fights) {
      const last = groups[groups.length - 1];
      if (last && last.day === fight.fought_on) last.fights.push(fight);
      else groups.push({ day: fight.fought_on, fights: [fight] });
    }
    return groups;
  }, [fights]);

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

  function toggleCustom(fightId: number, customId: number) {
    setCustomSelection((previous) => {
      const next = { ...previous, [fightId]: { ...(previous[fightId] ?? {}) } };
      if (next[fightId][customId]) delete next[fightId][customId];
      else next[fightId][customId] = true;
      return next;
    });
  }

  function toggleCustomColumn(fightId: number) {
    const ids = customMembers.map((member) => member.id);
    const allMarked = ids.length > 0 && ids.every((id) => customSelection[fightId]?.[id]);
    setCustomSelection((previous) => {
      const next = { ...previous, [fightId]: { ...(previous[fightId] ?? {}) } };
      for (const id of ids) {
        if (allMarked) delete next[fightId][id];
        else next[fightId][id] = true;
      }
      return next;
    });
  }

  return (
    <>
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
          <div className="row">          {dirty ? <span className="badge warn">{t("castleBoard.unsaved")}</span> : null}
            <span className="badge gold">
              {t("bossBoard.marks", {
                marks: formatNumber(marks, locale),
                capacity: formatNumber(capacity, locale),
              })}
          </span>
        </div>
      </div>
        <div className="card-body tight">
          <span className="small muted">{t("bossCustom.empty")}</span>
        </div>
      ) : (
        <form ref={customFormRef} action={saveWorldBossCustomAttendanceAction}>
          <input type="hidden" name="serverId" value={serverId} />
          <input type="hidden" name="week" value={weekStart} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="customAttendance" value={JSON.stringify(customPayload)} />

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th rowSpan={2}>{t("common.player")}</th>
                  {dayGroups.map((group) => (
                    <th key={group.day} colSpan={group.fights.length} className="day-head">
                      {shortWeekday(group.day, locale)} · {shortDay(group.day, locale)}
                    </th>
                  ))}
                  <th rowSpan={2} className="num">
                    {t("bossBoard.colMarks")}
                  </th>
                  <th rowSpan={2} className="num">
                    %
                  </th>
                  <th rowSpan={2} aria-label={t("bossCustom.removeColumn")} />
                </tr>
                <tr>
                  {fights.map((fight) => {
                    const allMarked =
                      customMembers.length > 0 &&
                      customMembers.every((member) => customSelection[fight.id]?.[member.id]);
                    const attended = customMembers.reduce(
                      (total, member) => total + (customSelection[fight.id]?.[member.id] ? 1 : 0),
                      0,
                    );
                    return (
                      <th key={fight.id} className="time-head">
                        <div className="time-head-top">
                          <span>{fight.fought_at}</span>
                          <span className="small muted">
                            {formatNumber(attended, locale)}/{formatNumber(customMembers.length, locale)}
                          </span>
                        </div>
                        {fight.label ? <div className="time-head-label">{fight.label}</div> : null}
                        <label className="small muted time-head-all">
                          <input
                            type="checkbox"
                            checked={allMarked}
                            onChange={() => toggleCustomColumn(fight.id)}
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
                </tr>
              </thead>
              <tbody>
                {customMembers.map((member) => {
                  const attended = fights.reduce(
                    (total, fight) => total + (customSelection[fight.id]?.[member.id] ? 1 : 0),
                    0,
                  );
                  const percent = fights.length > 0 ? Math.round((attended / fights.length) * 100) : 0;
                  return (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      {fights.map((fight) => (
                        <td key={fight.id} style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(customSelection[fight.id]?.[member.id])}
                            onChange={() => toggleCustom(fight.id, member.id)}
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
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="submit"
                          formAction={deleteWorldBossCustomMemberAction}
                          name="customId"
                          value={member.id}
                          className="week-fight-del-btn"
                          aria-label={t("bossCustom.removeAria", { name: member.name })}
                          title={t("bossCustom.removeAria", { name: member.name })}
                          onClick={(event) => {
                            if (!window.confirm(t("bossCustom.removeConfirm", { name: member.name }))) {
                              event.preventDefault();
                            }
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      )}
    </section>
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
                <th rowSpan={2}>{t("common.player")}</th>
                <th rowSpan={2}>{t("common.clan")}</th>
                <th rowSpan={2} className="num">
                  {t("players.colPower")}
                </th>
                {dayGroups.map((group) => (
                  <th key={group.day} colSpan={group.fights.length} className="day-head">
                    {shortWeekday(group.day, locale)} · {shortDay(group.day, locale)}
                  </th>
                ))}
                <th rowSpan={2} className="num">
                  {t("bossBoard.colMarks")}
                </th>
                <th rowSpan={2} className="num">
                  %
                </th>
              </tr>
              <tr>
                {fights.map((fight) => {
                  const allMarked =
                    visible.length > 0 &&
                    visible.every((member) => selection[fight.id]?.[member.character_id]);
                  const attended = visible.reduce(
                    (total, member) => total + (selection[fight.id]?.[member.character_id] ? 1 : 0),
                    0,
                  );
                  return (
                    <th key={fight.id} className="time-head">
                      <div className="time-head-top">
                        <span>{fight.fought_at}</span>
                        <span className="small muted">
                          {formatNumber(attended, locale)}/{formatNumber(visible.length, locale)}
                        </span>
                      </div>
                      {fight.label ? <div className="time-head-label">{fight.label}</div> : null}
                      <label className="small muted time-head-all">
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

    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <div>
          <div className="card-title">{t("bossCustom.title")}</div>
          <div className="card-sub">{t("bossCustom.sub")}</div>
        </div>
        <div className="row">
          {dirtyCustom ? <span className="badge warn">{t("castleBoard.unsaved")}</span> : null}
          <span className="badge">
            {t("bossCustom.badge", {
              marks: formatNumber(customMarks, locale),
              capacity: formatNumber(customCapacity, locale),
            })}
          </span>
        </div>
      </div>

      <div className="card-body" style={{ paddingTop: 0 }}>
      </div>

      {customMembers.length === 0 ? (
        <div className="card-body tight">
          <span className="small muted">{t("bossCustom.empty")}</span>
        </div>
      ) : (
        <form ref={customFormRef} action={saveWorldBossCustomAttendanceAction}>
          <input type="hidden" name="serverId" value={serverId} />
          <input type="hidden" name="week" value={weekStart} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="customAttendance" value={JSON.stringify(customPayload)} />

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th rowSpan={2}>{t("common.player")}</th>
                  {dayGroups.map((group) => (
                    <th key={group.day} colSpan={group.fights.length} className="day-head">
                      {shortWeekday(group.day, locale)} · {shortDay(group.day, locale)}
                    </th>
                  ))}
                  <th rowSpan={2} className="num">
                    {t("bossBoard.colMarks")}
                  </th>
                  <th rowSpan={2} className="num">
                    %
                  </th>
                  <th rowSpan={2} aria-label={t("bossCustom.removeColumn")} />
                </tr>
                <tr>
                  {fights.map((fight) => {
                    const allMarked =
                      customMembers.length > 0 &&
                      customMembers.every((member) => customSelection[fight.id]?.[member.id]);
                    const attended = customMembers.reduce(
                      (total, member) => total + (customSelection[fight.id]?.[member.id] ? 1 : 0),
                      0,
                    );
                    return (
                      <th key={fight.id} className="time-head">
                        <div className="time-head-top">
                          <span>{fight.fought_at}</span>
                          <span className="small muted">
                            {formatNumber(attended, locale)}/{formatNumber(customMembers.length, locale)}
                          </span>
                        </div>
                        {fight.label ? <div className="time-head-label">{fight.label}</div> : null}
                        <label className="small muted time-head-all">
                          <input
                            type="checkbox"
                            checked={allMarked}
                            onChange={() => toggleCustomColumn(fight.id)}
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
                </tr>
              </thead>
              <tbody>
                {customMembers.map((member) => {
                  const attended = fights.reduce(
                    (total, fight) => total + (customSelection[fight.id]?.[member.id] ? 1 : 0),
                    0,
                  );
                  const percent = fights.length > 0 ? Math.round((attended / fights.length) * 100) : 0;
                  return (
                    <tr key={member.id}>
                      <td>{member.name}</td>
                      {fights.map((fight) => (
                        <td key={fight.id} style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(customSelection[fight.id]?.[member.id])}
                            onChange={() => toggleCustom(fight.id, member.id)}
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
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="submit"
                          formAction={deleteWorldBossCustomMemberAction}
                          name="customId"
                          value={member.id}
                          className="week-fight-del-btn"
                          aria-label={t("bossCustom.removeAria", { name: member.name })}
                          title={t("bossCustom.removeAria", { name: member.name })}
                          onClick={(event) => {
                            if (!window.confirm(t("bossCustom.removeConfirm", { name: member.name }))) {
                              event.preventDefault();
                            }
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      )}
    </section>
    </>
  );
}