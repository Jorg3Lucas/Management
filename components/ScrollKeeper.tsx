"use client";

import { useEffect, useRef } from "react";

/** Janela em que insistimos na posição: o redirect do Next rola ao topo no meio dela. */
const RESTORE_MS = 2500;

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
    let started = 0;

    const cancel = () => {
      stopped = true;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };

    const tick = () => {
      if (stopped) return cancel();
      // Mudou de rota: a navegação manda na posição.
      if (window.location.pathname !== path) return cancel();
      if (Math.abs(window.scrollY - target) > 1) {
        // `html` tem scroll-behavior: smooth; aqui precisamos pular direto.
        window.scrollTo({ top: target, left: 0, behavior: "instant" });
      }
      if (performance.now() - started < RESTORE_MS) frame.current = requestAnimationFrame(tick);
      else frame.current = 0;
    };

    const onSubmit = () => {
      cancel();
      target = window.scrollY;
      path = window.location.pathname;
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
