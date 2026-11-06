export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startDailySyncScheduler } = await import("./lib/scheduler");
  startDailySyncScheduler();
}
