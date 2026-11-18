"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveCastlePrizesAction } from "@/app/castle/actions";
import { useT } from "@/components/I18nProvider";
import {
  CASTLE_PRIZES,
  CASTLE_PRIZE_TOTAL,
  castleMonthSlug,
  castlePrizeCounts,
  sortCastlePrizes,
  type CastlePrizeKey,
  type CastlePrizeMember,
} from "@/lib/castle-prizes";
import { formatNumber } from "@/lib/format";
import { INTL_LOCALE } from "@/lib/i18n/locales";

type Awards = Record<number, CastlePrizeKey[]>;

type Props = {
  serverId: number;
  monthStart: string;
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

export function CastlePrizeBoard({ serverId, monthStart, redirectTo, members, initial }: Props) {
  const { locale, t } = useT();
  const [awards, setAwards] = useState<Awards>(initial);
  const [query, setQuery] = useState("");
  const [clan, setClan] = useState("all");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const collator = useMemo(() => new Intl.Collator(INTL_LOCALE[locale], { sensitivity: "base" }), [locale]);

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
    return Array.from(stats.values()).sort((a, b) => collator.compare(a.name, b.name));
  }, [members, awards, collator]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase(INTL_LOCALE[locale]);
    return members.filter((member) => {
      if (clan !== "all" && String(member.clan_id) !== clan) return false;
      if (onlyUnassigned && (awards[member.character_id] ?? []).length > 0) return false;
      if (term && !member.name.toLocaleLowerCase(INTL_LOCALE[locale]).includes(term)) return false;
      return true;
    });
  }, [members, clan, onlyUnassigned, query, awards, locale]);

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
          collator.compare(a.member.name, b.member.name),
      );

    const totals = castlePrizeCounts([]);
    for (const row of rows) {
      for (const prize of CASTLE_PRIZES) totals[prize.key] += row.counts[prize.key];
    }

    return { rows, totals, totalChests: rows.reduce((total, row) => total + row.total, 0) };
  }, [members, awards, collator]);

  const prizeLabel = (key: CastlePrizeKey) => t(`prize.${key}` as const);

  function exportCsv() {
    const quote = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const lines = [
      [t("common.player"), t("common.clan"), ...CASTLE_PRIZES.map((prize) => prizeLabel(prize.key)), t("common.total")],
      ...summary.rows.map((row) => [
        row.member.name,
        row.member.clan_name,
        ...CASTLE_PRIZES.map((prize) => String(row.counts[prize.key])),
        String(row.total),
      ]),
      [
        t("common.total").toUpperCase(),
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
    link.download = t("castleBoard.csvFile", { month: castleMonthSlug(monthStart) });
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
      <input type="hidden" name="serverId" value={serverId} />
      <input type="hidden" name="month" value={monthStart} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="awards" value={JSON.stringify(awards)} />

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">{t("castleBoard.membersTitle")}</div>
            <div className="card-sub">{t("castleBoard.membersSub")}</div>
          </div>
          <div className="row">
            {dirty ? <span className="badge warn">{t("castleBoard.unsaved")}</span> : null}
            <span className="badge gold">
              {t("castleBoard.distributed", {
                used: formatNumber(used, locale),
                total: formatNumber(CASTLE_PRIZE_TOTAL, locale),
              })}
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
                    <span className={`prize-key ${prize.key}`}>{prizeLabel(prize.key)}</span>
                    <span className="small muted">
                      {prizeUsed}/{prize.total}
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 650, marginTop: 6 }}>{formatNumber(left, locale)}</div>
                  <div className="small muted">{t("castleBoard.left")}</div>
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
              {t("castleBoard.all", { count: formatNumber(members.length, locale) })}
            </button>
            {clanStats.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`btn sm${clan === String(entry.id) ? " primary" : " ghost"}`}
                onClick={() => setClan(String(entry.id))}
              >
                {entry.name} · {formatNumber(entry.assigned, locale)}/{formatNumber(entry.total, locale)}
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
                checked={onlyUnassigned}
                onChange={(event) => setOnlyUnassigned(event.target.checked)}
              />
              {t("castleBoard.onlyUnassigned")}
            </label>
            <span className="small muted">
              {t("castleBoard.visible", {
                visible: formatNumber(visible.length, locale),
                total: formatNumber(members.length, locale),
              })}
            </span>
            <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
              <button type="button" className="btn sm ghost" onClick={() => setAwards(initial)} disabled={!dirty}>
                {t("castleBoard.undo")}
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => setAwards({})}
                disabled={assigned === 0}
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
                <th>{t("castleBoard.colPrizes")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <span className="small muted">{t("castleBoard.noMember")}</span>
                  </td>
                </tr>
              ) : (
                visible.map((member) => {
                  const current = awards[member.character_id] ?? [];
                  return (
                    <tr key={member.character_id}>
                      <td className="cell-title" data-label={t("common.player")}>
                        <Link className="player-name" href={`/players/${member.character_id}`}>
                          {member.name}
                        </Link>
                      </td>
                      <td data-label={t("common.clan")}>
                        <span className="badge">{member.clan_name}</span>
                      </td>
                      <td className="num mono" data-label={t("players.colPower")}>
                        {formatNumber(member.power_score, locale)}
                      </td>
                      <td data-label={t("castleBoard.colPrizes")}>
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
                                title={t("castleBoard.prizeTitle", { label: prizeLabel(prize.key), left })}
                              >
                                {prizeLabel(prize.key)}
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
            {t("castleBoard.footer", {
              used: formatNumber(used, locale),
              total: formatNumber(CASTLE_PRIZE_TOTAL, locale),
              assigned: formatNumber(assigned, locale),
              eligible: formatNumber(members.length, locale),
            })}
          </span>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="card-head">
          <div>
            <div className="card-title">{t("castleBoard.summaryTitle")}</div>
            <div className="card-sub">{t("castleBoard.summarySub")}</div>
          </div>
          <div className="row">
            <span className="badge">
              {t("castleBoard.summaryBadge", { count: formatNumber(summary.rows.length, locale) })}
            </span>
            <button
              type="button"
              className="btn sm ghost"
              onClick={exportCsv}
              disabled={summary.rows.length === 0}
            >
              {t("castleBoard.exportCsv")}
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("common.player")}</th>
                <th>{t("common.clan")}</th>
                {CASTLE_PRIZES.map((prize) => (
                  <th key={prize.key} className="num">
                    {prizeLabel(prize.key)}
                  </th>
                ))}
                <th className="num">{t("common.total")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.length === 0 ? (
                <tr>
                  <td colSpan={CASTLE_PRIZES.length + 3}>
                    <span className="small muted">{t("castleBoard.noChests")}</span>
                  </td>
                </tr>
              ) : (
                summary.rows.map((row) => (
                  <tr key={row.member.character_id}>
                    <td className="cell-title" data-label={t("common.player")}>
                      <Link className="player-name" href={`/players/${row.member.character_id}`}>
                        {row.member.name}
                      </Link>
                    </td>
                    <td data-label={t("common.clan")}>
                      <span className="badge">{row.member.clan_name}</span>
                    </td>
                    {CASTLE_PRIZES.map((prize) => (
                      <td key={prize.key} className="num mono" data-label={prizeLabel(prize.key)}>
                        {row.counts[prize.key] > 0 ? (
                          <span className={`prize-count ${prize.key}`}>{row.counts[prize.key]}</span>
                        ) : (
                          <span className="muted">–</span>
                        )}
                      </td>
                    ))}
                    <td className="num mono" data-label={t("common.total")}>
                      {formatNumber(row.total, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {summary.rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={2}>{t("common.total")}</td>
                  {CASTLE_PRIZES.map((prize) => (
                    <td key={prize.key} className="num mono">
                      {formatNumber(summary.totals[prize.key], locale)}
                    </td>
                  ))}
                  <td className="num mono">{formatNumber(summary.totalChests, locale)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </form>
  );
}
