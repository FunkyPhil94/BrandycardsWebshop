import assert from "node:assert/strict";
import test from "node:test";

const { planBauen, planZusammenfassen, MAX_TITEL } = await import("../lib/karten-import.ts");

// Die Massenanlage legt Karten einzeln an, nacheinander, über dieselbe Route
// wie das Formular für eine Karte. Der gefährliche Teil ist deshalb nicht das
// Hochladen, sondern der Plan davor: Was er als „bereit" ausweist, wird ohne
// weitere Rückfrage in den Shop geschrieben.

const bild = (name, size = 1_200_000, type = "image/jpeg") => ({ name, size, type });

function zeile(titel, bilddatei, rest = {}) {
  return { Titel: titel, Bilddatei: bilddatei, Menge: "1", ...rest };
}

test("eine vollständige Zeile mit vorhandenem Bild ist bereit", () => {
  const plan = planBauen({
    zeilen: [zeile("Topps Flagship 26/27 Arsenal London Bukayo Saka Base", "saka_base.jpg")],
    bilder: [bild("saka_base.jpg")],
    vorhandeneTitel: [],
  });
  assert.equal(plan.posten[0].stand, "bereit");
  assert.equal(plan.posten[0].menge, 1);
  // Zeile 2, weil Zeile 1 die Kopfzeile ist — die Nummer soll in Excel
  // wiederzufinden sein, nicht im Feld eines Arrays.
  assert.equal(plan.posten[0].zeile, 2);
});

test("Groß- und Kleinschreibung trennt keine Bilddatei von ihrer Zeile", () => {
  // Windows liefert Dateinamen mal so, mal so. Ein Abgleich, der daran
  // scheitert, meldet „Bild fehlt" für ein Bild, das im Ordner liegt.
  const plan = planBauen({
    zeilen: [zeile("Eine Karte", "Saka_Base.JPG")],
    bilder: [bild("saka_base.jpg")],
    vorhandeneTitel: [],
  });
  assert.equal(plan.posten[0].stand, "bereit");
  assert.deepEqual(plan.unbenutzteBilder, []);
});

test("ein fehlendes Bild macht die Zeile zum Fehler, nicht zur Karte ohne Bild", () => {
  // **Der eigentliche Regressionstest.** Eine Karte ohne Bild anzulegen wäre
  // technisch erlaubt — die Route nimmt Bilder freiwillig entgegen. Genau
  // deshalb muss der Plan hier hart sein: Sonst stehen stumme Karten im
  // Vorverkauf, und niemand merkt, dass ein Bild nie hochgeladen wurde.
  const plan = planBauen({
    zeilen: [zeile("Eine Karte", "fehlt.jpg")],
    bilder: [bild("saka_base.jpg")],
    vorhandeneTitel: [],
  });
  assert.equal(plan.posten[0].stand, "fehler");
  assert.match(plan.posten[0].grund, /fehlt\.jpg/u);
  assert.deepEqual(plan.unbenutzteBilder, ["saka_base.jpg"]);
});

test("zwei gleich benannte Bilder machen die Zeile zum Fehler, nicht zur Zufallswahl", () => {
  // **Der stille Vertauscher.** Werden Dateien aus zwei Ordnern zugleich
  // ausgewählt, können zwei denselben Namen tragen (oder sich nur in der
  // Schreibweise unterscheiden). Wer sie in eine Map nach Namen legt, behält
  // eine davon — und die Zeile bekäme das falsche Bild, ohne Fehlermeldung.
  const plan = planBauen({
    zeilen: [zeile("Eine Karte", "saka_base.jpg"), zeile("Andere Karte", "eze_base.jpg")],
    bilder: [bild("saka_base.jpg"), bild("SAKA_BASE.JPG"), bild("eze_base.jpg")],
    vorhandeneTitel: [],
  });
  assert.equal(plan.posten[0].stand, "fehler");
  assert.match(plan.posten[0].grund, /Mehrere ausgewählte Dateien/u);
  assert.equal(plan.posten[1].stand, "bereit", "die eindeutige Zeile bleibt davon unberührt");
});

test("was schon im Shop steht, wird übersprungen statt doppelt angelegt", () => {
  // Der Fall nach einem Abbruch: 90 von 144 sind angelegt, der zweite Anlauf
  // darf die 90 nicht ein zweites Mal einstellen.
  const plan = planBauen({
    zeilen: [zeile("Schon da", "a.jpg"), zeile("Noch nicht", "b.jpg")],
    bilder: [bild("a.jpg"), bild("b.jpg")],
    vorhandeneTitel: ["schon da"],
  });
  assert.equal(plan.posten[0].stand, "vorhanden");
  assert.equal(plan.posten[1].stand, "bereit");
});

test("ein Titel, der zweimal in der Tabelle steht, wird nur einmal angelegt", () => {
  const plan = planBauen({
    zeilen: [zeile("Gleicher Titel", "a.jpg"), zeile("Gleicher Titel", "b.jpg")],
    bilder: [bild("a.jpg"), bild("b.jpg")],
    vorhandeneTitel: [],
  });
  assert.equal(plan.posten[0].stand, "bereit");
  assert.equal(plan.posten[1].stand, "fehler");
  assert.match(plan.posten[1].grund, /schon weiter oben/u);
});

test("die Grenzen der Route werden vor dem Hochladen geprüft", () => {
  const plan = planBauen({
    zeilen: [
      zeile("x".repeat(MAX_TITEL + 1), "a.jpg"),
      zeile("Zu groß", "gross.jpg"),
      zeile("Falscher Typ", "datei.gif"),
      zeile("Krumme Menge", "c.jpg", { Menge: "zwei" }),
      zeile("Zu viele", "d.jpg", { Menge: "100" }),
      zeile("", "e.jpg"),
    ],
    bilder: [bild("a.jpg"), bild("gross.jpg", 11_000_000), bild("datei.gif", 900_000, "image/gif"),
             bild("c.jpg"), bild("d.jpg"), bild("e.jpg")],
    vorhandeneTitel: [],
  });
  assert.deepEqual(plan.posten.map((posten) => posten.stand), Array(6).fill("fehler"));
  assert.match(plan.posten[0].grund, /Zeichen lang/u);
  assert.match(plan.posten[1].grund, /11\.0 MB/u);
  assert.match(plan.posten[2].grund, /kein JPG/u);
  assert.match(plan.posten[3].grund, /ganze Zahl/u);
  assert.match(plan.posten[4].grund, /ganze Zahl/u);
  assert.match(plan.posten[5].grund, /Kein Titel/u);
});

test("eine leere Mengenspalte bedeutet ein Stück", () => {
  const plan = planBauen({
    zeilen: [zeile("Ohne Menge", "a.jpg", { Menge: "" })],
    bilder: [bild("a.jpg")],
    vorhandeneTitel: [],
  });
  assert.equal(plan.posten[0].stand, "bereit");
  assert.equal(plan.posten[0].menge, 1);
});

test("die Zusammenfassung zählt jeden Posten genau einmal", () => {
  const plan = planBauen({
    zeilen: [zeile("A", "a.jpg"), zeile("B", "fehlt.jpg"), zeile("C", "c.jpg")],
    bilder: [bild("a.jpg"), bild("c.jpg"), bild("uebrig.jpg")],
    vorhandeneTitel: ["C"],
  });
  assert.deepEqual(planZusammenfassen(plan), { bereit: 1, vorhanden: 1, fehler: 1, unbenutzt: 1 });
});
