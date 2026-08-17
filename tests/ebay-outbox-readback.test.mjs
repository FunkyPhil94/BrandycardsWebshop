import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// **Eigenes Modul, und das ist der Punkt.** `lib/ebay-outbox.ts` importiert
// `../db` als Verzeichnis und laesst sich aus Node-Tests gar nicht laden --
// deshalb prueft bis heute kein Test die Outbox-Schleife. Die entscheidbaren
// Teile gehoeren deshalb auf diese Seite der Grenze.
const { istMengeVerdaechtig, pruefeMengeNach } = await import("../lib/ebay-outbox-readback.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const auftrag = { id: "job-1", ebayItemId: "398200679813" };
const menge = (wert) => async () => new Map([[auftrag.ebayItemId, { quantityAvailable: wert }]]);

/** Sammelt Alarme statt sie zu verschicken. */
function alarmsammler() {
  const alarme = [];
  return { alarme, async alarm(a) { alarme.push(a); } };
}

const stumm = async (fn) => {
  const log = console.log;
  const warn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
};

test("nicht ablesbar ist nicht dasselbe wie nicht null", () => {
  // Ohne diese Unterscheidung meldete jede unvollstaendige eBay-Antwort einen
  // Doppelverkauf -- dieselbe Linie wie bei AssistantSalesChannel.available.
  assert.equal(istMengeVerdaechtig(null), false);
  assert.equal(istMengeVerdaechtig(0), false);
  assert.equal(istMengeVerdaechtig(1), true);
  assert.equal(istMengeVerdaechtig(7), true);
});

test("Menge 0 nach der Rücknahme ist der Erfolgsfall und alarmiert nicht", async () => {
  const { alarme, alarm } = alarmsammler();
  await stumm(() => pruefeMengeNach(auftrag, menge(0), alarm));
  assert.deepEqual(alarme, []);
});

test("eBay meldet Erfolg, die Karte ist aber weiter käuflich — das alarmiert", async () => {
  // Der eigentliche Grund fuer diese Pruefung: Hier waere die Karte im Shop
  // verkauft und bei eBay noch zu haben. Genau der Doppelverkauf, den Punkt 6
  // verhindern soll -- und er waere ohne Nachlesen unsichtbar.
  const { alarme, alarm } = alarmsammler();
  await stumm(() => pruefeMengeNach(auftrag, menge(3), alarm));

  assert.equal(alarme.length, 1);
  assert.match(alarme[0].title, /weiter käuflich/u);
  assert.match(alarme[0].detail, /398200679813/u);
  assert.match(alarme[0].detail, /weiterhin 3/u);
  assert.match(alarme[0].category, /eBay-Rücknahme/u);
  // Der Schluessel muss je Auftrag eindeutig sein, sonst unterdrueckt die
  // Dublettenerkennung den zweiten Vorfall.
  assert.match(alarme[0].key, /job-1/u);
});

test("eine nicht ablesbare Menge alarmiert nicht, aber sie verschluckt sich auch nicht", async () => {
  const { alarme, alarm } = alarmsammler();
  await stumm(() => pruefeMengeNach(auftrag, menge(null), alarm));
  assert.deepEqual(alarme, []);

  // Ein leeres Ergebnis (eBay kennt die Nummer nicht) ist derselbe Fall.
  const leer = alarmsammler();
  await stumm(() => pruefeMengeNach(auftrag, async () => new Map(), leer.alarm));
  assert.deepEqual(leer.alarme, []);
});

test("ein Fehlschlag beim Nachlesen darf den erledigten Auftrag nicht umwerfen", async () => {
  // Der Schreibvorgang war erfolgreich. Eine Diagnose, die danach wirft, wuerde
  // den Auftrag in RETRY_WAIT schicken und dieselbe Menge erneut setzen.
  const { alarme, alarm } = alarmsammler();
  await stumm(() => pruefeMengeNach(auftrag, async () => { throw new Error("eBay nicht erreichbar"); }, alarm));
  assert.deepEqual(alarme, [], "ein Netzfehler ist kein Doppelverkauf");
});

test("ohne ItemID wird gar nicht nachgelesen", async () => {
  let gefragt = 0;
  const { alarm } = alarmsammler();
  await stumm(() => pruefeMengeNach({ id: "job-2", ebayItemId: null }, async () => { gefragt += 1; return new Map(); }, alarm));
  assert.equal(gefragt, 0, "ein Aufruf ohne Nummer kostet Kontingent und kann nichts liefern");
});

test("nachgelesen wird nur bei REVISED, nicht bei ALREADY_ENDED", async () => {
  // Bei einem bereits beendeten Angebot ist nichts mehr zu pruefen, und der
  // Trading-Topf ist geteilt.
  const outbox = await read("lib/ebay-outbox.ts");
  assert.match(outbox, /if \(ergebnis === "REVISED"\) await pruefeMengeNach\(job\);/u);
});

test("welche ALREADY_ENDED-Nummer griff, steht jetzt im Protokoll", async () => {
  // Die drei Nummern stammen aus der Dokumentation, nicht aus Beobachtung. Der
  // Abnahmetest belegte nur, dass eine davon griff -- nicht welche.
  const client = await read("lib/ebay-client.ts");
  assert.match(client, /const getroffen = codes\.filter\(\(code\) => ALREADY_ENDED_CODES\.has\(code\)\)/u);
  assert.match(client, /console\.log\("\[ebay\] ReviseInventoryStatus: Angebot war bereits beendet\.", \{ itemId, getroffen, alleCodes: codes \}\)/u);
});
