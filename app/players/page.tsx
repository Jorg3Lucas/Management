import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, editableServerIds, requireUser } from "@/lib/auth";
import { stanceIndex } from "@/lib/clans";
import { formatDuration, formatPower } from "@/lib/format";
import { listCharacters, warSessionsForCharacters } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";
import { summarizeByCharacter } from "@/lib/wars";
import { EmptyState, Flash, Initials } from "@/components/ui";
import { createCharacterAction } from "./actions";

export const metadata: Metadata = { title: "Ranking" };
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

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Ranking</p>
          <h1 className="page-title">Jogadores</h1>
          <p className="page-sub">
            {result.total.toLocaleString("pt-BR")} personagem(ns) rastreado(s)
            {selectedServer ? ` em ${selectedServer.label}` : " nos servidores liberados"}.
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
          <label htmlFor="server">Servidor</label>
          <select id="server" name="server" defaultValue={selectedServer?.code ?? ""}>
            <option value="">Todos liberados</option>
            {servers.map((server) => (
              <option key={server.id} value={server.code}>
                {server.label} — {server.group_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="q">Buscar personagem ou clã</label>
          <input id="q" name="q" type="search" defaultValue={search} placeholder="Ex.: Garfil, St・" />
        </div>
        <div className="field">
          <label htmlFor="sort">Ordenar por</label>
          <select id="sort" name="sort" defaultValue={sort}>
            <option value="power">Poder</option>
            <option value="rank">Ranking</option>
            <option value="name">Nome</option>
            <option value="recent">Atualização</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="stance">Postura do clã</label>
          <select id="stance" name="stance" defaultValue={stance ?? ""}>
            <option value="">Todas</option>
            <option value="ally">Aliados</option>
            <option value="neutral">Neutros</option>
            <option value="enemy">Inimigos</option>
          </select>
        </div>
        <button className="btn" type="submit">
          Filtrar
        </button>
        {search || selectedServer || sort !== "power" || stance ? (
          <Link className="btn ghost" href="/players">
            Limpar
          </Link>
        ) : null}
      </form>

      {servers.length > 0 ? (
        <details className="panel">
          <summary>Adicionar jogador manualmente</summary>
          <div className="panel-body">
            <form action={createCharacterAction} className="form-grid">
              <div className="field">
                <label htmlFor="new-server">Servidor</label>
                <select id="new-server" name="serverId" required defaultValue={selectedServer?.id ?? servers[0].id}>
                  {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.label} — {server.group_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-name">Nome do personagem</label>
                <input id="new-name" name="name" type="text" maxLength={60} required />
              </div>
              <div className="field">
                <label htmlFor="new-power">Poder</label>
                <input id="new-power" name="power" type="text" inputMode="numeric" placeholder="Ex.: 450000" required />
              </div>
              <div className="field">
                <label htmlFor="new-clan">Clã (opcional)</label>
                <input id="new-clan" name="clan" type="text" maxLength={60} />
              </div>
              <div className="field">
                <label htmlFor="new-class">Classe (opcional)</label>
                <input id="new-class" name="className" type="text" maxLength={40} list="mir4-classes" />
              </div>
              <div className="field">
                <label htmlFor="new-level">Nível (opcional)</label>
                <input id="new-level" name="level" type="text" inputMode="numeric" placeholder="Ex.: 200" />
              </div>
              <div className="full row">
                <button className="btn primary" type="submit">
                  Cadastrar jogador
                </button>
                <span className="small muted">
                  O fórum não informa classe e nível — esses campos são preenchidos manualmente.
                </span>
              </div>
            </form>
          </div>
        </details>
      ) : null}

      <div className="card">
        <div className="table-wrap">
          {result.rows.length === 0 ? (
            <EmptyState title="Nenhum jogador encontrado">
              {serverIds.length === 0
                ? "Seu usuário ainda não tem servidores liberados."
                : "Rode a sincronização do servidor ou ajuste os filtros."}
            </EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th className="rank-cell">#</th>
                  <th>Jogador</th>
                  <th>Servidor</th>
                  <th>Classe</th>
                  <th className="num">Poder</th>
                  <th className="num">Pico</th>
                  <th className="num">Guerra</th>
                  <th>Atualizado</th>
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
                      <td className={`rank-cell${displayRank <= 3 ? " top" : ""}`}>{displayRank}</td>
                      <td>
                        <div className="player-cell">
                          <span className="player-avatar">
                            <Initials name={character.name} />
                          </span>
                          <div>
                            <Link className="player-name" href={`/players/${character.id}`}>
                              {character.name}
                            </Link>
                            <div className="player-clan">
                              {character.clan ?? "sem clã"}
                              {clanStance ? (
                                <span
                                  className={`badge ${clanStance === "ally" ? "ok" : clanStance === "enemy" ? "err" : ""}`}
                                  style={{ marginLeft: 6 }}
                                >
                                  {clanStance === "ally" ? "aliado" : clanStance === "neutral" ? "neutro" : "inimigo"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge">{character.server_label}</span>
                      </td>
                      <td className="muted small">{character.class_name ?? "—"}</td>
                      <td className="num mono" style={{ fontWeight: 650 }}>
                        {formatPower(character.power_score)}
                      </td>
                      <td className="num mono muted">{formatPower(character.peak_power)}</td>
                      <td className="num mono">
                        {war ? formatDuration(war.totalSeconds) : "—"}
                        {war?.activeCount ? <div className="small muted">em campo</div> : null}
                      </td>
                      <td className="small muted nowrap">{formatDateTime(character.updated_at)}</td>
                      <td>
                        <Link className="btn sm ghost" href={`/players/${character.id}`}>
                          {editableServers.has(character.server_id) ? "Editar" : "Abrir"}
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
          Página {result.page} de {result.pages} · até {result.pageSize} por página
          {warByCharacter.size > 0 ? ` · guerras contabilizadas até ${new Date(now).toLocaleDateString("pt-BR")}` : ""}
        </span>
        <div className="row">
          {result.page > 1 ? (
            <Link className="btn sm ghost" href={pageHref(result.page - 1)}>
              Anterior
            </Link>
          ) : (
            <span className="btn sm ghost" style={{ opacity: 0.4 }}>
              Anterior
            </span>
          )}
          {result.page < result.pages ? (
            <Link className="btn sm ghost" href={pageHref(result.page + 1)}>
              Próxima
            </Link>
          ) : (
            <span className="btn sm ghost" style={{ opacity: 0.4 }}>
              Próxima
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
