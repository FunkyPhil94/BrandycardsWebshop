/** Handmarkierungen und das Zusammenführen manueller Karten.
 *
 * Zwei Aufgaben, die beide am selben Ort entschieden werden, weil beide die
 * Frage beantworten: *Was darf der eBay-Import an einem Produkt anfassen?*
 *
 * Reine Funktionen, ohne Datenbank prüfbar — verdrahtet in `lib/ebay-sync.ts`,
 * geprüft in `tests/manual-cards.test.mjs`.
 */

/** Felder, die der Betreiber von Hand setzen darf.
 *
 * Bewusst kurz. Jedes Feld hier ist eines, das der Import **nicht mehr**
 * korrigieren kann — wer zu viele freigibt, baut sich einen Katalog, der
 * langsam von der Wirklichkeit bei eBay abdriftet, ohne dass es auffällt. */
export const HANDFELDER = ["title", "description", "status"] as const;
export type Handfeld = (typeof HANDFELDER)[number];

export function istHandfeld(wert: unknown): wert is Handfeld {
  return typeof wert === "string" && (HANDFELDER as readonly string[]).includes(wert);
}

/** Liest die Spalte `products.manual_overrides` defensiv.
 *
 * Sie ist JSON aus der Datenbank, also ungeprüft: eine kaputte Zeile darf nicht
 * den ganzen Sync-Lauf reißen. Unbekannte Feldnamen fliegen raus, damit ein
 * alter Eintrag nicht später ein Feld sperrt, das es inzwischen gibt. */
export function handfelder(wert: unknown): Set<Handfeld> {
  if (!Array.isArray(wert)) return new Set();
  return new Set(wert.filter(istHandfeld));
}

/** Entfernt aus den Importwerten alles, was von Hand gesetzt wurde.
 *
 * **Das ist die eigentliche Zusage von Punkt 12.1:** Was der Betreiber im
 * Adminbereich ändert, überlebt den nächsten Import. Ohne diesen Filter macht
 * der Sync jede Korrektur binnen Minuten wieder zunichte — bei einem Takt von
 * drei Minuten, ohne Hinweis, ohne Protokollzeile. */
export function ohneHandfelder<T extends Record<string, unknown>>(werte: T, gesperrt: Set<Handfeld>): Partial<T> {
  if (gesperrt.size === 0) return werte;
  return Object.fromEntries(Object.entries(werte).filter(([feld]) => !gesperrt.has(feld as Handfeld))) as Partial<T>;
}

/** Der Schlüssel, an dem eine manuelle Karte und ein eBay-Angebot als dieselbe
 *  Karte gelten.
 *
 * **Das bleibt eine Vermutung, und das ist bewusst so eng gefasst.** Titel sind
 * Freitext; ein unscharfer Vergleich träfe irgendwann die falsche Karte, und
 * bei Einzelstücken heißt das ein Angebot, das stillschweigend verschwindet.
 * Deshalb: Groß- und Kleinschreibung egal, Mehrfach-Leerzeichen egal, sonst
 * **zeichengenau**. Kein Kürzen, kein Weglassen von Satzzeichen, keine
 * Ähnlichkeitsmaße.
 */
export function titelSchluessel(titel: string): string {
  return titel.trim().replace(/\s+/gu, " ").toLocaleLowerCase("de-DE");
}

/** Ob eine manuelle Karte von einem eBay-Angebot übernommen werden darf.
 *
 * Der Betreiber hat entschieden: Erscheint dieselbe Karte bei eBay, wandert sie
 * aus dem Vorverkauf zu den synchronisierten Karten — **dieselbe Zeile**, nicht
 * eine zweite daneben. Das erhält Kennung, Verknüpfungen und laufende
 * Preisvorschläge.
 *
 * Zwei Fälle bleiben trotzdem draußen, weil ein Wechsel dort Geld kostet:
 * Karten, die schon verkauft sind, und Karten mit einer laufenden Zusage.
 */
export type UebernahmeKandidat = {
  id: string;
  status: string;
  /** Ob zu dieser Karte ein angenommener, noch gültiger Preisvorschlag liegt. */
  hatZusage: boolean;
};

export function darfUebernommenWerden(kandidat: UebernahmeKandidat): boolean {
  if (kandidat.status !== "ACTIVE") return false;
  // Eine Zusage nennt einen Preis für **diese** Karte. Wandert sie zu eBay,
  // bestimmt fortan das Angebot den Preis — die Zusage stünde im Widerspruch
  // dazu. Solche Karten bleiben liegen und werden im Adminbereich sichtbar.
  return !kandidat.hatZusage;
}
