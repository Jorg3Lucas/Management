import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canEditServer, editableServerIds, requireUser } from "@/lib/auth";
import { stanceIndex } from "@/lib/clans";
import { formatDuration, formatNumber, formatPower } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { listCharacters, warSessionsForCharacters } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";
import { summarizeByCharacter } from "@/lib/wars";
import { EmptyState, Flash, Initials } from "@/components/ui";
import { createCharacterAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("players.metadata") };
}

export const dynamic = "force-dynamic";

type SearchParams = {
  server?: string;
  q?: string;
  sort?: string;
  stance?: string;
  page?: string;
  ok?: string;
  error?: string;
};

const SORTS = ["power", "rank", "name", "recent"] as const;
type Sort = (typeof SORTS)[number];

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const params = await searchParams;
  const servers = accessibleServers(user);
  const serverIds = servers.map((server) => server.id);

  const requestedServer = (params.server ?? "").toUpperCase();
  const selectedServer = servers.find((server) => server.code === requestedServer) ?? null;
  const sort: Sort = SORTS.includes((params.sort ?? "") as Sort) ? ((params.sort ?? "power") as Sort) : "power";
  const search = (params.q ?? "").trim().slice(0, 60);
  const requestedStance = params.stance ?? "";
  const stance =
    requestedStance === "ally" || requestedStance === "neutral" || requestedStance === "enemy"
      ? requestedStance
      : undefined;
  const editableServers = new Set(editableServerIds(user));
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const result = listCharacters({
    serverIds,
    serverId: selectedServer?.id,
    search,
    sort,
    stance,
    page,
    pageSize: 50,
  });

  const sessions = warSessionsForCharacters(result.rows.map((row) => row.id));
  const warByCharacter = summarizeByCharacter(sessions);
  const clanStances = stanceIndex(serverIds);
  const now = Date.now();

  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (selectedServer) query.set("server", selectedServer.code);
    if (search) query.set("q", search);
    if (sort !== "power") query.set("sort", sort);
    if (stance) query.set("stance", stance);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return suffix ? `/players?${suffix}` : "/players";
  };

  const count = formatNumber(result.total, locale);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("nav.ranking")}</p>
          <h1 className="page-title">{t("players.title")}</h1>
          <p className="page-sub">
            {selectedServer
              ? t("players.subServer", { count, server: selectedServer.label })
              : t("players.sub", { count })}
          </p>
        </div>
        <div className="head-actions">
          {servers.slice(0, 4).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selectedServer?.id === server.id ? " primary" : " ghost"}`}
              href={`/players?server=${server.code}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      <form className="filters" style={{ marginBottom: 18 }} action="/players" method="get">
        <div className="field">
          <label htmlFor="server">{t("players.filterServer")}</label>
          <select id="server" name="server" defaultValue={selectedServer?.code ?? ""}>
            <option value="">{t("players.allGranted")}</option>
            {servers.map((server) => (
              <option key={server.id} value={server.code}>
                {server.label} — {server.group_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="q">{t("players.searchLabel")}</label>
          <input id="q" name="q" type="search" defaultValue={search} placeholder={t("players.searchPlaceholder")} />
        </div>
        <div className="field">
          <label htmlFor="sort">{t("players.sort")}</label>
          <select id="sort" name="sort" defaultValue={sort}>
            <option value="power">{t("players.sortPower")}</option>
            <option value="rank">{t("players.sortRank")}</option>
            <option value="name">{t("players.sortName")}</option>
            <option value="recent">{t("players.sortRecent")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="stance">{t("players.stance")}</label>
          <select id="stance" name="stance" defaultValue={stance ?? ""}>
            <option value="">{t("players.stanceAll")}</option>
            <option value="ally">{t("players.stanceAlly")}</option>
            <option value="neutral">{t("players.stanceNeutral")}</option>
            <option value="enemy">{t("players.stanceEnemy")}</option>
          </select>
        </div>
        <button className="btn" type="submit">
          {t("common.filter")}
        </button>
        {search || selectedServer || sort !== "power" || stance ? (
          <Link className="btn ghost" href="/players">
            {t("players.clear")}
          </Link>
        ) : null}
      </form>

      {servers.length > 0 ? (
        <details className="panel">
          <summary>{t("players.addManual")}</summary>
          <div className="panel-body">
            <form action={createCharacterAction} className="form-grid">
              <div className="field">
                <label htmlFor="new-server">{t("players.filterServer")}</label>
                <select id="new-server" name="serverId" required defaultValue={selectedServer?.id ?? servers[0].id}>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.label} — {server.group_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-name">{t("players.charName")}</label>
                <input id="new-name" name="name" type="text" maxLength={60} required />
              </div>
              <div className="field">
                <label htmlFor="new-power">{t("players.power")}</label>
                <input
                  id="new-power"
                  name="power"
                  type="text"
                  inputMode="numeric"
                  placeholder={t("players.powerPlaceholder")}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="new-clan">{t("players.clanOptional")}</label>
                <input id="new-clan" name="clan" type="text" maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="new-class">{t("players.classOptional")}</label>
                <input id="new-class" name="className" type="text" maxLength={40} list="mir4-classes" />
              </div>
              <div className="field">
                <label htmlFor="new-level">{t("players.levelOptional")}</label>
                <input
                  id="new-level"
                  name="level"
                  type="text"
                  inputMode="numeric"
                  placeholder={t("players.levelPlaceholder")}
                />
              </div>
              <div className="full row">
                <button className="btn primary" type="submit">
                  {t("players.createButton")}
                </button>
                <span className="small muted">{t("players.manualNote")}</span>
              </div>
            </form>
          </div>
        </details>
      ) : null}

      <div className="card">
        <div className="table-wrap">
          {result.rows.length === 0 ? (
            <EmptyState title={t("players.empty")}>
              {serverIds.length === 0 ? t("players.emptyNoServers") : t("players.emptyBody")}
            </EmptyState>
          ) : (
            <table className="data table-cards">
              <thead>
                <tr>
                  <th className="rank-cell">#</th>
                  <th>{t("common.player")}</th>
                  <th>{t("common.server")}</th>
                  <th>{t("players.colClass")}</th>
                  <th className="num">{t("players.colPower")}</th>
                  <th className="num">{t("players.colPeak")}</th>
                  <th className="num">{t("players.colWar")}</th>
                  <th>{t("players.colUpdated")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.rows.map((character, index) => {
                  const war = warByCharacter.get(character.id);
                  const clanStance = character.clan_id
                    ? clanStances.get(`${character.server_id}:${character.clan_id}`)
                    : undefined;
                  const displayRank = character.rank_position ?? (result.page - 1) * result.pageSize + index + 1;
                  return (
                    <tr key={character.id}>
                      <td className={`rank-cell cell-rank${displayRank <= 3 ? " top" : ""}`}>{displayRank}</td>
                      <td className="cell-title cell-title-rank">
                        <div className="player-cell">
                          <span className="player-avatar">
                            <Initials name={character.name} />
                          </span>
                          <div>
                            <Link className="player-name" href={`/players/${character.id}`}>
                              {character.name}
                            </Link>
                            <div className="player-clan">
                              {character.clan && character.clan_id && canEditServer(user, character.server_id) ? (
                                <Link
                                  className="clan-link"
                                  href={`/clans/${character.clan_id}?server=${character.server_code}`}
                                >
                                  {character.clan}
                                </Link>
                              ) : (
                                (character.clan ?? t("common.noClan"))
                              )}
                              {clanStance ? (
                                <span
                                  className={`badge ${clanStance === "ally" ? "ok" : clanStance === "enemy" ? "err" : ""}`}
                                  style={{ marginLeft: 6 }}
                                >
                                  {t(`stance.${clanStance}`)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label={t("common.server")}>
                        <span className="badge">{character.server_label}</span>
                      </td>
                      <td className="muted small" data-label={t("players.colClass")}>
                        {character.class_name ?? "—"}
                      </td>
                      <td className="num mono" style={{ fontWeight: 650 }} data-label={t("players.colPower")}>
                        {formatPower(character.power_score, locale)}
                      </td>
                      <td className="num mono muted" data-label={t("players.colPeak")}>
                        {formatPower(character.peak_power, locale)}
                      </td>
                      <td className="num mono" data-label={t("players.colWar")}>
                        {war ? formatDuration(war.totalSeconds, locale) : "—"}
                        {war?.activeCount ? <div className="small muted">{t("players.onField")}</div> : null}
                      </td>
                      <td className="small muted nowrap" data-label={t("players.colUpdated")}>
                        {formatDateTime(character.updated_at, locale)}
                      </td>
                      <td className="cell-action">
                        <Link className="btn sm ghost" href={`/players/${character.id}`}>
                          {editableServers.has(character.server_id) ? t("common.edit") : t("players.open")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="spread" style={{ marginTop: 14 }}>
        <span className="small muted">
          {warByCharacter.size > 0
            ? t("players.pagerWars", {
                page: result.page,
                pages: result.pages,
                size: result.pageSize,
                date: formatDateTime(new Date(now).toISOString(), locale),
              })
            : t("players.pager", { page: result.page, pages: result.pages, size: result.pageSize })}
        </span>
        <div className="row">
          {result.page > 1 ? (
            <Link className="btn sm ghost" href={pageHref(result.page - 1)}>
              {t("players.prev")}
            </Link>
          ) : (
            <span className="btn sm ghost" style={{ opacity: 0.4 }}>
              {t("players.prev")}
            </span>
          )}
          {result.page < result.pages ? (
            <Link className="btn sm ghost" href={pageHref(result.page + 1)}>
              {t("players.next")}
            </Link>
          ) : (
            <span className="btn sm ghost" style={{ opacity: 0.4 }}>
              {t("players.next")}
            </span>
          )}
        </div>
      </div>

      <datalist id="mir4-classes">
        <option value="Warrior" />
        <option value="Sorcerer" />
        <option value="Taoist" />
        <option value="Arbalist" />
        <option value="Lancer" />
        <option value="Darkist" />
      </datalist>
    </>
  );
}
