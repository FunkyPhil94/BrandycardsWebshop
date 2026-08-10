import assert from "node:assert/strict";
import test from "node:test";

const {
  accountDeleted,
  cardSubmissionReceived,
  inquiryReceived,
  offerAccepted,
  offerRejected,
  orderConfirmation,
  orderRefunded,
  orderShipped,
  sellerOrderNotification,
} = await import("../lib/email/templates.ts");

const SHOP = "https://shop.brandycards.de";
const EUR = (cents) => ({ cents, currency: "EUR" });
const ORDER = {
  orderNumber: "BC-20260810-N6",
  items: [{ title: "Topps Chrome Musiala", quantity: 1, unitPrice: EUR(1200) }],
  subtotal: EUR(1200),
  shipping: EUR(345),
  total: EUR(1545),
  shopUrl: SHOP,
  locale: "en",
};

test("customer transaction emails use English copy and formatting", () => {
  const messages = [
    orderConfirmation(ORDER),
    orderShipped({ orderNumber: ORDER.orderNumber, shippedAt: "2026-08-10T12:00:00.000Z", carrier: "DHL", trackingNumber: "00340434161094000000", trackingUrl: "https://www.dhl.de/track", shopUrl: SHOP, locale: "en" }),
    orderRefunded({ orderNumber: ORDER.orderNumber, amount: ORDER.total, shopUrl: SHOP, locale: "en" }),
    offerAccepted({ title: "Topps Chrome Musiala", price: EUR(999), expiresAt: "2026-08-12T12:00:00.000Z", productUrl: `${SHOP}/karten/card`, shopUrl: SHOP, locale: "en" }),
    offerRejected({ title: "Topps Chrome Musiala", productUrl: `${SHOP}/karten/card`, shopUrl: SHOP, locale: "en" }),
    inquiryReceived({ title: "Topps Chrome Musiala", shopUrl: SHOP, locale: "en" }),
    cardSubmissionReceived({ title: "Topps Chrome Musiala", shopUrl: SHOP, locale: "en" }),
    accountDeleted({ bestellungen: 1, shopUrl: SHOP, locale: "en" }),
  ];

  for (const message of messages) {
    assert.ok(message.subject.length > 0);
    assert.match(message.text, /Best wishes|Thank you|Your|New|About/);
    assert.match(message.html, /Legal notice/);
    assert.doesNotMatch(message.text, /Deine|deine|Bestellung|Versendet|Erstattung|Viele Grüße/u);
    assert.doesNotMatch(message.html, /Impressum|Datenschutz/u);
  }
});

test("seller email and stock warning can be generated in English", () => {
  const message = sellerOrderNotification({
    ...ORDER,
    paidAt: "2026-08-10T12:00:00.000Z",
    address: { name: "Erika Mustermann", street: "Musterweg 12", postalCode: "51373", city: "Leverkusen", country: "DE" },
    customerEmail: "customer@example.org",
    bestandspruefung: "FEHLGESCHLAGEN",
  });
  assert.match(message.subject, /New order/);
  assert.match(message.text, /DELIVERY ADDRESS/);
  assert.match(message.text, /WARNING/);
  assert.match(message.html, /Shipping/);
  assert.doesNotMatch(message.text, /LIEFERADRESSE|ACHTUNG|Zwischensumme/u);
});
