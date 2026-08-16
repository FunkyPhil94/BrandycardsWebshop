import { NextResponse } from "next/server";
import { ASSISTANT_TOOL_DEFINITIONS, AssistantRequestError, parseAssistantQuestionInput } from "../../../../../lib/assistant/contracts";
import { createServerAssistantOrchestrator } from "../../../../../lib/assistant/server-orchestrator";
import { authenticateAvatarDevice } from "../../../../../lib/avatar-device-auth";
import { enforcePublicRateLimit, RateLimitError } from "../../../../../lib/rate-limit";
import { readTextBody, RequestBodyError } from "../../../../../lib/request-body";

const MAX_ASSISTANT_REQUEST_BYTES = 4 * 1024;
const NO_STORE = { "cache-control": "no-store" };

async function authorize(request: Request) {
  // Vor dem D1-Token-Lookup begrenzen: auch frei erfundene bcav_-Tokens dürfen
  // keine unbegrenzten Datenbank-Lesevorgänge verursachen.
  await enforcePublicRateLimit(request, "avatar-assistant");
  return authenticateAvatarDevice(request, "ASSISTANT_READ");
}

export async function GET(request: Request) {
  try {
    if (!(await authorize(request))) {
      return NextResponse.json({ error: "Desktop-Assistent ist nicht gekoppelt." }, { status: 401, headers: NO_STORE });
    }
    return NextResponse.json({ readOnly: true, orchestrated: true, input: "message", tools: ASSISTANT_TOOL_DEFINITIONS }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { ...NO_STORE, "retry-after": String(error.retryAfterSeconds) } });
    }
    console.error("assistant capability lookup failed", error);
    return NextResponse.json({ error: "Assistant-Werkzeuge konnten nicht geladen werden." }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  try {
    if (!(await authorize(request))) {
      return NextResponse.json({ error: "Desktop-Assistent ist nicht gekoppelt." }, { status: 401, headers: NO_STORE });
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Content-Type application/json ist erforderlich." }, { status: 415, headers: NO_STORE });
    }

    const rawBody = await readTextBody(request, MAX_ASSISTANT_REQUEST_BYTES);
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new AssistantRequestError("Die Assistant-Anfrage enthält kein gültiges JSON.");
    }
    const input = parseAssistantQuestionInput(body);
    const result = await createServerAssistantOrchestrator().ask(input);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { ...NO_STORE, "retry-after": String(error.retryAfterSeconds) } });
    }
    if (error instanceof RequestBodyError || error instanceof AssistantRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
    }
    console.error("assistant orchestration failed", error);
    return NextResponse.json({ error: "Der freie Assistant ist gerade nicht verfügbar." }, { status: 503, headers: NO_STORE });
  }
}
