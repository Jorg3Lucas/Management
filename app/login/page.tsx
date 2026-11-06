import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { loginAction } from "./actions";

export const metadata: Metadata = {
  title: "Entrar — MIR4 Ranking Ops",
};

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
            Ranking, guerras e <span>poder</span> sob controle.
          </h1>
          <p className="login-copy">
            Centralize o ranking do fórum oficial, acompanhe deslocamentos de guerra entre servidores e mantenha os
            dados corrigidos à mão quando precisar.
          </p>
          <div className="login-points">
            <div className="login-point">{checkIcon} Sincronização do fórum por servidor</div>
            <div className="login-point">{checkIcon} Tempo de guerra por jogador e por servidor</div>
            <div className="login-point">{checkIcon} Acesso liberado servidor a servidor</div>
          </div>
        </div>
        <div className="login-foot">
          Ferramenta interna de gestão. Não afiliada à Wemade / MIR4.
          <br />
          Dados públicos do ranking em forum.mir4global.com.
        </div>
      </aside>

      <section className="login-form-wrap">
        <div>
          <h2>Acessar painel</h2>
          <p className="sub">Use as credenciais criadas pelo administrador.</p>
        </div>

        {error ? <div className="alert error">{error}</div> : null}

        <form className="login-form" action={loginAction}>
          <div className="field">
            <label htmlFor="username">Usuário</label>
            <input id="username" name="username" type="text" autoComplete="username" autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn primary" type="submit">
            Entrar
          </button>
        </form>

        <p className="login-hint">
          Sem acesso? Peça ao administrador para criar seu usuário e liberar os servidores que você acompanha.
        </p>
      </section>
    </div>
  );
}
