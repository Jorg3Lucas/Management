import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { recentAudit } from "@/lib/audit";
import { formatDateTime } from "@/lib/time";
import { EmptyState, Flash } from "@/components/ui";

export const metadata: Metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "clan.stance": "Postura de clã",
  "clan.merge": "Mescla de clãs",
  "team.create": "Time criado",
  "team.update": "Time editado",
  "team.delete": "Time removido",
  "team.clan": "Clã no time",
  "territory.owner": "Dono de território",
  "sabuk.win": "Vencedor do Sabuk",
  "sabuk.remove": "Sabuk removido",
  "player.home": "Servidor casa",
  "transfer.confirm": "Transferência confirmada",
  "transfer.reject": "Transferência rejeitada",
  "character.create": "Jogador cadastrado",
  "character.update": "Jogador editado",
  "user.create": "Usuário criado",
  "user.profile": "Perfil do usuário",
  "user.access": "Acessos do usuário",
  "user.owners": "Donos de servidor",
  "user.password": "Senha redefinida",
  "user.active": "Status do usuário",
  "server.flag": "Configuração de servidor",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const flash = await searchParams;
  const entries = recentAudit(150);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="page-title">Auditoria</h1>
          <p className="page-sub">Últimas 150 alterações administrativas, com autor, alvo e servidor.</p>
        </div>
        <div className="head-actions">
          <span className="badge">{entries.length} registro(s)</span>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <div className="card">
        <div className="table-wrap">
          {entries.length === 0 ? (
            <EmptyState title="Nenhuma alteração registrada">
              Edições de jogador, posturas de clã, acessos e configurações de servidor aparecem aqui.
            </EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>Ação</th>
                  <th>Servidor</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="small muted nowrap">{formatDateTime(entry.created_at)}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{entry.actor ?? "sistema"}</span>
                      <div className="player-clan">
                        {entry.entity}
                        {entry.entity_id ? ` #${entry.entity_id}` : ""}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${entry.action.startsWith("clan.") ? "gold" : ""}`}>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                    </td>
                    <td className="small muted">{entry.server_label ?? "—"}</td>
                    <td className="small muted" style={{ maxWidth: 380 }}>
                      {entry.detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
