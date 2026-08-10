import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({ title: "Checkout", description: "Sicher zum Abschluss deiner BrandyCards-Bestellung.", path: "/checkout", noIndex: true });

export default function CheckoutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
