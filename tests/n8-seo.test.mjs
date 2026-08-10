import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("N8 publishes canonical metadata, robots and a sitemap", async () => {
  const [layout, robots, sitemap] = await Promise.all([
    read("app/layout.tsx"),
    read("app/robots.ts"),
    read("app/sitemap.ts"),
  ]);
  assert.match(layout, /metadataBase: new URL\(SHOP_BASE_URL\)/);
  assert.match(layout, /openGraph:/);
  assert.match(layout, /twitter:/);
  assert.match(robots, /sitemap/);
  assert.match(robots, /\/api\//);
  assert.match(sitemap, /force-dynamic/);
  assert.match(sitemap, /karten\/\$\{row\.id\}/);
  assert.match(sitemap, /istImKatalogSichtbar/);
});

test("N8 adds product metadata and safe structured offers", async () => {
  const [detailLayout, routes] = await Promise.all([
    read("app/karten/[id]/layout.tsx"),
    Promise.all(["karten", "vorverkauf", "anfragen", "verkaufen", "ueber-uns"].map((route) => read(`app/${route}/layout.tsx`))),
  ]);
  assert.match(detailLayout, /generateMetadata/);
  assert.match(detailLayout, /alternates: \{ canonical: url \}/);
  assert.match(detailLayout, /application\/ld\+json/);
  assert.match(detailLayout, /safeJsonLd/);
  assert.match(detailLayout, /offers:/);
  for (const route of routes) assert.match(route, /publicPageMetadata/);
});
