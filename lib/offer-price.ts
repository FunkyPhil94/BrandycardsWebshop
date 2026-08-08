/** Der Preis, den ein Kunde für eine Karte zahlt — die eine Regel dafür.
 *
 * **Ein angenommenes Angebot senkt nur.** Ist der Listenpreis inzwischen
 * darunter gefallen, gilt der niedrigere.
 *
 * Diese Regel stand bis zum 2026-08-08 nur in `app/api/orders/route.ts`. Seit
 * der Checkout den ausgehandelten Preis **anzeigt**, brauchen beide sie — und
 * zweimal geschrieben wäre sie die Stelle, an der Anzeige und Abrechnung
 * auseinanderlaufen. Der Kunde sähe dann einen anderen Betrag als den
 * abgebuchten, was schlechter wäre als gar keine Anzeige.
 *
 * **Eigene Datei, obwohl sie nur aus einer Zeile besteht:** Die Anzeige läuft
 * im Browser, und `lib/price-offers.ts` zieht Drizzle und das Datenbankschema
 * mit sich. Ein Import von dort in eine `"use client"`-Komponente packte beides
 * ins Client-Bundle.
 *
 * **Was sie ausdrücklich nicht ist:** eine Preisquelle. Der verbindliche Preis
 * entsteht ausschließlich serverseitig aus den angenommenen Angeboten des
 * Kunden; aus dem Browser wird nie ein Betrag übernommen.
 */
export function effectiveUnitPrice(listPriceCents: number, agreedCents: number | undefined) {
  return agreedCents !== undefined ? Math.min(agreedCents, listPriceCents) : listPriceCents;
}
