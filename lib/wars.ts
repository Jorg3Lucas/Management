import type { WarSessionRow } from "./types";

export function sessionSeconds(
  session: Pick<WarSessionRow, "started_at" | "ended_at">,
  now = Date.now(),
): number {
  const start = Date.parse(session.started_at);
  if (Number.isNaN(start)) return 0;
  const end = session.ended_at ? Date.parse(session.ended_at) : now;
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function totalWarSeconds(sessions: Pick<WarSessionRow, "started_at" | "ended_at">[], now = Date.now()): number {
  return sessions.reduce((sum, session) => sum + sessionSeconds(session, now), 0);
}

export type CharacterWarSummary = {
  totalSeconds: number;
  activeSeconds: number;
  activeCount: number;
  sessions: number;
};

export function summarizeByCharacter(
  sessions: WarSessionRow[],
  now = Date.now(),
): Map<number, CharacterWarSummary> {
  const map = new Map<number, CharacterWarSummary>();
  for (const session of sessions) {
    const current = map.get(session.character_id) ?? {
      totalSeconds: 0,
      activeSeconds: 0,
      activeCount: 0,
      sessions: 0,
    };
    const seconds = sessionSeconds(session, now);
    current.totalSeconds += seconds;
    current.sessions += 1;
    if (!session.ended_at) {
      current.activeSeconds += seconds;
      current.activeCount += 1;
    }
    map.set(session.character_id, current);
  }
  return map;
}

export function summarizeByServer(
  sessions: WarSessionRow[],
  now = Date.now(),
): Map<number, { totalSeconds: number; activeCount: number; sessions: number }> {
  const map = new Map<number, { totalSeconds: number; activeCount: number; sessions: number }>();
  for (const session of sessions) {
    const current = map.get(session.server_id) ?? { totalSeconds: 0, activeCount: 0, sessions: 0 };
    current.totalSeconds += sessionSeconds(session, now);
    current.sessions += 1;
    if (!session.ended_at) current.activeCount += 1;
    map.set(session.server_id, current);
  }
  return map;
}

export function summarizeByWarServer(
  sessions: WarSessionRow[],
  now = Date.now(),
): Map<number, { totalSeconds: number; sessions: number }> {
  const map = new Map<number, { totalSeconds: number; sessions: number }>();
  for (const session of sessions) {
    const current = map.get(session.server_id) ?? { totalSeconds: 0, sessions: 0 };
    current.totalSeconds += sessionSeconds(session, now);
    current.sessions += 1;
    map.set(session.server_id, current);
  }
  return map;
}
