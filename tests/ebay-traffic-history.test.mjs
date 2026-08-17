import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { EBAY_TRAFFIC_NACHHOLTAGE, trafficDateStamp, trafficTage, trafficWindow } =
  await import("../lib/ebay-read-api.ts");
const { EBAY_TRAFFIC_HISTORIE_ABSTAND_MS, istTagesaufrufLaufFaellig } =
  await import("../lib/ebay-read-sync.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const JETZT = new Date("2026-08-17T09:00:00.000Z");

test("geholt werden zurückliegende Tage, nie der laufende", () => {
  // Der laufende Tag ist bei eBay nicht ausgezaehlt; ein Wert dafuer waere
  // systematisch zu niedrig. Dieselbe Ueberlegung wie bei trafficWindow.
  const tage = trafficTage(JETZT);
  assert.deepEqual(tage, ["20260816", "20260815", "20260814"]);
  assert.doesNotMatch(tage.join(","), /20260817/u, "der heutige Tag fehlt bewusst");
  assert.equal(tage.length, EBAY_TRAFFIC_NACHHOLTAGE);
});

test("mehrere Tage werden nachgeholt, weil eBays Zahlen nachhinken", () => {
  // Ein einmal geholter Tag kann sich noch aendern. Wuerde nur der gestrige
  // geholt, bliebe eine Korrektur fuer immer aus.
  assert.ok(EBAY_TRAFFIC_NACHHOLTAGE >= 2, "ein einzelner Tag liesse Nachzuegler liegen");
});

test("der Riegel hält den 15-Minuten-Takt von der Historie fern", () => {
  // Ungebremst waeren es rund 576 Zusatzabrufe am Tag gegen ein geteiltes
  // Kontingent -- fuer Zahlen, die sich einmal taeglich aendern.
  const vorEinerStunde = new Date(JETZT.getTime() - 60 * 60_000).toISOString();
  assert.equal(istTagesaufrufLaufFaellig(vorEinerStunde, JETZT), false);

  const vorEinemTag = new Date(JETZT.getTime() - 25 * 60 * 60_000).toISOString();
  assert.equal(istTagesaufrufLaufFaellig(vorEinemTag, JETZT), true);
  assert.ok(EBAY_TRAFFIC_HISTORIE_ABSTAND_MS < 24 * 60 * 60_000,
    "knapp unter einem Tag, sonst faellt bei Verschiebungen ein Tag aus");
});

test("ohne oder mit unlesbarem Zeitstempel wird geholt", () => {
  // Lieber ein Abruf zu viel als eine Historie, die wegen eines kaputten Werts
  // nie wieder waechst.
  assert.equal(istTagesaufrufLaufFaellig(null, JETZT), true);
  assert.equal(istTagesaufrufLaufFaellig(undefined, JETZT), true);
  assert.equal(istTagesaufrufLaufFaellig("kein Zeitstempel", JETZT), true);
});

test("ein Tag wird als Ein-Tages-Fenster geholt, nicht als Differenz", async () => {
  // **Der fachliche Kern.** eBay liefert ein rollierendes Fenster; die Differenz
  // zweier Tagesstaende ist keine Tageszahl, weil hinten so viel herausfaellt
  // wie vorn hinzukommt.
  const [api, sync] = await Promise.all([read("lib/ebay-read-api.ts"), read("lib/ebay-read-sync.ts")]);
  assert.match(api, /fenster\?: \{ start: string; end: string \}/u);
  assert.match(api, /const \{ start, end \} = fenster \?\? trafficWindow\(now\)/u);
  assert.match(sync, /fetchEbayListingTraffic\(ebayItemIds, now, \{ start: tag, end: tag \}\)/u);
});

test("die Historie wird nie geleert", async () => {
  const sync = await read("lib/ebay-read-sync.ts");
  // ebay_listing_traffic wird bewusst gefenstert -- die Historie nicht.
  assert.match(sync, /db\.delete\(ebayListingTraffic\)/u);
  assert.doesNotMatch(sync, /db\.delete\(ebayListingTrafficDaily\)/u,
    "ein Tageswert ist eine Tatsache, kein Momentanstand");
});

test("wiederholtes Holen desselben Tages korrigiert, statt zu doppeln", async () => {
  const [sync, migration] = await Promise.all([
    read("lib/ebay-read-sync.ts"),
    read("drizzle/0015_ebay_traffic_history.sql"),
  ]);
  assert.match(sync, /target: \[ebayListingTrafficDaily\.ebayItemId, ebayListingTrafficDaily\.day\]/u);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS `ebay_listing_traffic_daily_unique`/u);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `ebay_listing_traffic_daily`/u);
});

test("die bestehende 30-Tage-Auskunft bleibt unberührt", async () => {
  // Sie beantwortet weiter „was ist gerade gefragt", solange die Historie duenn
  // ist. Ein Umbau haette das Werkzeug ebay_most_viewed mitgerissen.
  const [sync, api] = await Promise.all([read("lib/ebay-read-sync.ts"), read("lib/ebay-read-api.ts")]);
  assert.match(sync, /rangeStart: start,\s*\n\s*rangeEnd: end,/u);
  assert.match(api, /export const EBAY_TRAFFIC_WINDOW_DAYS = 30;/u);
  assert.deepEqual(Object.keys(trafficWindow(JETZT)), ["start", "end"]);
  assert.equal(trafficDateStamp(new Date("2026-08-16T00:00:00Z")), "20260816");
});
