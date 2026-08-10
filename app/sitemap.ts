import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { ebayListings, inventory, products } from "../db/schema";
import { istImKatalogSichtbar } from "../lib/catalog-availability";
import { absoluteShopUrl } from "../lib/seo";

const PUBLIC_PATHS = [
  "/",
  "/karten",
  "/vorverkauf",
  "/anfragen",
  "/verkaufen",
  "/ueber-uns",
  "/impressum",
  "/datenschutz",
  "/agb",
  "/widerruf",
  "/versand-zahlung",
] as const;

export const dynamic = "force-dynamic";

function publicEntries(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: absoluteShopUrl(path),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = publicEntries();

  try {
    const db = getDb();
    const rows = await db.select({
      id: products.id,
      kind: products.kind,
      origin: products.origin,
      listingStatus: ebayListings.status,
      listingType: ebayListings.listingType,
      listingQuantity: ebayListings.quantity,
      inventoryId: inventory.id,
      availableQuantity: inventory.availableQuantity,
      inventoryStatus: inventory.status,
      updatedAt: products.updatedAt,
      listingUpdatedAt: ebayListings.updatedAt,
    })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(eq(products.status, "ACTIVE"));

    const productEntries = rows.flatMap((row) => {
      const isManual = row.origin === "MANUAL";
      if (!isManual && row.kind !== "PRELISTED" && row.listingStatus !== "ACTIVE") return [];
      const stock = row.inventoryId
        ? { availableQuantity: row.availableQuantity ?? 0, status: row.inventoryStatus ?? "UNAVAILABLE" }
        : null;
      if (!istImKatalogSichtbar(row.kind, row.listingType, row.listingQuantity, stock, row.origin)) return [];
      return [{
        url: absoluteShopUrl(`/karten/${row.id}`),
        lastModified: row.listingUpdatedAt ?? row.updatedAt ?? undefined,
        changeFrequency: "daily" as const,
        priority: 0.8,
      }];
    });

    return [...staticEntries, ...productEntries];
  } catch (error) {
    // A sitemap with public pages is better than a 503 if a preview has no D1
    // binding. The canonical Worker has the binding and adds product URLs.
    console.error("sitemap product query failed", error);
    return staticEntries;
  }
}
