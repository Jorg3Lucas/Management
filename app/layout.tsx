import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { I18nProvider } from "@/components/I18nProvider";
import { getT, htmlLang } from "@/lib/i18n";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060811",
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: {
      default: "MIR4 Ranking Ops",
      template: "%s — MIR4 Ranking Ops",
    },
    description: t("app.description"),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  const { locale } = await getT();

  return (
    <html lang={htmlLang(locale)}>
      <body className={user ? undefined : "auth-body"}>
        <I18nProvider locale={locale}>{user ? <Shell user={user}>{children}</Shell> : children}</I18nProvider>
      </body>
    </html>
  );
}
