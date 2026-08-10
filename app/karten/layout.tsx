import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({
  title: "Karten",
  description: "Sportkarten für Sammler: geprüft, sicher verpackt und mit Preisvorschlag auf jeder Karte.",
  path: "/karten",
});

export default function KartenLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
