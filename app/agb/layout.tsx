import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({ title: "AGB", description: "Allgemeine Geschäftsbedingungen von BrandyCards.", path: "/agb" });

export default function AgbLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
