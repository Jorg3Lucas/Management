import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, requireUser } from "@/lib/auth";
import { formatNumber, formatPower } from "@/lib/format";
import { getT } from "@/lib/i18n";
import {
  TEAM_SERVER_COOKIE,
  allianceRoster,
  ensureAllianceTeam,
  type AllianceMemberRow,
} from "@/lib/teams";
import { Flash, StatCard } from "@/components/ui";
import { selectTeamServerAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("teams.metadata") };
}

export const dynamic = "force-dynamic";

type ClanGroup = {
  id: number;
  name: string;
  power: number;
  members: AllianceMemberRow[];
};

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

  // O time é a aliança: mantém o time do servidor e os clãs aliados dentro dele
  // para que ficha do jogador e salários mostrem o mesmo time.
  if (selected) ensureAllianceTeam(selected.id);

  const roster = selected ? allianceRoster(selected.id) : [];

  // O time é a aliança do servidor: agrupa os aliados por clã para exibir todo mundo.
  const byClan = new Map<number, ClanGroup>();
  for (const row of roster) {
    let group = byClan.get(row.clan_id);
    if (!group) {
      group = { id: row.clan_id, name: row.clan_name, power: 0, members: [] };
      byClan.set(row.clan_id, group);
    }
    group.power += row.power_score;
    group.members.push(row);
  }
  const clans = [...byClan.values()].sort(
    (a, b) => b.power - a.power || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  const totalPower = roster.reduce((sum, row) => sum + row.power_score, 0);

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
          <div className="grid cols-3" style={{ marginBottom: 16 }}>
            <StatCard
              label={t("teams.statTeams")}
              value={clans.length}
              foot={t("teams.statTeamsFoot", { server: selected.label })}
            />
            <StatCard
              label={t("teams.statPlayers")}
              value={formatNumber(roster.length, locale)}
              foot={t("teams.statPlayersFoot")}
            />
            <StatCard
              label={t("teams.statPower")}
              value={formatPower(totalPower, locale)}
              foot={t("teams.statPowerFoot")}
            />
          </div>

          {clans.length === 0 ? <div className="alert">{t("teams.noAllies", { server: selected.label })}</div> : null}

          {clans.map((clan) => (
            <section key={clan.id} className="card" style={{ marginBottom: 16 }}>
              <div className="card-head">
                <div>
                  <div className="card-title">{clan.name}</div>
                  <div className="card-sub">
                    {t("teams.clanSummary", {
                      members: formatNumber(clan.members.length, locale),
                      power: formatPower(clan.power, locale),
                    })}
                  </div>
                </div>
                <div className="row">
                  <span className="badge ok">{t("stance.ally")}</span>
                  <span className="badge">{t("teams.powerBadge", { power: formatPower(clan.power, locale) })}</span>
                </div>
              </div>
              <div className="card-body tight">
                <div className="roster-toolbar">
                  <span className="small muted">{t("teams.members")}</span>
                  <span className="badge">{formatNumber(clan.members.length, locale)}</span>
                </div>
                <div className="list">
                  {clan.members.map((member) => (
                    <div key={member.character_id} className="list-row">
                      <Link className="player-name" href={`/players/${member.character_id}`}>
                        {member.character_name}
                      </Link>
                      <span className="small mono">{formatPower(member.power_score, locale)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </>
      ) : null}
    </>
  );
}
