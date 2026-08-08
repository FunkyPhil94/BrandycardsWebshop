import assert from "node:assert/strict";
import test from "node:test";

// Der eBay-Schreibpfad (docs/ai-todo.md, Punkt 6). Die unangenehmere Richtung
// des Doppelverkaufs: im Shop verkauft, eBay weiß es nicht. Ein Storno bei eBay
// verschlechtert den Verkäuferstatus, das wirkt über den Einzelfall hinaus.
//
// Der Fehler, der hier festgenagelt wird: Die Warteschlange adressierte über
// die Inventory-API-OfferID. `GetMyeBaySelling` liefert die nie — jeder Aufruf
// stieg an der fehlenden Kennung aus, und die Outbox bekam **seit ihrem Bau
// keinen einzigen Auftrag**. Deshalb prüft die erste Gruppe genau das: dass
// eine fehlende OfferID das Einreihen nicht mehr verhindert.
//
// Gegen eBay wird nichts ausgeführt; `fetch` wird gestubbt wie in
// tests/ebay-availability.test.mjs.

const { planeEbayRuecknahme, bestimmeAuftragsziel, REVISE_QUANTITY, WITHDRAW_OFFER } =
  await import("../lib/ebay-outbox-plan.ts");
const { reviseEbayItemQuantity, tradingErrorCodes } = await import("../lib/ebay-client.ts");

function listing(abweichung = {}) {
  return {
    id: "listing-1",
    ebayItemId: "123456789012",
    ebayOfferId: null,
    listingType: "FIXED_PRICE",
    ...abweichung,
  };
}

test("ohne OfferID wird trotzdem eingereiht — das war der ganze Fehler", () => {
  const plan = planeEbayRuecknahme(listing({ ebayOfferId: null }));
  assert.equal(plan.einreihen, true);
  assert.equal(plan.operation, REVISE_QUANTITY);
  assert.equal(plan.ebayItemId, "123456789012");
  assert.equal(plan.zielmenge, 0);
});

test("adressiert wird über die ItemID, auch wenn eine OfferID vorhanden ist", () => {
  const plan = planeEbayRuecknahme(listing({ ebayOfferId: "offer-9" }));
  assert.equal(plan.einreihen, true);
  assert.equal(plan.ebayItemId, "123456789012");
  // Die OfferID wird mitgeschrieben, aber sie entscheidet nichts mehr.
  assert.equal(plan.ebayOfferId, "offer-9");
  assert.equal(plan.operation, REVISE_QUANTITY);
});

test("ohne ItemID gibt es nichts zu adressieren", () => {
  const plan = planeEbayRuecknahme(listing({ ebayItemId: null }));
  assert.equal(plan.einreihen, false);
  assert.equal(plan.grund, "KEINE_ITEM_ID");
});

test("Auktionen werden nicht eingereiht — ihre Menge ist nicht änderbar", () => {
  const plan = planeEbayRuecknahme(listing({ listingType: "AUCTION" }));
  assert.equal(plan.einreihen, false);
  assert.equal(plan.grund, "AUKTION");
});

test("der Dedupe-Schlüssel hängt am Listing, nicht an der OfferID", () => {
  // Zweimal abgerechnet, derselbe Schlüssel: die eindeutige Bedingung auf
  // dedupe_key verhindert den zweiten Auftrag.
  const a = planeEbayRuecknahme(listing());
  const b = planeEbayRuecknahme(listing({ ebayOfferId: "spaeter-nachgetragen" }));
  assert.equal(a.dedupeKey, b.dedupeKey);
  assert.equal(a.dedupeKey, "listing:listing-1:revise-quantity:0");
});

test("zwei verschiedene Listings teilen sich keinen Schlüssel", () => {
  const a = planeEbayRuecknahme(listing({ id: "listing-1" }));
  const b = planeEbayRuecknahme(listing({ id: "listing-2" }));
  assert.notEqual(a.dedupeKey, b.dedupeKey);
});

test("neue Aufträge laufen über die ItemID", () => {
  const ziel = bestimmeAuftragsziel({ operation: REVISE_QUANTITY, ebayItemId: "123", ebayOfferId: null });
  assert.deepEqual(ziel, { aufruf: REVISE_QUANTITY, ebayItemId: "123", menge: 0 });
});

test("Aufträge im alten Format werden weiterhin bedient", () => {
  // Sonst scheitert eine solche Zeile bei jedem Versuch bis FAILED, und die
  // Ursache läge im Verarbeiter statt bei eBay.
  const ziel = bestimmeAuftragsziel({ operation: WITHDRAW_OFFER, ebayItemId: null, ebayOfferId: "offer-9" });
  assert.deepEqual(ziel, { aufruf: WITHDRAW_OFFER, ebayOfferId: "offer-9" });
});

test("unvollständige und unbekannte Aufträge scheitern mit Aussage", () => {
  assert.throws(() => bestimmeAuftragsziel({ operation: REVISE_QUANTITY, ebayItemId: null, ebayOfferId: "o" }), /ohne ItemID/);
  assert.throws(() => bestimmeAuftragsziel({ operation: WITHDRAW_OFFER, ebayItemId: "1", ebayOfferId: null }), /ohne OfferID/);
  assert.throws(() => bestimmeAuftragsziel({ operation: "TANZEN", ebayItemId: "1", ebayOfferId: "o" }), /Unbekannte eBay-Outbox-Operation/);
});

// --- Der Aufruf bei eBay ------------------------------------------------

function setzeZugangsdaten() {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  process.env.EBAY_REFRESH_TOKEN = "refresh";
  process.env.EBAY_ENVIRONMENT = "production";
  delete process.env.EBAY_WRITE_OAUTH_SCOPE;
}

/** Eine eBay-API, die antwortet wie gewünscht, und alles mitschreibt. */
function stubEbay(antwortXml) {
  const calls = [];
  globalThis.fetch = (url, init) => {
    if (String(url).includes("/identity/")) {
      calls.push({ art: "token", body: String(init?.body ?? "") });
      return Promise.resolve(new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 }));
    }
    calls.push({ art: "trading", body: String(init?.body ?? ""), headers: init?.headers ?? {} });
    return Promise.resolve(new Response(antwortXml, { status: 200 }));
  };
  return calls;
}

const ERFOLG = `<?xml version="1.0"?><ReviseInventoryStatusResponse><Ack>Success</Ack></ReviseInventoryStatusResponse>`;

test("setzt die Menge auf 0 und nennt den richtigen Trading-Aufruf", async () => {
  setzeZugangsdaten();
  const calls = stubEbay(ERFOLG);
  const ergebnis = await reviseEbayItemQuantity("123456789012", 0);
  assert.equal(ergebnis, "REVISED");

  const trading = calls.find((call) => call.art === "trading");
  assert.equal(trading.headers["X-EBAY-API-CALL-NAME"], "ReviseInventoryStatus");
  assert.match(trading.body, /<ItemID>123456789012<\/ItemID>/);
  assert.match(trading.body, /<Quantity>0<\/Quantity>/);
});

test("fordert den Schreib-Scope an, nicht den Lese-Scope", async () => {
  // Der wahrscheinlichste Grund, warum der erste echte Aufruf scheitert:
  // Lesend genügt sell.inventory.readonly, schreibend nicht.
  setzeZugangsdaten();
  const calls = stubEbay(ERFOLG);
  await reviseEbayItemQuantity("123456789012", 0);

  const token = calls.find((call) => call.art === "token");
  assert.match(token.body, /scope=/);
  assert.match(decodeURIComponent(token.body), /api_scope\/sell\.inventory(?!\.readonly)/);
});

test("ein bereits beendetes Angebot gilt als Erfolg, nicht als Fehler", async () => {
  // Das Ziel ist, dass die Karte nicht mehr verkäuflich ist — und das ist sie
  // dann nicht. Ein Wiederholen würde für immer scheitern.
  setzeZugangsdaten();
  stubEbay(`<?xml version="1.0"?><ReviseInventoryStatusResponse><Ack>Failure</Ack><Errors><ErrorCode>21916750</ErrorCode><LongMessage>Listing has already ended.</LongMessage></Errors></ReviseInventoryStatusResponse>`);
  assert.equal(await reviseEbayItemQuantity("123456789012", 0), "ALREADY_ENDED");
});

test("jeder andere eBay-Fehler wird durchgereicht und wiederholt", async () => {
  setzeZugangsdaten();
  stubEbay(`<?xml version="1.0"?><ReviseInventoryStatusResponse><Ack>Failure</Ack><Errors><ErrorCode>931</ErrorCode><LongMessage>Auth token is invalid.</LongMessage></Errors></ReviseInventoryStatusResponse>`);
  await assert.rejects(() => reviseEbayItemQuantity("123456789012", 0), /Auth token is invalid/);
});

test("unbrauchbare Eingaben erreichen eBay gar nicht", async () => {
  setzeZugangsdaten();
  const calls = stubEbay(ERFOLG);
  await assert.rejects(() => reviseEbayItemQuantity("keine-zahl", 0), /ItemID/);
  await assert.rejects(() => reviseEbayItemQuantity("123456789012", -1), /nicht-negative/);
  await assert.rejects(() => reviseEbayItemQuantity("123456789012", 1.5), /ganze Zahl/);
  assert.equal(calls.length, 0);
});

test("Fehlernummern werden gelesen, nicht der übersetzbare Fließtext", () => {
  const xml = `<Errors><ErrorCode>291</ErrorCode></Errors><Errors><ErrorCode>37</ErrorCode></Errors>`;
  assert.deepEqual(tradingErrorCodes(xml), ["291", "37"]);
  assert.deepEqual(tradingErrorCodes("<Ack>Success</Ack>"), []);
});
