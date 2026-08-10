import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({ title: "Widerruf", description: "Widerrufsbelehrung von BrandyCards.", path: "/widerruf" });

export default function WiderrufLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
