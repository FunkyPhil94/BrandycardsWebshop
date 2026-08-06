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
    <ListingDetails><ViewItemURL>https://www.ebay.de/itm/${id}</ViewItemURL></ListingDetails>
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
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.includes("/identity/v1/oauth2/token")) {
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
  assert.match(calls[0], /<SoldList><Include>false<\/Include><\/SoldList>/);
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
