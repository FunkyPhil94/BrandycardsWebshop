/** Wie viele Stück einer Karte der Shop anbieten darf.
 *
 * **Der Fehler, den diese Datei behebt:** Katalog und Detailseite lasen die
 * Menge aus dem **eBay-Listing** und fragten `inventory` gar nicht ab. Ein
 * Verkauf im Shop bucht aber den Bestand und rührt das Listing nicht an — die
 * verkaufte Karte blieb deshalb mit „1 VERFÜGBAR" stehen, bis der eBay-Import
 * sie abräumte. Bei einem Takt von zwei Stunden hieß das: bis zu zwei Stunden
 * lang eine Karte im Schaufenster, die niemand mehr kaufen kann. Am 2026-08-08
 * am ersten echten Verkauf beobachtet.
 *
 * **Gefährlich war es nie** — `app/api/orders/route.ts` prüft den Bestand und
 * lehnt ab. Es war eine Enttäuschung an der Kasse, kein Doppelverkauf.
 *
 * Reine Funktionen, ohne Datenbank prüfbar. Verdrahtet in
 * `app/api/products/route.ts` und `app/api/products/[id]/route.ts`.
 */

export type BestandsZeile = { availableQuantity: number; status: string } | null | undefined;

/** Die Menge, die im Shop erscheinen darf.
 *
 * Drei Fälle, und die letzten beiden sind der Grund, warum das eine eigene
 * Funktion ist:
 *
 * 1. **Bestand vorhanden** → er entscheidet. `SOLD`, `RESERVED` oder
 *    `UNAVAILABLE` bedeuten null, unabhängig davon, was das Listing behauptet.
 * 2. **Keine Bestandszeile** → **die Listing-Menge gilt.** Das ist bewusst so
 *    und die wichtigste Zeile hier: Würde eine fehlende Zeile als
 *    „ausverkauft" gelten, verschwände bei einem halb geschriebenen Import der
 *    halbe Katalog. Im Zweifel anzeigen, denn die Kasse prüft ohnehin.
 * 3. **Vormerkliste (`PRELISTED`)** → hat weder Listing noch Bestand und wird
 *    hier gar nicht erst gefragt, siehe `istImKatalogSichtbar`.
 */
export function verfuegbareMenge(listingQuantity: number | null | undefined, bestand: BestandsZeile): number {
  const ausListing = Number.isFinite(listingQuantity) && (listingQuantity ?? 0) > 0 ? (listingQuantity as number) : 0;
  if (!bestand) return ausListing;
  if (bestand.status === "SOLD" || bestand.status === "UNAVAILABLE") return 0;
  const verfuegbar = Number.isFinite(bestand.availableQuantity) && bestand.availableQuantity > 0 ? bestand.availableQuantity : 0;
  // Die kleinere der beiden Zahlen: Ein Listing mit Menge 5 und einem Bestand
  // von 1 darf nicht fünfmal verkauft werden — und umgekehrt soll ein
  // beendetes Listing nichts anbieten, auch wenn der Bestand noch 1 sagt.
  return Math.min(ausListing, verfuegbar);
}

/** Ob die Karte überhaupt im Katalog erscheint.
 *
 * **`PRELISTED` ist die Ausnahme, die man leicht zerstört.** Karten der
 * Vormerkliste haben kein Listing und keinen Bestand; ein Filter auf „Menge
 * größer null" würde sie stillschweigend aus dem Katalog werfen. Sie sind kein
 * Kaufangebot, sondern eine Ankündigung, und bleiben immer sichtbar. Deshalb
 * steht ihre Prüfung **vor** allen anderen.
 *
 * **Auktionen gehören nicht in den Shop**, und das ist keine Geschmacksfrage:
 * Ihre Menge lässt sich bei eBay nicht ändern, weil sie Gebote tragen. Die
 * Rücknahme-Warteschlange überspringt sie deshalb (`lib/ebay-outbox-plan.ts`).
 * Stünde eine Auktion im Katalog, könnte der Shop sie verkaufen, während eBay
 * sie weiter anbietet — ein Doppelverkauf, den niemand mehr verhindern kann.
 * Bis zum 2026-08-08 wurden sie nur beschriftet, nicht gefiltert; aufgefallen
 * ist es nicht, weil alle 294 aktiven Angebote Festpreis sind.
 */
export function istImKatalogSichtbar(
  kind: string,
  listingType: string | null | undefined,
  listingQuantity: number | null | undefined,
  bestand: BestandsZeile,
): boolean {
  if (kind === "PRELISTED") return true;
  if (listingType === "AUCTION") return false;
  return verfuegbareMenge(listingQuantity, bestand) > 0;
}
