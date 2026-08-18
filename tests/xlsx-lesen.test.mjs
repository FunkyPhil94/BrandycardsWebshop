import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync, crc32 } from "node:zlib";

const { tabelleLesen, TabellenFehler } = await import("../lib/xlsx-lesen.ts");

// Der Leser in lib/xlsx-lesen.ts kommt ohne Fremdbibliothek aus. Damit trägt
// dieses Projekt das ZIP- und XML-Format selbst — und muss es selbst prüfen.
// Die Tabellen hier werden deshalb byteweise gebaut, nicht von einem Werkzeug
// erzeugt, das dieselben Annahmen wie der Leser machen könnte.

/** Baut ein ZIP von Hand. `packen: false` legt die Einträge ungepackt ab —
 *  beide Verfahren kommen in echten Dateien vor. */
function zip(dateien, packen = true) {
  const kodierer = new TextEncoder();
  const lokale = [];
  const zentrale = [];
  let versatz = 0;

  for (const [name, text] of Object.entries(dateien)) {
    const roh = kodierer.encode(text);
    const daten = packen ? deflateRawSync(roh) : roh;
    const methode = packen ? 8 : 0;
    const pruef = crc32(roh);
    const nameBytes = kodierer.encode(name);

    const kopf = Buffer.alloc(30);
    kopf.writeUInt32LE(0x04034b50, 0);
    kopf.writeUInt16LE(20, 4);
    kopf.writeUInt16LE(methode, 8);
    kopf.writeUInt32LE(pruef, 14);
    kopf.writeUInt32LE(daten.length, 18);
    kopf.writeUInt32LE(roh.length, 22);
    kopf.writeUInt16LE(nameBytes.length, 26);
    lokale.push(kopf, nameBytes, daten);

    const eintrag = Buffer.alloc(46);
    eintrag.writeUInt32LE(0x02014b50, 0);
    eintrag.writeUInt16LE(20, 6);
    eintrag.writeUInt16LE(methode, 10);
    eintrag.writeUInt32LE(pruef, 16);
    eintrag.writeUInt32LE(daten.length, 20);
    eintrag.writeUInt32LE(roh.length, 24);
    eintrag.writeUInt16LE(nameBytes.length, 28);
    eintrag.writeUInt32LE(versatz, 42);
    zentrale.push(eintrag, nameBytes);

    versatz += kopf.length + nameBytes.length + daten.length;
  }

  const verzeichnis = Buffer.concat(zentrale);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(Object.keys(dateien).length, 8);
  ende.writeUInt16LE(Object.keys(dateien).length, 10);
  ende.writeUInt32LE(verzeichnis.length, 12);
  ende.writeUInt32LE(versatz, 16);
  return new Uint8Array(Buffer.concat([...lokale, verzeichnis, ende]));
}

const MAPPE = '<workbook xmlns:r="http://x"><sheets><sheet name="Karten" sheetId="1" r:id="rId1"/></sheets></workbook>';
const RELS = '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';

function blatt(zeilen) {
  return `<worksheet><sheetData>${zeilen}</sheetData></worksheet>`;
}

function inline(bezug, text) {
  return `<c r="${bezug}" t="inlineStr"><is><t>${text}</t></is></c>`;
}

test("liest Kopfzeile und Werte aus einer gepackten Tabelle", async () => {
  const datei = zip({
    "xl/workbook.xml": MAPPE,
    "xl/_rels/workbook.xml.rels": RELS,
    "xl/worksheets/sheet1.xml": blatt(
      `<row r="1">${inline("A1", "Bilddatei")}${inline("B1", "Titel")}${inline("C1", "Menge")}</row>` +
      `<row r="2">${inline("A2", "saka_base.jpg")}${inline("B2", "Topps Flagship Bukayo Saka Base")}<c r="C2"><v>1</v></c></row>`,
    ),
  });
  const { kopf, zeilen } = await tabelleLesen(datei);
  assert.deepEqual(kopf, ["Bilddatei", "Titel", "Menge"]);
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].Bilddatei, "saka_base.jpg");
  assert.equal(zeilen[0].Titel, "Topps Flagship Bukayo Saka Base");
  // Zahlen kommen als Text zurück. Der Import setzt das selbst um; hier zählt
  // nur, dass die Zelle nicht verloren geht.
  assert.equal(zeilen[0].Menge, "1");
});

test("ungepackte Einträge werden genauso gelesen", async () => {
  const datei = zip({
    "xl/workbook.xml": MAPPE,
    "xl/_rels/workbook.xml.rels": RELS,
    "xl/worksheets/sheet1.xml": blatt(
      `<row r="1">${inline("A1", "Titel")}</row><row r="2">${inline("A2", "Eine Karte")}</row>`,
    ),
  }, false);
  const { zeilen } = await tabelleLesen(datei);
  assert.equal(zeilen[0].Titel, "Eine Karte");
});

test("eine ausgelassene Zelle verschiebt die folgenden Spalten nicht", async () => {
  // **Der eigentliche Regressionstest.** Excel schreibt leere Zellen gar nicht
  // erst. Wer die Zellen der Reihe nach zählt statt den Bezug zu lesen, ordnet
  // ab der ersten Lücke jeden Titel der falschen Bilddatei zu — und der Import
  // legt 144 Karten mit vertauschten Bildern an, ohne einen Fehler zu melden.
  const datei = zip({
    "xl/workbook.xml": MAPPE,
    "xl/_rels/workbook.xml.rels": RELS,
    "xl/worksheets/sheet1.xml": blatt(
      `<row r="1">${inline("A1", "Bilddatei")}${inline("B1", "Parallele")}${inline("C1", "Titel")}</row>` +
      `<row r="2">${inline("A2", "eze_base.jpg")}${inline("C2", "Eberechi Eze Base")}</row>`,
    ),
  });
  const { zeilen } = await tabelleLesen(datei);
  assert.equal(zeilen[0].Bilddatei, "eze_base.jpg");
  assert.equal(zeilen[0].Parallele, "");
  assert.equal(zeilen[0].Titel, "Eberechi Eze Base");
});

test("gemeinsame Zeichenketten und Entitäten werden aufgelöst", async () => {
  const datei = zip({
    "xl/workbook.xml": MAPPE,
    "xl/_rels/workbook.xml.rels": RELS,
    "xl/sharedStrings.xml": "<sst><si><t>Titel</t></si>"
      + "<si><r><t>Blue &amp; Pink</t></r><r><t> 01/99</t></r></si></sst>",
    "xl/worksheets/sheet1.xml": blatt(
      '<row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row>',
    ),
  });
  const { zeilen } = await tabelleLesen(datei);
  // Zwei `<r>`-Läufe, eine Zelle: Excel teilt so auf, sobald ein Teil des
  // Textes anders ausgezeichnet ist.
  assert.equal(zeilen[0].Titel, "Blue & Pink 01/99");
});

test("das erste Blatt wird über die Beziehung gefunden, nicht über den Dateinamen", async () => {
  const datei = zip({
    "xl/workbook.xml": MAPPE,
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Target="worksheets/sheet4.xml" Id="rId1"/></Relationships>',
    "xl/worksheets/sheet1.xml": blatt(`<row r="1">${inline("A1", "Falsch")}</row>`),
    "xl/worksheets/sheet4.xml": blatt(`<row r="1">${inline("A1", "Titel")}</row><row r="2">${inline("A2", "Richtig")}</row>`),
  });
  const { zeilen } = await tabelleLesen(datei);
  assert.equal(zeilen[0].Titel, "Richtig");
});

test("leere Zeilen fallen weg", async () => {
  const datei = zip({
    "xl/workbook.xml": MAPPE,
    "xl/_rels/workbook.xml.rels": RELS,
    "xl/worksheets/sheet1.xml": blatt(
      `<row r="1">${inline("A1", "Titel")}</row><row r="2">${inline("A2", "")}</row><row r="3">${inline("A3", "Karte")}</row>`,
    ),
  });
  const { zeilen } = await tabelleLesen(datei);
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].Titel, "Karte");
});

test("etwas anderes als eine Tabelle wird als solches gemeldet", async () => {
  await assert.rejects(
    () => tabelleLesen(new TextEncoder().encode("Das ist eine CSV-Datei, keine Tabelle.")),
    (fehler) => fehler instanceof TabellenFehler,
  );
  await assert.rejects(
    () => tabelleLesen(zip({ "irgendwas.txt": "nichts" })),
    (fehler) => fehler instanceof TabellenFehler && /workbook\.xml/u.test(fehler.message),
  );
});
