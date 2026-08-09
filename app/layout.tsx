import type { Metadata } from "next";
import "./globals.css";
import { GlobalLegalNav, I18nProvider } from "./i18n";

export const metadata: Metadata = {
  title: "BrandyCards — Sports Cards",
  description: "Ausgewählte Sportkarten, persönlich ausgesucht und sicher verpackt.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" suppressHydrationWarning><body><I18nProvider>{children}<GlobalLegalNav /></I18nProvider></body></html>;
}
