import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({ title: "Impressum", description: "Impressum von BrandyCards.", path: "/impressum" });

export default function ImpressumLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
