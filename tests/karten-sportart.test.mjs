import assert from "node:assert/strict";
import test from "node:test";

const { RUECKFALL, SPORTARTEN, istSportart, sportartAusTitel, sportartName } =
  await import("../lib/karten-sportart.ts");

// Die Titel hier sind **echte Titel aus dem Bestand** vom 2026-09-13, keine
// erfundenen. Erfundene Titel prüfen die Regel gegen die Vorstellung, die man
// beim Schreiben hatte — und genau die wäre hier zweimal falsch gewesen:
// „Football" als Signal und „NBA" ohne Wortgrenze.

// --- Die Falle: „Football" heißt beides ------------------------------------

test("„Football“ allein macht noch keinen American Football", () => {
  // Der Fehler, der diese Datei nötig gemacht hat. Ein `LIKE '%Football%'`
  // hätte diese sechs Fußballkarten in die falsche Sportart verschoben — und
  // zwar stumm: Eine Karte, die unter der falschen Sportart steht, meldet sich
  // nicht.
  for (const titel of [
    "2025 Futera INCREDIBLE Football Senegal Nicolas Jackson Patch 05/07",
    "2025 Futera UNIQUE World Football Edition 21 Brasilien Ronaldo R9 03/10",
    "Topps Total Football 25/26 Real Madrid Franco Mastantuono Rookie 65/99",
    "Topps Total Football 23/24 Euro 2024 Spanien Rodrigo Riquelme National Debut 4/5",
    "Topps UCC Finest 25/26 Atletico Madrid Julian Alvarez Prized Footballers 33/50",
    "Topps Merlin Premier League 2026 Fulham Harry Wilson Fantasy Football",
  ]) assert.equal(sportartAusTitel(titel), "FUSSBALL", titel);
});

test("der volle NFL-Teamname entscheidet, nicht das Wort Football", () => {
  for (const titel of [
    "Topps Chrome Football 2025 Miami Dolphins Quinn Ewers RC",
    "1997 Pinnacle Football Miami Dolphins Dan Marino The Next Level Beckett 9 Jersey",
    "2016 Panini Immaculate Cleveland Browns Ricardo Louis Patch 16/50",
    "Panini Donruss 2022 Los Angeles Chargers Mike Williams Ball Star Fusion Relic",
    "Topps Chrome Football 2025 San Francisco 49ers Mykel Williams RC",
    "2021 Panini Playoff Football Washington Commanders Dyami Brown RC",
  ]) assert.equal(sportartAusTitel(titel), "AMERICAN_FOOTBALL", titel);
});

test("ohne Stadt keine Mannschaft — sonst wird Ramsey zu den Rams", () => {
  // Echter Titel aus dem Bestand. Eine Liste mit bloßem „Rams" hätte ihn
  // getroffen, und eine Premier-League-Karte stünde unter American Football.
  assert.equal(
    sportartAusTitel("Topps Premier League Flagship 26/27 Newcastle United Jacob Ramsey Stars of the Premier League"),
    "FUSSBALL");
});

test("Wortgrenzen: Beckenbauer ist kein Basketballspieler", () => {
  // Ohne `\\b` hätte der Bestand am 2026-09-13 vier Basketballkarten gehabt,
  // die allesamt Franz BeckeNBAuer zeigen.
  assert.equal(
    sportartAusTitel("Topps UCC Flagship 25/26 FC Bayern München Franz Beckenbauer Best of the Best"),
    "FUSSBALL");
  assert.equal(
    sportartAusTitel("Panini Donruss Road to World Cup 2026 Deutschland Franz Beckenbauer Dominators"),
    "FUSSBALL");
});

// --- Die übrigen Sorten des Bestands ---------------------------------------

test("WWE ist Wrestling", () => {
  assert.equal(sportartAusTitel("Topps Chrome WWE 2026 Brock Lesnar Focus Reel"), "WRESTLING");
  assert.equal(sportartAusTitel("Topps Chrome WWE 2026 Arianna Grace Base Auto NXT-ARI"), "WRESTLING");
});

test("Marvel und Disney sind gar kein Sport", () => {
  for (const titel of [
    "Topps Finest Fantastic Four 2026 Concept Art Silver Surfer #CA-15",
    "2026 Topps Marvel Brooklyn Collection Daredevil Base Card  Orange 11/25",
    "Topps Disney Neon 2026 Rainbow Foil Captain Hook",
  ]) assert.equal(sportartAusTitel(titel), "NON_SPORT", titel);
});

test("Non-Sport wird vor den Sportarten geprüft", () => {
  // „Black Panther" darf nicht an „Carolina Panthers" hängen bleiben. Der
  // Titel ist echt und trägt beide Wörter nicht — aber die Reihenfolge der
  // Regeln ist genau das, was ihn rettet, falls ein Set je beides trägt.
  assert.equal(
    sportartAusTitel("Topps Finest Fantastic Four 2026  Black Panther Rock Stars #RS-01 Case Hit SSP"),
    "NON_SPORT");
});

// --- Die Rückfalllinie, ausdrücklich -----------------------------------------

test("was keine benannte Ausnahme trifft, gilt als Fußball", () => {
  assert.equal(RUECKFALL, "FUSSBALL");
  assert.equal(sportartAusTitel("Topps UCC Gold 25/26 FC Barcelona Robert Lewandowski Base 3/5"), "FUSSBALL");
  assert.equal(sportartAusTitel("Daka Real Madrid 25/26 Daniel Carvajal Gameboy 13/25"), "FUSSBALL");
  // Auch ein Titel ohne jeden Anhaltspunkt. **Das ist Absicht, keine Lücke:**
  // Fußball positiv zu erkennen hieße, jeden Verein der Welt aufzulisten, und
  // jede Lücke darin wäre eine Karte unter *keiner* Sportart.
  assert.equal(sportartAusTitel("Topps Chrome Bernd Schneider /75 Auto"), "FUSSBALL");
  assert.equal(sportartAusTitel(""), "FUSSBALL");
});

test("der bekannte Fehlgriff ist benannt, nicht behauptet", () => {
  // College Football ohne Ligabezug im Titel — die einzige der 907 Karten vom
  // 2026-09-13, die die Ableitung falsch einordnet. Der Test hält das fest,
  // damit die Grenze nicht in Vergessenheit gerät: Berichtigt wird sie von
  // Hand im Adminbereich, wo `sport` als Handfeld den Sync überlebt.
  assert.equal(
    sportartAusTitel("2024 Leaf Electrum Football Carson Beck Prospects Autograph 1/2"),
    "FUSSBALL");
});

// --- Die Liste selbst --------------------------------------------------------

test("jede Sportart hat einen eindeutigen Wert und einen Namen", () => {
  const werte = SPORTARTEN.map((eintrag) => eintrag.wert);
  assert.equal(new Set(werte).size, werte.length);
  for (const eintrag of SPORTARTEN) {
    assert.match(eintrag.wert, /^[A-Z_]+$/u, `${eintrag.wert} ist kein Datenbankwert`);
    assert.ok(eintrag.name.length > 0);
  }
});

test("jedes Ergebnis der Ableitung steht auch in der Liste", () => {
  // Sonst gäbe es eine Sportart in der Datenbank, die keine Auswahl anbietet.
  const bekannt = new Set(SPORTARTEN.map((eintrag) => eintrag.wert));
  for (const titel of [
    "Topps Chrome Football 2025 Miami Dolphins Quinn Ewers RC",
    "Topps Chrome WWE 2026 Brock Lesnar Focus Reel",
    "Topps Disney Neon 2026 Rainbow Foil Captain Hook",
    "Panini Prizm Basketball 2025 Base",
    "Topps Baseball 2025 Base",
    "Upper Deck NHL 2025 Base",
    "Topps UCC Gold 25/26 FC Barcelona Robert Lewandowski Base 3/5",
  ]) assert.ok(bekannt.has(sportartAusTitel(titel)), titel);
});

test("istSportart lässt nur bekannte Werte durch", () => {
  assert.equal(istSportart("FUSSBALL"), true);
  assert.equal(istSportart("AMERICAN_FOOTBALL"), true);
  // Der Anzeigename ist kein gültiger Wert — er steht nie in der Adresse.
  assert.equal(istSportart("Fußball"), false);
  assert.equal(istSportart("HANDBALL"), false);
  assert.equal(istSportart(""), false);
  assert.equal(istSportart(null), false);
  assert.equal(istSportart(undefined), false);
});

test("ein unbekannter Wert behält in der Anzeige seinen rohen Namen", () => {
  // Lieber ein sperriges Wort in der Auswahl als ein leerer Eintrag, den
  // niemand zuordnen kann.
  assert.equal(sportartName("AMERICAN_FOOTBALL"), "American Football");
  assert.equal(sportartName("HANDBALL"), "HANDBALL");
});
