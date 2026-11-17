"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

const RESTORE_WINDOW_MS = 900;

/**
 * Mantém a posição de rolagem depois do envio do formulário que o contém.
 *
 * As actions do painel redirecionam para `?ok=`/`?error=` e o App Router volta
 * ao topo a cada salvamento. Guardamos onde a pessoa estava e devolvemos a
 * posição quando a navegação termina — a menos que ela role a página nesse
 * meio tempo.
 */
export function KeepScroll() {
  const { pending } = useFormStatus();
  const target = useRef<number | null>(null);

  useEffect(() => {
    if (pending) {
      if (target.current === null) target.current = window.scrollY;
      return;
    }

    const y = target.current;
    target.current = null;
    if (!y) return;

    let frame = 0;
    let stopped = false;
    const stop = () => {
      stopped = true;
    };

    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("keydown", stop);

    const started = performance.now();
    const restore = () => {
      if (stopped) return;
      window.scrollTo(0, y);
      if (performance.now() - started < RESTORE_WINDOW_MS) frame = requestAnimationFrame(restore);
    };
    frame = requestAnimationFrame(restore);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [pending]);

  return null;
}
