import assert from "node:assert/strict";
import test from "node:test";

const { maxResolutionImageUrl, ebayImageVariant, EBAY_IMAGE_MAX } = await import("../lib/ebay-images.ts");

// URL shapes and expected results were verified against the live eBay CDN:
//   legacy $_1   -> 225x400,   26 KB   (the thumbnail that was being stored)
//   legacy $_57  -> 900x1600, 364 KB
//   s-l225       -> 126x225,    9 KB
//   s-l1600      -> 900x1600, 364 KB
//   s-l2400      -> identical to s-l1600, so 1600 is the ceiling

const LEGACY_THUMB = "https://i.ebayimg.com/00/s/MTYwMFg5MDA=/z/HeoAAeSw-jdqYyzK/$_1.JPG?set_id=8800005007";
const LEGACY_FULL = "https://i.ebayimg.com/00/s/MTYwMFg5MDA=/z/HeoAAeSw-jdqYyzK/$_57.JPG?set_id=8800005007";
const MODERN_THUMB = "https://i.ebayimg.com/images/g/HeoAAeSw-jdqYyzK/s-l225.jpg";

test("legacy thumbnails are upgraded to the full-resolution variant", () => {
  assert.equal(maxResolutionImageUrl(LEGACY_THUMB), LEGACY_FULL);
  assert.equal(maxResolutionImageUrl("https://i.ebayimg.com/00/s/X/z/H/$_12.JPG"), "https://i.ebayimg.com/00/s/X/z/H/$_57.JPG");
});

test("modern thumbnails are upgraded to the ceiling size", () => {
  assert.equal(maxResolutionImageUrl(MODERN_THUMB), `https://i.ebayimg.com/images/g/HeoAAeSw-jdqYyzK/s-l${EBAY_IMAGE_MAX}.jpg`);
  assert.equal(EBAY_IMAGE_MAX, 1600, "s-l2400 returns the same bytes, so 1600 is the ceiling");
});

test("upgrading is idempotent and leaves unknown shapes alone", () => {
  assert.equal(maxResolutionImageUrl(LEGACY_FULL), LEGACY_FULL);
  const already = `https://i.ebayimg.com/images/g/H/s-l${EBAY_IMAGE_MAX}.jpg`;
  assert.equal(maxResolutionImageUrl(already), already);

  const foreign = "https://example.com/bild.jpg";
  assert.equal(maxResolutionImageUrl(foreign), foreign);
  // A query string that merely looks like a size must not be rewritten.
  const tricky = "https://example.com/a.jpg?x=/s-l225.jpg";
  assert.equal(maxResolutionImageUrl(tricky), tricky);
});

test("a smaller variant can be requested for grid thumbnails", () => {
  assert.equal(ebayImageVariant(MODERN_THUMB, 800), "https://i.ebayimg.com/images/g/HeoAAeSw-jdqYyzK/s-l800.jpg");
  // Legacy URLs carry no size knob: return them untouched rather than guess.
  assert.equal(ebayImageVariant(LEGACY_FULL, 800), LEGACY_FULL);
});

test("the sync collects both PictureURL and GalleryURL, upgraded and deduped", async () => {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  process.env.EBAY_REFRESH_TOKEN = "refresh";

  globalThis.fetch = async (url) => {
    if (String(url).includes("/identity/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
    }
    return new Response(`<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <ActiveList><ItemArray><Item>
    <ItemID>3001</ItemID><Title>Mit Bildern</Title>
    <ListingType>FixedPriceItem</ListingType><QuantityAvailable>1</QuantityAvailable>
    <PictureDetails>
      <GalleryURL>${MODERN_THUMB}</GalleryURL>
      <PictureURL>${LEGACY_THUMB}</PictureURL>
    </PictureDetails>
  </Item></ItemArray>
  <PaginationResult><TotalNumberOfPages>1</TotalNumberOfPages><TotalNumberOfEntries>1</TotalNumberOfEntries></PaginationResult>
  </ActiveList>
</GetMyeBaySellingResponse>`, { status: 200 });
  };

  const { getActiveEbayListings } = await import("../lib/ebay-client.ts");
  const [listing] = await getActiveEbayListings();

  assert.deepEqual(listing.imageUrls, [
    LEGACY_FULL,
    `https://i.ebayimg.com/images/g/HeoAAeSw-jdqYyzK/s-l${EBAY_IMAGE_MAX}.jpg`,
  ], "both sources are kept, each at full resolution");
  assert.ok(!listing.imageUrls.some((url) => /\$_1\.JPG|s-l225/.test(url)), "no thumbnail may survive");
});
