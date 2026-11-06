import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUserById, requireAdmin, userOwnerServerIds, userServerIds } from "@/lib/auth";
import { listServers } from "@/lib/queries";
import { formatDate } from "@/lib/time";
import { Flash } from "@/components/ui";
import { ServerAccessGrid } from "@/components/ServerAccessGrid";
import {
  resetPasswordAction,
  toggleUserActiveAction,
  updateUserAccessAction,
  updateUserOwnersAction,
  updateUserProfileAction,
} from "../actions";

export const metadata: Metadata = { title: "Gerenciar usuário" };
export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const flash = await searchParams;
  const userId = Number(id);

  if (!Number.isFinite(userId)) notFound();
  const account = getUserById(userId);
  if (!account) notFound();

  const servers = listServers();
  const access = userServerIds(account.id);
  const owners = userOwnerServerIds(account.id);
  const isSelf = account.id === admin.id;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row small muted" style={{ marginBottom: 6 }}>
            <Link href="/users">Usuários</Link>
            <span>/</span>
            <span>{account.username}</span>
          </div>
          <h1 className="page-title">{account.display_name}</h1>
          <p className="page-sub">
            {account.username} · criado em {formatDate(account.created_at)}
          </p>
        </div>
        <div className="head-actions">
          <span className={`badge ${account.role === "ADMIN" ? "gold" : ""}`}>
            {account.role === "ADMIN" ? "Administrador" : "Operador"}
          </span>
          <span className={`badge ${account.active ? "ok" : "err"}`}>
            {account.active ? "Ativo" : "Desativado"}
          </span>
          {!isSelf ? (
            <form action={toggleUserActiveAction} className="inline-form">
              <input type="hidden" name="userId" value={account.id} />
              <input type="hidden" name="active" value={account.active ? "0" : "1"} />
              <button className={`btn sm ${account.active ? "danger" : ""}`} type="submit">
                {account.active ? "Desativar usuário" : "Reativar usuário"}
              </button>
            </form>
          ) : (
            <span className="badge">você</span>
          )}
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <div className="card-title">Perfil e papel</div>
          </div>
          <div className="card-body">
            <form action={updateUserProfileAction} className="form-grid">
              <input type="hidden" name="userId" value={account.id} />
              <div className="field">
                <label htmlFor="displayName">Nome de exibição</label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  defaultValue={account.display_name}
                  maxLength={60}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="role">Papel</label>
                <select id="role" name="role" defaultValue={account.role} disabled={isSelf}>
                  <option value="USER">Operador</option>
                  <option value="ADMIN">Administrador</option>
                </select>
                {isSelf ? <input type="hidden" name="role" value={account.role} /> : null}
                {isSelf ? <span className="small muted">Você não pode mudar o seu próprio papel.</span> : null}
              </div>
              <div className="full row">
                <button className="btn primary" type="submit">
                  Salvar perfil
                </button>
                <span className="small muted">Usuário de login não pode ser alterado.</span>
              </div>
            </form>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Redefinir senha</div>
              <div className="card-sub">Encerra todas as sessões abertas desta conta</div>
            </div>
          </div>
          <div className="card-body">
            <form action={resetPasswordAction} className="stack">
              <input type="hidden" name="userId" value={account.id} />
              <div className="field">
                <label htmlFor="password">Nova senha</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                  placeholder="mínimo 8 caracteres"
                />
              </div>
              <div className="row">
                <button className="btn" type="submit">
                  Redefinir senha
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Servidores liberados</div>
            <div className="card-sub">
              {account.role === "ADMIN"
                ? "Administradores acessam todos os servidores, independentemente da seleção."
                : "O usuário só verá ranking, guerras e edições dos servidores marcados."}
            </div>
          </div>
          <span className="badge">{access.length} marcado(s)</span>
        </div>
        <div className="card-body">
          <form action={updateUserAccessAction}>
            <input type="hidden" name="userId" value={account.id} />
            <ServerAccessGrid servers={servers} selectedIds={access} />
            <div className="row" style={{ marginTop: 18 }}>
              <button className="btn primary" type="submit">
                Salvar acessos
              </button>
              <Link className="btn ghost" href="/users">
                Voltar
              </Link>
            </div>
          </form>

          {account.role !== "ADMIN" ? (
            <form
              action={updateUserOwnersAction}
              style={{ marginTop: 18, borderTop: "1px solid var(--border-soft)", paddingTop: 18 }}
            >
              <input type="hidden" name="userId" value={account.id} />
              <div className="field-label" style={{ marginBottom: 8 }}>
                Donos de servidor
              </div>
              <p className="small muted" style={{ marginBottom: 12 }}>
                Dono administra a diplomacia de clãs do servidor. Só vale para servidores já liberados.
              </p>
              {access.length === 0 ? (
                <p className="small muted">Marque os servidores liberados e salve antes de definir donos.</p>
              ) : (
                <>
                  <div className="access-grid">
                    {servers
                      .filter((server) => access.includes(server.id))
                      .map((server) => (
                        <label key={server.id} className="access-item check">
                          <input
                            type="checkbox"
                            name="owners"
                            value={server.id}
                            defaultChecked={owners.includes(server.id)}
                          />
                          <span>
                            <span style={{ fontWeight: 600 }}>{server.label}</span>
                            <span className="code">{server.code}</span>
                          </span>
                        </label>
                      ))}
                  </div>
                  <div className="row" style={{ marginTop: 14 }}>
                    <button className="btn" type="submit">
                      Salvar donos
                    </button>
                    <span className="small muted">{owners.length} servidor(es) com dono</span>
                  </div>
                </>
              )}
            </form>
          ) : null}
        </div>
      </section>
    </>
  );
}
