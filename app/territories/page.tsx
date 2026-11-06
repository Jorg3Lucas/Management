import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canAdminServer, requireUser } from "@/lib/auth";
import { clansInServer } from "@/lib/clans";
import { formatPower } from "@/lib/format";
import {
  formatSabukDate,
  recentSabukWins,
  TERRITORIES,
  territoryHistory,
  territoryOwners,
  type TerritoryOwner,
} from "@/lib/territories";
import { formatDateTime, nowIso, utcToZonedInput } from "@/lib/time";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Flash } from "@/components/ui";
import { deleteSabukWinAction, recordSabukWinAction, setTerritoryOwnerAction } from "./actions";

export const metadata: Metadata = { title: "Territórios" };
export const dynamic = "force-dynamic";

export default async function TerritoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ server?: string; ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canAdminServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  const owners = selected ? territoryOwners(selected.id) : new Map<string, TerritoryOwner>();
  const clans = selected ? clansInServer(selected.id) : [];
  const registered = TERRITORIES.filter((territory) => owners.has(territory.key)).length;
  const history = selected ? territoryHistory(selected.id, 60) : [];
  const historyByTerritory = new Map<string, typeof history>();
  for (const entry of history) {
    const list = historyByTerritory.get(entry.territory);
    if (list) list.push(entry);
    else historyByTerritory.set(entry.territory, [entry]);
  }
  const sabukWins = selected ? recentSabukWins(selected.id, 8) : [];
  const latestSabuk = sabukWins[0] ?? null;
  const today = utcToZonedInput(nowIso()).slice(0, 10);
  const returnTo = selected ? `/territories?server=${selected.code}` : "/territories";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Diplomacia</p>
          <h1 className="page-title">Territórios</h1>
          <p className="page-sub">
            Quem domina o castelo e os vales do servidor. Só o líder registra; membros e poder vêm do ranking
            sincronizado.
          </p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/territories?server=${server.code}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      {managed.length === 0 ? (
        <div className="alert warn">
          Você não lidera nenhum servidor. Peça ao administrador para marcar você como dono de um servidor em Usuários.
        </div>
      ) : null}

      {selected ? (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            <span className="badge gold">
              {registered} de {TERRITORIES.length} territórios registrados em {selected.label}
            </span>
            {clans.length === 0 ? (
              <span className="badge warn">Nenhum clã no ranking ainda — sincronize o servidor</span>
            ) : (
              <span className="badge">{clans.length} clã(s) disponíveis</span>
            )}
          </div>

          <div className="grid cols-2">
            {TERRITORIES.map((territory) => {
              const owner = owners.get(territory.key);
              const changes = (historyByTerritory.get(territory.key) ?? []).slice(0, 3);
              return (
                <section key={territory.key} className="card">
                  <div className="card-head">
                    <div>
                      <div className="card-title">{territory.name}</div>
                      <div className="card-sub">{territory.hint}</div>
                    </div>
                    <span className={`badge ${territory.kind === "castle" ? "gold" : ""}`}>
                      {territory.kind === "castle" ? "castelo" : "vale"}
                    </span>
                  </div>
                  <div className="card-body stack">
                    <div>
                      <div className="small muted">Dono atual</div>
                      {owner ? (
                        <div className="row" style={{ marginTop: 4 }}>
                          <span className="badge gold" style={{ fontSize: 13, padding: "4px 10px" }}>
                            {owner.clan_name}
                          </span>
                          <span className="small muted">
                            {owner.members} jogador(es) · {formatPower(owner.total_power)} de poder
                          </span>
                        </div>
                      ) : (
                        <div className="muted" style={{ fontWeight: 600 }}>
                          Sem dono registrado
                        </div>
                      )}
                    </div>

                    <form action={setTerritoryOwnerAction} className="inline-form" style={{ flexWrap: "wrap" }}>
                      <input type="hidden" name="serverId" value={selected.id} />
                      <input type="hidden" name="territory" value={territory.key} />
                      <input type="hidden" name="redirectTo" value={returnTo} />
                      <select name="clanId" defaultValue={owner?.clan_id ?? ""} aria-label={`Dono de ${territory.name}`}>
                        <option value="">Sem dono</option>
                        {clans.map((clan) => (
                          <option key={clan.id} value={clan.id}>
                            {clan.name} — {clan.members} jogador(es)
                          </option>
                        ))}
                      </select>
                      <button className="btn sm primary" type="submit">
                        Salvar
                      </button>
                    </form>

                    {owner ? (
                      <div className="small muted">
                        Atualizado {formatDateTime(owner.updated_at)}
                        {owner.updated_by_name ? ` por ${owner.updated_by_name}` : ""}
                      </div>
                    ) : null}

                    <div>
                      <div className="small muted" style={{ marginBottom: 4 }}>
                        Últimas trocas de dono
                      </div>
                      {changes.length === 0 ? (
                        <div className="small muted">Nenhuma troca registrada ainda.</div>
                      ) : (
                        <div className="stack" style={{ gap: 4 }}>
                          {changes.map((entry) => (
                            <div key={entry.id} className="small">
                              <span className="muted">{entry.previous_clan_name ?? "sem dono"}</span>
                              <span className="muted"> → </span>
                              <span style={{ fontWeight: 600 }}>{entry.clan_name ?? "sem dono"}</span>
                              <span className="muted">
                                {" · "}
                                {formatDateTime(entry.changed_at)}
                                {entry.changed_by_name ? ` · ${entry.changed_by_name}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <section className="card" style={{ marginTop: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">Sabuk Clash</div>
                <div className="card-sub">Clã vencedor de cada rodada; a mais recente vale como atual</div>
              </div>
              {latestSabuk ? (
                <span className="badge gold">
                  {latestSabuk.clan_name} · {formatSabukDate(latestSabuk.won_on)}
                </span>
              ) : (
                <span className="badge">sem registro</span>
              )}
            </div>
            <div className="card-body stack">
              <form action={recordSabukWinAction} className="form-grid">
                <input type="hidden" name="serverId" value={selected.id} />
                <input type="hidden" name="redirectTo" value={returnTo} />
                <div className="field">
                  <label htmlFor="sabukClan">Clã vencedor</label>
                  <select id="sabukClan" name="clanId" required defaultValue={latestSabuk?.clan_id ?? ""}>
                    <option value="" disabled>
                      Selecione o clã
                    </option>
                    {clans.map((clan) => (
                      <option key={clan.id} value={clan.id}>
                        {clan.name} — {clan.members} jogador(es)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="sabukDate">Data da rodada</label>
                  <input id="sabukDate" name="wonOn" type="date" defaultValue={today} required />
                </div>
                <div className="full row">
                  <button className="btn primary" type="submit">
                    Registrar vencedor
                  </button>
                  <span className="small muted">
                    Registrar a mesma data de novo substitui o vencedor daquela rodada.
                  </span>
                </div>
              </form>

              <div>
                <div className="small muted" style={{ marginBottom: 6 }}>
                  Últimas rodadas
                </div>
                {sabukWins.length === 0 ? (
                  <div className="empty">
                    <strong>Nenhum vencedor registrado</strong>
                    Registre a rodada acima para começar o histórico do Sabuk Clash.
                  </div>
                ) : (
                  <div className="list">
                    {sabukWins.map((win) => (
                      <div key={win.id} className="list-row">
                        <div>
                          <div style={{ fontWeight: 600 }}>{win.clan_name}</div>
                          <div className="small muted">
                            {formatSabukDate(win.won_on)}
                            {win.created_by_name ? ` · registrado por ${win.created_by_name}` : ""}
                          </div>
                        </div>
                        <form action={deleteSabukWinAction} className="inline-form">
                          <input type="hidden" name="serverId" value={selected.id} />
                          <input type="hidden" name="winId" value={win.id} />
                          <input type="hidden" name="redirectTo" value={returnTo} />
                          <ConfirmButton message={`Remover o registro de ${win.clan_name} (${formatSabukDate(win.won_on)})?`}>
                            Remover
                          </ConfirmButton>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
