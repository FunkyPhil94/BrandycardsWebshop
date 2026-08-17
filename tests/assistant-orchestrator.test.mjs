import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  ASSISTANT_TOOL_NAMES,
  AssistantRequestError,
  availableAssistantResult,
  parseAssistantQuestionInput,
  unavailableAssistantResult,
} = await import("../lib/assistant/contracts.ts");
const {
  HybridAssistantPlanner,
  OpenAIResponsesAssistantPlanner,
  RuleBasedAssistantPlanner,
  parseOpenAIPlannedTools,
} = await import("../lib/assistant/planner.ts");
const { AssistantOrchestrator } = await import("../lib/assistant/orchestrator.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("freie Assistant-Fragen akzeptieren ausschließlich ein begrenztes message-Feld", () => {
  // Seit dem 2026-08-17 kommt das Darstellungsthema mit, weil ein serverseitig
  // gezeichnetes Bild nicht auf `prefers-color-scheme` reagieren kann. Fehlt es,
  // gilt „hell" — ältere Desktop-Fassungen schicken es nicht.
  assert.deepEqual(parseAssistantQuestionInput({ message: "  Welche Bestellungen sind neu?  " }), { message: "Welche Bestellungen sind neu?", thema: "hell" });
  assert.deepEqual(parseAssistantQuestionInput({ message: "Bestellungen", thema: "dunkel" }), { message: "Bestellungen", thema: "dunkel" });
  // Ein unbekanntes Thema wird abgewiesen, nicht zurechtgebogen: Ein stiller
  // Rückfall auf „hell" ließe einen dunklen Desktop dauerhaft falsch gezeichnete
  // Bilder zeigen, ohne dass jemand erfährt, warum.
  assert.throws(() => parseAssistantQuestionInput({ message: "Bestellungen", thema: "bunt" }), /thema muss hell oder dunkel sein/u);
  assert.throws(() => parseAssistantQuestionInput({ tool: "latest_sale" }), AssistantRequestError);
  assert.throws(() => parseAssistantQuestionInput({ message: "Bestellungen", sql: "SELECT * FROM orders" }), /Nicht unterstützte Felder/u);
  assert.throws(() => parseAssistantQuestionInput({ message: " " }), /nicht leer/u);
  assert.throws(() => parseAssistantQuestionInput({ message: "x".repeat(1001) }), /höchstens 1000/u);
});

test("der lokale Planer routet die sechs Phase-4-Beispiele auf die geschlossene Registry", async () => {
  const planner = new RuleBasedAssistantPlanner();
  const cases = [
    ["Welche Karte wurde zuletzt verkauft?", ["latest_sale"]],
    ["Welche Karte wurde zuletzt eingestellt?", ["latest_listing"]],
    // Seit Phase 8 gibt es Preisvorschläge an zwei Stellen. Wer ohne Angabe
    // der Seite fragt, meint beide — nur eine zu beantworten verschwiege die
    // andere stillschweigend.
    ["Welche offenen Preisvorschläge gibt es?", ["open_shop_offers", "ebay_buyer_offers"]],
    ["Welche Bestellungen sind neu?", ["new_orders"]],
    ["Welche Lagerbestände sind kritisch?", ["inventory_review"]],
    ["Welche eBay-Daten sind derzeit nicht verfügbar?", ["ebay_most_viewed", "ebay_messages", "ebay_buyer_offers"]],
  ];
  for (const [question, expected] of cases) {
    const plan = await planner.plan(question);
    assert.deepEqual(plan.tools.map((item) => item.tool), expected, question);
    assert.equal(plan.reason, "READY");
  }
});

test("zusammengesetzte Fragen wählen mehrere Werkzeuge genau einmal und übernehmen ein sicheres Limit", async () => {
  const plan = await new RuleBasedAssistantPlanner().plan("Zeig mir die letzten 5 Bestellungen und die offenen Preisvorschläge sowie die Bestellungen.");
  assert.deepEqual(plan.tools, [
    { tool: "open_shop_offers", limit: 5 },
    { tool: "ebay_buyer_offers", limit: 5 },
    { tool: "new_orders", limit: 5 },
  ]);
});

test("eBay-Käuferangebote werden nicht fälschlich als Shop-Preisvorschläge geroutet", async () => {
  // Bis Phase 7 endete diese Frage ausdrücklich ohne Werkzeug: Es gab keine
  // Quelle für eBay-Preisvorschläge, und sie auf die Shop-Tabelle umzubiegen
  // hätte fremde Zahlen als eigene ausgegeben. Seit Phase 8 gibt es die Quelle.
  // Die Zusicherung bleibt dieselbe — die Shop-Tabelle darf es nicht sein.
  const plan = await new RuleBasedAssistantPlanner().plan("Welche eBay-Preisvorschläge sind offen?");
  assert.deepEqual(plan.tools, [{ tool: "ebay_buyer_offers", limit: 10 }]);
  assert.equal(plan.reason, "READY");
});

test("der Hybridplaner nutzt das Modell nur für lokal nicht sicher zuordenbare Fragen", async () => {
  const modelCalls = [];
  const planner = new HybridAssistantPlanner(new RuleBasedAssistantPlanner(), {
    async plan(message) {
      modelCalls.push(message);
      return { tools: [{ tool: "latest_sale", limit: 10 }], reason: "READY" };
    },
  });
  assert.equal((await planner.plan("Welche Bestellungen sind neu?")).tools[0].tool, "new_orders");
  assert.deepEqual(modelCalls, []);
  assert.equal((await planner.plan("Was ging als allerletztes über den virtuellen Ladentisch?")).tools[0].tool, "latest_sale");
  assert.equal(modelCalls.length, 1);
});

test("ohne Modellkonfiguration bleiben unbekannte Formulierungen ausdrücklich unbeantwortet", async () => {
  const planner = new HybridAssistantPlanner(new RuleBasedAssistantPlanner(), null);
  assert.deepEqual(await planner.plan("Erzähl mir etwas Überraschendes."), { tools: [], reason: "MODEL_NOT_CONFIGURED" });
});

test("Modell-Tool-Aufrufe werden erneut gegen Namen, Felder und Grenzen validiert", () => {
  assert.deepEqual(parseOpenAIPlannedTools({ output: [
    { type: "reasoning" },
    { type: "function_call", name: "new_orders", arguments: '{"limit":4}' },
    { type: "function_call", name: "new_orders", arguments: '{"limit":4}' },
  ] }), [{ tool: "new_orders", limit: 4 }]);
  assert.throws(() => parseOpenAIPlannedTools({ output: [
    { type: "function_call", name: "run_sql", arguments: '{"limit":1}' },
  ] }), /nicht registriertes/u);
  assert.throws(() => parseOpenAIPlannedTools({ output: [
    { type: "function_call", name: "new_orders", arguments: '{"limit":1,"sql":"DELETE FROM orders"}' },
  ] }), /Nicht unterstützte Felder/u);
  assert.throws(() => parseOpenAIPlannedTools({ output: [
    { type: "function_call", name: "new_orders", arguments: '{"limit":21}' },
  ] }), /zwischen 1 und 20/u);
});

test("der OpenAI-Planer stellt nur strikte Registry-Funktionen bereit und übernimmt keinen Modelltext", async () => {
  let requestBody;
  const planner = new OpenAIResponsesAssistantPlanner("server-secret", "test-model", async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      output: [
        { type: "message", content: [{ type: "output_text", text: "Erfundene Antwort" }] },
        { type: "function_call", name: "inventory_review", arguments: '{"limit":3}' },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.deepEqual(await planner.plan("Was ist knapp?"), { tools: [{ tool: "inventory_review", limit: 3 }], reason: "READY" });
  assert.equal(requestBody.store, false);
  // Gegen die Registry gezählt, nicht gegen eine Zahl: Ein neues Werkzeug soll
  // hier nichts brechen, ein am Modell vorbei angebotenes schon.
  assert.equal(requestBody.tools.length, ASSISTANT_TOOL_NAMES.length);
  assert.deepEqual(requestBody.tools.map((tool) => tool.name), [...ASSISTANT_TOOL_NAMES]);
  assert.ok(requestBody.tools.every((tool) => tool.strict === true && tool.parameters.additionalProperties === false));
  // Drei Parameter: `limit` (Ergebniszahl), `days` (Fensterlaenge) und seit dem
  // 2026-08-17 `bis` (Fensterende), beides nur von sales_overview ausgewertet.
  // Die Liste ist hier festgenagelt, damit kein Freitextfeld dazukommt, ueber
  // das eine Abfrage von aussen hereinkaeme.
  assert.ok(requestBody.tools.every((tool) => Object.keys(tool.parameters.properties).join(",") === "limit,days,bis"));
  assert.ok(requestBody.tools.every((tool) => tool.parameters.properties.days.maximum === 90));
  // `bis` ist die einzige Zeichenkette im Schema und deshalb auf die
  // Datumsform festgelegt -- ein freies Textfeld waere genau das, was dieser
  // Test verhindern soll. Die serverseitige Pruefung gilt zusaetzlich.
  assert.ok(requestBody.tools.every((tool) => tool.parameters.properties.bis.pattern === "^\\d{4}-\\d{2}-\\d{2}$"));
});

test("der Orchestrator erzeugt Antworten nur aus Tool-Daten und nennt Quelle sowie Datenstand", async () => {
  const calls = [];
  const orchestrator = new AssistantOrchestrator({
    async plan() { return { tools: [{ tool: "latest_sale", limit: 10 }], reason: "READY" }; },
  }, {
    async execute(input) {
      calls.push(input);
      return availableAssistantResult("latest_sale", {
        sale: {
          source: "EBAY", reference: "42", status: "SOLD", soldAt: "2026-08-16T10:00:00.000Z",
          detailsComplete: false,
          items: [{ productId: null, title: "Testkarte", quantity: null, amountCents: null, currency: "EUR" }],
        },
      }, ["EBAY_WEBHOOK"], "2026-08-16T10:00:00.000Z");
    },
  });
  const response = await orchestrator.ask({ message: "Was wurde verkauft?" });
  assert.equal(response.status, "ANSWERED");
  assert.deepEqual(calls, [{ tool: "latest_sale", limit: 10 }]);
  assert.match(response.answer, /Testkarte/u);
  assert.match(response.answer, /Verkaufsdetails sind unvollständig/u);
  assert.match(response.answer, /Quelle: eBay-Ereignisse · Stand:/u);
  assert.doesNotMatch(response.answer, /1× Testkarte/u, "fehlende Mengen dürfen nicht als 1 erfunden werden");
  assert.deepEqual(response.sources, ["EBAY_WEBHOOK"]);
});

test("leere Tool-Ergebnisse werden als leer und nicht als erfundene Werte formuliert", async () => {
  const orchestrator = new AssistantOrchestrator({
    async plan() { return { tools: [{ tool: "new_orders", limit: 10 }], reason: "READY" }; },
  }, {
    async execute() {
      return availableAssistantResult("new_orders", { definition: "test", orders: [] }, ["SHOP_DB"], null);
    },
  });
  const response = await orchestrator.ask({ message: "Bestellungen?" });
  assert.match(response.answer, /keine neuen bezahlten/u);
  assert.match(response.answer, /Stand: nicht gemeldet/u);
});

test("nicht verfügbare eBay-Quellen werden einzeln und ausdrücklich gemeldet", async () => {
  const orchestrator = new AssistantOrchestrator({
    async plan() {
      return { tools: [{ tool: "ebay_most_viewed", limit: 10 }, { tool: "ebay_messages", limit: 10 }], reason: "READY" };
    },
  }, {
    async execute(input) {
      return input.tool === "ebay_most_viewed"
        ? unavailableAssistantResult("ebay_most_viewed", "DATA_NOT_CAPTURED", "Aufrufzahlen werden nicht gespeichert.", ["EBAY_CACHE"])
        : unavailableAssistantResult("ebay_messages", "SOURCE_NOT_CONNECTED", "Das Postfach ist nicht angebunden.");
    },
  });
  const response = await orchestrator.ask({ message: "Welche eBay-Daten fehlen?" });
  assert.equal(response.status, "ANSWERED");
  assert.match(response.answer, /Aufrufzahlen werden nicht gespeichert/u);
  assert.match(response.answer, /Postfach ist nicht angebunden/u);
  assert.deepEqual(response.tools.map((item) => item.status), ["UNAVAILABLE", "UNAVAILABLE"]);
});

test("mehrere Quellen überleben partielle Toolfehler ohne Rohfehler in der Antwort", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const orchestrator = new AssistantOrchestrator({
      async plan() {
        return { tools: [{ tool: "new_orders", limit: 2 }, { tool: "open_shop_offers", limit: 2 }], reason: "READY" };
      },
    }, {
      async execute(input) {
        if (input.tool === "open_shop_offers") throw new Error("sensitive database detail");
        return availableAssistantResult("new_orders", { definition: "test", orders: [] }, ["SHOP_DB"], null);
      },
    });
    const response = await orchestrator.ask({ message: "Bestellungen und Angebote?" });
    assert.equal(response.status, "PARTIAL");
    assert.match(response.answer, /internen Lesefehlers/u);
    assert.doesNotMatch(response.answer, /sensitive database detail/u);
    assert.deepEqual(response.tools.map((item) => item.status), ["AVAILABLE", "ERROR"]);
  } finally {
    console.error = originalError;
  }
});

test("wenn alle ausgewählten Werkzeuge fehlschlagen, meldet der Manager FAILED", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const orchestrator = new AssistantOrchestrator({
      async plan() { return { tools: [{ tool: "assistant_statistics", limit: 10 }], reason: "READY" }; },
    }, { async execute() { throw new Error("db offline"); } });
    const response = await orchestrator.ask({ message: "Statistik" });
    assert.equal(response.status, "FAILED");
    assert.deepEqual(response.sources, []);
    assert.equal(response.freshness, null);
  } finally {
    console.error = originalError;
  }
});

test("Text und Diktat enden im Desktop-Client am selben Orchestrator-Aufruf", async () => {
  const [service, page] = await Promise.all([
    read("avatar/BrandyCards.Desktop/AssistantConversationService.cs"),
    read("avatar/BrandyCards.Desktop/MainPage.xaml.cs"),
  ]);
  // Seit dem 2026-08-17 geht das Darstellungsthema mit: Ein serverseitig
  // gezeichnetes Bild kann nicht auf `prefers-color-scheme` reagieren. Geprüft
  // bleibt das Wesentliche -- ein Körper mit bekannter Länge, und die Frage
  // selbst als einziges fachliches Feld.
  // Seit dem Statistikfenster kann ein ausdrücklich gewählter Zeitraum
  // mitgehen. Geprüft bleibt das Wesentliche: die Frage als einziges
  // fachliches Feld, und ein Körper mit bekannter Länge.
  assert.match(service, /JsonSerializer\.Serialize\(new \{ message, thema \}\)/u);
  assert.match(service, /JsonSerializer\.Serialize\(new \{ message, thema, tage \}\)/u);
  assert.match(service, /Encoding\.UTF8, "application\/json"\)/u);
  assert.doesNotMatch(service, /ResolveTool|FormatLatestSale|FormatStatistics/u);
  assert.ok((page.match(/await SendAssistantMessageAsync\(message\)/gu) ?? []).length >= 2);
  assert.match(page, /transcription\.Text![\s\S]*SendAssistantMessageAsync\(message\)/u);
});

test("der Orchestrator-Code importiert keine Schreibpfade und übergibt dem Modell kein SQL", async () => {
  const [planner, orchestrator, server] = await Promise.all([
    read("lib/assistant/planner.ts"),
    read("lib/assistant/orchestrator.ts"),
    read("lib/assistant/server-orchestrator.ts"),
  ]);
  const combined = `${planner}\n${orchestrator}\n${server}`;
  assert.doesNotMatch(combined, /runEbaySync|processEbayOutbox|reviseEbayItemQuantity|withdrawEbayOffer/u);
  assert.doesNotMatch(combined, /\.(insert|update|delete)\s*\(/u);
  assert.match(planner, /Erzeuge kein SQL/u);
  assert.match(server, /assistantToolRegistry/u);
});

test("Modellschlüssel und Provider-Aufruf bleiben vollständig serverseitig", async () => {
  const [environment, planner, desktop] = await Promise.all([
    read(".env.example"),
    read("lib/assistant/planner.ts"),
    read("avatar/BrandyCards.Desktop/AssistantConversationService.cs"),
  ]);
  assert.match(environment, /^OPENAI_API_KEY=/mu);
  assert.doesNotMatch(environment, /NEXT_PUBLIC_OPENAI/u);
  assert.match(planner, /process\.env\.OPENAI_API_KEY/u);
  assert.match(planner, /https:\/\/api\.openai\.com\/v1\/responses/u);
  assert.doesNotMatch(desktop, /OPENAI|api\.openai\.com/u);
});
