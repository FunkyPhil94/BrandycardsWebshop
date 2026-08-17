/** Titel und Nachricht eines Formulars, wie sie in einer Textspalte landen.
 *
 * Eigene Datei aus demselben Grund wie `lib/rate-limit-policy.ts`: Sie enthält
 * nichts, was nur zur Laufzeit existiert, und lässt sich deshalb vom
 * Node-Testlauf direkt laden. `lib/public-form.ts` gibt beide Funktionen weiter,
 * damit die bestehenden Aufrufe unverändert bleiben.
 */

/** `card_submissions.message` und `inquiries.message` tragen mehr als einen
 *  Fließtext — Titel und Nachricht stecken als JSON darin. */
export function formMetadata(title: string, message: string | null, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ title, message, ...extra });
}

/** Das Gegenstück, und es steht mit Absicht direkt daneben.
 *
 * Das Auslesen lag bis zum 2026-08-17 als eingebauter `JSON.parse` samt
 * `try`/`catch` allein in `app/api/admin/dashboard/route.ts`. Als das
 * Kundenkonto dieselben Angebote anzeigen sollte, hätte es dort ein zweites Mal
 * entstehen müssen — und zwei Leser für ein Format driften auseinander, sobald
 * jemand ein Feld ergänzt.
 *
 * **Beschädigte oder alte Zeilen dürfen die Liste nicht sprengen:** Was sich
 * nicht lesen lässt, bekommt den Ersatztitel, statt einen Fehler zu werfen.
 */
export function readFormMetadata(message: unknown, ersatzTitel = "Kartenangebot"): { title: string; text: string | null } {
  if (typeof message !== "string") return { title: ersatzTitel, text: null };
  try {
    const inhalt = JSON.parse(message) as { title?: unknown; message?: unknown };
    return {
      title: typeof inhalt?.title === "string" && inhalt.title.trim() ? inhalt.title : ersatzTitel,
      text: typeof inhalt?.message === "string" && inhalt.message.trim() ? inhalt.message : null,
    };
  } catch {
    return { title: ersatzTitel, text: null };
  }
}
