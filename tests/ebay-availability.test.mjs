import assert from "node:assert/strict";
import test from "node:test";

// Die Bestandsprüfung vor der Zahlung fragt eBay per GetItem. Geprüft wird
// hier gegen echte Antwortformen, nicht gegen das echte Konto: `fetch` wird
// gestubbt wie in tests/ebay-active-list.test.mjs.

const { getEbayAvailability, parseItemAvailability } = await import("../lib/ebay-client.ts");

function antwort({ itemId, quantity, quantitySold, quantityAvailable, listingStatus = "Active" }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <Item>
    <ItemID>${itemId}</ItemID>
    <Title>Testkarte ${itemId}</Title>
    ${quantity === undefined ? "" : `<Quantity>${quantity}</Quantity>`}
    ${quantityAvailable === undefined ? "" : `<QuantityAvailable>${quantityAvailable}</QuantityAvailable>`}
    <SellingStatus>
      ${quantitySold === undefined ? "" : `<QuantitySold>${quantitySold}</QuantitySold>`}
      <ListingStatus>${listingStatus}</ListingStatus>
    </SellingStatus>
  </Item>
</GetItemResponse>`;
}

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.includes("/identity/v1/oauth2/token")) {
      calls.push("token");
      return new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 });
    }
    const body = String(init?.body ?? "");
    const itemId = body.match(/<ItemID>(\d+)<\/ItemID>/)?.[1] ?? "";
    calls.push(itemId);
    return handler(itemId);
  };
  return calls;
}

function setzeZugangsdaten() {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  process.env.EBAY_REFRESH_TOKEN = "refresh";
}

// --- Auswertung einer Antwort ----------------------------------------------

test("QuantityAvailable wird gelesen, wenn eBay es liefert", () => {
  const result = parseItemAvailability(antwort({ itemId: "1", quantityAvailable: 0, quantity: 1, quantitySold: 1 }));
  assert.equal(result.quantityAvailable, 0);
  assert.equal(result.listingStatus, "Active");
});

test("ohne QuantityAvailable wird aus Quantity minus QuantitySold gerechnet", () => {
  // eBay liefert das Feld nicht in jeder Antwortform; die Differenz sagt dasselbe.
  assert.equal(parseItemAvailability(antwort({ itemId: "1", quantity: 3, quantitySold: 3 })).quantityAvailable, 0);
  assert.equal(parseItemAvailability(antwort({ itemId: "1", quantity: 3, quantitySold: 1 })).quantityAvailable, 2);
});

test("eine Antwort ohne verwertbare Mengen ergibt unbekannt, nicht null Stück", () => {
  // Der Unterschied entscheidet: unbekannt lässt den Kauf durch, 0 blockiert ihn.
  const result = parseItemAvailability(antwort({ itemId: "1" }));
  assert.equal(result.quantityAvailable, null, "unbekannt muss null sein, nicht 0");
});

test("der Angebotsstatus wird mitgelesen", () => {
  assert.equal(parseItemAvailability(antwort({ itemId: "1", quantityAvailable: 1, listingStatus: "Completed" })).listingStatus, "Completed");
});

// --- Die Abfrage ------------------------------------------------------------

test("ein Tokenaufruf für die ganze Bestellung, danach ein GetItem je Karte", async () => {
  setzeZugangsdaten();
  const calls = stubFetch((itemId) => new Response(antwort({ itemId, quantityAvailable: 1 }), { status: 200 }));

  const result = await getEbayAvailability(["111", "222", "333"]);

  assert.equal(calls.filter((call) => call === "token").length, 1, "der Token darf nicht je Karte geholt werden");
  assert.deepEqual(calls.filter((call) => call !== "token"), ["111", "222", "333"]);
  assert.equal(result.size, 3);
  assert.equal(result.get("222").quantityAvailable, 1);
});

test("doppelte und unsaubere ItemIDs werden zusammengefasst", async () => {
  setzeZugangsdaten();
  const calls = stubFetch((itemId) => new Response(antwort({ itemId, quantityAvailable: 1 }), { status: 200 }));

  await getEbayAvailability(["111", "111", " 111 ", ""]);

  assert.deepEqual(calls.filter((call) => call !== "token"), ["111"], "eine Karte, ein Aufruf");
});

// --- Ausfälle dürfen nichts blockieren --------------------------------------

test("eine Karte mit HTTP-Fehler fehlt im Ergebnis statt als ausverkauft zu gelten", async () => {
  setzeZugangsdaten();
  stubFetch((itemId) => itemId === "222"
    ? new Response("kaputt", { status: 500 })
    : new Response(antwort({ itemId, quantityAvailable: 1 }), { status: 200 }));

  const result = await getEbayAvailability(["111", "222", "333"]);

  assert.equal(result.has("222"), false, "kein Eintrag heißt unbekannt; ein Eintrag mit 0 hieße ausverkauft");
  assert.equal(result.size, 2, "die übrigen Karten werden trotzdem geprüft");
});

test("eine eBay-Fehlermeldung zählt ebenfalls als unbekannt", async () => {
  setzeZugangsdaten();
  stubFetch(() => new Response(`<?xml version="1.0"?><GetItemResponse><Ack>Failure</Ack><Errors><LongMessage>Invalid item ID.</LongMessage></Errors></GetItemResponse>`, { status: 200 }));

  assert.equal((await getEbayAvailability(["111"])).size, 0);
});

test("ohne ItemIDs wird eBay gar nicht erst gefragt", async () => {
  setzeZugangsdaten();
  const calls = stubFetch(() => new Response("", { status: 200 }));

  assert.equal((await getEbayAvailability([])).size, 0);
  assert.equal(calls.length, 0, "auch kein Tokenaufruf");
});
