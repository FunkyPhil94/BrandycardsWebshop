/** Die entscheidbare Hälfte der Aufrufmessung — ohne Datenbank, ohne
 *  `cloudflare:workers`, damit `tests/page-views.test.mjs` sie prüfen kann.
 *
 * **Was gezählt wird und was nicht.** Ein Aufruf ist eine Seite, die in einem
 * echten Browser sichtbar geworden ist. Gezählt wird deshalb aus der
 * Client-Komponente `app/view-tracker.tsx` heraus und nicht im Worker: Der
 * Worker sieht zusätzlich Suchmaschinen, Vorabrufe, RSC-Nachladungen und jedes
 * Bild — Zahlen, die ein Vielfaches der Wahrheit wären und mit jeder
 * Änderung am Ausliefern schwanken würden.
 *
 * **Gespeichert wird nichts über die Person.** Keine Adresse, kein Cookie,
 * keine Kennung, keine Sitzungserkennung. Eine Zeile trägt einen
 * Stundenbeginn, ein Pfadmuster und eine Zahl — mehr steht nicht darin und
 * lässt sich daraus auch nicht zurückrechnen. Genau deshalb braucht der
 * Zähler keine Einwilligung.
 */

/** Die Seitenbereiche, die einzeln gezählt werden.
 *
 * **Der Pfad wird auf ein Muster reduziert, nicht roh gespeichert** — sonst
 * bekäme jede der ~300 Karten eine eigene Zeile je Stunde, und aus 24 Zeilen
 * am Tag würden 7 000. Die Aufschlüsselung beantwortet „welcher Bereich wird
 * benutzt", nicht „welche Karte" — Aufrufzahlen je Angebot liefert für die
 * eBay-Seite bereits `ebay_listing_traffic`.
 */
export const AUFRUF_PFADMUSTER = [
  "/",
  "/karten",
  "/karten/[id]",
  "/vorverkauf",
  "/verkaufen",
  "/anfragen",
  "/checkout",
  "/checkout/paypal/success",
  "/checkout/paypal/cancel",
  "/account",
  "/agb",
  "/datenschutz",
  "/impressum",
  "/widerruf",
  "/versand-zahlung",
  "/ueber-uns",
  /** Alles, was keiner bekannten Seite entspricht. Sammelt statt zu wachsen. */
  "/sonstiges",
] as const;

export type AufrufPfadmuster = (typeof AUFRUF_PFADMUSTER)[number];

const BEKANNTE_PFADE = new Set<string>(AUFRUF_PFADMUSTER);

/** Höchstlänge des entgegengenommenen Pfads. Alles darüber ist kein Aufruf,
 *  sondern ein Versuch. */
export const MAX_AUFRUF_PFAD_LAENGE = 512;

/**
 * Bildet einen Pfad auf sein Muster ab — oder auf `null`, wenn er nicht
 * gezählt werden soll.
 *
 * `null` heißt **nicht** „unbekannt": Unbekanntes landet unter
 * `/sonstiges`. `null` steht für „bewusst nicht gezählt", und das ist bisher
 * genau der Adminbereich. Die eigenen Besuche des Betreibers in einer Zahl
 * mitzuzählen, die er selbst zur Beurteilung des Shops liest, würde sie
 * verfälschen — und zwar am stärksten dann, wenn sonst wenig los ist.
 */
export function normalisiereAufrufpfad(roherPfad: string): AufrufPfadmuster | null {
  if (typeof roherPfad !== "string" || roherPfad.length > MAX_AUFRUF_PFAD_LAENGE) return null;
  // Nur der Pfad zählt. Abfrage und Anker kämen sonst als eigene Muster an
  // und würden zusätzlich Suchbegriffe der Besucher in die Datenbank tragen.
  const ohneAnhang = roherPfad.split(/[?#]/u)[0] ?? "";
  if (!ohneAnhang.startsWith("/")) return null;
  // Ein Schrägstrich am Ende ist derselbe Aufruf, "/Karten" ist dieselbe Seite.
  const pfad = (ohneAnhang.length > 1 ? ohneAnhang.replace(/\/+$/u, "") : ohneAnhang).toLowerCase() || "/";

  if (pfad === "/admin" || pfad.startsWith("/admin/")) return null;
  if (BEKANNTE_PFADE.has(pfad)) return pfad as AufrufPfadmuster;
  // Die einzige dynamische Seite des Shops.
  if (/^\/karten\/[^/]+$/u.test(pfad)) return "/karten/[id]";
  return "/sonstiges";
}

/**
 * Der Stundeneimer, in den ein Zeitpunkt fällt — als ISO-Zeichenkette in UTC.
 *
 * **Feste Form, damit der Vergleich in SQL ein Vergleich bleibt.** Die
 * Fensterabfragen sind `bucket_start >= '…'`, also Zeichenkettenvergleiche.
 * Die gehen nur auf, solange jede Zeile dasselbe Format hat: gleiche Länge,
 * gleiche Zeitzone, führende Nullen. Deshalb schreibt **die Anwendung** den
 * Wert und nicht SQLites `CURRENT_TIMESTAMP` — das liefert
 * `YYYY-MM-DD HH:MM:SS` und würde sich mit ISO-8601 nicht sortieren lassen
 * (dieselbe Falle steht ausführlich in `lib/retention.ts`).
 */
export function stundenEimer(zeitpunkt: Date = new Date()) {
  const eimer = new Date(zeitpunkt);
  eimer.setUTCMinutes(0, 0, 0);
  return eimer.toISOString();
}

/** Die drei Fenster, die der Adminbereich zeigt. In Stunden, weil die
 *  Eimer stündlich sind — 30 Tage sind 720 Eimer. */
export const AUFRUF_FENSTER = {
  tag: { stunden: 24, titel: "Letzte 24 Stunden" },
  woche: { stunden: 24 * 7, titel: "Letzte 7 Tage" },
  monat: { stunden: 24 * 30, titel: "Letzte 30 Tage" },
} as const;

export type AufrufFenster = keyof typeof AUFRUF_FENSTER;

/**
 * Der früheste Eimer, der noch zum Fenster gehört.
 *
 * Gerechnet wird in ganzen Eimern, nicht auf die Minute: „letzte 24 Stunden"
 * sind die laufende Stunde und die 23 davor. Die laufende Stunde zählt also
 * unvollständig mit — der Alternative, sie wegzulassen, fehlten die Aufrufe
 * der letzten Minuten, und das fällt bei einem kleinen Shop stärker auf.
 */
export function fensterBeginn(fenster: AufrufFenster, jetzt: Date = new Date()) {
  const stunden = AUFRUF_FENSTER[fenster].stunden;
  return stundenEimer(new Date(new Date(stundenEimer(jetzt)).getTime() - (stunden - 1) * 3600_000));
}

/** Wie lange Eimer aufgehoben werden.
 *
 * 90 Tage: deutlich mehr als das größte Fenster (30 Tage), damit ein Vergleich
 * mit dem Vormonat möglich bleibt, und wenig genug, dass die Tabelle nicht
 * unbegrenzt wächst. Bei ~17 Mustern sind das rund 37 000 Zeilen im Vollausbau.
 */
export const AUFRUF_AUFBEWAHRUNG_TAGE = 90;

/** Eimer, die vor diesem Zeitpunkt beginnen, dürfen weg. */
export function aufrufAufbewahrungGrenze(jetzt: Date = new Date(), tage: number = AUFRUF_AUFBEWAHRUNG_TAGE) {
  return stundenEimer(new Date(jetzt.getTime() - tage * 24 * 3600_000));
}
