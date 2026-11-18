import Link from "next/link";
import { getT } from "@/lib/i18n";

type Tab = "chests" | "resources";

/** Abas do castelo: baú mensal e recursos (darksteel e gold). */
export async function CastleTabs({ active }: { active: Tab }) {
  const { t } = await getT();
  const tabs: { key: Tab; href: string; label: string }[] = [
    { key: "chests", href: "/castle", label: t("castle.tabChests") },
    { key: "resources", href: "/castle/resources", label: t("castle.tabResources") },
  ];

  return (
    <div className="wb-tabs" role="tablist" aria-label={t("castle.tabsAria")}>
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={tab.key === active}
          className={`wb-tab${tab.key === active ? " active" : ""}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
