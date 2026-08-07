/** The decidable part of rate limiting, deliberately free of the
 * `cloudflare:workers` import so the Node test runner can exercise it.
 *
 * `lib/rate-limit.ts` adds the one thing that only exists at runtime: the
 * Cloudflare binding lookup.
 */

export type RateLimitTier = "standard" | "strict";

export type RateLimitPolicy = {
  /** Binding name — must match a `[[ratelimits]]` block in wrangler.toml. */
  binding: string;
  /** Requests per period. Only used by the in-memory fallback: with the
   *  binding present, Cloudflare takes the limit from wrangler.toml. */
  limit: number;
  /** Cloudflare accepts 10 or 60 seconds, nothing in between. */
  periodSeconds: 10 | 60;
};

/** Two tiers, because uploads deserve a tighter leash than a contact form.
 *
 * Each tier needs its **own** namespace: one binding means one counter
 * configuration, so two limits cannot share it. `tests/rate-limit.test.mjs`
 * compares this table against wrangler.toml and fails if they drift apart —
 * a limit that exists only here is exactly the silent failure that
 * docs/security-findings.md SEC-02 describes.
 */
export const RATE_LIMIT_TIERS: Record<RateLimitTier, RateLimitPolicy> = {
  standard: { binding: "RATE_LIMITER", limit: 10, periodSeconds: 60 },
  strict: { binding: "RATE_LIMITER_STRICT", limit: 3, periodSeconds: 60 },
};

/** Derives the counting key from the request.
 *
 * Only `cf-connecting-ip` is trusted. `x-forwarded-for` used to serve as a
 * fallback, but that header is written by the client and can be changed per
 * request — which turns any counter into decoration. Cloudflare sets and
 * overwrites `cf-connecting-ip` on every request that reaches the Worker, and
 * `workers_dev`/`preview_urls` are off, so there is no route around it.
 * Requests without it (local development) share one conservative bucket.
 */
export function rateLimitKey(request: Request, scope: string) {
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  return `${scope}:${ip ? ip.slice(0, 128) : "unknown"}`;
}

export type MemoryLimiter = {
  /** True while the caller is within the limit. */
  take(key: string, limit: number, windowMs: number): boolean;
  size(): number;
};

/** The fallback for when the binding is absent.
 *
 * Honest about what it is: a counter inside one isolate. Workers isolates are
 * short-lived and exist many times over in parallel, so this stops a single
 * hot loop and nothing more. It exists so local development behaves like
 * production, not as a substitute for the binding.
 */
export function createMemoryLimiter(clock: () => number = Date.now): MemoryLimiter {
  const entries = new Map<string, { count: number; resetAt: number }>();
  return {
    take(key, limit, windowMs) {
      const now = clock();
      // Without this sweep the map only ever grows — one entry per address,
      // kept for the lifetime of the isolate.
      if (entries.size > 512) {
        for (const [candidate, entry] of entries) if (entry.resetAt <= now) entries.delete(candidate);
      }
      const current = entries.get(key);
      if (!current || current.resetAt <= now) {
        entries.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      current.count += 1;
      return current.count <= limit;
    },
    size: () => entries.size,
  };
}
