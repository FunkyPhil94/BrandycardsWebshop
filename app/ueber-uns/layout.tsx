import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({
  title: "Über BrandyCards",
  description: "Zwei Brüder aus Leverkusen, eine Sammlung und viel Liebe zu Sportkarten.",
  path: "/ueber-uns",
});

export default function UeberUnsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
