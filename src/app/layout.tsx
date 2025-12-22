import "./globals.css";
import type { ReactNode } from "react";
import { getHtmlLang, getLocale } from "@/lib/i18n/locale";

export const metadata = {
  title: "Dojogram",
  description: "AI-powered Instagram carousel maker"
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={getHtmlLang(locale)}>
      <body>{children}</body>
    </html>
  );
}
