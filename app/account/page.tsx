import type { Metadata } from "next";
import { ownedServerIds, requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { Flash } from "@/components/ui";
import { logoutAction } from "@/app/login/actions";
import { changePasswordAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("account.metadata") };
}

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { t } = await getT();
  const flash = await searchParams;

  const roleLabel =
    user.role === "ADMIN"
      ? t("shell.roleAdmin")
      : ownedServerIds(user).length > 0
        ? t("shell.roleOwner")
        : t("shell.roleOperator");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("account.eyebrow")}</p>
          <h1 className="page-title">{t("account.title")}</h1>
          <p className="page-sub">{t("account.sub")}</p>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <div className="grid cols-2">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("account.profile")}</div>
            </div>
          </div>
          <div className="card-body">
            <div className="stack">
              <div>
                <div className="field-label">{t("account.username")}</div>
                <div className="user-name">{user.username}</div>
              </div>
              <div>
                <div className="field-label">{t("account.role")}</div>
                <div className="user-name">{roleLabel}</div>
              </div>
              <div>
                <div className="field-label">{t("account.session")}</div>
                <div className="card-sub">{t("account.sessionSub")}</div>
                <form action={logoutAction} style={{ marginTop: 8 }}>
                  <button className="logout" type="submit">
                    {t("shell.logout")}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("account.passwordTitle")}</div>
              <div className="card-sub">{t("account.passwordSub")}</div>
            </div>
          </div>
          <div className="card-body">
            <form action={changePasswordAction} className="stack">
              <div className="field">
                <label htmlFor="currentPassword">{t("account.current")}</label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="password">{t("account.new")}</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                  placeholder={t("account.passwordPlaceholder")}
                />
              </div>
              <div className="field">
                <label htmlFor="confirmPassword">{t("account.confirm")}</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="row">
                <button className="btn primary" type="submit">
                  {t("account.submit")}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
