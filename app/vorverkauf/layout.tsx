import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({
  title: "Vorverkauf",
  description: "Karten vor dem eBay-Listing entdecken und einen eigenen Preis vorschlagen.",
  path: "/vorverkauf",
});

export default function VorverkaufLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
