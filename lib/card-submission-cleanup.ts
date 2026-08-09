import { and, eq, inArray, sql } from "drizzle-orm";
import { getAssetBucket, getDb } from "../db";
import { cardSubmissionAssets, cardSubmissions, productAssets } from "../db/schema";
import {
  DELETABLE_SUBMISSION_STATUSES,
  MAX_SUBMISSION_DELETIONS_PER_RUN,
  retentionCutoff,
  SUBMISSION_RETENTION_DAYS,
} from "./retention";

const ORPHAN_GRACE_MS = 24 * 60 * 60_000;
const MAX_ORPHAN_DELETES_PER_RUN = 100;

async function cleanupOrphanedPrefix(
  bucket: R2Bucket,
  prefix: string,
  known: Set<string>,
  cutoff: number,
  maxDeletes: number,
  deletedSoFar = 0,
) {
  let cursor: string | undefined;
  let deleted = deletedSoFar;
  do {
    if (deleted >= maxDeletes) return { deleted, truncated: true };
    const page = await bucket.list({ prefix, cursor, limit: Math.min(1000, maxDeletes - deleted) });
    for (const object of page.objects) {
      if (deleted >= maxDeletes) return { deleted, truncated: true };
      if ((object.uploaded?.getTime() ?? Date.now()) < cutoff && !known.has(object.key)) {
        await bucket.delete(object.key);
        deleted++;
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return { deleted, truncated: false };
}

export async function cleanupOrphanedUploads(graceMs = ORPHAN_GRACE_MS, maxDeletes = MAX_ORPHAN_DELETES_PER_RUN) {
  const db = getDb();
  const bucket = getAssetBucket();
  const [submissionRows, productRows] = await Promise.all([
    db.select({ storageKey: cardSubmissionAssets.storageKey }).from(cardSubmissionAssets),
    db.select({ storageKey: productAssets.storageKey }).from(productAssets),
  ]);
  const known = new Set([...submissionRows, ...productRows].map((row) => row.storageKey));
  const cutoff = Date.now() - graceMs;
  let result = await cleanupOrphanedPrefix(bucket, "card-submissions/", known, cutoff, maxDeletes);
  if (result.truncated) return result;
  result = await cleanupOrphanedPrefix(bucket, "products/", known, cutoff, maxDeletes, result.deleted);
  return { deleted: result.deleted, truncated: result.truncated };
}

/** Compatibility wrapper for the admin cleanup action. */
export async function cleanupOrphanedCardSubmissionAssets(graceMs = ORPHAN_GRACE_MS, maxDeletes = MAX_ORPHAN_DELETES_PER_RUN) {
  return cleanupOrphanedUploads(graceMs, maxDeletes);
}

/** Löscht abgeschlossene Kartenangebote, deren Aufbewahrungsfrist abgelaufen ist.
 *
 * Reihenfolge mit Absicht: erst die R2-Objekte, dann die Datenbankzeile. Bricht
 * das Löschen eines Objekts ab, verschwindet die Zeile trotzdem — das Objekt
 * ist damit verwaist und wird vom Aufräumlauf oben binnen 24 Stunden
 * eingesammelt. Andersherum bliebe eine Zeile zurück, die auf ein fehlendes
 * Bild zeigt, und der Adminbereich zeigte einen kaputten Vorgang.
 *
 * Siehe docs/security-findings.md, SEC-15.
 */
export async function deleteExpiredCardSubmissions(
  now: Date = new Date(),
  days: number = SUBMISSION_RETENTION_DAYS,
  limit: number = MAX_SUBMISSION_DELETIONS_PER_RUN,
) {
  const db = getDb();
  const bucket = getAssetBucket();
  const cutoff = retentionCutoff(now, days);

  // `datetime()` auf beiden Seiten, nicht `<=` auf den rohen Zeichenketten:
  // die Spalte steht im SQLite-Format `YYYY-MM-DD HH:MM:SS`, der Grenzwert in
  // ISO-8601 mit `T` und `Z`. Roh verglichen gälte 23 Uhr als älter als
  // Mitternacht desselben Tages. Siehe lib/retention.ts.
  const due = await db.select({ id: cardSubmissions.id })
    .from(cardSubmissions)
    .where(and(
      inArray(cardSubmissions.status, [...DELETABLE_SUBMISSION_STATUSES]),
      sql`datetime(${cardSubmissions.updatedAt}) <= datetime(${cutoff})`,
    ))
    .limit(limit);

  if (!due.length) return { deletedSubmissions: 0, deletedObjects: 0, cutoff };

  let deletedObjects = 0;
  let deletedSubmissions = 0;
  for (const submission of due) {
    const assets = await db.select({ storageKey: cardSubmissionAssets.storageKey })
      .from(cardSubmissionAssets)
      .where(eq(cardSubmissionAssets.submissionId, submission.id));
    const results = await Promise.allSettled(assets.map((asset) => bucket.delete(asset.storageKey)));
    deletedObjects += results.filter((result) => result.status === "fulfilled").length;
    // Die Asset-Zeilen hängen per ON DELETE CASCADE an der Einreichung.
    await db.delete(cardSubmissions).where(eq(cardSubmissions.id, submission.id));
    deletedSubmissions += 1;
  }

  console.warn("[retention] Abgeschlossene Kartenangebote gelöscht.", { deletedSubmissions, deletedObjects, days });
  return { deletedSubmissions, deletedObjects, cutoff };
}
