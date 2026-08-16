import type { AssistantCandidateProbeResponse } from "./contracts.ts";
import { type AssistantPlanner, RuleBasedAssistantPlanner } from "./planner.ts";

/** Welche Lesart eines Diktats gemeint war — entschieden vom Regelplaner.
 *
 * Die Windows-Spracherkennung liefert zu einem Diktat mehrere Lesarten, nach
 * Konfidenz sortiert. Bisher nahm der Desktop blind die erste. Das trägt bei
 * freiem Text, aber die Fragen hier bestehen aus Fachvokabular, an dem die
 * SAPI-Erkennung regelmäßig vorbeigreift.
 *
 * Die bessere Auskunft gibt der Planer: Die Domäne ist klein und geschlossen —
 * zwölf Werkzeuge sind ein winziger Ausschnitt des Deutschen. Eine Lesart, die
 * dort landet, ist mit hoher Wahrscheinlichkeit die gemeinte, und eine, die
 * nirgends landet, war als Frage ohnehin wertlos. Der Planer wird damit zum
 * Schiedsrichter über eine unsichere Erkennung, statt dass ein zweites
 * Erkennungssystem danebengestellt wird.
 *
 * **Warum hier nur die Regeln entscheiden und nicht der Hybrid-Planer:** Der
 * Modell-Planer darf allein 15 Sekunden laufen (`MODEL_TIMEOUT_MS`). Fünf
 * Kandidaten wären damit im schlechtesten Fall über eine Minute Wartezeit und
 * fünf bezahlte Aufrufe — für eine Vorauswahl, die auch danebenliegen kann.
 * Der Modellpfad bleibt deshalb der eigentlichen Frage vorbehalten: Trifft
 * keine Lesart die Regeln, geht der erste Kandidat wie bisher hinaus und
 * bekommt dort seine volle Behandlung.
 */
export async function selectResolvableCandidate(
  candidates: readonly string[],
  planner: AssistantPlanner = new RuleBasedAssistantPlanner(),
): Promise<AssistantCandidateProbeResponse> {
  for (const [index, candidate] of candidates.entries()) {
    const plan = await planner.plan(candidate);
    if (plan.tools.length) {
      return { readOnly: true, selectedIndex: index, selected: candidate };
    }
  }

  // Kein Treffer ist ein gültiges Ergebnis, kein Fehlschlag. Der Aufrufer
  // bleibt beim ersten Kandidaten und bekommt die bisherige Antwort.
  return { readOnly: true, selectedIndex: null, selected: null };
}
