import { env } from "cloudflare:workers";

type MemoryEntry = { count: number; resetAt: number };
type CloudflareRateLimiter = { limit(input: { key: string }): Promise<{ success: boolean }> };
const memoryStore = new Map<string, MemoryEntry>();

function keyFor(request: Request, scope: string) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  return `${scope}:${ip.trim().slice(0, 128)}`;
}

export class RateLimitError extends Error {
  readonly status = 429;
  readonly code = "RATE_LIMITED";
  readonly retryAfterSeconds = 60;
  constructor() { super("Zu viele Anfragen. Bitte später erneut versuchen."); }
}

export async function enforcePublicRateLimit(request: Request, scope: string, limit = 10, windowMs = 60_000) {
  const binding = (env as unknown as { RATE_LIMITER?: CloudflareRateLimiter }).RATE_LIMITER;
  const key = keyFor(request, scope);
  if (binding) {
    if (!(await binding.limit({ key })).success) throw new RateLimitError();
    return;
  }
  const now = Date.now();
  const current = memoryStore.get(key);
  if (!current || current.resetAt <= now) { memoryStore.set(key, { count: 1, resetAt: now + windowMs }); return; }
  current.count += 1;
  if (current.count > limit) throw new RateLimitError();
}
