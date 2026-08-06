import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { ebayListings, productAssets, products } from "../../../../db/schema";
import { getEbayItemDescription } from "../../../../lib/ebay-client";
import { sanitizeHtml } from "../../../../lib/sanitize-html";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9]{32}$/iu.test(id)) {
    return NextResponse.json({ error: "Unbekannte Karte." }, { status: 404 });
  }

  try {
    const db = getDb();
    const rows = await db.select({ product: products, listing: ebayListings })
      .from(products)
      .innerJoin(ebayListings, eq(ebayListings.productId, products.id))
      .where(and(eq(products.id, id), eq(products.status, "ACTIVE"), eq(ebayListings.status, "ACTIVE")))
      .limit(1);

    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Diese Karte ist nicht verfügbar." }, { status: 404 });

    const assets = await db.select({ sourceUrl: productAssets.sourceUrl })
      .from(productAssets)
      .where(eq(productAssets.productId, id))
      .orderBy(asc(productAssets.sortOrder));

    // GetMyeBaySelling carries no description, so it is fetched from GetItem the
    // first time a card is opened and cached from then on. A failure here must
    // not take the page down — the rest of the card is still worth showing.
    let descriptionHtml = row.listing.descriptionHtml;
    if (!descriptionHtml && row.listing.ebayItemId) {
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
      // Seller-authored markup: never handed to the browser unsanitised.
      descriptionHtml: descriptionHtml ? sanitizeHtml(descriptionHtml) : null,
      category: row.listing.listingType === "AUCTION" ? "Auktion" : "Festpreis",
      priceAmountCents: row.listing.priceAmountCents,
      priceCurrency: row.listing.priceCurrency,
      quantity: row.listing.quantity,
      listingUrl: row.listing.listingUrl,
      imageUrls: assets.map((asset) => asset.sourceUrl).filter((url): url is string => Boolean(url)),
    });
  } catch (error) {
    console.error("product detail query failed", error);
    return NextResponse.json({ error: "Die Karte konnte nicht geladen werden." }, { status: 503 });
  }
}
