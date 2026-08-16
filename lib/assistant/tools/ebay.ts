import { count, desc, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ebayListings, ebayOutbox, syncRuns } from "../../../db/schema";
import { availableAssistantResult, unavailableAssistantResult, type AssistantToolInput, type AssistantToolResult } from "../contracts";
import { assistantTimestamp } from "../time";

const UNRESOLVED_OUTBOX_STATUSES = ["PENDING", "PROCESSING", "RETRY_WAIT", "FAILED"] as const;

export async function getEbayMostViewed(): Promise<AssistantToolResult<"ebay_most_viewed">> {
  return unavailableAssistantResult(
    "ebay_most_viewed",
    "DATA_NOT_CAPTURED",
    "eBay-Aufrufzahlen werden im aktuellen Listing-Abgleich nicht geliefert oder gespeichert.",
    ["EBAY_CACHE"],
  );
}

export async function getEbaySyncHealth(input: AssistantToolInput): Promise<AssistantToolResult<"ebay_sync_health">> {
  const db = getDb();
  const [[latestRun], [{ unresolvedCount }], unresolvedOutbox, [freshnessRow]] = await Promise.all([
    db.select({
      id: syncRuns.id,
      status: syncRuns.status,
      startedAt: syncRuns.startedAt,
      finishedAt: syncRuns.finishedAt,
      importedCount: syncRuns.importedCount,
      updatedCount: syncRuns.updatedCount,
      deactivatedCount: syncRuns.deactivatedCount,
      failedCount: syncRuns.failedCount,
    }).from(syncRuns).orderBy(desc(sql`datetime(${syncRuns.startedAt})`), desc(syncRuns.id)).limit(1),
    db.select({ unresolvedCount: count() }).from(ebayOutbox)
      .where(inArray(ebayOutbox.status, [...UNRESOLVED_OUTBOX_STATUSES])),
    db.select({
      id: ebayOutbox.id,
      status: ebayOutbox.status,
      operation: ebayOutbox.operation,
      ebayItemId: ebayOutbox.ebayItemId,
      attemptCount: ebayOutbox.attemptCount,
      availableAt: ebayOutbox.availableAt,
    }).from(ebayOutbox)
      .where(inArray(ebayOutbox.status, [...UNRESOLVED_OUTBOX_STATUSES]))
      .orderBy(desc(sql`datetime(${ebayOutbox.createdAt})`), desc(ebayOutbox.id))
      .limit(input.limit),
    db.select({ value: sql<string | null>`max(datetime(${ebayListings.lastSyncedAt}))` }).from(ebayListings),
  ]);

  const dataFreshness = assistantTimestamp(freshnessRow?.value ?? null);
  return availableAssistantResult("ebay_sync_health", {
    latestRun: latestRun ? {
      ...latestRun,
      startedAt: assistantTimestamp(latestRun.startedAt),
      finishedAt: assistantTimestamp(latestRun.finishedAt),
    } : null,
    dataFreshness,
    unresolvedOutboxCount: Number(unresolvedCount ?? 0),
    unresolvedOutbox: unresolvedOutbox.map((job) => ({ ...job, availableAt: assistantTimestamp(job.availableAt) })),
  }, ["SHOP_DB", "EBAY_CACHE"], dataFreshness ?? assistantTimestamp(latestRun?.finishedAt ?? latestRun?.startedAt ?? null));
}
