"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "./admin-auth";

type Seite = { pfad: string; tag: number; woche: number; monat: number };

type Aufrufe = {
  erfasstSeit: string | null;
  fenster: Record<"tag" | "woche" | "monat", { titel: string; gesamt: number }>;
  seiten: Seite[];
};

/** Klartext für die Pfadmuster aus `lib/page-views.ts`. */
const SEITENNAME: Record<string, string> = {
  "/": "Startseite",
  "/karten": "Katalog",
  "/karten/[id]": "Kartendetails",
  "/vorverkauf": "Vorverkauf",
  "/verkaufen": "Karten verkaufen",
  "/anfragen": "Anfragen",
  "/checkout": "Kasse",
  "/checkout/paypal/success": "Kasse — Zahlung erfolgreich",
  "/checkout/paypal/cancel": "Kasse — Zahlung abgebrochen",
  "/account": "Kundenkonto",
  "/agb": "AGB",
  "/datenschutz": "Datenschutz",
  "/impressum": "Impressum",
  "/widerruf": "Widerruf",
  "/versand-zahlung": "Versand und Zahlung",
  "/ueber-uns": "Über uns",
  "/sonstiges": "Sonstiges",
};

const ZAHL = new Intl.NumberFormat("de-DE");

/** Seit wann überhaupt gemessen wird — als „vor n Tagen", weil das die Frage
 *  beantwortet, um die es geht: Ist der 30-Tage-Wert schon einer? */
function erfassungstext(erfasstSeit: string | null) {
  if (!erfasstSeit) return "Es wurde noch kein Aufruf erfasst.";
  const beginn = new Date(erfasstSeit);
  if (Number.isNaN(beginn.getTime())) return "";
  const tage = Math.floor((Date.now() - beginn.getTime()) / 86_400_000);
  const datum = beginn.toLocaleDateString("de-DE", { dateStyle: "short" });
  if (tage >= 30) return `Erfassung läuft seit dem ${datum}. Alle drei Zeiträume sind vollständig.`;
  // Der wichtigste Satz auf der ganzen Kachel: Solange die Messung jünger als
  // der Zeitraum ist, ist „letzte 30 Tage" keine Monatszahl, sondern schlicht
  // alles, was es gibt. Ohne diesen Hinweis läse sich der Aufbau der Messung
  // wie ein einbrechender Shop.
  return `Erfassung läuft erst seit dem ${datum} (${tage} Tag${tage === 1 ? "" : "e"}). Die Zeiträume ab ${tage < 7 ? "7" : "30"} Tagen sind noch nicht vollständig.`;
}

/** Die Aufrufzahlen des eigenen Shops.
 *
 * **Nicht die eBay-Zahlen.** Aufrufe der Angebote *auf eBay* stehen in
 * `ebay_listing_traffic` und kommen von dort; hier steht, was im Shop selbst
 * passiert. Der Adminbereich zählt sich selbst nicht mit.
 */
export function ViewsPanel() {
  const [aufrufe, setAufrufe] = useState<Aufrufe | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/page-views", { headers: await authHeaders() });
        const data = await response.json() as Partial<Aufrufe> & { error?: string };
        if (!response.ok || !data.fenster) throw new Error(data.error ?? "Die Aufrufzahlen konnten nicht geladen werden.");
        if (!cancelled) setAufrufe({ erfasstSeit: data.erfasstSeit ?? null, fenster: data.fenster, seiten: data.seiten ?? [] });
      } catch (error) {
        if (!cancelled) setNote(error instanceof Error ? error.message : "Die Aufrufzahlen konnten nicht geladen werden.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (note) return <section className="admin-section"><h2>Aufrufe</h2><p className="form-feedback error" role="status">{note}</p></section>;
  if (!aufrufe) return null;

  return <section className="admin-section">
    <h2>Aufrufe im Shop</h2>
    <div className="admin-stats admin-views-stats">
      {(["tag", "woche", "monat"] as const).map((fenster) => <div key={fenster}>
        <strong>{ZAHL.format(aufrufe.fenster[fenster].gesamt)}</strong>
        <span>{aufrufe.fenster[fenster].titel}</span>
      </div>)}
    </div>
    <p className="admin-views-note">{erfassungstext(aufrufe.erfasstSeit)}</p>
    {aufrufe.seiten.length > 0 && <>
      <p className="admin-subheading">Nach Seitenbereich, letzte 30 Tage</p>
      <table className="admin-views-table">
        <thead><tr><th scope="col">Bereich</th><th scope="col">24 Std.</th><th scope="col">7 Tage</th><th scope="col">30 Tage</th></tr></thead>
        <tbody>
          {aufrufe.seiten.map((seite) => <tr key={seite.pfad}>
            <th scope="row">{SEITENNAME[seite.pfad] ?? seite.pfad}</th>
            <td>{ZAHL.format(seite.tag)}</td>
            <td>{ZAHL.format(seite.woche)}</td>
            <td>{ZAHL.format(seite.monat)}</td>
          </tr>)}
        </tbody>
      </table>
    </>}
    {/* Eine Erwartung geraderücken, bevor sie entsteht: Der Zähler misst den
        Shop. Wer wissen will, wie oft eine Karte bei eBay angesehen wurde,
        findet das nicht hier. */}
    <p className="admin-views-note">Gezählt werden Seitenaufrufe im Shop — ohne den Adminbereich, ohne Suchmaschinen und ohne Cookies oder Kennungen. Aufrufe der Angebote bei eBay sind etwas anderes und werden getrennt von dort abgeholt.</p>
  </section>;
}
