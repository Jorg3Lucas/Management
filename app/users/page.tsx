import Link from "next/link";
import type { Metadata } from "next";
import { listUsers, requireAdmin } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { listServers } from "@/lib/queries";
import { formatDate } from "@/lib/time";
import { Flash } from "@/components/ui";
import { ServerAccessGrid } from "@/components/ServerAccessGrid";
import { createUserAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("users.metadata") };
}

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { locale, t } = await getT();
  const flash = await searchParams;
  const users = listUsers();
  const servers = listServers();
  const defaultAccess = servers.map((server) => server.id);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("nav.admin")}</p>
          <h1 className="page-title">{t("users.title")}</h1>
          <p className="page-sub">{t("users.sub")}</p>
        </div>
        <div className="head-actions">
          <span className="badge">{t("users.count", { count: users.length })}</span>
          <span className="badge ok">{t("users.activeCount", { count: users.filter((user) => user.active).length })}</span>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <details className="panel" open>
        <summary>{t("users.newUser")}</summary>
        <div className="panel-body">
          <form action={createUserAction}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="username">{t("users.username")}</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  maxLength={32}
                  required
                  placeholder={t("users.usernamePlaceholder")}
                />
              </div>
              <div className="field">
                <label htmlFor="displayName">{t("users.displayName")}</label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  maxLength={60}
                  required
                  placeholder={t("users.displayNamePlaceholder")}
                />
              </div>
              <div className="field">
                <label htmlFor="password">{t("users.initialPassword")}</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                  placeholder={t("users.passwordPlaceholder")}
                />
              </div>
              <div className="field">
                <label htmlFor="role">{t("users.role")}</label>
                <select id="role" name="role" defaultValue="USER">
                  <option value="USER">{t("users.roleUserOption")}</option>
                  <option value="ADMIN">{t("users.roleAdminOption")}</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="field-label" style={{ marginBottom: 9 }}>
                {t("users.grantedServers")}
              </div>
              <ServerAccessGrid servers={servers} selectedIds={defaultAccess} />
            </div>

            <div className="row" style={{ marginTop: 18 }}>
              <button className="btn primary" type="submit">
                {t("users.createButton")}
              </button>
              <span className="small muted">{t("users.createNote")}</span>
            </div>
          </form>
        </div>
      </details>

      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("users.colUser")}</th>
                <th>{t("users.colRole")}</th>
                <th>{t("common.status")}</th>
                <th className="num">{t("common.servers")}</th>
                <th>{t("users.colCreated")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {user.display_name} {user.id === admin.id ? <span className="badge gold">{t("users.you")}</span> : null}
                    </div>
                    <div className="player-clan mono">{user.username}</div>
                  </td>
                  <td>
                    <span className={`badge ${user.role === "ADMIN" ? "gold" : ""}`}>
                      {user.role === "ADMIN" ? t("shell.roleAdmin") : t("shell.roleOperator")}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.active ? "ok" : "err"}`}>
                      {user.active ? t("users.active") : t("users.inactive")}
                    </span>
                  </td>
                  <td className="num mono">
                    {user.role === "ADMIN" ? t("users.allServers") : user.server_count}
                    {user.role !== "ADMIN" && user.owner_count > 0 ? (
                      <div className="player-clan">{t("users.ownerOf", { count: user.owner_count })}</div>
                    ) : null}
                  </td>
                  <td className="small muted nowrap">{formatDate(user.created_at, locale)}</td>
                  <td>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <Link className="btn sm" href={`/users/${user.id}`}>
                        {t("users.manage")}
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
