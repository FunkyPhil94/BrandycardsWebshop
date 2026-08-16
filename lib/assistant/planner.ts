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

export type AssistantPlanReason = "READY" | "UNSUPPORTED" | "MODEL_NOT_CONFIGURED";

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

function containsAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function requestedLimit(text: string): number {
  const match = text.match(/\b(\d{1,3})\b/u);
  if (!match) return DEFAULT_LIMIT;
  return Math.min(20, Math.max(1, Number(match[1])));
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
  async plan(message: string): Promise<AssistantPlan> {
    const text = normalizeQuestion(message);
    const limit = requestedLimit(text);
    const tools: AssistantToolInput[] = [];
    const add = (tool: AssistantToolName) => tools.push({ tool, limit });

    const asksEbayAvailability = containsAny(text, [
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

    if (containsAny(text, ["statistik", "kennzahl", "ubersicht", "shop status", "wie lauft der shop"])) {
      add("assistant_statistics");
    }
    if (containsAny(text, ["sync", "abgleich", "rucknahme", "outbox", "ebay zustand", "ebay status"])) {
      add("ebay_sync_health");
    }
    if (containsAny(text, [
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
      add("ebay_most_viewed");
    }
    if (text.includes("ebay") && containsAny(text, ["nachricht", "postfach", "message"])) {
      add("ebay_messages");
    }
    if (containsAny(text, ["shop anfrage", "kundenanfrage", "kontakt anfrage", "neue anfrage", "anfragen im shop"])) {
      add("new_shop_inquiries");
    }
    if (containsAny(text, [
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
    if (containsAny(text, [
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
    if (containsAny(text, ["bestellung", "bestellungen", "order", "zu bearbeiten"])) {
      add("new_orders");
    }
    if (containsAny(text, ["eingestellt", "listing", "gelistet", "inseriert", "neueste karte", "zuletzt hinzugefugt"])) {
      add("latest_listing");
    }
    if (containsAny(text, ["verkauft", "verkauf", "sale", "letzter kauf", "ging zuletzt weg"])) {
      add("latest_sale");
    }

    const selected = uniqueInputs(tools);
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
    inputs.push(parseAssistantToolInput({ tool: item.name, ...args }));
  }
  return uniqueInputs(inputs);
}

export class OpenAIResponsesAssistantPlanner implements AssistantPlanner {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchImpl: FetchLike;

  constructor(
    apiKey: string,
    model = DEFAULT_OPENAI_MODEL,
    fetchImpl: FetchLike = fetch,
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
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
            },
            required: ["limit"],
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

  async plan(message: string): Promise<AssistantPlan> {
    const local = await this.localPlanner.plan(message);
    if (local.tools.length) return local;
    if (!this.modelPlanner) return { tools: [], reason: "MODEL_NOT_CONFIGURED" };
    return this.modelPlanner.plan(message);
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
