/** Was der Kunde liest, wenn intern `NEEDS_INFO` steht.
 *
 * **Eine Stelle, nicht drei.** Die Datenbank kennt `NEW`, `IN_REVIEW`,
 * `NEEDS_INFO`, `ACCEPTED`, `REJECTED`, `CLOSED`, `WITHDRAWN`, `EXPIRED` — das
 * sind Begriffe für den Betrieb, nicht für den, der auf eine Antwort wartet.
 * Stünde die Übersetzung in jeder Ansicht, hieße derselbe Stand hier „Abgelehnt"
 * und dort „Nicht angekauft".
 *
 * Die Texte laufen als Schlüssel durch `t()`; die englischen Fassungen stehen in
 * `lib/i18n.ts`.
 */

/** Preisvorschläge, wie sie im Konto erscheinen. */
export const VORSCHLAG_STATUS: Record<string, string> = {
  NEW: "Wird geprüft",
  IN_REVIEW: "Wird geprüft",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  EXPIRED: "Abgelaufen",
  WITHDRAWN: "Zurückgezogen",
};

/** Eingesendete Karten. `NEEDS_INFO` heißt für den Kunden ausdrücklich, dass
 *  **wir** uns melden — sonst wartet er auf eine Rückfrage, die er nirgends
 *  sieht. Solange das nicht gebaut ist (U4), muss der Text das leisten. */
export const ANGEBOT_STATUS: Record<string, string> = {
  NEW: "Eingegangen",
  IN_REVIEW: "Wird geprüft",
  NEEDS_INFO: "Wir haben eine Rückfrage und melden uns",
  ACCEPTED: "Angekauft",
  REJECTED: "Nicht angekauft",
  // Nicht „Abgeschlossen": Das ist schon der Stand einer *Bestellung*, und
  // derselbe Text für zwei verschiedene Vorgänge im selben Konto verwirrt.
  CLOSED: "Erledigt",
};

export function statusText(tabelle: Record<string, string>, status: string) {
  return tabelle[status] ?? status;
}
