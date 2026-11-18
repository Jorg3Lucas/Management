"use client";

import { useEffect, useRef } from "react";

/** Enquanto a action não responde, insistimos na posição por até este tempo. */
const ACTION_MS = 12_000;
/** Depois do redirect (a URL muda com `?ok=`/`?error=`), só o tempo de vencer o scroll-to-top. */
const SETTLE_MS = 1500;

/**
 * As server actions do painel salvam e redirecionam para `?ok=`/`?error=`, e o
 * App Router volta a página para o topo a cada redirect — quem está no meio de
 * uma tabela perde a posição a cada edição.
 *
 * Guardamos a rolagem no envio do formulário e devolvemos a posição durante o
 * salvamento e a navegação que vem depois dele. Se a pessoa rolar ou digitar,
 * a posição dela vale mais. Trocar de página (rota diferente) continua indo ao
 * topo normalmente.
 */
export function ScrollKeeper() {
  const frame = useRef(0);

  useEffect(() => {
    let stopped = true;
    let target = 0;
    let path = "";
    let href = "";
    let started = 0;
    let settledAt = -1;

    const cancel = () => {
      stopped = true;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };

    const tick = () => {
      if (stopped) return cancel();
      // Mudou de rota: a navegação manda na posição.
      if (window.location.pathname !== path) return cancel();

      const now = performance.now();
      // A action terminou quando o redirect muda a URL; a partir daí só falta
      // vencer o scroll-to-top do Next.
      if (window.location.href !== href) {
        href = window.location.href;
        settledAt = now;
      }
      const restoring = settledAt < 0 ? now - started < ACTION_MS : now - settledAt < SETTLE_MS;
      if (!restoring) return cancel();

      if (Math.abs(window.scrollY - target) > 1) {
        // `html` tem scroll-behavior: smooth; aqui precisamos pular direto.
        window.scrollTo({ top: target, left: 0, behavior: "instant" });
      }
      frame.current = requestAnimationFrame(tick);
    };

    const onSubmit = () => {
      cancel();
      target = window.scrollY;
      path = window.location.pathname;
      href = window.location.href;
      settledAt = -1;
      if (target < 1) return;
      started = performance.now();
      stopped = false;
      frame.current = requestAnimationFrame(tick);
    };

    document.addEventListener("submit", onSubmit, true);
    // Só gestos de rolagem cancelam: clicar em caixas/linhas continua valendo.
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchmove", cancel, { passive: true });
    window.addEventListener("keydown", cancel);

    return () => {
      cancel();
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchmove", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, []);

  return null;
}
