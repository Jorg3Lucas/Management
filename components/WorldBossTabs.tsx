import Link from "next/link";
import { getT } from "@/lib/i18n";

type Tab = "attendance" | "distribution";

/** Abas do World Boss: presença da semana e quadro de distribuição. */
export async function WorldBossTabs({ active }: { active: Tab }) {
  const { t } = await getT();
  const tabs: { key: Tab; href: string; label: string }[] = [
    { key: "attendance", href: "/world-boss", label: t("boss.tabAttendance") },
    { key: "distribution", href: "/world-boss/distribution", label: t("boss.tabDistribution") },
  ];

  return (
    <div className="wb-tabs" role="tablist" aria-label={t("boss.tabsAria")}>
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
