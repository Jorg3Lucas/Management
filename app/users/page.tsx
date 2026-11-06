import Link from "next/link";
import type { Metadata } from "next";
import { listUsers, requireAdmin } from "@/lib/auth";
import { listServers } from "@/lib/queries";
import { formatDate } from "@/lib/time";
import { Flash } from "@/components/ui";
import { ServerAccessGrid } from "@/components/ServerAccessGrid";
import { createUserAction } from "./actions";

export const metadata: Metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const flash = await searchParams;
  const users = listUsers();
  const servers = listServers();
  const defaultAccess = servers.filter((server) => server.is_focus).map((server) => server.id);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administração</p>
          <h1 className="page-title">Usuários</h1>
          <p className="page-sub">
            Cada usuário vê e edita somente os servidores liberados. Administradores têm acesso a tudo.
          </p>
        </div>
        <div className="head-actions">
          <span className="badge">{users.length} conta(s)</span>
          <span className="badge ok">{users.filter((user) => user.active).length} ativa(s)</span>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <details className="panel" open>
        <summary>Novo usuário</summary>
        <div className="panel-body">
          <form action={createUserAction}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="username">Usuário</label>
                <input id="username" name="username" type="text" maxLength={32} required placeholder="ex.: operador.eu11" />
              </div>
              <div className="field">
                <label htmlFor="displayName">Nome de exibição</label>
                <input id="displayName" name="displayName" type="text" maxLength={60} required placeholder="Ex.: João" />
              </div>
              <div className="field">
                <label htmlFor="password">Senha inicial</label>
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
              <div className="field">
                <label htmlFor="role">Papel</label>
                <select id="role" name="role" defaultValue="USER">
                  <option value="USER">Operador — só servidores liberados</option>
                  <option value="ADMIN">Administrador — acesso total</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="field-label" style={{ marginBottom: 9 }}>
                Servidores liberados
              </div>
              <ServerAccessGrid servers={servers} selectedIds={defaultAccess} />
            </div>

            <div className="row" style={{ marginTop: 18 }}>
              <button className="btn primary" type="submit">
                Criar usuário
              </button>
              <span className="small muted">
                A senha pode ser trocada depois na página do usuário. Sessões duram 7 dias.
              </span>
            </div>
          </form>
        </div>
      </details>

      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Papel</th>
                <th>Status</th>
                <th className="num">Servidores</th>
                <th>Criado em</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {user.display_name}{" "}
                      {user.id === admin.id ? <span className="badge gold">você</span> : null}
                    </div>
                    <div className="player-clan mono">{user.username}</div>
                  </td>
                  <td>
                    <span className={`badge ${user.role === "ADMIN" ? "gold" : ""}`}>
                      {user.role === "ADMIN" ? "Administrador" : "Operador"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.active ? "ok" : "err"}`}>
                      {user.active ? "Ativo" : "Desativado"}
                    </span>
                  </td>
                  <td className="num mono">{user.role === "ADMIN" ? "todos" : user.server_count}</td>
                  <td className="small muted nowrap">{formatDate(user.created_at)}</td>
                  <td>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <Link className="btn sm" href={`/users/${user.id}`}>
                        Gerenciar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
