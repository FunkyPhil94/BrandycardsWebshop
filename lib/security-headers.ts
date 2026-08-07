/** Security response headers for every answer the Worker gives.
 *
 * They belong here rather than in `public/_headers`, because that file only
 * covers static assets — and every page of this shop is rendered by the
 * Worker. See docs/security-findings.md, SEC-06.
 */

/** Where the browser may load things from.
 *
 * Derived from what the shop actually uses:
 * - `img-src`  eBay's CDN serves every card photo; `data:` covers the
 *              sanitiser's allowance for inline images in descriptions
 * - `connect-src` Supabase Auth is called straight from the browser
 * - `style-src` React and vinext emit inline styles, so `'unsafe-inline'`
 *              stays until that changes
 * - `frame-ancestors 'none'` no page of this shop belongs in someone else's
 *              frame; it is the modern form of X-Frame-Options
 */
export function contentSecurityPolicy(supabaseUrl: string | undefined) {
  const supabase = supabaseUrl?.trim().replace(/\/+$/, "");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https://i.ebayimg.com https://*.ebayimg.com https://funkyphil94.github.io",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}`,
    "script-src 'self' 'unsafe-inline'",
  ].join("; ");
}

/**
 * Enforcing since 2026-08-07, after every page was walked under this exact
 * policy against a production build.
 *
 * **Be honest about what it does and does not buy.** vinext emits eight inline
 * `<script>` blocks per page (RSC parameters, navigation state, the browser
 * entry import), so `script-src` has to carry `'unsafe-inline'` — and that
 * also permits inline event handlers. An `<img onerror=…>` injected through a
 * future hole of the SEC-01 kind would still **run**.
 *
 * What it does buy is the second half of such an attack: `script-src 'self'`
 * blocks loading a script from another origin, and `connect-src` limits where
 * anything can be sent to this origin and Supabase. A stolen session token has
 * no easy way out. Together with `frame-ancestors`, `object-src` and
 * `base-uri`, that is real defence in depth — just not the whole wall.
 *
 * The whole wall needs nonces instead of `'unsafe-inline'`, which means
 * rewriting every inline script tag on the way out. See docs/ai-todo.md.
 */
export const CSP_HEADER_NAME = "content-security-policy";

/**
 * HSTS, deliberately in its cautious form.
 *
 * Measured on 2026-08-07: the production response carried no
 * `strict-transport-security` at all, so a visitor's *first* request of a
 * session could still be pushed to plain HTTP on a hostile network — and this
 * shop carries addresses and a session token.
 *
 * What is **not** in here, and why:
 * - no `includeSubDomains`: this would bind every other host under
 *   `brandycards.de` to HTTPS as well, including ones this project knows
 *   nothing about. Not our call to make from here.
 * - no `preload`: that is the one genuinely hard step to undo, because it means
 *   asking browser vendors to bake the rule in.
 *
 * Backing out: set `max-age=0`, deploy, and browsers drop the rule the next
 * time they visit. That works precisely because `preload` is absent.
 */
const HSTS = "max-age=31536000";

export function securityHeaders(supabaseUrl: string | undefined): Record<string, string> {
  return {
    "strict-transport-security": HSTS,
    "x-content-type-options": "nosniff",
    // Keeps the full card URL from travelling to eBay's CDN with every image.
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    // frame-ancestors covers modern browsers; this covers the rest.
    "x-frame-options": "DENY",
    [CSP_HEADER_NAME]: contentSecurityPolicy(supabaseUrl),
  };
}

/** Adds the headers without touching any the route set deliberately. */
export function withSecurityHeaders(response: Response, supabaseUrl: string | undefined): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(supabaseUrl))) {
    if (!headers.has(name)) headers.set(name, value);
  }
  // A 101 or 204 carries no body and rejects a rebuilt Response.
  if (response.status === 101 || response.status === 204 || response.status === 304) {
    return new Response(null, { status: response.status, statusText: response.statusText, headers });
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
