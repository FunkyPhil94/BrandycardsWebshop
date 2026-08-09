import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const {
  buildEbayChallengeResponse,
  ebayNotificationEndpoint,
  parseEbayOrderConfirmation,
  verifyEbayNotificationSignature,
} = await import("../lib/ebay-notifications.ts");

test("eBay-Endpoint-Challenge folgt der offiziellen SHA-256-Verkettung", async () => {
  const vorher = {
    endpoint: process.env.EBAY_NOTIFICATION_ENDPOINT,
    token: process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN,
  };
  process.env.EBAY_NOTIFICATION_ENDPOINT = "https://shop.brandycards.de/api/ebay/notifications";
  process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN = "test-verification-token";
  const challenge = "71745723-d031-455c-bfa5-f90d11b4f20a";
  const erwartet = createHash("sha256")
    .update(`${challenge}${process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN}${process.env.EBAY_NOTIFICATION_ENDPOINT}`)
    .digest("hex");
  assert.equal(await buildEbayChallengeResponse(challenge), erwartet);
  assert.equal(ebayNotificationEndpoint(), process.env.EBAY_NOTIFICATION_ENDPOINT);
  if (vorher.endpoint === undefined) delete process.env.EBAY_NOTIFICATION_ENDPOINT;
  else process.env.EBAY_NOTIFICATION_ENDPOINT = vorher.endpoint;
  if (vorher.token === undefined) delete process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN;
  else process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN = vorher.token;
});

test("ORDER_CONFIRMATION liest Listing-ID und Menge und fasst doppelte Zeilen zusammen", () => {
  const result = parseEbayOrderConfirmation({
    metadata: { topic: "ORDER_CONFIRMATION" },
    notification: {
      notificationId: "notification-123",
      data: {
        order: {
          orderId: "order-456",
          orderLineItems: [
            { orderLineItemId: "line-1", listingId: "listing-1", quantity: 1 },
            { orderLineItemId: "line-2", listingId: "listing-1", quantity: "2" },
          ],
        },
      },
    },
  });
  assert.deepEqual(result, {
    notificationId: "notification-123",
    orderId: "order-456",
    lineItems: [{ listingId: "listing-1", quantity: 3 }],
  });
});

test("unvollständige oder fremde Topics werden nicht als Verkauf verarbeitet", () => {
  assert.equal(parseEbayOrderConfirmation({ metadata: { topic: "LISTING_REVISION" } }), null);
  assert.equal(parseEbayOrderConfirmation({ metadata: { topic: "ORDER_CONFIRMATION" }, notification: { notificationId: "x", data: { order: { orderLineItems: [] } } } }), null);
  assert.equal(parseEbayOrderConfirmation({ metadata: { topic: "ORDER_CONFIRMATION" }, notification: { notificationId: "x", data: { order: { orderLineItems: [{ listingId: "x", quantity: 0 }] } } } }), null);
});

test("ungültige Signaturen werden vor jedem eBay-Schlüsselabruf verworfen", async () => {
  assert.deepEqual(await verifyEbayNotificationSignature("{}", "kein-base64"), { valid: false, retryable: false });
  assert.deepEqual(await verifyEbayNotificationSignature("{}", ""), { valid: false, retryable: false });
});

test("ECDSA-Signaturen im eBay-Format werden mit dem angegebenen Digest geprüft", async () => {
  const vorher = {
    environment: process.env.EBAY_ENVIRONMENT,
    clientId: process.env.EBAY_CLIENT_ID,
    clientSecret: process.env.EBAY_CLIENT_SECRET,
  };
  process.env.EBAY_ENVIRONMENT = "production";
  process.env.EBAY_CLIENT_ID = "client-id";
  process.env.EBAY_CLIENT_SECRET = "client-secret";
  const payload = {
    metadata: { topic: "MARKETPLACE_ACCOUNT_DELETION", schemaVersion: "1.0", deprecated: false },
    notification: { notificationId: "49feeaeb-4982-42d9-a377-9645b8479411_33f7e043-fed8-442b-9d44-791923bd9a6d", eventDate: "2021-03-19T20:43:59.462Z", publishDate: "2021-03-19T20:43:59.679Z", publishAttemptCount: 1, data: { username: "test_user", userId: "ma8vp1jySJC", eiasToken: "nY+sHZ2PrBmdj6wVnY+sEZ2PrA2dj6wJnY+gAZGEpwmdj6x9nY+seQ==" } },
  };
  const signature = "eyJhbGciOiJlY2RzYSIsImtpZCI6Ijk5MzYyNjFhLTdkN2ItNDYyMS1hMGYxLTk2Y2NiNDI4YWY0OSIsInNpZ25hdHVyZSI6Ik1FWUNJUUNmeGZJV3V4bVdjSUJRSjljNS9YN2lHREpxczJSQ0dzQkVhQWppbnlycmZBSWhBSVY2d0djVGlCdVY1S0pVaWYyaG9reXJMK1E5c3NIa2FkK214Mm5FRTI1dyIsImRpZ2VzdCI6IlNIQTEifQ==";
  const publicKey = "-----BEGIN PUBLIC KEY-----MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZhhxXKtR+TOvtDbgTPCkSof02qgBB7IsYOyf76ilExJ/upAa/vKIKheOoCyOpcLmi4t0b4uepb7LLjmMr90FUg==-----END PUBLIC KEY-----";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => String(input).includes("identity/v1/oauth2/token")
    ? new Response(JSON.stringify({ access_token: "application-token", expires_in: 3600 }), { status: 200 })
    : new Response(JSON.stringify({ key: publicKey }), { status: 200 });
  assert.deepEqual(await verifyEbayNotificationSignature(JSON.stringify(payload), signature), { valid: true, retryable: false });
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(vorher)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("Route prüft Signatur vor JSON-Verarbeitung, verbucht idempotent und kennt beide eBay-Listing-IDs", async () => {
  const quelle = await readFile(new URL("../app/api/ebay/notifications/route.ts", import.meta.url), "utf8");
  assert.ok(quelle.indexOf("verifyEbayNotificationSignature") < quelle.indexOf("JSON.parse(rawBody)"));
  assert.match(quelle, /request\.headers\.get\("x-ebay-signature"\)/u);
  assert.match(quelle, /onConflictDoNothing\(\)/u);
  assert.match(quelle, /status: "PROCESSED"/u);
  assert.match(quelle, /writes\.push\(db\.update\(webhookEvents\)\.set\(\{ status: "PROCESSED"/u);
  assert.match(quelle, /inArray\(ebayListings\.ebayListingId, listingIds\)/u);
  assert.match(quelle, /db\.update\(inventory\)/u);
  assert.match(quelle, /notifyOperationalAlert/u);
});

test("Production verlangt die eBay-Fulfillment-Scope und den festen HTTPS-Endpoint", async () => {
  const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(wrangler, /EBAY_NOTIFICATION_ENDPOINT = "https:\/\/shop\.brandycards\.de\/api\/ebay\/notifications"/u);
  assert.match(wrangler, /EBAY_WRITE_OAUTH_SCOPE = .*sell\.fulfillment/u);
  assert.match(wrangler, /EBAY_WRITE_OAUTH_SCOPE = .*sell\.fulfillment\.readonly/u);
  assert.match(wrangler, /EBAY_WRITE_OAUTH_SCOPE = .*commerce\.notification\.subscription/u);
});
