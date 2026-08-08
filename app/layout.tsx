import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrandyCards — Sports Cards",
  description: "Ausgewählte Sportkarten, persönlich ausgesucht und sicher verpackt.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}<nav className="legal-nav" aria-label="Rechtliche Informationen"><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><a href="/agb">AGB</a><a href="/widerruf">Widerruf</a><a href="/versand-zahlung">Versand &amp; Zahlung</a></nav></body></html>;
}
