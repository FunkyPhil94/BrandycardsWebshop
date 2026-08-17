import { publicPageMetadata } from "../../lib/seo";
import { AccountShell } from "./account-shell";

export const metadata = publicPageMetadata({ title: "Konto", description: "Dein BrandyCards-Konto und deine Bestellungen.", path: "/account", noIndex: true });

/** Server-Layout wegen `metadata`; die Hülle selbst braucht den Browser für die
 *  Supabase-Sitzung und ist deshalb eine eigene Client-Komponente. */
export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AccountShell>{children}</AccountShell>;
}
