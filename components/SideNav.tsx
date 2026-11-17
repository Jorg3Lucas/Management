"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";
import type { MessageKey } from "@/lib/i18n/pt";
import { useT } from "./I18nProvider";
import {
  IconArrowRight,
  IconBoss,
  IconCoins,
  IconDashboard,
  IconExpedition,
  IconFlag,
  IconGift,
  IconHistory,
  IconRanking,
  IconRefresh,
  IconServer,
  IconShield,
  IconSwords,
  IconUsers,
} from "./icons";

type NavItem = {
  href: string;
  labelKey: MessageKey;
  icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
  adminOnly: boolean;
  managerOnly: boolean;
};

const groups: { labelKey: MessageKey; items: NavItem[] }[] = [
  {
    labelKey: "nav.operation",
    items: [
      { href: "/", labelKey: "nav.dashboard", icon: IconDashboard, adminOnly: false, managerOnly: false },
      { href: "/players", labelKey: "nav.ranking", icon: IconRanking, adminOnly: false, managerOnly: false },
      { href: "/wars", labelKey: "nav.wars", icon: IconSwords, adminOnly: false, managerOnly: false },
    ],
  },
  {
    labelKey: "nav.management",
    items: [
      { href: "/clans", labelKey: "nav.clans", icon: IconShield, adminOnly: false, managerOnly: true },
      { href: "/teams", labelKey: "nav.teams", icon: IconFlag, adminOnly: false, managerOnly: true },
      { href: "/castle", labelKey: "nav.castle", icon: IconGift, adminOnly: false, managerOnly: true },
      { href: "/salaries", labelKey: "nav.salaries", icon: IconCoins, adminOnly: false, managerOnly: true },
      { href: "/ce", labelKey: "nav.ce", icon: IconExpedition, adminOnly: false, managerOnly: true },
      { href: "/world-boss", labelKey: "nav.worldBoss", icon: IconBoss, adminOnly: false, managerOnly: true },
    ],
  },
  {
    labelKey: "nav.admin",
    items: [
      { href: "/transfers", labelKey: "nav.transfers", icon: IconArrowRight, adminOnly: true, managerOnly: false },
      { href: "/servers", labelKey: "nav.servers", icon: IconServer, adminOnly: true, managerOnly: false },
      { href: "/users", labelKey: "nav.users", icon: IconUsers, adminOnly: true, managerOnly: false },
      { href: "/sync", labelKey: "nav.sync", icon: IconRefresh, adminOnly: true, managerOnly: false },
      { href: "/audit", labelKey: "nav.audit", icon: IconHistory, adminOnly: true, managerOnly: false },
    ],
  },
];

export function SideNav({ isAdmin, canManageServers }: { isAdmin: boolean; canManageServers: boolean }) {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <nav className="nav" aria-label={t("nav.label")}>
      {groups.map((group) => {
        const visible = group.items.filter(
          (item) => (!item.adminOnly || isAdmin) && (!item.managerOnly || canManageServers),
        );
        if (visible.length === 0) return null;

        return (
          <div key={group.labelKey} className="nav-group">
            <span className="nav-label">{t(group.labelKey)}</span>
            {visible.map((item) => {
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
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
