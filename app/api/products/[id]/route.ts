import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { ebayListings, inventory, productAssets, products } from "../../../../db/schema";
import { istImKatalogSichtbar, verfuegbareMenge } from "../../../../lib/catalog-availability";
import { getEbayItemDescription } from "../../../../lib/ebay-client";
import { parseEbayDescription } from "../../../../lib/ebay-description";
import { enforcePublicRateLimit } from "../../../../lib/rate-limit";
import { sanitizeHtml } from "../../../../lib/sanitize-html";

/** Whether this caller may still trigger an eBay lookup right now.
 *  Running out of budget is not an error — the card is served either way. */
async function withinEbayFetchBudget(request: Request) {
  try {
    await enforcePublicRateLimit(request, "ebay-description");
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9]{32}$/iu.test(id)) {
    return NextResponse.json({ error: "Unbekannte Karte." }, { status: 404 });
  }

  try {
    const db = getDb();
    // **`leftJoin` auf das Listing, nicht `innerJoin`.** Von Hand eingestellte
    // Karten haben keine Listing-Zeile; mit `innerJoin` lieferte ihre
    // Detailseite 404, obwohl sie im Katalog steht. Die Statusprüfung des
    // Listings wandert deshalb aus der `where`-Bedingung nach unten — in der
    // `where`-Bedingung hätte sie jede manuelle Karte wieder herausgefiltert.
    const rows = await db.select({ product: products, listing: ebayListings, stock: inventory })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      // `leftJoin`: Fehlt die Bestandszeile, soll die Karte trotzdem erscheinen
      // (die Listing-Menge gilt dann), statt eine 404 zu liefern.
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(and(eq(products.id, id), eq(products.status, "ACTIVE")))
      .limit(1);

    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Diese Karte ist nicht verfügbar." }, { status: 404 });
    const manuell = row.product.origin === "MANUAL";
    // Eine eBay-Karte ohne aktives Listing steht nicht im Verkauf. Bei einer
    // manuellen Karte gibt es kein Listing, das aktiv sein könnte.
    if (!manuell && row.listing?.status !== "ACTIVE") {
      return NextResponse.json({ error: "Diese Karte ist nicht verfügbar." }, { status: 404 });
    }
    // Verkauft ist wie nicht vorhanden — dieselbe Antwort wie für eine Karte,
    // die es nie gab. Sonst stünde hier weiter „1 verfügbar" mit aktivem
    // Kaufknopf, und der Kunde liefe erst an der Kasse auf. **Auktionen fallen
    // hier ebenfalls heraus**, weil sich ihre Menge bei eBay nicht
    // zurücknehmen lässt; dieselbe Entscheidung wie im Katalog, deshalb
    // dieselbe Funktion.
    if (!istImKatalogSichtbar(row.product.kind, row.listing?.listingType, row.listing?.quantity, row.stock, row.product.origin)) {
      return NextResponse.json({ error: "Diese Karte ist nicht verfügbar." }, { status: 404 });
    }
    const menge = verfuegbareMenge(row.listing?.quantity ?? null, row.stock, row.product.origin);

    const assets = await db.select({ sourceUrl: productAssets.sourceUrl })
      .from(productAssets)
      .where(eq(productAssets.productId, id))
      .orderBy(asc(productAssets.sortOrder));

    // GetMyeBaySelling carries no description, so it is fetched from GetItem the
    // first time a card is opened and cached from then on. A failure here must
    // not take the page down — the rest of the card is still worth showing.
    //
    // The fetch sits behind its own rate limit because it is the expensive
    // half of this endpoint: two eBay calls (token + GetItem), and a listing
    // whose description eBay returns empty is never cached, so every request
    // asks again. Left open, anyone could burn the daily eBay quota from a
    // loop — and a stalled quota stalls the import, which is what keeps sold
    // cards off the shop. Exceeding the limit costs the description, not the
    // card. See docs/security-findings.md, SEC-04.
    let descriptionHtml = row.listing?.descriptionHtml ?? null;
    if (!descriptionHtml && row.listing?.ebayItemId && await withinEbayFetchBudget(request)) {
      try {
        const fetched = await getEbayItemDescription(row.listing.ebayItemId);
        if (fetched) {
          descriptionHtml = fetched;
          await db.update(ebayListings)
            .set({ descriptionHtml: fetched, updatedAt: new Date().toISOString() })
            .where(eq(ebayListings.id, row.listing.id));
        }
      } catch (error) {
        console.error("eBay description fetch failed", row.listing.ebayItemId, error);
      }
    }

    return NextResponse.json({
      id: row.product.id,
      title: row.product.title,
      description: row.product.description,
      // Seller-authored markup: never handed to the browser unsanitised. The
      // parsed form drives the shop's own layout; the sanitised HTML stays as a
      // fallback for descriptions whose structure we do not recognise.
      ...(() => {
        const safe = descriptionHtml ? sanitizeHtml(descriptionHtml) : null;
        const parsed = safe ? parseEbayDescription(safe) : null;
        const structured = parsed && (parsed.specs.length || parsed.sections.length) ? parsed : null;
        return { specs: structured?.specs ?? [], sections: structured?.sections ?? [], descriptionHtml: structured ? null : safe };
      })(),
      // Immer Festpreis: Auktionen sind oben schon mit 404 abgewiesen worden.
      category: manuell ? "Direkt bei uns" : "Festpreis",
      origin: row.product.origin,
      // Bei manuellen Karten trägt das Produkt den Preis, es gibt kein Listing.
      priceAmountCents: manuell ? row.product.priceAmountCents : row.listing?.priceAmountCents ?? null,
      priceCurrency: manuell ? row.product.priceCurrency : row.listing?.priceCurrency ?? "EUR",
      quantity: menge,
      listingUrl: row.listing?.listingUrl ?? null,
      imageUrls: assets.map((asset) => asset.sourceUrl).filter((url): url is string => Boolean(url)),
    });
  } catch (error) {
    console.error("product detail query failed", error);
    return NextResponse.json({ error: "Die Karte konnte nicht geladen werden." }, { status: 503 });
  }
}
