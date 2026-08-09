import { and, count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { cardSubmissionAssets, cardSubmissions, ebayListings, inquiries, inventory, orders, products } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin-access";
import { istKaufbar } from "../../../../lib/catalog-availability";

/** Wie viele Karten gerade jemand kaufen könnte.
 *
 * **Nicht `COUNT(*) WHERE status = 'ACTIVE'`, und das ist der ganze Punkt.**
 * Bis zum 2026-08-09 zählte die Kachel genau das und behauptete dabei, die
 * aktiven eBay-Angebote zu spiegeln. Eine im Shop verkaufte **manuelle** Karte
 * bleibt aber auf `ACTIVE` stehen — bei eBay-Karten räumt der Sync das auf,
 * für manuelle gibt es diesen Weg nicht. Die Zahl driftete damit mit jedem
 * Vorverkauf um eins weiter, dauerhaft und wachsend.
 *
 * **Gezählt wird deshalb mit derselben Entscheidung, die auch den Katalog
 * füllt** (`istKaufbar` → `istImKatalogSichtbar` → `verfuegbareMenge`). Eine
 * zweite Fassung in SQL wäre die fünfte Stelle, an der dieselbe Frage
 * beantwortet wird — und die vier bisherigen sind alle auseinandergelaufen.
 *
 * Der Preis sind ~550 gelesene Zeilen statt eines Zählers. Auf einer Seite, die
 * nur der Betreiber öffnet, ist das nichts; der öffentliche Katalog liest
 * dieselbe Menge bei jedem Rand-Abruf.
 */
async function kaufbareKarten(db: ReturnType<typeof getDb>) {
  const rows = await db.select({
    kind: products.kind,
    origin: products.origin,
    listingType: ebayListings.listingType,
    listingQuantity: ebayListings.quantity,
    bestandStatus: inventory.status,
    bestandMenge: inventory.availableQuantity,
  }).from(products)
    .leftJoin(ebayListings, and(eq(ebayListings.productId, products.id), eq(ebayListings.status, "ACTIVE")))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(eq(products.status, "ACTIVE"));

  return rows.filter((row) => istKaufbar(
    row.kind,
    row.listingType,
    row.listingQuantity,
    row.bestandStatus === null ? null : { availableQuantity: row.bestandMenge ?? 0, status: row.bestandStatus },
    row.origin,
  )).length;
}

export async function GET(request: Request) {
  try {
    const access = await requireAdmin(request);
    if (access.response) return access.response;
    const appUser = access.user;

    const db = getDb();
    const [productCount, [inquiryCount], [submissionCount], [orderCount]] = await Promise.all([
      // Verkaufbare Karten, nicht „aktive Produktzeilen" — siehe kaufbareKarten.
      kaufbareKarten(db),
      db.select({ count: count() }).from(inquiries),
      db.select({ count: count() }).from(cardSubmissions),
      db.select({ count: count() }).from(orders),
    ]);
    const recentRows = await db.select({ id: cardSubmissions.id, email: cardSubmissions.guestEmail, name: cardSubmissions.name, message: cardSubmissions.message, status: cardSubmissions.status, createdAt: cardSubmissions.createdAt }).from(cardSubmissions).orderBy(desc(cardSubmissions.createdAt)).limit(20);
    const recentSubmissions = await Promise.all(recentRows.map(async (submission) => {
      const assets = await db.select({ id: cardSubmissionAssets.id, originalName: cardSubmissionAssets.originalName, mimeType: cardSubmissionAssets.mimeType, byteSize: cardSubmissionAssets.byteSize }).from(cardSubmissionAssets).where(eq(cardSubmissionAssets.submissionId, submission.id));
      let title = "Kartenangebot";
      try { title = typeof submission.message === "string" ? (JSON.parse(submission.message) as { title?: string }).title ?? title : title; } catch { /* keep safe fallback */ }
      return { id: submission.id, email: submission.email, name: submission.name, title, status: submission.status, createdAt: submission.createdAt, assets };
    }));

    return NextResponse.json({
      ok: true,
      user: { email: appUser.email, role: appUser.role },
      counts: {
        products: productCount,
        inquiries: inquiryCount?.count ?? 0,
        cardSubmissions: submissionCount?.count ?? 0,
        orders: orderCount?.count ?? 0,
      },
      recentSubmissions,
    });
  } catch (error) {
    console.error("Admin dashboard failed", error);
    return NextResponse.json({ error: "Administrationsbereich ist derzeit nicht verfügbar." }, { status: 503 });
  }
}
