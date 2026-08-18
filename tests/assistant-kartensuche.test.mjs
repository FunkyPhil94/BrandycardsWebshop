/** Die Kartensuche — das Werkzeug, das am 2026-08-18 gefehlt hat.
 *
 * Der Betreiber fragte „habe ich eine karte von Lewandowski?" und bekam eine
 * Absage. Produktiv gemessen trafen zwei Karten den Titel: eine aktiv im
 * Angebot für 70,00 €, eine mit beendetem Listing und Bestand 0. Diese
 * Unterscheidung ist der Kern der Tests hier.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  alsSuchmuster,
  availableAssistantResult,
  normalisiereSuchbegriff,
  parseAssistantToolInput,
  SUCHE_MAX_LAENGE,
} = await import("../lib/assistant/contracts.ts");
const { RuleBasedAssistantPlanner, kartensuche } = await import("../lib/assistant/planner.ts");
const { formatAssistantToolResult } = await import("../lib/assistant/response-formatter.ts");
const { istImKatalogSichtbar } = await import("../lib/catalog-availability.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("der gesuchte Name kommt ohne Modell aus dem Satz", () => {
  assert.equal(kartensuche("habe ich eine karte von Lewandowski?"), "Lewandowski");
  assert.equal(kartensuche("Hast du Karten von Messi?"), "Messi");
  assert.equal(kartensuche("Gibt es noch Karten von Barcelona im Shop?"), "Barcelona");
  assert.equal(kartensuche("Zeig mir alle Karten von Topps UCC Gold"), "Topps UCC Gold");
  // Füllwörter stapeln sich und müssen mehrfach fallen.
  assert.equal(kartensuche("Suche Karten von Kane im Angebot bitte"), "Kane");

  // **Ohne Kartenwort greift die lose Form nicht.** „Hast du Lewandowski?" ist
  // aus dem Satz allein nicht von „Hast du Feierabend?" zu unterscheiden; das
  // beurteilt das Modell, nicht die Regel.
  assert.equal(kartensuche("Hast du Lewandowski?"), undefined);
  assert.equal(kartensuche("Wie ist das Wetter in Köln?"), undefined);
});

test("die Kartensuche zieht keine beantwortbare Frage an sich", async () => {
  const planer = new RuleBasedAssistantPlanner(() => new Date("2026-08-18T10:00:00Z"));
  // **Die Reihenfolge ist die Absicherung.** „Zeig offene Preisvorschläge"
  // fängt an wie eine Suche und wird längst von den Vorschlagswerkzeugen
  // beantwortet; die Kartensuche steht dahinter und erreicht den Satz nie.
  for (const [frage, erwartet] of [
    ["Zeig offene Preisvorschläge", "open_shop_offers"],
    ["Zeig mir den Umsatz der letzten 7 Tage", "sales_overview"],
    ["Was wurde zuletzt verkauft?", "latest_sale"],
    ["Suche Karten von Kane", "card_search"],
  ]) {
    const plan = await planer.plan(frage);
    assert.equal(plan.tools[0]?.tool, erwartet, `„${frage}" sollte auf ${erwartet} laufen`);
  }
  const suche = await planer.plan("habe ich eine karte von Lewandowski?");
  assert.deepEqual(suche.tools, [{ tool: "card_search", limit: 10, suche: "Lewandowski" }]);
});

test("der Suchbegriff wird geprüft und entschärft, nicht zurechtgebogen", () => {
  assert.equal(normalisiereSuchbegriff("  Robert   Lewandowski "), "Robert Lewandowski");
  assert.throws(() => normalisiereSuchbegriff("x"), /mindestens/u);
  assert.throws(() => normalisiereSuchbegriff("x".repeat(SUCHE_MAX_LAENGE + 1)), /höchstens/u);
  assert.throws(() => normalisiereSuchbegriff(42), /Text/u);

  // **`%` und `_` sind LIKE-Platzhalter.** Eine Suche nach „50%" träfe sonst
  // jede Karte, und das Ergebnis sähe aus wie eine Antwort.
  assert.equal(alsSuchmuster("50%"), "%50\\%%");
  assert.equal(alsSuchmuster("a_b"), "%a\\_b%");
  assert.equal(alsSuchmuster("Lewandowski"), "%lewandowski%");
  // Das Werkzeug muss ESCAPE setzen, sonst ist die Entwertung wirkungslos.
  const werkzeug = "lib/assistant/tools/catalog.ts";
  return read(werkzeug).then((quelle) => {
    assert.match(quelle, /ESCAPE '\\\\'/u, `${werkzeug} braucht die ESCAPE-Klausel`);
    // Die Sichtbarkeitsregel wird benutzt, nicht nachgebaut.
    assert.match(quelle, /istImKatalogSichtbar\(/u);
    assert.doesNotMatch(quelle, /listingType === "AUCTION"/u, "die Auktionsregel gehört nicht kopiert");
  });
});

test("suche ist nur für die Kartensuche und wird sonst abgewiesen", () => {
  assert.deepEqual(
    parseAssistantToolInput({ tool: "card_search", suche: "Lewandowski" }),
    { tool: "card_search", limit: 10, suche: "Lewandowski" },
  );
  assert.throws(() => parseAssistantToolInput({ tool: "card_search", suche: "" }), /mindestens/u);
  assert.throws(() => parseAssistantToolInput({ tool: "card_search", frage: "x" }), /Nicht unterstützte Felder/u);
});

test("die beiden echten Lewandowski-Zeilen werden auseinandergehalten", () => {
  // Genau die Werte, die am 2026-08-18 in der Produktion standen.
  const aktiv = istImKatalogSichtbar(
    "EBAY_SYNCED", "FIXED_PRICE", 1, { availableQuantity: 1, status: "AVAILABLE" }, "EBAY");
  const beendet = istImKatalogSichtbar(
    "EBAY_SYNCED", "FIXED_PRICE", 1, { availableQuantity: 0, status: "UNAVAILABLE" }, "EBAY");

  assert.equal(aktiv, true, "die aktive Karte ist im Angebot");
  assert.equal(beendet, false, "die beendete Karte ist gewollte Historie, kein Angebot");
});

test("die Antwort nennt das Angebot und zählt die Historie, ohne sie aufzuzählen", () => {
  const ergebnis = availableAssistantResult("card_search", {
    suche: "Lewandowski",
    angeboten: [{
      productId: "a".repeat(32),
      title: "Topps UCC Gold 25/26 FC Barcelona Robert Lewandowski Base 3/5",
      bereich: "KATALOG",
      priceAmountCents: 7000,
      priceCurrency: "EUR",
      menge: 1,
    }],
    nichtAngebotenAnzahl: 1,
    gekuerzt: false,
  }, ["SHOP_DB", "EBAY_CACHE"], "2026-08-18T12:00:00.000Z");

  const text = formatAssistantToolResult(ergebnis);
  assert.match(text, /ist eine Karte im Angebot/u);
  assert.match(text, /Robert Lewandowski Base 3\/5/u);
  assert.match(text, /70,00/u);
  assert.match(text, /Shop-Katalog/u);
  // **Der Nebensatz ist die eigentliche Auskunft.** Ohne ihn klingt die Antwort
  // wie „du hast genau eine", und wer zwei im Kopf hat, hält das für einen Fehler.
  assert.match(text, /1 weitere\(r\) Titeltreffer ist nicht mehr im Angebot/u);
  assert.match(text, /Quelle: Shop-Datenbank, eBay-Abgleich · Stand:/u);
  // Eine Einzelkarte bekommt kein „1× vorhanden" angehängt.
  assert.doesNotMatch(text, /1× vorhanden/u);
});

test("kein Treffer im Angebot ist nicht dasselbe wie kein Treffer", () => {
  const nurHistorie = availableAssistantResult("card_search", {
    suche: "Neymar", angeboten: [], nichtAngebotenAnzahl: 3, gekuerzt: false,
  }, ["SHOP_DB"], null);
  const garnichts = availableAssistantResult("card_search", {
    suche: "Neymar", angeboten: [], nichtAngebotenAnzahl: 0, gekuerzt: false,
  }, ["SHOP_DB"], null);

  assert.match(formatAssistantToolResult(nurHistorie), /keine Karte im Angebot.*3 weitere/su);
  const leer = formatAssistantToolResult(garnichts);
  assert.match(leer, /keine Karte im Angebot/u);
  assert.doesNotMatch(leer, /weitere/u, "ohne Historie darf kein Nebensatz behauptet werden");
});

test("der Vorverkauf wird als solcher benannt", () => {
  const ergebnis = availableAssistantResult("card_search", {
    suche: "Yamal",
    angeboten: [{
      productId: "b".repeat(32), title: "Lamine Yamal Rookie", bereich: "VORVERKAUF",
      priceAmountCents: null, priceCurrency: "EUR", menge: 2,
    }],
    nichtAngebotenAnzahl: 0, gekuerzt: false,
  }, ["SHOP_DB"], null);

  const text = formatAssistantToolResult(ergebnis);
  // 144 Karten liegen im Vorverkauf. Sie sind angeboten, aber an anderer Stelle
  // und nicht auf demselben Weg zu haben — das gehört in die Antwort.
  assert.match(text, /Vorverkauf/u);
  // Ein fehlender Preis wird benannt, nicht als 0,00 € erfunden.
  assert.match(text, /Preis nicht hinterlegt/u);
  assert.doesNotMatch(text, /0,00/u);
  assert.match(text, /2× vorhanden/u);
});
