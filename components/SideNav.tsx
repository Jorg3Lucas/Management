"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconRanking,
  IconRefresh,
  IconServer,
  IconSwords,
  IconUsers,
} from "./icons";

const items = [
  { href: "/", label: "Visão geral", icon: IconDashboard, adminOnly: false },
  { href: "/players", label: "Ranking", icon: IconRanking, adminOnly: false },
  { href: "/wars", label: "Guerras", icon: IconSwords, adminOnly: false },
  { href: "/servers", label: "Servidores", icon: IconServer, adminOnly: true },
  { href: "/users", label: "Usuários", icon: IconUsers, adminOnly: true },
  { href: "/sync", label: "Sincronização", icon: IconRefresh, adminOnly: true },
];

export function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Navegação principal">
      <span className="nav-label">Operação</span>
      {items
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
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
