import { queryOne } from "./db";
import { syncAllServers } from "./sync";

/** O horário pedido é sempre o de Brasília, independente do fuso do servidor. */
const TIMEZONE = "America/Sao_Paulo";
/** Se o processo subir depois das 17h e a rodada do dia não aconteceu, roda dentro desta janela. */
const CATCH_UP_WINDOW_MS = 6 * 60 * 60 * 1000;

type SchedulerState = {
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  started: boolean;
};

const globalForScheduler = globalThis as unknown as { __mir4SyncScheduler?: SchedulerState };

function state(): SchedulerState {
  globalForScheduler.__mir4SyncScheduler ??= { timer: null, running: false, started: false };
  return globalForScheduler.__mir4SyncScheduler;
}

function dailyHour(): number {
  const raw = Number(process.env.SYNC_DAILY_HOUR ?? 17);
  if (!Number.isFinite(raw)) return 17;
  return Math.min(Math.max(Math.floor(raw), 0), 23);
}

function schedulerEnabled(): boolean {
  const raw = (process.env.SYNC_DAILY_ENABLED ?? "1").trim().toLowerCase();
  return !["0", "false", "off", "no"].includes(raw);
}

type ZoneParts = { year: number; month: number; day: number };

function partsInZone(date: Date): ZoneParts & { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: pick("year"), month: pick("month"), day: pick("day"), hour: pick("hour"), minute: pick("minute") };
}

/** Offset (local - UTC) em ms para o instante informado. */
function zoneOffsetMs(date: Date): number {
  const parts = partsInZone(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

/** Converte "ano/mês/dia às hour:00 em Brasília" para o instante UTC correspondente. */
function zonedToUtc(year: number, month: number, day: number, hour: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour, 0, 0);
  const firstPass = new Date(guess - zoneOffsetMs(new Date(guess)));
  return new Date(guess - zoneOffsetMs(firstPass));
}

/** Próxima ocorrência de `hour` (horário de Brasília) depois de `now`. */
export function nextDailyRunAt(now: Date = new Date(), hour: number = dailyHour()): Date {
  const today = partsInZone(now);
  const todayTarget = zonedToUtc(today.year, today.month, today.day, hour);
  if (todayTarget.getTime() > now.getTime()) return todayTarget;

  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day) + 86_400_000);
  return zonedToUtc(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), hour);
}

/** Rodada de hoje já passou (dentro da janela) e nada foi registrado ainda? */
function pendingCatchUp(now: Date = new Date(), hour: number = dailyHour()): boolean {
  const today = partsInZone(now);
  const todayTarget = zonedToUtc(today.year, today.month, today.day, hour);
  const elapsed = now.getTime() - todayTarget.getTime();
  if (elapsed < 0 || elapsed > CATCH_UP_WINDOW_MS) return false;

  const row = queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM sync_runs WHERE source = 'agendado' AND started_at >= ?",
    todayTarget.toISOString(),
  );
  return (row?.total ?? 0) === 0;
}

function scheduleNext(): void {
  const scheduler = state();
  if (scheduler.timer) {
    clearTimeout(scheduler.timer);
    scheduler.timer = null;
  }

  const now = new Date();
  const target = nextDailyRunAt(now);
  const timer = setTimeout(() => {
    void runDailySync("agenda diária");
  }, Math.max(1_000, target.getTime() - now.getTime()));

  scheduler.timer = timer;
  timer.unref?.();

  console.log(
    `[sync] próxima rodada diária: ${target.toISOString()} (${dailyHour()}h em ${TIMEZONE}) — todos os servidores.`,
  );
}

async function runDailySync(reason: string): Promise<void> {
  const scheduler = state();
  if (scheduler.running) return;
  scheduler.running = true;

  const startedAt = Date.now();
  try {
    console.log(`[sync] rodada diária iniciada (${reason}) em ${new Date(startedAt).toISOString()}.`);
    const results = await syncAllServers("agendado");
    const ok = results.filter((result) => result.status === "success").length;
    const empty = results.filter((result) => result.status === "empty").length;
    const failed = results.filter((result) => result.status === "error").length;
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(
      `[sync] rodada diária concluída em ${seconds}s: ${results.length} servidores, ${ok} ok, ${empty} vazios, ${failed} com erro.`,
    );
    if (failed > 0) {
      console.warn(
        `[sync] servidores com erro: ${results
          .filter((result) => result.status === "error")
          .map((result) => result.serverCode)
          .join(", ")}`,
      );
    }
  } catch (error) {
    console.error("[sync] falha na rodada diária:", error);
  } finally {
    scheduler.running = false;
    scheduleNext();
  }
}

/**
 * Agenda a sincronização diária de todos os servidores no horário de Brasília.
 * Chamado uma única vez pelo `instrumentation.ts` no boot do servidor.
 */
export function startDailySyncScheduler(): void {
  const scheduler = state();
  if (scheduler.started) return;
  scheduler.started = true;

  if (!schedulerEnabled()) {
    console.log("[sync] agendador diário desativado (SYNC_DAILY_ENABLED).");
    return;
  }

  try {
    if (pendingCatchUp()) {
      console.log("[sync] a rodada diária de hoje já passou e não foi executada — rodando agora.");
      void runDailySync("recuperação");
      return;
    }
  } catch (error) {
    console.error("[sync] não foi possível verificar a rodada diária de hoje:", error);
  }

  scheduleNext();
}
