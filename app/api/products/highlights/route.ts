import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
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
    // Der Verbund bleibt links, obwohl die Galerie seit dem 2026-08-18 nur noch
    // eBay-Karten zeigt und `live` ohnehin eine aktive Anzeige verlangt. Ein
    // innerer Verbund wäre heute gleichwertig — und stünde als Falle bereit,
    // sobald hier je wieder eine Karte ohne Anzeige auftauchen soll.
    // (Bis zum 2026-08-18 stand hier, ein innerer Verbund entferne genau die
    // manuellen Karten. Das stimmte, ist aber nicht mehr der Grund.)
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

/** Auktionen bleiben draußen — und **Vorverkaufskarten ebenfalls.**
 *
 * Sie waren hier ursprünglich mit drin. Am 2026-08-18 kippte das: Ein Import
 * von 144 Karten auf einmal machte sie zu den jüngsten im Bestand, und die
 * Galerie bestand daraufhin aus fünf Vorverkaufskarten und sonst nichts. Was
 * als Beimischung gedacht war, verdrängte die Ware, die man sofort kaufen kann.
 * Die Startseite zeigt deshalb nur noch eBay-Karten; der Vorverkauf hat seine
 * eigene Seite. */
const live = and(
  eq(products.status, "ACTIVE"),
  eq(products.origin, "EBAY"),
  eq(ebayListings.status, "ACTIVE"),
  ne(ebayListings.listingType, "AUCTION"),
);

export async function GET() {
  try {
    // Maßgeblich ist der Beginn der eBay-Anzeige. Fehlt er, tritt das Anlegedatum
    // ein — sonst rutschte eine Karte ohne Startdatum ans Ende statt an ihren Platz.
    const newestOrder = sql`coalesce(${ebayListings.startAt}, ${products.createdAt})`;
    const [newest, priciest] = await Promise.all([
      select().where(live).orderBy(desc(newestOrder), desc(ebayListings.startAt)),
      // Ein Preis muss dastehen, sonst gibt es nichts zu ordnen.
      select().where(and(live, isNotNull(ebayListings.priceAmountCents)))
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
