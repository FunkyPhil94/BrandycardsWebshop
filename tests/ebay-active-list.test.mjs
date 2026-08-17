import assert from "node:assert/strict";
import test from "node:test";

// Regression cover for the duplicate-import defect: GetMyeBaySelling answers
// with one container per list, and `DetailLevel ReturnAll` makes eBay return
// SoldList/UnsoldList alongside ActiveList. Parsing the whole document pulled
// sold items into the shop, so a card that was sold and relisted appeared
// twice - once under its old sold ItemID, once under the new active one.

const ACTIVE_ITEM = (id, title) => `
  <Item>
    <ItemID>${id}</ItemID>
    <Title>${title}</Title>
    <ListingType>FixedPriceItem</ListingType>
    <QuantityAvailable>1</QuantityAvailable>
    <SellingStatus><CurrentPrice currencyID="EUR">12.50</CurrentPrice></SellingStatus>
    <PictureDetails><PictureURL>https://img.ebay.com/${id}.jpg</PictureURL></PictureDetails>
    <ListingDetails>
      <ViewItemURL>https://www.ebay.de/itm/${id}</ViewItemURL>
      <StartTime>2026-08-01T09:30:00.000Z</StartTime>
      <EndTime>2026-09-01T09:30:00.000Z</EndTime>
    </ListingDetails>
  </Item>`;

function buildResponse({ activeItems, soldItems, totalPages, totalEntries }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <ActiveList>
    <ItemArray>${activeItems.map(([id, title]) => ACTIVE_ITEM(id, title)).join("")}</ItemArray>
    <PaginationResult>
      <TotalNumberOfPages>${totalPages}</TotalNumberOfPages>
      <TotalNumberOfEntries>${totalEntries}</TotalNumberOfEntries>
    </PaginationResult>
  </ActiveList>
  <SoldList>
    <OrderTransactionArray>${soldItems.map(([id, title]) => ACTIVE_ITEM(id, title)).join("")}</OrderTransactionArray>
    <PaginationResult>
      <TotalNumberOfPages>9</TotalNumberOfPages>
      <TotalNumberOfEntries>900</TotalNumberOfEntries>
    </PaginationResult>
  </SoldList>
</GetMyeBaySellingResponse>`;
}

function installFetchStub(pages) {
  const calls = [];
  calls.tokenBodies = [];
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.includes("/identity/v1/oauth2/token")) {
      calls.tokenBodies.push(String(init?.body ?? ""));
      return new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 });
    }
    const body = String(init?.body ?? "");
    calls.push(body);
    const pageNumber = Number(body.match(/<PageNumber>(\d+)<\/PageNumber>/)?.[1] ?? "1");
    return new Response(pages[pageNumber - 1], { status: 200 });
  };
  return calls;
}

test("only ActiveList items are imported, SoldList is ignored", async () => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  process.env.EBAY_REFRESH_TOKEN = "refresh";

  const calls = installFetchStub([
    buildResponse({
      // The sold entries deliberately carry the same titles under older IDs,
      // mirroring the real relisted cards found in production.
      activeItems: [["398173913889", "Rio Ngumoha Base RC"], ["398200679813", "Lamine Yamal Finest"]],
      soldItems: [["398013793664", "Rio Ngumoha Base RC"], ["398013793669", "Rio Ngumoha Base RC"]],
      totalPages: 1,
      totalEntries: 2,
    }),
  ]);

  const { getActiveEbayListings } = await import("../lib/ebay-client.ts");
  const listings = await getActiveEbayListings();

  assert.deepEqual(listings.map((listing) => listing.ebayItemId).sort(), ["398173913889", "398200679813"]);
  assert.equal(listings.length, 2, "sold items must not be imported");
  assert.doesNotMatch(calls.tokenBodies[0], /(?:^|&)scope=/u, "the read sync must use the scopes from the original consent");
  assert.match(calls[0], /<SoldList><Include>false<\/Include><\/SoldList>/);

  // The listing start time drives the "newest cards" gallery view. Without it
  // "newest" would fall back to the bulk import timestamp, which is identical
  // for every card and therefore meaningless.
  assert.equal(listings[0].startAt, "2026-08-01T09:30:00.000Z");
  assert.equal(listings[0].endAt, "2026-09-01T09:30:00.000Z");
});

test("a missing or malformed listing date does not break the import", async () => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  process.env.EBAY_REFRESH_TOKEN = "refresh";

  installFetchStub([`<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <ActiveList><ItemArray><Item>
    <ItemID>2001</ItemID><Title>Ohne Datum</Title>
    <ListingType>FixedPriceItem</ListingType><QuantityAvailable>1</QuantityAvailable>
    <ListingDetails><StartTime>nicht-eine-zeit</StartTime></ListingDetails>
  </Item></ItemArray>
  <PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages><TotalNumberOfEntries>1</TotalNumberOfEntries></PaginationResult>
  </ActiveList>
</GetMyeBaySellingResponse>`]);

  const { getActiveEbayListings } = await import("../lib/ebay-client.ts");
  const listings = await getActiveEbayListings();
  assert.equal(listings.length, 1);
  assert.equal(listings[0].startAt, null, "an unparsable date must become null, not Invalid Date");
});

test("pagination follows the ActiveList total, not another container", async () => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  process.env.EBAY_REFRESH_TOKEN = "refresh";

  installFetchStub([
    buildResponse({ activeItems: [["1001", "A"], ["1002", "B"]], soldItems: [], totalPages: 2, totalEntries: 3 }),
    buildResponse({ activeItems: [["1003", "C"]], soldItems: [], totalPages: 2, totalEntries: 3 }),
  ]);

  const { getActiveEbayListings } = await import("../lib/ebay-client.ts");
  const listings = await getActiveEbayListings();

  assert.deepEqual(listings.map((listing) => listing.ebayItemId), ["1001", "1002", "1003"]);
});

// --- Der Abbruch nach Seite eins --------------------------------------------
//
// `sync_runs` meldete am 2026-08-10, -13 und -17 "eBay-Aktivliste
// unvollstaendig: 200 von N Angeboten geladen." **Jeder** dieser Fehlschlaege
// lud exakt 200, also genau eine Seite. Ursache: Die Fortsetzungsbedingung hing
// allein an `totalPages`, und das wurde von *jeder* Antwort ueberschrieben --
// waehrend `totalEntries` daneben seit jeher mit `Math.max` dagegen abgesichert
// war. Eine einzige Antwort ohne `TotalNumberOfPages` (`?? "1"` macht daraus
// eine 1) beendete damit den Abruf.

function seite({ anzahl, totalPages, totalEntries, startId = 100000000000 }) {
  const items = Array.from({ length: anzahl }, (_, i) => ACTIVE_ITEM(String(startId + i), `Karte ${startId + i}`)).join("");
  const pagination = totalPages === null
    ? `<PaginationResult><TotalNumberOfEntries>${totalEntries}</TotalNumberOfEntries></PaginationResult>`
    : `<PaginationResult><TotalNumberOfPages>${totalPages}</TotalNumberOfPages><TotalNumberOfEntries>${totalEntries}</TotalNumberOfEntries></PaginationResult>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <ActiveList><ItemArray>${items}</ItemArray>${pagination}</ActiveList>
</GetMyeBaySellingResponse>`;
}

test("eine fehlende Seitenzahl beendet den Abruf nicht mehr", async () => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  process.env.EBAY_REFRESH_TOKEN = "refresh";

  // Seite 1 meldet gar keine Seitenzahl -- genau der Fall, der bisher nach
  // 200 Angeboten abbrach. Die Gesamtanzahl sagt aber, dass mehr da ist.
  const calls = installFetchStub([
    seite({ anzahl: 200, totalPages: null, totalEntries: 201 }),
    seite({ anzahl: 1, totalPages: 2, totalEntries: 201, startId: 200000000000 }),
  ]);

  const { getActiveEbayListings } = await import("../lib/ebay-client.ts");
  const listings = await getActiveEbayListings();

  assert.equal(calls.length, 2, "die zweite Seite muss geholt werden");
  assert.equal(listings.length, 201);
});

test("eine spaetere schwache Antwort schrumpft die Seitenzahl nicht", async () => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  process.env.EBAY_REFRESH_TOKEN = "refresh";

  // Seite 2 meldet ploetzlich "eine Seite". Vor der Korrektur setzte diese
  // Antwort `totalPages` zurueck, und Seite 3 wurde nie geholt.
  //
  // Drei Seiten sind hier noetig, damit der Test ueberhaupt etwas bewacht: Bei
  // zweien waere der Abruf ohnehin fertig gewesen und die Fassung ohne
  // Korrektur bestuende genauso.
  const calls = installFetchStub([
    seite({ anzahl: 200, totalPages: 3, totalEntries: 401 }),
    seite({ anzahl: 200, totalPages: 1, totalEntries: 401, startId: 200000000000 }),
    seite({ anzahl: 1, totalPages: 3, totalEntries: 401, startId: 300000000000 }),
  ]);

  const { getActiveEbayListings } = await import("../lib/ebay-client.ts");
  const listings = await getActiveEbayListings();

  assert.equal(calls.length, 3, "die dritte Seite muss trotz der schwachen zweiten Antwort kommen");
  assert.equal(listings.length, 401);
});

test("bleibt der Abruf unvollstaendig, erklaert die Meldung sich selbst", async () => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  process.env.EBAY_REFRESH_TOKEN = "refresh";

  // eBay behauptet 99 Angebote, liefert aber nur 5 und keine zweite Seite.
  // Der Lauf muss abbrechen -- sonst gaelten 94 Angebote als verschwunden und
  // wuerden abgeraeumt. Neu ist, dass die Meldung die beobachteten Werte
  // mitfuehrt: Ohne sie liess sich am gespeicherten Fehlschlag nicht mehr
  // entscheiden, woran es lag.
  installFetchStub([seite({ anzahl: 5, totalPages: 1, totalEntries: 99 })]);

  const { getActiveEbayListings } = await import("../lib/ebay-client.ts");
  await assert.rejects(getActiveEbayListings(), (fehler) => {
    assert.match(fehler.message, /unvollständig: 5 von 99 Angeboten/u);
    assert.match(fehler.message, /Seiten laut eBay: 1, geholt: 1, je Seite: 5\./u);
    return true;
  });
});
