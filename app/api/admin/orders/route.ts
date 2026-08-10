import { and, count, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { orderItems, orders, payments, users } from "../../../../db/schema";
import { recordAdminAudit } from "../../../../lib/admin-audit";
import { requireAdmin } from "../../../../lib/admin-access";
import { D1_SAFE_ID_LIST } from "../../../../lib/d1-limits";
import { notifyOrderShipped } from "../../../../lib/email/notify.ts";
import { normalizeShippingCarrier, normalizeTrackingNumber } from "../../../../lib/shipping";

/** Wie viele Bestellungen die Übersicht zeigt.
 *
 * Bewusst unter `D1_SAFE_ID_LIST`: Positionen und Zahlungen werden über
 * `inArray` an diesen Ids nachgeladen, und jede Id ist ein gebundener
 * Parameter. Wer die Zahl anhebt, muss die Nachladeabfragen stückeln. */
const PAGE_SIZE = 25;
const SHIPPABLE_STATUSES = ["PAID", "PROCESSING"] as const;

type Address = { name: string; street: string; postalCode: string; city: string; country: string };

/** Die Adresse liegt als JSON in der Spalte und ist damit ungeprüft.
 *
 * Sie stammt zwar aus `cleanAddress` im Checkout, aber Bestellungen aus
 * früheren Ständen müssen das nicht erfüllen — deshalb hier noch einmal
 * feldweise lesen statt blind durchreichen. */
function address(value: unknown): Address | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const field = (name: string) => (typeof raw[name] === "string" ? (raw[name] as string).trim() : "");
  const parsed = { name: field("name"), street: field("street"), postalCode: field("postalCode"), city: field("city"), country: field("country") };
  return parsed.name && parsed.street && parsed.postalCode && parsed.city ? parsed : null;
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const db = getDb();
    const requestedPage = Number.parseInt(new URL(request.url).searchParams.get("page") ?? "1", 10);
    const safeRequestedPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const [{ value: total }] = await db.select({ value: count() }).from(orders);
    const totalPages = Math.max(1, Math.ceil(Number(total ?? 0) / PAGE_SIZE));
    const page = Math.min(safeRequestedPage, totalPages);
    const rows = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      currency: orders.currency,
      subtotalAmountCents: orders.subtotalAmountCents,
      shippingAmountCents: orders.shippingAmountCents,
      totalAmountCents: orders.totalAmountCents,
      shippingAddress: orders.shippingAddress,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      shippedAt: orders.shippedAt,
      shippingCarrier: orders.shippingCarrier,
      trackingNumber: orders.trackingNumber,
      completedAt: orders.completedAt,
      cancelledAt: orders.cancelledAt,
      refundedAt: orders.refundedAt,
      guestEmail: orders.guestEmail,
      email: users.email,
    }).from(orders)
      .leftJoin(users, eq(users.id, orders.userId))
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    if (rows.length === 0) return NextResponse.json({ orders: [], page, pageSize: PAGE_SIZE, total: Number(total ?? 0), totalPages });

    const ids = rows.map((row) => row.id).slice(0, D1_SAFE_ID_LIST);
    const [items, paymentRows] = await Promise.all([
      db.select({
        orderId: orderItems.orderId,
        title: orderItems.titleSnapshot,
        quantity: orderItems.quantity,
        unitAmountCents: orderItems.unitAmountCents,
        totalAmountCents: orderItems.totalAmountCents,
      }).from(orderItems).where(inArray(orderItems.orderId, ids)),
      db.select({
        orderId: payments.orderId,
        provider: payments.provider,
        status: payments.status,
        providerCaptureId: payments.providerCaptureId,
      }).from(payments).where(inArray(payments.orderId, ids)),
    ]);

    return NextResponse.json({
      page,
      pageSize: PAGE_SIZE,
      total: Number(total ?? 0),
      totalPages,
      orders: rows.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        currency: row.currency,
        subtotalAmountCents: row.subtotalAmountCents,
        shippingAmountCents: row.shippingAmountCents,
        totalAmountCents: row.totalAmountCents,
        createdAt: row.createdAt,
        paidAt: row.paidAt,
        shippedAt: row.shippedAt,
        shippingCarrier: row.shippingCarrier,
        trackingNumber: row.trackingNumber,
        completedAt: row.completedAt,
        cancelledAt: row.cancelledAt,
        refundedAt: row.refundedAt,
        // Gastbestellungen gibt es im Schema, im Checkout heute nicht — der
        // Rückfall hält die Ansicht trotzdem lesbar, falls doch eine auftaucht.
        email: row.email ?? row.guestEmail,
        shippingAddress: address(row.shippingAddress),
        items: items.filter((item) => item.orderId === row.id)
          .map((item) => ({ title: item.title, quantity: item.quantity, unitAmountCents: item.unitAmountCents, totalAmountCents: item.totalAmountCents })),
        // Eine Bestellung kann mehrere Zahlungsversuche haben; für die Übersicht
        // zählt der jüngste Stand, die Liste bleibt für den Notfall vollständig.
        payments: paymentRows.filter((payment) => payment.orderId === row.id)
          .map((payment) => ({ provider: payment.provider, status: payment.status, providerCaptureId: payment.providerCaptureId })),
      })),
    });
  } catch (error) {
    console.error("admin order list failed", error);
    return NextResponse.json({ error: "Bestellungen konnten nicht geladen werden." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request, { recentAuthSeconds: 600 });
  if (guard.response) return guard.response;

  try {
    const body = await request.json() as { orderId?: unknown; status?: unknown; shippingCarrier?: unknown; trackingNumber?: unknown };
    if (typeof body.orderId !== "string" || !body.orderId.trim()) {
      return NextResponse.json({ error: "Eine Bestellnummer fehlt." }, { status: 400 });
    }
    if (body.status !== "SHIPPED" && body.status !== "COMPLETED") {
      return NextResponse.json({ error: "Es kann nur auf versendet oder abgeschlossen gesetzt werden." }, { status: 400 });
    }

    const orderId = body.orderId.trim();
    const now = new Date().toISOString();
    const nextStatus = body.status;
    const carrier = normalizeShippingCarrier(body.shippingCarrier);
    const trackingNumber = normalizeTrackingNumber(body.trackingNumber);
    if (nextStatus === "SHIPPED" && body.trackingNumber != null && typeof body.trackingNumber === "string" && body.trackingNumber.trim() && !trackingNumber) {
      return NextResponse.json({ error: "Die Trackingnummer enthält ungültige Zeichen oder ist zu lang." }, { status: 400 });
    }
    if (nextStatus === "SHIPPED" && body.shippingCarrier != null && typeof body.shippingCarrier === "string" && body.shippingCarrier.trim() && !carrier) {
      return NextResponse.json({ error: "Der Versanddienstleister wird nicht unterstützt." }, { status: 400 });
    }
    const result = nextStatus === "SHIPPED"
      ? await getDb().update(orders)
        .set({ status: "SHIPPED", shippedAt: now, shippingCarrier: carrier, trackingNumber, updatedAt: now })
        .where(and(eq(orders.id, orderId), inArray(orders.status, [...SHIPPABLE_STATUSES])))
        .run()
      : await getDb().update(orders)
        .set({ status: "COMPLETED", completedAt: now, updatedAt: now })
        .where(and(eq(orders.id, orderId), eq(orders.status, "SHIPPED")))
        .run();

    if (result.meta.changes === 1) {
      await recordAdminAudit({ request, actorUserId: guard.user.id, action: "order.status_change", entityType: "order", entityId: orderId, metadata: { status: nextStatus, ...(carrier ? { shippingCarrier: carrier } : {}), ...(trackingNumber ? { trackingNumber } : {}) } });
      if (nextStatus === "SHIPPED") await notifyOrderShipped(getDb(), orderId);
      return NextResponse.json({ orderId, status: nextStatus, shippedAt: nextStatus === "SHIPPED" ? now : undefined, completedAt: nextStatus === "COMPLETED" ? now : undefined });
    }

    const existing = await getDb().select({ status: orders.status }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (existing.length === 0) return NextResponse.json({ error: "Unbekannte Bestellung." }, { status: 404 });
    if (existing[0].status === nextStatus) return NextResponse.json({ orderId, status: nextStatus });
    return NextResponse.json({ error: `Bestellung steht auf ${existing[0].status} und kann nicht auf ${nextStatus === "SHIPPED" ? "versendet" : "abgeschlossen"} gesetzt werden.` }, { status: 409 });
  } catch (error) {
    console.error("admin order update failed", error);
    return NextResponse.json({ error: "Bestellung konnte nicht aktualisiert werden." }, { status: 503 });
  }
}
