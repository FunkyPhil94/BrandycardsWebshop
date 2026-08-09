/** Provider bodies are temporary processing data, not accounting records. */
export const SENSITIVE_PAYLOAD_RETENTION_DAYS = 30;
export const MAX_SENSITIVE_PAYLOAD_PURGES_PER_TABLE = 200;
export const TERMINAL_PAYMENT_STATUSES = ["CAPTURED", "FAILED", "VOIDED", "REFUNDED"] as const;
export const FINAL_WEBHOOK_STATUSES = ["PROCESSED", "FAILED"] as const;

export function sensitivePayloadCutoff(now: Date = new Date(), days = SENSITIVE_PAYLOAD_RETENTION_DAYS) {
  return new Date(now.getTime() - days * 24 * 3600_000).toISOString();
}
