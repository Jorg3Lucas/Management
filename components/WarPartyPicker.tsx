"use client";

import { useEffect, useMemo, useState } from "react";
import { searchWarRankingAction } from "@/app/wars/actions";
import { useT } from "@/components/I18nProvider";
import { INTL_LOCALE } from "@/lib/i18n/locales";
import type { CharacterSearchRow } from "@/lib/queries";

export type WarPartyMember = {
  id: number;
  name: string;
  clan: string | null;
  server_label: string;
};

type Props = {
  members: WarPartyMember[];
  initial?: number[];
  name?: string;
};

/**
 * Seletor de participantes da guerra: o time do servidor vem pronto e o resto
 * pode ser buscado no ranking geral do jogo (jogador convidado de outro servidor).
 */
export function WarPartyPicker({ members, initial = [], name = "characterIds" }: Props) {
  const { locale, t } = useT();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initial));
  const [query, setQuery] = useState("");
  const [clan, setClan] = useState("all");
  const [extra, setExtra] = useState<WarPartyMember[]>([]);
  const [rankingTerm, setRankingTerm] = useState("");
  const [rankingResults, setRankingResults] = useState<CharacterSearchRow[]>([]);
  const [searching, setSearching] = useState(false);

  const collator = useMemo(() => new Intl.Collator(INTL_LOCALE[locale], { sensitivity: "base" }), [locale]);

  // Quem vem da busca no ranking não está no elenco do servidor: fica num extra.
  const allMembers = useMemo(() => {
    const merged = [...members];
    for (const member of extra) {
      if (!merged.some((entry) => entry.id === member.id)) merged.push(member);
    }
    return merged.sort((a, b) => collator.compare(a.name, b.name));
  }, [members, extra, collator]);

  useEffect(() => {
    const term = rankingTerm.trim();
    if (term.length < 2) {
      setRankingResults([]);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchWarRankingAction(term);
        if (active) setRankingResults(rows);
      } catch {
        if (active) setRankingResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [rankingTerm]);

  const clans = useMemo(() => {
    const names = new Set<string>();
    for (const member of allMembers) names.add(member.clan ?? "");
    return Array.from(names).sort((a, b) => collator.compare(a, b));
  }, [allMembers, collator]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase(INTL_LOCALE[locale]);
    return allMembers.filter((member) => {
      if (clan !== "all" && (member.clan ?? "") !== clan) return false;
      if (term && !member.name.toLocaleLowerCase(INTL_LOCALE[locale]).includes(term)) return false;
      return true;
    });
  }, [allMembers, clan, query, locale]);

  const addable = useMemo(
    () => rankingResults.filter((row) => !allMembers.some((member) => member.id === row.id)),
    [rankingResults, allMembers],
  );

  function toggle(id: number) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    const allMarked = visible.length > 0 && visible.every((member) => selected.has(member.id));
    setSelected((previous) => {
      const next = new Set(previous);
      for (const member of visible) {
        if (allMarked) next.delete(member.id);
        else next.add(member.id);
      }
      return next;
    });
  }

  function addFromRanking(row: CharacterSearchRow) {
    setExtra((previous) =>
      previous.some((member) => member.id === row.id)
        ? previous
        : [...previous, { id: row.id, name: row.name, clan: row.clan, server_label: row.server_label }],
    );
    setSelected((previous) => new Set(previous).add(row.id));
    setRankingTerm("");
    setRankingResults([]);
  }

  const rankingHint =
    rankingTerm.trim().length < 2
      ? t("bossCustom.searchHint")
      : searching
        ? t("bossCustom.searching")
        : addable.length === 0
          ? t("bossCustom.noResults")
          : null;

  return (
    <div className="party-picker">
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <div className="party-picker-columns">
        <section className="party-picker-pane">
          <header className="party-picker-pane-head">
            <span>{t("wars.partyTeamTitle")}</span>
            <span className="badge">
              {t("castleBoard.visible", {
                visible: String(visible.length),
                total: String(allMembers.length),
              })}
            </span>
          </header>

          <div className="party-picker-tools">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("castleBoard.searchPlaceholder")}
              aria-label={t("castleBoard.searchAria")}
            />
            <select value={clan} onChange={(event) => setClan(event.target.value)} aria-label={t("common.clan")}>
              <option value="all">{t("wars.partyAllClans")}</option>
              {clans.map((name) => (
                <option key={name || "none"} value={name}>
                  {name || t("wars.partyNoClan")}
                </option>
              ))}
            </select>
          </div>

          <div className="party-picker-list">
            {visible.length === 0 ? (
              <span className="small muted">{t("castleBoard.noMember")}</span>
            ) : (
              visible.map((member) => (
                <label key={member.id} className={`party-picker-row${selected.has(member.id) ? " on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(member.id)}
                    onChange={() => toggle(member.id)}
                    aria-label={member.name}
                  />
                  <span className="party-picker-name">{member.name}</span>
                  <span className="party-picker-clan small muted">{member.clan ?? "—"}</span>
                  <span className="badge">{member.server_label}</span>
                </label>
              ))
            )}
          </div>

          <div className="party-picker-foot">
            <button type="button" className="btn sm ghost" onClick={selectVisible}>
              {t("wars.partySelectVisible")}
            </button>
            <span className="badge gold">{t("wars.partyCount", { count: selected.size })}</span>
            {selected.size > 0 ? (
              <button type="button" className="btn sm ghost" onClick={() => setSelected(new Set())}>
                {t("castleBoard.clear")}
              </button>
            ) : null}
          </div>
        </section>

        <section className="party-picker-pane party-picker-ranking">
          <header className="party-picker-pane-head">
            <span>{t("wars.partyRankingTitle")}</span>
          </header>

          <input
            type="search"
            value={rankingTerm}
            onChange={(event) => setRankingTerm(event.target.value)}
            placeholder={t("bossCustom.placeholder")}
            aria-label={t("bossCustom.placeholder")}
          />
          {rankingHint ? <span className="small muted">{rankingHint}</span> : null}
          {addable.length > 0 ? (
            <div className="party-picker-results">
              {addable.map((row) => (
                <div key={row.id} className="party-picker-result">
                  <span className="party-picker-result-name">{row.name}</span>
                  <span className="badge">{row.server_label}</span>
                  <button type="button" className="btn sm ghost" onClick={() => addFromRanking(row)}>
                    {t("bossCustom.add")}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
