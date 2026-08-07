/** Aufbewahrungsregeln für Kartenangebote.
 *
 * Ein Kartenangebot enthält fremde Bilder und eine E-Mail-Adresse. Beides
 * unbegrenzt zu behalten ist weder nötig noch datensparsam. Abgeschlossene
 * Vorgänge werden deshalb nach einer festen Frist gelöscht — Angebote, die zu
 * einem Kauf geführt haben, bleiben.
 *
 * Frei von Datenbankimporten, damit die Entscheidung testbar ist.
 * Siehe docs/security-findings.md, SEC-15.
 */

/** Frist ab der letzten Statusänderung. Vom Betreiber festgelegt. */
export const SUBMISSION_RETENTION_DAYS = 90;

/** Nur wirklich abgeschlossene Vorgänge werden gelöscht.
 *
 * `ACCEPTED` bleibt bewusst draußen: daraus wird ein Ankauf, und für
 * Kaufvorgänge gelten handels- und steuerrechtliche Aufbewahrungsfristen, die
 * eine 90-Tage-Löschung überschreiben würden. `NEW`, `IN_REVIEW` und
 * `NEEDS_INFO` sind offene Vorgänge — die zu löschen wäre schlicht ein Fehler.
 */
export const DELETABLE_SUBMISSION_STATUSES = ["REJECTED", "CLOSED"] as const;

/** Wie viele Vorgänge ein Lauf höchstens anfasst.
 *
 * Ein Lauf teilt sich die Worker-Laufzeit mit dem eBay-Import, der Freigabe
 * abgelaufener Reservierungen und der Outbox. Lieber mehrere kurze Läufe als
 * einer, der in ein Zeitlimit rennt und nichts zu Ende bringt.
 */
export const MAX_SUBMISSION_DELETIONS_PER_RUN = 50;

/** Der Zeitpunkt, vor dem ein abgeschlossener Vorgang fällig wird. */
export function retentionCutoff(now: Date = new Date(), days: number = SUBMISSION_RETENTION_DAYS) {
  return new Date(now.getTime() - days * 24 * 3600_000).toISOString();
}

/**
 * Entscheidet über einen einzelnen Vorgang. Dieselbe Regel wie in SQL, hier
 * noch einmal in JavaScript — damit sie sich prüfen lässt, ohne eine Datenbank
 * zu brauchen.
 *
 * **Zeitstempel sind hier nicht vergleichbare Zeichenketten.** `card_submissions`
 * bekommt seine Zeiten aus SQLites `CURRENT_TIMESTAMP` und damit im Format
 * `YYYY-MM-DD HH:MM:SS`, während der übrige Anwendungscode ISO-8601 mit `T`
 * und `Z` schreibt. Ein direkter `<=`-Vergleich zwischen beiden Formen ist
 * **falsch**: `' '` (0x20) sortiert vor `'T'` (0x54), also gilt
 * `'2026-08-07 23:00:00' <= '2026-08-07T00:00:00.000Z'` als wahr — 23 Uhr
 * würde für älter als Mitternacht desselben Tages gehalten und gelöscht.
 * Beide Seiten müssen erst zu echten Zeitpunkten werden.
 */
export function isDueForDeletion(
  submission: { status: string; updatedAt: string | null; createdAt?: string | null },
  now: Date = new Date(),
  days: number = SUBMISSION_RETENTION_DAYS,
) {
  if (!(DELETABLE_SUBMISSION_STATUSES as readonly string[]).includes(submission.status)) return false;
  const stamp = parseDbTimestamp(submission.updatedAt ?? submission.createdAt ?? null);
  // Ohne verwertbaren Zeitstempel wird nichts gelöscht. Im Zweifel behalten.
  if (stamp === null) return false;
  return stamp <= new Date(retentionCutoff(now, days)).getTime();
}

/** Liest beide Formate, die in dieser Datenbank vorkommen. */
export function parseDbTimestamp(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  // SQLite-Vorgabe: `YYYY-MM-DD HH:MM:SS`, ohne Zeitzone gemeint als UTC.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed.replace(" ", "T")}Z`
    : trimmed;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}
