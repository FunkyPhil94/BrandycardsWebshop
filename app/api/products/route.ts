import { desc, eq, and, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { ebayListings, productAssets, products } from "../../../db/schema";

/** The catalogue changes when the eBay sync runs, not between two page views.
 *
 * Without this the endpoint answered every single request from D1: 296 cards,
 * ~1 725 rows read and 128 KB per call, with no authentication in front of it.
 * A loop could exhaust a day's D1 read allowance in minutes — and then every
 * page that needs the database answers 503, not just this one. Cloudflare now
 * serves repeats from the edge; `stale-while-revalidate` keeps the first
 * request after expiry fast instead of making it wait.
 * See docs/security-findings.md, SEC-05.
 */
export const CATALOGUE_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select({ product: products, listing: ebayListings, asset: productAssets })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(productAssets, eq(productAssets.productId, products.id))
      .where(and(eq(products.status, "ACTIVE"), or(eq(products.kind, "PRELISTED"), eq(ebayListings.status, "ACTIVE"))))
      .orderBy(desc(products.createdAt));
    const byId = new Map<string, {
      id: string; title: string; description: string | null;
      category: "Festpreis" | "Auktion" | "Vormerkliste"; priceAmountCents: number | null;
      priceCurrency: string; quantity: number; listingUrl: string | null; imageUrls: string[];
    }>();
    for (const row of rows) {
      if (!row.listing && row.product.kind !== "PRELISTED") continue;
      const current = byId.get(row.product.id) ?? {
        id: row.product.id, title: row.product.title, description: row.product.description,
        category: row.product.kind === "PRELISTED" ? "Vormerkliste" : row.listing?.listingType === "AUCTION" ? "Auktion" : "Festpreis",
        priceAmountCents: row.listing?.priceAmountCents ?? null, priceCurrency: row.listing?.priceCurrency ?? "EUR",
        quantity: row.listing?.quantity ?? 0, listingUrl: row.listing?.listingUrl ?? null, imageUrls: [],
      };
      if (row.asset?.sourceUrl) current.imageUrls.push(row.asset.sourceUrl);
      byId.set(row.product.id, current);
    }
    return NextResponse.json({ products: Array.from(byId.values()) }, { headers: { "cache-control": CATALOGUE_CACHE_CONTROL } });
  } catch (error) {
    console.error("public product query failed", error);
    // Never cache a failure — a 503 sitting at the edge for a minute would
    // turn one bad moment into a minute-long outage.
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
