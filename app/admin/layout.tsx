import { publicPageMetadata } from "../../lib/seo";

export const metadata = publicPageMetadata({ title: "Admin", description: "Interner Administrationsbereich von BrandyCards.", path: "/admin", noIndex: true });

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
