import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { decidedMoves, pendingMoves, refreshPlayerLinks } from "@/lib/players";
import { formatDateTime } from "@/lib/time";
import { EmptyState, Flash } from "@/components/ui";
import { confirmMoveAction, rejectMoveAction } from "./actions";

export const metadata: Metadata = { title: "Transferências" };
export const dynamic = "force-dynamic";

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const flash = await searchParams;
  refreshPlayerLinks();

  const pending = pendingMoves(40);
  const decided = decidedMoves(40);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="page-title">Transferências</h1>
          <p className="page-sub">
            Quando o mesmo nome aparece em outro servidor, o painel sugere a mudança. Confirmar move o servidor casa do
            jogador; o tempo de guerra continua somado entre os personagens.
          </p>
        </div>
        <div className="head-actions">
          <span className={`badge ${pending.length > 0 ? "warn" : ""}`}>{pending.length} pendente(s)</span>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Pendentes</div>
            <div className="card-sub">Detectadas automaticamente na sincronização</div>
          </div>
        </div>
        <div className="card-body tight">
          {pending.length === 0 ? (
            <EmptyState title="Nenhuma transferência pendente">
              A sugestão aparece quando um personagem novo surge em um servidor e o mesmo jogador foi visto em outro nos
              últimos 30 dias.
            </EmptyState>
          ) : (
            <div className="list">
              {pending.map((move) => (
                <div key={move.id} className="list-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {move.player_name}{" "}
                      <span className="small muted">
                        {move.from_label ?? "origem desconhecida"} → {move.to_label}
                      </span>
                    </div>
                    <div className="small muted">
                      detectada em {formatDateTime(move.detected_at)}
                      {move.character_id ? (
                        <>
                          {" · "}
                          <Link href={`/players/${move.character_id}`}>abrir personagem</Link>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="row">
                    <form action={confirmMoveAction} className="inline-form">
                      <input type="hidden" name="moveId" value={move.id} />
                      <button className="btn sm primary" type="submit">
                        Confirmar
                      </button>
                    </form>
                    <form action={rejectMoveAction} className="inline-form">
                      <input type="hidden" name="moveId" value={move.id} />
                      <button className="btn sm ghost" type="submit">
                        Rejeitar
                      </button>
                    </form>
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
            <div className="card-title">Histórico de decisões</div>
            <div className="card-sub">Transferências confirmadas ou rejeitadas</div>
          </div>
        </div>
        <div className="table-wrap">
          {decided.length === 0 ? (
            <EmptyState title="Nenhuma decisão registrada" />
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
                {decided.map((move) => (
                  <tr key={move.id}>
                    <td style={{ fontWeight: 600 }}>{move.player_name}</td>
                    <td className="small muted">{move.from_label ?? "—"}</td>
                    <td className="small muted">{move.to_label}</td>
                    <td className="small muted nowrap">{formatDateTime(move.detected_at)}</td>
                    <td>
                      <span className={`badge ${move.status === "confirmed" ? "ok" : "err"}`}>
                        {move.status === "confirmed" ? "confirmada" : "rejeitada"}
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
