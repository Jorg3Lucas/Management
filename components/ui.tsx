import type { ReactNode } from "react";
import { classifyStatus } from "@/lib/format";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return <div className={`alert ${error ? "error" : "ok"}`}>{error || ok}</div>;
}

export function StatCard({
  label,
  value,
  foot,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {foot ? <div className="stat-foot">{foot}</div> : null}
    </div>
  );
}

export function SyncBadge({ status }: { status: string | null }) {
  const kind = classifyStatus(status);
  const label =
    status === "success" ? "Sincronizado" : status === "empty" ? "Sem dados" : status === "error" ? "Falhou" : "Nunca sincronizado";
  return (
    <span className={`badge ${kind === "ok" ? "ok" : kind === "warn" ? "warn" : kind === "error" ? "err" : ""}`}>
      <span className={`dot ${kind === "ok" ? "ok" : kind === "warn" ? "warn" : kind === "error" ? "err" : ""}`} />
      {label}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Initials({ name }: { name: string }) {
  const letters = Array.from(name.trim()).slice(0, 2).join("").toUpperCase();
  return <span>{letters || "?"}</span>;
}
