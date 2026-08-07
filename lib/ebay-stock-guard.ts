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
  try {
    const cards = await orderCardsForStockCheck(db, orderId);
    const ids = cards.map((card) => card.ebayItemId).filter((id): id is string => Boolean(id));
    if (!ids.length) return null;
    const gone = unavailableTitles(cards, await getEbayAvailability(ids));
    if (!gone.length) return null;
    console.warn("[ebay-stock-guard] Karte bei eBay nicht mehr verfügbar", { orderId, titles: gone });
    return soldOutMessage(gone);
  } catch (error) {
    // Auch ein Fehler in der Prüfung selbst darf nichts blockieren. Sie ist
    // eine zusätzliche Sicherung, keine Voraussetzung.
    console.error("[ebay-stock-guard] Bestandsprüfung fehlgeschlagen, Bestellung wird durchgelassen", orderId, error instanceof Error ? error.message : error);
    return null;
  }
}
