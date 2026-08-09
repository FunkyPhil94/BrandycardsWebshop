import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const retention = await import("../lib/sensitive-data-retention-policy.ts");
const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
const capture = await readFile(new URL("../app/api/paypal/capture/route.ts", import.meta.url), "utf8");
const backup = await readFile(new URL("../scripts/backup-production.mjs", import.meta.url), "utf8");
const restore = await readFile(new URL("../scripts/restore-backup.mjs", import.meta.url), "utf8");

test("Rohdaten werden nach 30 Tagen, nicht die Zahlungsmetadaten, fällig", () => {
  assert.equal(retention.SENSITIVE_PAYLOAD_RETENTION_DAYS, 30);
  const now = new Date("2026-08-09T12:00:00.000Z");
  assert.equal(retention.sensitivePayloadCutoff(now), "2026-07-10T12:00:00.000Z");
  assert.deepEqual(retention.TERMINAL_PAYMENT_STATUSES, ["CAPTURED", "FAILED", "VOIDED", "REFUNDED"]);
  assert.deepEqual(retention.FINAL_WEBHOOK_STATUSES, ["PROCESSED", "FAILED"]);
});

test("der geplante Lauf räumt abgeschlossene Zahlungs- und Webhook-Rohdaten auf", () => {
  assert.match(worker, /purgeExpiredSensitivePayloads\(\)/u);
  assert.match(worker, /Abgelaufene Zahlungs- und Webhook-Rohdaten/u);
});

test("die Capture-Antwort gibt keine PayPal-Rohantwort aus", () => {
  assert.doesNotMatch(capture, /rawData: payment\.rawData/u);
  assert.match(capture, /function captureDetails\(payment: \{ providerCaptureId: string \| null \}\)/u);
});

test("Backup exportiert D1 und referenzierte R2-Objekte, Restore bleibt lokal", () => {
  assert.match(backup, /d1.*export.*--remote/su);
  assert.match(backup, /r2.*object.*get/su);
  assert.match(backup, /storage_key/u);
  assert.match(backup, /EXTERNAL_ASSET_QUERY/u);
  assert.match(backup, /externalAssets/u);
  assert.doesNotMatch(backup, /startsWith\("ebay\//u);
  assert.match(restore, /--local/u);
  assert.doesNotMatch(restore, /runWrangler\(\[[^\]]*"--remote"/u);
  assert.match(restore, /orderForLocalD1Restore/u);
  assert.match(restore, /r2.*object.*put/su);
});
