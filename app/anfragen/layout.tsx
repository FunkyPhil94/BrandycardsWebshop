import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({
  title: "Karte anfragen",
  description: "Du suchst eine bestimmte Sportkarte? Schreib uns – auch ohne Kundenkonto.",
  path: "/anfragen",
});

export default function AnfragenLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
