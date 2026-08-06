import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { ebayListings, priceOffers, products } from "../../../db/schema";
import { getAuthenticatedAppUser } from "../../../lib/app-user";
import { MAX_OFFERS_PER_PRODUCT, MIN_DISCOUNT_CENTS, offerAttempts } from "../../../lib/price-offers";
import { jsonError, optionalPrice, optionalString, PublicFormError, readJsonBody, requiredString } from "../../../lib/public-form";

/** Price negotiation, the shop's own take on eBay's Best Offer.
 *
 * Signed-in only: an offer is bound to a customer, which is what lets the
 * checkout apply it later without handing out a transferable voucher code.
 */
export async function POST(request: Request) {
  try {
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) {
      return NextResponse.json({ ok: false, error: { code: "AUTH_REQUIRED", message: "Bitte melde dich an, um einen Preis vorzuschlagen." } }, { status: 401 });
    }

    const body = await readJsonBody(request);
    const productId = requiredString(body, "productId", "Produktreferenz", 64);
    if (!/^[a-f0-9]{32}$/iu.test(productId)) {
      throw new PublicFormError(400, "INVALID_PRODUCT", "Die Produktreferenz ist ungültig.");
    }
    const proposed = optionalPrice(body, "price");
    if (proposed === null) throw new PublicFormError(400, "INVALID_PRICE", "Bitte gib deinen Preisvorschlag an.");
    const message = optionalString(body, "message", "Nachricht", 1000);

    const db = getDb();
    const rows = await db.select({ product: products, listing: ebayListings })
      .from(products)
      .innerJoin(ebayListings, eq(ebayListings.productId, products.id))
      .where(and(eq(products.id, productId), eq(products.status, "ACTIVE"), eq(ebayListings.status, "ACTIVE")))
      .limit(1);

    const row = rows[0];
    if (!row) throw new PublicFormError(404, "PRODUCT_NOT_FOUND", "Diese Karte ist nicht verfügbar.");
    if (row.listing.listingType === "AUCTION") {
      throw new PublicFormError(400, "AUCTION_NOT_NEGOTIABLE", "Bei Auktionen wird direkt auf eBay geboten.");
    }

    const listPrice = row.listing.priceAmountCents;
    if (!listPrice) throw new PublicFormError(400, "NO_LIST_PRICE", "Für diese Karte liegt kein Preis vor.");

    const amount = Math.round(proposed * 100);
    if (amount > listPrice - MIN_DISCOUNT_CENTS) {
      throw new PublicFormError(400, "OFFER_TOO_HIGH", "Dein Vorschlag muss unter dem aktuellen Preis liegen.");
    }

    // An accepted offer already covers this card; a further one would only
    // confuse which price applies.
    const existing = await db.select({ id: priceOffers.id, status: priceOffers.status })
      .from(priceOffers)
      .where(and(eq(priceOffers.userId, appUser.id), eq(priceOffers.productId, productId)))
      .orderBy(desc(priceOffers.createdAt));

    if (existing.some((offer) => offer.status === "ACCEPTED")) {
      throw new PublicFormError(409, "OFFER_ALREADY_ACCEPTED", "Für diese Karte gilt bereits dein ausgehandelter Preis.");
    }
    if (existing.some((offer) => offer.status === "NEW" || offer.status === "IN_REVIEW")) {
      throw new PublicFormError(409, "OFFER_PENDING", "Dein Vorschlag wird bereits geprüft. Wir melden uns per E-Mail.");
    }

    const attempts = await offerAttempts(db, appUser.id, productId);
    if (attempts >= MAX_OFFERS_PER_PRODUCT) {
      throw new PublicFormError(429, "OFFER_LIMIT_REACHED", `Pro Karte sind ${MAX_OFFERS_PER_PRODUCT} Vorschläge möglich. Für diese Karte ist das Limit erreicht.`);
    }

    const [inserted] = await db.insert(priceOffers).values({
      productId,
      userId: appUser.id,
      guestEmail: appUser.email,
      proposedAmountCents: amount,
      currency: row.listing.priceCurrency,
      message,
      status: "NEW",
    }).returning({ id: priceOffers.id });

    return NextResponse.json({
      ok: true,
      priceOfferId: inserted?.id,
      attemptsLeft: MAX_OFFERS_PER_PRODUCT - (attempts + 1),
    }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

/** The customer's own offers for one card, so the detail page can show state. */
export async function GET(request: Request) {
  try {
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) return NextResponse.json({ signedIn: false, offers: [], attemptsLeft: MAX_OFFERS_PER_PRODUCT });

    const productId = new URL(request.url).searchParams.get("productId") ?? "";
    if (!/^[a-f0-9]{32}$/iu.test(productId)) {
      return NextResponse.json({ error: "Ungültige Produktreferenz." }, { status: 400 });
    }

    const db = getDb();
    const offers = await db.select({
      id: priceOffers.id,
      amount: priceOffers.proposedAmountCents,
      currency: priceOffers.currency,
      status: priceOffers.status,
      createdAt: priceOffers.createdAt,
      expiresAt: priceOffers.expiresAt,
    }).from(priceOffers)
      .where(and(eq(priceOffers.userId, appUser.id), eq(priceOffers.productId, productId)))
      .orderBy(desc(priceOffers.createdAt));

    const active = offers.filter((offer) => offer.status !== "WITHDRAWN");
    return NextResponse.json({
      signedIn: true,
      offers,
      attemptsLeft: Math.max(0, MAX_OFFERS_PER_PRODUCT - active.length),
    });
  } catch (error) {
    console.error("price offer lookup failed", error);
    return NextResponse.json({ error: "Preisvorschläge konnten nicht geladen werden." }, { status: 503 });
  }
}
