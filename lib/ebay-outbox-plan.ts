/** Die Entscheidungen des eBay-Schreibpfads, ohne Datenbank und ohne Netz.
 *
 * `lib/ebay-outbox.ts` kann nicht geprüft werden: Es zieht über `db/index.ts`
 * das Modul `cloudflare:workers` herein, das es in Node nicht gibt. Deshalb
 * steht hier, *was* zu tun ist, und dort nur noch, *wie* es ausgeführt wird —
 * dasselbe Muster wie bei `lib/catalog-availability.ts`.
 */

/** Menge auf 0 setzen, adressiert über die ItemID (Trading API). */
export const REVISE_QUANTITY = "REVISE_QUANTITY";
/** Alt: Inventory-API-Angebot zurückziehen, adressiert über die OfferID. */
export const WITHDRAW_OFFER = "WITHDRAW_OFFER";

export type ListingZumZurueckziehen = {
  id: string;
  ebayItemId: string | null;
  ebayOfferId: string | null;
  listingType: string;
};

export type Einreihungsplan =
  | { einreihen: false; grund: "KEINE_ITEM_ID" | "AUKTION" }
  | {
      einreihen: true;
      operation: typeof REVISE_QUANTITY;
      ebayItemId: string;
      ebayOfferId: string | null;
      dedupeKey: string;
      zielmenge: 0;
    };

/** Soll dieses Listing von eBay genommen werden — und wie?
 *
 * **Adressiert wird über die ItemID, nicht über die OfferID.** `GetMyeBaySelling`
 * liefert nie eine Inventory-API-OfferID; auf ihr zu bestehen ist der Grund,
 * warum diese Warteschlange seit ihrem Bau leer blieb — jeder Aufruf stieg an
 * der fehlenden Kennung aus, und das verkaufte Angebot blieb bei eBay stehen.
 */
export function planeEbayRuecknahme(listing: ListingZumZurueckziehen): Einreihungsplan {
  if (!listing.ebayItemId) return { einreihen: false, grund: "KEINE_ITEM_ID" };

  // Bei einer Auktion ist die Menge nicht änderbar — sie hat Gebote, und eBay
  // nimmt `ReviseInventoryStatus` dafür nicht an. Eingereiht würde daraus ein
  // Auftrag, der bei jedem Versuch scheitert und am Ende auf FAILED steht,
  // ohne dass jemand ihn beheben könnte. Auktionen laufen auf eBay zu Ende.
  if (listing.listingType === "AUCTION") return { einreihen: false, grund: "AUKTION" };

  return {
    einreihen: true,
    operation: REVISE_QUANTITY,
    ebayItemId: listing.ebayItemId,
    ebayOfferId: listing.ebayOfferId,
    // Auf Listing und Zielmenge geschlüsselt: Wird dieselbe Bestellung erneut
    // abgerechnet, entsteht kein zweiter Auftrag.
    dedupeKey: `listing:${listing.id}:revise-quantity:0`,
    zielmenge: 0,
  };
}

export type Auftragsziel =
  | { aufruf: typeof REVISE_QUANTITY; ebayItemId: string; menge: 0 }
  | { aufruf: typeof WITHDRAW_OFFER; ebayOfferId: string };

/** Welcher eBay-Aufruf gehört zu diesem Auftrag?
 *
 * **Beide Operationen müssen bedient werden.** Kennt der Verarbeiter nur das
 * neue Format, scheitert eine Zeile im alten bei jedem Versuch, bis sie auf
 * FAILED steht — und niemand sieht, dass die Ursache im Verarbeiter liegt.
 */
export function bestimmeAuftragsziel(job: { operation: string; ebayItemId: string | null; ebayOfferId: string | null }): Auftragsziel {
  if (job.operation === REVISE_QUANTITY) {
    if (!job.ebayItemId) throw new Error("eBay-Outbox-Auftrag ohne ItemID.");
    return { aufruf: REVISE_QUANTITY, ebayItemId: job.ebayItemId, menge: 0 };
  }
  if (job.operation === WITHDRAW_OFFER) {
    if (!job.ebayOfferId) throw new Error("eBay-Outbox-Auftrag ohne OfferID.");
    return { aufruf: WITHDRAW_OFFER, ebayOfferId: job.ebayOfferId };
  }
  throw new Error(`Unbekannte eBay-Outbox-Operation: ${job.operation}`);
}
