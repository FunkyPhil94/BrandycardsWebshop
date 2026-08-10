import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({ title: "Konto", description: "Dein BrandyCards-Konto und deine Bestellungen.", path: "/account", noIndex: true });

export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
