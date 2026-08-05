import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { webhookEvents } from "../../../../db/schema";
import { getPayPalConfig } from "../../../../lib/paypal/config";
import { verifyPayPalWebhookSignature } from "../../../../lib/paypal/client";

type PayPalWebhookEvent = { id?: unknown; event_type?: unknown };

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const config = getPayPalConfig();
    if (!config.webhookId) return NextResponse.json({ error: "PayPal-Webhook ist noch nicht konfiguriert." }, { status: 503 });
    const event = JSON.parse(rawBody) as PayPalWebhookEvent;
    const eventId = typeof event.id === "string" ? event.id : "";
    const eventType = typeof event.event_type === "string" ? event.event_type : "";
    if (!eventId || !eventType) return NextResponse.json({ error: "Ungültiges Webhook-Ereignis." }, { status: 400 });

    const header = (name: string) => request.headers.get(name) ?? "";
    const verified = await verifyPayPalWebhookSignature({ body: rawBody, webhookId: config.webhookId, transmissionId: header("paypal-transmission-id"), transmissionTime: header("paypal-transmission-time"), certUrl: header("paypal-cert-url"), authAlgo: header("paypal-auth-algo"), transmissionSig: header("paypal-transmission-sig") });
    if (!verified) return NextResponse.json({ error: "Ungültige Webhook-Signatur." }, { status: 400 });

    const db = getDb();
    const existing = await db.query.webhookEvents.findFirst({ where: and(eq(webhookEvents.provider, "PAYPAL"), eq(webhookEvents.externalEventId, eventId)) });
    if (existing) return NextResponse.json({ ok: true, duplicate: true });
    await db.insert(webhookEvents).values({ provider: "PAYPAL", externalEventId: eventId, eventType, status: "RECEIVED", payload: event, receivedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, accepted: true }, { status: 202 });
  } catch (error) {
    console.error("PayPal webhook failed", error);
    return NextResponse.json({ error: "Webhook konnte nicht verarbeitet werden." }, { status: 400 });
  }
}
