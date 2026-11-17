"use client";

import { useMemo, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { INTL_LOCALE } from "@/lib/i18n/locales";

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

/** Seletor de participantes da guerra: marcar vários jogadores de uma vez. */
export function WarPartyPicker({ members, initial = [], name = "characterIds" }: Props) {
  const { locale, t } = useT();
  const [selected, setSelected] = useState<Set<number>>(() => new Set(initial));
  const [query, setQuery] = useState("");
  const [clan, setClan] = useState("all");

  const collator = useMemo(() => new Intl.Collator(INTL_LOCALE[locale], { sensitivity: "base" }), [locale]);

  const clans = useMemo(() => {
    const names = new Set<string>();
    for (const member of members) names.add(member.clan ?? "");
    return Array.from(names).sort((a, b) => collator.compare(a, b));
  }, [members, collator]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase(INTL_LOCALE[locale]);
    return members.filter((member) => {
      if (clan !== "all" && (member.clan ?? "") !== clan) return false;
      if (term && !member.name.toLocaleLowerCase(INTL_LOCALE[locale]).includes(term)) return false;
      return true;
    });
  }, [members, clan, query, locale]);

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

  return (
    <div className="party-picker">
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

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
        <button type="button" className="btn sm ghost" onClick={selectVisible}>
          {t("wars.partySelectVisible")}
        </button>
        <span className="badge gold">{t("wars.partyCount", { count: selected.size })}</span>
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
              <span className="small muted">{member.clan ?? "—"}</span>
              <span className="badge">{member.server_label}</span>
            </label>
          ))
        )}
      </div>

      <div className="party-picker-tools">
        <span className="small muted">
          {t("castleBoard.visible", {
            visible: String(visible.length),
            total: String(members.length),
          })}
        </span>
        {selected.size > 0 ? (
          <button type="button" className="btn sm ghost" onClick={() => setSelected(new Set())}>
            {t("castleBoard.clear")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
