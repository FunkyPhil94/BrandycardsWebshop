import { eq } from "drizzle-orm";
import type { getDb } from "../../db";
import { orderItems, orders, priceOffers, products, users } from "../../db/schema";
import { getEmailConfig } from "./config.ts";
import { sendEmail, versucheVersand } from "./send.ts";
import { cardSubmissionReceived, inquiryReceived, offerAccepted, offerRejected, orderConfirmation } from "./templates.ts";

/** Die Brücke zwischen Datenbank und Vorlagen.
 *
 * Hier wird nachgeschlagen, was in einer Nachricht stehen muss. Jede Funktion
 * ist so gebaut, dass sie den Aufrufer nicht reißen kann: Sie liegt in
 * `versucheVersand`, und `sendEmail` wirft ohnehin nicht.
 *
 * **Wer diese Funktionen aufruft, muss sie nicht absichern.** Ein `await` ohne
 * `try` genügt — das ist Absicht, damit an den Aufrufstellen kein Rauschen
 * entsteht und niemand die Absicherung vergisst.
 */

type Db = ReturnType<typeof getDb>;

/** Basisadresse für Links. Ohne Konfiguration greift der Standard aus
 *  `config.ts`; der Versand fällt dann ohnehin aus, die Vorlage bleibt aber
 *  erzeugbar und damit prüfbar. */
function shopUrl(): string {
  return getEmailConfig()?.shopUrl ?? "https://shop.brandycards.de";
}

/** Die Adresse eines Bestellers: entweder das Konto oder die Gastadresse. */
async function empfaengerDerBestellung(db: Db, order: { userId: string | null; guestEmail: string | null }): Promise<string | null> {
  if (order.guestEmail) return order.guestEmail;
  if (!order.userId) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, order.userId) });
  return user?.email ?? null;
}

/** Bestellbestätigung nach erfolgreichem Zahlungseinzug.
 *
 * **Wird nur vom Gewinner des Übergangs `CREATED/APPROVED → CAPTURED`
 * aufgerufen.** Bestellungen werden auf zwei Wegen bezahlt (Rückkehr aus
 * PayPal und Webhook); ohne diesen Riegel bekäme der Kunde zwei Bestätigungen.
 */
export async function notifyOrderPaid(db: Db, orderId: string): Promise<void> {
  await versucheVersand("Bestellbestätigung", async () => {
    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) return;

    const empfaenger = await empfaengerDerBestellung(db, order);
    if (!empfaenger) {
      console.error("[email] Bestellung ohne Empfängeradresse, keine Bestätigung.", { orderId });
      return;
    }

    const positionen = await db.select({
      title: orderItems.titleSnapshot,
      quantity: orderItems.quantity,
      unitAmountCents: orderItems.unitAmountCents,
    }).from(orderItems).where(eq(orderItems.orderId, orderId));

    const nachricht = orderConfirmation({
      orderNumber: order.orderNumber,
      items: positionen.map((p) => ({
        title: p.title,
        quantity: p.quantity,
        unitPrice: { cents: p.unitAmountCents, currency: order.currency },
      })),
      subtotal: { cents: order.subtotalAmountCents, currency: order.currency },
      shipping: { cents: order.shippingAmountCents, currency: order.currency },
      total: { cents: order.totalAmountCents, currency: order.currency },
      shopUrl: shopUrl(),
    });

    const ergebnis = await sendEmail(empfaenger, nachricht);
    if (!ergebnis.ok) console.error("[email] Bestellbestätigung nicht zugestellt.", { orderId, grund: ergebnis.grund });
  });
}

/** Entscheidung über einen Preisvorschlag.
 *
 * Wird nach dem Einmal-Riegel in `app/api/admin/offers/route.ts` aufgerufen,
 * also genau einmal je Vorschlag.
 */
export async function notifyOfferDecision(db: Db, offerId: string, entscheidung: "accept" | "reject"): Promise<void> {
  await versucheVersand("Preisvorschlag", async () => {
    const offer = await db.query.priceOffers.findFirst({ where: eq(priceOffers.id, offerId) });
    if (!offer) return;

    const empfaenger = offer.guestEmail
      ?? (offer.userId ? (await db.query.users.findFirst({ where: eq(users.id, offer.userId) }))?.email ?? null : null);
    if (!empfaenger) {
      console.error("[email] Preisvorschlag ohne Empfängeradresse.", { offerId });
      return;
    }

    const product = await db.query.products.findFirst({ where: eq(products.id, offer.productId) });
    const titel = product?.title ?? "deine Karte";
    const basis = shopUrl();
    const productUrl = `${basis}/karten/${offer.productId}`;

    const nachricht = entscheidung === "accept"
      ? offerAccepted({
          title: titel,
          price: { cents: offer.proposedAmountCents, currency: offer.currency },
          // Beim Annehmen wird die Frist gesetzt; fehlt sie wider Erwarten,
          // lässt die Vorlage die Zeile weg, statt "Invalid Date" zu schreiben.
          expiresAt: offer.expiresAt ?? "",
          productUrl,
          shopUrl: basis,
        })
      : offerRejected({ title: titel, productUrl, shopUrl: basis });

    const ergebnis = await sendEmail(empfaenger, nachricht);
    if (!ergebnis.ok) console.error("[email] Angebotsnachricht nicht zugestellt.", { offerId, grund: ergebnis.grund });
  });
}

/** Eingangsbestätigung für eine Kartenanfrage. */
export async function notifyInquiryReceived(empfaenger: string, gesucht: string): Promise<void> {
  await versucheVersand("Anfragebestätigung", async () => {
    const ergebnis = await sendEmail(empfaenger, inquiryReceived({ title: gesucht, shopUrl: shopUrl() }));
    if (!ergebnis.ok) console.error("[email] Anfragebestätigung nicht zugestellt.", { grund: ergebnis.grund });
  });
}

/** Eingangsbestätigung für ein Ankaufsangebot. */
export async function notifyCardSubmissionReceived(empfaenger: string, karte: string): Promise<void> {
  await versucheVersand("Ankaufbestätigung", async () => {
    const ergebnis = await sendEmail(empfaenger, cardSubmissionReceived({ title: karte, shopUrl: shopUrl() }));
    if (!ergebnis.ok) console.error("[email] Ankaufbestätigung nicht zugestellt.", { grund: ergebnis.grund });
  });
}
