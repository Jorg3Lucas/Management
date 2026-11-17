"use client";

import type { ReactNode } from "react";

/**
 * Envia o formulário marcando o campo oculto `clear=1`.
 *
 * Fica como `type="button"` de propósito: se fosse um submit, viraria o botão
 * padrão do formulário e o Enter no campo de valor limparia o lançamento.
 */
export function ClearValueButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="btn sm ghost"
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (!form) return;
        const input = form.querySelector<HTMLInputElement>('input[name="clear"]');
        if (input) input.value = "1";
        form.requestSubmit();
      }}
    >
      {children}
    </button>
  );
}
