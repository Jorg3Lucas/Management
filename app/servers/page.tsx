import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { listServers, serverPlayerCounts } from "@/lib/queries";
import { groupServers } from "@/lib/server-groups";
import { TERRITORIES, territoryOwnersByServer } from "@/lib/territories";
import { formatDateTime } from "@/lib/time";
import { Flash, SyncBadge } from "@/components/ui";
import { syncServerAction, toggleServerFlagAction } from "./actions";

export const metadata: Metadata = { title: "Servidores" };
export const dynamic = "force-dynamic";

export default async function ServersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const flash = await searchParams;
  const servers = listServers();
  const counts = serverPlayerCounts();
  const groups = groupServers(servers);
  const territoryByServer = territoryOwnersByServer(servers.map((server) => server.id));
  const focusCount = servers.filter((server) => server.is_focus).length;
  const enabledCount = servers.filter((server) => server.sync_enabled).length;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="page-title">Servidores</h1>
          <p className="page-sub">
            Todos os servidores publicados no fórum do MIR4. Ative a coleta apenas nos que você acompanha — EU11 e EU21
            vêm como foco.
          </p>
        </div>
        <div className="head-actions">
          <span className="badge gold">{focusCount} em foco</span>
          <span className="badge ok">{enabledCount} sincronizando</span>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <div className="alert">
        A coleta lê o ranking público de poder do fórum (100 jogadores por página, até 1.000 por servidor — o limite de
        páginas fica em <code>SYNC_MAX_PAGES</code>). Ativar a sincronização não apaga jogadores que saíram do topo — o
        histórico é preservado.
      </div>

      {groups.map(([group, list]) => (
        <section key={group} className="server-list-group">
          <div className="group-title">
            {group} <span className="muted">· {list.length} servidor(es)</span>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Servidor</th>
                    <th>IDs do fórum</th>
                    <th className="num">Jogadores</th>
                    <th>Territórios</th>
                    <th>Sync</th>
                    <th>Último resultado</th>
                    <th className="num" style={{ textAlign: "right" }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((server) => (
                    <tr key={server.id}>
                      <td>
                        <div className="row" style={{ gap: 7 }}>
                          <span style={{ fontWeight: 650 }}>{server.label}</span>
                          <span className="small muted">{server.code}</span>
                          {server.is_focus ? <span className="badge gold">foco</span> : null}
                        </div>
                        {server.last_sync_message ? (
                          <div className="player-clan" title={server.last_sync_message}>
                            {server.last_sync_message}
                          </div>
                        ) : null}
                      </td>
                      <td className="small muted mono nowrap">
                        group {server.worldgroup_id} · world {server.world_id}
                      </td>
                      <td className="num mono">{(counts.get(server.id) ?? 0).toLocaleString("pt-BR")}</td>
                      <td>
                        <Link
                          className="tag-list"
                          href={`/territories?server=${server.code}`}
                          title={`Registrar territórios de ${server.label}`}
                        >
                          {TERRITORIES.map((territory) => {
                            const owner = territoryByServer.get(server.id)?.get(territory.key);
                            return (
                              <span key={territory.key} className={`badge${owner ? " gold" : ""}`}>
                                {territory.short}: {owner?.clan_name ?? "—"}
                              </span>
                            );
                          })}
                        </Link>
                      </td>
                      <td>
                        <form action={toggleServerFlagAction} className="inline-form">
                          <input type="hidden" name="serverId" value={server.id} />
                          <input type="hidden" name="field" value="sync_enabled" />
                          <input type="hidden" name="redirectTo" value="/servers" />
                          <button className={`btn sm${server.sync_enabled ? "" : " ghost"}`} type="submit">
                            {server.sync_enabled ? "Ativa" : "Desativada"}
                          </button>
                        </form>
                      </td>
                      <td>
                        <div className="stack" style={{ gap: 5 }}>
                          <SyncBadge status={server.last_sync_status} />
                          <span className="small muted">
                            {server.last_sync_at ? formatDateTime(server.last_sync_at) : "nunca"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <form action={toggleServerFlagAction} className="inline-form">
                            <input type="hidden" name="serverId" value={server.id} />
                            <input type="hidden" name="field" value="is_focus" />
                            <input type="hidden" name="redirectTo" value="/servers" />
                            <button className="btn sm ghost" type="submit">
                              {server.is_focus ? "Tirar do foco" : "Marcar foco"}
                            </button>
                          </form>
                          <form action={syncServerAction} className="inline-form">
                            <input type="hidden" name="serverId" value={server.id} />
                            <input type="hidden" name="redirectTo" value="/servers" />
                            <button className="btn sm" type="submit">
                              Sincronizar
                            </button>
                          </form>
                          <Link className="btn sm ghost" href={`/players?server=${server.code}`}>
                            Ver
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
