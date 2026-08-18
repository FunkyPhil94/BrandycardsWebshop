/** Liest eine `.xlsx` ohne Fremdbibliothek.
 *
 * **Warum von Hand:** Das Projekt trägt vier Laufzeit-Abhängigkeiten. Eine
 * Tabellendatei ist ein ZIP mit XML darin, und beides bringt die Laufzeit
 * bereits mit — `DecompressionStream` steht im Browser wie in Node bereit.
 * SheetJS wöge mehr als alles, was hier sonst im Bündel liegt.
 *
 * **Absichtlich eng:** Gelesen wird das *erste* Blatt, alle Werte kommen als
 * Zeichenkette zurück. Formeln, Datumsformate und Zahlenformatierung
 * interessieren nicht — die Importtabelle trägt Titel, Dateinamen und Mengen.
 * Wer hier mehr braucht, baut besser einen anderen Weg als diesen auszubauen.
 */

export type TabellenZeile = Record<string, string>;
export type Tabelle = { kopf: string[]; zeilen: TabellenZeile[] };

export class TabellenFehler extends Error {}

// ---------------------------------------------------------------- ZIP

type ZipEintrag = { name: string; methode: number; daten: Uint8Array };

function lese16(bytes: Uint8Array, pos: number) {
  return bytes[pos]! | (bytes[pos + 1]! << 8);
}

function lese32(bytes: Uint8Array, pos: number) {
  return (bytes[pos]! | (bytes[pos + 1]! << 8) | (bytes[pos + 2]! << 16)) + bytes[pos + 3]! * 0x1000000;
}

/** Sucht das „End of Central Directory“ von hinten.
 *
 * Von hinten, weil davor ein Kommentar variabler Länge stehen darf — die
 * Signatur ist der einzige verlässliche Anker. Der Kommentar ist auf 64 KB
 * begrenzt, weiter zurück muss also nicht gesucht werden. */
function zentralverzeichnis(bytes: Uint8Array): number {
  const frueheste = Math.max(0, bytes.length - 0x10000 - 22);
  for (let pos = bytes.length - 22; pos >= frueheste; pos -= 1) {
    if (lese32(bytes, pos) === 0x06054b50) return pos;
  }
  throw new TabellenFehler("Die Datei ist kein ZIP — und damit keine .xlsx.");
}

function zipEintraege(bytes: Uint8Array): Map<string, ZipEintrag> {
  const eocd = zentralverzeichnis(bytes);
  const anzahl = lese16(bytes, eocd + 10);
  let pos = lese32(bytes, eocd + 16);
  const eintraege = new Map<string, ZipEintrag>();

  for (let i = 0; i < anzahl; i += 1) {
    if (lese32(bytes, pos) !== 0x02014b50) throw new TabellenFehler("Das Inhaltsverzeichnis der Datei ist beschädigt.");
    const methode = lese16(bytes, pos + 10);
    const gepacktLaenge = lese32(bytes, pos + 20);
    const nameLaenge = lese16(bytes, pos + 28);
    const extraLaenge = lese16(bytes, pos + 30);
    const kommentarLaenge = lese16(bytes, pos + 32);
    const lokal = lese32(bytes, pos + 42);
    const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLaenge));

    // Die Feldlängen im lokalen Kopf dürfen von denen im Zentralverzeichnis
    // abweichen; gelesen werden muss deshalb der lokale Kopf.
    if (lese32(bytes, lokal) !== 0x04034b50) throw new TabellenFehler("Ein Eintrag der Datei ist beschädigt.");
    const start = lokal + 30 + lese16(bytes, lokal + 26) + lese16(bytes, lokal + 28);
    eintraege.set(name, { name, methode, daten: bytes.subarray(start, start + gepacktLaenge) });
    pos += 46 + nameLaenge + extraLaenge + kommentarLaenge;
  }
  return eintraege;
}

async function auspacken(eintrag: ZipEintrag): Promise<string> {
  if (eintrag.methode === 0) return new TextDecoder().decode(eintrag.daten);
  if (eintrag.methode !== 8) throw new TabellenFehler(`Unbekanntes Packverfahren (${eintrag.methode}).`);
  // `deflate-raw`, nicht `deflate`: ZIP speichert den nackten Datenstrom ohne
  // zlib-Kopf. Mit `deflate` bricht das Auspacken sofort ab.
  const strom = new Blob([eintrag.daten as BlobPart]).stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(strom).text();
}

// ---------------------------------------------------------------- XML

const ENTITAETEN: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function entschluesseln(text: string): string {
  return text.replace(/&(?:#(x?)([0-9a-fA-F]+)|([a-z]+));/gu, (ganz, hex: string, ziffern: string, name: string) => {
    if (name) return ENTITAETEN[name] ?? ganz;
    const code = Number.parseInt(ziffern, hex ? 16 : 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : ganz;
  });
}

/** Alle `<t>`-Inhalte eines Abschnitts, aneinandergehängt.
 *
 * Aneinandergehängt, weil eine Zelle mit gemischter Auszeichnung — halb fett,
 * halb nicht — als mehrere `<r><t>`-Läufe abgelegt wird. Wer nur den ersten
 * nimmt, verliert beim Import die zweite Hälfte des Titels. */
function textInhalt(xml: string): string {
  let ergebnis = "";
  for (const treffer of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t\s*\/>/gu)) {
    ergebnis += entschluesseln(treffer[1] ?? "");
  }
  return ergebnis;
}

function spaltenNummer(bezug: string): number {
  const buchstaben = /^([A-Z]+)/u.exec(bezug)?.[1];
  if (!buchstaben) return -1;
  let nummer = 0;
  for (const zeichen of buchstaben) nummer = nummer * 26 + (zeichen.charCodeAt(0) - 64);
  return nummer - 1;
}

// ---------------------------------------------------------------- Blatt

/** Der Pfad des ersten Blattes.
 *
 * Nicht fest auf `xl/worksheets/sheet1.xml` verdrahtet: Wer in Excel Blätter
 * löscht und neu anlegt, bekommt `sheet2.xml` als erstes Blatt — die Datei ist
 * gültig, der feste Pfad läuft ins Leere. */
function ersterBlattpfad(arbeitsmappe: string, beziehungen: string): string {
  const id = /<sheet\b[^>]*r:id="([^"]+)"/u.exec(arbeitsmappe)?.[1];
  if (id) {
    // Die Reihenfolge von `Id` und `Target` im Element ist nicht festgelegt,
    // deshalb beide Anordnungen.
    const roh = id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const ziel = new RegExp(`<Relationship\\b[^>]*Id="${roh}"[^>]*Target="([^"]+)"`, "u").exec(beziehungen)?.[1]
      ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${roh}"`, "u").exec(beziehungen)?.[1];
    if (ziel) return ziel.startsWith("/") ? ziel.slice(1) : `xl/${ziel.replace(/^\.\//u, "")}`;
  }
  return "xl/worksheets/sheet1.xml";
}

function zelltexte(xml: string, gemeinsam: string[]): string[][] {
  const zeilen: string[][] = [];
  for (const zeile of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gu)) {
    const werte: string[] = [];
    for (const zelle of zeile[1]!.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/gu)) {
      const attribute = zelle[1] ?? "";
      const inhalt = zelle[2] ?? "";
      const typ = /\bt="([^"]+)"/u.exec(attribute)?.[1] ?? "n";
      const bezug = /\br="([A-Z]+\d+)"/u.exec(attribute)?.[1];
      let wert: string;
      if (typ === "s") {
        const index = Number.parseInt(textInhalt(`<t>${/<v>([\s\S]*?)<\/v>/u.exec(inhalt)?.[1] ?? ""}</t>`), 10);
        wert = gemeinsam[index] ?? "";
      } else if (typ === "inlineStr") {
        wert = textInhalt(inhalt);
      } else {
        // Zahlen (`n`), Formelergebnisse (`str`) und Wahrheitswerte stehen alle
        // als roher Wert in `<v>`. Für diesen Import genügt der Text.
        wert = entschluesseln(/<v>([\s\S]*?)<\/v>/u.exec(inhalt)?.[1] ?? "");
      }
      // Leere Zellen werden in der Datei ausgelassen. Ohne den Bezug rutschen
      // ab der ersten Lücke alle folgenden Spalten um eins nach links.
      const spalte = bezug ? spaltenNummer(bezug) : werte.length;
      while (werte.length < spalte) werte.push("");
      werte[spalte] = wert.trim();
    }
    zeilen.push(werte);
  }
  return zeilen;
}

/** Liest das erste Blatt einer `.xlsx` als Zeilen mit Spaltenüberschriften. */
export async function tabelleLesen(quelle: ArrayBuffer | Uint8Array): Promise<Tabelle> {
  const bytes = quelle instanceof Uint8Array ? quelle : new Uint8Array(quelle);
  if (bytes.length < 22) throw new TabellenFehler("Die Datei ist leer.");
  const eintraege = zipEintraege(bytes);

  const hole = async (pfad: string, pflicht: boolean) => {
    const eintrag = eintraege.get(pfad);
    if (!eintrag) {
      if (pflicht) throw new TabellenFehler(`In der Datei fehlt „${pfad}“ — ist das wirklich eine Excel-Tabelle?`);
      return "";
    }
    return auspacken(eintrag);
  };

  const arbeitsmappe = await hole("xl/workbook.xml", true);
  const beziehungen = await hole("xl/_rels/workbook.xml.rels", false);
  const blatt = await hole(ersterBlattpfad(arbeitsmappe, beziehungen), true);
  const gemeinsameXml = await hole("xl/sharedStrings.xml", false);
  const gemeinsam = [...gemeinsameXml.matchAll(/<si>([\s\S]*?)<\/si>/gu)].map((treffer) => textInhalt(treffer[1]!));

  const roh = zelltexte(blatt, gemeinsam);
  const kopfzeile = roh.find((zeile) => zeile.some((wert) => wert !== ""));
  if (!kopfzeile) throw new TabellenFehler("Die Tabelle ist leer.");
  const kopf = kopfzeile.map((wert) => wert.trim());

  const zeilen: TabellenZeile[] = [];
  for (const zeile of roh.slice(roh.indexOf(kopfzeile) + 1)) {
    if (!zeile.some((wert) => wert !== "")) continue;
    const eintrag: TabellenZeile = {};
    kopf.forEach((name, index) => { if (name) eintrag[name] = zeile[index] ?? ""; });
    zeilen.push(eintrag);
  }
  return { kopf, zeilen };
}
