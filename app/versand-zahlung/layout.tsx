import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({ title: "Versand und Zahlung", description: "Versand-, Zahlungs- und Lieferinformationen von BrandyCards.", path: "/versand-zahlung" });

export default function VersandZahlungLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
