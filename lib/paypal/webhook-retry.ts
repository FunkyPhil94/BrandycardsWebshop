import { parseDbTimestamp } from "../retention.ts";

/** A webhook row must be old enough before a second delivery claims it.
 *
 * PayPal may deliver the same event while the first request is still running.
 * A short grace period keeps that normal overlap from processing the event
 * twice, while still giving an interrupted request a bounded path back into
 * processing.
 */
export const PAYPAL_WEBHOOK_RECEIVED_RETRY_AFTER_MS = 5 * 60_000;

export function receivedWebhookRetryDue(receivedAt: string | null, now: Date = new Date()) {
  const stamp = parseDbTimestamp(receivedAt);
  if (stamp === null) return false;
  return stamp <= now.getTime() - PAYPAL_WEBHOOK_RECEIVED_RETRY_AFTER_MS;
}
