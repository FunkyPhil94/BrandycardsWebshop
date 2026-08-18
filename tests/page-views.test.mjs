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
  BESUCHER_ZEILE,
  besucherAdresse,
  besucherSchluessel,
  tagesEimer,
} = await import("../lib/page-views.ts");

const migration = await readFile(new URL("../drizzle/0014_page_views.sql", import.meta.url), "utf8");
const archivMigration = await readFile(new URL("../drizzle/0015_page_view_archive.sql", import.meta.url), "utf8");
const beaconRoute = await readFile(new URL("../app/api/page-views/route.ts", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../app/api/admin/page-views/route.ts", import.meta.url), "utf8");
const aufbewahrung = await readFile(new URL("../lib/page-views-retention.ts", import.meta.url), "utf8");
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

test("der Zähler schreibt die Adresse nicht in die Datenbank", () => {
  // **Diese Zusicherung hat sich am 2026-08-18 geändert, nicht bloß der Code.**
  // Bis dahin galt: Die Route fasst die Adresse überhaupt nicht an. Seit der
  // Entdopplung tut sie es — über `besucherAdresse` — und die Prüfung musste
  // sich verschieben, statt weiterhin nach der Zeichenkette `cf-connecting-ip`
  // zu suchen: Die stünde jetzt in `lib/page-views.ts`, der alte Test wäre
  // durchgelaufen und hätte das Gegenteil behauptet.
  //
  // Was gilt: Was in die Datenbank geht, ist ausschließlich der Prüfwert.
  assert.match(beaconRoute, /besucherSchluessel\(salz, adresse, tag/u, "die Adresse muss durch die Hashfunktion gehen");
  assert.match(beaconRoute, /visitKey: schluessel/u, "gespeichert wird der Schlüssel");
  assert.ok(!/values\(\{[^}]*adresse/u.test(beaconRoute), "die Adresse selbst darf in keinem values() stehen");
  assert.ok(!/user-agent|referer/iu.test(beaconRoute), "die Route fasst Kopfzeilen an, die nichts in der Datenbank zu suchen haben");
});

// --- Entdopplung je Adresse ------------------------------------------------

test("der Entdopplungstag ist der UTC-Kalendertag", () => {
  // Bewusst der Kalendertag und kein rollierendes Fenster: Der tägliche Wechsel
  // des Salzes ist der Datenschutz dieser Messung, und über ihn hinweg gibt es
  // keinen stabilen Schlüssel, an dem 24 gleitende Stunden hängen könnten.
  assert.equal(tagesEimer(NOW), "2026-08-17");
  assert.equal(tagesEimer(new Date("2026-08-17T23:59:59.999Z")), "2026-08-17");
  assert.equal(tagesEimer(new Date("2026-08-18T00:00:00.000Z")), "2026-08-18");
  // Gleich lang und gleich geformt — `day` wird als Zeichenkette verglichen.
  assert.match(tagesEimer(new Date("2026-01-02T03:04:05Z")), /^\d{4}-\d{2}-\d{2}$/u);
});

test("der Prüfwert enthält Salz, Tag und Adresse — und trennt sie", async () => {
  const a = await besucherSchluessel("salz", "1.2.3.4", "2026-08-18");
  const b = await besucherSchluessel("salz", "1.2.3.5", "2026-08-18");
  const morgen = await besucherSchluessel("salz", "1.2.3.4", "2026-08-19");
  const anderesSalz = await besucherSchluessel("pfeffer", "1.2.3.4", "2026-08-18");

  assert.match(a, /^[0-9a-f]{64}$/u, "SHA-256 als Hex");
  assert.notEqual(a, b, "zwei Adressen dürfen nicht denselben Wert ergeben");
  assert.notEqual(a, morgen, "morgen muss derselbe Besucher wieder zählen");
  assert.notEqual(a, anderesSalz, "ohne das Salz wäre der Wert vorherberechenbar");
  assert.equal(a, await besucherSchluessel("salz", "1.2.3.4", "2026-08-18"), "gleiche Eingabe, gleicher Wert");
});

test("Bereichsschlüssel und Kachelschlüssel sind verschieden", async () => {
  // Der ganze Sinn der zwei Schlüssel: Der Bereich zählt je Seite einmal, die
  // Kachel genau einmal. Wären sie gleich, wäre eines von beiden falsch.
  const kachel = await besucherSchluessel("salz", "1.2.3.4", "2026-08-18");
  const start = await besucherSchluessel("salz", "1.2.3.4", "2026-08-18", "/");
  const katalog = await besucherSchluessel("salz", "1.2.3.4", "2026-08-18", "/karten");
  assert.notEqual(kachel, start);
  assert.notEqual(start, katalog);
});

test("kein Zusammenschieben zweier verschiedener Eingaben zu demselben Wert", async () => {
  // Ohne Trenner wäre ("ab", "c") dasselbe wie ("a", "bc") — zwei Besucher mit
  // einem Prüfwert, und einer von beiden verschwindet aus der Zählung.
  assert.notEqual(
    await besucherSchluessel("salz", "1.2.3.4", "2026-08-18", "/karten"),
    await besucherSchluessel("salz", "1.2.3.4", "2026-08-18/karten"),
  );
});

test("die Adresse kommt aus der Kopfzeile von Cloudflare, nicht aus einer fälschbaren", () => {
  // `x-forwarded-for` kann der Client selbst setzen. Stünde er vorn, könnte
  // jeder Besucher sich beliebig oft zählen lassen.
  const beides = new Headers({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1, 2.2.2.2" });
  assert.equal(besucherAdresse(beides), "9.9.9.9");
  assert.equal(besucherAdresse(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "1.1.1.1");
  assert.equal(besucherAdresse(new Headers()), null);
});

test("ohne Salz oder Adresse wird gezählt, nicht verworfen", () => {
  // Ein zu hoher Zähler ist ein erkennbarer Fehler. Eine Messung, die still
  // aussetzt, weil ein Secret fehlt, ist keiner — und genau das wäre die
  // gefährlichere Variante.
  assert.match(beaconRoute, /if \(!salz \|\| !adresse\) \{/u);
  assert.match(beaconRoute, /console\.error\("Aufrufzähler: PAGE_VIEW_SALT fehlt/u);
});

test("die Entscheidung über das Zählen fällt in der Datenbank", () => {
  // Ein SELECT davor und ein INSERT danach wären zwei Schritte mit Platz für
  // einen zweiten Aufruf desselben Besuchers dazwischen — der zählte doppelt.
  assert.match(beaconRoute, /onConflictDoNothing\(\)\s*\.returning\(/u);
  assert.ok(!/select\(\)[\s\S]{0,200}pageViewVisits/u.test(beaconRoute), "kein Lesen vor dem Schreiben");
});

test("die Prüfwerte von gestern werden gelöscht", () => {
  // Sie entdoppeln genau einen Tag; ihr Schlüssel enthält das Datum. Bleiben
  // sie liegen, wächst die Tabelle für nichts.
  assert.match(aufbewahrung, /delete\(pageViewVisits\)/u);
  assert.match(aufbewahrung, /lt\(pageViewVisits\.day, tagesEimer\(jetzt\)\)/u);
});

test("die Kacheln lesen die Besucherzeile, die Tabelle blendet sie aus", () => {
  assert.match(adminRoute, /besucherFenster\("tag"\)/u, "die Kachel darf nicht aus der Summe der Bereiche entstehen");
  assert.match(adminRoute, /zeile\.pfad !== BESUCHER_ZEILE/u, "die Aufschlüsselung muss die Besucherzeile ausblenden");
  assert.match(adminRoute, /eq\(pageViews\.path, BESUCHER_ZEILE\)/u, "auch „Insgesamt“ zählt Besucher");
  assert.match(adminRoute, /eq\(pageViewArchive\.path, BESUCHER_ZEILE\)/u, "und im Archiv ebenso");
});

test("die reservierte Zeile kann mit keinem echten Pfad kollidieren", () => {
  // `normalisiereAufrufpfad` gibt ausschließlich Werte zurück, die mit `/`
  // beginnen. Fängt die reservierte Zeile je mit `/` an, überschreibt ein
  // Besucher mit dem passenden Pfad die Besucherzahl.
  assert.ok(!BESUCHER_ZEILE.startsWith("/"), "die reservierte Zeile darf kein Pfad sein");
  assert.equal(normalisiereAufrufpfad(BESUCHER_ZEILE), null);
  for (const muster of AUFRUF_PFADMUSTER) assert.notEqual(muster, BESUCHER_ZEILE);
});

test("die Datenschutzerklärung behauptet nicht mehr, es werde keine Kennung gespeichert", async () => {
  // **Der Test, der diesen Umbau ehrlich hält.** Abschnitt 11 stützte die
  // Einwilligungsfreiheit auf „keine IP-Adressen, Geräte- oder
  // Sitzungskennungen gespeichert". Das gilt seit der Entdopplung nicht mehr
  // unverändert; der Text muss den Prüfwert nennen.
  const datenschutz = await readFile(new URL("../app/datenschutz/page.tsx", import.meta.url), "utf8");
  assert.ok(!/keine IP-Adressen, Geräte- oder Sitzungskennungen gespeichert/u.test(datenschutz),
    "die alte Zusage steht noch da, obwohl ein Prüfwert gespeichert wird");
  assert.match(datenschutz, /SHA-256/u, "der Prüfwert muss benannt sein");
  assert.match(datenschutz, /IP-Adresse selbst wird nicht gespeichert/u);
});

test("die Beacon-Route antwortet dem Besucher nie mit einem Fehler", () => {
  // Ein Zähler ist Beiwerk. Er darf keine rote Zeile in der Konsole eines
  // Besuchers erzeugen und keinen Wiederholungsversuch auslösen.
  assert.ok(!/status: (4|5)\d\d/u.test(beaconRoute), "die Beacon-Route gibt einen Fehlerstatus zurück");
  assert.match(beaconRoute, /status: 204/u);
});

test("die Aufbewahrung hängt im geplanten Lauf", () => {
  assert.match(worker, /foldExpiredPageViews\(getDb\(\)\)/u);
});

// --- Der Gesamtstand -------------------------------------------------------
// „Insgesamt" darf nicht heimlich „letzte 90 Tage" heißen. Genau das wäre es,
// wenn die Aufbewahrungsfrist Eimer löschte, ohne sie vorher zu summieren:
// Die Zahl finge ab Tag 91 an zu schrumpfen, während der Shop wächst.

test("abgelaufene Eimer werden archiviert, bevor sie gelöscht werden", () => {
  const archivStelle = aufbewahrung.indexOf("insert(pageViewArchive)");
  const loeschStelle = aufbewahrung.indexOf("delete(pageViews)");
  assert.ok(archivStelle > 0 && loeschStelle > 0, "Archivierung oder Löschung fehlt");
  assert.ok(archivStelle < loeschStelle, "gelöscht wird vor dem Archivieren — der Gesamtstand ginge verloren");
});

test("Archivieren und Löschen gehen gemeinsam oder gar nicht", () => {
  // Zwei einzelne Anweisungen hätten zwei stille Fehlschläge: nach dem
  // Archivieren abgebrochen zählt doppelt, nach dem Löschen abgebrochen
  // verliert. `batch` ist auf D1 eine Transaktion.
  assert.match(aufbewahrung, /db\.batch\(\[/u);
  const batchStelle = aufbewahrung.indexOf("db.batch([");
  assert.ok(batchStelle < aufbewahrung.indexOf("insert(pageViewArchive)"));
  assert.ok(batchStelle < aufbewahrung.indexOf("delete(pageViews)"));
});

test("das Archiv addiert auf, statt zu überschreiben", () => {
  // `set: { viewCount: <neuer Wert> }` wäre der Fehler, der bei jedem zweiten
  // Ablauf alles Ältere verwirft.
  assert.match(aufbewahrung, /viewCount: sql`\$\{pageViewArchive\.viewCount\} \+ excluded\.view_count`/u);
  assert.match(archivMigration, /CREATE UNIQUE INDEX[^\n]*page_view_archive_path_unique[^\n]*\(`path`\)/u);
});

test("der Gesamtstand liest beide Tabellen", () => {
  // Ohne das Archiv wäre „insgesamt" nur der Inhalt der Aufbewahrungsfrist.
  assert.match(adminRoute, /sum\(\$\{pageViews\.viewCount\}\)/u);
  assert.match(adminRoute, /sum\(\$\{pageViewArchive\.viewCount\}\)/u);
  assert.match(adminRoute, /insgesamt:/u);
});
