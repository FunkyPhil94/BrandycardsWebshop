import { and, eq, inArray, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { ebayListings, inventory, products, webhookEvents } from "../../../../db/schema";
import { avatarEventInsert } from "../../../../lib/avatar-events";
import { notifyOperationalAlert } from "../../../../lib/ops-alerts";
import {
  buildEbayChallengeResponse,
  EBAY_NOTIFICATION_MAX_BODY_BYTES,
  EBAY_NOTIFICATION_TOPIC,
  parseEbayOrderConfirmation,
  verifyEbayNotificationSignature,
} from "../../../../lib/ebay-notifications";
import { receivedWebhookRetryDue } from "../../../../lib/paypal/webhook-retry";
import { readTextBody, RequestBodyError } from "../../../../lib/request-body";

const EBAY_WEBHOOK_PROVIDER = "EBAY";
const EBAY_WEBHOOK_RECEIVED_RETRY_AFTER_SECONDS = 300;

function jsonError(message: string, status: number, retryable = false) {
  return NextResponse.json({ error: message, ...(retryable ? { retryable: true } : {}) }, {
    status,
    headers: retryable ? { "retry-after": String(EBAY_WEBHOOK_RECEIVED_RETRY_AFTER_SECONDS) } : undefined,
  });
}

export async function GET(request: Request) {
  const challengeCode = new URL(request.url).searchParams.get("challenge_code");
  if (!challengeCode) return jsonError("challenge_code fehlt.", 400);
  if (challengeCode.length > 512) return jsonError("challenge_code ist ungültig.", 400);

  try {
    const challengeResponse = await buildEbayChallengeResponse(challengeCode);
    return NextResponse.json({ challengeResponse }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("eBay-Notification-Endpoint konnte nicht validiert werden.", error instanceof Error ? error.message : error);
    return jsonError("eBay-Notification-Endpoint ist noch nicht konfiguriert.", 503, true);
  }
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await readTextBody(request, EBAY_NOTIFICATION_MAX_BODY_BYTES);
  } catch (error) {
    return jsonError(error instanceof RequestBodyError ? error.message : "eBay-Notification konnte nicht gelesen werden.", error instanceof RequestBodyError ? error.status : 400);
  }

  const signature = request.headers.get("x-ebay-signature")?.trim() || "";
  if (!signature) return jsonError("eBay-Notification-Signatur fehlt.", 412);
  const verification = await verifyEbayNotificationSignature(rawBody, signature);
  if (verification.retryable) return jsonError("eBay-Notification-Signatur konnte vorübergehend nicht geprüft werden.", 503, true);
  if (!verification.valid) return jsonError("Ungültige eBay-Notification-Signatur.", 412);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonError("Ungültige eBay-Notification-Nutzlast.", 400);
  }

  const confirmation = parseEbayOrderConfirmation(payload);
  if (!confirmation) return jsonError(`Nicht unterstützte oder unvollständige eBay-Notification (erwartet: ${EBAY_NOTIFICATION_TOPIC}).`, 400);

  const receivedAt = new Date().toISOString();
  let db: ReturnType<typeof getDb> | undefined;
  let previousFailure = false;
  try {
    db = getDb();
    let existing = await db.query.webhookEvents.findFirst({
      where: and(eq(webhookEvents.provider, EBAY_WEBHOOK_PROVIDER), eq(webhookEvents.externalEventId, confirmation.notificationId)),
    });

    let insertedNew = false;
    if (!existing) {
      const inserted = await db.batch([db.insert(webhookEvents).values({
        provider: EBAY_WEBHOOK_PROVIDER,
        externalEventId: confirmation.notificationId,
        eventType: EBAY_NOTIFICATION_TOPIC,
        status: "RECEIVED",
        payload,
        receivedAt,
      }).onConflictDoNothing()]);
      insertedNew = inserted[0].meta.changes === 1;
      if (!insertedNew) {
        existing = await db.query.webhookEvents.findFirst({
          where: and(eq(webhookEvents.provider, EBAY_WEBHOOK_PROVIDER), eq(webhookEvents.externalEventId, confirmation.notificationId)),
        });
      }
    }
    if (!existing && !insertedNew) throw new Error("eBay-Notification konnte nicht idempotent reserviert werden.");

    if (existing?.status === "PROCESSED") return NextResponse.json({ ok: true, duplicate: true });
    previousFailure = existing?.status === "FAILED";
    if (existing?.status === "RECEIVED" && !receivedWebhookRetryDue(existing.receivedAt)) {
      return jsonError("eBay-Notification wird bereits verarbeitet.", 503, true);
    }

    if (existing?.status === "FAILED") {
      await db.update(webhookEvents).set({
        status: "RECEIVED",
        eventType: EBAY_NOTIFICATION_TOPIC,
        payload,
        receivedAt,
        processedAt: null,
        errorMessage: null,
      }).where(eq(webhookEvents.id, existing.id));
    } else if (existing?.status === "RECEIVED") {
      const claim = await db.batch([db.update(webhookEvents).set({
        eventType: EBAY_NOTIFICATION_TOPIC,
        payload,
        receivedAt,
        processedAt: null,
        errorMessage: null,
      }).where(and(
        eq(webhookEvents.id, existing.id),
        eq(webhookEvents.status, "RECEIVED"),
        eq(webhookEvents.receivedAt, existing.receivedAt),
      ))]);
      if (claim[0].meta.changes !== 1) return jsonError("eBay-Notification wird bereits verarbeitet.", 503, true);
    }

    const listingIds = confirmation.lineItems.map((lineItem) => lineItem.listingId);
    const listings = await db.select().from(ebayListings).where(or(
      inArray(ebayListings.ebayItemId, listingIds),
      inArray(ebayListings.ebayListingId, listingIds),
    ));
    const listingsByItemId = new Map<string, (typeof listings)[number]>();
    for (const listing of listings) {
      listingsByItemId.set(listing.ebayItemId, listing);
      if (listing.ebayListingId) listingsByItemId.set(listing.ebayListingId, listing);
    }
    const missingListingIds = listingIds.filter((listingId) => !listingsByItemId.has(listingId));
    const writes = [];
    const stockShortfalls: string[] = [];

    for (const [lineIndex, lineItem] of confirmation.lineItems.entries()) {
      const listing = listingsByItemId.get(lineItem.listingId);
      if (!listing) continue;
      if (lineItem.quantity > listing.quantity) stockShortfalls.push(`${lineItem.listingId} (${lineItem.quantity} > ${listing.quantity})`);

      writes.push(db.update(ebayListings).set({
        quantity: sql`max(0, ${ebayListings.quantity} - ${lineItem.quantity})`,
        quantitySold: sql`${ebayListings.quantitySold} + ${lineItem.quantity}`,
        status: sql`CASE WHEN max(0, ${ebayListings.quantity} - ${lineItem.quantity}) = 0 THEN 'ENDED' ELSE ${ebayListings.status} END`,
        lastSyncedAt: receivedAt,
        updatedAt: receivedAt,
      }).where(eq(ebayListings.id, listing.id)));
      writes.push(db.update(inventory).set({
        availableQuantity: sql`max(0, ${inventory.availableQuantity} - ${lineItem.quantity})`,
        soldQuantity: sql`${inventory.soldQuantity} + ${lineItem.quantity}`,
        version: sql`${inventory.version} + 1`,
        status: sql`CASE WHEN max(0, ${inventory.availableQuantity} - ${lineItem.quantity}) = 0 THEN 'SOLD' ELSE 'AVAILABLE' END`,
        updatedAt: receivedAt,
      }).where(eq(inventory.productId, listing.productId)));
      writes.push(db.update(products).set({ status: "INACTIVE", updatedAt: receivedAt }).where(and(
        eq(products.id, listing.productId),
        sql`(SELECT max(0, quantity - ${lineItem.quantity}) FROM ebay_listings WHERE id = ${listing.id}) = 0`,
      )));
      writes.push(avatarEventInsert(db, {
        eventType: "CARD_SOLD",
        aggregateType: "EBAY_LISTING",
        aggregateId: listing.id,
        dedupeKey: `ebay-sale:${confirmation.notificationId}:${lineIndex}:${listing.id}`,
        payload: { productId: listing.productId, listingId: listing.id, quantity: lineItem.quantity },
        createdAt: receivedAt,
      }));
    }

    // Bestand und PROCESSED-Merker gehören in dieselbe D1-Transaktion. Sonst
    // könnte ein Fehler zwischen diesen beiden Batches dazu führen, dass eBay
    // berechtigt erneut zustellt und die Menge ein zweites Mal sinkt.
    writes.push(db.update(webhookEvents).set({ status: "PROCESSED", processedAt: receivedAt }).where(and(
      eq(webhookEvents.provider, EBAY_WEBHOOK_PROVIDER),
      eq(webhookEvents.externalEventId, confirmation.notificationId),
    )));
    await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
    const alerts = [
      ...(missingListingIds.length ? [`Nicht zugeordnetes eBay-Listing: ${missingListingIds.join(", ")}`] : []),
      ...(stockShortfalls.length ? [`eBay-Bestand war kleiner als der Verkauf: ${stockShortfalls.join(", ")}`] : []),
    ];
    if (alerts.length) {
      await notifyOperationalAlert({
        key: `ebay-notification:${confirmation.notificationId}:mapping`,
        category: "eBay-Notification",
        title: "eBay-Verkauf konnte nur teilweise zugeordnet werden",
        detail: alerts.join(" | "),
        occurredAt: receivedAt,
      });
    }

    return NextResponse.json({ ok: true, processed: true, updatedListings: listings.length });
  } catch (error) {
    console.error("eBay-Notification konnte nicht verarbeitet werden.", error);
    if (db) {
      try {
        await db.update(webhookEvents).set({
          status: "FAILED",
          processedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler.",
        }).where(and(
          eq(webhookEvents.provider, EBAY_WEBHOOK_PROVIDER),
          eq(webhookEvents.externalEventId, confirmation.notificationId),
        ));
      } catch (statusError) {
        console.error("eBay-Notification-Status konnte nicht gespeichert werden.", statusError);
      }
      if (!previousFailure) {
        await notifyOperationalAlert({
          key: `ebay-notification:${confirmation.notificationId}:failure`,
          category: "eBay-Notification",
          title: "eBay-Verkauf konnte nicht verarbeitet werden",
          detail: error instanceof Error ? error.message : "Unbekannter Fehler.",
          occurredAt: receivedAt,
        });
      }
    }
    return jsonError("eBay-Notification konnte nicht verarbeitet werden.", 503, true);
  }
}
