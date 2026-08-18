/** Zwei Meldungen des Betreibers vom 2026-08-18, beide hier festgehalten.
 *
 * 1. „Bei der Frage, welche am meisten Aufrufe haben und welche am wenigsten
 *    bekomme ich 2 mal das gleiche Ergebnis." — die Sortierung war fest
 *    verdrahtet, es gab keine Gegenrichtung.
 * 2. „Ich kann nicht fragen, was in der X letzten Stunde so passiert ist."
 */
import assert from "node:assert/strict";
import test from "node:test";

const {
  ACTIVITY_DIGEST_DEFAULT_HOURS,
  ACTIVITY_DIGEST_MAX_HOURS,
  availableAssistantResult,
  parseAssistantToolInput,
} = await import("../lib/assistant/contracts.ts");
const { RuleBasedAssistantPlanner, requestedStunden } = await import("../lib/assistant/planner.ts");
const { formatAssistantToolResult } = await import("../lib/assistant/response-formatter.ts");

const planer = () => new RuleBasedAssistantPlanner(() => new Date("2026-08-18T10:00:00Z"));

test("meiste und wenigste Aufrufe sind zwei verschiedene Fragen", async () => {
  const meiste = await planer().plan("Welche Karten haben am meisten Aufrufe?");
  const wenigste = await planer().plan("Welche Karten haben am wenigsten Aufrufe?");

  assert.deepEqual(meiste.tools.map((t) => t.tool), ["ebay_most_viewed"]);
  assert.deepEqual(wenigste.tools.map((t) => t.tool), ["ebay_least_viewed"]);
  // **Der gemeldete Fehler in einer Zeile:** Vorher waren beide gleich.
  assert.notDeepEqual(meiste.tools, wenigste.tools);

  // „kaum angesehen" enthält „angesehen" und liefe ohne Vorrang der
  // Gegenrichtung wieder in die Meistgesehen-Frage.
  for (const frage of [
    "Welche Angebote wurden kaum angesehen?",
    "Welche Karten hat keiner angesehen?",
    "Zeig mir die schlechtesten Angebote nach Aufrufen",
  ]) {
    const plan = await planer().plan(frage);
    assert.ok(plan.tools.some((t) => t.tool === "ebay_least_viewed"), `„${frage}" muss die Gegenrichtung wählen`);
    assert.ok(!plan.tools.some((t) => t.tool === "ebay_most_viewed"), `„${frage}" darf nicht zusätzlich meistgesehen wählen`);
  }
});

test("null Aufrufe werden als Null benannt, fehlende Zahlen nicht erfunden", () => {
  const ergebnis = availableAssistantResult("ebay_least_viewed", {
    rangeStart: "20260718", rangeEnd: "20260816",
    listings: [
      { ebayItemId: "1", title: "Karte ohne Publikum", listingUrl: null, viewsTotal: 0, impressionsTotal: 12 },
      { ebayItemId: "2", title: "Karte mit wenig Publikum", listingUrl: null, viewsTotal: 2, impressionsTotal: null },
    ],
  }, ["EBAY_READ_API", "EBAY_CACHE"], "2026-08-18T06:00:00.000Z");

  const text = formatAssistantToolResult(ergebnis);
  assert.match(text, /wenigsten Aufrufen zuerst/u);
  // **Genau diese Karten sucht die Frage.** Eine Null als „nicht gemeldet" zu
  // verkleiden wäre hier das Gegenteil einer Antwort.
  assert.match(text, /Karte ohne Publikum: kein einziger Aufruf, 12 Einblendungen/u);
  assert.match(text, /Karte mit wenig Publikum: 2 Aufrufe$/mu);
  assert.match(text, /vom 18\.07\.2026 bis 16\.08\.2026/u);
});

test("Stunden werden erkannt, und zwar nur als Stunden", () => {
  assert.equal(requestedStunden("was ist in den letzten 3 stunden passiert"), 3);
  assert.equal(requestedStunden("was ist in der letzten stunde passiert"), 1);
  assert.equal(requestedStunden("update der letzten 12 h"), 12);
  assert.equal(requestedStunden("umsatz der letzten 7 tage"), undefined);
  // „heute" ist absichtlich kein Stundenfenster: ab Mitternacht gerechnet wäre
  // es um 23 Uhr etwas völlig anderes als um 1 Uhr.
  assert.equal(requestedStunden("was ist heute passiert"), undefined);
});

test("der Ereignisüberblick nimmt das genannte Fenster, sonst die Vorgabe", async () => {
  const mitFenster = await planer().plan("Was ist in den letzten 3 Stunden passiert?");
  assert.deepEqual(mitFenster.tools, [{ tool: "activity_digest", limit: 3, stunden: 3 }]);

  const ohneFenster = await planer().plan("Was war los?");
  assert.deepEqual(ohneFenster.tools, [{ tool: "activity_digest", limit: 10 }]);

  // Der Betreiber hat es so formuliert; genau das muss durchlaufen.
  const woertlich = await planer().plan("Ich hätte gerne ein Update zu allem, was in den letzten 6 Stunden passiert ist");
  assert.ok(woertlich.tools.some((t) => t.tool === "activity_digest" && t.stunden === 6));
});

test("das Stundenfenster wird geprüft, nicht zurechtgebogen", () => {
  assert.deepEqual(
    parseAssistantToolInput({ tool: "activity_digest", stunden: 6 }),
    { tool: "activity_digest", limit: 10, stunden: 6 },
  );
  assert.throws(() => parseAssistantToolInput({ tool: "activity_digest", stunden: 0 }), /zwischen 1 und 168/u);
  assert.throws(() => parseAssistantToolInput({ tool: "activity_digest", stunden: ACTIVITY_DIGEST_MAX_HOURS + 1 }), /zwischen 1 und 168/u);
  assert.throws(() => parseAssistantToolInput({ tool: "activity_digest", stunden: 1.5 }), /ganze Zahl/u);
});

test("ein leeres Fenster wird ausgesprochen, nicht durch Schweigen angedeutet", () => {
  const leer = availableAssistantResult("activity_digest", {
    stunden: 3, seit: "2026-08-18T07:00:00.000Z", eintraege: [], gesamtAnzahl: 0, leer: true,
    offeneEbayVorschlaege: 0,
  }, ["SHOP_DB", "EBAY_CACHE"], null);

  const text = formatAssistantToolResult(leer);
  // **Diese Aussage ist hier belastbar**, anders als bei den Aufrufzahlen: Die
  // Fachtabellen sind vollständig und haben keinen Messbeginn, hinter dem sich
  // etwas verstecken könnte.
  assert.match(text, /In den letzten 3 Stunden ist nichts passiert/u);
  assert.match(text, /keine Bestellungen, keine Verkäufe/u);
});

test("der Bericht mischt alle Arten und sortiert neueste zuerst", () => {
  const ergebnis = availableAssistantResult("activity_digest", {
    stunden: 24,
    seit: "2026-08-17T10:00:00.000Z",
    eintraege: [
      { art: "EBAY_VERKAUF", bezeichnung: "Lewandowski Base 3/5", betragCents: 7000, currency: "EUR", zeitpunkt: "2026-08-18T09:30:00.000Z" },
      { art: "SHOP_PREISVORSCHLAG", bezeichnung: "Yamal Rookie", betragCents: 4500, currency: "EUR", zeitpunkt: "2026-08-18T08:00:00.000Z" },
      { art: "SHOP_ANFRAGE", bezeichnung: "ohne Kartenbezug", betragCents: null, currency: "EUR", zeitpunkt: "2026-08-18T07:15:00.000Z" },
    ],
    gesamtAnzahl: 5,
    leer: false,
    offeneEbayVorschlaege: 0,
  }, ["SHOP_DB", "EBAY_CACHE"], "2026-08-18T09:30:00.000Z");

  const text = formatAssistantToolResult(ergebnis);
  assert.match(text, /In den letzten 24 Stunden sind 5 Vorgänge zusammengekommen, neueste zuerst/u);
  // Ausgeschriebene Bezeichnungen, keine Kürzel aus der Datenform.
  assert.match(text, /eBay-Verkauf: Lewandowski Base 3\/5 \(70,00/u);
  assert.match(text, /Preisvorschlag im Shop: Yamal Rookie \(45,00/u);
  assert.doesNotMatch(text, /SHOP_PREISVORSCHLAG|EBAY_VERKAUF/u);
  // Ein Vorgang ohne Betrag bekommt keine erfundene Null in Klammern.
  assert.match(text, /Shop-Anfrage: ohne Kartenbezug$/mu);
  // Gekürzt heißt gekürzt, und das steht dabei.
  assert.match(text, /5 Vorgänge insgesamt; gezeigt werden die 3 neuesten/u);
  assert.equal(ACTIVITY_DIGEST_DEFAULT_HOURS, 24);
});

test("der Überblick liest alle Fachtabellen, nicht nur das Ereignisprotokoll", async () => {
  const { readFile } = await import("node:fs/promises");
  const quelle = await readFile(new URL("../lib/assistant/tools/activity.ts", import.meta.url), "utf8");
  // **`avatar_events` kennt nur vier Ereignisarten.** Ein Überblick daraus
  // verschwiege neue Bestellungen, Anfragen und Einstellungen — stillschweigend,
  // was hier die schlechteste aller Eigenschaften ist. Und zu einem angenommenen
  // Vorschlag stünde dort nur eine Kennung statt Kartentitel und Betrag.
  for (const tabelle of [
    "orders", "ebaySales", "priceOffers", "inquiries", "products",
    "ebayInboxMessages", "ebayBuyerOffers",
  ]) {
    assert.match(quelle, new RegExp(`\\b${tabelle}\\b`, "u"), `${tabelle} gehört in den Überblick`);
  }
  assert.doesNotMatch(quelle, /avatarEvents/u, "die Antworten kommen aus price_offers, nicht aus dem Ereignisprotokoll");

  // Die abgeschickte Seite: Endzustände über `updatedAt`, `IN_REVIEW` gehört
  // nicht dazu — „in Prüfung" ist keine Antwort.
  assert.match(quelle, /IN \('ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'\)/u);
  // Nur der Code zählt: Die Begründung *nennt* `IN_REVIEW`, um zu sagen, warum
  // es dort nicht steht. (Dieselbe Falle wie beim `Math.random`-Wächter.)
  const code = quelle.split("\n").filter((zeile) => !/^\s*(\/\/|\*|\/\*)/u.test(zeile)).join("\n");
  assert.doesNotMatch(code, /IN_REVIEW/u);

  // **Die eBay-Preisvorschläge werden ausdrücklich *nicht* gefiltert.** Ihre
  // einzige Zeitspalte ist ein Sync-Stempel; ein Zeitfenster darauf würde alle
  // 15 Minuten jeden offenen Vorschlag als neu eingegangen ausgeben.
  assert.doesNotMatch(quelle, /imFenster\(ebayBuyerOffers/u);
  assert.match(quelle, /imFenster\(ebayInboxMessages\.receivedAt\)/u);
});

test("eBay-Nachrichten und beantwortete Vorschläge stehen im Bericht", () => {
  const ergebnis = availableAssistantResult("activity_digest", {
    stunden: 6,
    seit: "2026-08-18T14:00:00.000Z",
    eintraege: [
      { art: "EBAY_NACHRICHT", bezeichnung: "Frage zur Karte (von sammler_88)", betragCents: null, currency: "EUR", zeitpunkt: "2026-08-18T18:00:00.000Z" },
      { art: "VORSCHLAG_ANGENOMMEN", bezeichnung: "Yamal Rookie", betragCents: 4500, currency: "EUR", zeitpunkt: "2026-08-18T17:00:00.000Z" },
      { art: "VORSCHLAG_ABGELEHNT", bezeichnung: "Kane Base", betragCents: 900, currency: "EUR", zeitpunkt: "2026-08-18T16:00:00.000Z" },
    ],
    gesamtAnzahl: 3,
    leer: false,
    offeneEbayVorschlaege: 2,
  }, ["SHOP_DB", "EBAY_CACHE"], "2026-08-18T18:00:00.000Z");

  const text = formatAssistantToolResult(ergebnis);
  assert.match(text, /eBay-Nachricht: Frage zur Karte \(von sammler_88\)/u);
  assert.match(text, /Preisvorschlag angenommen: Yamal Rookie \(45,00/u);
  assert.match(text, /Preisvorschlag abgelehnt: Kane Base \(9,00/u);
  // **Der Zustandssatz steht getrennt und sagt, warum er keine Uhrzeit hat.**
  assert.match(text, /^Unabhängig vom Zeitfenster: 2 offene\(r\) Käufer-Preisvorschlag/mu);
  assert.match(text, /liefert eBay keinen Eingangszeitpunkt/u);
});

test("ohne offene eBay-Vorschläge wird kein Zustandssatz behauptet", () => {
  const ergebnis = availableAssistantResult("activity_digest", {
    stunden: 3, seit: "2026-08-18T07:00:00.000Z", eintraege: [], gesamtAnzahl: 0, leer: true,
    offeneEbayVorschlaege: 0,
  }, ["SHOP_DB"], null);
  const text = formatAssistantToolResult(ergebnis);
  assert.doesNotMatch(text, /Unabhängig vom Zeitfenster/u);
  // Die Aufzählung des Leeren nennt jetzt auch die eBay-Nachrichten.
  assert.match(text, /keine eBay-Nachrichten/u);
});
