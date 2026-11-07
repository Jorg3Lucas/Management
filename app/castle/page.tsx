import Link from "next/link";
import type { Metadata } from "next";
import { accessibleServers, canAdminServer, requireUser } from "@/lib/auth";
import { CastlePrizeBoard } from "@/components/CastlePrizeBoard";
import { Flash } from "@/components/ui";
import { castlePrizeMembers, castlePrizeUpdatedAt } from "@/lib/castle";
import {
  CASTLE_PRIZES,
  CASTLE_PRIZE_TOTAL,
  castlePrizeCounts,
  type CastlePrizeKey,
} from "@/lib/castle-prizes";
import { ceWeekStart, ceWeekTitle, shiftWeek } from "@/lib/ce";
import { formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Prêmio do castelo" };
export const dynamic = "force-dynamic";

type SearchParams = {
  server?: string;
  week?: string;
  ok?: string;
  error?: string;
};

export default async function CastlePrizePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const params = await searchParams;

  const managed = accessibleServers(user).filter((server) => canAdminServer(user, server.id));
  const requested = (params.server ?? "").toUpperCase();
  const selected = managed.find((server) => server.code === requested) ?? managed[0] ?? null;

  const currentWeek = ceWeekStart();
  const weekStart = ceWeekStart(params.week ?? currentWeek);

  const members = selected ? castlePrizeMembers(selected.id, weekStart) : [];
  const initial: Record<number, CastlePrizeKey> = {};
  for (const member of members) {
    if (member.prize) initial[member.character_id] = member.prize;
  }

  const counts = castlePrizeCounts(
    members.flatMap((member) => (member.prize ? [member.prize] : [])),
  );
  const assigned = members.reduce((total, member) => total + (member.prize ? 1 : 0), 0);
  const usedTotal = CASTLE_PRIZES.reduce((total, prize) => total + counts[prize.key], 0);
  const clanCount = new Set(members.map((member) => member.clan_id)).size;
  const updatedAt = selected ? castlePrizeUpdatedAt(selected.id, weekStart) : null;

  const weekHref = (week: string) => `/castle?server=${selected?.code ?? ""}&week=${week}`;
  const returnTo = weekHref(weekStart);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Recompensas</p>
          <h1 className="page-title">Prêmio do castelo</h1>
          <p className="page-sub">
            Distribua o baú do castelo entre os clãs aliados: 1 lendário, 3 épicos, 5 raros, 10 incomuns
            e 50 comuns por semana.
          </p>
        </div>
        <div className="head-actions">
          {managed.slice(0, 6).map((server) => (
            <Link
              key={server.id}
              className={`btn sm${selected?.id === server.id ? " primary" : " ghost"}`}
              href={`/castle?server=${server.code}&week=${weekStart}`}
            >
              {server.label}
            </Link>
          ))}
        </div>
      </div>

      <Flash ok={params.ok} error={params.error} />

      {managed.length === 0 ? (
        <div className="alert warn">
          Você não administra nenhum servidor. Peça ao administrador para marcar você como dono de um
          servidor em Usuários.
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
            {updatedAt ? (
              <span className="small muted">salvo em {formatDateTime(updatedAt)}</span>
            ) : (
              <span className="small muted">semana ainda não distribuída</span>
            )}
          </div>

          {members.length > 0 ? (
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="badge">
                {formatNumber(members.length)} membro(s) de {formatNumber(clanCount)} clã(s) aliado(s)
              </span>
              <span className="badge gold">
                {formatNumber(usedTotal)} de {formatNumber(CASTLE_PRIZE_TOTAL)} prêmio(s) usados
              </span>
              <span className="badge">{formatNumber(assigned)} membro(s) com prêmio</span>
            </div>
          ) : null}

          {members.length === 0 ? (
            <div className="alert warn">
              Nenhum membro nos clãs aliados de {selected.label}. Marque os clãs aliados em{" "}
              <Link href="/clans">Clãs</Link> e sincronize o ranking para distribuir o prêmio.
            </div>
          ) : (
            <CastlePrizeBoard
              key={`${selected.id}-${weekStart}`}
              serverId={selected.id}
              weekStart={weekStart}
              redirectTo={returnTo}
              members={members}
              initial={initial}
            />
          )}
        </>
      ) : null}
    </>
  );
}
