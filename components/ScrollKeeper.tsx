"use client";

import { useEffect, useRef } from "react";

/** Enquanto a action não responde, insistimos na posição por até este tempo. */
const ACTION_MS = 12_000;
/** Depois do redirect (a URL muda com `?ok=`/`?error=`), só o tempo de vencer o scroll-to-top. */
const SETTLE_MS = 1500;
/** Restauração depois de um carregamento completo: o layout ainda pode crescer. */
const LOAD_MS = 2000;
/** Depois disso a posição guardada é velha demais para voltar sozinha. */
const STORE_TTL_MS = 15_000;
const STORE_KEY = "mir4:scroll-return";

type Saved = { y: number; path: string; at: number };

function readSaved(): Saved | null {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    if (typeof saved?.y !== "number" || typeof saved?.path !== "string") return null;
    if (typeof saved.at !== "number" || Date.now() - saved.at > STORE_TTL_MS) return null;
    return saved;
  } catch {
    return null;
  }
}

function clearSaved() {
  try {
    window.sessionStorage.removeItem(STORE_KEY);
  } catch {
    // sessionStorage indisponível: nada a limpar.
  }
}

function keepSaved(y: number, path: string) {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ y, path, at: Date.now() } satisfies Saved));
  } catch {
    // sessionStorage indisponível (modo privado antigo): segue sem restaurar.
  }
}

/**
 * As server actions do painel salvam e redirecionam para `?ok=`/`?error=`, e o
 * App Router volta a página para o topo a cada redirect — quem está no meio de
 * uma tabela perde a posição a cada edição. O mesmo acontece em duas outras
 * navegações:
 *
 *  - filtros que só trocam a querystring (chips, semana, clã), via <Link>;
 *  - formulários `method="get"`, que recarregam a página inteira.
 *
 * Guardamos a rolagem no envio do formulário/clique e devolvemos a posição
 * durante o salvamento e a navegação que vem depois dele. Se a pessoa rolar ou
 * digitar, a posição dela vale mais. Trocar de página (rota diferente) continua
 * indo ao topo normalmente.
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
    let deadline = ACTION_MS;

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
      const restoring = settledAt < 0 ? now - started < deadline : now - settledAt < SETTLE_MS;
      if (!restoring) return cancel();

      if (Math.abs(window.scrollY - target) > 1) {
        // `html` tem scroll-behavior: smooth; aqui precisamos pular direto.
        window.scrollTo({ top: target, left: 0, behavior: "instant" });
      }
      frame.current = requestAnimationFrame(tick);
    };

    const hold = (y: number, maxMs = ACTION_MS) => {
      cancel();
      if (y < 1) return;
      target = y;
      path = window.location.pathname;
      href = window.location.href;
      settledAt = -1;
      deadline = maxMs;
      started = performance.now();
      stopped = false;
      frame.current = requestAnimationFrame(tick);
    };

    // Arrastar a barra de rolagem não dispara wheel/touchmove: qualquer posição
    // diferente da que impusemos significa que a pessoa assumiu o controle —
    // exceto quando o conteúdo encolheu e o navegador prendeu a rolagem no fim.
    const onScroll = () => {
      if (stopped) return;
      const delta = window.scrollY - target;
      if (Math.abs(delta) <= 2) return;
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= target - 2;
      if (delta < 0 && !reachable) return;
      cancel();
    };

    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.target) return;
      const y = window.scrollY;
      if (y < 1) return;
      // Server Action: o React cuida do envio e o redirect chega logo depois.
      // `form.method` não serve para separar: sem atributo ele também é "get".
      const method = (form.getAttribute("method") ?? "").toLowerCase();
      if (method !== "get" || form.querySelector('input[name^="$ACTION"]')) {
        hold(y);
        return;
      }
      // Navegação completa: a posição só sobrevive via sessionStorage.
      const action = new URL(form.getAttribute("action") || window.location.href, window.location.href);
      keepSaved(y, action.pathname);
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Outra rota: começar do topo é o esperado.
      if (url.pathname !== window.location.pathname) return;
      // Âncora interna e link que não muda nada: não são navegação.
      if (url.hash || url.href === window.location.href) return;
      const y = window.scrollY;
      if (y < 1) return;
      // Cobre também <a> sem Link, que recarrega a página inteira.
      keepSaved(y, url.pathname);
      hold(y);
    };

    // Depois de um carregamento completo a posição guardada é retomada aqui.
    const saved = readSaved();
    if (saved && saved.path === window.location.pathname) {
      clearSaved();
      hold(saved.y, LOAD_MS);
    }

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    // Só gestos de rolagem cancelam: clicar em caixas/linhas continua valendo.
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchmove", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancel();
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchmove", cancel);
      window.removeEventListener("keydown", cancel);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
