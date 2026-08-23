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

test("N7 hält Vorverkaufskarten aus Festpreis-Aktionen heraus", async () => {
  const [gallery, cards, checkout, presale] = await Promise.all([
    read("app/gallery.tsx"),
    read("app/karten/page.tsx"),
    read("app/checkout/page.tsx"),
    read("app/vorverkauf/page.tsx"),
  ]);
  // Galerie und Katalog zeigen seit dem 2026-08-18 keine Vorverkaufskarten mehr.
  // Ihre Weichen bleiben trotzdem stehen: Sie kosten nichts und verhindern, dass
  // eine durchgerutschte Karte einen Warenkorbknopf bekommt statt „Preis
  // vorschlagen“ — ein Kauf zum Preis `null` wäre der teure Fehler.
  assert.match(gallery, /Preis vorschlagen/, "die Galerie muss eine Vorverkaufskarte zum Vorschlag führen");
  assert.match(cards, /category === "Direkt bei uns"/, "der Katalog darf eine Vorverkaufskarte nicht in den Warenkorb legen");
  assert.match(checkout, /\/api\/products\?ids=/, "die Kasse muss ihre Warenkorbkarten laden, nicht nur Seite eins");
  assert.match(presale, /origin: "MANUAL"/, "der Vorverkauf ist eine eigene serverseitige Scheibe");
});

test("der Vorverkauf sucht serverseitig und blättert über seinen ganzen Bestand", async () => {
  const presale = await read("app/vorverkauf/page.tsx");

  // Die Suche gehört auf den Server, sonst durchsucht sie nur die geladene
  // Seite — und das sähe aus wie „gibt es nicht", während die Karte auf Seite
  // zwei steht.
  assert.match(presale, /params\.set\("q", suche\.trim\(\)\)/, "die Suche muss als q an die API gehen");

  // **Der eigentliche Regressionstest.** Bis zum 2026-08-18 holte die Seite
  // `pro=100` ohne Blätterleiste. Dann kamen 144 Karten herein, und 44 davon
  // waren im Shop vorhanden, bezahlbar und verlinkt — aber auf keiner Seite zu
  // sehen. Wer die Blätterleiste wieder entfernt, stellt genau das her.
  assert.match(presale, /seite: String\(seite\)/, "die Seite muss ihre Seitenzahl mitschicken");
  assert.match(presale, /pageNumbers\(seite, seitenInfo\.totalPages\)/, "es braucht eine Blätterleiste");

  // Zwei Leerzustände: „nichts gefunden" ist eine Auskunft über die Suche,
  // „gerade nichts im Vorverkauf" eine über den Shop.
  assert.match(presale, /Keine Karte passt zu dieser Auswahl\./, "die leere Suche braucht ihre eigene Auskunft");
  assert.match(presale, /Gerade ist nichts im Vorverkauf\./, "der leere Vorverkauf behält seine");
});

test("Startseite und Sitemap zeigen nur eBay-Karten", async () => {
  // Der Betreiber hat es am 2026-08-18 so entschieden — nachdem der Import von
  // 144 Karten die Galerie vollständig übernommen hatte: Sie bestand aus fünf
  // Vorverkaufskarten und sonst nichts. Die 144 sind die jüngsten im Bestand,
  // und „neueste zuerst" hat dagegen keine Chance.
  const [highlights, sitemap] = await Promise.all([
    read("app/api/products/highlights/route.ts"),
    read("app/sitemap.ts"),
  ]);
  assert.match(highlights, /const live = and\(\s*eq\(products\.status, "ACTIVE"\),\s*eq\(products\.origin, "EBAY"\)/u,
    "die Galerie muss manuelle Karten schon in der Abfrage ausschließen");
  assert.doesNotMatch(highlights, /or\(\s*eq\(products\.origin, "MANUAL"\)/u,
    "keine Oder-Verzweigung, die sie wieder hereinlässt");
  assert.match(sitemap, /ne\(products\.origin, "MANUAL"\)/,
    "der Sitemap darf keine Adresse anbieten, die der Katalog nicht zeigt");
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

test("die Merkmale filtern über Spalten, nicht über den Titel", async () => {
  // **Der Test, der die teure Abkürzung verbaut.** Am 2026-08-20 traf
  // `title GLOB '*[0-9]/[0-9]*'` 212 von 263 Karten, weil die Saison `26/27`
  // im Seriennamen aussieht wie eine Auflage. Nummeriert sind acht. Ein
  // Filter, der fast alles zeigt, sieht nicht kaputt aus — nur nutzlos.
  const route = await read("app/api/products/route.ts");
  for (const spalte of ["numbering", "autograph", "graded", "relic"]) {
    assert.match(route, new RegExp(`products\.${spalte}`, "u"), `${spalte} muss als Spalte gelesen werden`);
  }

  // **Ohne Kommentare geprüft.** Der Kopf der Datei nennt `GLOB` als
  // abschreckendes Beispiel; eine Prüfung über den rohen Text schlüge daran an
  // und wäre nur so lange grün, wie niemand die Begründung aufschreibt.
  const ohneKommentare = route
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "");
  assert.doesNotMatch(ohneKommentare, /GLOB/u,
    "kein Textmuster auf dem Titel — die Saison sieht aus wie eine Auflage");
});

test("die Merkmale sind eigene Schalter, kein Eintrag im Set-Feld", async () => {
  // **Rücknahme eines Entwurfs vom selben Tag.** „Numbered" stand kurz als
  // reservierter Wert `*nummeriert` in der Set-Auswahl. Das war eng: In einem
  // Auswahlfeld schließen sich die Einträge aus, „nummeriert **und** mit
  // Autogramm" ließ sich gar nicht ausdrücken.
  const [route, presale] = await Promise.all([
    read("app/api/products/route.ts"),
    read("app/vorverkauf/page.tsx"),
  ]);
  assert.doesNotMatch(route, /\*nummeriert|istMerkmal/u,
    "die reservierten Set-Werte sind entfallen");
  assert.doesNotMatch(presale, /optgroup/u,
    "die Merkmale gehören nicht mehr ins Set-Auswahlfeld");
  assert.match(presale, /type="checkbox"/u, "es braucht Schalter");

  // Kombinierbar heißt: jedes Merkmal ein eigener Parameter, alle mit UND
  // verknüpft. Ein gemeinsamer Parameter wäre wieder eine Entweder-oder-Wahl.
  assert.match(route, /for \(const merkmal of gewaehlteMerkmale\) conditions\.push\(merkmal\.bedingung\(\)\)/u);
});

test("die Zahlen an den Schaltern zählen ohne die Schalter", async () => {
  // Sonst zeigte ein gesetztes Häkchen bei allen anderen eine Null, und man
  // käme aus der Auswahl nur über „alles zurücksetzen" wieder heraus.
  const route = await read("app/api/products/route.ts");
  assert.match(route, /const ohneMerkmale = \[\.\.\.conditions\];/u);
  assert.match(route, /\.where\(and\(\.\.\.mitVariante\)\)/u,
    "die Merkmalzahlen müssen über den Stand ohne Merkmale laufen");

  // Alle vier stehen immer da, auch mit null Treffern — eine feste Reihe.
  assert.doesNotMatch(route, /merkmale:[\s\S]{0,400}?filter\(\(eintrag\) => eintrag\.anzahl > 0\)/u,
    "die Schalterreihe darf nicht je nach Bestand springen");
});

test("die eBay-Merkmale entstehen im Sync, nicht in der Abfrage", async () => {
  // **Warum nicht in SQL:** Die Unterscheidung Saison/Auflage braucht den
  // Vergleich zweier Zahlen und die Reihenfolge der Fundstellen. In SQLite
  // nachgebaut wäre sie weder lesbar noch prüfbar — und ein stiller Fehler
  // dort zeigt sich als Filter, der fast alles oder fast nichts findet.
  const [sync, route] = await Promise.all([
    read("lib/ebay-sync.ts"),
    read("app/api/products/route.ts"),
  ]);
  assert.match(sync, /merkmaleAusTitel\(mapped\.title\)/u,
    "der Sync muss die Merkmale aus dem Titel ableiten");

  // **Die Falle, die schon einmal zugeschlagen hat.** Wer schreibt, muss auch
  // lesen: Fehlten die Spalten in `productRows`, stünde `undefined` gegen einen
  // Wert, `stehtSchonSo` meldete ewig einen Unterschied, und jeder Lauf
  // schriebe jedes Produkt neu — im Drei-Minuten-Takt.
  for (const spalte of ["numbering", "autograph", "graded", "relic"]) {
    assert.match(sync, new RegExp(`numbering: products\.numbering|${spalte}: products\.${spalte}`, "u"),
      `${spalte} muss in productRows mitgelesen werden`);
  }

  // Der Filter selbst bleibt eine Spaltenabfrage — für beide Kartensorten.
  assert.match(route, /products\.numbering/u);
});

test("die Schalter stehen auch im Katalog, nicht nur im Vorverkauf", async () => {
  const [karten, route] = await Promise.all([
    read("app/karten/page.tsx"),
    read("app/api/products/route.ts"),
  ]);
  assert.match(karten, /merkmalUmschalten/u, "der Katalog braucht die Schalter");
  assert.match(karten, /params\.set\("facetten", "1"\)/u, "und ihre Zahlen");
  // Die Facetten dürfen nicht mehr auf den Vorverkauf beschränkt sein.
  assert.doesNotMatch(route, /facetten"\) === "1" && origin === "MANUAL"/u);
});
