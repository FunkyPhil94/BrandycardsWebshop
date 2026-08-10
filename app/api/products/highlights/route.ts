import { and, desc, eq, isNotNull, ne, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { ebayListings, inventory, productAssets, products } from "../../../../db/schema";
import { istImKatalogSichtbar, verfuegbareMenge } from "../../../../lib/catalog-availability";
import { CATALOGUE_CACHE_CONTROL } from "../route";

export const GALLERY_SIZE = 5;

type Highlight = {
  id: string;
  title: string;
  description: string | null;
  category: "Festpreis" | "Auktion" | "Direkt bei uns";
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
    kind: products.kind,
    origin: products.origin,
    title: products.title,
    description: products.description,
    productCreatedAt: products.createdAt,
    listingType: ebayListings.listingType,
    priceAmountCents: sql<number | null>`coalesce(${ebayListings.priceAmountCents}, ${products.priceAmountCents})`,
    priceCurrency: sql<string>`coalesce(${ebayListings.priceCurrency}, ${products.priceCurrency})`,
    quantity: ebayListings.quantity,
    stock: inventory,
    listingUrl: ebayListings.listingUrl,
    startAt: ebayListings.startAt,
    imageUrl: firstImage,
  }).from(products)
    // Manual pre-sale cards have no eBay listing. An inner join here silently
    // removed exactly the cards N7 is meant to put in the shop's highlights.
    .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id));
}

type Row = Awaited<ReturnType<ReturnType<typeof select>["execute"]>>[number];

function isGalleryVisible(row: Row): boolean {
  return istImKatalogSichtbar(row.kind, row.listingType, row.quantity, row.stock, row.origin);
}

function visibleHighlights(rows: Row[]): Row[] {
  // Filter before slicing: five sold cards at the top must not leave the
  // gallery with fewer cards while an available one sits just below them.
  return rows.filter(isGalleryVisible).slice(0, GALLERY_SIZE);
}

function toHighlight(row: Row): Highlight {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.origin === "MANUAL" ? "Direkt bei uns" : row.listingType === "AUCTION" ? "Auktion" : "Festpreis",
    priceAmountCents: row.origin === "MANUAL" ? null : row.priceAmountCents,
    priceCurrency: row.priceCurrency,
    quantity: row.origin === "MANUAL"
      ? verfuegbareMenge(null, row.stock, "MANUAL")
      : verfuegbareMenge(row.quantity, row.stock),
    listingUrl: row.listingUrl,
    imageUrl: row.imageUrl,
    startAt: row.startAt,
  };
}

// eBay auctions stay out of the catalogue. Manual cards are part of the same
// public highlight source even though they have no listing row.
const live = and(
  eq(products.status, "ACTIVE"),
  or(
    eq(products.origin, "MANUAL"),
    and(eq(products.origin, "EBAY"), eq(ebayListings.status, "ACTIVE"), ne(ebayListings.listingType, "AUCTION")),
  ),
);

export async function GET() {
  try {
    // `desc(ebayListings.startAt)` remains the source date for eBay cards; the
    // coalesce also gives a manual card's createdAt a fair place in "newest".
    const newestOrder = sql`coalesce(${ebayListings.startAt}, ${products.createdAt})`;
    const [newest, priciest] = await Promise.all([
      select().where(live).orderBy(desc(newestOrder), desc(ebayListings.startAt)),
      // Manual pre-sale cards have no fixed price and therefore do not belong
      // in the price ranking. They still appear in "newest".
      select().where(and(live, eq(products.origin, "EBAY"), isNotNull(ebayListings.priceAmountCents)))
        .orderBy(desc(ebayListings.priceAmountCents)),
    ]);
    const newestRows = visibleHighlights(newest);
    const priciestRows = visibleHighlights(priciest);

    return NextResponse.json({
      newest: newestRows.map(toHighlight),
      priciest: priciestRows.map(toHighlight),
    }, { headers: { "cache-control": CATALOGUE_CACHE_CONTROL } });
  } catch (error) {
    console.error("product highlights query failed", error);
    return NextResponse.json({ error: "Karten konnten nicht geladen werden." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
