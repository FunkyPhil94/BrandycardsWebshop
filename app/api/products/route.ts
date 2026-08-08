import { desc, eq, and, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { ebayListings, inventory, productAssets, products } from "../../../db/schema";
import { istImKatalogSichtbar, verfuegbareMenge } from "../../../lib/catalog-availability";

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
/**
 * **Am 2026-08-08 von 60/300 auf 30/60 gesenkt.** Der Anlass: Eine im Shop
 * verkaufte Karte verschwindet jetzt sofort aus den Daten — aber der Rand
 * lieferte sie im schlechtesten Fall noch gut sechs Minuten aus (60 Sekunden
 * frisch, danach bis zu 300 Sekunden „stale while revalidate"). Jetzt sind es
 * höchstens **90 Sekunden**.
 *
 * **Ganz ohne Zwischenspeicher ginge es nicht ohne Weiteres:** Er ist als
 * SEC-05 eingebaut worden, weil jeder Abruf ~1 725 Zeilen aus D1 liest und der
 * Endpunkt ohne Anmeldung erreichbar ist. Halbierte Frist heißt doppelte Last —
 * auf dem Paid-Tarif eine Rechnung, kein Ausfallrisiko.
 */
export const CATALOGUE_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=60";

export async function GET() {
  try {
    const db = getDb();
    // `inventory` muss mit hinein: Ein Verkauf im Shop bucht den Bestand und
    // rührt das Listing nicht an. Ohne diese Verknüpfung stand eine verkaufte
    // Karte bis zum nächsten eBay-Import mit „1 VERFÜGBAR" im Schaufenster.
    // **`leftJoin`, nicht `innerJoin`** — Karten der Vormerkliste haben keine
    // Bestandszeile und dürfen nicht verschwinden.
    const rows = await db.select({ product: products, listing: ebayListings, asset: productAssets, stock: inventory })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(productAssets, eq(productAssets.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      // Von Hand eingestellte Karten haben nie ein Listing und müssen deshalb
      // ausdrücklich durchgelassen werden — sonst zeigt der Katalog sie nie an.
      .where(and(eq(products.status, "ACTIVE"), or(eq(products.origin, "MANUAL"), eq(products.kind, "PRELISTED"), eq(ebayListings.status, "ACTIVE"))))
      .orderBy(desc(products.createdAt));
    const byId = new Map<string, {
      id: string; title: string; description: string | null;
      category: "Festpreis" | "Auktion" | "Vormerkliste" | "Direkt bei uns"; priceAmountCents: number | null;
      priceCurrency: string; quantity: number; listingUrl: string | null; imageUrls: string[]; origin: string;
    }>();
    for (const row of rows) {
      const manuell = row.product.origin === "MANUAL";
      if (!row.listing && !manuell && row.product.kind !== "PRELISTED") continue;
      // Verkauft heißt weg — sofort, nicht erst beim nächsten Import.
      if (!istImKatalogSichtbar(row.product.kind, row.listing?.listingType, row.listing?.quantity, row.stock, row.product.origin)) continue;
      const current = byId.get(row.product.id) ?? {
        id: row.product.id, title: row.product.title, description: row.product.description,
        // Kein „Auktion" mehr: Auktionen sind oben schon ausgefiltert.
        category: manuell ? "Direkt bei uns" : row.product.kind === "PRELISTED" ? "Vormerkliste" : "Festpreis",
        // Bei manuellen Karten steht der Preis am Produkt, es gibt kein Listing.
        priceAmountCents: manuell ? row.product.priceAmountCents : row.listing?.priceAmountCents ?? null,
        priceCurrency: manuell ? row.product.priceCurrency : row.listing?.priceCurrency ?? "EUR",
        quantity: manuell
          ? verfuegbareMenge(null, row.stock, "MANUAL")
          : row.product.kind === "PRELISTED" ? 0 : verfuegbareMenge(row.listing?.quantity, row.stock),
        listingUrl: row.listing?.listingUrl ?? null, imageUrls: [], origin: row.product.origin,
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
