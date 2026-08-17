import assert from "node:assert/strict";
import test from "node:test";

const { RuleBasedAssistantPlanner, requestedRange, findeDaten } =
  await import("../lib/assistant/planner.ts");
const { parseAssistantToolInput, istTagesdatum } = await import("../lib/assistant/contracts.ts");
const { zeitraumSatz } = await import("../lib/assistant/response-formatter.ts");

// Der Tag, an dem der Betreiber den Befund gemeldet hat.
const JETZT = new Date("2026-08-17T10:00:00.000Z");
const planer = new RuleBasedAssistantPlanner(() => JETZT);

test("die Frage des Betreibers trifft genau den 10. bis 12. August", async () => {
  // **Der gemeldete Fehler:** Diese Frage wurde mit „Verkäufe der letzten 30
  // Tage" beantwortet -- der genannte Zeitraum kam in der Antwort nicht vor.
  const plan = await planer.plan("Zeig mir den Umsatz vom 10.8 bis 12.8");
  const uebersicht = plan.tools.find((tool) => tool.tool === "sales_overview");
  assert.ok(uebersicht, "die Frage muss die Verkaufsübersicht auslösen");
  assert.equal(uebersicht.bis, "2026-08-12");
  assert.equal(uebersicht.days, 3, "beide Enden zählen mit");
});

test("die Erkennung läuft auf dem rohen Text, nicht auf dem normalisierten", () => {
  // `normalizeQuestion` ersetzt Punkte durch Leerzeichen und macht aus „10.8"
  // ein „10 8". **Genau daran scheiterte die Erkennung.**
  assert.deepEqual(findeDaten("vom 10.8 bis 12.8", JETZT), ["2026-08-10", "2026-08-12"]);
  assert.deepEqual(findeDaten("vom 10.08.2026 bis 12.08.2026", JETZT), ["2026-08-10", "2026-08-12"]);
  assert.deepEqual(findeDaten("zwischen dem 1. August und dem 5. August", JETZT), ["2026-08-01", "2026-08-05"]);
});

test("ein Datum ohne Jahr meint nie die Zukunft", () => {
  // Im August nach dem „20.12." gefragt: gemeint ist der vergangene Dezember.
  // Ein Datum in der Zukunft wäre bei einer Frage nach Verkäufen immer die
  // falsche Lesart -- dort steht nichts.
  assert.deepEqual(findeDaten("am 20.12.", JETZT), ["2025-12-20"]);
  assert.deepEqual(findeDaten("am 10.8.", JETZT), ["2026-08-10"]);
});

test("ein einzelner Tag ist ein Tag, keine Spanne bis heute", () => {
  assert.deepEqual(requestedRange("Was habe ich am 12.8. verkauft?", JETZT), { days: 1, bis: "2026-08-12" });
});

test("ein Ende in der Zukunft wird auf heute gezogen", () => {
  // Sonst hingen leere Tage hinten an, die im Diagramm wie verkaufsfreie Tage
  // aussähen.
  assert.deepEqual(requestedRange("vom 15.8. bis 31.12.2026", JETZT), { days: 3, bis: "2026-08-17" });
});

test("ein unmögliches Datum wird nicht stillschweigend weitergerollt", () => {
  // `new Date("2026-02-31")` wirft nicht, sondern ergibt den 3. März.
  assert.deepEqual(findeDaten("am 31.2.2026", JETZT), []);
  assert.equal(istTagesdatum("2026-02-31"), false);
  assert.equal(istTagesdatum("2026-02-28"), true);
});

test("ohne Datum bleibt alles beim rollenden Fenster", async () => {
  assert.equal(requestedRange("Wie war der Umsatz?", JETZT), undefined);
  const plan = await planer.plan("Zeig mir den Umsatz der letzten 14 Tage");
  const uebersicht = plan.tools.find((tool) => tool.tool === "sales_overview");
  assert.equal(uebersicht.days, 14);
  assert.equal(uebersicht.bis, undefined, "kein Ende heißt: bis jetzt");
});

test("bis wird geprüft, nicht zurechtgebogen", () => {
  assert.throws(() => parseAssistantToolInput({ tool: "sales_overview", limit: 10, bis: "12.8.2026" }),
    /JJJJ-MM-TT/u);
  // Ein ungültiges Ende als „jetzt" durchgehen zu lassen beantwortete eine
  // andere Frage als die gestellte, ohne dass es jemand bemerkt.
  assert.throws(() => parseAssistantToolInput({ tool: "sales_overview", limit: 10, bis: "2026-13-01" }));
  assert.deepEqual(
    parseAssistantToolInput({ tool: "sales_overview", limit: 10, days: 3, bis: "2026-08-12" }),
    { tool: "sales_overview", limit: 10, days: 3, bis: "2026-08-12" },
  );
});

test("die Antwort nennt die Spanne statt „letzte N Tage“", () => {
  // Ein abgeschlossenes Fenster: Ende liegt in der Vergangenheit.
  assert.equal(
    zeitraumSatz("2026-08-10T00:00:00.000Z", "2026-08-13T00:00:00.000Z", 3, true),
    "Verkäufe vom 10.08.2026 bis 12.08.2026",
  );
  // **Nicht aus der Uhr erschlossen.** Dieselben Daten ohne genannte Spanne
  // bleiben ein rollendes Fenster -- sonst kippte die Aussage allein durch
  // Zeitablauf, und ein Fenster, das zufällig gestern endet, wäre von einer
  // genannten Spanne nicht zu unterscheiden.
  assert.equal(zeitraumSatz("2026-08-10T00:00:00.000Z", "2026-08-13T00:00:00.000Z", 3, false),
    "Verkäufe der letzten 3 Tage");
  // Eine ältere Werkzeugfassung schickt kein `until` -- das ist kein Fehler.
  assert.equal(zeitraumSatz("2026-08-10T00:00:00.000Z", undefined, 30, true), "Verkäufe der letzten 30 Tage");
});
