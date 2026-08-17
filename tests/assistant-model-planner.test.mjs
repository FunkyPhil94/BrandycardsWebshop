import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { HybridAssistantPlanner, RuleBasedAssistantPlanner, OpenAIResponsesAssistantPlanner } =
  await import("../lib/assistant/planner.ts");
const { AssistantOrchestrator } = await import("../lib/assistant/orchestrator.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const stumm = async (fn) => {
  const vorher = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = vorher;
  }
};

const kaputt = (fehler) => ({ async plan() { throw fehler; } });

test("ein Fehlschlag des Modells versenkt nicht die ganze Anfrage", async () => {
  // Ungefangen erzeugte der Wurf ein 503 fuer die komplette Anfrage -- also
  // weniger, als ein gar nicht eingerichtetes Modell liefert.
  const plan = await stumm(() => new HybridAssistantPlanner(
    new RuleBasedAssistantPlanner(),
    kaputt(new Error("OpenAI-Planung fehlgeschlagen (HTTP 401).")),
  ).plan("Erzähl mir etwas über den Mond."));

  assert.deepEqual(plan, { tools: [], reason: "MODEL_FAILED" });
});

test("MODEL_FAILED und MODEL_NOT_CONFIGURED bleiben unterscheidbar", async () => {
  // Fuer den Nutzer aehnlich, fuer den Betreiber gegensaetzlich: nichts
  // eingerichtet gegen eingerichtet und kaputt.
  const ohneModell = await new HybridAssistantPlanner(new RuleBasedAssistantPlanner(), null)
    .plan("Erzähl mir etwas über den Mond.");
  assert.equal(ohneModell.reason, "MODEL_NOT_CONFIGURED");

  const mitKaputtemModell = await stumm(() => new HybridAssistantPlanner(
    new RuleBasedAssistantPlanner(),
    kaputt(new Error("boom")),
  ).plan("Erzähl mir etwas über den Mond."));
  assert.equal(mitKaputtemModell.reason, "MODEL_FAILED");
});

test("bekannte Fragen erreichen den Modellpfad nie", async () => {
  // Das ist die eigentliche Absicherung: Ein Anbieterausfall kann Fragen, die
  // der Regelplaner kennt, gar nicht treffen.
  let gefragt = 0;
  const planer = new HybridAssistantPlanner(new RuleBasedAssistantPlanner(), {
    async plan() { gefragt += 1; throw new Error("darf nicht aufgerufen werden"); },
  });

  for (const frage of [
    "Welche Bestellungen sind neu?",
    "Was wurde zuletzt verkauft?",
    "Wie viel Umsatz hatte ich in den letzten 7 Tagen?",
    "Welcher Bestand ist knapp?",
  ]) {
    const plan = await planer.plan(frage);
    assert.ok(plan.tools.length > 0, frage);
    assert.equal(plan.reason, "READY", frage);
  }
  assert.equal(gefragt, 0, "der Modellpfad wurde trotz bekannter Frage betreten");
});

test("die Antwort bei MODEL_FAILED nennt kein Anbieterdetail", async () => {
  const orchestrator = new AssistantOrchestrator(
    { async plan() { return { tools: [], reason: "MODEL_FAILED" }; } },
    { async execute() { throw new Error("darf nicht ausgefuehrt werden"); } },
  );
  const antwort = await orchestrator.ask({ message: "Erzähl mir etwas über den Mond." });

  // **FAILED, nicht UNSUPPORTED.** Ob die Frage beantwortbar waere, ist
  // unbekannt -- sie als unbeantwortbar auszuweisen waere eine Behauptung ueber
  // etwas, das nie geprueft wurde. Denselben Unterschied halten
  // `AssistantSalesChannel.available` und die UNAVAILABLE-Codes auseinander.
  assert.equal(antwort.status, "FAILED");
  // Sie sagt, dass es voruebergehend ist, und dass Bekanntes weiter geht.
  assert.match(antwort.answer, /nicht erreichbar/u);
  assert.match(antwort.answer, /ist damit offen/u);
  assert.match(antwort.answer, /Bekannte Fragen funktionieren unverändert/u);
  // Und sie verraet nichts ueber Anbieter, Schluessel oder Statuscode.
  assert.doesNotMatch(antwort.answer, /OpenAI|HTTP|401|Schlüssel|Token|Guthaben/iu);
  assert.deepEqual(antwort.tools, []);
});

test("der Fehlschlag wird serverseitig protokolliert, damit er auffindbar bleibt", async () => {
  const meldungen = [];
  const vorher = console.error;
  console.error = (...args) => meldungen.push(args.map(String).join(" "));
  try {
    await new HybridAssistantPlanner(
      new RuleBasedAssistantPlanner(),
      kaputt(new Error("OpenAI-Planung fehlgeschlagen (HTTP 429).")),
    ).plan("Erzähl mir etwas über den Mond.");
  } finally {
    console.error = vorher;
  }

  assert.equal(meldungen.length, 1);
  assert.match(meldungen[0], /assistant model planner failed/u);
  // Der Grund muss im Protokoll erkennbar sein -- sonst kann der Betreiber
  // falschen Schluessel, erschoepftes Guthaben und Modellnamen nicht trennen.
  assert.match(meldungen[0], /HTTP 429/u);
});

test("die Anfrageform entspricht der Responses-API und nicht der Chat-API", async () => {
  // Die Responses-API erwartet **flache** Tool-Definitionen; die
  // verschachtelte `function`-Form der Chat-Completions-API ist die haeufigste
  // Ursache fuer "invalid parameter".
  const planner = await read("lib/assistant/planner.ts");
  assert.match(planner, /type: "function",\s*\n\s*name: tool\.name/u);
  assert.doesNotMatch(planner, /function: \{\s*name/u);
  assert.match(planner, /item\.type !== "function_call"/u);
  // Das Modell darf ausschliesslich Werkzeuge waehlen, keinen Text erzeugen.
  assert.match(planner, /Schreibe keine Antwort/u);
  assert.match(planner, /Erzeuge kein SQL/u);
});

test("das Vorgabemodell ist gesetzt und überschreibbar", async () => {
  const [planner, beispiel] = await Promise.all([read("lib/assistant/planner.ts"), read(".env.example")]);
  // gpt-5.6-luna ist die kostenoptimierte Variante -- fuer einen Planer, der
  // nur Werkzeugnamen waehlt, die sachlich richtige Wahl.
  assert.match(planner, /const DEFAULT_OPENAI_MODEL = "gpt-5\.6-luna";/u);
  assert.match(planner, /process\.env\.OPENAI_ASSISTANT_MODEL\?\.trim\(\) \|\| DEFAULT_OPENAI_MODEL/u);
  assert.match(beispiel, /^OPENAI_API_KEY=$/mu);
  assert.doesNotMatch(beispiel, /NEXT_PUBLIC_OPENAI/u);
  // Der Zeitrahmen des Modells muss unter dem des Desktops bleiben, sonst
  // bricht dort ab, was hier noch beantwortet wuerde.
  const modell = Number(planner.match(/MODEL_TIMEOUT_MS = (\d+)_000/u)?.[1]);
  const desktop = Number(
    (await read("avatar/BrandyCards.Desktop/AssistantConversationService.cs"))
      .match(/RequestTimeout = TimeSpan\.FromSeconds\((\d+)\)/u)?.[1],
  );
  assert.ok(modell > 0 && modell < desktop, `Modell ${modell}s gegen Desktop ${desktop}s`);
});

test("der OpenAI-Planer selbst bleibt unverändert streng bei der Antwortprüfung", async () => {
  // Ein erfundener Werkzeugname darf nicht durchrutschen; das galt schon in
  // Phase 10 und muss die Aktivierung ueberleben.
  const planner = new OpenAIResponsesAssistantPlanner("test-key", "gpt-5.6-luna", async () =>
    new Response(JSON.stringify({ output: [{ type: "function_call", name: "drop_everything", arguments: "{}" }] }), { status: 200 }));
  await assert.rejects(() => planner.plan("egal"), /nicht registriertes Assistant-Werkzeug/u);
});
