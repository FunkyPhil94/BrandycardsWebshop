import assert from "node:assert/strict";
import test from "node:test";

const { auflageAusTitel, hatAutogramm, hatRelikt, istBewertet, merkmaleAusTitel } =
  await import("../lib/karten-merkmale.ts");

// Die Titel in diesen Tests sind **echte Titel aus dem Bestand** vom
// 2026-08-20, keine erfundenen. Erfundene Titel prüfen die Regel gegen die
// Vorstellung, die man beim Schreiben hatte — und genau die war hier falsch.

// --- Auflage gegen Saison ---------------------------------------------------

test("die Saison im Setnamen ist keine Auflage", () => {
  // **Der Fehler, der diese Datei nötig gemacht hat.** Ein naives `Zahl/Zahl`
  // traf 162 von 271 Titeln; nummeriert sind 120. Ein Filter, der fast alles
  // zeigt, sieht nicht kaputt aus — nur nutzlos.
  assert.equal(auflageAusTitel("Topps UCC Gold 25/26 FC Barcelona Messi Golden Boot Winners"), null);
  assert.equal(auflageAusTitel("Topps Chrome UCC 22/23 Paris Saint-Germain Neymar Jr Pulsar Refractor"), null);
  assert.equal(auflageAusTitel("Panini Select Soccer 2017/2018 Argentinien Lionel Messi #76 PSA 10"), null);
  assert.equal(auflageAusTitel("Topps Premier League Flagship Edition Mega Tin 26/27 , 40 Karten pro Tin"), null);
});

test("die Auflage wird auch mitten im Titel erkannt", () => {
  // „Am Ende suchen" wäre die einfachere Regel gewesen und hätte diese vier
  // verloren: Hinter der Auflage steht oft noch die Farbe.
  assert.equal(auflageAusTitel("Topps Carneval 25/26 Real Madrid Federico Valerde 69/75 Purple"), "69/75");
  assert.equal(auflageAusTitel("Topps Chrome Premier League 25/26 FC Liverpool Florian Wirtz 127/199 RayWave"), "127/199");
  assert.equal(auflageAusTitel("Topps UCC Chrome 25/26 FC Chelsea Andrey Santos 059/150 Color Match"), "059/150");
  assert.equal(auflageAusTitel("Daka Real Madrid Top Audience 25/26 Daniel Carvajal 05/10 Gold"), "05/10");
});

test("eine Auflage, die zufällig aussieht wie eine Saison", () => {
  // **Der Fall, an dem die einfache Regel zerbricht.** `49/50` sind gleich
  // lange, aufeinanderfolgende Zahlen — wie `24/25`. Unterscheidbar nur daran,
  // dass die Saison im Setnamen steht und damit zuerst kommt.
  assert.equal(
    auflageAusTitel("Topps Merlin UCC 24/25 Borussia Dortmund Julian Brandt Elite Society 49/50"),
    "49/50",
  );
});

test("eine Auflage ohne Zähler wird erkannt", () => {
  assert.equal(auflageAusTitel("Topps Merlin UCC 24/25 Borussia Dortmund Julian Brandt Elite Society /50"), "/50");
});

test("führende Nullen und dreistellige Auflagen bleiben, wie sie sind", () => {
  assert.equal(auflageAusTitel("2024 Topps Chrome UEFA EURO England Rico Lewis National Debut 028/125"), "028/125");
  assert.equal(auflageAusTitel("2025 Futera INCREDIBLE Football USA Tim Howard Reminisce Double Patch 04/04"), "04/04");
});

test("Titel ohne jedes Zahlenpaar", () => {
  assert.equal(auflageAusTitel("Topps Merlin UCC 24/25 FC Barcelona Lamine Yamal Base"), null);
  assert.equal(auflageAusTitel("Ein Titel ganz ohne Zahlen"), null);
});

// --- Die drei Ja-Nein-Merkmale ---------------------------------------------

test("Autogramm", () => {
  assert.ok(hatAutogramm("Topps UCC Gold 25/26 Paris Saint-Germain Lucas Beraldo Base Autograph"));
  assert.ok(hatAutogramm("2020 Panini Limited Football Miami Dolphins Lynn Bowden Jr. RC Patch Auto 04/25"));
  assert.ok(hatAutogramm("Panini Donruss Soccer 24/25 USA Weston McKennie Signature Series Autograph"));
  assert.ok(!hatAutogramm("Topps UCC Gold 25/26 FC Barcelona Messi Golden Boot Winners"));
});

test("Relikt zählt relic, jersey und patch — vom Betreiber so festgelegt", () => {
  assert.ok(hatRelikt("2016 Panini Immaculate Cleveland Browns Ricardo Louis Patch 16/50"));
  assert.ok(hatRelikt("Topps Museum UEFA 24/25 Manchester City Kevin De Bruyne Jersey Relic 090/150"));
  assert.ok(hatRelikt("Panini Impeccable 22/23 Manchester City Jack Grealish Relic Jersey 05/10"));
  assert.ok(!hatRelikt("Topps UCC Gold 25/26 FC Barcelona Messi Golden Boot Winners"));
});

test("Bewertung erkennt die Häuser und das Wort selbst", () => {
  assert.ok(istBewertet("Panini Select Soccer 2017/2018 Argentinien Lionel Messi #76 PSA 10"));
  assert.ok(istBewertet("Irgendeine Karte PGS 9.5"));
  assert.ok(istBewertet("Irgendeine Karte BGS 9.5"));
  assert.ok(istBewertet("Irgendeine Karte Graded"));
  assert.ok(!istBewertet("Topps UCC Gold 25/26 FC Barcelona Messi Golden Boot Winners"));

  // **Beckett ist beides: Bewertungshaus und Panini-Set.** Beim ersten Lauf in
  // Produktion traf die Liste sechs Karten, von denen „Beckett Jersey Fusion"
  // keine Bewertung ist. Deshalb dort eine Note verlangt.
  assert.ok(istBewertet("1997 Pinnacle Football Miami Dolphins Dan Marino The Next Level Beckett 9 Jersey"));
  assert.ok(!istBewertet("2022 Panini Mosaic Football Dallas Cowboys Dak Prescott Beckett Jersey Fusion"));
});

test("die Wortgrenzen halten Teiltreffer heraus", () => {
  // **Ohne sie würde „Autogrammkarte" in jedem Wort mit `auto` stecken.**
  // `Automatic`, `Psalm`, `Dispatch` — alles Wörter, die ein Muster ohne
  // Grenzen fälschlich trifft, und der Fehler wäre stumm.
  assert.ok(!hatAutogramm("Ein Titel mit Automatic darin"));
  assert.ok(!istBewertet("Ein Titel mit Psalm darin"));
  assert.ok(!hatRelikt("Ein Titel mit Dispatch darin"));
});

test("merkmaleAusTitel liefert die Form, die products erwartet", () => {
  assert.deepEqual(
    merkmaleAusTitel("Panini Impeccable 22/23 Manchester City Jack Grealish Relic Jersey 05/10"),
    { numbering: "05/10", autograph: false, graded: false, relic: true },
  );
  assert.deepEqual(
    merkmaleAusTitel("Topps Merlin UCC 24/25 FC Barcelona Lamine Yamal Base"),
    { numbering: null, autograph: false, graded: false, relic: false },
  );
});
