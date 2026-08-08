/** Entscheidet, ob ein Schreibvorgang des eBay-Imports etwas bewirken würde.
 *
 * Der Import schrieb bis zum 2026-08-08 bei **jedem** Lauf alles neu: 294
 * Listings, 294 Produkte, alle Bilder gelöscht und wieder eingefügt, dazu je
 * ein `sync_events`-Eintrag — zusammen ~5 396 Zeilen, gemessen mit
 * `wrangler d1 insights`. Geändert hatte sich dabei fast nie etwas; die Läufe
 * meldeten Tag für Tag „294 aktualisiert, 0 importiert, 0 deaktiviert".
 *
 * **Der Vergleich fragt nicht, was sich geändert haben könnte.** Er stellt das
 * gegenüber, was geschrieben würde, und das, was schon dasteht. Sind sie
 * gleich, entfällt die Anweisung — ein übersprungener Schreibvorgang hätte
 * nichts bewirkt. Damit ist die Ersparnis verhaltenserhaltend per
 * Konstruktion und hängt nicht daran, ob jemand ein Feld übersehen hat.
 *
 * Reine Funktionen ohne Netz und ohne Datenbank, damit sie prüfbar bleiben.
 * Verdrahtet werden sie in `lib/ebay-sync.ts` — dieselbe Trennung wie
 * `lib/ebay-stock-check.ts` gegen `lib/ebay-stock-guard.ts`.
 */

/** Felder, die bei jedem Lauf anders aussehen und deshalb nie ein Grund zum
 *  Schreiben sind.
 *
 *  `lastSyncedAt` und `updatedAt` tragen die aktuelle Uhrzeit. Nähme der
 *  Vergleich sie auf, wäre er wertlos: Jedes Listing gälte immer als geändert,
 *  und der Lauf schriebe wieder alles. Sie werden mitgeschrieben, wenn ohnehin
 *  geschrieben wird — nur lösen sie es nicht aus.
 */
const ZEITSTEMPEL_FELDER = new Set(["createdAt", "lastSyncedAt", "updatedAt"]);

function gleich(gespeichert: unknown, gewuenscht: unknown) {
  if (gespeichert === gewuenscht) return true;
  // Ab hier ist einer von beiden ein Objekt, `null` oder ein anderer Typ.
  // `null` gegen irgendetwas anderes ist ein echter Unterschied.
  if (gespeichert === null || gewuenscht === null) return false;
  if (typeof gespeichert === "object" && typeof gewuenscht === "object") {
    // Betrifft nur `rawData`. Der Vergleich über die Zeichenkette trägt, weil
    // `lib/ebay-client.ts` das Objekt bei jedem Lauf in derselben Form baut
    // (`source`, `marketplaceId`, `itemId`) und der gespeicherte Wert aus
    // genau dieser Form entstanden ist. Wäre die Reihenfolge je verschieden,
    // wird einmal zu viel geschrieben — nie zu wenig.
    return JSON.stringify(gespeichert) === JSON.stringify(gewuenscht);
  }
  return false;
}

/** Wahr, wenn jedes Feld, das geschrieben würde, schon genau so dasteht.
 *
 * Verglichen wird ausschließlich, was `gewuenscht` mitbringt. Das ist Absicht
 * und deckt sich mit dem, was Drizzle tut:
 *
 * - **`undefined` wird übersprungen**, weil Drizzle solche Felder beim `UPDATE`
 *   aus der `SET`-Liste weglässt. Konkret betrifft das `descriptionHtml`: Der
 *   Import kennt keine Beschreibung (`GetMyeBaySelling` liefert keine), und in
 *   der Spalte liegt der Zwischenspeicher, den
 *   `app/api/products/[id]/route.ts` beim ersten Öffnen einer Karte füllt.
 *   Würde der Vergleich das Feld aufnehmen, sähe er einen Unterschied, den es
 *   nicht gibt — und der Schreibvorgang danach überschriebe den
 *   Zwischenspeicher mit `NULL`.
 * - **Spalten, die niemand schreibt, kommen nicht vor** und können deshalb
 *   auch nichts auslösen (`shippingData`, `quantitySold`, `conditionId`).
 *
 * Fehlt die gespeicherte Zeile ganz, ist die Antwort `false` — dann wird
 * eingefügt.
 */
export function stehtSchonSo(
  gespeichert: Record<string, unknown> | undefined | null,
  gewuenscht: Record<string, unknown>,
) {
  if (!gespeichert) return false;
  for (const [feld, wert] of Object.entries(gewuenscht)) {
    if (wert === undefined) continue;
    if (ZEITSTEMPEL_FELDER.has(feld)) continue;
    if (!gleich(gespeichert[feld], wert)) return false;
  }
  return true;
}

/** Wahr, wenn dieselben Bilder in derselben Reihenfolge schon hinterlegt sind.
 *
 * Der Import löschte bisher **alle** Bilder eines Produkts und fügte sie
 * unverändert wieder ein — allein ~18 000 geschriebene Zeilen in 24 Stunden,
 * die teuerste Einzelposition nach den `sync_events`. Die Reihenfolge zählt
 * mit, weil sie als `sortOrder` gespeichert
 * wird und die Anzeige sie benutzt; vertauschte Bilder sind eine echte
 * Änderung.
 */
export function bilderStehenSchonSo(
  gespeichert: readonly (string | null)[],
  gewuenscht: readonly string[],
) {
  return gespeichert.length === gewuenscht.length
    && gespeichert.every((sourceUrl, index) => sourceUrl === gewuenscht[index]);
}
