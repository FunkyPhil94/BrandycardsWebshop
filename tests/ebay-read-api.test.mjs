import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  EBAY_ANALYTICS_READ_SCOPE,
  EBAY_TRAFFIC_WINDOW_DAYS,
  EbayReadError,
  boundedDetail,
  boundedText,
  classifyRestFailure,
  classifyTokenFailure,
  classifyTradingFailure,
  fetchEbayBuyerOffers,
  fetchEbayInboxMessages,
  fetchEbayListingTraffic,
  parseBestOffers,
  parseInboxMessages,
  parseTrafficReport,
  trafficWindow,
} = await import("../lib/ebay-read-api.ts");

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function withEbayEnv() {
  process.env.EBAY_CLIENT_ID = "test-client";
  process.env.EBAY_CLIENT_SECRET = "test-secret";
  process.env.EBAY_REFRESH_TOKEN = "test-refresh";
  process.env.EBAY_MARKETPLACE_ID = "EBAY_DE";
  process.env.EBAY_ENVIRONMENT = "production";
}

// ---------------------------------------------------------------------------
// 1. Aufrufzahlen -- getTrafficReport
// ---------------------------------------------------------------------------

const TRAFFIC_HEADER = {
  dimensionKeys: [{ key: "LISTING_ID" }],
  metrics: [{ key: "LISTING_VIEWS_TOTAL" }, { key: "LISTING_IMPRESSION_TOTAL" }],
};

test("der Traffic-Report wird ueber den Kopf zugeordnet, nicht ueber die Position", () => {
  // **Der eigentliche Punkt dieses Tests.** eBay liefert `metricValues` in der
  // Reihenfolge von `header.metrics`. Hier steht sie umgekehrt zur Anfrage --
  // wer die Position fest verdrahtet, vertauscht Aufrufe und Einblendungen,
  // und zwar lautlos, weil beides Zahlen sind.
  const { records } = parseTrafficReport({
    header: {
      dimensionKeys: [{ key: "LISTING_ID" }],
      metrics: [{ key: "LISTING_IMPRESSION_TOTAL" }, { key: "LISTING_VIEWS_TOTAL" }],
    },
    records: [{
      dimensionValues: [{ value: "398200679813" }],
      metricValues: [{ value: 900, applicable: true }, { value: 42, applicable: true }],
    }],
  });
  assert.deepEqual(records, [{ ebayItemId: "398200679813", viewsTotal: 42, impressionsTotal: 900 }]);
});

test("nicht anwendbare Kennzahlen werden null, nicht null Aufrufe", () => {
  const { records } = parseTrafficReport({
    header: TRAFFIC_HEADER,
    records: [{
      dimensionValues: [{ value: "1" }],
      metricValues: [{ value: 0, applicable: false }, { value: 7, applicable: true }],
    }],
  });
  assert.equal(records[0].viewsTotal, null, "applicable:false heisst 'keine Auskunft', nicht 'keine Aufrufe'");
  assert.equal(records[0].impressionsTotal, 7);
});

test("ein leerer Traffic-Report ist kein Fehler", () => {
  assert.deepEqual(parseTrafficReport({ header: TRAFFIC_HEADER, records: [] }), { records: [], lastUpdatedAt: null });
  assert.deepEqual(parseTrafficReport({ header: TRAFFIC_HEADER }).records, []);
});

test("kaputte Traffic-Zeilen fliegen raus, statt den ganzen Abruf zu versenken", () => {
  const { records } = parseTrafficReport({
    header: TRAFFIC_HEADER,
    records: [
      { dimensionValues: [{ value: "keine-nummer" }], metricValues: [{ value: 5 }, { value: 5 }] },
      { dimensionValues: [], metricValues: [] },
      null,
      { dimensionValues: [{ value: "42" }], metricValues: [{ value: "13" }, { value: null }] },
    ],
  });
  assert.deepEqual(records, [{ ebayItemId: "42", viewsTotal: 13, impressionsTotal: null }]);
});

test("fehlt die Kennzahl im Kopf, wird sie nicht erfunden", () => {
  const { records } = parseTrafficReport({
    header: { metrics: [{ key: "SALES_CONVERSION_RATE" }] },
    records: [{ dimensionValues: [{ value: "1" }], metricValues: [{ value: 3 }] }],
  });
  assert.deepEqual(records, [{ ebayItemId: "1", viewsTotal: null, impressionsTotal: null }]);
});

test("der Datenstand ist der des Reports, nicht der des Abrufs", () => {
  const { lastUpdatedAt } = parseTrafficReport({
    header: TRAFFIC_HEADER, records: [], lastUpdatedDate: "2026-08-15T04:00:00.000Z",
  });
  assert.equal(lastUpdatedAt, "2026-08-15T04:00:00.000Z");
  assert.equal(parseTrafficReport({ header: TRAFFIC_HEADER, records: [], lastUpdatedDate: "unsinn" }).lastUpdatedAt, null);
});

test("eine Antwort, die gar kein Objekt ist, wird als Fehler gemeldet", () => {
  assert.throws(() => parseTrafficReport("<html>Wartungsarbeiten</html>"), EbayReadError);
  assert.throws(() => parseTrafficReport(null), EbayReadError);
});

test("das Zeitfenster endet gestern und ist so lang wie angekuendigt", () => {
  const { start, end } = trafficWindow(new Date("2026-08-16T09:00:00.000Z"));
  assert.equal(end, "20260815", "der laufende Tag ist bei eBay noch nicht ausgezaehlt");
  assert.equal(start, "20260717");
  const tage = (Date.parse("2026-08-15") - Date.parse("2026-07-17")) / 86_400_000 + 1;
  assert.equal(tage, EBAY_TRAFFIC_WINDOW_DAYS);
  assert.ok(EBAY_TRAFFIC_WINDOW_DAYS <= 90, "eBay laesst hoechstens 90 Tage zu");
});

// ---------------------------------------------------------------------------
// 2. Postfach -- GetMyMessages
// ---------------------------------------------------------------------------

const MESSAGE = (id, { subject = "Frage zur Karte", sender = "kaeufer1", read = "false", itemId = "" } = {}) => `
  <Message>
    <MessageID>${id}</MessageID>
    <Sender>${sender}</Sender>
    <Subject>${subject}</Subject>
    <ReceiveDate>2026-08-15T10:00:00.000Z</ReceiveDate>
    <Read>${read}</Read>
    ${itemId ? `<ItemID>${itemId}</ItemID>` : ""}
  </Message>`;

const messagesResponse = (inner, ack = "Success") =>
  `<?xml version="1.0" encoding="utf-8"?><GetMyMessagesResponse xmlns="urn:ebay:apis:eBLBaseComponents">`
  + `<Ack>${ack}</Ack><Messages>${inner}</Messages></GetMyMessagesResponse>`;

test("Postfach-Kopfdaten werden vollstaendig gelesen", () => {
  const messages = parseInboxMessages(messagesResponse(MESSAGE("m1", { itemId: "398200679813" })));
  assert.deepEqual(messages, [{
    ebayMessageId: "m1",
    sender: "kaeufer1",
    subject: "Frage zur Karte",
    ebayItemId: "398200679813",
    receivedAt: "2026-08-15T10:00:00.000Z",
    read: false,
  }]);
});

test("ein leeres Postfach ist eine gueltige Antwort", () => {
  assert.deepEqual(parseInboxMessages(messagesResponse("")), []);
  assert.deepEqual(parseInboxMessages(`<?xml version="1.0"?><GetMyMessagesResponse><Ack>Success</Ack></GetMyMessagesResponse>`), []);
});

test("dieselbe Nachricht aus zwei Ordnern zaehlt einmal", () => {
  const messages = parseInboxMessages(messagesResponse(MESSAGE("m1") + MESSAGE("m1") + MESSAGE("m2")));
  assert.deepEqual(messages.map((message) => message.ebayMessageId), ["m1", "m2"]);
});

test("Nachrichten ohne Kennung und ohne Betreff werden nicht erfunden", () => {
  const messages = parseInboxMessages(messagesResponse(
    `<Message><Sender>x</Sender><Subject>ohne id</Subject></Message>` + MESSAGE("m9", { subject: "" }),
  ));
  assert.equal(messages.length, 1, "ohne MessageID gibt es keine stabile Identitaet");
  assert.equal(messages[0].subject, "Nachricht ohne Betreff");
  assert.equal(messages[0].receivedAt, "2026-08-15T10:00:00.000Z");
});

test("ueberlange Felder werden gekuerzt, damit eBay nicht die Zeilengroesse bestimmt", () => {
  const messages = parseInboxMessages(messagesResponse(MESSAGE("m1", { subject: "A".repeat(5000), sender: "B".repeat(500) })));
  assert.equal(messages[0].subject.length, 200);
  assert.equal(messages[0].sender.length, 64);
});

test("der Lesestatus wird uebernommen, nicht geraten", () => {
  assert.equal(parseInboxMessages(messagesResponse(MESSAGE("m1", { read: "true" })))[0].read, true);
  assert.equal(parseInboxMessages(messagesResponse(MESSAGE("m1", { read: "false" })))[0].read, false);
  assert.equal(parseInboxMessages(messagesResponse(`<Message><MessageID>m1</MessageID></Message>`))[0].read, false);
});

// ---------------------------------------------------------------------------
// 3. Kaeufer-Preisvorschlaege -- GetBestOffers
// ---------------------------------------------------------------------------

const OFFER = (id, { price = "12.50", status = "Pending", message = "", quantity = "1" } = {}) => `
      <BestOffer>
        <BestOfferID>${id}</BestOfferID>
        <Price currencyID="EUR">${price}</Price>
        <Quantity>${quantity}</Quantity>
        <Status>${status}</Status>
        ${message ? `<BuyerMessage>${message}</BuyerMessage>` : ""}
        <ExpirationTime>2026-08-18T10:00:00.000Z</ExpirationTime>
        <Buyer><UserID>kaeufer1</UserID></Buyer>
      </BestOffer>`;

const offersResponse = (items, ack = "Success") =>
  `<?xml version="1.0" encoding="utf-8"?><GetBestOffersResponse xmlns="urn:ebay:apis:eBLBaseComponents">`
  + `<Ack>${ack}</Ack><ItemBestOffersArray>${items}</ItemBestOffersArray></GetBestOffersResponse>`;

const itemOffers = (itemId, offers) =>
  `<ItemBestOffers><Item><ItemID>${itemId}</ItemID></Item><BestOfferArray>${offers}</BestOfferArray></ItemBestOffers>`;

test("die dreifache Schachtelung wird von aussen nach innen gelesen", () => {
  // ItemBestOffersArray > ItemBestOffers > (Item, BestOfferArray > BestOffer).
  // Alle Ebenen fangen gleich an; flach gesucht mischten sie sich.
  const offers = parseBestOffers(offersResponse(
    itemOffers("398200679813", OFFER("o1") + OFFER("o2", { price: "15.00" }))
    + itemOffers("398173913889", OFFER("o3", { price: "9.99", message: "Geht das?" })),
  ));
  assert.deepEqual(offers.map((offer) => [offer.bestOfferId, offer.ebayItemId, offer.amountCents]), [
    ["o1", "398200679813", 1250],
    ["o2", "398200679813", 1500],
    ["o3", "398173913889", 999],
  ]);
  assert.equal(offers[2].hasBuyerMessage, true);
  assert.equal(offers[0].hasBuyerMessage, false);
});

test("kein Kaeufername und kein Nachrichtentext landen im Ergebnis", () => {
  // Datensparsamkeit als Zusicherung, nicht als Absicht: Wenn das Feld nicht
  // existiert, kann es auch nicht versehentlich gespeichert werden.
  const [offer] = parseBestOffers(offersResponse(itemOffers("1", OFFER("o1", { message: "Ich zahle sofort, Gruss Max" }))));
  assert.equal(Object.hasOwn(offer, "buyer"), false);
  assert.equal(Object.hasOwn(offer, "buyerMessage"), false);
  assert.equal(JSON.stringify(offer).includes("kaeufer1"), false);
  assert.equal(JSON.stringify(offer).includes("Max"), false);
  assert.equal(offer.hasBuyerMessage, true, "dass es eine Nachricht gab, darf man wissen");
});

test("BestOfferType nennt keinen Eingangszeitpunkt, also gibt es kein Feld dafuer", () => {
  const [offer] = parseBestOffers(offersResponse(itemOffers("1", OFFER("o1"))));
  assert.equal(Object.hasOwn(offer, "receivedAt"), false,
    "aus der 48-Stunden-Frist einen Eingang zurueckzurechnen waere geraten");
  assert.equal(offer.expiresAt, "2026-08-18T10:00:00.000Z");
});

test("keine offenen Vorschlaege ist eine gueltige Antwort", () => {
  assert.deepEqual(parseBestOffers(offersResponse("")), []);
  assert.deepEqual(parseBestOffers(offersResponse(itemOffers("1", ""))), []);
});

test("luckenhafte Vorschlaege werden verworfen statt halb uebernommen", () => {
  const offers = parseBestOffers(offersResponse(itemOffers("1",
    `<BestOffer><Price currencyID="EUR">5.00</Price><Status>Pending</Status></BestOffer>`
    + `<BestOffer><BestOfferID>o2</BestOfferID><Price currencyID="EUR">5.00</Price></BestOffer>`
    + OFFER("o3", { price: "unsinn", quantity: "0" }),
  )));
  assert.deepEqual(offers.map((offer) => offer.bestOfferId), ["o3"], "ohne Kennung oder Status kein Vorschlag");
  assert.equal(offers[0].amountCents, null, "ein unlesbarer Preis wird null, nicht 0");
  assert.equal(offers[0].quantity, null);
});

test("ein Vorschlag ohne Angebotsbezug wird uebersprungen", () => {
  assert.deepEqual(parseBestOffers(offersResponse(`<ItemBestOffers><BestOfferArray>${OFFER("o1")}</BestOfferArray></ItemBestOffers>`)), []);
});

// ---------------------------------------------------------------------------
// Fehlerpfade: Scope, Rate Limit, alles andere
// ---------------------------------------------------------------------------

test("eine abgelehnte Trading-Antwort wird nach Fehlernummer eingeordnet", () => {
  const failure = (code) => offersResponse("", "Failure").replace("</Ack>", `</Ack><Errors><ErrorCode>${code}</ErrorCode><LongMessage>Fehler</LongMessage></Errors>`);
  // 518 und 21919144 sind eBays Nummern fuer ein erschoepftes Kontingent.
  assert.equal(classifyTradingFailure(failure("518")), "RATE_LIMITED");
  assert.equal(classifyTradingFailure(failure("21919144")), "RATE_LIMITED");
  assert.equal(classifyTradingFailure(failure("931")), "SCOPE_NOT_GRANTED");
  assert.equal(classifyTradingFailure(failure("12345")), "UPSTREAM_ERROR");

  assert.throws(() => parseBestOffers(failure("518")), (error) => {
    assert.ok(error instanceof EbayReadError);
    assert.equal(error.code, "RATE_LIMITED", "der Grund muss bis zum Aufrufer durchkommen");
    return true;
  });
});

test("PartialFailure gilt als Fehlschlag, nicht als halber Erfolg", () => {
  assert.throws(() => parseInboxMessages(messagesResponse(MESSAGE("m1"), "PartialFailure")), EbayReadError);
});

test("ein nicht zugestimmter Scope wird als solcher erkannt", () => {
  // eBay antwortet auf einen Tokenaustausch mit nicht erteiltem Scope mit
  // HTTP 400 und "invalid_scope" im Rumpf. Genau dieser Fall liegt beim
  // Traffic-Report vor, solange die Zustimmung nur sell.inventory umfasst.
  assert.equal(classifyTokenFailure(400, 'eBay OAuth fehlgeschlagen (400): {"error":"invalid_scope"}'), "SCOPE_NOT_GRANTED");
  assert.equal(classifyTokenFailure(401, "nicht angemeldet"), "SCOPE_NOT_GRANTED");
  assert.equal(classifyTokenFailure(429, "zu viele"), "RATE_LIMITED");
  assert.equal(classifyTokenFailure(500, "kaputt"), "UPSTREAM_ERROR");

  assert.equal(classifyRestFailure(403, "Insufficient permissions"), "SCOPE_NOT_GRANTED");
  assert.equal(classifyRestFailure(429, "Too many requests"), "RATE_LIMITED");
  assert.equal(classifyRestFailure(503, "wartung"), "UPSTREAM_ERROR");
});

test("der Traffic-Abruf meldet den fehlenden Scope, statt ihn als Serverfehler auszugeben", async () => {
  withEbayEnv();
  const original = globalThis.fetch;
  const angefragt = [];
  globalThis.fetch = async (url, init) => {
    angefragt.push(String(url));
    if (String(url).includes("/identity/v1/oauth2/token")) {
      assert.match(String(init?.body ?? ""), /sell\.analytics\.readonly/u,
        "der Analytics-Scope muss ausdruecklich angefordert werden, sonst faellt der Fehler nie auf");
      return new Response(JSON.stringify({ error: "invalid_scope", error_description: "exceeds the scope granted" }), { status: 400 });
    }
    throw new Error("Der Report darf ohne Token gar nicht erst angefragt werden.");
  };
  try {
    const error = await fetchEbayListingTraffic(["398200679813"]).then(() => null, (reason) => reason);
    assert.ok(error instanceof EbayReadError);
    assert.equal(error.code, "SCOPE_NOT_GRANTED");
    assert.equal(angefragt.length, 1, "nach einem verweigerten Token wird nicht weitergefragt");
  } finally {
    globalThis.fetch = original;
  }
});

test("ein Rate Limit auf dem Traffic-Report bleibt ein Rate Limit", async () => {
  withEbayEnv();
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("/identity/v1/oauth2/token")
    ? new Response(JSON.stringify({ access_token: "t" }), { status: 200 })
    : new Response("Too many requests", { status: 429 });
  try {
    const error = await fetchEbayListingTraffic(["1"]).then(() => null, (reason) => reason);
    assert.equal(error.code, "RATE_LIMITED");
  } finally {
    globalThis.fetch = original;
  }
});

test("der Traffic-Abruf nennt die Angebote ausdruecklich und haelt das Fenster ein", async () => {
  withEbayEnv();
  const original = globalThis.fetch;
  let angefragt = "";
  globalThis.fetch = async (url) => {
    if (String(url).includes("/identity/v1/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
    angefragt = decodeURIComponent(String(url));
    return new Response(JSON.stringify({ header: TRAFFIC_HEADER, records: [], lastUpdatedDate: "2026-08-15T04:00:00.000Z" }), { status: 200 });
  };
  try {
    const report = await fetchEbayListingTraffic(["398200679813", "398173913889"], new Date("2026-08-16T09:00:00.000Z"));
    assert.equal(report.lastUpdatedAt, "2026-08-15T04:00:00.000Z");
    assert.match(angefragt, /dimension=LISTING/u);
    assert.match(angefragt, /listing_ids:\{398200679813\|398173913889\}/u,
      "ohne listing_ids liefert eBay hoechstens 200 Angebote in unbestimmter Reihenfolge");
    assert.match(angefragt, /date_range:\[20260717\.\.20260815\]/u);
    assert.match(angefragt, /marketplace_ids:\{EBAY_DE\}/u);
  } finally {
    globalThis.fetch = original;
  }
});

test("ohne Angebote wird eBay gar nicht erst gefragt", async () => {
  withEbayEnv();
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Es darf kein Aufruf stattfinden."); };
  try {
    assert.deepEqual(await fetchEbayListingTraffic([]), { records: [], lastUpdatedAt: null });
    assert.deepEqual(await fetchEbayListingTraffic(["", "keine-nummer-"]), { records: [], lastUpdatedAt: null });
  } finally {
    globalThis.fetch = original;
  }
});

test("das Postfach wird ohne Nachrichtentext angefordert", async () => {
  withEbayEnv();
  const original = globalThis.fetch;
  let request = "";
  let callName = "";
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/identity/v1/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
    request = String(init?.body ?? "");
    callName = String(init?.headers?.["X-EBAY-API-CALL-NAME"] ?? "");
    return new Response(messagesResponse(MESSAGE("m1")), { status: 200 });
  };
  try {
    const messages = await fetchEbayInboxMessages(new Date("2026-08-16T09:00:00.000Z"));
    assert.equal(messages.length, 1);
    assert.equal(callName, "GetMyMessages");
    assert.match(request, /<DetailLevel>ReturnHeaders<\/DetailLevel>/u,
      "ReturnMessages wuerde den Fliesstext mitliefern -- was nicht ankommt, kann nicht gespeichert werden");
    assert.doesNotMatch(request, /ReturnMessages/u);
    assert.match(request, /<StartTime>2026-07-17T09:00:00\.000Z<\/StartTime>/u);
  } finally {
    globalThis.fetch = original;
  }
});

test("Preisvorschlaege werden nur im offenen Zustand geholt", async () => {
  withEbayEnv();
  const original = globalThis.fetch;
  let request = "";
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/identity/v1/oauth2/token")) return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
    request = String(init?.body ?? "");
    return new Response(offersResponse(itemOffers("1", OFFER("o1"))), { status: 200 });
  };
  try {
    assert.equal((await fetchEbayBuyerOffers()).length, 1);
    assert.match(request, /<BestOfferStatus>Active<\/BestOfferStatus>/u);
  } finally {
    globalThis.fetch = original;
  }
});

test("HTTP 429 auf einem Trading-Aufruf wird nicht als Serverfehler verbucht", async () => {
  withEbayEnv();
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("/identity/v1/oauth2/token")
    ? new Response(JSON.stringify({ access_token: "t" }), { status: 200 })
    : new Response("", { status: 429 });
  try {
    const error = await fetchEbayBuyerOffers().then(() => null, (reason) => reason);
    assert.equal(error.code, "RATE_LIMITED");
  } finally {
    globalThis.fetch = original;
  }
});

// ---------------------------------------------------------------------------
// Grenzen
// ---------------------------------------------------------------------------

test("Texte aus eBay werden begrenzt und einzeilig", () => {
  assert.equal(boundedText("  viel   Platz \n hier ", 100), "viel Platz hier");
  assert.equal(boundedText("   ", 100), null);
  assert.equal(boundedText(undefined, 100), null);
  assert.equal(boundedDetail(new Error("A".repeat(1000))).length, 300);
  assert.equal(boundedDetail("zeile1\nzeile2"), "zeile1 zeile2");
});

test("in diesem Modul steht kein schreibender eBay-Aufruf", async () => {
  const source = await read("lib/ebay-read-api.ts");
  for (const verboten of ["Revise", "AddItem", "EndItem", "RespondToBestOffer", "AddMemberMessage", "withdraw", "PlaceOffer"]) {
    assert.doesNotMatch(source, new RegExp(`X-EBAY-API-CALL-NAME[^\\n]*${verboten}`, "u"), `${verboten} hat hier nichts zu suchen`);
  }
  // Nur GET und die beiden lesenden Trading-Aufrufe.
  const aufrufe = [...source.matchAll(/tradingCall\(config,\s*"([A-Za-z]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(aufrufe.sort(), ["GetBestOffers", "GetMyMessages"]);
  assert.equal(EBAY_ANALYTICS_READ_SCOPE, "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly");
});

test("der Lesesync bleibt im eBay-Tageskontingent", async () => {
  // Dieselbe Rechnung wie in tests/ebay-stock-check.test.mjs, nur fuer die
  // zwei Trading-Aufrufe, die Phase 8 hinzufuegt. Sie ist der Grund fuer die
  // eigene Frist: Im Cron-Takt waeren es 960 Aufrufe/Tag aus genau dem Topf,
  // aus dem die Bestandspruefung an der Kasse bezahlt wird.
  const { EBAY_READ_SYNC_INTERVAL_MS } = await import("../lib/ebay-read-sync.ts");
  const wrangler = await read("wrangler.toml");
  const cron = wrangler.match(/crons\s*=\s*\[\s*"([^"]+)"/)?.[1];
  const cronMinuten = Number(cron.trim().split(/\s+/)[0].replace("*/", ""));

  const laufMinuten = Math.max(cronMinuten, EBAY_READ_SYNC_INTERVAL_MS / 60_000);
  const TRADING_AUFRUFE_JE_LAUF = 2;              // GetMyMessages + GetBestOffers
  const aufrufeProTag = (1440 / laufMinuten) * TRADING_AUFRUFE_JE_LAUF;

  // Der Sync hat die eine Haelfte (2 500), die andere teilen sich
  // Beschreibungsabfrage, Kasse und Ruecknahme. Der Lesesync darf davon nur
  // einen kleinen Teil nehmen -- er ist der am wenigsten dringende Verbraucher.
  const OBERGRENZE = 500;
  assert.ok(
    aufrufeProTag <= OBERGRENZE,
    `Der Lesesync kostet ~${aufrufeProTag} eBay-Aufrufe/Tag gegen ${OBERGRENZE}. `
    + "Erst die Frist verlaengern, dann mehr Aufrufe hinzufuegen.",
  );
  assert.ok(EBAY_READ_SYNC_INTERVAL_MS > cronMinuten * 60_000,
    "ohne eigene Frist liefe der Lesesync im Cron-Takt mit");
});
