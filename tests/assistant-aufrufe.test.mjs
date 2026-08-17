import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { RuleBasedAssistantPlanner } = await import("../lib/assistant/planner.ts");
const { ASSISTANT_TOOL_NAMES, ASSISTANT_TOOL_DEFINITIONS } = await import("../lib/assistant/contracts.ts");

const JETZT = new Date("2026-08-17T18:00:00.000Z");
const planer = new RuleBasedAssistantPlanner(() => JETZT);
const werkzeuge = async (frage) => (await planer.plan(frage)).tools;

test("die Frage nach den Shop-Aufrufen trifft das neue Werkzeug", async () => {
  for (const frage of [
    "Wie viele Aufrufe hatte unser Webshop in den letzten 7 Tagen?",
    "Wie viele Besucher hatte der Shop insgesamt?",
    "Wie viele Seitenaufrufe gab es gestern?",
  ]) {
    const namen = (await werkzeuge(frage)).map((w) => w.tool);
    assert.ok(namen.includes("traffic_overview"), `„${frage}" muss die Aufrufe abfragen, ergab: ${namen.join(", ")}`);
  }
});

test("die Rangliste der Angebote bleibt eine andere Frage", async () => {
  // **Beide Fragen benutzen das Wort „Aufruf".** Unterschieden wird an der
  // Mengenfrage und am Ort, nicht am Wort selbst -- sonst beantwortete die eine
  // Frage nebenbei die andere.
  const namen = (await werkzeuge("Welche eBay-Angebote wurden am häufigsten angesehen?")).map((w) => w.tool);
  assert.ok(namen.includes("ebay_most_viewed"));
  assert.ok(!namen.includes("traffic_overview"), "eine Rangliste ist keine Summe");
});

test("der Zeitraum wird auch bei den Aufrufen ausgewertet", async () => {
  const [aufrufe] = (await werkzeuge("Wie viele Aufrufe hatte der Shop in den letzten 14 Tagen?"))
    .filter((w) => w.tool === "traffic_overview");
  assert.equal(aufrufe.days, 14);

  // Dieselbe Datumserkennung wie bei den Verkaeufen -- sie steht jetzt einmal
  // oben im Planer statt zweimal nebeneinander.
  const [spanne] = (await werkzeuge("Wie viele Besucher hatte der Webshop vom 10.8 bis 12.8?"))
    .filter((w) => w.tool === "traffic_overview");
  assert.equal(spanne.bis, "2026-08-12");
  assert.equal(spanne.days, 3);
});

test("das Werkzeug ist vollstaendig registriert", async () => {
  assert.ok(ASSISTANT_TOOL_NAMES.includes("traffic_overview"));
  assert.ok(ASSISTANT_TOOL_DEFINITIONS.some((t) => t.name === "traffic_overview"));
  // Rein lesend, wie jedes Assistant-Werkzeug.
  const quelle = await readFile(new URL("../lib/assistant/tools/traffic.ts", import.meta.url), "utf8");
  for (const schreibend of [/db\.insert\(/u, /db\.update\(/u, /db\.delete\(/u]) {
    assert.doesNotMatch(quelle, schreibend, "kein Schreibpfad im Assistenten");
  }
});

test("Shop- und eBay-Aufrufe werden nie addiert", async () => {
  // Zwei verschiedene Orte. Eine Summe daraus benennt nichts -- und sie waere
  // die Sorte Zahl, die niemand als falsch erkennt.
  const formatter = await readFile(new URL("../lib/assistant/response-formatter.ts", import.meta.url), "utf8");
  const block = formatter.slice(formatter.indexOf('case "traffic_overview"'), formatter.indexOf('case "assistant_statistics"'));
  assert.match(block, /getrennt gezählt und nicht addierbar/u);
  assert.doesNotMatch(block, /shop\.fenster \+ .*ebay/u);
});

test("die Antwort nennt den Messbeginn und das fehlende eBay-Gesamt", async () => {
  const formatter = await readFile(new URL("../lib/assistant/response-formatter.ts", import.meta.url), "utf8");
  const block = formatter.slice(formatter.indexOf('case "traffic_overview"'), formatter.indexOf('case "assistant_statistics"'));
  // Ohne den Messbeginn liest sich „30 Tage: 40" als schwacher Monat statt als
  // junger Zaehler.
  assert.match(block, /Zähler läuft erst seit/u);
  // Und ohne den Hinweis wirkt die fehlende eBay-Gesamtzahl wie ein Fehler.
  assert.match(block, /kein „insgesamt“/u);
});
