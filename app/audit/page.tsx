import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { recentAudit } from "@/lib/audit";
import { getT } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatDateTime } from "@/lib/time";
import { EmptyState, Flash } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("audit.metadata") };
}

export const dynamic = "force-dynamic";

const ACTION_KEYS: Record<string, MessageKey> = {
  "clan.stance": "audit.action.clan.stance",
  "clan.merge": "audit.action.clan.merge",
  "team.create": "audit.action.team.create",
  "team.update": "audit.action.team.update",
  "team.delete": "audit.action.team.delete",
  "team.clan": "audit.action.team.clan",
  "team.character": "audit.action.team.character",
  "player.home": "audit.action.player.home",
  "transfer.confirm": "audit.action.transfer.confirm",
  "transfer.reject": "audit.action.transfer.reject",
  "character.create": "audit.action.character.create",
  "character.update": "audit.action.character.update",
  "user.create": "audit.action.user.create",
  "user.profile": "audit.action.user.profile",
  "user.access": "audit.action.user.access",
  "user.owners": "audit.action.user.owners",
  "user.password": "audit.action.user.password",
  "user.active": "audit.action.user.active",
  "server.flag": "audit.action.server.flag",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { locale, t } = await getT();
  const flash = await searchParams;
  const entries = recentAudit(150);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("nav.admin")}</p>
          <h1 className="page-title">{t("audit.title")}</h1>
          <p className="page-sub">{t("audit.sub")}</p>
        </div>
        <div className="head-actions">
          <span className="badge">{t("audit.count", { count: entries.length })}</span>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <div className="card">
        <div className="table-wrap">
          {entries.length === 0 ? (
            <EmptyState title={t("audit.empty")}>{t("audit.emptyBody")}</EmptyState>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>{t("audit.colWhen")}</th>
                  <th>{t("audit.colWho")}</th>
                  <th>{t("audit.colAction")}</th>
                  <th>{t("common.server")}</th>
                  <th>{t("audit.colDetail")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const key = ACTION_KEYS[entry.action];
                  return (
                    <tr key={entry.id}>
                      <td className="small muted nowrap">{formatDateTime(entry.created_at, locale)}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{entry.actor ?? t("audit.system")}</span>
                        <div className="player-clan">
                          {entry.entity}
                          {entry.entity_id ? ` #${entry.entity_id}` : ""}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${entry.action.startsWith("clan.") ? "gold" : ""}`}>
                          {key ? t(key) : entry.action}
                        </span>
                      </td>
                      <td className="small muted">{entry.server_label ?? "—"}</td>
                      <td className="small muted" style={{ maxWidth: 380 }}>
                        {entry.detail ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
