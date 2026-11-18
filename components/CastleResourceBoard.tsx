"use client";

import { useMemo, useState } from "react";
import { saveCastleResourcesAction } from "@/app/castle/actions";
import { CopyPlayerName } from "@/components/CopyPlayerName";
import { useT } from "@/components/I18nProvider";
import type { CastleResourceMember } from "@/lib/castle-resources";
import { formatNumber, normalizeSearch } from "@/lib/format";

type RowState = { darksteel: string; gold: string; delivered: boolean };

type Props = {
  serverId: number;
  monthStart: string;
  redirectTo: string;
  members: CastleResourceMember[];
};

/** "1.500.000" → 1500000. */
function amountOf(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function cleanAmount(value: string): string {
  return value.replace(/\D/g, "").slice(0, 13);
}

export function CastleResourceBoard({ serverId, monthStart, redirectTo, members }: Props) {
  const { locale, t } = useT();
  const [values, setValues] = useState<Record<number, RowState>>(() =>
    Object.fromEntries(
      members.map((member) => [
        member.character_id,
        {
          darksteel: member.darksteel > 0 ? String(member.darksteel) : "",
          gold: member.gold > 0 ? String(member.gold) : "",
          delivered: Boolean(member.delivered_at),
        },
      ]),
    ),
  );
  const [query, setQuery] = useState("");

  const initial = useMemo(() => {
    const map = new Map<number, string>();
    for (const member of members) {
      map.set(member.character_id, `${member.darksteel}:${member.gold}:${member.delivered_at ? 1 : 0}`);
    }
    return map;
  }, [members]);

  const totals = useMemo(() => {
    let darksteel = 0;
    let gold = 0;
    let paid = 0;
    let delivered = 0;
    for (const member of members) {
      const row = values[member.character_id];
      if (!row) continue;
      const ds = amountOf(row.darksteel);
      const g = amountOf(row.gold);
      if (ds === 0 && g === 0) continue;
      darksteel += ds;
      gold += g;
      paid += 1;
      if (row.delivered) delivered += 1;
    }
    return { darksteel, gold, paid, delivered };
  }, [members, values]);

  const dirty = useMemo(
    () =>
      members.some((member) => {
        const row = values[member.character_id];
        if (!row) return false;
        const ds = amountOf(row.darksteel);
        const g = amountOf(row.gold);
        const paid = ds > 0 || g > 0;
        return `${ds}:${g}:${row.delivered && paid ? 1 : 0}` !== initial.get(member.character_id);
      }),
    [members, values, initial],
  );

  const entries = useMemo(() => {
    const payload: Record<number, { darksteel: number; gold: number; delivered: boolean }> = {};
    for (const member of members) {
      const row = values[member.character_id];
      if (!row) continue;
      const darksteel = amountOf(row.darksteel);
      const gold = amountOf(row.gold);
      if (darksteel === 0 && gold === 0) continue;
      payload[member.character_id] = { darksteel, gold, delivered: row.delivered };
    }
    return payload;
  }, [members, values]);

  const visible = useMemo(() => {
    const term = normalizeSearch(query);
    if (!term) return members;
    return members.filter((member) => normalizeSearch(member.name).includes(term));
  }, [members, query]);

  function setAmount(characterId: number, field: "darksteel" | "gold", value: string) {
    const next = cleanAmount(value);
    setValues((previous) => ({ ...previous, [characterId]: { ...previous[characterId], [field]: next } }));
  }

  function setDelivered(characterId: number, delivered: boolean) {
    setValues((previous) => ({ ...previous, [characterId]: { ...previous[characterId], delivered } }));
  }

  return (
    <form action={saveCastleResourcesAction}>
      <input type="hidden" name="serverId" value={serverId} />
      <input type="hidden" name="month" value={monthStart} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">{t("castleRes.boardTitle")}</div>
            <div className="card-sub">{t("castleRes.boardSub")}</div>
          </div>
          <div className="row">
            {dirty ? <span className="badge warn">{t("castleRes.unsaved")}</span> : null}
            <span className="badge">
              {t("castleRes.paidBadge", {
                paid: formatNumber(totals.paid, locale),
                members: formatNumber(members.length, locale),
              })}
            </span>
            <span className="badge">
              {t("castleRes.deliveredBadge", {
                delivered: formatNumber(totals.delivered, locale),
                paid: formatNumber(totals.paid, locale),
              })}
            </span>
            <span className="badge gold">{t("castleRes.darksteelTotal", { value: formatNumber(totals.darksteel, locale) })}</span>
            <span className="badge gold">{t("castleRes.goldTotal", { value: formatNumber(totals.gold, locale) })}</span>
          </div>
        </div>

        <div className="card-body row" style={{ gap: 10 }}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("castleRes.searchPlaceholder")}
            aria-label={t("castleRes.searchAria")}
            style={{ maxWidth: 240 }}
          />
          <span className="small muted">
            {t("castleRes.visible", {
              visible: formatNumber(visible.length, locale),
              total: formatNumber(members.length, locale),
            })}
          </span>
          <button
            type="button"
            className="btn sm ghost"
            style={{ marginLeft: "auto" }}
            disabled={!dirty}
            onClick={() =>
              setValues(
                Object.fromEntries(
                  members.map((member) => [
                    member.character_id,
                    {
                      darksteel: member.darksteel > 0 ? String(member.darksteel) : "",
                      gold: member.gold > 0 ? String(member.gold) : "",
                      delivered: Boolean(member.delivered_at),
                    },
                  ]),
                ),
              )
            }
          >
            {t("castleRes.undo")}
          </button>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("common.player")}</th>
                <th>{t("common.clan")}</th>
                <th className="num">{t("castleRes.darksteel")}</th>
                <th className="num">{t("castleRes.gold")}</th>
                <th className="num" title={t("castleRes.deliveredHint")}>
                  {t("castleRes.colDelivered")}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <span className="small muted">{t("castleRes.noMember")}</span>
                  </td>
                </tr>
              ) : (
                visible.map((member) => {
                  const row = values[member.character_id];
                  const paid = amountOf(row.darksteel) > 0 || amountOf(row.gold) > 0;
                  return (
                    <tr key={member.character_id} className={row.delivered && paid ? "row-ok" : undefined}>
                      <td className="cell-title" data-label={t("common.player")}>
                        <CopyPlayerName name={member.name} href={`/players/${member.character_id}`} />
                      </td>
                      <td data-label={t("common.clan")}>
                        <span className="badge">{member.clan_name}</span>
                      </td>
                      <td className="num" data-label={t("castleRes.darksteel")}>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="mono"
                          value={row.darksteel}
                          onChange={(event) => setAmount(member.character_id, "darksteel", event.target.value)}
                          placeholder="0"
                          aria-label={`${t("castleRes.darksteel")} · ${member.name}`}
                          style={{ width: 130, textAlign: "right" }}
                        />
                      </td>
                      <td className="num" data-label={t("castleRes.gold")}>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="mono"
                          value={row.gold}
                          onChange={(event) => setAmount(member.character_id, "gold", event.target.value)}
                          placeholder="0"
                          aria-label={`${t("castleRes.gold")} · ${member.name}`}
                          style={{ width: 130, textAlign: "right" }}
                        />
                      </td>
                      <td className="cell-action" data-label={t("castleRes.colDelivered")}>
                        <input
                          type="checkbox"
                          checked={row.delivered && paid}
                          disabled={!paid}
                          onChange={(event) => setDelivered(member.character_id, event.target.checked)}
                          aria-label={`${t("castleRes.colDelivered")} · ${member.name}`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {totals.paid > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={2}>{t("common.total")}</td>
                  <td className="num mono">{formatNumber(totals.darksteel, locale)}</td>
                  <td className="num mono">{formatNumber(totals.gold, locale)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        <div className="panel-body spread">
          <span className="small muted">
            {totals.paid > 0 ? t("castleRes.footer") : t("castleRes.empty")}
          </span>
          <button className="btn primary" type="submit" disabled={!dirty}>
            {t("castleRes.save")}
          </button>
        </div>
      </section>
    </form>
  );
}
