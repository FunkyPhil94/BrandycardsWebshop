"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { authHeaders } from "./admin-auth";
import { MfaPanel } from "./mfa-panel";

/** Die Bereiche der Adminkonsole.
 *
 * Bis zum 2026-08-17 lag alles auf einer Seite: sieben Panels untereinander und
 * **acht Abfragen bei jedem Laden**, auch wenn man nur eine Bestellung ansehen
 * wollte. Jetzt lädt jeder Bereich nur seine eigenen Daten.
 *
 * Die Reihenfolge folgt dem Arbeitsalltag, nicht der Technik: Was täglich
 * ansteht, kommt zuerst; Wartung und Verbindungen stehen hinten.
 */
const BEREICHE = [
  { pfad: "/admin", titel: "Übersicht" },
  { pfad: "/admin/bestellungen", titel: "Bestellungen" },
  { pfad: "/admin/preisvorschlaege", titel: "Preisvorschläge" },
  { pfad: "/admin/ankauf", titel: "Ankauf" },
  { pfad: "/admin/karten", titel: "Karten" },
  { pfad: "/admin/ebay", titel: "eBay" },
  { pfad: "/admin/system", titel: "System" },
] as const;

type AdminSitzung = { email: string; mfaAktiv: boolean };

const SitzungContext = createContext<AdminSitzung | null>(null);

/** Wer angemeldet ist und ob die Zwei-Faktor-Bestätigung steht.
 *
 * Kommt aus der Hülle, damit nicht jede Unterseite dieselbe Abfrage erneut
 * stellt. `null` kann hier nicht herauskommen: Die Hülle rendert ihre Kinder
 * erst, wenn die Sitzung geprüft ist.
 */
export function useAdminSitzung() {
  const sitzung = useContext(SitzungContext);
  if (!sitzung) throw new Error("useAdminSitzung braucht die AdminShell");
  return sitzung;
}

/**
 * **Die MFA-Sperre steht hier und nur hier.**
 *
 * Vorher lag sie in `app/admin/page.tsx`. Mit sieben Unterseiten müsste sie
 * siebenmal dastehen — und die siebte wird vergessen. Ein Layout ist die
 * einzige Stelle, an der das nicht passieren kann: Wer eine Unterseite direkt
 * aufruft, kommt hier vorbei, ohne Ausnahme.
 *
 * Das schützt die Oberfläche, nicht die Daten. Jede Adminroute prüft weiterhin
 * selbst (`lib/admin-access.ts`) — ein Aufruf ohne bestätigte Anmeldung bekommt
 * dort 401 oder 428, unabhängig davon, was der Browser anzeigt.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [zustand, setZustand] = useState<"laedt" | "gesperrt" | "offen" | "fehler">("laedt");
  const [meldung, setMeldung] = useState("Lade Administrationsbereich …");
  const [email, setEmail] = useState("");

  const pruefen = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const [mfa, dashboard] = await Promise.all([
        fetch("/api/admin/mfa/status", { headers }),
        fetch("/api/admin/dashboard", { headers }),
      ]);
      const status = await mfa.json() as { error?: string; currentLevel?: string };
      if (!mfa.ok) throw new Error(status.error ?? "Zugriff verweigert.");
      if (status.currentLevel !== "aal2") { setZustand("gesperrt"); return; }
      // Die Übersicht braucht die Kennzahlen ohnehin; hier fällt allein die
      // E-Mail-Adresse für die Kopfzeile an. Ein eigener Endpunkt dafür wäre
      // eine Abfrage mehr für eine Zeile Text.
      const body = await dashboard.json() as { user?: { email?: string } };
      setEmail(body.user?.email ?? "");
      setZustand("offen");
    } catch (error) {
      setMeldung(error instanceof Error ? error.message : "Zugriff verweigert.");
      setZustand("fehler");
    }
  }, []);

  useEffect(() => { void (async () => { await pruefen(); })(); }, [pruefen]);

  return <main>
    <SiteHeader />
    <section className="account-page">
      <Link className="back-link" href="/">← Zurück zum Shop</Link>
      {zustand === "gesperrt"
        ? <MfaPanel onVerified={() => void pruefen()} />
        : <section className="account-card admin-card">
            <p className="eyebrow">BRANDYCARDS ADMIN</p>
            {zustand === "laedt" && <p className="form-feedback" role="status">{meldung}</p>}
            {zustand === "fehler" && <p className="form-feedback error" role="status">{meldung}</p>}
            {zustand === "offen" && <>
              <nav className="section-nav" aria-label="Bereiche der Adminkonsole">
                {BEREICHE.map((bereich) => <Link
                  key={bereich.pfad}
                  href={bereich.pfad}
                  className={pathname === bereich.pfad ? "is-active" : undefined}
                  aria-current={pathname === bereich.pfad ? "page" : undefined}
                >{bereich.titel}</Link>)}
              </nav>
              <p className="admin-session">Angemeldet als <strong>{email}</strong> · <span className="admin-session-mfa">MFA bestätigt (AAL2)</span></p>
              <SitzungContext.Provider value={{ email, mfaAktiv: true }}>{children}</SitzungContext.Provider>
            </>}
          </section>}
    </section>
    <SiteFooter />
  </main>;
}
