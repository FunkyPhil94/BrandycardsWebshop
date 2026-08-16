import type { AssistantToolInput, AssistantToolName, AssistantToolResult } from "./contracts.ts";

export type AssistantToolHandlers = {
  [K in AssistantToolName]: (input: AssistantToolInput<K>) => Promise<AssistantToolResult<K>>;
};

/**
 * Die einzige Dispatch-Stelle für Assistant-Datenzugriffe.
 *
 * Der Aufrufer kann weder Tabellen noch SQL oder Funktionsnamen vorgeben. Nur
 * die vollständig typisierte Allowlist in `AssistantToolHandlers` ist
 * erreichbar. Schreibwerkzeuge existieren in dieser Registry absichtlich nicht.
 */
export function createAssistantToolRegistry(handlers: AssistantToolHandlers) {
  const fixedHandlers = Object.freeze({ ...handlers });
  return Object.freeze({
    execute<K extends AssistantToolName>(input: AssistantToolInput<K>): Promise<AssistantToolResult<K>> {
      const handler = fixedHandlers[input.tool] as unknown as (value: AssistantToolInput<K>) => Promise<AssistantToolResult<K>>;
      return handler(input);
    },
  });
}
