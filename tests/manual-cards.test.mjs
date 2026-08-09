import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { istImKatalogSichtbar, verfuegbareMenge } = await import("../lib/catalog-availability.ts");

// Von Hand eingestellte Karten (ai-todo Punkt 11). Die Falle steckt im Schema:
// Sie tragen `kind = 'PRELISTED'`, weil die CHECK-Bedingung auf `kind` keinen
// dritten Wert zuließ — und `PRELISTED` heißt sonst „Ankündigung, immer
// sichtbar". Wer die Reihenfolge der Prüfungen umdreht, macht jede verkaufte
// Handkarte unsterblich.

test("eine manuelle Karte ohne Bestandszeile bietet nichts an", () => {
  // Umgekehrt zur eBay-Regel: Dort gilt bei fehlender Bestandszeile die
  // Listing-Menge („im Zweifel anzeigen"). Eine manuelle Karte hat kein
  // Listing — ohne Bestand gibt es schlicht nichts zu verkaufen.
  assert.equal(verfuegbareMenge(null, null, "MANUAL"), 0);
  assert.equal(verfuegbareMenge(5, null, "MANUAL"), 0, "eine Listing-Menge darf hier nicht durchschlagen");
});

test("bei einer manuellen Karte entscheidet allein der Bestand", () => {
  assert.equal(verfuegbareMenge(null, { availableQuantity: 2, status: "AVAILABLE" }, "MANUAL"), 2);
  assert.equal(verfuegbareMenge(null, { availableQuantity: 1, status: "SOLD" }, "MANUAL"), 0);
  assert.equal(verfuegbareMenge(null, { availableQuantity: 1, status: "UNAVAILABLE" }, "MANUAL"), 0);
});

test("eine verkaufte Handkarte verschwindet aus dem Katalog", () => {
  // **Der eigentliche Regressionstest.** Wird `origin` nicht vor `kind`
  // geprüft, greift die PRELISTED-Ausnahme, und diese Zeile liefert `true` —
  // eine verkaufte Karte bliebe mit Kaufknopf im Schaufenster stehen.
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, { availableQuantity: 0, status: "SOLD" }, "MANUAL"), false);
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, { availableQuantity: 1, status: "AVAILABLE" }, "MANUAL"), true);
});

test("die echte Vormerkliste bleibt sichtbar", () => {
  // Gegenprobe: Ohne `origin` ist `PRELISTED` weiterhin die Ankündigung ohne
  // Bestand und ohne Listing.
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, null), true);
  assert.equal(istImKatalogSichtbar("PRELISTED", null, null, null, "EBAY"), true);
});

test("eBay-Karten verhalten sich unverändert", () => {
  assert.equal(istImKatalogSichtbar("EBAY_SYNCED", "FIXED_PRICE", 1, null), true);
  assert.equal(istImKatalogSichtbar("EBAY_SYNCED", "AUCTION", 1, null), false);
  assert.equal(istImKatalogSichtbar("EBAY_SYNCED", "FIXED_PRICE", 1, { availableQuantity: 0, status: "SOLD" }), false);
});

test("die Detailseite verknüpft das Listing nicht mehr zwingend", async () => {
  // Mit `innerJoin` lieferte die Detailseite jeder manuellen Karte 404, während
  // der Katalog sie anzeigte — der Kunde klickt auf eine Karte und landet im
  // Nichts. Stand als Falle Nummer 3 in ai-todo Punkt 11.
  const quelle = await readFile(new URL("../app/api/products/[id]/route.ts", import.meta.url), "utf8");
  assert.ok(!/innerJoin\(ebayListings/u.test(quelle), "ebay_listings darf nicht per innerJoin hängen");
  assert.match(quelle, /leftJoin\(ebayListings/u);
  // Die Statusprüfung darf nicht in die where-Bedingung zurückwandern: Dort
  // filtert `listing.status IS NULL` jede manuelle Karte wieder heraus.
  assert.ok(!/where\([^)]*ebayListings\.status/su.test(quelle.slice(0, quelle.indexOf("const row ="))),
    "der Listing-Status gehört hinter die Abfrage, nicht in die where-Bedingung");
});

test("der Waisen-Sweep fasst manuelle Karten nicht an", async () => {
  // `lib/ebay-sync.ts` deaktiviert jedes Produkt mit `kind = 'EBAY_SYNCED'`
  // ohne Listing-Zeile. Manuelle Karten haben nie eine Listing-Zeile — trügen
  // sie dieselbe `kind`, verschwänden sie beim nächsten Lauf binnen Minuten.
  const sync = await readFile(new URL("../lib/ebay-sync.ts", import.meta.url), "utf8");
  assert.match(sync, /EBAY_SYNCED/u, "der Sweep muss weiterhin auf kind = EBAY_SYNCED eingegrenzt sein");
});

test("die Migration begründet, warum kind unverändert bleibt", async () => {
  // Ohne diese Begründung liest die nächste Sitzung `kind = 'PRELISTED'` bei
  // einer käuflichen Karte als Fehler und „repariert" ihn.
  const migration = await readFile(new URL("../drizzle/0006_manual_cards_and_oauth_claims.sql", import.meta.url), "utf8");
  assert.match(migration, /ON DELETE CASCADE/u);
  assert.match(migration, /PRAGMA foreign_keys = OFF. greift in D1 nicht/u);
});

// --- Handmarkierungen und Übernahme (ai-todo Punkt 12.1) --------------------

const { HANDFELDER, darfUebernommenWerden, handfelder, ohneHandfelder, titelSchluessel } =
  await import("../lib/manual-overrides.ts");

test("ohne Markierung schreibt der Import alles", () => {
  const werte = { title: "eBay-Titel", description: "eBay-Text", status: "ACTIVE" };
  assert.deepEqual(ohneHandfelder(werte, handfelder(null)), werte);
});

test("ein markiertes Feld überlebt den Import", () => {
  // Die Zusage von Punkt 12.1. Fällt dieser Test, macht der Sync jede
  // Korrektur des Betreibers im Drei-Minuten-Takt wieder zunichte.
  const werte = { title: "eBay-Titel", description: "eBay-Text", status: "ACTIVE" };
  assert.deepEqual(ohneHandfelder(werte, handfelder(["title"])), { description: "eBay-Text", status: "ACTIVE" });
  assert.deepEqual(ohneHandfelder(werte, handfelder(["title", "description"])), { status: "ACTIVE" });
});

test("kaputte oder unbekannte Markierungen reißen nichts", () => {
  // Die Spalte ist JSON aus der Datenbank, also ungeprüft. Ein Fehler darin
  // darf keinen Sync-Lauf kosten — und ein alter Eintrag darf nicht später ein
  // Feld sperren, das es inzwischen gibt.
  assert.equal(handfelder("kaputt").size, 0);
  assert.equal(handfelder(["gibtsnicht"]).size, 0);
  assert.equal(handfelder(["title", 42, null]).size, 1);
});

test("der Titelschlüssel ist bewusst streng", () => {
  assert.equal(titelSchluessel("  Panini   Prizm  "), "panini prizm");
  assert.equal(titelSchluessel("PANINI PRIZM"), titelSchluessel("panini prizm"));
  // Kein Kürzen, kein Weglassen von Satzzeichen: Bei Einzelstücken wäre ein
  // Fehltreffer eine Karte, die stillschweigend aus dem Vorverkauf fällt.
  assert.notEqual(titelSchluessel("Panini Prizm!"), titelSchluessel("Panini Prizm"));
  assert.notEqual(titelSchluessel("Panini Prizm 2023"), titelSchluessel("Panini Prizm"));
});

test("übernommen wird nur, was gefahrlos wechseln kann", () => {
  assert.equal(darfUebernommenWerden({ id: "a", status: "ACTIVE", hatZusage: false }), true);
  // Verkauft: Der Bestand ist gebucht, ein Wechsel würde die Karte wieder
  // anbieten.
  assert.equal(darfUebernommenWerden({ id: "a", status: "SOLD", hatZusage: false }), false);
  assert.equal(darfUebernommenWerden({ id: "a", status: "INACTIVE", hatZusage: false }), false);
  // Zusage: Ein angenommener Preis gilt 48 Stunden. Ab dem Wechsel bestimmt
  // eBay den Preis — das widerspräche der Zusage.
  assert.equal(darfUebernommenWerden({ id: "a", status: "ACTIVE", hatZusage: true }), false);
});

test("die Liste der Handfelder bleibt klein", () => {
  // Jedes Feld hier kann der Import nicht mehr korrigieren. Wer sie erweitert,
  // soll das bewusst tun und diesen Test mit anfassen.
  assert.deepEqual([...HANDFELDER], ["title", "description", "status"]);
});

test("der Sync übernimmt statt zu duplizieren", async () => {
  const sync = await readFile(new URL("../lib/ebay-sync.ts", import.meta.url), "utf8");
  // Die übernommene Karte muss `kind` und `origin` mitwandern lassen: ohne
  // `kind = EBAY_SYNCED` fasst der Waisen-Sweep sie nie wieder an, ohne
  // `origin = EBAY` liest der Katalog weiter den Produktpreis.
  assert.match(sync, /kind: "EBAY_SYNCED" as const, origin: "EBAY" as const, priceAmountCents: null/u);
  // Ein zweites Angebot darf dieselbe Karte nicht noch einmal greifen.
  assert.match(sync, /uebernahmeKandidaten\.delete\(/u);
});

// --- Adminoberfläche, Vorverkauf, SEC-12 (ai-todo Punkt A) ------------------

test("das Anlegen schreibt Produkt und Bestand in einem Batch", async () => {
  // **Falle Nummer 4 aus Punkt 11.** Ohne Bestandszeile liefert
  // `verfuegbareMenge(..., "MANUAL")` 0 — die Karte erscheint nicht im Katalog
  // und lässt sich nicht kaufen, und zwar ohne jede Fehlermeldung. Zwei
  // getrennte Schreibvorgänge könnten zwischen Produkt und Bestand abbrechen.
  const quelle = await readFile(new URL("../app/api/admin/products/route.ts", import.meta.url), "utf8");
  const batch = quelle.slice(quelle.indexOf("await db.batch(["), quelle.indexOf("return NextResponse.json({ ok: true, id }"));
  assert.match(batch, /db\.insert\(products\)/u);
  assert.match(batch, /db\.insert\(inventory\)/u);
});

test("eine neue Karte trägt PRELISTED und MANUAL", async () => {
  const quelle = await readFile(new URL("../app/api/admin/products/route.ts", import.meta.url), "utf8");
  assert.match(quelle, /kind: "PRELISTED", origin: "MANUAL"/u,
    "beides zusammen ist die Definition einer manuellen Karte");
});

test("Änderungen an eBay-Karten werden als Handmarkierung vermerkt", async () => {
  // Ohne den Vermerk schreibt der Import die Änderung binnen drei Minuten
  // zurück — sie sah erfolgreich aus und war trotzdem weg.
  const quelle = await readFile(new URL("../app/api/admin/products/route.ts", import.meta.url), "utf8");
  for (const feld of ["title", "description", "status"]) {
    assert.ok(quelle.includes(`neueMarkierungen.add("${feld}")`), `${feld} muss als Handmarkierung vermerkt werden`);
  }
  // Bei manuellen Karten gibt es nichts, was überschreiben könnte — eine
  // Markierung wäre dort eine Behauptung ohne Wirkung.
  assert.match(quelle, /\.\.\.\(manuell \? \{\} : \{ manualOverrides/u);
});

test("Preis und Menge einer eBay-Karte lassen sich nicht von Hand setzen", async () => {
  // Sie stehen im Listing, nicht am Produkt. Eine Änderung hier hielte bis zum
  // nächsten Import und wäre dann weg — also gar nicht erst anbieten.
  const quelle = await readFile(new URL("../app/api/admin/products/route.ts", import.meta.url), "utf8");
  assert.match(quelle, /Der Preis einer eBay-Karte kommt von eBay/u);
  assert.match(quelle, /Die Menge einer eBay-Karte kommt von eBay/u);
});

test("die Vorverkaufsseite filtert über origin, nicht über kind", async () => {
  // `kind` ist bei manuellen Karten `PRELISTED` und sagt nichts über die
  // Herkunft. Ein Filter darauf zöge die echte Vormerkliste mit herein.
  const seite = await readFile(new URL("../app/vorverkauf/page.tsx", import.meta.url), "utf8");
  assert.match(seite, /origin === "MANUAL"/u);
  assert.ok(!/kind ===/u.test(seite), "kind darf hier nicht als Filter dienen");
});

test("SEC-12: die OAuth-Rückseite gibt keinen Token mehr aus", async () => {
  const callback = await readFile(new URL("../app/api/admin/ebay/oauth/callback/route.ts", import.meta.url), "utf8");
  // Der Token darf weder in eine HTML-Antwort noch sonstwie in die Antwort auf
  // die Umleitung geraten — die Umleitung kann keine Anmeldung prüfen.
  assert.ok(!/escapeHtml\(result\.refresh_token\)/u.test(callback), "der Token darf nicht mehr angezeigt werden");
  assert.match(callback, /db\.insert\(ebayOauthClaims\)/u);
  assert.match(callback, /status: 303/u);
  // Auch im Fehlerfall nicht: Genau dort sieht niemand hin.
  const fehlerzweig = callback.slice(callback.indexOf("} catch (error) {"));
  assert.ok(!/refresh_token/u.test(fehlerzweig), "der Fehlerzweig darf nicht auf die alte Anzeige zurückfallen");
});

test("SEC-12: abgeholt wird nur mit Adminsitzung, und die Zeile fällt dabei", async () => {
  const claim = await readFile(new URL("../app/api/admin/ebay/oauth/claim/route.ts", import.meta.url), "utf8");
  assert.match(claim, /requireAdmin\(/u);
  // `POST`, damit die Kennung nicht in Verlauf und Protokollen landet.
  assert.ok(!/export async function GET/u.test(claim), "kein GET: die Kennung gehört nicht in den Verlauf");
  assert.match(claim, /db\.delete\(ebayOauthClaims\)\.where\(eq\(/u, "die Zeile muss gelöscht, nicht markiert werden");
});

test("SEC-12: abgelaufene Ansprüche räumt der geplante Lauf ab", async () => {
  // Ein abgebrochener Anschlussversuch ruft die Abholroute nie — ohne diesen
  // Lauf bliebe ein gültiger Refresh-Token in der Datenbank liegen.
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /delete\(ebayOauthClaims\)\.where\(lte\(/u);
});
