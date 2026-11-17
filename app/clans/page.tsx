import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, isAdmin, requireUser } from "@/lib/auth";
import {
  clanStanceCounts,
  clansInServer,
  listServerClans,
  recentClanChanges,
  refreshClanLinks,
} from "@/lib/clans";
import { formatPower } from "@/lib/format";
import { getT } from "@/lib/i18n";
import type { Translator } from "@/lib/i18n";
import { formatDateTime } from "@/lib/time";
import { AutoSave } from "@/components/AutoSave";
import { EmptyState, Flash, StatCard } from "@/components/ui";
import { mergeClansAction, setClanStanceAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("clans.metadata") };
}

export const dynamic = "force-dynamic";

export default async function ClansPage({
  searchParams,
}: {
  searchParams: Promise<{ server?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const params = await searchParams;
  refreshClanLinks();

  const managed = accessibleServers(user).filter((server) => canEditServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  const clans = selected ? listServerClans(selected.id) : [];
  const counts = selected ? clanStanceCounts(selected.id) : { ally: 0, neutral: 0, enemy: 0, unset: 0 };
  const changes = selected ? recentClanChanges(selected.id, 15) : [];
  const mergeOptions = selected && isAdmin(user) ? clansInServer(selected.id) : [];
  const returnTo = selected ? `/clans?server=${selected.code}` : "/clans";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("clans.eyebrow")}</p>
          <h1 className="page-title">{t("clans.title")}</h1>
          <p className="page-sub">{t("clans.sub")}</p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/clans?server=${server.code}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      {managed.length === 0 ? <div className="alert warn">{t("gest.noServers")}</div> : null}

      {selected ? (
        <>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <StatCard label={t("players.stanceAlly")} value={counts.ally} foot={t("clans.allyFoot")} />
            <StatCard label={t("players.stanceNeutral")} value={counts.neutral} foot={t("clans.neutralFoot")} />
            <StatCard label={t("players.stanceEnemy")} value={counts.enemy} foot={t("clans.enemyFoot")} />
            <StatCard
              label={t("clans.unset")}
              value={counts.unset}
              foot={t("clans.unsetFoot", { count: clans.length })}
            />
          </div>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">{t("clans.inServer", { server: selected.label })}</div>
                <div className="card-sub">{t("clans.inServerSub")}</div>
              </div>
              <Link className="btn sm ghost" href={`/players?server=${selected.code}`}>
                {t("dash.viewRanking")}
              </Link>
            </div>
            <div className="table-wrap">
              {clans.length === 0 ? (
                <EmptyState title={t("clans.empty")}>{t("clans.emptyBody")}</EmptyState>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t("clans.colClan")}</th>
                      <th>{t("clans.colStance")}</th>
                      <th className="num">{t("clans.colMembers")}</th>
                      <th className="num">{t("clans.colTotalPower")}</th>
                      <th className="num">{t("clans.colTopPower")}</th>
                      <th>{t("clans.colActivity")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {clans.map((clan) => (
                      <tr key={clan.clan_id}>
                        <td>
                          <Link
                            className="player-name"
                            href={`/clans/${clan.clan_id}?server=${selected.code}`}
                            style={{ fontWeight: 600 }}
                          >
                            {clan.clan_name}
                          </Link>
                          <div className="player-clan">
                            {clan.stance ? stanceLabel(clan.stance, t) : t("clans.notClassified")}
                          </div>
                        </td>
                        <td>
                          <form action={setClanStanceAction} className="inline-form">
                            <AutoSave delay={400} />
                            <input type="hidden" name="serverId" value={selected.id} />
                            <input type="hidden" name="clanId" value={clan.clan_id} />
                            <input type="hidden" name="redirectTo" value={returnTo} />
                            <select
                              name="stance"
                              defaultValue={clan.stance ?? ""}
                              aria-label={t("clans.stanceAria", { clan: clan.clan_name })}
                            >
                              <option value="">{t("clans.stanceUnset")}</option>
                              <option value="ally">{t("clans.stanceAlly")}</option>
                              <option value="neutral">{t("clans.stanceNeutral")}</option>
                              <option value="enemy">{t("clans.stanceEnemy")}</option>
                            </select>
                          </form>
                        </td>
                        <td className="num mono">{clan.members}</td>
                        <td className="num mono">{formatPower(clan.total_power, locale)}</td>
                        <td className="num mono muted">{formatPower(clan.top_power, locale)}</td>
                        <td className="small muted nowrap">
                          {clan.last_seen_at ? formatDateTime(clan.last_seen_at, locale) : "—"}
                        </td>
                        <td>
                          <div className="row" style={{ justifyContent: "flex-end" }}>
                            <Link className="btn sm ghost" href={`/clans/${clan.clan_id}?server=${selected.code}`}>
                              {t("clans.openClan")}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <div className="grid cols-2">
            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">{t("clans.recentChanges")}</div>
                  <div className="card-sub">{t("clans.recentChangesSub")}</div>
                </div>
                <span className="badge">{changes.length}</span>
              </div>
              <div className="card-body tight">
                {changes.length === 0 ? (
                  <EmptyState title={t("clans.noChanges")}>{t("clans.noChangesBody")}</EmptyState>
                ) : (
                  <div className="list">
                    {changes.map((change) => (
                      <div key={change.id} className="list-row">
                        <div>
                          <Link className="player-name" href={`/players/${change.character_id}`}>
                            {change.character_name}
                          </Link>
                          <div className="small muted">
                            {change.previous_clan_name ?? t("common.noClan")} → <strong>{change.clan_name}</strong>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="small muted nowrap">{formatDateTime(change.changed_at, locale)}</div>
                          <span className={`badge ${change.source === "manual" ? "gold" : ""}`}>{change.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">{t("clans.variants")}</div>
                  <div className="card-sub">{t("clans.variantsSub")}</div>
                </div>
              </div>
              <div className="card-body">
                {mergeOptions.length < 2 ? (
                  <p className="small muted">{t("clans.needTwo")}</p>
                ) : !isAdmin(user) ? (
                  <p className="small muted">{t("clans.adminOnlyMerge")}</p>
                ) : (
                  <form action={mergeClansAction} className="stack">
                    <input type="hidden" name="serverId" value={selected.id} />
                    <input type="hidden" name="redirectTo" value={returnTo} />
                    <div className="field">
                      <label htmlFor="sourceId">{t("clans.sourceLabel")}</label>
                      <select id="sourceId" name="sourceId" required>
                        {mergeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {t("clans.optionLabel", { name: option.name, count: option.members })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="targetId">{t("clans.targetLabel")}</label>
                      <select id="targetId" name="targetId" required>
                        {mergeOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {t("clans.optionLabel", { name: option.name, count: option.members })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="row">
                      <button className="btn primary" type="submit">
                        {t("clans.mergeButton")}
                      </button>
                      <span className="small muted">{t("clans.mergeNote")}</span>
                    </div>
                  </form>
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}

function stanceLabel(stance: "ally" | "neutral" | "enemy", t: Translator["t"]): string {
  return stance === "ally"
    ? t("stance.ally")
    : stance === "neutral"
      ? t("stance.neutral")
      : t("stance.enemy");
}
