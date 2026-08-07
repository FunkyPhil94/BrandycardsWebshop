/** Bot deterrence for the public forms, without asking customers to prove
 * anything.
 *
 * A rate limit answers "how often", not "who". These two checks answer the
 * second question cheaply, and neither is visible to someone filling the form
 * in normally:
 *
 * - a **honeypot** field that is hidden from the page and left empty by any
 *   human; form-filling bots complete every field they find
 * - a **minimum dwell time** between the form being rendered and submitted;
 *   nobody types a card title, an e-mail address and a message in under a
 *   couple of seconds
 *
 * Deliberately not a captcha: that would be visible, would bring in a third
 * party and would need a line in the privacy notice. This stops the cheap
 * automation, which is what the shop actually sees. See
 * docs/security-findings.md, E-2.
 *
 * Kept free of framework imports so both the routes and the tests can use it.
 */

/** Field name the forms render hidden and the routes expect to stay empty. */
export const HONEYPOT_FIELD = "website";

/** Field name carrying when the form was rendered, as epoch milliseconds. */
export const RENDERED_AT_FIELD = "renderedAt";

/** Nobody fills in a real form faster than this. */
export const MIN_FILL_MILLISECONDS = 2_000;

/** A stamp older than this is stale — a reloaded tab, or a replayed capture. */
export const MAX_FORM_AGE_MILLISECONDS = 6 * 60 * 60_000;

export type BotVerdict = { human: true } | { human: false; reason: "honeypot" | "too-fast" | "stale" };

/**
 * @param honeypot   whatever arrived in the honeypot field
 * @param renderedAt whatever arrived in the timestamp field
 * @param now        current time in epoch milliseconds
 */
export function inspectSubmission(honeypot: unknown, renderedAt: unknown, now: number): BotVerdict {
  if (typeof honeypot === "string" && honeypot.trim().length > 0) return { human: false, reason: "honeypot" };
  // A missing or unreadable stamp is not held against the submission: an older
  // cached page, a script-blocking browser or a screen reader must still be
  // able to write to us. The honeypot still applies.
  const stamp = typeof renderedAt === "number" ? renderedAt : Number(renderedAt);
  if (!Number.isFinite(stamp) || stamp <= 0) return { human: true };
  const age = now - stamp;
  if (age < MIN_FILL_MILLISECONDS) return { human: false, reason: "too-fast" };
  if (age > MAX_FORM_AGE_MILLISECONDS) return { human: false, reason: "stale" };
  return { human: true };
}
