import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  absageEinleitung,
  einleitung,
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
