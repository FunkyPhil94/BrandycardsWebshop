import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { istAufzeichnungswuerdig, normalisiereFrage, zeichneUnbeantworteteFrageAuf } =
  await import("../lib/assistant/question-log.ts");
const { AssistantOrchestrator } = await import("../lib/assistant/orchestrator.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function sammler() {
  const eintraege = [];
  return { eintraege, async record(e) { eintraege.push(e); } };
}

const stumm = async (fn) => {
  const vorher = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = vorher;
  }
};

test("aufgezeichnet wird die fehlgeschlagene Zuordnung, nicht die Datenbeschaffung", () => {
  // Ein Plan mit Werkzeugen ist keine Luecke, auch wenn die Ausfuehrung
  // anschliessend scheitert -- dafuer gibt es die Betriebsalarme.
  assert.equal(istAufzeichnungswuerdig("UNSUPPORTED"), true);
  assert.equal(istAufzeichnungswuerdig("MODEL_NOT_CONFIGURED"), true);
  assert.equal(istAufzeichnungswuerdig("MODEL_FAILED"), true);
  assert.equal(istAufzeichnungswuerdig("READY"), false);
});

test("die Frage wird auf eine auswertbare Zeile gebracht", () => {
  assert.equal(normalisiereFrage("  Wie   geht\nes\tdem Laden?  "), "Wie geht es dem Laden?");
  assert.equal(normalisiereFrage("   "), null, "eine Zeile ohne Inhalt ist nichts Auswertbares");
  assert.equal(normalisiereFrage("x".repeat(1500)).length, 1000, "gekuerzt auf die Eingabegrenze");
});

test("nur unbeantwortete Fragen werden aufgezeichnet", async () => {
  const s = sammler();
  await zeichneUnbeantworteteFrageAuf(s, "Welche Bestellungen sind neu?", "READY");
  assert.deepEqual(s.eintraege, [], "eine beantwortete Frage gehoert nicht in die Messtabelle");

  await zeichneUnbeantworteteFrageAuf(s, "Erzähl mir einen Witz.", "UNSUPPORTED");
  assert.deepEqual(s.eintraege, [{ question: "Erzähl mir einen Witz.", reason: "UNSUPPORTED" }]);
});

test("der Grund wird mitgeschrieben, weil er Lücke von Störung trennt", async () => {
  const s = sammler();
  await zeichneUnbeantworteteFrageAuf(s, "Frage A", "UNSUPPORTED");
  await zeichneUnbeantworteteFrageAuf(s, "Frage B", "MODEL_FAILED");
  // Ohne diese Unterscheidung wuerde ein nicht erreichbares Modell als
  // Werkzeugbedarf gezaehlt -- und man baute Werkzeuge gegen eine Stoerung.
  assert.deepEqual(s.eintraege.map((e) => e.reason), ["UNSUPPORTED", "MODEL_FAILED"]);
});

test("ein Schreibfehler beim Aufzeichnen darf die Antwort nicht gefährden", async () => {
  // Die Messung ist Zubehoer, nicht Zweck. Ein D1-Fehler darf aus einer
  // gueltigen Auskunft keinen Fehler machen.
  const kaputt = { async record() { throw new Error("D1 nicht erreichbar"); } };
  await stumm(() => zeichneUnbeantworteteFrageAuf(kaputt, "Frage", "UNSUPPORTED"));
});

test("ohne Recorder verhält sich alles wie vorher", async () => {
  await zeichneUnbeantworteteFrageAuf(null, "Frage", "UNSUPPORTED");
});

test("der Orchestrator zeichnet auf und antwortet trotzdem unverändert", async () => {
  const s = sammler();
  const orchestrator = new AssistantOrchestrator(
    { async plan() { return { tools: [], reason: "UNSUPPORTED" }; } },
    { async execute() { throw new Error("darf nicht ausgefuehrt werden"); } },
    s,
  );
  const antwort = await orchestrator.ask({ message: "Erzähl mir einen Witz über Sammelkarten." });

  assert.equal(antwort.status, "UNSUPPORTED");
  assert.deepEqual(s.eintraege, [{ question: "Erzähl mir einen Witz über Sammelkarten.", reason: "UNSUPPORTED" }]);
});

test("eine beantwortete Frage hinterlässt keine Spur in der Messtabelle", async () => {
  const s = sammler();
  const orchestrator = new AssistantOrchestrator(
    { async plan() { return { tools: [{ tool: "new_orders", limit: 10 }], reason: "READY" }; } },
    { async execute() { return { tool: "new_orders", status: "AVAILABLE", readOnly: true, sources: ["SHOP_DB"], freshness: null, data: { definition: "x", orders: [] } }; } },
    s,
  );
  const antwort = await orchestrator.ask({ message: "Welche Bestellungen sind neu?" });

  assert.equal(antwort.status, "ANSWERED");
  assert.deepEqual(s.eintraege, []);
});

test("der Assistant-Code bleibt schreibfrei; die Messung schreibt die Route", async () => {
  // **Ein Waechter aus Phase 4 verlangt das, und er wurde nicht gelockert.** Er
  // haelt fest, dass Planer, Orchestrator und Server-Zusammenbau keine
  // Schreibpfade enthalten -- absolut, auch fuer die eigene Messtabelle. Der
  // Schreibvorgang steht deshalb in der Route, die den Datenbankzugang ohnehin
  // besitzt; der Assistant-Code kennt nur die Schnittstelle.
  const [server, orchestrator, route, registry] = await Promise.all([
    read("lib/assistant/server-orchestrator.ts"),
    read("lib/assistant/orchestrator.ts"),
    read("app/api/avatar/device/assistant/route.ts"),
    read("lib/assistant/server-tool-registry.ts"),
  ]);

  for (const [name, quelle] of [["server-orchestrator.ts", server], ["orchestrator.ts", orchestrator], ["server-tool-registry.ts", registry]]) {
    assert.doesNotMatch(quelle, /\.(insert|update|delete)\s*\(/u, `${name} muss schreibfrei bleiben`);
  }

  // Und in der Route genau eine Schreibstelle: die eigene Messtabelle.
  assert.match(route, /insert\(assistantUnanswered\)/u);
  assert.equal((route.match(/\.(insert|update|delete)\s*\(/gu) ?? []).length, 1);
});
