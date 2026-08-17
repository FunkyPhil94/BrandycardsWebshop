/** Zugang zur Azure-Spracherkennung — **ohne den Schlüssel herauszugeben**.
 *
 * Azure stellt zu einem Abonnementschlüssel kurzlebige Autorisierungstoken aus.
 * Der Desktop bekommt nur diese; der Schlüssel selbst bleibt im Worker. Das ist
 * dieselbe Trennung wie beim Modell-Planer aus Phase 4: Der Client kennt weder
 * Anbieter-Zugangsdaten noch Abrechnung, sondern ausschließlich ein Papier, das
 * von allein verfällt.
 *
 * **Warum Azure und nicht der Marktführer einer Bestenliste:** Der Betreiber hat
 * am 2026-08-17 die Windows-Diktierfunktion (Win+H) an derselben Stelle
 * getestet, an der die App scheiterte — und sie lief gut. Win+H wird von Azure
 * Speech betrieben. Damit ist dieser Dienst an der Stimme, dem Mikrofon und dem
 * Vokabular dieses Nutzers belegt, statt an fremden Testdaten.
 */

const TOKEN_TIMEOUT_MS = 10_000;

/** Wie lange ein Azure-Token gilt: zehn Minuten.
 *
 * Angegeben wird dem Client weniger, damit er erneuert, **bevor** es reißt. Ein
 * Token, das mitten in einer Aufnahme verfällt, kostet die Frage — und der
 * Nutzer hat sie bereits gesprochen. */
const TOKEN_LIFETIME_SECONDS = 600;
const TOKEN_SAFETY_MARGIN_SECONDS = 60;

export type SpeechTokenGrant = {
  token: string;
  region: string;
  /** Sekunden, nach denen der Client ein neues Token holen soll. */
  expiresInSeconds: number;
};

export class SpeechTokenUnavailableError extends Error {
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = "SpeechTokenUnavailableError";
  }
}

/** Region und Schlüssel aus den Cloudflare-Secrets, oder eine klare Absage.
 *
 * Getrennt geprüft und getrennt gemeldet: „kein Schlüssel" ist ein anderer
 * Betreiberfehler als „keine Region", und beide sähen in einem gemeinsamen
 * `null` gleich aus. Das ist dieselbe Lehre wie bei `PAYPAL_ENVIRONMENT`, das
 * zwei Tage lang still auf `sandbox` zurückfiel.
 */
function readSpeechCredentials(): { key: string; region: string } {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key) {
    throw new SpeechTokenUnavailableError("Die Spracherkennung ist serverseitig nicht eingerichtet: AZURE_SPEECH_KEY fehlt.");
  }
  if (!region) {
    throw new SpeechTokenUnavailableError("Die Spracherkennung ist serverseitig nicht eingerichtet: AZURE_SPEECH_REGION fehlt.");
  }
  return { key, region };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function issueSpeechToken(fetchImpl: FetchLike = fetch): Promise<SpeechTokenGrant> {
  const { key, region } = readSpeechCredentials();

  const response = await fetchImpl(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      // Azure verlangt eine Längenangabe, auch wenn der Körper leer ist.
      "content-length": "0",
    },
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });

  if (!response.ok) {
    // **Der Statuscode geht mit, der Antwortkörper nicht.** Azure schickt bei
    // Fehlern Diagnosetext, der den Schlüssel oder Kontodetails enthalten kann;
    // der hat im Desktop-Panel nichts verloren.
    throw new SpeechTokenUnavailableError(`Azure hat kein Sprachtoken ausgestellt (HTTP ${response.status}).`);
  }

  const token = (await response.text()).trim();
  if (!token) {
    throw new SpeechTokenUnavailableError("Azure hat ein leeres Sprachtoken geliefert.");
  }

  return {
    token,
    region,
    expiresInSeconds: TOKEN_LIFETIME_SECONDS - TOKEN_SAFETY_MARGIN_SECONDS,
  };
}
