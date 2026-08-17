import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { priceOffers, products } from "../../../../db/schema";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { kontoZuordnung } from "../../../../lib/account-data";
import { enforcePublicRateLimit, RateLimitError } from "../../../../lib/rate-limit";

/** Alle Preisvorschläge eines Kunden — für die Ansicht in seinem Konto.
 *
 * **Warum das nicht `/api/account/offers` erledigt:** Jener Endpunkt liefert
 * ausschließlich *angenommene, noch gültige* Angebote, weil an ihm der Preis
 * hängt, den die Kasse abbucht. Ihn um Historie zu erweitern hieße, eine
 * Anzeige und eine Geldentscheidung an dieselbe Antwort zu binden. Das bleibt
 * getrennt.
 *
 * Wie überall im Konto liest die Route **nur**, was zum angemeldeten Nutzer
 * gehört, und nimmt keine Kennung aus der Anfrage entgegen.
 */
export async function GET(request: Request) {
  try {
    await enforcePublicRateLimit(request, "account-price-offers");
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });

    const db = getDb();
    const gehoertZu = kontoZuordnung(appUser.id, appUser.email);
    const rows = await db.select({
      id: priceOffers.id,
      productId: priceOffers.productId,
      title: products.title,
      amountCents: priceOffers.proposedAmountCents,
      currency: priceOffers.currency,
      status: priceOffers.status,
      message: priceOffers.message,
      createdAt: priceOffers.createdAt,
      expiresAt: priceOffers.expiresAt,
    }).from(priceOffers)
      .leftJoin(products, eq(products.id, priceOffers.productId))
      .where(gehoertZu(priceOffers.userId, priceOffers.guestEmail))
      .orderBy(desc(priceOffers.createdAt));

    // Ein angenommenes Angebot, dessen Frist abgelaufen ist, gilt als abgelaufen
    // — dieselbe Ableitung wie auf der Kartenseite. Der geplante Lauf schreibt
    // den Stand erst später fort; bis dahin dürfen Kunde und Kasse nicht
    // Verschiedenes sehen.
    const jetzt = Date.now();
    const offers = rows.map((row) => ({
      ...row,
      status: row.status === "ACCEPTED" && (!row.expiresAt || Date.parse(row.expiresAt) <= jetzt) ? "EXPIRED" : row.status,
    }));

    return NextResponse.json({ offers });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    }
    console.error("account price offers failed", error);
    return NextResponse.json({ error: "Deine Preisvorschläge konnten nicht geladen werden." }, { status: 503 });
  }
}
