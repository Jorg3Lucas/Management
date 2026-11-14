import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canAdminServer, requireUser } from "@/lib/auth";
import { ConfirmButton } from "@/components/ConfirmButton";
import { WorldBossBoard } from "@/components/WorldBossBoard";
import { Flash, StatCard } from "@/components/ui";
import { ceWeekEnd, ceWeekStart, ceWeekTitle, shiftWeek, shortDay } from "@/lib/ce";
import { formatNumber } from "@/lib/format";
import { APP_TIMEZONE } from "@/lib/time";
import {
  worldBossAttendance,
  worldBossFights,
  worldBossMembers,
} from "@/lib/world-boss";
import { addWorldBossFightAction, deleteWorldBossFightAction } from "./actions";

export const metadata: Metadata = { title: "World Boss" };
export const dynamic = "force-dynamic";

type SearchParams = {
  server?: string;
  week?: string;
  ok?: string;
  error?: string;
};

/** Hoje (AAAA-MM-DD) no fuso da app, para o campo de data do encontro. */
function todayInApp(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function WorldBossPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canAdminServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  const currentWeek = ceWeekStart();
  const weekStart = ceWeekStart(params.week ?? currentWeek);
  const weekEnd = ceWeekEnd(weekStart);

  const fights = selected ? worldBossFights(selected.id, weekStart, weekEnd) : [];
  const members = selected ? worldBossMembers(selected.id) : [];
  const attendance = selected ? worldBossAttendance(selected.id, weekStart, weekEnd) : [];

  const initial: Record<number, number[]> = {};
  for (const fight of fights) initial[fight.id] = [];
  const memberIds = new Set(members.map((member) => member.character_id));
  const counts = new Map<number, number>();
  for (const row of attendance) {
    if (!memberIds.has(row.character_id)) continue;
    (initial[row.fight_id] ??= []).push(row.character_id);
    counts.set(row.character_id, (counts.get(row.character_id) ?? 0) + 1);
  }

  const totalMarks = Array.from(counts.values()).reduce((total, count) => total + count, 0);
  const capacity = fights.length * members.length;
  const presenceRate = capacity > 0 ? Math.round((totalMarks / capacity) * 100) : 0;
  const average = fights.length > 0 ? Math.round(totalMarks / fights.length) : 0;

  let topId: number | null = null;
  for (const [characterId, count] of counts) {
    if (topId === null || count > (counts.get(topId) ?? 0)) topId = characterId;
  }
  const top = topId === null ? null : members.find((member) => member.character_id === topId) ?? null;

  const weekHref = (week: string) => `/world-boss?server=${selected?.code ?? ""}&week=${week}`;
  const returnTo = weekHref(weekStart);
  const today = todayInApp();
  const defaultDate = today >= weekStart && today <= weekEnd ? today : weekStart;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Eventos</p>
          <h1 className="page-title">World Boss</h1>
          <p className="page-sub">
            Acompanhe a presença dos clãs aliados em cada encontro de World Boss da semana.
          </p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/world-boss?server=${server.code}&week=${weekStart}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      {managed.length === 0 ? (
        <div className="alert warn">
          Você não administra nenhum servidor. Peça ao administrador para marcar você como dono de um servidor em
          Usuários.
        </div>
      ) : null}

      {selected ? (
        <>
          <div className="row" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            <Link className="btn sm ghost" href={weekHref(shiftWeek(weekStart, -1))} aria-label="Semana anterior">
              ←
            </Link>
            <span className="badge gold">{ceWeekTitle(weekStart)}</span>
            {weekStart === currentWeek ? <span className="badge">semana atual</span> : null}
            <Link className="btn sm ghost" href={weekHref(shiftWeek(weekStart, 1))} aria-label="Próxima semana">
              →
            </Link>
            {weekStart !== currentWeek ? (
              <Link className="btn sm" href={weekHref(currentWeek)}>
                Ir para a semana atual
              </Link>
            ) : null}
          </div>

          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <StatCard
              label="Encontros na semana"
              value={formatNumber(fights.length)}
              foot={fights.length === 1 ? "1 horário registrado" : "horários registrados"}
            />
            <StatCard
              label="Presenças marcadas"
              value={formatNumber(totalMarks)}
              foot={`${presenceRate}% de ${formatNumber(capacity)} marcações possíveis`}
            />
            <StatCard
              label="Média por encontro"
              value={formatNumber(average)}
              foot="jogadores marcados por encontro"
            />
            <StatCard
              label="Mais presente"
              value={top ? top.name : "—"}
              foot={top ? `${counts.get(top.character_id) ?? 0} de ${fights.length} encontro(s)` : "sem presenças"}
            />
          </div>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">Encontros da semana</div>
                <div className="card-sub">
                  Cada encontro é único por dia e horário; as presenças ficam salvas separadamente em cada um.
                </div>
              </div>
              <span className="badge">
                {formatNumber(fights.length)} encontro(s) · {formatNumber(members.length)} membro(s) aliados
              </span>
            </div>
            <div className="card-body">
              <form action={addWorldBossFightAction} className="form-grid">
                <input type="hidden" name="serverId" value={selected.id} />
                <input type="hidden" name="redirectTo" value={returnTo} />
                <div className="field">
                  <label htmlFor="foughtOn">Data</label>
                  <input
                    id="foughtOn"
                    name="foughtOn"
                    type="date"
                    required
                    min={weekStart}
                    max={weekEnd}
                    defaultValue={defaultDate}
                  />
                </div>
                <div className="field">
                  <label htmlFor="foughtAt">Horário</label>
                  <input id="foughtAt" name="foughtAt" type="time" required defaultValue="20:00" />
                </div>
                <div className="field">
                  <label htmlFor="label">Nome (opcional)</label>
                  <input id="label" name="label" type="text" maxLength={40} placeholder="Ex.: World Boss 20h" />
                </div>
                <div className="full row">
                  <button className="btn primary" type="submit">
                    Adicionar encontro
                  </button>
                </div>
              </form>
            </div>

            <div className="card-body tight">
              {fights.length === 0 ? (
                <div className="empty">Nenhum encontro registrado nesta semana. Adicione o primeiro acima.</div>
              ) : (
                <div className="list">
                  {fights.map((fight) => (
                    <div key={fight.id} className="list-row">
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {shortDay(fight.fought_on)} às {fight.fought_at}
                          {fight.label ? <span className="badge" style={{ marginLeft: 8 }}>{fight.label}</span> : null}
                        </div>
                        <div className="small muted">
                          {formatNumber(fight.attended)} presença(s) de {formatNumber(members.length)} membro(s)
                        </div>
                      </div>
                      <form action={deleteWorldBossFightAction} className="inline-form">
                        <input type="hidden" name="fightId" value={fight.id} />
                        <input type="hidden" name="serverId" value={selected.id} />
                        <input type="hidden" name="redirectTo" value={returnTo} />
                        <ConfirmButton
                          message={`Remover o encontro de ${shortDay(fight.fought_on)} às ${fight.fought_at}? As presenças dele também serão apagadas.`}
                        >
                          Remover
                        </ConfirmButton>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {members.length === 0 ? (
            <div className="alert warn">
              Nenhum membro nos clãs aliados de {selected.label}. Marque os clãs aliados em{" "}
              <Link href="/clans">Clãs</Link> e sincronize o ranking para acompanhar a presença.
            </div>
          ) : fights.length === 0 ? (
            <div className="alert">
              Registre pelo menos um encontro na semana para começar a marcar as presenças.
            </div>
          ) : (
            <WorldBossBoard
              key={`${selected.id}-${weekStart}`}
              serverId={selected.id}
              weekStart={weekStart}
              redirectTo={returnTo}
              members={members}
              fights={fights}
              initial={initial}
            />
          )}
        </>
      ) : null}
    </>
  );
}
