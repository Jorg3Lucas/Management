import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { formatDuration } from "@/lib/format";
import { recentSyncRuns } from "@/lib/queries";
import { formatDateTime } from "@/lib/time";
import { enabledServers } from "@/lib/sync";
import { EmptyState, Flash, StatCard, SyncBadge } from "@/components/ui";
import { syncAllAction } from "./actions";

export const metadata: Metadata = { title: "Sincronização" };
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const flash = await searchParams;
  const runs = recentSyncRuns(50);
  const servers = enabledServers();
  const lastRun = runs[0];
  const dailyHour = Number(process.env.SYNC_DAILY_HOUR ?? 17);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="page-title">Sincronização</h1>
          <p className="page-sub">
            Coleta do ranking de poder no fórum oficial, servidor por servidor. Jogadores fora da janela coletada não
            são apagados.
          </p>
        </div>
        <div className="head-actions">
          <form action={syncAllAction} className="inline-form">
            <button className="btn primary" type="submit">
              Sincronizar servidores ativos
            </button>
          </form>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <StatCard
          label="Servidores na fila"
          value={servers.length}
          foot={servers.length ? servers.map((server) => server.label).join(", ") : "ative em Servidores"}
        />
        <StatCard
          label="Última execução"
          value={lastRun ? lastRun.server_label ?? "—" : "—"}
          foot={lastRun ? formatDateTime(lastRun.started_at) : "nenhuma ainda"}
        />
        <StatCard
          label="Janela por servidor"
          value={`${(Number(process.env.SYNC_MAX_PAGES ?? 10) * 100).toLocaleString("pt-BR")} jogadores`}
          foot={`${Number(process.env.SYNC_MAX_PAGES ?? 10)} páginas de 100`}
        />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Histórico de execuções</div>
            <div className="card-sub">Últimas 50 rodadas do coletor</div>
          </div>
        </div>
        <div className="table-wrap">
          {runs.length === 0 ? (
            <EmptyState title="Nenhuma execução registrada">
              Clique em &quot;Sincronizar servidores ativos&quot; ou rode <code>npm run sync</code> no servidor.
            </EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Servidor</th>
                  <th>Status</th>
                  <th className="num">Linhas</th>
                  <th className="num">Novos</th>
                  <th className="num">Atualizados</th>
                  <th>Início</th>
                  <th className="num">Duração</th>
                  <th>Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{run.server_label ?? "—"}</span>
                      <div className="player-clan">{run.server_code ?? ""}</div>
                    </td>
                    <td>
                      <SyncBadge status={run.status} />
                    </td>
                    <td className="num mono">{run.rows_fetched}</td>
                    <td className="num mono">{run.rows_created}</td>
                    <td className="num mono">{run.rows_updated}</td>
                    <td className="small muted nowrap">{formatDateTime(run.started_at)}</td>
                    <td className="num mono">
                      {formatDuration((Date.parse(run.finished_at) - Date.parse(run.started_at)) / 1000)}
                    </td>
                    <td className="small muted" style={{ maxWidth: 320 }}>
                      {run.message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid cols-2">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Servidores ativos</div>
              <div className="card-sub">Configuração atual da fila</div>
            </div>
            <Link className="btn sm ghost" href="/servers">
              Alterar
            </Link>
          </div>
          <div className="card-body tight">
            {servers.length === 0 ? (
              <EmptyState title="Nenhum servidor ativo">Ative ao menos um servidor em Servidores.</EmptyState>
            ) : (
              <div className="list">
                {servers.map((server) => (
                  <div key={server.id} className="list-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {server.label} <span className="small muted mono">{server.code}</span>
                      </div>
                      <div className="small muted">
                        group {server.worldgroup_id} · world {server.world_id}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <SyncBadge status={server.last_sync_status} />
                      <div className="small muted">{server.last_sync_at ? formatDateTime(server.last_sync_at) : "nunca"}</div>
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
              <div className="card-title">Automação</div>
              <div className="card-sub">Rodada diária no próprio servidor</div>
            </div>
          </div>
          <div className="card-body stack">
            <p className="small muted">
              Todos os servidores são sincronizados automaticamente todos os dias às <strong>{dailyHour}h (horário de
              Brasília)</strong>. Ajuste em <code>SYNC_DAILY_HOUR</code> ou desligue com{" "}
              <code>SYNC_DAILY_ENABLED=0</code>.
            </p>
            <p className="small muted">
              A rota aceita sessão de administrador ou um token fixo. Configure <code>SYNC_TOKEN</code> no{" "}
              <code>.env.local</code> e chame:
            </p>
            <pre className="mono-box">{`curl -X POST "https://seu-dominio/api/sync?server=EU011" \\
  -H "Authorization: Bearer $SYNC_TOKEN"`}</pre>
            <p className="small muted">
              Sem o parâmetro <code>server</code>, sincroniza todos os servidores ativos. Limite de páginas:{" "}
              <code>SYNC_MAX_PAGES</code>; pausa entre páginas: <code>SYNC_DELAY_MS</code>.
            </p>
            <pre className="mono-box">{`# CLI no servidor
npm run sync --all          # todos os 68 servidores
npm run sync                # apenas os servidores ativos
npm run sync -- EU011 EU021`}</pre>
          </div>
        </section>
      </div>
    </>
  );
}
