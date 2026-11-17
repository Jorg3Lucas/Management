import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import {
  clanCandidates,
  clanMembers,
  countClanlessCharacters,
  getClan,
  getServerClan,
} from "@/lib/clans";
import { formatPower } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/time";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EmptyState, Flash, RichText, StatCard } from "@/components/ui";
import { assignClanPlayerAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { t } = await getT();
  const { id } = await params;
  const clan = getClan(Number(id));
  return { title: clan ? t("clanDetail.metadataName", { name: clan.name }) : t("clanDetail.metadata") };
}

export default async function ClanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ server?: string; q?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const { id } = await params;
  const query = await searchParams;
  const clanId = Number(id);

  if (!Number.isFinite(clanId)) notFound();
  const clan = getClan(clanId);
  if (!clan) notFound();

  const managed = accessibleServers(user).filter((server) => canEditServer(user, server.id));
  if (managed.length === 0) redirect("/clans");

  const requested = (query.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0];
  const summary = getServerClan(selected.id, clanId);
  if (!summary || summary.members === 0) notFound();

  const search = (query.q ?? "").trim().slice(0, 60);
  const members = clanMembers(selected.id, clanId);
  const candidates = clanCandidates(selected.id, clanId, { search, limit: 100 });
  const clanless = countClanlessCharacters(selected.id);
  const path = `/clans/${clanId}?server=${selected.code}`;
  const returnTo = search ? `${path}&q=${encodeURIComponent(search)}` : path;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row small muted" style={{ marginBottom: 6 }}>
            <Link href={`/clans?server=${selected.code}`}>{t("nav.clans")}</Link>
            <span>/</span>
            <span>{selected.label}</span>
          </div>
          <h1 className="page-title">{clan.name}</h1>
          <p className="page-sub">{t("clanDetail.sub", { server: selected.label })}</p>
        </div>
        <div className="head-actions">
          {summary.stance ? (
            <span
              className={`badge ${summary.stance === "ally" ? "ok" : summary.stance === "enemy" ? "err" : ""}`}
            >
              {t(`stance.${summary.stance}`)}
            </span>
          ) : (
            <span className="badge">{t("clans.stanceUnset")}</span>
          )}
          <Link className="btn sm ghost" href={`/players?server=${selected.code}&q=${encodeURIComponent(clan.name)}`}>
            {t("clanDetail.viewRanking")}
          </Link>
        </div>
      </div>

      <Flash ok={query.ok} error={query.error} />

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <StatCard label={t("clanDetail.members")} value={summary.members} foot={t("clanDetail.membersFoot")} />
        <StatCard
          label={t("clanDetail.totalPower")}
          value={formatPower(summary.total_power, locale)}
          foot={t("clanDetail.totalPowerFoot")}
        />
        <StatCard
          label={t("clanDetail.topPower")}
          value={formatPower(summary.top_power, locale)}
          foot={t("clanDetail.topPowerFoot")}
        />
        <StatCard
          label={t("clanDetail.clanless")}
          value={clanless}
          foot={t("clanDetail.clanlessFoot", { code: selected.code })}
        />
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">{t("clanDetail.roster")}</div>
            <div className="card-sub">
              {t("clanDetail.rosterSub", {
                date: summary.last_seen_at ? formatDateTime(summary.last_seen_at, locale) : "—",
              })}
            </div>
          </div>
          <span className="badge">{members.length}</span>
        </div>
        <div className="table-wrap">
          {members.length === 0 ? (
            <EmptyState title={t("clanDetail.rosterEmpty")}>{t("clanDetail.rosterEmptyBody")}</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th className="rank-cell">#</th>
                  <th>{t("common.player")}</th>
                  <th>{t("players.colClass")}</th>
                  <th className="num">{t("players.colPower")}</th>
                  <th className="num">{t("clanDetail.colRank")}</th>
                  <th>{t("clanDetail.colSeen")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => (
                  <tr key={member.id}>
                    <td className="rank-cell">{index + 1}</td>
                    <td>
                      <Link className="player-name" href={`/players/${member.id}`}>
                        {member.name}
                      </Link>
                      {member.sync_locked ? (
                        <span className="badge warn" style={{ marginLeft: 6 }}>
                          {t("clanDetail.protected")}
                        </span>
                      ) : null}
                    </td>
                    <td className="muted small">{member.class_name ?? "—"}</td>
                    <td className="num mono">{formatPower(member.power_score, locale)}</td>
                    <td className="num mono muted">{member.rank_position ?? "—"}</td>
                    <td className="small muted nowrap">
                      {member.last_seen_at ? formatDateTime(member.last_seen_at, locale) : "—"}
                    </td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <form action={assignClanPlayerAction} className="inline-form">
                          <input type="hidden" name="serverId" value={selected.id} />
                          <input type="hidden" name="clanId" value={clanId} />
                          <input type="hidden" name="characterId" value={member.id} />
                          <input type="hidden" name="mode" value="remove" />
                          <input type="hidden" name="redirectTo" value={returnTo} />
                          <ConfirmButton
                            message={t("clanDetail.removeConfirm", { player: member.name, clan: clan.name })}
                          >
                            {t("common.remove")}
                          </ConfirmButton>
                        </form>
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
              <div className="card-title">{t("clanDetail.assignTitle")}</div>
              <div className="card-sub">{t("clanDetail.assignSub")}</div>
            </div>
          </div>
          <div className="card-body stack">
            <form action={path} method="get" className="inline-form" style={{ flexWrap: "wrap" }}>
              <input type="hidden" name="server" value={selected.code} />
              <input
                name="q"
                type="search"
                defaultValue={search}
                placeholder={t("clanDetail.searchPlaceholder")}
                aria-label={t("clanDetail.searchAria")}
                style={{ minWidth: 200 }}
              />
              <button className="btn sm" type="submit">
                {t("common.search")}
              </button>
              {search ? (
                <Link className="btn sm ghost" href={path}>
                  {t("players.clear")}
                </Link>
              ) : null}
            </form>

            {candidates.length === 0 ? (
              <p className="small muted">
                {search ? t("clanDetail.noCandidateSearch") : t("clanDetail.noCandidate")}
              </p>
            ) : (
              <form action={assignClanPlayerAction} className="stack">
                <input type="hidden" name="serverId" value={selected.id} />
                <input type="hidden" name="clanId" value={clanId} />
                <input type="hidden" name="mode" value="assign" />
                <input type="hidden" name="redirectTo" value={returnTo} />
                <div className="field">
                  <label htmlFor="characterId">{t("common.player")}</label>
                  <select id="characterId" name="characterId" required>
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} · {candidate.clan ?? t("common.noClan")} ·{" "}
                        {formatPower(candidate.power_score, locale)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row">
                  <button className="btn primary" type="submit">
                    {t("clanDetail.assignButton")}
                  </button>
                  <span className="small muted">{t("clanDetail.assignNote")}</span>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("clanDetail.howTitle")}</div>
              <div className="card-sub">{t("clanDetail.howSub")}</div>
            </div>
          </div>
          <div className="card-body stack small muted">
            <p>{t("clanDetail.how1")}</p>
            <p>
              <RichText text={t("clanDetail.how2")} />
            </p>
            <p>{t("clanDetail.how3")}</p>
          </div>
        </section>
      </div>
    </>
  );
}
