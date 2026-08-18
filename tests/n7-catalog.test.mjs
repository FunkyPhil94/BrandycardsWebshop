import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("N7 applies catalogue filters and pagination before the response", async () => {
  const route = await read("app/api/products/route.ts");
  assert.match(route, /count\(\*\)/, "the API must count the filtered result in D1");
  assert.match(route, /\.limit\(pageSize\)/, "the API must limit the D1 result");
  assert.match(route, /\.offset\(/, "the API must offset in D1, not in the browser");
  assert.match(route, /LIKE/, "the card search must run server-side");
  assert.match(route, /categoryCondition/, "category filtering must be server-side");
  assert.match(route, /priceAmountCents/, "price filtering must use the effective price");
  assert.match(route, /inArray\(products\.id, ids\)/, "checkout must be able to request its exact cart cards");
});

test("N7 keeps manual cards in the highlights and out of fixed-price actions", async () => {
  const [highlights, gallery, cards, checkout, presale] = await Promise.all([
    read("app/api/products/highlights/route.ts"),
    read("app/gallery.tsx"),
    read("app/karten/page.tsx"),
    read("app/checkout/page.tsx"),
    read("app/vorverkauf/page.tsx"),
  ]);
  assert.match(highlights, /leftJoin\(ebayListings/, "manual cards have no listing row");
  assert.match(highlights, /"Direkt bei uns"/, "manual cards need their own highlight category");
  assert.match(gallery, /Preis vorschlagen/, "the gallery must link manual cards to negotiation");
  assert.match(cards, /category === "Direkt bei uns"/, "the catalogue must not put a pre-sale card straight in the cart");
  assert.match(checkout, /\/api\/products\?ids=/, "checkout must load the cart cards, not only page one");
  assert.match(presale, /origin=MANUAL&pro=100/, "pre-sale must be queried as its own server-side slice");
});

test("Vorverkaufskarten stehen im Vorverkauf, nicht im Katalog", async () => {
  // Der Betreiber hat es am 2026-08-18 so entschieden: Die 144 von Hand
  // eingestellten Karten sollen ausschließlich unter /vorverkauf auftauchen.
  const [route, cards] = await Promise.all([
    read("app/api/products/route.ts"),
    read("app/karten/page.tsx"),
  ]);

  // Die Regel steht in der API, nicht bloß im Aufruf der Seite. Stünde sie nur
  // dort, gälte sie genau so lange, bis jemand eine zweite Liste baut.
  assert.match(route, /if \(!byId && origin !== "MANUAL"\) conditions\.push\(ne\(products\.origin, "MANUAL"\)\)/,
    "Listen müssen manuelle Karten ausschließen, solange sie nicht ausdrücklich gefragt sind");

  // **Die Ausnahme für `ids` ist der Teil, der leicht wegoptimiert wird.**
  // Detailseite, Warenkorb und Bestellprüfung holen Karten über ihre Kennung.
  // Ohne sie stünde die Karte im Vorverkauf und wäre beim Anklicken fort.
  assert.match(route, /!byId/, "Abfragen über Kennungen dürfen der Ausschluss nicht treffen");

  assert.doesNotMatch(route, /category === "manual"/,
    "eine Kategorie „Vorverkauf“ im Katalog filterte auf eine leere Menge");
  assert.doesNotMatch(cards, /<option value="manual">/,
    "der Katalog darf keinen Filter auf etwas anbieten, das er nicht zeigt");
});
