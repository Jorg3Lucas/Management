"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { KeepScroll } from "./KeepScroll";

const DEFAULT_DELAY = 700;
const SAVED_VISIBLE_MS = 2200;

/** Impressão digital dos campos: evita reenviar quando nada mudou de fato. */
function signatureOf(data: FormData): string {
  const parts: string[] = [];
  for (const [key, value] of data.entries()) {
    parts.push(`${key}=${typeof value === "string" ? value : value.name}`);
  }
  return parts.sort().join("&");
}

/**
 * Liga o salvamento automático no <form> que o contém: cada alteração de campo
 * agenda o envio da própria action do formulário, depois de uma pausa curta.
 *
 * Formulários de criação/filtro e ações pontuais não devem receber este
 * componente: eles continuam com o botão próprio.
 */
export function AutoSave({ delay = DEFAULT_DELAY, enabled = true }: { delay?: number; enabled?: boolean }) {
  const { pending } = useFormStatus();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [saved, setSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      setSaved(false);
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    setSaved(true);
    const timer = window.setTimeout(() => setSaved(false), SAVED_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;

    let submitted = signatureOf(new FormData(form));
    let timer: number | null = null;

    const flush = () => {
      timer = null;
      if (!enabled) return;
      // Se o formulário marcar o envio como desabilitado (sem permissão), não vale
      // disparar a action.
      const accept = form.querySelector<HTMLButtonElement>('button[type="submit"]:not([formnovalidate])');
      if (accept?.disabled) return;
      const next = signatureOf(new FormData(form));
      if (next === submitted) return;
      submitted = next;
      // A validação fica com a action: campo vazio ou número incompleto no meio
      // da digitação não deve travar o navegador com tooltip, nem perder o save.
      const previous = form.noValidate;
      form.noValidate = true;
      form.requestSubmit();
      form.noValidate = previous;
    };

    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(flush, delay);
    };

    const onEdit = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-autosave='off']")) return;
      if (event instanceof InputEvent && event.isComposing) return;
      schedule();
    };

    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
    return () => {
      if (timer) window.clearTimeout(timer);
      form.removeEventListener("input", onEdit);
      form.removeEventListener("change", onEdit);
    };
  }, [delay, enabled]);

  const state = pending ? "busy" : saved ? "saved" : "idle";
  const label = pending ? "Salvando…" : saved ? "Salvo" : "";

  return (
    <>
      <span ref={anchorRef} hidden />
      <KeepScroll />
      {label ? (
        <span className={`autosave-status ${state}`} role="status" aria-live="polite">
          <span className="dot" />
          {label}
        </span>
      ) : null}
    </>
  );
}
