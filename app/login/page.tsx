import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { loginAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("login.metadataTitle") };
}

const checkIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/");

  const { t } = await getT();
  const params = await searchParams;
  const error = params.error;

  return (
    <div className="login-shell">
      <aside className="login-side">
        <div>
          <div className="login-brand">
            <div className="brand-mark">M4</div>
            <div className="brand-text">
              <span className="brand-title">MIR4 Ranking Ops</span>
              <span className="brand-sub">Admin console</span>
            </div>
          </div>
          <h1 className="login-title">
            {t("login.h1Before")}
            <span>{t("login.h1Power")}</span>
            {t("login.h1After")}
          </h1>
          <p className="login-copy">{t("login.copy")}</p>
          <div className="login-points">
            <div className="login-point">
              {checkIcon} {t("login.point1")}
            </div>
            <div className="login-point">
              {checkIcon} {t("login.point2")}
            </div>
            <div className="login-point">
              {checkIcon} {t("login.point3")}
            </div>
          </div>
        </div>
        <div className="login-foot">
          {t("login.foot")}
          <br />
          {t("login.footData")}
        </div>
      </aside>

      <section className="login-form-wrap">
        <div>
          <h2>{t("login.title")}</h2>
          <p className="sub">{t("login.sub")}</p>
        </div>

        <LanguageSwitcher className="inline" />

        {error ? <div className="alert error">{error}</div> : null}

        <form className="login-form" action={loginAction}>
          <div className="field">
            <label htmlFor="username">{t("login.username")}</label>
            <input id="username" name="username" type="text" autoComplete="username" autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="password">{t("login.password")}</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn primary" type="submit">
            {t("login.submit")}
          </button>
        </form>

        <p className="login-hint">{t("login.hint")}</p>
      </section>
    </div>
  );
}
