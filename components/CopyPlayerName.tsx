"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "./I18nProvider";

/** Usado quando o navegador não libera a Clipboard API (http, permissão negada). */
function legacyCopy(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

/**
 * Nome do jogador que copia ao clique, para colar no jogo sem abrir a ficha.
 * O atalho ao lado mantém o acesso ao perfil do jogador.
 */
export function CopyPlayerName({ name, href }: { name: string; href?: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(name);
    } catch {
      legacyCopy(name);
    }
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <span className="copy-name">
      <button
        type="button"
        className="player-name copy-name-btn"
        onClick={copy}
        title={t("common.copyName")}
        aria-label={t("common.copyName")}
      >
        {name}
      </button>
      {copied ? (
        <span className="badge ok copy-name-flag" role="status" aria-live="polite">
          {t("common.copied")}
        </span>
      ) : null}
      {href ? (
        <Link
          className="copy-name-link"
          href={href}
          title={t("common.openPlayer")}
          aria-label={t("common.openPlayer")}
        >
          ↗
        </Link>
      ) : null}
    </span>
  );
}
