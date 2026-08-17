import { NextResponse } from "next/server";
import { issueSpeechToken, SpeechTokenUnavailableError } from "../../../../../../lib/assistant/speech-token";
import { authenticateAvatarDevice } from "../../../../../../lib/avatar-device-auth";
import { enforcePublicRateLimit, RateLimitError } from "../../../../../../lib/rate-limit";

const NO_STORE = { "cache-control": "no-store" };

/** Gibt dem gekoppelten Desktop ein kurzlebiges Azure-Sprachtoken.
 *
 * `POST`, obwohl nichts gesendet wird: Hier entsteht bei jedem Aufruf ein neues
 * Token bei einem Fremdanbieter. Das ist keine Abfrage, und es darf auch nie
 * zwischengespeichert werden — weder von einem Proxy noch vom Browser.
 *
 * Der Abonnementschlüssel verlässt den Worker nicht. Der Desktop bekommt
 * ausschließlich das Token und die Region.
 */
export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "avatar-assistant");
    if (!(await authenticateAvatarDevice(request, "ASSISTANT_READ"))) {
      return NextResponse.json({ error: "Desktop-Assistent ist nicht gekoppelt." }, { status: 401, headers: NO_STORE });
    }

    return NextResponse.json(await issueSpeechToken(), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { ...NO_STORE, "retry-after": String(error.retryAfterSeconds) } });
    }
    if (error instanceof SpeechTokenUnavailableError) {
      // Diese Meldung ist für den Betreiber gedacht und nennt bewusst den
      // fehlenden Secret-Namen -- sie erscheint nur bei einem gekoppelten
      // Gerät, also nach bestandener Authentifizierung.
      return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE });
    }
    console.error("speech token issuance failed", error);
    return NextResponse.json({ error: "Das Sprachtoken konnte nicht ausgestellt werden." }, { status: 503, headers: NO_STORE });
  }
}
