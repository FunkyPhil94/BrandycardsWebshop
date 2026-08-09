import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { payments, webhookEvents } from "../db/schema";
import { D1_SAFE_ID_LIST } from "./d1-limits";
import {
  FINAL_WEBHOOK_STATUSES,
  MAX_SENSITIVE_PAYLOAD_PURGES_PER_TABLE,
  SENSITIVE_PAYLOAD_RETENTION_DAYS,
  sensitivePayloadCutoff,
  TERMINAL_PAYMENT_STATUSES,
} from "./sensitive-data-retention-policy";

export { FINAL_WEBHOOK_STATUSES, MAX_SENSITIVE_PAYLOAD_PURGES_PER_TABLE, SENSITIVE_PAYLOAD_RETENTION_DAYS, sensitivePayloadCutoff, TERMINAL_PAYMENT_STATUSES } from "./sensitive-data-retention-policy";

async function clearPaymentPayloads(db: ReturnType<typeof getDb>, cutoff: string) {
  const rows = await db.select({ id: payments.id })
    .from(payments)
    .where(and(
      eq(payments.provider, "PAYPAL"),
      inArray(payments.status, [...TERMINAL_PAYMENT_STATUSES]),
      isNotNull(payments.rawData),
      sql`datetime(${payments.updatedAt}) <= datetime(${cutoff})`,
    ))
    .limit(MAX_SENSITIVE_PAYLOAD_PURGES_PER_TABLE);

  let deleted = 0;
  for (let index = 0; index < rows.length; index += D1_SAFE_ID_LIST) {
    const ids = rows.slice(index, index + D1_SAFE_ID_LIST).map((row) => row.id);
    if (!ids.length) continue;
    const result = await db.update(payments)
      .set({ rawData: null })
      .where(inArray(payments.id, ids));
    deleted += result.meta.changes;
  }
  return { candidates: rows.length, deleted };
}

async function clearWebhookPayloads(db: ReturnType<typeof getDb>, cutoff: string) {
  const rows = await db.select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(and(
      inArray(webhookEvents.status, [...FINAL_WEBHOOK_STATUSES]),
      isNotNull(webhookEvents.payload),
      isNotNull(webhookEvents.processedAt),
      sql`datetime(${webhookEvents.processedAt}) <= datetime(${cutoff})`,
    ))
    .limit(MAX_SENSITIVE_PAYLOAD_PURGES_PER_TABLE);

  let deleted = 0;
  for (let index = 0; index < rows.length; index += D1_SAFE_ID_LIST) {
    const ids = rows.slice(index, index + D1_SAFE_ID_LIST).map((row) => row.id);
    if (!ids.length) continue;
    const result = await db.update(webhookEvents)
      .set({ payload: null })
      .where(inArray(webhookEvents.id, ids));
    deleted += result.meta.changes;
  }
  return { candidates: rows.length, deleted };
}

/** Removes copied provider bodies while retaining payment/event metadata. */
export async function purgeExpiredSensitivePayloads(
  now: Date = new Date(),
  days = SENSITIVE_PAYLOAD_RETENTION_DAYS,
) {
  const db = getDb();
  const cutoff = sensitivePayloadCutoff(now, days);
  const [paymentsResult, webhooksResult] = await Promise.all([
    clearPaymentPayloads(db, cutoff),
    clearWebhookPayloads(db, cutoff),
  ]);
  return { cutoff, payments: paymentsResult, webhooks: webhooksResult };
}
