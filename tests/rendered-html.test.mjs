import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("build contains the BrandyCards routes and API surface", async () => {
  const distIndex = await read("dist/server/index.js");
  for (const route of [
    "api/inquiries", "api/price-offers", "api/card-submissions",
    "api/prelisted-interest", "api/products/highlights",
    "api/admin/dashboard", "api/admin/ebay-sync", "/admin",
  ]) {
    assert.ok(distIndex.includes(route), `build is missing ${route}`);
  }
});

test("landing page only links to the sub pages, it does not host the shop", async () => {
  const page = await read("app/page.tsx");

  // The whole point of the restructure: the catalogue, the forms and the
  // about text moved out. Only hero, gallery, links and footer remain.
  for (const link of ["/karten", "/anfragen", "/verkaufen", "/ueber-uns"]) {
    assert.ok(page.includes(link), `landing page should link to ${link}`);
  }
  assert.match(page, /<Gallery \/>/);
  assert.doesNotMatch(page, /product-grid/, "catalogue must live on /karten");
  assert.doesNotMatch(page, /api\/inquiries|api\/card-submissions/, "forms must live on their own pages");
  assert.doesNotMatch(page, /filter-tabs|search-field/, "filters must live on /karten");
});

test("the sub pages exist and carry their content", async () => {
  const [karten, anfragen, verkaufen, ueberUns] = await Promise.all([
    read("app/karten/page.tsx"), read("app/anfragen/page.tsx"),
    read("app/verkaufen/page.tsx"), read("app/ueber-uns/page.tsx"),
  ]);
  assert.match(karten, /product-grid/);
  assert.match(karten, /api\/products/);
  assert.match(karten, /api\/prelisted-interest/);
  assert.match(anfragen, /api\/inquiries/);
  assert.match(verkaufen, /api\/card-submissions/);
  assert.match(ueberUns, /BrandyCards ist ein Familienprojekt/);
  for (const page of [karten, anfragen, verkaufen, ueberUns]) {
    assert.match(page, /SiteHeader/, "every sub page needs the shared header");
    assert.match(page, /SiteFooter/, "every sub page needs the shared footer");
  }
});

test("the gallery shows exactly five cards and offers both views", async () => {
  const [gallery, highlights] = await Promise.all([
    read("app/gallery.tsx"), read("app/api/products/highlights/route.ts"),
  ]);

  assert.match(gallery, /GALLERY_SIZE = 5/, "gallery size must be five");
  assert.match(gallery, /slice\(0, GALLERY_SIZE\)/, "gallery must cap the list at five");
  assert.match(highlights, /GALLERY_SIZE = 5/);
  assert.match(highlights, /leftJoin\(inventory/,
    "the gallery must see shop inventory, not only the eBay listing");
  assert.match(highlights, /istImKatalogSichtbar\(/,
    "the gallery must use the catalogue visibility decision");
  assert.match(highlights, /verfuegbareMenge\(/,
    "the gallery quantity must use the shared stock decision");
  assert.match(highlights, /filter\(isGalleryVisible\)\.slice\(0, GALLERY_SIZE\)/,
    "visibility must be applied before the five-card limit");

  // Rotation: every two seconds, pausable, and off for reduced motion.
  assert.match(gallery, /ROTATE_MS = 2000/);
  assert.match(gallery, /setInterval/);
  assert.match(gallery, /prefers-reduced-motion/);
  assert.match(gallery, /reducedMotion \|\| paused/);

  // Both views, with "beliebt" resolving to the most expensive cards.
  assert.match(gallery, /"newest"/);
  assert.match(gallery, /"priciest"/);
  assert.match(highlights, /desc\(ebayListings\.priceAmountCents\)/);
  assert.match(highlights, /desc\(ebayListings\.startAt\)/);
});

test("starter preview infrastructure is removed", async () => {
  const [page, layout, packageJson] = await Promise.all([
    read("app/page.tsx"), read("app/layout.tsx"), read("package.json"),
  ]);

  assert.match(layout, /BrandyCards/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("app/_sites-preview", projectRoot)));
});
