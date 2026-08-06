import { desc, eq, and, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { ebayListings, productAssets, products } from "../../../db/schema";

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
    return NextResponse.json({ products: Array.from(byId.values()) });
  } catch (error) {
    console.error("public product query failed", error);
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 503 });
  }
}
