export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatPower(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatHours(totalSeconds: number): string {
  return `${(totalSeconds / 3600).toFixed(1)}h`;
}

export function classifyStatus(status: string | null): "ok" | "warn" | "error" | "muted" {
  if (status === "success") return "ok";
  if (status === "empty") return "warn";
  if (status === "error") return "error";
  return "muted";
}

export const WAR_TYPES: Record<string, string> = {
  server_war: "Guerra de servidor",
  clan_war: "Guerra de clã",
  castle_siege: "Cerco ao castelo",
  hidden_valley: "Vale Escondido",
  sabuk: "Sabuk Clash",
  other: "Outra",
};

export function warTypeLabel(type: string): string {
  return WAR_TYPES[type] ?? type;
}
