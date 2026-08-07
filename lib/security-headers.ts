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
 * The CSP ships as `Report-Only` on purpose: a policy that is even slightly
 * too narrow takes the shop down, and the only way to find out is to watch a
 * real bundle under real traffic. Switch the header name to
 * `content-security-policy` once the reports are quiet — that is a deliberate
 * second step, not something to slip in.
 */
export const CSP_HEADER_NAME = "content-security-policy-report-only";

export function securityHeaders(supabaseUrl: string | undefined): Record<string, string> {
  return {
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
