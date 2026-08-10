import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({ title: "Datenschutz", description: "Datenschutzerklärung von BrandyCards.", path: "/datenschutz" });

export default function DatenschutzLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
