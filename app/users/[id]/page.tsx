import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUserById, requireAdmin, userOwnerServerIds, userServerIds } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { listServers } from "@/lib/queries";
import { formatDate } from "@/lib/time";
import { AutoSave } from "@/components/AutoSave";
import { Flash } from "@/components/ui";
import { ServerAccessGrid } from "@/components/ServerAccessGrid";
import {
  resetPasswordAction,
  toggleUserActiveAction,
  updateUserAccessAction,
  updateUserOwnersAction,
  updateUserProfileAction,
} from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("users.detailMetadata") };
}

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { locale, t } = await getT();
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
            <Link href="/users">{t("users.title")}</Link>
            <span>/</span>
            <span>{account.username}</span>
          </div>
          <h1 className="page-title">{account.display_name}</h1>
          <p className="page-sub">
            {t("users.createdAt", { username: account.username, date: formatDate(account.created_at, locale) })}
          </p>
        </div>
        <div className="head-actions">
          <span className={`badge ${account.role === "ADMIN" ? "gold" : ""}`}>
            {account.role === "ADMIN" ? t("shell.roleAdmin") : t("shell.roleOperator")}
          </span>
          <span className={`badge ${account.active ? "ok" : "err"}`}>
            {account.active ? t("users.active") : t("users.inactive")}
          </span>
          {!isSelf ? (
            <form action={toggleUserActiveAction} className="inline-form">
              <input type="hidden" name="userId" value={account.id} />
              <input type="hidden" name="active" value={account.active ? "0" : "1"} />
              <button className={`btn sm ${account.active ? "danger" : ""}`} type="submit">
                {account.active ? t("users.deactivate") : t("users.reactivate")}
              </button>
            </form>
          ) : (
            <span className="badge">{t("users.you")}</span>
          )}
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-head">
            <div className="card-title">{t("users.profileCard")}</div>
          </div>
          <div className="card-body">
            <form action={updateUserProfileAction} className="form-grid">
              <AutoSave delay={400} />
              <input type="hidden" name="userId" value={account.id} />
              <div className="field">
                <label htmlFor="displayName">{t("users.displayName")}</label>
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
                <label htmlFor="role">{t("users.role")}</label>
                <select id="role" name="role" defaultValue={account.role} disabled={isSelf}>
                  <option value="USER">{t("shell.roleOperator")}</option>
                  <option value="ADMIN">{t("shell.roleAdmin")}</option>
                </select>
                {isSelf ? <input type="hidden" name="role" value={account.role} /> : null}
                {isSelf ? <span className="small muted">{t("users.cannotChangeOwnRole")}</span> : null}
              </div>
              <div className="full row">
                <span className="small muted">{t("users.loginCannotChange")}</span>
              </div>
            </form>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("users.resetCard")}</div>
              <div className="card-sub">{t("users.resetCardSub")}</div>
            </div>
          </div>
          <div className="card-body">
            <form action={resetPasswordAction} className="stack">
              <input type="hidden" name="userId" value={account.id} />
              <div className="field">
                <label htmlFor="password">{t("users.newPassword")}</label>
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
              <div className="row">
                <button className="btn" type="submit">
                  {t("users.resetButton")}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">{t("users.grantedServers")}</div>
            <div className="card-sub">
              {account.role === "ADMIN" ? t("users.adminAllServers") : t("users.userScope")}
            </div>
          </div>
          <span className="badge">{t("users.marked", { count: access.length })}</span>
        </div>
        <div className="card-body">
          <form action={updateUserAccessAction}>
            <AutoSave delay={300} />
            <input type="hidden" name="userId" value={account.id} />
            <ServerAccessGrid servers={servers} selectedIds={access} />
            <div className="row" style={{ marginTop: 18 }}>
              <Link className="btn ghost" href="/users">
                {t("common.back")}
              </Link>
            </div>
          </form>

          {account.role !== "ADMIN" ? (
            <form
              action={updateUserOwnersAction}
              style={{ marginTop: 18, borderTop: "1px solid var(--border-soft)", paddingTop: 18 }}
            >
              <AutoSave delay={300} />
              <input type="hidden" name="userId" value={account.id} />
              <div className="field-label" style={{ marginBottom: 8 }}>
                {t("users.ownersCard")}
              </div>
              <p className="small muted" style={{ marginBottom: 12 }}>
                {t("users.ownersHint")}
              </p>
              {access.length === 0 ? (
                <p className="small muted">{t("users.ownersNeedAccess")}</p>
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
                    <span className="small muted">{t("users.ownersCount", { count: owners.length })}</span>
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
