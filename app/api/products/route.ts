import { and, asc, desc, eq, gt, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { ebayListings, inventory, productAssets, products } from "../../../db/schema";
import { istImKatalogSichtbar, verfuegbareMenge } from "../../../lib/catalog-availability";
import { clampPage, pageCount, toPageSize } from "../../../lib/pagination";

/** The catalogue changes when the eBay sync runs, not between two page views.
 *
 * Search, filters and pagination are deliberately applied before the query
 * leaves D1. The old endpoint loaded every card and made the browser filter
 * and slice it, which made the first response grow with the catalogue and
 * made the checkout unable to find cards outside the first page.
 */
export const CATALOGUE_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=60";

const MAX_ID_LOOKUP = 50;
const MAX_SEARCH_LENGTH = 100;
const MAX_PRICE_CENTS = 10_000_000;
const HIDDEN_INVENTORY_STATUSES = ["SOLD", "UNAVAILABLE"] as const;
const CATEGORIES = ["fixed", "manual", "prelisted"] as const;

type Category = (typeof CATEGORIES)[number];

function cleanSearch(value: string | null) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("de-DE")
    // `%` and `_` are LIKE wildcards. They have no useful meaning in the
    // public catalogue search and must not turn a narrow query into a full
    // table scan with surprising matches.
    .replace(/[%_\\]/gu, " ")
    .replace(/\s+/gu, " ")
    .slice(0, MAX_SEARCH_LENGTH);
}

function parsePriceCents(value: string | null) {
  if (value === null || value.trim() === "") return null;
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.min(MAX_PRICE_CENTS, Math.round(amount * 100));
}

function requestedIds(value: string | null) {
  if (!value) return [];
  const ids = [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
  return ids.length <= MAX_ID_LOOKUP && ids.every((id) => /^[a-f0-9]{32}$/iu.test(id)) ? ids : null;
}

/** SQL equivalent of `istImKatalogSichtbar` for the rows that can leave D1.
 *
 * The pure helper remains the final guard while mapping rows. This predicate
 * is what makes the count and the page slice agree: sold cards and auctions
 * are removed before `LIMIT/OFFSET`, rather than after it.
 */
function visibleInSql() {
  const manual = and(
    eq(products.origin, "MANUAL"),
    gt(inventory.availableQuantity, 0),
    notInArray(inventory.status, [...HIDDEN_INVENTORY_STATUSES]),
  );
  const prelisted = and(eq(products.origin, "EBAY"), eq(products.kind, "PRELISTED"));
  const inventoryAllowsEbay = or(
    sql`${inventory.id} IS NULL`,
    and(
      gt(inventory.availableQuantity, 0),
      notInArray(inventory.status, [...HIDDEN_INVENTORY_STATUSES]),
    ),
  );
  const ebay = and(
    eq(products.origin, "EBAY"),
    eq(ebayListings.status, "ACTIVE"),
    ne(ebayListings.listingType, "AUCTION"),
    gt(ebayListings.quantity, 0),
    inventoryAllowsEbay,
  );
  return or(manual, prelisted, ebay);
}

function categoryCondition(category: Category) {
  if (category === "manual") return eq(products.origin, "MANUAL");
  if (category === "prelisted") return and(eq(products.origin, "EBAY"), eq(products.kind, "PRELISTED"));
  return and(eq(products.origin, "EBAY"), ne(products.kind, "PRELISTED"));
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const ids = requestedIds(params.get("ids"));
    if (ids === null) {
      return NextResponse.json({ error: "Ungültige Produktreferenzen." }, { status: 400 });
    }

    const byId = ids.length > 0;
    const pageSize = byId ? ids.length : toPageSize(params.get("pro") ?? params.get("pageSize"));
    const requestedPage = params.get("seite") ?? params.get("page") ?? "1";
    const q = cleanSearch(params.get("q"));
    const category = CATEGORIES.includes(params.get("category") as Category)
      ? params.get("category") as Category
      : null;
    const origin = params.get("origin") === "MANUAL" || params.get("origin") === "EBAY"
      ? params.get("origin") as "MANUAL" | "EBAY"
      : null;
    const minPrice = parsePriceCents(params.get("min"));
    const maxPrice = parsePriceCents(params.get("max"));

    const conditions = [
      eq(products.status, "ACTIVE"),
      visibleInSql(),
    ];
    if (ids.length) conditions.push(inArray(products.id, ids));
    if (q) {
      const searchable = sql`lower(coalesce(${products.title}, '') || ' ' || coalesce(${products.description}, '') || ' ' || coalesce(${ebayListings.sku}, ''))`;
      conditions.push(sql`${searchable} LIKE ${`%${q}%`}`);
    }
    if (category) conditions.push(categoryCondition(category));
    if (origin) conditions.push(eq(products.origin, origin));
    if (minPrice !== null) {
      const price = sql`coalesce(${ebayListings.priceAmountCents}, ${products.priceAmountCents})`;
      conditions.push(sql`${price} IS NOT NULL AND ${price} >= ${minPrice}`);
    }
    if (maxPrice !== null) {
      const price = sql`coalesce(${ebayListings.priceAmountCents}, ${products.priceAmountCents})`;
      conditions.push(sql`${price} IS NOT NULL AND ${price} <= ${maxPrice}`);
    }

    const db = getDb();
    const where = and(...conditions);
    const [{ total: rawTotal }] = await db.select({ total: sql<number>`count(*)` })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(where);
    const total = Number(rawTotal ?? 0);
    const totalPages = pageCount(total, pageSize);
    const page = byId ? 1 : clampPage(requestedPage, total, pageSize);

    const rows = await db.select({ product: products, listing: ebayListings, stock: inventory })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(where)
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(pageSize)
      .offset(byId ? 0 : (page - 1) * pageSize);

    const productIds = rows.map((row) => row.product.id);
    const assets = productIds.length
      ? await db.select({ productId: productAssets.productId, sourceUrl: productAssets.sourceUrl })
        .from(productAssets)
        .where(inArray(productAssets.productId, productIds))
        .orderBy(asc(productAssets.sortOrder))
      : [];
    const assetsByProduct = new Map<string, string[]>();
    for (const asset of assets) {
      if (!asset.sourceUrl) continue;
      const list = assetsByProduct.get(asset.productId) ?? [];
      list.push(asset.sourceUrl);
      assetsByProduct.set(asset.productId, list);
    }

    const result = rows.flatMap((row) => {
      const manuell = row.product.origin === "MANUAL";
      if (!istImKatalogSichtbar(row.product.kind, row.listing?.listingType, row.listing?.quantity, row.stock, row.product.origin)) return [];
      return [{
        id: row.product.id,
        title: row.product.title,
        description: row.product.description,
        category: manuell ? "Direkt bei uns" as const : row.product.kind === "PRELISTED" ? "Vormerkliste" as const : "Festpreis" as const,
        // A manually entered pre-sale card has no fixed price. Its amount is
        // created only by an accepted offer and resolved again at checkout.
        priceAmountCents: manuell ? null : row.listing?.priceAmountCents ?? null,
        priceCurrency: manuell ? row.product.priceCurrency : row.listing?.priceCurrency ?? "EUR",
        quantity: manuell
          ? verfuegbareMenge(null, row.stock, "MANUAL")
          : row.product.kind === "PRELISTED" ? 0 : verfuegbareMenge(row.listing?.quantity, row.stock),
        listingUrl: row.listing?.listingUrl ?? null,
        imageUrls: assetsByProduct.get(row.product.id) ?? [],
        origin: row.product.origin,
      }];
    });

    const headers = { "cache-control": byId ? "no-store" : CATALOGUE_CACHE_CONTROL };
    return NextResponse.json({
      products: result,
      page,
      pageSize,
      total,
      totalPages,
      first: result.length ? (page - 1) * pageSize + 1 : 0,
      last: result.length ? (page - 1) * pageSize + result.length : 0,
    }, { headers });
  } catch (error) {
    console.error("public product query failed", error);
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
