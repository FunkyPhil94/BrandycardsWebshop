import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  absageEinleitung,
  einleitung,
  enthaeltFachwort,
  schlusskommentar,
  smalltalkAntwort,
  streutext,
  tageszeitgruss,
  waehle,
} = await import("../lib/assistant/persona.ts");
const { availableAssistantResult, unavailableAssistantResult } = await import("../lib/assistant/contracts.ts");
const { AssistantOrchestrator } = await import("../lib/assistant/orchestrator.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const jetzt = new Date("2026-08-18T10:00:00.000Z");
const uhr = () => jetzt;

function orchestrator(tools, ergebnisse) {
  return new AssistantOrchestrator(
    { plan: async () => ({ tools: tools.map((tool) => ({ tool, limit: 10 })), reason: "READY" }) },
    { execute: async (input) => ergebnisse[input.tool] },
    null,
    uhr,
  );
}

test("dieselbe Frage klingt am selben Tag gleich und über Tage hinweg verschieden", () => {
  const frage = "Was wurde zuletzt verkauft?";
  const heute = streutext(frage, new Date("2026-08-18T08:00:00Z"));
  const spaeterAmTag = streutext(frage, new Date("2026-08-18T21:44:00Z"));
  const morgen = streutext(frage, new Date("2026-08-19T08:00:00Z"));

  // Zweimal dieselbe Frage kurz hintereinander darf nicht anders klingen; das
  // wirkt sprunghaft, nicht lebendig.
  assert.equal(heute, spaeterAmTag);
  assert.notEqual(heute, morgen);

  const varianten = ["a", "b", "c", "d", "e"];
  assert.equal(waehle(varianten, heute), waehle(varianten, spaeterAmTag));
  // Über viele Fragen hinweg muss jede Variante drankommen -- eine Streuung,
  // die immer denselben Satz wählt, wäre keine.
  const getroffen = new Set();
  for (let i = 0; i < 200; i += 1) getroffen.add(waehle(varianten, `frage ${i}|2026-08-18`));
  assert.equal(getroffen.size, varianten.length);
});

test("der Gruß richtet sich nach der Uhrzeit in Berlin, nicht nach UTC", () => {
  // 23:30 UTC ist in Berlin bereits der nächste Morgen (Sommerzeit, UTC+2).
  assert.equal(tageszeitgruss(new Date("2026-08-18T04:30:00Z")), "Guten Morgen.");
  assert.equal(tageszeitgruss(new Date("2026-08-18T12:00:00Z")), "Guten Tag.");
  assert.equal(tageszeitgruss(new Date("2026-08-18T18:00:00Z")), "Guten Abend.");
  // 01:00 Berliner Zeit -- der Nachtfall, und er muss aus UTC 23:00 des
  // Vortages entstehen, sonst rechnet jemand wieder in UTC.
  assert.equal(tageszeitgruss(new Date("2026-08-17T23:00:00Z")), "Nachtschicht?");
});

test("Smalltalk wird beantwortet, eine Fachfrage niemals", () => {
  for (const gruss of ["Hallo", "Moin!", "hey karl", "Guten Morgen"]) {
    const antwort = smalltalkAntwort(gruss, jetzt);
    assert.ok(antwort, `„${gruss}" sollte als Gruß erkannt werden`);
  }
  assert.match(smalltalkAntwort("Wer bist du?", jetzt) ?? "", /Kartenshop-Auskunft/u);
  assert.ok(smalltalkAntwort("danke", jetzt));
  assert.ok(smalltalkAntwort("Tschüss", jetzt));

  // **Der teuerste denkbare Fehler dieser Schicht.** Jede dieser Nachrichten
  // fängt an wie Smalltalk und ist eine Fachfrage -- sie muss ungebremst zum
  // Planer durchlaufen, sonst bekommt der Betreiber einen Spruch statt Zahlen.
  const fachfragen = [
    "Hallo, was wurde verkauft?",
    "Na, wie läuft der Verkauf?",
    "Hi, offene Angebote?",
    "Wie geht's dem Lagerbestand?",
    "Was kannst du mir über eBay sagen?",
    "Danke, und der Umsatz?",
    "Was wurde heute verkauft?",
  ];
  for (const frage of fachfragen) {
    assert.equal(smalltalkAntwort(frage, jetzt), null, `„${frage}" darf kein Smalltalk sein`);
  }
  // Eine lange Nachricht ist nie Smalltalk, egal wie sie anfängt.
  assert.equal(smalltalkAntwort("Hallo, ich hätte gerne einmal eine Übersicht bitte", jetzt), null);
});

/** Die drei Zeilen, die am 2026-08-18 wirklich in `assistant_unanswered` standen.
 *
 * **Sie sind der Grund, dass es diesen Test gibt.** Zwei davon waren genau der
 * Fall, für den die Smalltalk-Schicht am Vortag gebaut worden war — und sie
 * fielen trotzdem durch, weil der Fachwort-Riegel Teilzeichenketten suchte:
 * `karte` traf „Sammelkarten", und `zahl` traf „erzähl". Ein Riegel, der die
 * Fälle sperrt, für die er gebaut wurde, ist keiner.
 */
test("die produktiv gemessenen Fragen werden beantwortet", () => {
  assert.match(smalltalkAntwort("Erzähle mir einen Witz über Sammelkarten", jetzt) ?? "", /Karten|Leserechte/u);
  assert.ok(smalltalkAntwort("Erzähl mir einen Witz", jetzt), "„erzähl\" enthält „zahl\" — das darf nicht sperren");
  assert.ok(smalltalkAntwort("Karl, wie geht's dir heute?", jetzt), "eine Zeitangabe allein macht keine Fachfrage");

  // Die dritte Zeile bleibt eine echte Werkzeuglücke und **muss** zum Planer
  // durchlaufen: Für den Shop-Link gibt es kein Werkzeug, und das gehört als
  // Absage gesagt, nicht als Spruch.
  assert.equal(smalltalkAntwort("Kannst du mir eben den link zum shop geben", jetzt), null);
});

test("ein Fachwort zählt am Wortanfang, nicht irgendwo im Wort", () => {
  // Die Absicherung muss für Zusammensetzungen gelten …
  assert.ok(enthaeltFachwort("wie ist der kartenpreis"));
  assert.ok(enthaeltFachwort("preisvorschlage offen"));
  assert.ok(enthaeltFachwort("100 euro"));
  // … und darf nicht im Inneren eines fremden Wortes zuschlagen.
  assert.ok(!enthaeltFachwort("erzahl mir einen witz"), "„erzähl\" ist kein „zahl\"");
  assert.ok(!enthaeltFachwort("ein witz uber sammelkarten"), "„Sammelkarten\" trägt „karte\" nur im Inneren");
  assert.ok(!enthaeltFachwort("wie geht es dir heute"), "Zeitwörter sperren nicht mehr");
});

test("Smalltalk kostet weder Planer noch Messtabelle", async () => {
  let geplant = 0;
  let aufgezeichnet = 0;
  const manager = new AssistantOrchestrator(
    { plan: async () => { geplant += 1; return { tools: [], reason: "UNSUPPORTED" }; } },
    { execute: async () => { throw new Error("darf nicht laufen"); } },
    { record: async () => { aufgezeichnet += 1; } },
    uhr,
  );

  const antwort = await manager.ask({ message: "danke!", thema: "hell" });
  assert.equal(antwort.status, "ANSWERED");
  assert.equal(antwort.readOnly, true);
  assert.deepEqual(antwort.tools, []);
  assert.deepEqual(antwort.visuals, []);
  // Der Planer wurde nicht gefragt -- ein „danke" darf keinen Modellaufruf
  // kosten. Und in der Messtabelle sollen fehlende *Fachfragen* stehen, nicht
  // die Höflichkeit des Betreibers.
  assert.equal(geplant, 0);
  assert.equal(aufgezeichnet, 0);
});

test("der Rahmen umschließt die Datenzeilen, ohne eine Zahl anzufassen", async () => {
  const ergebnis = availableAssistantResult("new_orders", {
    orders: [{ orderNumber: "BC-1001", totalAmountCents: 14750, currency: "EUR", status: "PAID", paidAt: "2026-08-18T07:00:00.000Z" }],
  }, ["SHOP_DB"], "2026-08-18T07:00:00.000Z");

  const antwort = await orchestrator(["new_orders"], { new_orders: ergebnis }).ask({ message: "Neue Bestellungen?", thema: "hell" });
  const absaetze = antwort.answer.split("\n\n");

  // Der mittlere Absatz ist unverändert das, was der Formatierer liefert.
  assert.match(absaetze[1], /BC-1001/u);
  assert.match(absaetze[1], /147,50/u);
  assert.match(absaetze[1], /Quelle: Shop-Datenbank · Stand:/u);
  // Einleitung und Kommentar stehen daneben und nennen **keine** Zahl -- sonst
  // stünde derselbe Wert zweimal in der Antwort und könnte sich widersprechen.
  assert.doesNotMatch(absaetze[0], /\d/u);
  assert.doesNotMatch(absaetze.at(-1), /\d/u);
  assert.notEqual(absaetze[0], absaetze.at(-1));
  assert.equal(absaetze.length, 3);
});

test("der Schlusskommentar liest die Lage ab, nicht die Werte", () => {
  const leer = availableAssistantResult("new_orders", { orders: [] }, ["SHOP_DB"], null);
  const voll = availableAssistantResult("new_orders", {
    orders: [{ orderNumber: "BC-1", totalAmountCents: 100, currency: "EUR", status: "PAID", paidAt: null }],
  }, ["SHOP_DB"], null);
  const kaputt = unavailableAssistantResult("ebay_messages", "Postfach ist nicht angebunden.", ["EBAY_READ_API"]);

  assert.match(schlusskommentar([leer], "x"), /Ruhige Lage|Stille im Karton|Kasten gerade nicht/u);
  assert.match(schlusskommentar([voll], "x"), /bereit|kümmern|liegen lassen/u);
  // Eine Störung schlägt alles andere: Sie zu verschweigen wäre der schlimmste
  // der drei Fälle.
  assert.match(schlusskommentar([voll, kaputt], "x"), /nicht nachsehen|nicht erreichbar/u);
});

test("die Absage behält ihren Sachtext und ihre drei unterscheidbaren Gründe", async () => {
  for (const [reason, muster] of [
    ["UNSUPPORTED", /kein passendes registriertes Read-only-Werkzeug/u],
    ["MODEL_NOT_CONFIGURED", /noch nicht konfiguriert/u],
    ["MODEL_FAILED", /nicht erreichbar/u],
  ]) {
    const manager = new AssistantOrchestrator(
      { plan: async () => ({ tools: [], reason }) },
      { execute: async () => { throw new Error("darf nicht laufen"); } },
      null,
      uhr,
    );
    const antwort = await manager.ask({ message: "Wie ist das Wetter in Köln?", thema: "hell" });
    assert.match(antwort.answer, muster);
    // Der Spruch steht davor, der Sachtext bleibt vollständig dahinter.
    assert.match(antwort.answer, /^(Da muss ich passen|Puste|Ehrlich währt am längsten)/u);
    assert.match(antwort.answer, /Verkäufen|Bestellungen/u);
  }
});

test("die Einleitung kündigt nur an, was auch kommt", () => {
  // Ein einzelnes Thema darf seinen eigenen Ton haben.
  assert.match(einleitung(["sales_overview"], "x"), /Kasse|Schatzkiste|Geld/u);
  // Gemischte Werkzeuge nicht: „Ab in die Schatzkiste" über einer Antwort aus
  // Umsatz *und* Lagerbestand würde die Hälfte falsch ankündigen.
  const gemischt = einleitung(["sales_overview", "inventory_review"], "x");
  assert.doesNotMatch(gemischt, /Kasse|Schatzkiste/u);
  assert.ok(absageEinleitung("x").length > 0);
});

test("jedes animierte Ereignis wird auch kommentiert", async () => {
  const [page, persona] = await Promise.all([
    read("avatar/BrandyCards.Desktop/MainPage.xaml.cs"),
    read("avatar/BrandyCards.Desktop/KarlPersona.cs"),
  ]);

  // Die Ereignisarten stehen in der Animationstabelle. Eine, die die Figur
  // bewegt, aber stumm bleibt, wäre genau die halbe Sache, die dieser Auftrag
  // beseitigt hat.
  const arten = [...page.matchAll(/\["([A-Z_]+)"\] = new\(/gu)].map((treffer) => treffer[1]);
  assert.ok(arten.length >= 4, "die Animationstabelle sollte die Shop-Ereignisse führen");
  for (const art of arten) {
    assert.match(persona, new RegExp(`"${art}" =>`, "u"), `${art} braucht einen Kommentar`);
  }

  // Ein Kommentar je Art und Abruf, nicht je Ereignis: Drei eingegangene
  // Vorschläge sind ein Anlass, nicht drei Sprechblasen.
  assert.match(page, /new HashSet<string>\(StringComparer\.OrdinalIgnoreCase\)/u);
  assert.match(page, /if \(kommentiert\.Add\(avatarEvent\.EventType\)\) KommentiereEreignis\(avatarEvent\.EventType\)/u);
  // Bei zugeklapptem Panel muss der Hinweis sichtbar werden, sonst spricht er
  // in einen geschlossenen Schrank.
  assert.match(page, /if \(!_assistantPanelExpanded\) LauncherSubtitleTextBlock\.Text = KarlPersona\.LauncherHatNeues;/u);
  // Die Begrüßung steht vor dem ersten Kommentar.
  assert.match(page, /EnsureConversationInitialized\(\);\s*AddConversationMessage\(AssistantName, kommentar, isUser: false\);/u);
});

test("ein Ereigniskommentar behauptet weder Karte noch Betrag noch Anzahl", async () => {
  const persona = await read("avatar/BrandyCards.Desktop/KarlPersona.cs");
  const anfang = persona.indexOf("internal static string? Ereigniskommentar");
  const ende = persona.indexOf("LauncherHatNeues");
  assert.ok(anfang > 0 && ende > anfang);
  const block = persona.slice(anfang, ende);

  // **Das Ereignis trägt nur Typ und Zeitpunkt** — keinen Kartennamen, keinen
  // Betrag. Eine Zahl im Kommentar wäre deshalb entweder erfunden oder eine
  // Ereigniszahl, die als Bestandszahl gelesen würde: Fünf eingegangene
  // Vorschläge sind nicht fünf offene.
  const texte = [...block.matchAll(/"([^"]{12,})"/gu)].map((treffer) => treffer[1]);
  assert.ok(texte.length >= 8, "je Ereignisart sollten mehrere Varianten dastehen");
  for (const text of texte) {
    assert.doesNotMatch(text, /\d/u, `„${text}" nennt eine Zahl`);
    assert.doesNotMatch(text, /€|EUR/u, `„${text}" nennt einen Betrag`);
  }
});

test("die Persona formatiert keine Daten und ruft kein Modell", async () => {
  const quelle = await read("lib/assistant/persona.ts");
  // Nur der Code zaehlt: Die Kopfdokumentation *nennt* `Math.random`, um zu
  // begruenden, warum es hier nicht steht.
  const code = quelle.split("\n").filter((zeile) => !/^\s*(\/\/|\*|\/\*)/u.test(zeile)).join("\n");
  // Diese Schicht darf nichts von dem tun, wovon die Antwort ihre
  // Verlässlichkeit hat: keine Zahl formatieren, kein Modell fragen, nichts
  // schreiben.
  assert.doesNotMatch(code, /NumberFormat|toFixed|fetch\(|openai|OPENAI/iu);
  // Und der Zufall bleibt draußen, sonst ist keine Antwort mehr prüfbar.
  assert.doesNotMatch(code, /Math\.random/u);
});
