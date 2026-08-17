import { MAX_ASSISTANT_QUESTION_LENGTH } from "./contracts.ts";
import type { AssistantPlanReason } from "./planner.ts";

/** Was aufgezeichnet wird, wenn eine Frage unbeantwortet blieb.
 *
 * **Nur der unbeantwortete Fall.** Bei einer beantworteten Frage ist bereits
 * bekannt, welche Werkzeuge gegriffen haben; ein Mitschnitt jeder Frage wäre ein
 * wachsendes Tätigkeitsprotokoll ohne zusätzlichen Nutzen.
 */
export type UnansweredQuestion = {
  question: string;
  reason: AssistantPlanReason;
};

export interface UnansweredQuestionRecorder {
  record(eintrag: UnansweredQuestion): Promise<void>;
}

/** Die Gründe, die überhaupt aufzeichnungswürdig sind.
 *
 * `READY` steht nicht dabei: Ein Plan mit Werkzeugen ist keine Lücke, auch wenn
 * die Ausführung anschließend scheitert — dafür gibt es die Betriebsalarme.
 * Aufgezeichnet wird die **Zuordnung**, nicht die Datenbeschaffung.
 */
const AUFZEICHNUNGSWUERDIG = new Set<AssistantPlanReason>(["UNSUPPORTED", "MODEL_NOT_CONFIGURED", "MODEL_FAILED"]);

export function istAufzeichnungswuerdig(reason: AssistantPlanReason): boolean {
  return AUFZEICHNUNGSWUERDIG.has(reason);
}

/** Bringt eine Frage in eine speicherbare Form.
 *
 * Gekürzt wird auf dieselbe Grenze, die die Eingabe ohnehin einhält, und
 * Zeilenumbrüche fallen zu Leerzeichen zusammen — die Auswertung liest Zeilen,
 * nicht Absätze. `null` heißt „nichts Auswertbares dabei": Eine leere Frage
 * erreicht diese Stelle nicht, aber eine aus reinen Steuerzeichen bestehende
 * wäre eine Zeile ohne Inhalt.
 */
export function normalisiereFrage(frage: string): string | null {
  const sauber = frage.replaceAll(/\s+/gu, " ").trim();
  if (!sauber) return null;
  return sauber.slice(0, MAX_ASSISTANT_QUESTION_LENGTH);
}

/** Zeichnet auf, **ohne die Antwort zu gefährden.**
 *
 * Die Aufzeichnung läuft, nachdem die Antwort fertig ist. Ein Schreibfehler in
 * D1 darf aus einer gültigen Auskunft keinen Fehler machen — die Messung ist
 * Zubehör, nicht Zweck. Dieselbe Haltung wie beim Nachlesen der eBay-Menge und
 * bei der Lesartenprüfung: Diagnose scheitert leise.
 */
export async function zeichneUnbeantworteteFrageAuf(
  recorder: UnansweredQuestionRecorder | null,
  frage: string,
  reason: AssistantPlanReason,
): Promise<void> {
  if (!recorder || !istAufzeichnungswuerdig(reason)) return;
  const question = normalisiereFrage(frage);
  if (!question) return;

  try {
    await recorder.record({ question, reason });
  } catch (error) {
    console.error("assistant unanswered question could not be recorded", error);
  }
}
