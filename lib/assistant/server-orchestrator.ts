import { assistantToolRegistry } from "./server-tool-registry.ts";
import { AssistantOrchestrator, type AssistantToolExecutor } from "./orchestrator.ts";
import { createServerAssistantPlanner } from "./planner.ts";
import type { UnansweredQuestionRecorder } from "./question-log.ts";

/** Baut den Orchestrator zusammen.
 *
 * **Hier steht bewusst kein Datenbankschreibvorgang.** Ein Test aus Phase 4
 * hält fest, dass der Assistant-Code keine Schreibpfade enthält, und diese
 * Zusicherung soll absolut bleiben — auch für die eigene Messtabelle. Der
 * Recorder wird deshalb von der Route hereingegeben, die den Datenbankzugang
 * ohnehin besitzt; dieses Modul kennt nur die Schnittstelle.
 */
export function createServerAssistantOrchestrator(
  recorder: UnansweredQuestionRecorder | null = null,
): AssistantOrchestrator {
  return new AssistantOrchestrator(
    createServerAssistantPlanner(),
    assistantToolRegistry as AssistantToolExecutor,
    recorder,
  );
}
