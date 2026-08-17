import type {
  AnyAssistantToolResult,
  AssistantDataSource,
  AssistantOrchestratorResponse,
  AssistantQuestionInput,
  AssistantToolInput,
  AssistantVisual,
} from "./contracts.ts";
import { rendereStatistikBilder, type StatistikAnsicht } from "./statistics-visual.ts";
import type { AssistantPlanner } from "./planner.ts";
import { type UnansweredQuestionRecorder, zeichneUnbeantworteteFrageAuf } from "./question-log.ts";
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

/** Sucht in den Ergebnissen die Daten, aus denen sich ein Bild zeichnen lässt.
 *
 * **Nur `AVAILABLE` zählt.** Ein `UNAVAILABLE`-Ergebnis trägt `data: null`; ein
 * Bild daraus wäre eine leere Fläche, die aussieht wie „nichts verkauft" statt
 * „nicht nachgesehen". Dieselbe Linie wie überall hier.
 */
function statistikAnsicht(ergebnisse: AnyAssistantToolResult[]): StatistikAnsicht {
  const ansicht: StatistikAnsicht = {};
  for (const ergebnis of ergebnisse) {
    if (ergebnis.status !== "AVAILABLE") continue;
    if (ergebnis.tool === "sales_overview") ansicht.verkauf = ergebnis.data;
    if (ergebnis.tool === "assistant_statistics") ansicht.kennzahlen = ergebnis.data;
  }
  return ansicht;
}

export class AssistantOrchestrator {
  private readonly planner: AssistantPlanner;
  private readonly tools: AssistantToolExecutor;
  /** Optional: zeichnet unbeantwortete Fragen auf, damit der Werkzeugausbau
   *  gemessen statt geraten wird. Ohne Recorder verhält sich alles wie vorher —
   *  die Messung ist Zubehör und darf niemals Voraussetzung sein. */
  private readonly recorder: UnansweredQuestionRecorder | null;

  constructor(
    planner: AssistantPlanner,
    tools: AssistantToolExecutor,
    recorder: UnansweredQuestionRecorder | null = null,
  ) {
    this.planner = planner;
    this.tools = tools;
    this.recorder = recorder;
  }

  async ask(input: AssistantQuestionInput): Promise<AssistantOrchestratorResponse> {
    const plan = await this.planner.plan(input.message);
    if (!plan.tools.length) {
      // Aufgezeichnet wird die fehlgeschlagene **Zuordnung** — hier, an der
      // einen Stelle, an der alle drei Gründe zusammenlaufen.
      await zeichneUnbeantworteteFrageAuf(this.recorder, input.message, plan.reason);

      // **Ein Anbieterausfall ist kein `UNSUPPORTED`.** Drei Lagen führen zu
      // derselben leeren Werkzeugliste und sind grundverschieden: „nichts
      // eingerichtet", „eingerichtet und gerade kaputt" und „fachlich nicht
      // beantwortbar". Nur der letzte Fall ist endgültig — beim zweiten wissen
      // wir gar nicht, ob die Frage beantwortbar wäre, und dürfen deshalb nicht
      // behaupten, sie sei es nicht. Denselben Unterschied halten
      // `AssistantSalesChannel.available` und die `UNAVAILABLE`-Codes auseinander:
      // „nichts da" ist nicht „nicht nachgesehen".
      if (plan.reason === "MODEL_FAILED") {
        return {
          status: "FAILED",
          readOnly: true,
          answer: "Diese Formulierung kennt der lokale Planer nicht, und die erweiterte Fragenerkennung war gerade nicht erreichbar. Ob sie beantwortbar wäre, ist damit offen. Bekannte Fragen funktionieren unverändert — frage zum Beispiel nach Verkäufen, Bestellungen, Preisvorschlägen, Lagerbestand, Shop-Anfragen, eBay-Daten oder Statistiken, oder versuche es in einem Moment erneut.",
          tools: [],
          sources: [],
          freshness: null,
          visuals: [],
        };
      }

      const answer = plan.reason === "MODEL_NOT_CONFIGURED"
        ? "Diese Formulierung konnte keinem lokalen Lesewerkzeug sicher zugeordnet werden. Der freie Modell-Planer ist serverseitig noch nicht konfiguriert. Frage zum Beispiel nach Verkäufen, Einstellungen, Bestellungen, Preisvorschlägen, Lagerbestand, Shop-Anfragen, eBay-Daten oder Statistiken."
        : "Dazu gibt es kein passendes registriertes Read-only-Werkzeug. Ich kann Fragen zu Verkäufen, Einstellungen, Bestellungen, Preisvorschlägen, Lagerbestand, Shop-Anfragen, eBay-Daten und Statistiken beantworten.";
      return { status: "UNSUPPORTED", readOnly: true, answer, tools: [], sources: [], freshness: null, visuals: [] };
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

    // **Das Bild tritt neben den Text, nie an seine Stelle.** Der Text trägt die
    // Zahlen auch dann, wenn kein Bild entsteht -- und für einen Screenreader ist
    // er die einzige Quelle, weil ein Bild keine Trefferflächen hat.
    const visuals: AssistantVisual[] = rendereStatistikBilder(
      statistikAnsicht(fulfilled.map((item) => item.result)),
      input.thema === "dunkel" ? "dunkel" : "hell",
    ).map((bild) => ({ schluessel: bild.schluessel, titel: bild.titel, hinweis: bild.hinweis, svg: bild.svg }));

    return {
      status: failed.length === 0 ? "ANSWERED" : fulfilled.length ? "PARTIAL" : "FAILED",
      readOnly: true,
      answer,
      visuals,
      tools: executions.map((item) => "result" in item
        ? toolSummary(item.result)
        : { tool: item.input.tool, status: "ERROR", sources: [], freshness: null }),
      sources,
      freshness,
    };
  }
}
