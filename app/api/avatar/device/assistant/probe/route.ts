import { NextResponse } from "next/server";
import { AssistantRequestError, parseAssistantCandidateProbeInput } from "../../../../../../lib/assistant/contracts";
import { selectResolvableCandidate } from "../../../../../../lib/assistant/candidate-probe";
import { authenticateAvatarDevice } from "../../../../../../lib/avatar-device-auth";
import { enforcePublicRateLimit, RateLimitError } from "../../../../../../lib/rate-limit";
import { readTextBody, RequestBodyError } from "../../../../../../lib/request-body";

/** Obergrenze für den gepufferten Anfragekörper.
 *
 * Großzügiger als die 4 KiB der Frageroute, weil hier bis zu fünf Lesarten à
 * 1 000 Zeichen ankommen dürfen und UTF-8 je Zeichen mehrere Bytes belegt. Die
 * fachliche Grenze zieht nicht diese Zahl, sondern
 * `parseAssistantCandidateProbeInput`; diese hier verhindert allein, dass ein
 * beliebig langer Körper überhaupt erst vollständig gelesen wird.
 */
const MAX_PROBE_REQUEST_BYTES = 32 * 1024;
const NO_STORE = { "cache-control": "no-store" };

/** Welche Lesart eines Diktats zu einem Werkzeug führt — mehr nicht.
 *
 * Diese Route **führt kein Werkzeug aus** und liest keine Geschäftsdaten; sie
 * kennt die Registry nicht einmal. Sie beantwortet allein die Frage, ob ein
 * Text zuordenbar wäre. Dadurch bleiben die Zuordnungsregeln dort, wo sie
 * hingehören — serverseitig, in einer Fassung. Eine zweite Regelkopie im
 * Desktop wäre genau die Doppelpflege, die Phase 4 beseitigt hat.
 *
 * Die Ratenbegrenzung teilt sich bewusst den Bereich `avatar-assistant` mit
 * der Frageroute: Ein eigener Bereich verdoppelte das Gesamtkontingent eines
 * gekoppelten Geräts, ohne dass dafür ein Grund bestünde.
 */
export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "avatar-assistant");
    if (!(await authenticateAvatarDevice(request, "ASSISTANT_READ"))) {
      return NextResponse.json({ error: "Desktop-Assistent ist nicht gekoppelt." }, { status: 401, headers: NO_STORE });
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Content-Type application/json ist erforderlich." }, { status: 415, headers: NO_STORE });
    }

    const rawBody = await readTextBody(request, MAX_PROBE_REQUEST_BYTES);
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new AssistantRequestError("Die Assistant-Anfrage enthält kein gültiges JSON.");
    }

    const { candidates } = parseAssistantCandidateProbeInput(body);
    return NextResponse.json(await selectResolvableCandidate(candidates), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { ...NO_STORE, "retry-after": String(error.retryAfterSeconds) } });
    }
    if (error instanceof RequestBodyError || error instanceof AssistantRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
    }
    console.error("assistant candidate probe failed", error);
    return NextResponse.json({ error: "Die Lesartenprüfung ist gerade nicht verfügbar." }, { status: 503, headers: NO_STORE });
  }
}
