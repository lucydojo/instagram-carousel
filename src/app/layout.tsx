import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Dojogram",
  description: "AI-powered Instagram carousel maker"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
