import { assistantToolRegistry } from "./server-tool-registry.ts";
import { AssistantOrchestrator, type AssistantToolExecutor } from "./orchestrator.ts";
import { createServerAssistantPlanner } from "./planner.ts";

export function createServerAssistantOrchestrator(): AssistantOrchestrator {
  return new AssistantOrchestrator(
    createServerAssistantPlanner(),
    assistantToolRegistry as AssistantToolExecutor,
  );
}
