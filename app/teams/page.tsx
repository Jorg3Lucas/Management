import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { formatNumber, formatPower } from "@/lib/format";
import { getT } from "@/lib/i18n";
import {
  TEAM_COLORS,
  TEAM_SERVER_COOKIE,
  listTeams,
  teamClans,
  teamForce,
  teamIndividualMembers,
  teamMembers,
  unassignedClans,
} from "@/lib/teams";
import { AutoSave } from "@/components/AutoSave";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Flash, StatCard } from "@/components/ui";
import {
  assignCharacterTeamAction,
  assignTeamClanAction,
  createTeamAction,
  deleteTeamAction,
  selectTeamServerAction,
  updateTeamAction,
} from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("teams.metadata") };
}

export const dynamic = "force-dynamic";

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ server?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canEditServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  // Sem servidor na URL, volta no último escolhido no filtro (se ainda houver acesso).
  const remembered =
    requested === "" ? ((await cookies()).get(TEAM_SERVER_COOKIE)?.value ?? "").toUpperCase() : "";
  const selected =
    managed.find((server) => server.code === requested) ??
    managed.find((server) => server.code === remembered) ??
    managed[0] ??
    null;

  const teams = selected ? listTeams(selected.id) : [];
  const force = selected ? teamForce(selected.id) : [];
  const free = selected ? unassignedClans(selected.id) : [];
  const clanLists = new Map<number, ReturnType<typeof teamClans>>();
  const memberLists = new Map<number, ReturnType<typeof teamMembers>>();
  const individualLists = new Map<number, ReturnType<typeof teamIndividualMembers>>();
  if (selected) {
    for (const team of force) {
      clanLists.set(team.team_id, teamClans(team.team_id));
      memberLists.set(team.team_id, teamMembers(team.team_id));
      individualLists.set(team.team_id, teamIndividualMembers(team.team_id));
    }
  }

  const membersInTeams = force.reduce((sum, team) => sum + team.members, 0);
  const powerInTeams = force.reduce((sum, team) => sum + team.total_power, 0);
  const returnTo = selected ? `/teams?server=${selected.code}` : "/teams";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("teams.eyebrow")}</p>
          <h1 className="page-title">{t("teams.title")}</h1>
          <p className="page-sub">{t("teams.sub")}</p>
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      {managed.length === 0 ? <div className="alert warn">{t("gest.noServers")}</div> : null}

      {managed.length > 0 ? (
        <form className="filters" style={{ marginBottom: 18 }} action={selectTeamServerAction}>
          <div className="field">
            <label htmlFor="server">{t("common.server")}</label>
            <select id="server" name="server" defaultValue={selected?.code ?? ""}>
              {managed.map((server) => (
                <option key={server.id} value={server.code}>
                  {server.label} — {server.group_name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit">
            {t("common.filter")}
          </button>
        </form>
      ) : null}

      {selected ? (
        <>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <StatCard
              label={t("teams.statTeams")}
              value={teams.length}
              foot={t("teams.statTeamsFoot", { server: selected.label })}
            />
            <StatCard
              label={t("teams.statPlayers")}
              value={formatNumber(membersInTeams, locale)}
              foot={t("teams.statPlayersFoot")}
            />
            <StatCard
              label={t("teams.statPower")}
              value={formatPower(powerInTeams, locale)}
              foot={t("teams.statPowerFoot")}
            />
            <StatCard label={t("teams.statFree")} value={free.length} foot={t("teams.statFreeFoot")} />
          </div>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">{t("teams.newTeam")}</div>
                <div className="card-sub">{t("teams.newTeamSub")}</div>
              </div>
            </div>
            <div className="card-body">
              <form action={createTeamAction} className="form-grid">
                <input type="hidden" name="serverId" value={selected.id} />
                <input type="hidden" name="redirectTo" value={returnTo} />
                <div className="field">
                  <label htmlFor="teamName">{t("teams.name")}</label>
                  <input
                    id="teamName"
                    name="name"
                    type="text"
                    maxLength={40}
                    required
                    placeholder={t("teams.namePlaceholder")}
                  />
                </div>
                <div className="field">
                  <label htmlFor="teamColor">{t("teams.color")}</label>
                  <select id="teamColor" name="color" defaultValue={TEAM_COLORS[0].value}>
                    {TEAM_COLORS.map((color) => (
                      <option key={color.value} value={color.value}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="full row">
                  <button className="btn primary" type="submit">
                    {t("teams.create")}
                  </button>
                </div>
              </form>
            </div>
          </section>

          {force.length === 0 ? <div className="alert">{t("teams.none", { server: selected.label })}</div> : null}

          {force.map((team) => {
            const clans = clanLists.get(team.team_id) ?? [];
            const members = memberLists.get(team.team_id) ?? [];
            const individuals = individualLists.get(team.team_id) ?? [];
            return (
              <section key={team.team_id} className="card" style={{ marginBottom: 16 }}>
                <div className="card-head">
                  <div className="row" style={{ gap: 10 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 99,
                        background: team.color ?? "var(--muted-2)",
                        display: "inline-block",
                      }}
                    />
                    <div>
                      <div className="card-title">{team.team_name}</div>
                      <div className="card-sub">
                        {individuals.length > 0
                          ? t("teams.summaryIndividuals", {
                              clans: team.clans,
                              members: formatNumber(team.members, locale),
                              power: formatPower(team.top_power, locale),
                              individuals: individuals.length,
                            })
                          : t("teams.summary", {
                              clans: team.clans,
                              members: formatNumber(team.members, locale),
                              power: formatPower(team.top_power, locale),
                            })}
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <span className="badge">
                      {t("teams.powerBadge", { power: formatPower(team.total_power, locale) })}
                    </span>
                    <form action={deleteTeamAction} className="inline-form">
                      <input type="hidden" name="teamId" value={team.team_id} />
                      <input type="hidden" name="serverId" value={selected.id} />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <ConfirmButton message={t("teams.deleteConfirm", { team: team.team_name })}>
                        {t("common.remove")}
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
                <div className="card-body tight">
                  {clans.length === 0 && individuals.length === 0 ? (
                    <div className="empty">{t("teams.emptyTeam")}</div>
                  ) : null}

                  {clans.length > 0 ? (
                    <div className="list">
                      {clans.map((clan) => (
                        <div key={clan.clan_id} className="list-row">
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {clan.clan_name}{" "}
                              {clan.stance ? (
                                <span
                                  className={`badge ${clan.stance === "ally" ? "ok" : clan.stance === "enemy" ? "err" : ""}`}
                                >
                                  {t(`stance.${clan.stance}`)}
                                </span>
                              ) : null}
                            </div>
                            <div className="small muted">
                              {formatNumber(clan.members, locale)} · {formatPower(clan.total_power, locale)}
                            </div>
                          </div>
                          <form action={assignTeamClanAction} className="inline-form">
                            <input type="hidden" name="serverId" value={selected.id} />
                            <input type="hidden" name="clanId" value={clan.clan_id} />
                            <input type="hidden" name="teamId" value="" />
                            <input type="hidden" name="redirectTo" value={returnTo} />
                            <button className="btn sm ghost" type="submit">
                              {t("teams.unlink")}
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {members.length > 0 ? (
                    <>
                      <div className="roster-toolbar">
                        <span className="small muted">{t("teams.members")}</span>
                        <span className="badge">{formatNumber(members.length, locale)}</span>
                      </div>
                      <div className="list">
                        {members.map((member) => (
                          <div key={member.character_id} className="list-row">
                            <div>
                              <Link className="player-name" href={`/players/${member.character_id}`}>
                                {member.character_name}
                              </Link>
                              <div className="small muted">{member.clan_name}</div>
                            </div>
                            <span className="small mono">{formatPower(member.power_score, locale)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {individuals.length > 0 ? (
                    <>
                      <div className="roster-toolbar">
                        <span className="small muted">{t("teams.individuals")}</span>
                        <span className="badge">{individuals.length}</span>
                      </div>
                      <div className="list">
                        {individuals.map((member) => (
                          <div key={member.character_id} className="list-row">
                            <div>
                              <Link className="player-name" href={`/players/${member.character_id}`}>
                                {member.character_name}
                              </Link>
                              <div className="small muted">
                                {member.clan_name ?? t("common.noClan")} · {formatPower(member.power_score, locale)}
                              </div>
                            </div>
                            <form action={assignCharacterTeamAction} className="inline-form">
                              <input type="hidden" name="characterId" value={member.character_id} />
                              <input type="hidden" name="teamId" value="" />
                              <input type="hidden" name="redirectTo" value={returnTo} />
                              <button className="btn sm ghost" type="submit">
                                {t("teams.backToClan")}
                              </button>
                            </form>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  <div className="list-row" style={{ borderTop: "1px solid var(--border-soft)", flexWrap: "wrap" }}>
                    {free.length === 0 ? (
                      <span className="small muted">{t("teams.allClansAssigned")}</span>
                    ) : (
                      <form action={assignTeamClanAction} className="inline-form" style={{ flexWrap: "wrap" }}>
                        <input type="hidden" name="serverId" value={selected.id} />
                        <input type="hidden" name="teamId" value={team.team_id} />
                        <input type="hidden" name="redirectTo" value={returnTo} />
                        <select name="clanId" required aria-label={t("teams.clanAria", { team: team.team_name })}>
                          {free.map((clan) => (
                            <option key={clan.clan_id} value={clan.clan_id}>
                              {t("teams.clanOption", { name: clan.clan_name, count: clan.members })}
                            </option>
                          ))}
                        </select>
                        <button className="btn sm" type="submit">
                          {t("teams.linkClan")}
                        </button>
                      </form>
                    )}
                  </div>

                  <div className="list-row" style={{ borderTop: "1px solid var(--border-soft)", flexWrap: "wrap" }}>
                    <form action={updateTeamAction} className="inline-form" style={{ flexWrap: "wrap" }}>
                      <AutoSave delay={400} />
                      <input type="hidden" name="teamId" value={team.team_id} />
                      <input type="hidden" name="serverId" value={selected.id} />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <input
                        name="name"
                        type="text"
                        defaultValue={team.team_name}
                        maxLength={40}
                        required
                        aria-label={t("teams.nameAria", { team: team.team_name })}
                        style={{ maxWidth: 220 }}
                      />
                      <select
                        name="color"
                        defaultValue={team.color ?? TEAM_COLORS[0].value}
                        aria-label={t("teams.colorAria")}
                      >
                        {TEAM_COLORS.map((color) => (
                          <option key={color.value} value={color.value}>
                            {color.label}
                          </option>
                        ))}
                      </select>
                    </form>
                  </div>
                </div>
              </section>
            );
          })}

          {free.length > 0 ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">{t("teams.freeClans")}</div>
                  <div className="card-sub">{t("teams.freeClansSub")}</div>
                </div>
                <span className="badge warn">{free.length}</span>
              </div>
              <div className="card-body tight">
                <div className="list">
                  {free.map((clan) => (
                    <div key={clan.clan_id} className="list-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>{clan.clan_name}</div>
                        <div className="small muted">
                          {formatNumber(clan.members, locale)} · {formatPower(clan.total_power, locale)}
                        </div>
                      </div>
                      {teams.length === 0 ? (
                        <span className="small muted">{t("teams.createFirst")}</span>
                      ) : (
                        <form action={assignTeamClanAction} className="inline-form">
                          <input type="hidden" name="serverId" value={selected.id} />
                          <input type="hidden" name="clanId" value={clan.clan_id} />
                          <input type="hidden" name="redirectTo" value={returnTo} />
                          <select name="teamId" required aria-label={t("teams.teamOfAria", { clan: clan.clan_name })}>
                            {teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                          <button className="btn sm" type="submit">
                            {t("teams.link")}
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
