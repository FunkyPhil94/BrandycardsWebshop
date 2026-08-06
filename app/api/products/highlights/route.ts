import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { ebayListings, productAssets, products } from "../../../../db/schema";

export const GALLERY_SIZE = 5;

type Highlight = {
  id: string;
  title: string;
  description: string | null;
  category: "Festpreis" | "Auktion";
  priceAmountCents: number | null;
  priceCurrency: string;
  quantity: number;
  listingUrl: string | null;
  imageUrl: string | null;
  startAt: string | null;
};

/** One image per card is enough for the gallery; the storefront joins the rest. */
const firstImage = sql<string | null>`(
  SELECT a.source_url FROM ${productAssets} a
  WHERE a.product_id = ${products.id} AND a.source_url IS NOT NULL
  ORDER BY a.sort_order LIMIT 1
)`;

function select() {
  return getDb().select({
    id: products.id,
    title: products.title,
    description: products.description,
    listingType: ebayListings.listingType,
    priceAmountCents: ebayListings.priceAmountCents,
    priceCurrency: ebayListings.priceCurrency,
    quantity: ebayListings.quantity,
    listingUrl: ebayListings.listingUrl,
    startAt: ebayListings.startAt,
    imageUrl: firstImage,
  }).from(products).innerJoin(ebayListings, eq(ebayListings.productId, products.id));
}

type Row = Awaited<ReturnType<ReturnType<typeof select>["execute"]>>[number];

function toHighlight(row: Row): Highlight {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.listingType === "AUCTION" ? "Auktion" : "Festpreis",
    priceAmountCents: row.priceAmountCents,
    priceCurrency: row.priceCurrency,
    quantity: row.quantity,
    listingUrl: row.listingUrl,
    imageUrl: row.imageUrl,
    startAt: row.startAt,
  };
}

const live = and(eq(products.status, "ACTIVE"), eq(ebayListings.status, "ACTIVE"));

export async function GET() {
  try {
    // "Neueste" needs the real eBay listing date. It is only populated from the
    // sync that runs after this deploy, so fall back to the import order while
    // start_at is still empty rather than showing an arbitrary five.
    const [newest, priciest] = await Promise.all([
      select().where(and(live, isNotNull(ebayListings.startAt)))
        .orderBy(desc(ebayListings.startAt)).limit(GALLERY_SIZE),
      select().where(live)
        .orderBy(desc(ebayListings.priceAmountCents)).limit(GALLERY_SIZE),
    ]);
    const newestRows = newest.length
      ? newest
      : await select().where(live).orderBy(desc(products.createdAt)).limit(GALLERY_SIZE);

    return NextResponse.json({
      newest: newestRows.map(toHighlight),
      priciest: priciest.map(toHighlight),
      startAtAvailable: newest.length > 0,
    });
  } catch (error) {
    console.error("product highlights query failed", error);
    return NextResponse.json({ error: "Karten konnten nicht geladen werden." }, { status: 503 });
  }
}
