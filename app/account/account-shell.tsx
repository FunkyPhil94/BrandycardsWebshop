"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { useI18n } from "../i18n";
import { isLocale } from "../../lib/i18n";

/** Die Bereiche des Kundenkontos.
 *
 * `/account` bleibt der Einstieg und trägt weiterhin Anmeldung, Registrierung
 * und Passwort-Reset — wer abgemeldet ist, landet dort, egal welche Unterseite
 * er aufgerufen hat.
 */
const BEREICHE = [
  { pfad: "/account", titel: "Übersicht" },
  { pfad: "/account/bestellungen", titel: "Bestellungen" },
  { pfad: "/account/profil", titel: "Profil" },
  { pfad: "/account/daten", titel: "Meine Daten" },
] as const;

type KontoSitzung = {
  user: User | null;
  /** Erst wenn Supabase geantwortet hat. Vorher steht **nicht** fest, dass
   *  niemand angemeldet ist — genau diese Verwechslung hat am 2026-08-17 auf der
   *  Kartenseite den Anmeldekasten für einen angemeldeten Kunden erzeugt. */
  bereit: boolean;
  token: () => Promise<string>;
  abmelden: () => Promise<void>;
  /** Nach dem Anmelden oder Abmelden erneut nachfragen. */
  aktualisieren: () => void;
};

const SitzungContext = createContext<KontoSitzung | null>(null);

export function useKontoSitzung() {
  const sitzung = useContext(SitzungContext);
  if (!sitzung) throw new Error("useKontoSitzung braucht die AccountShell");
  return sitzung;
}

export function AccountShell({ children }: { children: React.ReactNode }) {
  const { t, setLocale } = useI18n();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [bereit, setBereit] = useState(false);
  const [zaehler, setZaehler] = useState(0);

  const token = useCallback(async () => {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    const zugriff = data.session?.access_token;
    if (!zugriff) throw new Error(t("Bitte melde dich erneut an."));
    return zugriff;
  }, [t]);

  const abmelden = useCallback(async () => {
    await getSupabaseBrowserClient().auth.signOut();
  }, []);

  /** Legt die Kontozeile an bzw. hält sie aktuell und übernimmt die im Konto
   *  hinterlegte Sprache. Lief vorher in `app/account/page.tsx` und gilt jetzt
   *  für alle Unterseiten — sonst hinge sie daran, welche Seite man zuerst
   *  aufruft. */
  const profilAbgleichen = useCallback(async (sitzungsUser: User | null, zugriff?: string) => {
    if (!sitzungsUser || !zugriff) return;
    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${zugriff}`, "Content-Type": "application/json" },
        body: JSON.stringify({ username: sitzungsUser.user_metadata?.username, displayName: sitzungsUser.user_metadata?.displayName }),
      });
      if (!response.ok) return;
      const body = await response.json() as { preferredLocale?: unknown };
      if (isLocale(body.preferredLocale)) setLocale(body.preferredLocale);
    } catch {
      // Ohne Abgleich funktioniert das Konto weiter; er ist eine Angleichung,
      // keine Voraussetzung.
    }
  }, [setLocale]);

  useEffect(() => {
    let abgebrochen = false;
    let abbestellen: (() => void) | undefined;
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (abgebrochen) return;
        setUser(data.session?.user ?? null);
        setBereit(true);
        void profilAbgleichen(data.session?.user ?? null, data.session?.access_token);
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
          if (abgebrochen) return;
          setUser(session?.user ?? null);
          setBereit(true);
          void profilAbgleichen(session?.user ?? null, session?.access_token);
        });
        abbestellen = () => listener.subscription.unsubscribe();
      } catch {
        // Ohne Supabase-Konfiguration bleibt es beim abgemeldeten Zustand — aber
        // „bereit" muss trotzdem gesetzt werden, sonst wartet jede Unterseite
        // für immer auf eine Antwort, die nie kommt.
        if (!abgebrochen) setBereit(true);
      }
    })();
    return () => { abgebrochen = true; abbestellen?.(); };
  }, [profilAbgleichen, zaehler]);

  const sitzung: KontoSitzung = { user, bereit, token, abmelden, aktualisieren: () => setZaehler((wert) => wert + 1) };

  return <main>
    <SiteHeader />
    <section className="account-page">
      <Link className="back-link" href="/">{t("← Zurück zum Shop")}</Link>
      <section className="account-card">
        <p className="eyebrow">{t("BRANDYCARDS ACCOUNT")}</p>
        {user && <>
          <div className="account-session">
            <span>{t("Angemeldet als")}</span><strong>{user.email}</strong>
            <button type="button" onClick={() => void abmelden()}>{t("Abmelden")}</button>
          </div>
          <nav className="section-nav" aria-label={t("Bereiche deines Kontos")}>
            {BEREICHE.map((bereich) => <Link
              key={bereich.pfad}
              href={bereich.pfad}
              className={pathname === bereich.pfad ? "is-active" : undefined}
              aria-current={pathname === bereich.pfad ? "page" : undefined}
            >{t(bereich.titel)}</Link>)}
          </nav>
        </>}
        <SitzungContext.Provider value={sitzung}>{children}</SitzungContext.Provider>
      </section>
    </section>
    <SiteFooter />
  </main>;
}

/** Für die Unterseiten: Solange Supabase noch antwortet, nichts behaupten —
 *  danach entweder der Inhalt oder der Weg zur Anmeldung. */
export function NurAngemeldet({ children }: { children: React.ReactNode }) {
  const { user, bereit } = useKontoSitzung();
  const { t } = useI18n();
  if (!bereit) return null;
  if (!user) {
    return <>
      <h1>{t("Bitte melde dich an.")}</h1>
      <p>{t("Diese Seite gehört zu deinem Konto. Melde dich an, um sie zu sehen.")}</p>
      <Link className="button button-primary" href="/account">{t("Zur Anmeldung")} <span>→</span></Link>
    </>;
  }
  return <>{children}</>;
}
