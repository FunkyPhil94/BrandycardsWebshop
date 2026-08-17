import { publicPageMetadata } from "../../lib/seo";
import { AdminShell } from "./admin-shell";

export const metadata = publicPageMetadata({ title: "Admin", description: "Interner Administrationsbereich von BrandyCards.", path: "/admin", noIndex: true });

/** Server-Layout, damit `metadata` hier stehen kann — die Hülle selbst braucht
 *  den Browser (Supabase-Sitzung, MFA-Prüfung) und ist deshalb eine eigene
 *  Client-Komponente. Beides in einer Datei geht nicht. */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
