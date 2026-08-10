import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({
  title: "Karten verkaufen",
  description: "Biete uns deine Sportkarten an, nenne deinen Wunschpreis und sende bis zu fünf Bilder.",
  path: "/verkaufen",
});

export default function VerkaufenLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
