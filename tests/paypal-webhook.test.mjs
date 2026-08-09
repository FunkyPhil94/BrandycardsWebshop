import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const { webhookCaptureAction } = await import("../lib/paypal/webhook-decision.ts");
const { PAYPAL_WEBHOOK_RECEIVED_RETRY_AFTER_MS, receivedWebhookRetryDue } = await import("../lib/paypal/webhook-retry.ts");

// Der Webhook ist der zweite von zwei Wegen, auf denen eine Zahlung eingezogen
// wird (der erste ist die Rückkehr des Kunden aus PayPal). Beide feuern bei
// jeder Zahlung, die Dublette ist also der Normalfall und kein Fehler.

test("eine bereits eingezogene Zahlung ist eine Dublette", () => {
  assert.equal(webhookCaptureAction("CAPTURED"), "dublette");
});

test("eine erstattete Zahlung wird nie wieder als bezahlt behandelt", () => {
  // Der Fall, an dem am meisten hängt: Sonst stünde eine Bestellung auf PAID,
  // deren Geld längst zurückgeflossen ist, und der Bestand wäre erneut als
  // verkauft gebucht.
  assert.equal(webhookCaptureAction("REFUNDED"), "erstattet");
});

test("eine offene Zahlung wird eingezogen", () => {
  for (const status of ["CREATED", "APPROVED"]) {
    assert.equal(webhookCaptureAction(status), "einziehen", `Status ${status}`);
  }
});

test("eine frische RECEIVED-Zeile wartet, statt als Dublette zu gelten", () => {
  const now = new Date("2026-08-09T10:00:00.000Z");
  const receivedAt = new Date(now.getTime() - PAYPAL_WEBHOOK_RECEIVED_RETRY_AFTER_MS + 1).toISOString();
  assert.equal(receivedWebhookRetryDue(receivedAt, now), false);
});

test("eine alte RECEIVED-Zeile darf erneut verarbeitet werden", () => {
  const now = new Date("2026-08-09T10:00:00.000Z");
  const receivedAt = new Date(now.getTime() - PAYPAL_WEBHOOK_RECEIVED_RETRY_AFTER_MS).toISOString();
  assert.equal(receivedWebhookRetryDue(receivedAt, now), true);
});

test("ein unlesbarer Eingangsstempel wird nicht blind erneut verarbeitet", () => {
  assert.equal(receivedWebhookRetryDue("kein Zeitstempel", new Date("2026-08-09T10:00:00.000Z")), false);
});

// --- Die eigentliche Korrektur: kein Ausgang an der Buchführung vorbei -------
//
// Am 2026-08-08 stand `WH-4MD290111R3948627-…` (PAYMENT.CAPTURE.COMPLETED,
// 06:10:22) in der Produktionsdatenbank auf `RECEIVED` mit leerem
// `processed_at` — sauber als Dublette abgewiesen, aber die Zeile sah aus wie
// ein Vorgang, der mitten in der Verarbeitung hängen geblieben ist. Ursache
// war ein vorzeitiges `return` **vor** dem Schreiben von `PROCESSED`.
//
// Dieser Test ist bewusst ein Blick in den Quelltext: Die Route selbst braucht
// Cloudflare-Bindings und eine Datenbank und ist damit hier nicht ausführbar.
// Was sich prüfen lässt, ist die Struktur, die den Fehler unmöglich macht.

test("der Webhook verlässt die Verarbeitung nur an einer Stelle", async () => {
  const quelle = await readFile(new URL("../app/api/paypal/webhook/route.ts", import.meta.url), "utf8");
  const versuch = quelle.slice(quelle.indexOf("const strictPaymentEvent"), quelle.indexOf("return NextResponse.json(duplicate"));

  assert.ok(versuch.length > 0, "die Marken für den geprüften Abschnitt müssen im Quelltext stehen");
  assert.ok(
    !/return\s+NextResponse/.test(versuch),
    "Zwischen dem Ereignisabgleich und dem Schreiben von PROCESSED darf kein return stehen — " +
    "genau so entstand die Zeile, die fälschlich RECEIVED behauptete.",
  );
});

test("die Dublette wird als solche beantwortet, nicht als frisch verarbeitet", async () => {
  const quelle = await readFile(new URL("../app/api/paypal/webhook/route.ts", import.meta.url), "utf8");
  // Der Aufrufer soll weiterhin unterscheiden können: PayPal wiederholt sonst
  // die Zustellung, wenn die Antwort nicht nach Erfolg aussieht.
  assert.match(quelle, /return NextResponse\.json\(duplicate \? \{ ok: true, duplicate: true \} : \{ ok: true, processed: true \}\)/);
  assert.match(quelle, /existing\?\.status === "PROCESSED"\)/);
  assert.doesNotMatch(quelle, /existing\?\.status === "PROCESSED" \|\| existing\?\.status === "RECEIVED"/);
});

test("ein frischer RECEIVED-WebHook fordert eine Wiederholung an", async () => {
  const quelle = await readFile(new URL("../app/api/paypal/webhook/route.ts", import.meta.url), "utf8");
  assert.match(quelle, /receivedWebhookRetryDue\(existing\.receivedAt\)/);
  assert.match(quelle, /status: 503/);
  assert.match(quelle, /["']retry-after["']/);
});

test("PROCESSED wird geschrieben, bevor geantwortet wird", async () => {
  const quelle = await readFile(new URL("../app/api/paypal/webhook/route.ts", import.meta.url), "utf8");
  const schreiben = quelle.indexOf('status: "PROCESSED"');
  const antwort = quelle.indexOf("return NextResponse.json(duplicate");
  assert.ok(schreiben > 0 && antwort > schreiben, "die Buchführung gehört vor die Antwort");
});
