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
