import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  DELETABLE_SUBMISSION_STATUSES,
  SUBMISSION_RETENTION_DAYS,
  isDueForDeletion,
  parseDbTimestamp,
  retentionCutoff,
} = await import("../lib/retention.ts");

const cleanup = await readFile(new URL("../lib/card-submission-cleanup.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

const NOW = new Date("2026-08-07T12:00:00.000Z");
const daysAgo = (days) => new Date(NOW.getTime() - days * 24 * 3600_000);
/** In dem Format, das SQLites CURRENT_TIMESTAMP tatsächlich schreibt. */
const sqliteStamp = (date) => date.toISOString().slice(0, 19).replace("T", " ");

// --- SEC-15 -----------------------------------------------------------------
// Kartenangebote enthalten fremde Bilder und eine E-Mail-Adresse. Abgeschlossene
// Vorgänge werden nach 90 Tagen gelöscht — offene und angekaufte nicht.

test("ein abgeschlossener Vorgang wird nach der Frist gelöscht", () => {
  for (const status of DELETABLE_SUBMISSION_STATUSES) {
    assert.equal(isDueForDeletion({ status, updatedAt: sqliteStamp(daysAgo(91)) }, NOW), true, status);
  }
});

test("innerhalb der Frist wird nichts gelöscht", () => {
  assert.equal(isDueForDeletion({ status: "REJECTED", updatedAt: sqliteStamp(daysAgo(89)) }, NOW), false);
  assert.equal(isDueForDeletion({ status: "REJECTED", updatedAt: sqliteStamp(daysAgo(1)) }, NOW), false);
});

test("offene und angekaufte Vorgänge bleiben, egal wie alt", () => {
  // ACCEPTED wird zum Ankauf: dafür gelten steuerliche Aufbewahrungsfristen,
  // die eine 90-Tage-Löschung überschreiben würden.
  for (const status of ["NEW", "IN_REVIEW", "NEEDS_INFO", "ACCEPTED"]) {
    assert.equal(isDueForDeletion({ status, updatedAt: sqliteStamp(daysAgo(9999)) }, NOW), false,
      `${status} darf nicht gelöscht werden`);
  }
});

test("ohne verwertbaren Zeitstempel wird im Zweifel behalten", () => {
  for (const stamp of [null, "", "irgendwas", "0000-00-00"]) {
    assert.equal(isDueForDeletion({ status: "REJECTED", updatedAt: stamp }, NOW), false,
      `updatedAt=${JSON.stringify(stamp)} darf nicht zum Löschen führen`);
  }
});

// --- Die Zeitstempel-Falle --------------------------------------------------
// `card_submissions` bekommt seine Zeiten aus SQLites CURRENT_TIMESTAMP
// (`YYYY-MM-DD HH:MM:SS`), der übrige Code schreibt ISO-8601 mit T und Z.
// Roh verglichen sortiert ' ' (0x20) vor 'T' (0x54).

test("23 Uhr gilt nicht als älter als Mitternacht desselben Tages", () => {
  const cutoff = "2026-08-07T00:00:00.000Z";
  const stamp = "2026-08-07 23:00:00";
  // Genau der Vergleich, der ohne Normalisierung stattfände:
  assert.equal(stamp <= cutoff, true, "Voraussetzung: der naive Vergleich ist tatsächlich falsch");
  // Und das Ergebnis, auf das es ankommt:
  assert.equal(
    isDueForDeletion({ status: "REJECTED", updatedAt: stamp }, new Date("2026-11-05T00:00:00.000Z"), 90),
    false,
    "ein Vorgang von heute 23 Uhr darf nicht als 90 Tage alt gelten",
  );
});

test("beide Zeitstempelformate werden gleich gelesen", () => {
  const sqlite = parseDbTimestamp("2026-08-07 12:00:00");
  const iso = parseDbTimestamp("2026-08-07T12:00:00.000Z");
  assert.equal(sqlite, iso, "SQLite-Vorgabe und ISO-8601 müssen denselben Zeitpunkt ergeben");
  assert.equal(parseDbTimestamp("unsinn"), null);
  assert.equal(parseDbTimestamp(null), null);
});

test("dasselbe Angebot wird in beiden Formaten gleich beurteilt", () => {
  const old = daysAgo(120);
  assert.equal(
    isDueForDeletion({ status: "CLOSED", updatedAt: sqliteStamp(old) }, NOW),
    isDueForDeletion({ status: "CLOSED", updatedAt: old.toISOString() }, NOW),
    "das Format darf über die Löschung nicht entscheiden",
  );
});

test("die Frist ist die vom Betreiber festgelegte", () => {
  assert.equal(SUBMISSION_RETENTION_DAYS, 90);
  const cutoff = new Date(retentionCutoff(NOW));
  assert.equal(Math.round((NOW - cutoff) / (24 * 3600_000)), 90);
});

// --- Verdrahtung ------------------------------------------------------------

test("SQL vergleicht über datetime(), nicht über rohe Zeichenketten", () => {
  assert.match(cleanup, /datetime\(\$\{cardSubmissions\.updatedAt\}\) <= datetime\(\$\{cutoff\}\)/,
    "ohne datetime() auf beiden Seiten löscht die Abfrage zu viel");
});

test("R2-Objekte gehen vor der Datenbankzeile, damit nichts Kaputtes zurückbleibt", () => {
  const fn = cleanup.slice(cleanup.indexOf("export async function deleteExpiredCardSubmissions"));
  assert.ok(fn.indexOf("bucket.delete") < fn.indexOf("db.delete(cardSubmissions)"),
    "eine Zeile ohne Bild ist schlimmer als ein Bild ohne Zeile — letzteres räumt der Waisenlauf ab");
  assert.match(fn, /allSettled/, "ein fehlgeschlagenes Objekt darf den Lauf nicht abbrechen");
  assert.match(fn, /\.limit\(limit\)/, "ein Lauf muss begrenzt sein, sonst rennt er ins Zeitlimit");
});

test("der geplante Lauf löst die Löschung wirklich aus", () => {
  assert.match(worker, /deleteExpiredCardSubmissions\(\)/,
    "eine Löschfrist, die jemand von Hand auslösen muss, ist keine Frist");
});
