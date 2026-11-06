import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { recentMoves, refreshPlayerLinks } from "@/lib/players";
import { formatDateTime } from "@/lib/time";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Transferências" };
export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  await requireAdmin();
  refreshPlayerLinks();

  const moves = recentMoves(60);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="page-title">Transferências</h1>
          <p className="page-sub">
            Quando o mesmo nome aparece em outro servidor, a troca é confirmada na própria sincronização: o servidor
            casa passa a ser o novo servidor, sem etapa de aprovação. O tempo de guerra continua somado entre os
            personagens.
          </p>
        </div>
        <div className="head-actions">
          <span className="badge">{moves.length} registrada(s)</span>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Histórico de transferências</div>
            <div className="card-sub">Detectadas e aplicadas automaticamente na sincronização</div>
          </div>
        </div>
        <div className="table-wrap">
          {moves.length === 0 ? (
            <EmptyState title="Nenhuma transferência registrada">
              A transferência aparece quando um personagem novo surge em um servidor e o mesmo jogador foi visto em
              outro nos últimos 30 dias.
            </EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Jogador</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Detectada</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((move) => (
                  <tr key={move.id}>
                    <td style={{ fontWeight: 600 }}>
                      {move.character_id ? (
                        <Link href={`/players/${move.character_id}`}>{move.player_name}</Link>
                      ) : (
                        move.player_name
                      )}
                    </td>
                    <td className="small muted">{move.from_label ?? "—"}</td>
                    <td className="small muted">{move.to_label}</td>
                    <td className="small muted nowrap">{formatDateTime(move.detected_at)}</td>
                    <td>
                      <span className={`badge ${move.status === "rejected" ? "err" : "ok"}`}>
                        {move.status === "rejected" ? "rejeitada" : "confirmada"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
