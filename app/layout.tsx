import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrandyCards — Football Collectibles",
  description: "Ausgewählte Fußball-Trading-Cards für Sammler. Persönlich ausgesucht und sicher verpackt.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
