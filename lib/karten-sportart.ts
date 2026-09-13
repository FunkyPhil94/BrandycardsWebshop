/** Die Sportart einer Karte aus ihrem Titel ableiten.
 *
 * **Warum aus dem Titel.** eBay führt zwar ein Kategoriefeld, aber
 * `ebay_listings.category_id` ist am 2026-09-13 bei **allen 641** Listings
 * `NULL` — es kommt aus der Schnittstelle nicht mit. Die Sportart steht damit
 * nur im Titel, so wie Auflage, Autogramm, Bewertung und Relikt auch. Deshalb
 * dieselbe Bauart wie in `karten-merkmale.ts`: abgeleitet **beim Import**, in
 * eine eigene Spalte geschrieben, gefiltert als Spaltenabfrage. Die Regel steht
 * hier, wo ein Test sie erreicht — nicht als Muster in SQL, wo weder das eine
 * noch das andere gilt.
 *
 * Die Wortlisten sind am 2026-09-13 an allen 907 Titeln des Bestands gemessen,
 * nicht geraten. Was dabei herauskam: 109 American Football, 89 Non-Sport
 * (Marvel, Fantastic Four, Disney), 50 WWE, 659 Fußball. Kein Fehltreffer in
 * den drei benannten Sorten, ein Ausfall im Fußball — siehe `RUECKFALL`.
 */

/** Die Sportarten, die der Bestand kennt.
 *
 * `NON_SPORT` ist keine Verlegenheitslösung, sondern der im Sammelkartenhandel
 * übliche Name für Karten ohne Sport — Marvel, Star Wars und dergleichen. Sie
 * bekommen einen eigenen Eintrag statt gar keinen, weil sie sonst unter keiner
 * Auswahl auffindbar wären.
 */
export const SPORTARTEN = [
  { wert: "FUSSBALL", name: "Fußball" },
  { wert: "AMERICAN_FOOTBALL", name: "American Football" },
  { wert: "BASKETBALL", name: "Basketball" },
  { wert: "BASEBALL", name: "Baseball" },
  { wert: "EISHOCKEY", name: "Eishockey" },
  { wert: "WRESTLING", name: "Wrestling" },
  { wert: "NON_SPORT", name: "Non-Sport" },
] as const;

export type Sportart = (typeof SPORTARTEN)[number]["wert"];

/** Fußball ist die Rückfalllinie — **und das ist eine Annahme, keine Messung.**
 *
 * Der Laden handelt mit Fußballkarten; alles andere ist die Ausnahme, die sich
 * benennen lässt. Umgekehrt ginge es nicht: Fußball positiv zu erkennen hieße,
 * jeden Verein, jede Nationalmannschaft und jede Setreihe der Welt aufzulisten,
 * und jede Lücke darin wäre eine Karte, die unter **keiner** Sportart auftaucht.
 * Ein stiller Fehltreffer ist hier das kleinere Übel als ein stiller Ausfall.
 *
 * Der Preis: Eine Karte einer Sportart, die unten nicht steht, gilt als
 * Fußball. Am 2026-09-13 trifft das genau eine der 907 zu
 * (`2024 Leaf Electrum Football Carson Beck Prospects Autograph 1/2` — College
 * Football ohne Ligabezug im Titel). Dafür gibt es die Handkorrektur: `sport`
 * steht in `HANDFELDER`, eine Änderung im Adminbereich überlebt den Sync.
 */
export const RUECKFALL: Sportart = "FUSSBALL";

/** Die 32 NFL-Mannschaften, **mit Stadt**.
 *
 * Ohne Stadt wäre die Liste unbrauchbar: `Rams` steckt in `Ramsey`, `Jets` und
 * `Giants` und `Panthers` und `Cardinals` gibt es in anderen Ligen ebenfalls.
 * Mit Stadt sind alle 32 eindeutig — und der Bestand schreibt sie durchweg so
 * („Topps Chrome Football 2025 Miami Dolphins …").
 *
 * **Das Wort `Football` selbst ist kein Signal.** Es steht in NFL-Titeln
 * genauso wie in Fußballtiteln: `Futera INCREDIBLE Football Senegal`,
 * `Topps Total Football 25/26 Real Madrid`, `Prized Footballers`. Wer danach
 * filtert, verschiebt 60 Fußballkarten in die falsche Sportart.
 */
const NFL_TEAMS = [
  "Arizona Cardinals", "Atlanta Falcons", "Baltimore Ravens", "Buffalo Bills",
  "Carolina Panthers", "Chicago Bears", "Cincinnati Bengals", "Cleveland Browns",
  "Dallas Cowboys", "Denver Broncos", "Detroit Lions", "Green Bay Packers",
  "Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars", "Kansas City Chiefs",
  "Las Vegas Raiders", "Los Angeles Chargers", "Los Angeles Rams", "Miami Dolphins",
  "Minnesota Vikings", "New England Patriots", "New Orleans Saints", "New York Giants",
  "New York Jets", "Philadelphia Eagles", "Pittsburgh Steelers", "San Francisco 49ers",
  "Seattle Seahawks", "Tampa Bay Buccaneers", "Tennessee Titans", "Washington Commanders",
] as const;

/** Ein Wortalternativ aus Begriffen, mit Wortgrenzen an beiden Enden.
 *
 * Die Wortgrenze ist hier nicht Kosmetik: `NBA` steckt in `BeckeNBAuer`, und
 * ohne `\b` hätte der Bestand vier Basketballkarten, die alle Franz
 * Beckenbauer zeigen. Genau so gemessen, am 2026-09-13.
 */
function woerter(begriffe: readonly string[]): RegExp {
  const teile = begriffe.map((wort) => wort.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`));
  return new RegExp(String.raw`\b(?:${teile.join("|")})\b`, "iu");
}

/** Marvel & Co. **Zuerst geprüft**, vor allen Sportarten: „Black Panther" darf
 *  nicht an „Carolina Panthers" hängen bleiben, und ein Marvel-Set, das eines
 *  Tages „Football" im Namen trägt, soll nicht als Sport durchgehen. */
const NON_SPORT = woerter([
  "marvel", "fantastic four", "star wars", "pokemon", "pokémon",
  "disney", "garbage pail", "dc comics", "looney tunes",
]);

/** WWE deckt alle 50 Wrestlingkarten des Bestands ab. `NXT` steht bewusst
 *  **nicht** dabei — drei Buchstaben, die als Kürzel überall auftauchen können;
 *  jede NXT-Karte im Bestand trägt ohnehin „WWE" im Titel. */
const WRESTLING = woerter(["wwe", "wwf", "aew", "wrestling"]);

/** Neben den Teamnamen die eindeutigen Wörter. `gridiron` steht im Bestand
 *  („All-Time Gridiron Kings") und meint nie etwas anderes. */
const AMERICAN_FOOTBALL = woerter([...NFL_TEAMS, "nfl", "gridiron", "super bowl"]);

/** Diese drei stehen ohne Teamlisten da: Ihre Setnamen tragen die Sportart
 *  fast immer aus („Panini Prizm Basketball"), und eine Liste von neunzig
 *  Mannschaftsnamen, gegen die sich hier nichts prüfen ließe, wäre geraten
 *  statt gemessen. Kommt die erste Karte, die sie braucht, kostet sie eine
 *  Zeile — und bis dahin fällt sie auf Fußball zurück und ist im Adminbereich
 *  in einem Griff zu berichtigen. */
const BASKETBALL = woerter(["basketball", "nba", "wnba"]);
const BASEBALL = woerter(["baseball", "mlb"]);
const EISHOCKEY = woerter(["eishockey", "hockey", "nhl"]);

/** Der Reihe nach — die erste Regel, die greift, gewinnt. */
const REGELN: readonly (readonly [RegExp, Sportart])[] = [
  [NON_SPORT, "NON_SPORT"],
  [WRESTLING, "WRESTLING"],
  [AMERICAN_FOOTBALL, "AMERICAN_FOOTBALL"],
  [BASKETBALL, "BASKETBALL"],
  [BASEBALL, "BASEBALL"],
  [EISHOCKEY, "EISHOCKEY"],
];

export function sportartAusTitel(titel: string): Sportart {
  for (const [muster, sportart] of REGELN) if (muster.test(titel)) return sportart;
  return RUECKFALL;
}

export function istSportart(wert: unknown): wert is Sportart {
  return typeof wert === "string" && SPORTARTEN.some((eintrag) => eintrag.wert === wert);
}

/** Der Anzeigename — oder der rohe Wert, falls die Datenbank etwas trägt, das
 *  diese Liste nicht kennt. Lieber ein sperriges `FUSSBALL` in der Auswahl als
 *  ein leerer Eintrag, den niemand zuordnen kann. */
export function sportartName(wert: string): string {
  return SPORTARTEN.find((eintrag) => eintrag.wert === wert)?.name ?? wert;
}
