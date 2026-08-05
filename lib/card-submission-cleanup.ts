import { getAssetBucket, getDb } from "../db";
import { cardSubmissionAssets } from "../db/schema";

export async function cleanupOrphanedCardSubmissionAssets(graceMs = 24 * 60 * 60_000, maxDeletes = 100) {
  const db = getDb();
  const bucket = getAssetBucket();
  const knownRows = await db.select({ storageKey: cardSubmissionAssets.storageKey }).from(cardSubmissionAssets);
  const known = new Set(knownRows.map((row) => row.storageKey));
  let cursor: string | undefined;
  let deleted = 0;
  const cutoff = Date.now() - graceMs;
  do {
    const page = await bucket.list({ prefix: "card-submissions/", cursor, limit: Math.min(1000, maxDeletes) });
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
