import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MIR4 Ranking Ops",
    template: "%s — MIR4 Ranking Ops",
  },
  description:
    "Painel administrativo para sincronizar o ranking do fórum do MIR4, acompanhar guerras entre servidores e gerenciar acessos.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  return (
    <html lang="pt-BR">
      <body className={user ? undefined : "auth-body"}>
        {user ? <Shell user={user}>{children}</Shell> : children}
      </body>
    </html>
  );
}
