import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  AUFRUF_AUFBEWAHRUNG_TAGE,
  AUFRUF_FENSTER,
  AUFRUF_PFADMUSTER,
  MAX_AUFRUF_PFAD_LAENGE,
  aufrufAufbewahrungGrenze,
  fensterBeginn,
  normalisiereAufrufpfad,
  stundenEimer,
} = await import("../lib/page-views.ts");

const migration = await readFile(new URL("../drizzle/0014_page_views.sql", import.meta.url), "utf8");
const beaconRoute = await readFile(new URL("../app/api/page-views/route.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

const NOW = new Date("2026-08-17T14:37:12.480Z");

// --- Pfadnormalisierung -----------------------------------------------------
// Der rohe Pfad darf nicht in die Datenbank: ~300 Karten mal 24 Stunden wären
// 7 000 Zeilen am Tag, und Abfrageparameter trügen Suchbegriffe der Besucher
// mit hinein.

test("bekannte Seiten behalten ihren Pfad", () => {
  assert.equal(normalisiereAufrufpfad("/"), "/");
  assert.equal(normalisiereAufrufpfad("/karten"), "/karten");
  assert.equal(normalisiereAufrufpfad("/checkout/paypal/success"), "/checkout/paypal/success");
});

test("jede Kartenseite fällt auf ein einziges Muster zusammen", () => {
  assert.equal(normalisiereAufrufpfad("/karten/abc123"), "/karten/[id]");
  assert.equal(normalisiereAufrufpfad("/karten/eine-ganz-andere-karte"), "/karten/[id]");
});

test("Abfrage und Anker erzeugen kein eigenes Muster", () => {
  assert.equal(normalisiereAufrufpfad("/karten?suche=ronaldo&seite=3"), "/karten");
  assert.equal(normalisiereAufrufpfad("/karten#treffer"), "/karten");
  // Der Suchbegriff selbst darf nirgends überleben.
  assert.ok(!String(normalisiereAufrufpfad("/karten?suche=ronaldo")).includes("ronaldo"));
});

test("Schrägstrich am Ende und Großschreibung sind dieselbe Seite", () => {
  assert.equal(normalisiereAufrufpfad("/karten/"), "/karten");
  assert.equal(normalisiereAufrufpfad("/Karten"), "/karten");
  assert.equal(normalisiereAufrufpfad("/"), "/");
});

test("Unbekanntes sammelt sich, statt die Tabelle wachsen zu lassen", () => {
  assert.equal(normalisiereAufrufpfad("/gibt-es-nicht"), "/sonstiges");
  assert.equal(normalisiereAufrufpfad("/a/b/c/d/e"), "/sonstiges");
});

test("der Adminbereich wird nicht mitgezählt", () => {
  // Die eigenen Besuche des Betreibers in der Zahl, an der er den Shop misst,
  // wären eine Verfälschung — und zwar die größte, wenn sonst wenig los ist.
  assert.equal(normalisiereAufrufpfad("/admin"), null);
  assert.equal(normalisiereAufrufpfad("/admin/"), null);
  assert.equal(normalisiereAufrufpfad("/ADMIN?x=1"), null);
});

test("Unbrauchbares wird abgewiesen statt gezählt", () => {
  assert.equal(normalisiereAufrufpfad(""), null);
  assert.equal(normalisiereAufrufpfad("https://fremde.example/"), null);
  assert.equal(normalisiereAufrufpfad("karten"), null);
  assert.equal(normalisiereAufrufpfad(`/${"x".repeat(MAX_AUFRUF_PFAD_LAENGE)}`), null);
});

test("jedes Ergebnis stammt aus der festen Liste", () => {
  const muster = new Set(AUFRUF_PFADMUSTER);
  for (const eingabe of ["/", "/karten/x", "/quatsch", "/checkout", "/account?tab=2", "/UEBER-UNS"]) {
    const ergebnis = normalisiereAufrufpfad(eingabe);
    assert.ok(ergebnis === null || muster.has(ergebnis), `${eingabe} ergab ${ergebnis}`);
  }
});

// --- Eimer und Fenster ------------------------------------------------------

test("der Eimer ist der Stundenbeginn in UTC und immer gleich geformt", () => {
  assert.equal(stundenEimer(NOW), "2026-08-17T14:00:00.000Z");
  // Feste Länge und feste Zeitzone: Die Fensterabfragen sind
  // Zeichenkettenvergleiche in SQL und gehen nur so auf.
  assert.equal(stundenEimer(new Date("2026-01-02T03:04:05.006Z")), "2026-01-02T03:00:00.000Z");
  assert.equal(stundenEimer(NOW).length, stundenEimer(new Date("2026-01-02T03:00:00Z")).length);
});

test("Eimer sortieren sich als Zeichenketten in Zeitreihenfolge", () => {
  const frueher = stundenEimer(new Date("2026-08-17T09:00:00Z"));
  const spaeter = stundenEimer(new Date("2026-08-17T10:00:00Z"));
  assert.ok(frueher < spaeter);
  // Der Jahreswechsel ist die Stelle, an der ein schlechteres Format kippt.
  assert.ok(stundenEimer(new Date("2025-12-31T23:00:00Z")) < stundenEimer(new Date("2026-01-01T00:00:00Z")));
});

test("die drei Fenster umfassen 24, 168 und 720 Eimer", () => {
  const eimerZahl = (fenster) =>
    (new Date(stundenEimer(NOW)).getTime() - new Date(fensterBeginn(fenster, NOW)).getTime()) / 3600_000 + 1;
  assert.equal(eimerZahl("tag"), 24);
  assert.equal(eimerZahl("woche"), 24 * 7);
  assert.equal(eimerZahl("monat"), 24 * 30);
  assert.equal(AUFRUF_FENSTER.monat.stunden, 720);
});

test("das kleinere Fenster liegt vollständig im größeren", () => {
  // Die Adminabfrage summiert alle drei aus einem einzigen Lesevorgang über
  // das größte Fenster. Das ist nur richtig, solange das gilt.
  assert.ok(fensterBeginn("monat", NOW) < fensterBeginn("woche", NOW));
  assert.ok(fensterBeginn("woche", NOW) < fensterBeginn("tag", NOW));
  assert.ok(fensterBeginn("tag", NOW) <= stundenEimer(NOW));
});

test("der Fensterbeginn liegt auf einer vollen Stunde", () => {
  for (const fenster of ["tag", "woche", "monat"]) {
    assert.match(fensterBeginn(fenster, NOW), /T\d\d:00:00\.000Z$/u);
  }
});

// --- Aufbewahrung -----------------------------------------------------------

test("die Aufbewahrung reicht weiter als das größte Fenster", () => {
  // Sonst löschte der Cron Eimer weg, die die 30-Tage-Zahl noch braucht.
  assert.ok(AUFRUF_AUFBEWAHRUNG_TAGE * 24 > AUFRUF_FENSTER.monat.stunden);
  assert.ok(aufrufAufbewahrungGrenze(NOW) < fensterBeginn("monat", NOW));
});

test("die Aufbewahrungsgrenze ist ein Eimer wie jeder andere", () => {
  assert.equal(aufrufAufbewahrungGrenze(NOW, 1), "2026-08-16T14:00:00.000Z");
});

// --- Verdrahtung ------------------------------------------------------------
// Die Teile oben sind für sich richtig und nutzlos, wenn sie nirgends hängen.

test("der eindeutige Index existiert, sonst kann nichts hochzählen", () => {
  // `ON CONFLICT (bucket_start, path) DO UPDATE` braucht ihn; ohne ihn
  // scheiterte jeder zweite Aufruf derselben Seite in derselben Stunde.
  assert.match(migration, /CREATE UNIQUE INDEX[^\n]*page_views_bucket_unique[^\n]*\(`bucket_start`, `path`\)/u);
  assert.match(beaconRoute, /onConflictDoUpdate/u);
});

test("der Zähler schreibt nichts über die aufrufende Person", () => {
  // Die Route darf die Adresse nur an die Ratengrenze geben, nicht speichern.
  assert.ok(!/cf-connecting-ip|user-agent|referer/iu.test(beaconRoute), "die Beacon-Route fasst Kopfzeilen an, die nichts in der Datenbank zu suchen haben");
});

test("die Beacon-Route antwortet dem Besucher nie mit einem Fehler", () => {
  // Ein Zähler ist Beiwerk. Er darf keine rote Zeile in der Konsole eines
  // Besuchers erzeugen und keinen Wiederholungsversuch auslösen.
  assert.ok(!/status: (4|5)\d\d/u.test(beaconRoute), "die Beacon-Route gibt einen Fehlerstatus zurück");
  assert.match(beaconRoute, /status: 204/u);
});

test("die Aufbewahrung hängt im geplanten Lauf", () => {
  assert.match(worker, /aufrufAufbewahrungGrenze/u);
  assert.match(worker, /delete\(pageViews\)/u);
});
