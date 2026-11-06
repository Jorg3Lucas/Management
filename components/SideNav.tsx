"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconArrowRight,
  IconDashboard,
  IconFlag,
  IconHistory,
  IconRanking,
  IconRefresh,
  IconServer,
  IconShield,
  IconSwords,
  IconUsers,
} from "./icons";

const items = [
  { href: "/", label: "Visão geral", icon: IconDashboard, adminOnly: false, managerOnly: false },
  { href: "/players", label: "Ranking", icon: IconRanking, adminOnly: false, managerOnly: false },
  { href: "/players/home", label: "Servidor casa", icon: IconUsers, adminOnly: false, managerOnly: true },
  { href: "/wars", label: "Guerras", icon: IconSwords, adminOnly: false, managerOnly: false },
  { href: "/clans", label: "Clãs", icon: IconShield, adminOnly: false, managerOnly: true },
  { href: "/teams", label: "Times", icon: IconFlag, adminOnly: false, managerOnly: true },
  { href: "/transfers", label: "Transferências", icon: IconArrowRight, adminOnly: true, managerOnly: false },
  { href: "/servers", label: "Servidores", icon: IconServer, adminOnly: true, managerOnly: false },
  { href: "/users", label: "Usuários", icon: IconUsers, adminOnly: true, managerOnly: false },
  { href: "/sync", label: "Sincronização", icon: IconRefresh, adminOnly: true, managerOnly: false },
  { href: "/audit", label: "Auditoria", icon: IconHistory, adminOnly: true, managerOnly: false },
];

export function SideNav({ isAdmin, canManageClans }: { isAdmin: boolean; canManageClans: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Navegação principal">
      <span className="nav-label">Operação</span>
      {items
        .filter((item) => (!item.adminOnly || isAdmin) && (!item.managerOnly || canManageClans))
        .map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/players"
                ? /^\/players\/\d+(\/|$)/.test(pathname) || pathname === "/players"
                : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`nav-link${active ? " active" : ""}`}>
              <Icon />
              <span>{item.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
