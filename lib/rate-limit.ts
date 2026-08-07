import { env } from "cloudflare:workers";
import { RATE_LIMIT_TIERS, createMemoryLimiter, rateLimitKey, type RateLimitTier } from "./rate-limit-policy";

type CloudflareRateLimiter = { limit(input: { key: string }): Promise<{ success: boolean }> };

const memory = createMemoryLimiter();
/** One warning per binding per isolate — enough to be visible in the log,
 *  not enough to drown it. */
const announced = new Set<string>();

export class RateLimitError extends Error {
  readonly status = 429;
  readonly code = "RATE_LIMITED";
  readonly retryAfterSeconds = 60;
  constructor() { super("Zu viele Anfragen. Bitte später erneut versuchen."); }
}

export async function enforcePublicRateLimit(request: Request, scope: string, tier: RateLimitTier = "standard") {
  const policy = RATE_LIMIT_TIERS[tier];
  const binding = (env as unknown as Record<string, CloudflareRateLimiter | undefined>)[policy.binding];
  const key = rateLimitKey(request, scope);

  if (binding) {
    if (!(await binding.limit({ key })).success) throw new RateLimitError();
    return;
  }

  // Falling back silently is worse than having no limit: the code reads as
  // protected while every isolate starts counting from scratch. Say it out
  // loud so a missing binding shows up in the log instead of in an incident.
  if (!announced.has(policy.binding)) {
    announced.add(policy.binding);
    console.error(`[rate-limit] Binding ${policy.binding} fehlt in wrangler.toml — die Begrenzung wirkt nur innerhalb dieses Isolates und ist praktisch wirkungslos.`, { scope, tier });
  }

  if (!memory.take(key, policy.limit, policy.periodSeconds * 1000)) throw new RateLimitError();
}
