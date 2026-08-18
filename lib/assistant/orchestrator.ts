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
import { absageEinleitung, einleitung, schlusskommentar, smalltalkAntwort, streutext } from "./persona.ts";

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
  /** Die Uhr, aus der K.A.R.L. Tageszeit und Streuwert nimmt. Einspeisbar,
   *  damit ein Test einen Gruß prüfen kann, ohne auf den Abend zu warten. */
  private readonly jetzt: () => Date;

  constructor(
    planner: AssistantPlanner,
    tools: AssistantToolExecutor,
    recorder: UnansweredQuestionRecorder | null = null,
    jetzt: () => Date = () => new Date(),
  ) {
    this.planner = planner;
    this.tools = tools;
    this.recorder = recorder;
    this.jetzt = jetzt;
  }

  async ask(input: AssistantQuestionInput): Promise<AssistantOrchestratorResponse> {
    const jetzt = this.jetzt();
    const streu = streutext(input.message, jetzt);

    // **Smalltalk endet hier, vor dem Planer.** Drei Gründe, alle praktisch:
    // Ein „danke" kostet so keinen Modellaufruf, es landet nicht als
    // unbeantwortete Frage in der Messtabelle (dort soll stehen, welche
    // *Fachfragen* fehlen, nicht wie höflich der Betreiber ist), und es bekommt
    // eine Antwort statt einer Absage. Die Erkennung ist eng gefasst und gibt im
    // Zweifel `null` zurück — dann läuft alles wie zuvor.
    const plauderei = smalltalkAntwort(input.message, jetzt);
    if (plauderei) {
      return { status: "ANSWERED", readOnly: true, answer: plauderei, tools: [], sources: [], freshness: null, visuals: [] };
    }

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
          answer: `${absageEinleitung(streu)} Diese Formulierung kennt der lokale Planer nicht, und die erweiterte Fragenerkennung war gerade nicht erreichbar. Ob sie beantwortbar wäre, ist damit offen. Bekannte Fragen funktionieren unverändert — frage zum Beispiel nach Verkäufen, Bestellungen, Preisvorschlägen, Lagerbestand, Shop-Anfragen, eBay-Daten oder Statistiken, oder versuche es in einem Moment erneut.`,
          tools: [],
          sources: [],
          freshness: null,
          visuals: [],
        };
      }

      const rahmen = absageEinleitung(streu);
      const answer = plan.reason === "MODEL_NOT_CONFIGURED"
        ? `${rahmen} Diese Formulierung konnte keinem lokalen Lesewerkzeug sicher zugeordnet werden. Der freie Modell-Planer ist serverseitig noch nicht konfiguriert. Frage zum Beispiel nach Verkäufen, Einstellungen, Bestellungen, Preisvorschlägen, Lagerbestand, Shop-Anfragen, eBay-Daten oder Statistiken.`
        : `${rahmen} Dazu gibt es kein passendes registriertes Read-only-Werkzeug. Ich kann Fragen zu Verkäufen, Einstellungen, Bestellungen, Preisvorschlägen, Lagerbestand, Shop-Anfragen, eBay-Daten und Statistiken beantworten.`;
      return { status: "UNSUPPORTED", readOnly: true, answer, tools: [], sources: [], freshness: null, visuals: [] };
    }

    // **Ein gewählter Zeitraum überschreibt nur den Zeitraum**, nicht die
    // Werkzeugwahl. Der Planer bleibt der Einzige, der entscheidet, *was*
    // gefragt wird; das Statistikfenster stellt nur ein, *über welche Spanne*.
    const werkzeuge = input.tage === undefined
      ? plan.tools
      : plan.tools.map((tool) => (tool.tool === "sales_overview" ? { ...tool, days: input.tage } : tool));

    const executions: ToolExecution[] = await Promise.all(werkzeuge.map(async (tool): Promise<ToolExecution> => {
      try {
        return { input: tool, result: await this.tools.execute(tool) };
      } catch (error) {
        console.error("assistant orchestrator read tool failed", tool.tool, error);
        return { input: tool, error: true };
      }
    }));

    const fulfilled = executions.filter((item): item is Extract<ToolExecution, { result: AnyAssistantToolResult }> => "result" in item);
    const failed = executions.filter((item): item is Extract<ToolExecution, { error: true }> => "error" in item);
    const bloecke = executions.map((item) => "result" in item
      ? formatAssistantToolResult(item.result)
      : failedToolText(item.input.tool));
    const sources = uniqueSources(fulfilled.map((item) => item.result.sources));
    const freshness = newestFreshness(fulfilled.map((item) => item.result.status === "AVAILABLE" ? item.result.freshness : null));

    // **Der Rahmen steht um die Blöcke, nie in ihnen.** Einleitung und Kommentar
    // sind eigene Absätze; die Datenzeilen samt Quelle-und-Stand-Zeile bleiben
    // unverändert das, was der Formatierer geliefert hat. Der Kommentar liest aus
    // den Ergebnissen nur ab, *ob* etwas da ist — keine Zahl verlässt ihn, sonst
    // stünde dieselbe Zahl zweimal in der Antwort und könnte sich widersprechen.
    const kommentar = schlusskommentar(fulfilled.map((item) => item.result), streu);
    const answer = [
      einleitung(werkzeuge.map((werkzeug) => werkzeug.tool), streu),
      ...bloecke,
      ...(kommentar ? [kommentar] : []),
    ].join("\n\n");

    // **Das Bild tritt neben den Text, nie an seine Stelle.** Der Text trägt die
    // Zahlen auch dann, wenn kein Bild entsteht -- und für einen Screenreader ist
    // er die einzige Quelle, weil ein Bild keine Trefferflächen hat.
    const visuals: AssistantVisual[] = rendereStatistikBilder(
      statistikAnsicht(fulfilled.map((item) => item.result)),
      input.thema === "dunkel" ? "dunkel" : "hell",
    ).map((bild) => ({
      schluessel: bild.schluessel, fenster: bild.fenster, titel: bild.titel, hinweis: bild.hinweis,
      heroLabel: bild.heroLabel, heroWert: bild.heroWert, kacheln: bild.kacheln,
      legende: bild.legende, achse: bild.achse, xAchse: bild.xAchse, zeitraum: bild.zeitraum,
      spitze: bild.spitze, svg: bild.svg,
    }));

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
