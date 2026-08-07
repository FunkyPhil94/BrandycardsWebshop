import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { RATE_LIMIT_TIERS, createMemoryLimiter, rateLimitKey } = await import("../lib/rate-limit-policy.ts");

const wranglerToml = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

/** Reads the `[[ratelimits]]` blocks out of wrangler.toml without a TOML
 *  parser — the shape is fixed and this keeps the test dependency-free. */
function declaredRateLimits(toml) {
  return [...toml.matchAll(/\[\[ratelimits\]\]([\s\S]*?)(?=\n\[|$)/g)].map((block) => {
    const body = block[1];
    const simple = body.match(/simple\s*=\s*\{([^}]*)\}/);
    return {
      name: body.match(/name\s*=\s*"([^"]+)"/)?.[1],
      namespaceId: body.match(/namespace_id\s*=\s*"([^"]+)"/)?.[1],
      limit: Number(simple?.[1].match(/limit\s*=\s*(\d+)/)?.[1]),
      period: Number(simple?.[1].match(/period\s*=\s*(\d+)/)?.[1]),
    };
  });
}

// --- SEC-02 -----------------------------------------------------------------
// The binding is what makes rate limiting real. Without it the code falls back
// to a Map inside one isolate, which shares nothing with the other isolates
// Cloudflare runs in parallel — the protection reads as present and is not.
// See docs/security-findings.md.

test("every tier the code uses is actually declared in wrangler.toml", () => {
  const declared = declaredRateLimits(wranglerToml);
  assert.ok(declared.length > 0, "wrangler.toml declares no [[ratelimits]] at all — the limiter is inert in production");

  for (const [tier, policy] of Object.entries(RATE_LIMIT_TIERS)) {
    const match = declared.find((entry) => entry.name === policy.binding);
    assert.ok(match, `tier "${tier}" uses binding ${policy.binding}, which wrangler.toml does not declare`);
    assert.equal(match.limit, policy.limit, `${policy.binding}: wrangler.toml and RATE_LIMIT_TIERS disagree on the limit`);
    assert.equal(match.period, policy.periodSeconds, `${policy.binding}: wrangler.toml and RATE_LIMIT_TIERS disagree on the period`);
    assert.ok(match.namespaceId, `${policy.binding} needs its own namespace_id`);
  }
});

test("each tier gets its own namespace, otherwise both share one limit", () => {
  const declared = declaredRateLimits(wranglerToml);
  const ids = declared.map((entry) => entry.namespaceId);
  assert.equal(new Set(ids).size, ids.length, `duplicate namespace_id: ${ids}`);
});

test("Cloudflare only accepts a 10 or 60 second period", () => {
  for (const entry of declaredRateLimits(wranglerToml)) {
    assert.ok([10, 60].includes(entry.period), `${entry.name}: period ${entry.period} is rejected on deploy`);
  }
});

// --- SEC-17 -----------------------------------------------------------------

test("the counting key ignores x-forwarded-for", () => {
  // A client-supplied header must never decide the bucket: changing it per
  // request would defeat any counter.
  const spoofed = new Request("https://shop.brandycards.de/api/inquiries", {
    headers: { "x-forwarded-for": "9.9.9.9", "cf-connecting-ip": "203.0.113.7" },
  });
  assert.equal(rateLimitKey(spoofed, "inquiries"), "inquiries:203.0.113.7");

  const onlySpoofed = new Request("https://shop.brandycards.de/api/inquiries", {
    headers: { "x-forwarded-for": "9.9.9.9" },
  });
  const key = rateLimitKey(onlySpoofed, "inquiries");
  assert.ok(!key.includes("9.9.9.9"), `x-forwarded-for leaked into the key: ${key}`);
  assert.equal(key, "inquiries:unknown");
});

test("scopes are counted separately", () => {
  const request = new Request("https://shop.brandycards.de/x", { headers: { "cf-connecting-ip": "203.0.113.7" } });
  assert.notEqual(rateLimitKey(request, "inquiries"), rateLimitKey(request, "card-submissions"));
});

// --- the in-memory fallback -------------------------------------------------

test("the fallback blocks once the limit is exceeded and reopens after the window", () => {
  let now = 1_000;
  const limiter = createMemoryLimiter(() => now);
  for (let i = 0; i < 3; i += 1) assert.equal(limiter.take("k", 3, 60_000), true, `request ${i + 1} should pass`);
  assert.equal(limiter.take("k", 3, 60_000), false, "the fourth request must be blocked");
  now += 60_001;
  assert.equal(limiter.take("k", 3, 60_000), true, "after the window it must reopen");
});

test("the fallback does not grow without bound", () => {
  let now = 1_000;
  const limiter = createMemoryLimiter(() => now);
  for (let i = 0; i < 600; i += 1) limiter.take(`key-${i}`, 10, 60_000);
  now += 60_001;
  // The sweep runs on the next write, so one more call clears the stale ones.
  limiter.take("trigger", 10, 60_000);
  assert.ok(limiter.size() < 600, `expired entries were never evicted, size is ${limiter.size()}`);
});
