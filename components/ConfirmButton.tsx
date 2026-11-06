"use client";

import type { ReactNode } from "react";

export function ConfirmButton({
  className = "btn sm danger",
  message,
  children,
}: {
  className?: string;
  message: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
