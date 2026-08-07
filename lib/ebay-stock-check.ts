/** Letzte Bestandsprüfung gegen eBay, bevor Geld fließt.
 *
 * Jede Karte ist ein Einzelstück und steht gleichzeitig hier und auf eBay.
 * Wird sie dort verkauft, erfährt der Shop es erst beim nächsten Import — und
 * verkauft sie bis dahin weiter. Der Import läuft alle zehn Minuten; diese
 * Prüfung schließt die verbleibende Lücke an der einzigen Stelle, an der es
 * wirklich zählt: unmittelbar bevor der Kunde zahlt.
 *
 * **Die Leitregel steht in docs/ai-todo.md, Punkt 3: Ist eBay nicht
 * erreichbar, darf die Bestellung nicht blockiert werden.** Ein eBay-Ausfall
 * legt sonst den Shop lahm — und das wäre ein größerer Schaden als der
 * seltene Doppelverkauf, den diese Prüfung verhindert. Sie ist eine
 * zusätzliche Sicherung, keine Voraussetzung.
 *
 * Frei von Datenbank- und Netzimporten, damit die Entscheidung ohne beides
 * prüfbar ist.
 */

export type CardStock = {
  title: string;
  ebayItemId: string | null;
  /** Wie viele Stück die Bestellung von dieser Karte will. */
  quantity: number;
};

export type EbayStockAnswer = { quantityAvailable: number | null; listingStatus: string | null };

/** Die Karten einer Bestellung, die eBay nachweislich nicht mehr hergibt.
 *
 * Nachweislich heißt: eBay hat geantwortet **und** die Antwort sagt, dass zu
 * wenige Stück übrig sind oder das Angebot beendet ist. Alles andere —
 * fehlende Antwort, unbekannte Menge, Karte ohne eBay-Bezug — gilt als
 * unbekannt und lässt den Kauf durch.
 */
export function unavailableTitles(cards: CardStock[], answers: Map<string, EbayStockAnswer>): string[] {
  const gone: string[] = [];
  for (const card of cards) {
    if (!card.ebayItemId) continue;
    const answer = answers.get(card.ebayItemId);
    // Keine Antwort: eBay war nicht erreichbar oder kennt die ItemID nicht.
    if (!answer) continue;
    if (answer.listingStatus && answer.listingStatus.toUpperCase() !== "ACTIVE") {
      gone.push(card.title);
      continue;
    }
    // Unbekannte Menge blockiert nicht.
    if (answer.quantityAvailable === null || !Number.isFinite(answer.quantityAvailable)) continue;
    if (answer.quantityAvailable < card.quantity) gone.push(card.title);
  }
  return gone;
}

/** Die Meldung, die der Kunde zu sehen bekommt.
 *
 * Sie nennt die Karte beim Namen — „ein Artikel ist nicht mehr verfügbar"
 * lässt jemanden mit fünf Karten im Warenkorb ratlos zurück.
 */
export function soldOutMessage(titles: string[]) {
  if (titles.length === 1) {
    return `Diese Karte wurde uns gerade auf eBay weggekauft: „${titles[0]}". Deine Zahlung wurde nicht ausgeführt und die Reservierung ist aufgehoben.`;
  }
  return `Diese Karten wurden uns gerade auf eBay weggekauft: ${titles.map((title) => `„${title}"`).join(", ")}. Deine Zahlung wurde nicht ausgeführt und die Reservierung ist aufgehoben.`;
}
