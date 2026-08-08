import { getEmailConfig, getEmailTimeoutMs } from "./config.ts";
import type { Nachricht } from "./templates.ts";

/** Der Versand.
 *
 * **Die zentrale Zusage dieses Moduls: `sendEmail` wirft nie.** Ein
 * fehlgeschlagener Versand darf niemals die auslösende Aktion scheitern lassen.
 * Ein Kunde, der bezahlt hat, bekommt seine Bestellung auch dann, wenn Resend
 * gerade nicht erreichbar ist; er bekommt nur keine Bestätigung. Die
 * Rückgabe sagt, was passiert ist, damit der Aufrufer es protokollieren kann,
 * ohne sich um Ausnahmen kümmern zu müssen.
 */

export type VersandErgebnis =
  /** Angenommen; `id` ist die Kennung bei Resend. */
  | { ok: true; id: string | null }
  /** Kein Schlüssel hinterlegt. Kein Fehler, sondern der Zustand vor der
   *  Einrichtung: Der Shop läuft, es wird nur nichts verschickt. */
  | { ok: false; grund: "nicht-konfiguriert" }
  | { ok: false; grund: "abgelehnt"; status: number; detail: string }
  | { ok: false; grund: "unerreichbar"; detail: string };

const RESEND_URL = "https://api.resend.com/emails";

export async function sendEmail(empfaenger: string, nachricht: Nachricht): Promise<VersandErgebnis> {
  try {
    const config = getEmailConfig();
    if (!config) {
      console.warn("[email] RESEND_API_KEY fehlt, es wird nichts verschickt.", { betreff: nachricht.subject });
      return { ok: false, grund: "nicht-konfiguriert" };
    }

    const ziel = empfaenger.trim();
    // Eine offensichtlich unbrauchbare Adresse gar nicht erst hinausschicken:
    // Das spart einen Fremdaufruf und liefert eine klarere Protokollzeile.
    if (!ziel || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(ziel) || ziel.length > 254) {
      console.error("[email] Unbrauchbare Empfängeradresse, Versand übersprungen.");
      return { ok: false, grund: "abgelehnt", status: 0, detail: "Unbrauchbare Empfängeradresse." };
    }

    const antwort = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [ziel],
        reply_to: config.replyTo,
        subject: nachricht.subject,
        text: nachricht.text,
        html: nachricht.html,
      }),
      // Ohne Zeitgrenze hinge der Checkout an einer stummen Gegenstelle fest —
      // dieselbe Falle, die den eBay-Import einmal stundenlang lahmgelegt hat.
      signal: AbortSignal.timeout(getEmailTimeoutMs()),
    });

    if (!antwort.ok) {
      const detail = (await antwort.text().catch(() => "")).slice(0, 400);
      console.error("[email] Resend hat die Nachricht abgelehnt.", { status: antwort.status, detail });
      return { ok: false, grund: "abgelehnt", status: antwort.status, detail };
    }

    const daten = await antwort.json().catch(() => null) as { id?: unknown } | null;
    return { ok: true, id: typeof daten?.id === "string" ? daten.id : null };
  } catch (error) {
    // Fängt Zeitüberschreitung, Netzfehler und alles Unerwartete.
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler.";
    console.error("[email] Versand fehlgeschlagen.", detail);
    return { ok: false, grund: "unerreichbar", detail };
  }
}

/** Versand als Nebensache: baut die Nachricht, verschickt sie und schluckt
 *  jeden Fehler — auch die aus dem Zusammenbauen.
 *
 * `sendEmail` selbst wirft bereits nicht. Diese Klammer deckt den Schritt
 * davor ab: Eine fehlende Verknüpfung oder ein unerwarteter Wert beim Erzeugen
 * der Nachricht würde sonst die auslösende Route reißen. Genau das soll nie
 * passieren, deshalb steht der Aufruf in den Routen immer in dieser Form.
 */
export async function versucheVersand(anlass: string, aufgabe: () => Promise<unknown>): Promise<void> {
  try {
    await aufgabe();
  } catch (error) {
    console.error(`[email] ${anlass}: Benachrichtigung fehlgeschlagen, Ablauf geht weiter.`, error);
  }
}
