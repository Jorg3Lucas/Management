import type { ReactNode } from "react";
import { classifyStatus } from "@/lib/format";
import { getLocale } from "@/lib/i18n";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { translateMessage } from "@/lib/i18n/messages";
import { translate } from "@/lib/i18n/translate";

/** Aviso de retorno das server actions — a mensagem chega em pt e é traduzida aqui. */
export async function Flash({ ok, error }: { ok?: string; error?: string }) {
  const message = error || ok;
  if (!message) return null;
  const locale = await getLocale();
  return (
    <div className={`alert ${error ? "error" : "ok"}`}>{translateMessage(locale, message)}</div>
  );
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

export function SyncBadge({ status, locale = DEFAULT_LOCALE }: { status: string | null; locale?: Locale }) {
  const kind = classifyStatus(status);
  const label =
    status === "success"
      ? translate(locale, "syncBadge.success")
      : status === "empty"
        ? translate(locale, "syncBadge.empty")
        : status === "error"
          ? translate(locale, "syncBadge.error")
          : translate(locale, "syncBadge.never");
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

/**
 * Texto traduzido com marcação mínima (`<code>`, `<strong>`) que existe em
 * algumas frases longas — os dicionários são nossos, então não há HTML externo.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(<code>[\s\S]*?<\/code>|<strong>[\s\S]*?<\/strong>)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("<code>")) return <code key={index}>{part.slice(6, -7)}</code>;
        if (part.startsWith("<strong>")) return <strong key={index}>{part.slice(8, -9)}</strong>;
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

export function Initials({ name }: { name: string }) {
  const letters = Array.from(name.trim()).slice(0, 2).join("").toUpperCase();
  return <span>{letters || "?"}</span>;
}
