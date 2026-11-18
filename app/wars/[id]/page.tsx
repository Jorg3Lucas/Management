import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { accessibleServers, canManageWar, requireUser } from "@/lib/auth";
import { warTypeLabel } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { listCharacters, listServers, warGroupSessions } from "@/lib/queries";
import { formatDateTime, utcToZonedInput } from "@/lib/time";
import { Flash } from "@/components/ui";
import { WarPartyPicker, type WarPartyMember } from "@/components/WarPartyPicker";
import { deleteWarGroupAction, endWarGroupAction, updateWarAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("wars.editMetadata") };
}

export const dynamic = "force-dynamic";

export default async function EditWarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { locale, t } = await getT();
  const { id } = await params;
  const flash = await searchParams;
  const sessionId = Number(id);

  if (!Number.isInteger(sessionId) || sessionId <= 0) notFound();

  const group = warGroupSessions(sessionId);
  if (group.length === 0) notFound();

  const head = group[0];
  if (!canManageWar(user, group)) notFound();

  // A guerra pode ter acontecido em qualquer servidor do jogo.
  const optionServers = listServers();

  // O time é só dos clãs aliados; quem está fora deles entra pela busca do ranking.
  const visibleServers = accessibleServers(user);
  const roster: WarPartyMember[] =
    visibleServers.length > 0
      ? listCharacters({
          serverIds: visibleServers.map((server) => server.id),
          pageSize: 2000,
          sort: "name",
          stance: "ally",
        }).rows.map((row) => ({
          id: row.id,
          name: row.name,
          clan: row.clan,
          server_label: row.server_label,
        }))
      : [];

  // Quem já está na guerra continua listado mesmo sem servidor editável.
  for (const session of group) {
    if (!roster.some((member) => member.id === session.character_id)) {
      roster.push({
        id: session.character_id,
        name: session.character_name,
        clan: null,
        server_label: session.home_server_label,
      });
    }
  }

  const initial = group.map((session) => session.character_id);
  const open = group.some((session) => !session.ended_at);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{t("wars.eyebrow")}</p>
          <h1 className="page-title">{t("wars.editTitle")}</h1>
          <p className="page-sub">
            {head.war_server_label} · {warTypeLabel(head.war_type, locale)} ·{" "}
            {formatDateTime(head.started_at, locale)}
          </p>
        </div>
        <div className="head-actions">
          {open ? (
            <form action={endWarGroupAction} className="inline-form">
              <input type="hidden" name="sessionId" value={head.id} />
              <input type="hidden" name="redirectTo" value={`/wars/${head.id}`} />
              <button className="btn" type="submit">
                {t("wars.end")}
              </button>
            </form>
          ) : null}
          <form action={deleteWarGroupAction} className="inline-form">
            <input type="hidden" name="sessionId" value={head.id} />
            <input type="hidden" name="redirectTo" value="/wars" />
            <button className="btn danger" type="submit">
              {t("common.remove")}
            </button>
          </form>
          <Link className="btn ghost" href="/wars">
            {t("common.back")}
          </Link>
        </div>
      </div>

      <Flash ok={flash.ok} error={flash.error} />

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">{t("wars.editCardTitle")}</div>
            <div className="card-sub">{t("wars.editCardSub")}</div>
          </div>
        </div>
        <div className="card-body">
          <form action={updateWarAction} className="form-grid">
            <input type="hidden" name="sessionId" value={head.id} />
            <div className="field">
              <label htmlFor="warServerId">{t("wars.warServer")}</label>
              <select id="warServerId" name="warServerId" defaultValue={head.server_id}>
                {optionServers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.label} — {server.group_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="warType">{t("wars.colType")}</label>
              <select id="warType" name="warType" defaultValue={head.war_type}>
                <option value="server_war">{t("warType.server")}</option>
                <option value="clan_war">{t("warType.clan")}</option>
                <option value="castle_siege">{t("warType.siege")}</option>
                <option value="hidden_valley">{t("warType.valley")}</option>
                <option value="sabuk">{t("warType.sabuk")}</option>
                <option value="other">{t("warType.other")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="startedAt">{t("wars.colStart")}</label>
              <input
                id="startedAt"
                name="startedAt"
                type="datetime-local"
                defaultValue={utcToZonedInput(head.started_at)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="endedAt">{t("wars.colEnd")}</label>
              <input
                id="endedAt"
                name="endedAt"
                type="datetime-local"
                defaultValue={head.ended_at ? utcToZonedInput(head.ended_at) : ""}
              />
            </div>
            <div className="field">
              <label htmlFor="opponent">{t("player.opponent")}</label>
              <input
                id="opponent"
                name="opponent"
                type="text"
                maxLength={60}
                defaultValue={head.opponent ?? ""}
                placeholder={t("player.opponentPlaceholder")}
              />
            </div>
            <div className="field">
              <label htmlFor="notes">{t("common.notes")}</label>
              <input id="notes" name="notes" type="text" maxLength={2000} defaultValue={head.notes ?? ""} />
            </div>
            <div className="field full">
              <label>{t("wars.participants")}</label>
              <WarPartyPicker members={roster} initial={initial} />
            </div>
            <div className="full row">
              <button className="btn primary" type="submit">
                {t("wars.saveWar")}
              </button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
