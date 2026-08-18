import {
  ASSISTANT_TOOL_DEFINITIONS,
  ASSISTANT_TOOL_NAMES,
  parseAssistantToolInput,
  type AssistantToolInput,
  type AssistantToolName,
} from "./contracts.ts";

const MAX_PLANNED_TOOLS = 6;
const DEFAULT_LIMIT = 10;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
const MODEL_TIMEOUT_MS = 15_000;

/** Warum ein Plan so aussieht, wie er aussieht.
 *
 * `MODEL_NOT_CONFIGURED` und `MODEL_FAILED` sehen für den Nutzer ähnlich aus,
 * sind für den Betreiber aber gegensätzlich: Im ersten Fall ist nichts
 * eingerichtet, im zweiten ist etwas eingerichtet und **kaputt**. Ein
 * gemeinsamer Zustand für beide würde die Fehlersuche in genau dem Moment
 * verschleiern, in dem sie gebraucht wird.
 */
export type AssistantPlanReason = "READY" | "UNSUPPORTED" | "MODEL_NOT_CONFIGURED" | "MODEL_FAILED";

export type AssistantPlan = {
  tools: AssistantToolInput[];
  reason: AssistantPlanReason;
};

export interface AssistantPlanner {
  plan(message: string): Promise<AssistantPlan>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type OpenAIResponseItem = {
  type?: unknown;
  name?: unknown;
  arguments?: unknown;
};

function normalizeQuestion(message: string): string {
  return message
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9€]+/g, " ")
    .trim();
}

/** Die deutsche Ersatzschreibung `ae`/`oe`/`ue` auf den Grundbuchstaben falten.
 *
 * `normalizeQuestion` zerlegt nach NFD und entfernt Diakritika, macht also aus
 * `ä` ein `a`. „Verkäufe" wird so zu „verkaufe" und trifft „verkauf". Wer ohne
 * deutsche Tastatur tippt, schreibt aber „Verkaeufe" — und das sind zwei
 * Buchstaben, keine Diakritik. Produktiv am 2026-08-16 gemessen: Die Frage mit
 * Umlaut wurde beantwortet, dieselbe Frage ohne Umlaut endete in `UNSUPPORTED`.
 *
 * **Das Ergebnis ersetzt die ursprüngliche Fassung nicht, es tritt daneben.**
 * Eine Ersetzung wäre falsch: „neue" enthält „ue" und würde zu „neu" — „neue
 * anfrage" träfe dann nicht mehr. Wird gegen beide Fassungen gesucht, kann
 * diese Faltung nur Treffer hinzufügen und keinen wegnehmen.
 */
export function foldUmlautDigraphs(text: string): string {
  return text.replaceAll("ae", "a").replaceAll("oe", "o").replaceAll("ue", "u");
}

function containsAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function requestedLimit(text: string): number {
  const match = text.match(/\b(\d{1,3})\b/u);
  if (!match) return DEFAULT_LIMIT;
  return Math.min(20, Math.max(1, Number(match[1])));
}

/** Der Zeitraum aus der Frage, in Tagen.
 *
 * **Nicht dieselbe Zahl wie `limit`.** „Verkäufe der letzten 30 Tage" nennt
 * einen Zeitraum, keine Ergebnisanzahl — `requestedLimit` würde daraus 20
 * machen (die Obergrenze) und die Übersicht auf drei Wochen verkürzen. Wochen
 * und Monate werden umgerechnet, weil danach genauso gefragt wird.
 */
export function requestedDays(text: string): number | undefined {
  const tage = text.match(/\b(\d{1,3})\s*(tage|tagen|tag)\b/u);
  if (tage) return Number(tage[1]);
  const wochen = text.match(/\b(\d{1,2})\s*(wochen|woche)\b/u);
  if (wochen) return Number(wochen[1]) * 7;
  const monate = text.match(/\b(\d{1,2})\s*(monate|monaten|monat)\b/u);
  if (monate) return Number(monate[1]) * 30;
  if (/\b(diese|letzte)\s*woche\b/u.test(text)) return 7;
  if (/\b(diesen|letzten)\s*monat\b/u.test(text)) return 30;
  return undefined;
}

/** Das Fenster in **Stunden**, wenn die Frage eines nennt.
 *
 * **Warum das nicht in `requestedDays` passt:** Dort werden Wochen und Monate in
 * Tage umgerechnet, weil ein Tag die kleinste Einheit ist, die `days` ausdrücken
 * kann. Stunden gehen darin nicht auf — „die letzten drei Stunden" wären ein
 * Achtel eines Tages. Der Betreiber hat am 2026-08-18 gemeldet, dass er genau
 * das nicht fragen kann.
 *
 * „heute" ist absichtlich **nicht** dabei: Das wäre der Tag ab Mitternacht, kein
 * rollendes Stundenfenster, und um 23 Uhr etwas ganz anderes als um 1 Uhr. Wer
 * „heute" fragt, bekommt die Vorgabe von 24 Stunden — nah genug und ehrlich.
 */
export function requestedStunden(text: string): number | undefined {
  const stunden = text.match(/\b(\d{1,3})\s*(stunden|stunde|std|h)\b/u);
  if (stunden) return Number(stunden[1]);
  if (/\b(?:der|die|einer)\s*letzten?\s*stunde\b/u.test(text)) return 1;
  if (/\bletzte\s*stunde\b/u.test(text)) return 1;
  return undefined;
}

const MONATE: Record<string, number> = {
  januar: 1, jan: 1, februar: 2, feb: 2, maerz: 3, marz: 3, mrz: 3, april: 4, apr: 4,
  mai: 5, juni: 6, jun: 6, juli: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, november: 11, nov: 11, dezember: 12, dez: 12,
};

/** Ein Datum in der Frage: `10.8.`, `10.08.2026` oder `10. August`. */
const DATUM = new RegExp(
  String.raw`\b(\d{1,2})\s*\.\s*(?:(\d{1,2})\s*\.?|(${Object.keys(MONATE).join("|")}))(?:\s*(\d{2,4}))?`,
  "giu",
);

/** Wählt das Jahr für ein Datum ohne Jahresangabe.
 *
 * Wer im August nach dem „10.8." fragt, meint dieses Jahr; wer im Januar nach
 * dem „20.12." fragt, meint das vergangene. Ein Datum in der Zukunft ist bei
 * einer Frage nach vergangenen Verkäufen immer die falsche Lesart — dort steht
 * nichts.
 */
function jahrFuer(tag: number, monat: number, jetzt: Date): number {
  const jahr = jetzt.getUTCFullYear();
  const kandidat = Date.UTC(jahr, monat - 1, tag);
  return kandidat > jetzt.getTime() ? jahr - 1 : jahr;
}

function alsTagesdatum(tag: number, monat: number, jahr: number): string | null {
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  const datum = new Date(Date.UTC(jahr, monat - 1, tag));
  // Der 31. Februar rollt sonst stillschweigend in den März weiter.
  if (datum.getUTCDate() !== tag || datum.getUTCMonth() !== monat - 1) return null;
  return datum.toISOString().slice(0, 10);
}

/** Alle Datumsangaben der Frage, in der Reihenfolge ihres Auftretens. */
export function findeDaten(message: string, jetzt: Date): string[] {
  // Diakritika fallen, Punkte und Wörter bleiben stehen — anders als bei
  // `normalizeQuestion`, die aus „10.8" ein „10 8" macht und die Datumsform
  // damit zerstört. **Genau daran scheiterte die Erkennung vor dem
  // 2026-08-17.**
  const text = message.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const treffer: string[] = [];
  for (const m of text.matchAll(DATUM)) {
    const tag = Number(m[1]);
    const monat = m[2] !== undefined ? Number(m[2]) : MONATE[m[3]!];
    const rohesJahr = m[4] === undefined ? undefined : Number(m[4]);
    const jahr = rohesJahr === undefined ? jahrFuer(tag, monat, jetzt)
      : rohesJahr < 100 ? 2000 + rohesJahr
      : rohesJahr;
    const datum = alsTagesdatum(tag, monat, jahr);
    if (datum) treffer.push(datum);
  }
  return treffer;
}

/** Der genannte Zeitraum als Fensterlänge und Fensterende.
 *
 * **Warum zwei Werte und nicht nur `days`.** `days` allein ist ein rollendes
 * Fenster bis heute; eine abgeschlossene Spanne wie der 10.–12.8. lässt sich
 * damit nicht ausdrücken. Länge und Ende getrennt zu führen lässt alles
 * Nachgelagerte unverändert und verschiebt nur, wo das Fenster liegt.
 *
 * Ein Ende in der Zukunft wird auf heute gezogen und die Länge entsprechend
 * gekürzt — „vom 10.8. bis 31.12." meint alles, was es bis jetzt gibt, nicht
 * vier leere Monate obendrauf.
 */
export function requestedRange(message: string, jetzt: Date): { days: number; bis: string } | undefined {
  const daten = findeDaten(message, jetzt);
  if (daten.length === 0) return undefined;

  const heute = jetzt.toISOString().slice(0, 10);
  const sortiert = [...daten].sort();
  // Zwei oder mehr Daten: die äußeren beiden spannen den Zeitraum auf. Ein
  // einzelnes Datum ist ein einzelner Tag — „was habe ich am 12.8. verkauft"
  // ist keine offene Spanne bis heute.
  const von = sortiert[0];
  const bis = (sortiert[sortiert.length - 1] > heute ? heute : sortiert[sortiert.length - 1]);
  if (bis < von) return undefined;

  const tage = Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000) + 1;
  return { days: tage, bis };
}

/** „Karte von X" — die eindeutige Form, die für sich steht. */
const KARTENSUCHE_STARK = /\bkarten?\s+von\s+(.{2,60}?)\s*[?.!]*$/iu;

/** Formen, die **nur mit** einem Kartenwort in der Frage zählen.
 *
 * „Hast du Lewandowski?" ist ohne weiteren Zusammenhang nicht von „Hast du
 * Feierabend?" zu unterscheiden. Diese Muster verlangen deshalb, dass irgendwo
 * „Karte" oder „Karten" steht; alles andere überlässt der Regelplaner dem
 * Modell, das den Zusammenhang beurteilen kann.
 */
const KARTENSUCHE_LOSE = [
  /\b(?:hast du|haben wir|habe ich|hab ich|gibt es|gibts)\s+(?:noch\s+)?(?:eine\s+|ein\s+|alle\s+|welche\s+)?(?:karten?\s+)?(?:von\s+|mit\s+)?(.{2,60}?)\s*[?.!]*$/iu,
  /\b(?:suche|such|finde|find|zeig|zeige)\s+(?:mir\s+)?(?:die\s+|alle\s+|eine\s+)?(?:karten?\s+)?(?:von\s+|mit\s+)?(.{2,60}?)\s*[?.!]*$/iu,
];

/** Füllwörter am Ende, die nicht zum Namen gehören. */
const SUCH_FUELLWOERTER = /\s+(?:im\s+(?:shop|angebot|katalog|sortiment|bestand|lager)|noch|bitte|denn|eigentlich|karten?)$/iu;

/** Zieht den gesuchten Namen aus der Frage — oder gibt `undefined` zurück.
 *
 * **Der Anlass:** „habe ich eine karte von Lewandowski?" endete am 2026-08-18
 * in einer Absage, weil es kein Werkzeug für die Frage gab. Jetzt gibt es eines,
 * und der Name muss lokal aus dem Satz kommen — sonst kostet die häufigste
 * Frage des Betreibers jedes Mal einen Modellaufruf.
 *
 * **Warum das gefahrlos ist, obwohl die Muster weit greifen:** Diese Funktion
 * wird ausschließlich aufgerufen, wenn **kein anderes Werkzeug** gegriffen hat.
 * „Zeig offene Preisvorschläge" fängt an wie eine Suche, wird aber längst von
 * `open_shop_offers` beantwortet und erreicht diese Stelle nie. Die Reihenfolge
 * ist die Absicherung — dieselbe Bauweise wie beim Modellplaner, der auch erst
 * hinter den Regeln steht.
 */
export function kartensuche(message: string): string | undefined {
  const roh = message.trim();
  const hatKartenwort = /\bkarten?\b/iu.test(roh);

  const treffer = KARTENSUCHE_STARK.exec(roh)
    ?? (hatKartenwort ? KARTENSUCHE_LOSE.map((muster) => muster.exec(roh)).find(Boolean) : undefined);
  if (!treffer) return undefined;

  let begriff = treffer[1]!.trim();
  // Mehrfach, weil sich Füllwörter stapeln: „von Lewandowski Karten im Shop".
  let vorher = "";
  while (begriff !== vorher) {
    vorher = begriff;
    begriff = begriff.replace(SUCH_FUELLWOERTER, "").replace(/[?.!,;:]+$/u, "").trim();
  }
  return begriff.length >= 2 ? begriff : undefined;
}

function uniqueInputs(inputs: AssistantToolInput[]): AssistantToolInput[] {
  const names = new Set<AssistantToolName>();
  return inputs.filter((input) => {
    if (names.has(input.tool) || names.size >= MAX_PLANNED_TOOLS) return false;
    names.add(input.tool);
    return true;
  });
}

export class RuleBasedAssistantPlanner implements AssistantPlanner {
  /** Die Uhr ist einspeisbar, weil ein Datum ohne Jahr nur relativ zu ihr
   *  eindeutig ist — „10.8." meint je nach heutigem Tag ein anderes Jahr. */
  private readonly jetzt: () => Date;

  // Ausgeschrieben statt als Kurzschreibweise im Parameter: Node entfernt beim
  // Ausführen von TypeScript nur Typen und übersetzt keine Parametereigenschaft.
  constructor(jetzt: () => Date = () => new Date()) {
    this.jetzt = jetzt;
  }

  async plan(message: string): Promise<AssistantPlan> {
    const text = normalizeQuestion(message);
    // Die zweite Lesart derselben Frage. Beide werden durchsucht — siehe
    // `foldUmlautDigraphs` dazu, warum sie nebeneinander stehen und nicht
    // hintereinander.
    const gefaltet = foldUmlautDigraphs(text);
    const enthaelt = (terms: readonly string[]) => containsAny(text, terms) || containsAny(gefaltet, terms);
    const limit = requestedLimit(text);
    // **Eine genannte Datumsspanne schlägt die Tagesangabe.** „Vom 10.8 bis
    // 12.8" ist die genauere Auskunft als irgendein rollendes Fenster; sie wird
    // auf dem *rohen* Text gesucht, weil `normalizeQuestion` aus „10.8" ein
    // „10 8" macht und die Datumsform damit zerstört.
    //
    // Steht hier oben, weil **zwei** Werkzeuge den Zeitraum auswerten: die
    // Verkaufsübersicht und die Aufrufe. Zweimal gerechnet liefen sie
    // auseinander, sobald jemand nur eine Stelle anfasst.
    const spanne = requestedRange(message, this.jetzt());
    const zeitraum = spanne?.days ?? requestedDays(text);
    const tools: AssistantToolInput[] = [];
    const add = (tool: AssistantToolName) => tools.push({ tool, limit });

    const asksEbayAvailability = enthaelt([
      "ebay daten nicht verfugbar",
      "ebay daten fehlen",
      "ebay informationen fehlen",
      "welche ebay daten",
      "was ist bei ebay nicht verfugbar",
    ]);
    if (asksEbayAvailability) {
      add("ebay_most_viewed");
      add("ebay_messages");
      add("ebay_buyer_offers");
    }

    // **Der Ereignisüberblick.** Steht weit oben, weil „was ist in den letzten
    // drei Stunden passiert" eine Frage nach *allem* ist und nicht nach einer
    // einzelnen Tabelle. Ohne Stundenangabe gilt die Vorgabe von 24 Stunden —
    // „was ist passiert?" meint den Tag.
    const stunden = requestedStunden(text);
    // **„was ging" und „was lief" standen hier und mussten wieder raus.** Ein
    // bestehender Test benutzt „Was ging als allerletztes über den virtuellen
    // Ladentisch?" als Beispiel für eine Frage, die der Regelplaner *nicht*
    // zuordnen kann — und mit dem losen Stichwort landete sie im
    // Ereignisüberblick statt beim letzten Verkauf. Vage Wendungen gehören nicht
    // in diese Liste; für sie ist der Modellplaner da.
    if (enthaelt([
      "was ist passiert", "was war los", "passiert ist", "vorgefallen",
      "update zu allem", "letzten stunden", "letzte stunde",
    ]) || (stunden !== undefined && enthaelt(["passiert", "los", "update", "neues", "vorgange"]))) {
      // **Nicht `limit`, sondern `DEFAULT_LIMIT`.** `requestedLimit` nimmt die
      // erste Zahl im Satz — bei „was ist in den letzten 48 Stunden passiert"
      // also die 48, gedeckelt auf 20. Die Stundenzahl würde damit zur
      // Ergebnisanzahl, und ein Bericht über drei Stunden zeigte drei Zeilen.
      // Genau dieselbe Verwechslung ist bei `days` schon dokumentiert; hier
      // wurde sie am 2026-08-18 im Screenshot sichtbar.
      tools.push({ tool: "activity_digest", limit: DEFAULT_LIMIT, ...(stunden === undefined ? {} : { stunden }) });
    }

    if (enthaelt(["statistik", "kennzahl", "ubersicht", "shop status", "wie lauft der shop"])) {
      add("assistant_statistics");
    }
    if (enthaelt(["sync", "abgleich", "rucknahme", "outbox", "ebay zustand", "ebay status"])) {
      add("ebay_sync_health");
    }
    // **Zwei Fragen, die dasselbe Wort benutzen.** „Welche Angebote wurden am
    // häufigsten angesehen?" will eine Rangliste je Angebot; „wie viele Aufrufe
    // hatte der Shop?" will eine Summe. Unterschieden wird an der Mengenfrage
    // („wie viele", „gesamt") und am Ort („shop", „webshop", „seite") — nicht
    // am Wort „Aufruf", das in beiden vorkommt.
    const fragtNachMenge = enthaelt(["wie viele", "wieviele", "wie viel", "anzahl", "gesamt", "insgesamt", "summe", "besucher", "besuche", "traffic"]);
    const nenntDenShop = enthaelt(["shop", "webshop", "website", "webseite", "seite", "homepage", "startseite"]);
    if (enthaelt(["aufruf", "aufrufe", "besucher", "besuche", "seitenaufruf", "traffic", "klicks"]) && (fragtNachMenge || nenntDenShop)) {
      tools.push({
        tool: "traffic_overview",
        limit,
        ...(zeitraum === undefined ? {} : { days: zeitraum }),
        ...(spanne === undefined ? {} : { bis: spanne.bis }),
      });
    }
    // **Die Richtung entscheidet über das Werkzeug.** Bis zum 2026-08-18 liefen
    // „am meisten" und „am wenigsten" auf dieselbe Abfrage mit fester Sortierung
    // und gaben deshalb dieselbe Antwort — vom Betreiber gemeldet. Die
    // Gegenrichtung wird jetzt zuerst geprüft: „am wenigsten angesehen" enthält
    // „angesehen" und liefe sonst wieder in die Meistgesehen-Frage.
    const fragtNachWenigsten = enthaelt([
      "am wenigsten", "wenigsten", "wenigste", "kaum", "keine aufrufe", "null aufrufe",
      "gar nicht angesehen", "nicht angesehen", "keiner angesehen", "niemand angesehen",
      "keiner angeschaut", "niemand angeschaut", "schlechtesten", "unbeachtet", "ubersehen",
    ]);
    if (enthaelt([
      "aufruf",
      "views",
      "meistgesehen",
      "meist gesehen",
      "am haufigsten angesehen",
      "angesehen",
      "angeschaut",
      "einblendung",
      "impression",
      "klicks",
    ])) {
      add(fragtNachWenigsten ? "ebay_least_viewed" : "ebay_most_viewed");
    }
    if (text.includes("ebay") && enthaelt(["nachricht", "postfach", "message"])) {
      add("ebay_messages");
    }
    if (enthaelt(["shop anfrage", "kundenanfrage", "kontakt anfrage", "neue anfrage", "anfragen im shop"])) {
      add("new_shop_inquiries");
    }
    if (enthaelt([
      "bestand",
      "lager",
      "nachfull",
      "auffull",
      "prufbedarf",
      "kritisch",
      "aufmerksamkeit",
      "knapp",
    ])) {
      add("inventory_review");
    }
    // **Preisvorschläge gibt es an zwei Stellen**, und die Frage sagt meist
    // nicht welche. „Gibt es neue Käufer-Preisvorschläge?" meint beides — wer
    // nur eine Quelle beantwortet, verschweigt die andere, ohne es zu sagen.
    // Nur eine ausdrücklich genannte Seite grenzt ein.
    if (enthaelt([
      "preisvorschlag",
      "preisvorschlage",
      "offene angebote",
      "offenes angebot",
      "shop angebote",
      // „gebot" stand hier kurzzeitig und traf „an**gebot**e" gleich mit —
      // damit beantwortete die Frage nach den Aufrufen nebenbei die nach den
      // Preisvorschlägen. `containsAny` sucht Teilzeichenketten, kein Wort.
      "best offer",
    ])) {
      const nurEbay = text.includes("ebay");
      const nurShop = !nurEbay && text.includes("shop");
      if (!nurEbay) add("open_shop_offers");
      if (!nurShop) add("ebay_buyer_offers");
    }
    if (enthaelt(["bestellung", "bestellungen", "order", "zu bearbeiten"])) {
      add("new_orders");
    }
    if (enthaelt(["eingestellt", "listing", "gelistet", "inseriert", "neueste karte", "zuletzt hinzugefugt"])) {
      add("latest_listing");
    }
    // **Vor `latest_sale`, und das ist der Punkt.** „Was habe ich in den
    // letzten 30 Tagen verkauft?" enthält „verkauft" und liefe sonst auf die
    // Frage nach dem *einen* letzten Verkauf hinaus — eine Antwort, die zur
    // Frage passt wie eine Zahl zu einer Liste. Der Zeitraum oder das Wort
    // „Umsatz" ist das Unterscheidungsmerkmal.
    const fragtNachUmsatz = enthaelt(["umsatz", "einnahmen", "eingenommen", "verdient", "erlos"]);
    const fragtNachVerkaufen = enthaelt(["verkauft", "verkauf", "sale", "abgesetzt"]);
    if (fragtNachUmsatz || (fragtNachVerkaufen && (zeitraum !== undefined || enthaelt(["ubersicht", "bilanz", "insgesamt", "wie viele"])))) {
      tools.push({
        tool: "sales_overview",
        limit,
        ...(zeitraum === undefined ? {} : { days: zeitraum }),
        ...(spanne === undefined ? {} : { bis: spanne.bis }),
      });
    }
    if (fragtNachVerkaufen || enthaelt(["letzter kauf", "ging zuletzt weg"])) {
      add("latest_sale");
    }

    const selected = uniqueInputs(tools);
    // **Die Kartensuche steht am Ende, und das ist ihre Absicherung.** Sie
    // greift nur, wenn keine Fachfrage erkannt wurde; damit kann sie keine
    // beantwortbare Frage an sich ziehen. Siehe {@link kartensuche}.
    if (selected.length === 0) {
      const suche = kartensuche(message);
      if (suche) return { tools: [{ tool: "card_search", limit, suche }], reason: "READY" };
    }
    return { tools: selected, reason: selected.length ? "READY" : "UNSUPPORTED" };
  }
}

function parseFunctionArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") throw new Error("Der Modell-Tool-Aufruf enthält keine Argumente.");
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Der Modell-Tool-Aufruf enthält ungültige Argumente.");
  }
  return parsed as Record<string, unknown>;
}

export function parseOpenAIPlannedTools(value: unknown): AssistantToolInput[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Die Modellantwort ist kein Objekt.");
  }
  const output = (value as { output?: unknown }).output;
  if (!Array.isArray(output)) throw new Error("Die Modellantwort enthält keine Ausgabeliste.");

  const inputs: AssistantToolInput[] = [];
  for (const item of output as OpenAIResponseItem[]) {
    if (item.type !== "function_call") continue;
    if (typeof item.name !== "string" || !(ASSISTANT_TOOL_NAMES as readonly string[]).includes(item.name)) {
      throw new Error("Das Modell hat ein nicht registriertes Assistant-Werkzeug angefordert.");
    }
    const args = parseFunctionArguments(item.arguments);
    // `null` ist im Schema die Art, „nicht genannt" zu sagen — durchgereicht
    // wäre es ein ungültiges Feld und ließe die ganze Planung scheitern.
    const gesetzt = Object.fromEntries(Object.entries(args).filter(([, wert]) => wert !== null));
    inputs.push(parseAssistantToolInput({ tool: item.name, ...gesetzt }));
  }
  return uniqueInputs(inputs);
}

export class OpenAIResponsesAssistantPlanner implements AssistantPlanner {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: FetchLike;
  private readonly jetzt: () => Date;

  constructor(
    apiKey: string,
    model = DEFAULT_OPENAI_MODEL,
    fetchImpl: FetchLike = fetch,
    jetzt: () => Date = () => new Date(),
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.jetzt = jetzt;
  }

  /** Das heutige Datum für die Anweisung. **Ohne diesen Satz kann das Modell
   *  „vom 10.8 bis 12.8" gar nicht auflösen**: Ein Datum ohne Jahr ist nur
   *  relativ zu heute eindeutig, und das Modell kennt den Tag nicht. */
  private heute(): string {
    return this.jetzt().toISOString().slice(0, 10);
  }

  async plan(message: string): Promise<AssistantPlan> {
    const response = await this.fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 800,
        parallel_tool_calls: true,
        tool_choice: "auto",
        instructions: [
          "Du bist der zentrale, ausschließlich lesende Planer für den BrandyCards-Assistant.",
          "Wähle für die deutsche Nutzerfrage alle und nur die fachlich passenden bereitgestellten Funktionen.",
          "Erfinde keine Funktion. Schreibe keine Antwort. Erzeuge kein SQL und fordere keine Schreiboperation an.",
          "Wenn die Frage nicht mit den angebotenen Shop- oder eBay-Lesewerkzeugen beantwortbar ist, rufe keine Funktion auf.",
          "limit ist die gewünschte Ergebniszahl von 1 bis 20; verwende 10, wenn keine Zahl genannt wurde.",
          "days ist der Zeitraum in Tagen von 1 bis 90 und zählt nur für sales_overview; verwende 30, wenn kein Zeitraum genannt wurde. Ein genannter Zeitraum gehört nach days, nicht nach limit.",
          `bis ist der letzte Tag des Zeitraums als JJJJ-MM-TT, einschließlich. Heute ist der ${this.heute()}.`,
          "Nennt die Frage eine abgeschlossene Spanne wie „vom 10.8 bis 12.8“, setze bis auf den letzten Tag und days auf die Zahl der Tage einschließlich beider Enden — für dieses Beispiel bis=Jahr-08-12 und days=3.",
          "Nennt die Frage einen einzelnen Tag, ist bis dieser Tag und days ist 1.",
          "Nennt die Frage kein Enddatum, lasse bis leer; der Zeitraum endet dann heute.",
        ].join(" "),
        input: [{ role: "user", content: message }],
        tools: ASSISTANT_TOOL_DEFINITIONS.map((tool) => ({
          type: "function",
          name: tool.name,
          description: `${tool.description}. Datenstatus: ${tool.availability}. Ausschließlich lesend.`,
          strict: true,
          parameters: {
            type: "object",
            properties: {
              limit: { type: "integer", minimum: 1, maximum: 20, description: "Maximale Ergebniszahl." },
              days: { type: "integer", minimum: 1, maximum: 90, description: "Zeitraum in Tagen; nur sales_overview wertet ihn aus." },
              bis: {
                // `null` steht hier, weil `strict: true` keine weglassbare
                // Eigenschaft kennt: Ohne diese Wahl müsste das Modell ein
                // Enddatum erfinden, auch wo die Frage keines nennt.
                type: ["string", "null"],
                // **Das einzige Zeichenkettenfeld im ganzen Schema.** Es ist
                // auf die Datumsform festgelegt, damit hier kein Freitext
                // hereinkommt; verlassen wird sich darauf nicht — die Prüfung
                // in `parseAssistantToolInput` gilt unabhängig davon, ob der
                // Anbieter `pattern` beachtet.
                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                description: "Letzter Tag des Zeitraums als JJJJ-MM-TT, einschließlich; null, wenn der Zeitraum heute endet.",
              },
              stunden: {
                type: ["integer", "null"],
                minimum: 1,
                maximum: 168,
                description: "Nur für activity_digest: das Fenster in Stunden. null bei allen anderen Funktionen; ohne Angabe gelten 24 Stunden.",
              },
              suche: {
                // Das zweite Zeichenkettenfeld, und das erste ohne Form: Ein
                // Kartentitel lässt sich nicht als Muster festlegen. Die
                // Schranken stehen deshalb hinter dem Modell, in
                // `normalisiereSuchbegriff` — Länge und entwertete
                // LIKE-Platzhalter, unabhängig davon, was hier ankommt.
                type: ["string", "null"],
                description: "Nur für card_search: der gesuchte Name, etwa Spieler, Verein oder Serie. Ohne Zusätze wie „Karte von“. null bei allen anderen Funktionen.",
              },
            },
            // `strict: true` verlangt, dass jede Eigenschaft in `required`
            // steht. Der Zeitraum ist deshalb Pflicht im Schema und bekommt
            // seine Vorgabe erst dahinter -- siehe `boundedOverviewDays`.
            required: ["limit", "days", "bis", "suche", "stunden"],
            additionalProperties: false,
          },
        })),
      }),
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`OpenAI-Planung fehlgeschlagen (HTTP ${response.status}).`);
    }
    const tools = parseOpenAIPlannedTools(await response.json());
    return { tools, reason: tools.length ? "READY" : "UNSUPPORTED" };
  }
}

export class HybridAssistantPlanner implements AssistantPlanner {
  private readonly localPlanner: AssistantPlanner;
  private readonly modelPlanner: AssistantPlanner | null;

  constructor(
    localPlanner: AssistantPlanner,
    modelPlanner: AssistantPlanner | null,
  ) {
    this.localPlanner = localPlanner;
    this.modelPlanner = modelPlanner;
  }

  /** Erst die Regeln, dann — falls nötig und möglich — das Modell.
   *
   * **Die Reihenfolge ist auch die Absicherung.** Bekannte Fragen erreichen den
   * Modellpfad nie; ein Ausfall beim Anbieter kann sie deshalb nicht treffen.
   * Was hier schiefgehen kann, betrifft ausschließlich Formulierungen, die
   * ohne Modell ohnehin unbeantwortbar wären.
   *
   * Ein Fehlschlag des Modells wird deshalb **aufgefangen statt
   * durchgelassen.** Ungefangen erzeugte er eine 503-Antwort für die ganze
   * Anfrage und damit weniger, als ein gar nicht eingerichtetes Modell liefert:
   * nämlich statt einer erklärenden Auskunft eine Absage. Eine Aktivierung darf
   * das Verhalten nicht verschlechtern, wenn sie misslingt.
   */
  async plan(message: string): Promise<AssistantPlan> {
    const local = await this.localPlanner.plan(message);
    if (local.tools.length) return local;
    if (!this.modelPlanner) return { tools: [], reason: "MODEL_NOT_CONFIGURED" };

    try {
      return await this.modelPlanner.plan(message);
    } catch (error) {
      // **Serverseitig laut, gegenüber dem Gerät stumm.** Der Betreiber muss
      // Schlüssel, Guthaben und Modellnamen unterscheiden können; der Desktop
      // hat mit Anbieterdetails nichts zu tun.
      console.error("assistant model planner failed", error);
      return { tools: [], reason: "MODEL_FAILED" };
    }
  }
}

export function createServerAssistantPlanner(): AssistantPlanner {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_ASSISTANT_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  return new HybridAssistantPlanner(
    new RuleBasedAssistantPlanner(),
    apiKey ? new OpenAIResponsesAssistantPlanner(apiKey, model) : null,
  );
}
