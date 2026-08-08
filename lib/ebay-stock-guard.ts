import type { getDb } from "../db";
import { getEbayAvailability } from "./ebay-client";
import { soldOutMessage, unavailableTitles } from "./ebay-stock-check";
import { orderCardsForStockCheck } from "./paypal/settle-order";

/** Fragt eBay, ob die Karten einer Bestellung dort noch zu haben sind.
 *
 * Beide Zahlungsrouten benutzen dieselbe Funktion, damit die Prüfung an der
 * freundlichen Stelle (vor dem Gang zu PayPal) und an der wirksamen Stelle
 * (unmittelbar vor dem Einzug) nicht auseinanderlaufen kann.
 *
 * Gibt `null` zurück, wenn nichts dagegenspricht — auch dann, wenn eBay gar
 * nicht antwortet. Ein eBay-Ausfall darf den Verkauf nicht anhalten; siehe
 * docs/ai-todo.md, Punkt 3.
 */
export async function ebaySoldOutMessage(db: ReturnType<typeof getDb>, orderId: string): Promise<string | null> {
  return (await ebayBestandspruefung(db, orderId)).meldung;
}

/** Wie `ebaySoldOutMessage`, sagt aber zusätzlich, **ob überhaupt geprüft
 *  wurde**.
 *
 * Der Unterschied ist der Punkt: Ein `null` bedeutete bisher zweierlei — „bei
 * eBay ist alles da" und „ich konnte nicht nachsehen". Für den Verkauf ist das
 * dasselbe (beides lässt durch, und das soll so bleiben), für den **Verkäufer**
 * aber nicht: Im zweiten Fall packt er ein Paket, ohne dass jemand geprüft hat,
 * ob die Karte noch existiert. Diese Unterscheidung landet in der
 * Verkäufernachricht.
 */
export async function ebayBestandspruefung(
  db: ReturnType<typeof getDb>,
  orderId: string,
): Promise<{ meldung: string | null; status: "OK" | "FEHLGESCHLAGEN" }> {
  try {
    const cards = await orderCardsForStockCheck(db, orderId);
    const ids = cards.map((card) => card.ebayItemId).filter((id): id is string => Boolean(id));
    // Keine eBay-Kennungen: nichts zu prüfen, und das ist kein Ausfall.
    if (!ids.length) return { meldung: null, status: "OK" };
    const gone = unavailableTitles(cards, await getEbayAvailability(ids));
    if (!gone.length) return { meldung: null, status: "OK" };
    console.warn("[ebay-stock-guard] Karte bei eBay nicht mehr verfügbar", { orderId, titles: gone });
    return { meldung: soldOutMessage(gone), status: "OK" };
  } catch (error) {
    // Auch ein Fehler in der Prüfung selbst darf nichts blockieren. Sie ist
    // eine zusätzliche Sicherung, keine Voraussetzung.
    console.error("[ebay-stock-guard] Bestandsprüfung fehlgeschlagen, Bestellung wird durchgelassen", orderId, error instanceof Error ? error.message : error);
    return { meldung: null, status: "FEHLGESCHLAGEN" };
  }
}
