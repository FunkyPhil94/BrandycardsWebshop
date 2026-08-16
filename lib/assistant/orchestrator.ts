import type {
  AnyAssistantToolResult,
  AssistantDataSource,
  AssistantOrchestratorResponse,
  AssistantQuestionInput,
  AssistantToolInput,
} from "./contracts.ts";
import type { AssistantPlanner } from "./planner.ts";
import { failedToolText, formatAssistantToolResult, toolSummary } from "./response-formatter.ts";

export interface AssistantToolExecutor {
  execute(input: AssistantToolInput): Promise<AnyAssistantToolResult>;
}

type ToolExecution =
  | { input: AssistantToolInput; result: AnyAssistantToolResult }
  | { input: AssistantToolInput; error: true };

function newestFreshness(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function uniqueSources(values: AssistantDataSource[][]): AssistantDataSource[] {
  return [...new Set(values.flat())];
}

export class AssistantOrchestrator {
  private readonly planner: AssistantPlanner;
  private readonly tools: AssistantToolExecutor;

  constructor(
    planner: AssistantPlanner,
    tools: AssistantToolExecutor,
  ) {
    this.planner = planner;
    this.tools = tools;
  }

  async ask(input: AssistantQuestionInput): Promise<AssistantOrchestratorResponse> {
    const plan = await this.planner.plan(input.message);
    if (!plan.tools.length) {
      const answer = plan.reason === "MODEL_NOT_CONFIGURED"
        ? "Diese Formulierung konnte keinem lokalen Lesewerkzeug sicher zugeordnet werden. Der freie Modell-Planer ist serverseitig noch nicht konfiguriert. Frage zum Beispiel nach Verkäufen, Einstellungen, Bestellungen, Preisvorschlägen, Lagerbestand, Shop-Anfragen, eBay-Daten oder Statistiken."
        : "Dazu gibt es kein passendes registriertes Read-only-Werkzeug. Ich kann Fragen zu Verkäufen, Einstellungen, Bestellungen, Preisvorschlägen, Lagerbestand, Shop-Anfragen, eBay-Daten und Statistiken beantworten.";
      return { status: "UNSUPPORTED", readOnly: true, answer, tools: [], sources: [], freshness: null };
    }

    const executions: ToolExecution[] = await Promise.all(plan.tools.map(async (tool): Promise<ToolExecution> => {
      try {
        return { input: tool, result: await this.tools.execute(tool) };
      } catch (error) {
        console.error("assistant orchestrator read tool failed", tool.tool, error);
        return { input: tool, error: true };
      }
    }));

    const fulfilled = executions.filter((item): item is Extract<ToolExecution, { result: AnyAssistantToolResult }> => "result" in item);
    const failed = executions.filter((item): item is Extract<ToolExecution, { error: true }> => "error" in item);
    const answer = executions.map((item) => "result" in item
      ? formatAssistantToolResult(item.result)
      : failedToolText(item.input.tool)).join("\n\n");
    const sources = uniqueSources(fulfilled.map((item) => item.result.sources));
    const freshness = newestFreshness(fulfilled.map((item) => item.result.status === "AVAILABLE" ? item.result.freshness : null));

    return {
      status: failed.length === 0 ? "ANSWERED" : fulfilled.length ? "PARTIAL" : "FAILED",
      readOnly: true,
      answer,
      tools: executions.map((item) => "result" in item
        ? toolSummary(item.result)
        : { tool: item.input.tool, status: "ERROR", sources: [], freshness: null }),
      sources,
      freshness,
    };
  }
}
