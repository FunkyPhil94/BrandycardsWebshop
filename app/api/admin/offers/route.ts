import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { ebayListings, priceOffers, products, users } from "../../../../db/schema";
import { recordAdminAudit } from "../../../../lib/admin-audit";
import { requireAdmin } from "../../../../lib/admin-access";
import { enqueueAvatarEvent } from "../../../../lib/avatar-events";
import { notifyOfferDecision } from "../../../../lib/email/notify.ts";
import { offerExpiry } from "../../../../lib/price-offers";

const OPEN = ["NEW", "IN_REVIEW"] as const;

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const db = getDb();
    const rows = await db.select({
      id: priceOffers.id,
      productId: priceOffers.productId,
      title: products.title,
      listPriceCents: ebayListings.priceAmountCents,
      amount: priceOffers.proposedAmountCents,
      currency: priceOffers.currency,
      message: priceOffers.message,
      status: priceOffers.status,
      createdAt: priceOffers.createdAt,
      expiresAt: priceOffers.expiresAt,
      email: users.email,
    }).from(priceOffers)
      .innerJoin(products, eq(products.id, priceOffers.productId))
      .leftJoin(ebayListings, eq(ebayListings.productId, priceOffers.productId))
      .leftJoin(users, eq(users.id, priceOffers.userId))
      .where(inArray(priceOffers.status, [...OPEN]))
      .orderBy(desc(priceOffers.createdAt))
      .limit(50);

    return NextResponse.json({ offers: rows });
  } catch (error) {
    console.error("admin offer list failed", error);
    return NextResponse.json({ error: "Preisvorschläge konnten nicht geladen werden." }, { status: 503 });
  }
}

/** Accepting stamps the validity window; from then on the checkout resolves the
 * price from this row. Deliberately no stock reservation: the card stays on
 * sale here and on eBay, so nothing is blocked behind a pending decision. */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const body = await request.json() as { offerId?: unknown; action?: unknown };
    const offerId = typeof body.offerId === "string" ? body.offerId.trim() : "";
    const action = body.action === "accept" ? "accept" : body.action === "reject" ? "reject" : null;
    if (!/^[a-f0-9]{32}$/iu.test(offerId) || !action) {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }

    const db = getDb();
    const now = new Date().toISOString();
    const result = await db.update(priceOffers).set(action === "accept"
      ? { status: "ACCEPTED", expiresAt: offerExpiry(new Date(now)), updatedAt: now }
      : { status: "REJECTED", updatedAt: now })
      .where(and(eq(priceOffers.id, offerId), inArray(priceOffers.status, [...OPEN])));

    if (result.meta.changes !== 1) {
      return NextResponse.json({ error: "Dieser Vorschlag wurde bereits entschieden." }, { status: 409 });
    }
    try {
      await enqueueAvatarEvent(db, {
        eventType: action === "accept" ? "OFFER_ACCEPTED" : "OFFER_REJECTED",
        aggregateType: "PRICE_OFFER",
        aggregateId: offerId,
        dedupeKey: `price-offer:${offerId}:${action}`,
        payload: { offerId },
      });
    } catch (eventError) {
      // The offer decision is already committed. Keep that business action
      // successful; a later repair/retry can enqueue the visual event.
      console.error("avatar offer event enqueue failed", eventError);
    }
    await recordAdminAudit({ request, actorUserId: guard.user.id, action: `offer.${action}`, entityType: "price_offer", entityId: offerId });
    await notifyOfferDecision(db, offerId, action);
    return NextResponse.json({ ok: true, status: action === "accept" ? "ACCEPTED" : "REJECTED" });
  } catch (error) {
    console.error("admin offer decision failed", error);
    return NextResponse.json({ error: "Entscheidung konnte nicht gespeichert werden." }, { status: 503 });
  }
}
