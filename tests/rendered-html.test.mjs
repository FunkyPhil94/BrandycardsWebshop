import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("build contains the BrandyCards storefront and API routes", async () => {
  const [page, distIndex] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../dist/server/index.js", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Aktuelle Karten/);
  assert.match(page, /eBay synchronisiert/);
  assert.match(page, /Auktion auf eBay/);
  assert.match(page, /Noch nicht im Verkauf/);
  assert.match(page, /Karten anbieten/);
  assert.match(distIndex, /api\/inquiries/);
  assert.match(distIndex, /api\/price-offers/);
  assert.match(distIndex, /api\/card-submissions/);
  assert.match(distIndex, /api\/prelisted-interest/);
  assert.match(distIndex, /api\/admin\/dashboard/);
  assert.match(distIndex, /api\/admin\/ebay-sync/);
  assert.match(distIndex, /\/admin/);
});

test("starter preview infrastructure is removed", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /use client/);
  assert.match(layout, /BrandyCards/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(new URL("app/_sites-preview", projectRoot)),
  );
});
