import Link from "next/link";
import type { ReactNode } from "react";
import { editableServerIds, isAdmin, ownedServerIds } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { logoutAction } from "@/app/login/actions";
import { getT } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SideNav } from "./SideNav";

export async function Shell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const { t } = await getT();
  const ownedServers = isAdmin(user) ? [] : ownedServerIds(user);
  // Dono ou editor de servidor também usa as ferramentas de gestão, sempre preso aos servidores dele.
  const canManageServers = isAdmin(user) || editableServerIds(user).length > 0;

  const initials = Array.from(user.displayName.trim() || user.username)[0]?.toUpperCase() ?? "?";

  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <div className="brand-mark">M4</div>
          <div className="brand-text">
            <span className="brand-title">Ranking Ops</span>
            <span className="brand-sub">MIR4 Admin</span>
          </div>
        </Link>

        <SideNav isAdmin={isAdmin(user)} canManageServers={canManageServers} />

        <div className="sidebar-foot">
          <LanguageSwitcher />
          <div className="user-box">
            <div className="avatar">{initials}</div>
            <div className="user-meta">
              <div className="user-name">{user.displayName}</div>
              <div className="user-role">
                {user.role === "ADMIN"
                  ? t("shell.roleAdmin")
                  : ownedServers.length > 0
                    ? t("shell.roleOwner")
                    : t("shell.roleOperator")}
              </div>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="logout" type="submit">
              {t("shell.logout")}
            </button>
          </form>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
