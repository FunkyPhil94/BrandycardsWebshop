import { eq } from "drizzle-orm";
import type { getDb } from "../../db";
import { orderItems, orders, priceOffers, products, users } from "../../db/schema";
import { getEmailConfig } from "./config.ts";
import { protokolliereVersand, sendEmail, versucheVersand } from "./send.ts";
import { accountDeleted, cardSubmissionReceived, inquiryReceived, offerAccepted, offerRejected, orderConfirmation, sellerOrderNotification } from "./templates.ts";
import { notifyOperationalAlert } from "../ops-alerts.ts";

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

async function sendeMitBetriebsalarm(
  anlass: string,
  empfaenger: string,
  nachricht: Parameters<typeof sendEmail>[1],
  alertKey: string,
  kennung: Record<string, string> = {},
): Promise<void> {
  const result = await sendEmail(empfaenger, nachricht);
  protokolliereVersand(anlass, result, kennung);
  if (result.ok) return;
  const status = result.grund === "abgelehnt" ? ` Status ${result.status}.` : "";
  await notifyOperationalAlert({
    key: `email:${alertKey}`,
    category: "E-Mail",
    title: `${anlass} nicht zugestellt`,
    detail: `Versandgrund: ${result.grund}.${status}`,
  });
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
export async function notifyOrderPaid(
  db: Db,
  orderId: string,
  /** Ob vor dem Einzug bei eBay nachgesehen wurde. Fehlt der Wert, wird nicht
   *  gewarnt — die Nachricht soll nie schlechter sein als vorher. */
  bestandspruefung?: "OK" | "FEHLGESCHLAGEN" | "NICHT_GELAUFEN",
): Promise<void> {
  // **Zwei getrennte Blöcke, und das ist wichtig.** Der Kunde bekommt seine
  // Bestätigung, der Verkäufer die Versanddaten. Lägen beide in einem Block,
  // verschluckte ein Fehler beim Zusammenbauen der einen Nachricht die andere —
  // und ohne die Verkäufernachricht weiß niemand, wohin das Paket soll.
  await versucheVersand("Bestellbestätigung", async () => {
    const daten = await bestelldaten(db, orderId);
    if (!daten) return;
    if (!daten.empfaenger) {
      console.error("[email] Bestellung ohne Empfängeradresse, keine Bestätigung.", { orderId });
      await notifyOperationalAlert({
        key: `email:order:${orderId}:customer-missing`,
        category: "E-Mail",
        title: "Bestellbestätigung nicht möglich",
        detail: "Die bezahlte Bestellung hat keine Empfängeradresse.",
      });
      return;
    }

    const nachricht = orderConfirmation({
      orderNumber: daten.order.orderNumber,
      items: daten.positionen,
      subtotal: { cents: daten.order.subtotalAmountCents, currency: daten.order.currency },
      shipping: { cents: daten.order.shippingAmountCents, currency: daten.order.currency },
      total: { cents: daten.order.totalAmountCents, currency: daten.order.currency },
      shopUrl: shopUrl(),
    });

    await sendeMitBetriebsalarm("Bestellbestätigung", daten.empfaenger, nachricht, `order:${orderId}:customer`, { orderId });
  });

  await versucheVersand("Verkäufernachricht", async () => {
    const daten = await bestelldaten(db, orderId);
    if (!daten) return;

    const adresse = lieferadresse(daten.order.shippingAddress);
    if (!adresse) {
      // Ohne Adresse ist die Nachricht wertlos — aber der Betreiber muss von
      // der Bestellung trotzdem erfahren, sonst bleibt sie unbemerkt liegen.
      console.error("[email] Bestellung ohne verwertbare Lieferadresse.", { orderId });
      await notifyOperationalAlert({
        key: `email:order:${orderId}:address-missing`,
        category: "E-Mail",
        title: "Verkäufernachricht nicht möglich",
        detail: "Die bezahlte Bestellung hat keine verwertbare Lieferadresse.",
      });
      return;
    }

    const ziel = getEmailConfig()?.sellerEmail;
    if (!ziel) return;

    const nachricht = sellerOrderNotification({
      orderNumber: daten.order.orderNumber,
      paidAt: daten.order.paidAt ?? new Date().toISOString(),
      items: daten.positionen,
      subtotal: { cents: daten.order.subtotalAmountCents, currency: daten.order.currency },
      shipping: { cents: daten.order.shippingAmountCents, currency: daten.order.currency },
      total: { cents: daten.order.totalAmountCents, currency: daten.order.currency },
      address: adresse,
      customerEmail: daten.empfaenger ?? "unbekannt",
      bestandspruefung,
      shopUrl: shopUrl(),
    });

    await sendeMitBetriebsalarm("Verkäufernachricht", ziel, nachricht, `order:${orderId}:seller`, { orderId });
  });
}

/** Bestellung, Positionen und Empfänger — von beiden Nachrichten gebraucht. */
async function bestelldaten(db: Db, orderId: string) {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return null;
  const positionen = await db.select({
    title: orderItems.titleSnapshot,
    quantity: orderItems.quantity,
    unitAmountCents: orderItems.unitAmountCents,
  }).from(orderItems).where(eq(orderItems.orderId, orderId));
  return {
    order,
    empfaenger: await empfaengerDerBestellung(db, order),
    positionen: positionen.map((p) => ({
      title: p.title,
      quantity: p.quantity,
      unitPrice: { cents: p.unitAmountCents, currency: order.currency },
    })),
  };
}

/** Die Lieferadresse aus dem JSON-Feld, geprüft statt geglaubt.
 *
 * `shipping_address` ist ein JSON-Feld ohne Schema-Zwang. Ein fehlendes Feld
 * würde sonst als „undefined" auf dem Etikett landen.
 */
function lieferadresse(wert: unknown) {
  if (!wert || typeof wert !== "object") return null;
  const a = wert as Record<string, unknown>;
  const feld = (name: string) => (typeof a[name] === "string" ? (a[name] as string).trim() : "");
  const adresse = {
    name: feld("name"), street: feld("street"), postalCode: feld("postalCode"),
    city: feld("city"), country: feld("country"),
  };
  return adresse.name && adresse.street && adresse.postalCode && adresse.city ? adresse : null;
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

    await sendeMitBetriebsalarm(
      entscheidung === "accept" ? "Preisvorschlag angenommen" : "Preisvorschlag abgelehnt",
      empfaenger,
      nachricht,
      `offer:${offerId}`,
      { offerId },
    );
  });
}

/** Eingangsbestätigung für eine Kartenanfrage. */
export async function notifyInquiryReceived(empfaenger: string, gesucht: string): Promise<void> {
  await versucheVersand("Anfragebestätigung", async () => {
    await sendeMitBetriebsalarm("Anfragebestätigung", empfaenger, inquiryReceived({ title: gesucht, shopUrl: shopUrl() }), "inquiry");
  });
}

/** Eingangsbestätigung für ein Ankaufsangebot. */
export async function notifyCardSubmissionReceived(empfaenger: string, karte: string): Promise<void> {
  await versucheVersand("Ankaufbestätigung", async () => {
    await sendeMitBetriebsalarm("Ankaufbestätigung", empfaenger, cardSubmissionReceived({ title: karte, shopUrl: shopUrl() }), "card-submission");
  });
}

/** Bestätigung einer Kontolöschung.
 *
 * `empfaenger` muss der Aufrufer **vor** dem Löschen festhalten: Danach gibt es
 * keine Kontozeile mehr, aus der sich die Adresse nachschlagen ließe.
 */
export async function notifyAccountDeleted(empfaenger: string, bestellungen: number): Promise<void> {
  await versucheVersand("Löschbestätigung", async () => {
    await sendeMitBetriebsalarm("Löschbestätigung", empfaenger, accountDeleted({ bestellungen, shopUrl: shopUrl() }), "account-deleted");
  });
}
