import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Bindings are intentionally only declared here; authentication, secrets,
 * eBay and PayPal integrations belong to later application layers.
 * Configure D1 as `DB` and the private R2 bucket as `UPLOADS` in hosting.json.
 */
export function getDb() {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }
  return drizzle(env.DB, { schema });
}

export function getAssetBucket(): R2Bucket {
  if (!env.UPLOADS) {
    throw new Error("Cloudflare R2 binding `UPLOADS` is unavailable.");
  }
  return env.UPLOADS;
}
