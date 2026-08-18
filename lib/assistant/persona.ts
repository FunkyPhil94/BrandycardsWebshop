import type { AnyAssistantToolResult, AssistantToolName } from "./contracts.ts";

/** K.A.R.L.s Stimme — die Sätze **um** die Daten herum.
 *
 * **Was hier steht und was ausdrücklich nicht.** Dieses Modul formuliert
 * Begrüßung, Überleitung, Kommentar und Absage. Es formuliert **keine einzige
 * Zahl** und bekommt auch keine zu Gesicht, die es umschreiben könnte: Die
 * Datenzeilen entstehen weiterhin Wort für Wort in
 * [response-formatter.ts](./response-formatter.ts) und werden hier nur
 * eingerahmt.
 *
 * Der Betreiber hatte am 2026-08-18 die Wahl zwischen dieser Bauweise und einem
 * zweiten Modellaufruf, der die fertigen Fakten frei nacherzählt. Er hat sich
 * für diese entschieden, und die Begründung soll hier stehen bleiben: Ein
 * Sprachmodell, das „147,50 €" in einen schönen Satz gießt, kann daraus
 * „rund 150 €" machen — und dieser Assistent ist von der ersten Zeile an entlang
 * der Linie gebaut, dass eine fehlende Auskunft besser ist als eine erfundene.
 * Ein Rahmen kann nichts verfälschen, weil er nichts kennt.
 *
 * **Warum kein `Math.random()`.** Wechselnde Formulierungen sind der halbe Witz
 * an einer Persönlichkeit, echter Zufall macht aber jede Antwort untestbar und
 * lässt dieselbe Frage zweimal hintereinander grundlos anders klingen. Gewählt
 * wird deshalb über einen Streuwert aus Frage und Tag: über Fragen hinweg
 * abwechslungsreich, für dieselbe Frage am selben Tag stabil.
 */

/** FNV-1a, 32 Bit. Klein, stabil und ohne Abhängigkeit — gebraucht wird hier
 *  keine Kryptografie, sondern nur eine gleichmäßige Streuung. */
export function streuwert(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Wählt eine Variante — immer dieselbe für denselben Streutext. */
export function waehle<T>(varianten: readonly T[], streutext: string): T {
  return varianten[streuwert(streutext) % varianten.length]!;
}

/** Der Streutext einer Frage: die Frage selbst plus der Tag.
 *
 * Der Tag gehört dazu, damit dieselbe Frage nicht bis in alle Ewigkeit denselben
 * Spruch bekommt — wer jeden Morgen „Was wurde zuletzt verkauft?" fragt, hört
 * sonst tausendmal denselben Satz. Die Uhrzeit gehört **nicht** dazu: Zwei
 * Versuche derselben Frage kurz hintereinander sollen gleich klingen, sonst
 * wirkt der Assistent sprunghaft statt lebendig.
 */
export function streutext(frage: string, jetzt: Date): string {
  return `${frage.trim().toLowerCase()}|${jetzt.toISOString().slice(0, 10)}`;
}

// ---------------------------------------------------------------------------
// Smalltalk
// ---------------------------------------------------------------------------

/** Fachwörter, bei denen Smalltalk **niemals** greift.
 *
 * **Der teuerste denkbare Fehler dieser Schicht** wäre, eine echte Fachfrage mit
 * einem Spruch abzuspeisen. „Na, wie läuft der Verkauf?" fängt an wie Smalltalk
 * und ist keiner. Lieber rutscht ein „hallo" in den Planer (der antwortet dann
 * sachlich und niemandem fehlt etwas) als eine Umsatzfrage in die
 * Witzeschublade.
 *
 * **Am 2026-08-18 aus der Produktion widerlegt, in der Gegenrichtung.** Die
 * Messtabelle `assistant_unanswered` enthielt drei Zeilen, und zwei davon waren
 * genau der Fall, für den diese Schicht am Vortag gebaut worden war — sie
 * fielen trotzdem durch. „Erzähle mir einen Witz über Sammelkarten" scheiterte
 * an `karte` in „Sammelkarten", und **„Erzähl mir einen Witz" scheiterte an
 * `zahl` in „erzähl".** Ein Riegel, der die Fälle sperrt, für die er gebaut
 * wurde, ist keiner.
 *
 * Die Ursache war die Prüfung, nicht die Liste: Sie suchte Teilzeichenketten.
 * Dieselbe Falle steht im Regelplaner längst dokumentiert — dort traf „gebot"
 * einmal „an**gebot**e" gleich mit. Gesucht wird jetzt am **Wortanfang**
 * (siehe {@link enthaeltFachwort}); die Absicherung bleibt damit für
 * zusammengesetzte Wörter wie „Kartenpreis" bestehen und verschwindet dort, wo
 * das Fachwort nur zufällig im Inneren steht.
 *
 * **Zeitwörter stehen bewusst nicht mehr dabei** („heute", „gestern", „Woche",
 * „Monat"). Eine bloße Zeitangabe kann aus keiner Frage Smalltalk machen — dazu
 * muss zusätzlich eines der engen Muster unten greifen —, aber sie kostete
 * nachweislich einen echten Fall: „Karl, wie geht's dir heute?". Jede Fachfrage
 * in der Messung trägt ohnehin ein echtes Fachwort.
 */
const FACHWOERTER = [
  "verkauf", "verkauft", "umsatz", "bestell", "auftrag", "angebot", "vorschlag",
  "preis", "bestand", "lager", "karte", "karten", "ebay", "shop", "anfrage",
  "nachricht", "statistik", "zahl", "aufruf", "sync", "abgleich", "kunde",
  "eingestellt", "einstellung", "euro", "€",
] as const;

/** Trägt der Text ein Fachwort **am Anfang eines Wortes**?
 *
 * Ein Wortanfang statt einer beliebigen Stelle im Wort: `preis` trifft
 * „Preisvorschläge" (die Absicherung soll für Zusammensetzungen gelten), `zahl`
 * trifft nicht „erzähl", `karte` nicht „Sammelkarten".
 *
 * Das Eurozeichen kann keine Wortgrenze haben — `\b` steht zwischen Wort- und
 * Nicht-Wort-Zeichen, und `€` ist keins. Für solche Zeichen bleibt es bei der
 * einfachen Suche; sie kann dort auch nichts falsch treffen.
 */
export function enthaeltFachwort(text: string): boolean {
  return FACHWOERTER.some((wort) => {
    const gesucht = normalisiere(wort);
    if (!/^\p{Letter}/u.test(gesucht)) return text.includes(gesucht);
    return new RegExp(`\\b${gesucht}`, "u").test(text);
  });
}

/** Höchstlänge einer Nachricht, die noch als Smalltalk durchgeht.
 *
 * Wer eine echte Frage stellt, schreibt mehr als ein paar Wörter. Die Grenze ist
 * die zweite Sicherung neben den Fachwörtern. */
const SMALLTALK_MAX_WOERTER = 6;

type SmalltalkArt = "gruss" | "identitaet" | "faehigkeit" | "befinden" | "dank" | "abschied" | "witz";

const SMALLTALK_MUSTER: ReadonlyArray<{ art: SmalltalkArt; muster: RegExp }> = [
  { art: "gruss", muster: /^(hallo|hi|hey|moin|servus|hej|jo|na)\b|guten (morgen|tag|abend)|^hallo karl/u },
  { art: "identitaet", muster: /\b(wer|was) bist du\b|\bwie hei(ss|ß)t du\b|\bwof(ü|u)r steht (dein name|karl)\b|\bwas bedeutet karl\b|\bstell dich vor\b/u },
  { art: "faehigkeit", muster: /\bwas kannst du\b|\bwas gehst?\b|^hilfe\b|\bwobei hilfst du\b|\bwas machst du\b/u },
  { art: "befinden", muster: /\bwie geht('?s| es dir| es)\b|\balles (gut|klar)\b|\bwie l(ä|a)uft'?s bei dir\b/u },
  { art: "dank", muster: /^(danke|dankesch(ö|o)n|merci|thx|danke dir|vielen dank)\b/u },
  { art: "abschied", muster: /^(tsch(ü|u)ss|ciao|bye|bis (sp(ä|a)ter|morgen|dann)|gute nacht|feierabend)\b/u },
  { art: "witz", muster: /\b(witz|spruch)\b|\bsag was lustiges\b/u },
];

const SMALLTALK_TEXTE: Record<SmalltalkArt, readonly string[]> = {
  gruss: [
    "Moin. K.A.R.L. am Start, Karteikasten aufgeklappt. Was willst du wissen?",
    "Hallo. Ich stand hier rum und habe Zahlen sortiert — sehr gerne unterbrichst du mich dabei.",
    "Hey. Frag ruhig, ich beiße nicht. Ich kann ja nicht mal klicken.",
  ],
  identitaet: [
    "K.A.R.L.: Kartenshop-Auskunft für Recherche und Lagebericht. Klingt nach Behörde, ist aber nur ich. Ich lese deinen Shop und deine eBay-Daten und sage dir, was los ist — anfassen darf ich nichts, das ist Absicht.",
    "Ich bin K.A.R.L. — Kartenshop-Auskunft für Recherche und Lagebericht. Vier Buchstaben, ein Job: nachsehen und Bescheid geben. Verkaufen musst du schon selbst.",
  ],
  faehigkeit: [
    "Ich schaue nach: Verkäufe, Einstellungen, Bestellungen, Preisvorschläge, Lagerbestand, Shop-Anfragen, eBay-Nachrichten und -Aufrufe, dazu Statistiken. Frag einfach los, zum Beispiel „Was wurde zuletzt verkauft?“ oder „Umsatz der letzten 7 Tage“.",
    "Nachsehen kann ich viel, ändern nichts. Verkäufe, Bestellungen, Vorschläge, Bestand, Anfragen, eBay, Statistik — alles lesend. Ein Vorschlag: „Zeig offene Angebote“.",
  ],
  befinden: [
    "Bestens. Ich habe null Sorgen und rund um die Uhr Zugriff auf deine Zahlen — was will man mehr.",
    "Läuft. Ich sitze hier, zähle Karten und werde nie müde. Was steht bei dir an?",
  ],
  dank: [
    "Gern. Dafür stehe ich hier rum.",
    "Immer doch. Nächste Frage?",
    "Bitte sehr. War ja nur ein Blick in die Datenbank.",
  ],
  abschied: [
    "Bis dann. Ich bleibe wach, ich kann ja nicht anders.",
    "Mach's gut. Die Karten laufen dir nicht weg.",
  ],
  witz: [
    "Meine Sammlung besteht aus dreihundert Karten, und ich habe keine einzige davon je angefasst. Das nennt man wohl Zustand „mint“.",
    "Ich habe nur Leserechte. Bei mir heißt „ich lege noch eine Karte drauf“ leider wirklich nur gucken.",
  ],
};

function normalisiere(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Antwortet auf Smalltalk — oder gibt `null` zurück und hält sich raus.
 *
 * `null` ist der Regelfall und der sichere Fall: Dann läuft die Nachricht
 * unverändert in den Planer, so wie vor dieser Schicht.
 */
export function smalltalkAntwort(nachricht: string, jetzt: Date): string | null {
  const roh = nachricht.trim();
  if (!roh) return null;

  const woerter = roh.split(/\s+/u);
  if (woerter.length > SMALLTALK_MAX_WOERTER) return null;

  const text = normalisiere(roh);
  if (enthaeltFachwort(text)) return null;

  const treffer = SMALLTALK_MUSTER.find((eintrag) => eintrag.muster.test(text));
  if (!treffer) return null;

  const antwort = waehle(SMALLTALK_TEXTE[treffer.art], streutext(roh, jetzt));
  // Beim Gruß kommt die Tageszeit dazu — das ist der billigste Weg, „ich weiß,
  // wann du da bist" zu zeigen, und er kostet keine Datenabfrage.
  return treffer.art === "gruss" ? `${tageszeitgruss(jetzt)} ${antwort.replace(/^(Moin|Hallo|Hey)\.\s*/u, "")}` : antwort;
}

/** Die Tageszeit in Europa/Berlin, weil der Shop dort steht. */
export function tageszeitgruss(jetzt: Date): string {
  // **Über `formatToParts`, nicht über `format`.** Die deutsche Fassung hängt
  // „ Uhr" an: `format` liefert „06 Uhr", und `Number("06 Uhr")` ist `NaN` —
  // damit wären alle Vergleiche unten falsch und es gäbe rund um die Uhr
  // dieselbe Begrüßung. Beim ersten Testlauf am 2026-08-18 genau so passiert.
  const teile = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", hour12: false, timeZone: "Europe/Berlin" })
    .formatToParts(jetzt);
  const stunde = Number(teile.find((teil) => teil.type === "hour")?.value ?? "12");
  if (stunde < 5) return "Nachtschicht?";
  if (stunde < 11) return "Guten Morgen.";
  if (stunde < 14) return "Mahlzeit.";
  if (stunde < 18) return "Guten Tag.";
  if (stunde < 22) return "Guten Abend.";
  return "Noch wach?";
}

// ---------------------------------------------------------------------------
// Rahmen um eine Datenantwort
// ---------------------------------------------------------------------------

/** Überleitungen, nach Themengruppe. Die Gruppe entscheidet den Ton, nicht das
 *  einzelne Werkzeug — sonst wären es dreizehn Listen für dreizehn Werkzeuge. */
const EINLEITUNGEN: Record<"geld" | "andrang" | "lager" | "ebay" | "allgemein", readonly string[]> = {
  geld: [
    "Kasse nachgezählt, Daumen nicht auf der Waage:",
    "Ab in die Schatzkiste geschaut:",
    "So steht's ums Geld:",
  ],
  andrang: [
    "Da will jemand was von dir:",
    "Post für dich, sozusagen:",
    "Es klopft:",
  ],
  lager: [
    "Karteikasten durchgeblättert:",
    "Ein Blick ins Regal:",
    "Bestandsaufnahme:",
  ],
  ebay: [
    "Rüber zu eBay geschielt:",
    "Was die andere Bühne meldet:",
    "eBay sagt Folgendes:",
  ],
  allgemein: [
    "Hab nachgesehen:",
    "Frisch gezogen, wie aus einem Booster:",
    "Bitte sehr:",
  ],
};

const GRUPPEN: Record<AssistantToolName, keyof typeof EINLEITUNGEN> = {
  latest_sale: "geld",
  sales_overview: "geld",
  latest_listing: "lager",
  inventory_review: "lager",
  new_orders: "andrang",
  open_shop_offers: "andrang",
  new_shop_inquiries: "andrang",
  ebay_messages: "ebay",
  ebay_buyer_offers: "ebay",
  ebay_most_viewed: "ebay",
  ebay_sync_health: "ebay",
  traffic_overview: "allgemein",
  assistant_statistics: "allgemein",
};

/** Der Satz vor den Daten.
 *
 * Bei gemischten Werkzeugen bleibt es beim allgemeinen Ton — eine Antwort, die
 * Umsatz *und* Lagerbestand enthält, mit „Ab in die Schatzkiste" einzuleiten,
 * würde die Hälfte davon falsch ankündigen.
 */
export function einleitung(werkzeuge: readonly AssistantToolName[], streu: string): string {
  const gruppen = new Set(werkzeuge.map((werkzeug) => GRUPPEN[werkzeug]));
  const gruppe = gruppen.size === 1 ? [...gruppen][0]! : "allgemein";
  return waehle(EINLEITUNGEN[gruppe], `${streu}|ein`);
}

/** Was in den Ergebnissen steht — **nur qualitativ**.
 *
 * Hier wird ausschließlich „ist da etwas oder nicht" abgelesen. Keine Zahl
 * verlässt diese Funktion, und keine wird nacherzählt; sonst stünde dieselbe
 * Zahl zweimal in der Antwort und könnte sich widersprechen.
 */
type Lage = { wartet: boolean; leer: boolean; gestoert: boolean };

function leseLage(ergebnisse: readonly AnyAssistantToolResult[]): Lage {
  let wartet = false;
  let inhalt = false;
  let gestoert = false;

  for (const ergebnis of ergebnisse) {
    if (ergebnis.status !== "AVAILABLE") {
      gestoert = true;
      continue;
    }
    switch (ergebnis.tool) {
      case "new_orders":
        if (ergebnis.data.orders.length) { wartet = true; inhalt = true; }
        break;
      case "open_shop_offers":
        if (ergebnis.data.offers.length) { wartet = true; inhalt = true; }
        break;
      case "new_shop_inquiries":
        if (ergebnis.data.inquiries.length) { wartet = true; inhalt = true; }
        break;
      case "ebay_buyer_offers":
        if (ergebnis.data.offers.length) { wartet = true; inhalt = true; }
        break;
      case "ebay_messages":
        if (ergebnis.data.unreadCount > 0) { wartet = true; }
        if (ergebnis.data.messages.length) inhalt = true;
        break;
      case "inventory_review":
        if (ergebnis.data.items.length) { wartet = true; inhalt = true; }
        break;
      case "sales_overview":
        if (ergebnis.data.sales.length) inhalt = true;
        break;
      default:
        inhalt = true;
        break;
    }
  }
  return { wartet, leer: !inhalt && !gestoert, gestoert };
}

const KOMMENTARE = {
  wartet: [
    "Da liegt was für dich bereit — ich zeige nur drauf, drücken musst du selbst.",
    "Kurz drum kümmern, dann ist der Tisch wieder leer.",
    "Nicht liegen lassen. Ich würde ja, aber ich darf bekanntlich nur gucken.",
  ],
  leer: [
    "Sonst nichts. Ruhige Lage — ich würde ein Nickerchen machen, wenn ich könnte.",
    "Ansonsten Stille im Karton.",
    "Mehr gibt der Kasten gerade nicht her.",
  ],
  gestoert: [
    "Ein Teil davon konnte ich nicht nachsehen; was fehlt, steht oben dabei.",
    "Nicht alles war erreichbar — ich sage lieber „weiß ich nicht“ als etwas Erfundenes.",
  ],
} as const;

/** Der Satz nach den Daten, oder `null`, wenn es nichts zu sagen gibt. */
export function schlusskommentar(ergebnisse: readonly AnyAssistantToolResult[], streu: string): string | null {
  const lage = leseLage(ergebnisse);
  // Reihenfolge nach Dringlichkeit: Eine Störung zu verschweigen wäre der
  // schlimmste der drei Fälle, offene Vorgänge der zweitwichtigste.
  if (lage.gestoert) return waehle(KOMMENTARE.gestoert, `${streu}|kom`);
  if (lage.wartet) return waehle(KOMMENTARE.wartet, `${streu}|kom`);
  if (lage.leer) return waehle(KOMMENTARE.leer, `${streu}|kom`);
  return null;
}

/** Der Anlauf zu einer Absage.
 *
 * **Der Sachtext dahinter bleibt unangetastet.** Er nennt, was stattdessen geht,
 * und unterscheidet „nicht eingerichtet" von „gerade kaputt" von „gibt es
 * nicht" — diese Unterscheidung ist für den Betreiber gebaut worden und darf
 * kein Spruch verwässern.
 */
export function absageEinleitung(streu: string): string {
  return waehle([
    "Da muss ich passen.",
    "Puste. Diese Karte habe ich nicht im Deck.",
    "Ehrlich währt am längsten:",
  ], `${streu}|abs`);
}
