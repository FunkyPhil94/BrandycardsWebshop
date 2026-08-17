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
 *              sanitiser's allowance for inline images in descriptions;
 *              `blob:` covers the admin console — siehe unten
 * - `connect-src` Supabase Auth is called straight from the browser
 * - `style-src` allows only the per-response nonce on inline style blocks;
 *              style attributes are not used by the shop
 * - `frame-ancestors 'none'` no page of this shop belongs in someone else's
 *              frame; it is the modern form of X-Frame-Options
 */
export function contentSecurityPolicy(supabaseUrl: string | undefined, nonce?: string) {
  const supabase = supabaseUrl?.trim().replace(/\/+$/, "");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // `blob:` ist kein Zugeständnis nach außen: Solche Adressen entstehen nur im
    // Browser selbst, aus Daten, die diese Seite bereits geladen hat. Die
    // Adminkonsole braucht sie, weil die eingesendeten Kartenbilder hinter einer
    // angemeldeten Abfrage liegen (`/api/admin/card-submissions/assets` verlangt
    // den Adminkopf). Ein `<img src="/api/…">` käme dort unangemeldet an, also
    // holt `app/admin/page.tsx` das Bild per `fetch` und macht daraus ein
    // Objekt-URL. Ohne diese Erlaubnis blockiert der Browser jedes davon —
    // **genau das war bis zum 2026-08-17 der Fall**: In `/admin` stand bei jedem
    // Kartenangebot nur das Ersatzsymbol. `'self'` deckt `blob:` nicht ab, das
    // ist ein eigenes Schema.
    "img-src 'self' data: blob: https://i.ebayimg.com https://*.ebayimg.com https://funkyphil94.github.io",
    nonce ? `style-src 'self' 'nonce-${nonce}'` : "style-src 'self'",
    "font-src 'self' data:",
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}`,
    // Ohne Zufallswert — also überall dort, wo keine Seite ausgeliefert wird —
    // bleibt nur `'self'`. Aus einer JSON-Antwort oder einem Bild führt niemand
    // Skripte aus; `'unsafe-inline'` verschwindet damit aus **allen** Antworten.
    nonce ? `script-src 'self' 'nonce-${nonce}'` : "script-src 'self'",
  ].join("; ");
}

/** Ein Zufallswert je Antwort für die Inline-Skripte.
 *
 * **Je Antwort neu, sonst ist er wertlos** — ein wiederverwendeter Wert steht
 * einem Angreifer genauso zur Verfügung wie `'unsafe-inline'`.
 *
 * 16 Bytes aus `crypto.getRandomValues`, Base64. Das ist die von der
 * Spezifikation empfohlene Untergrenze (128 Bit).
 */
export function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** Ob diese Antwort eine Seite ist, in der Skript-Tags stehen können.
 *
 * Der `HTMLRewriter` darf **nur** hier laufen: Auf JSON, Bildern oder Assets
 * wäre er sinnlose Arbeit an jedem Byte. Und Antworten ohne Rumpf (101, 204,
 * 304) lassen sich nicht umschreiben — eine 304 ist dabei der heikle Fall, weil
 * der Rumpf dann aus dem Zwischenspeicher des Browsers käme und der frische
 * Zufallswert nicht mehr zum alten Markup passte. Am 2026-08-08 nachgemessen:
 * HTML dieses Shops trägt weder `cache-control` noch `etag`, wird also nie
 * revalidiert. Die Prüfung steht hier trotzdem — sie kostet nichts und fängt
 * den Tag ab, an dem jemand HTML zwischenspeichern lässt.
 */
export function isHtmlResponse(response: Response) {
  if (response.status === 101 || response.status === 204 || response.status === 304) return false;
  return (response.headers.get("content-type") ?? "").toLowerCase().includes("text/html");
}

/**
 * Enforcing since 2026-08-07, without `'unsafe-inline'` for scripts since
 * 2026-08-08.
 *
 * **Was sich am 2026-08-08 geändert hat und warum es zählt:** Bis dahin trug
 * `script-src` ein `'unsafe-inline'`, weil vinext seine Inline-`<script>`-Blöcke
 * je Seite ausliefert. Damit waren zugleich **Inline-Eventhandler erlaubt** —
 * ein eingeschleustes `<img onerror=…>` wäre gelaufen, genau die Form von
 * SEC-01. Jetzt bekommt jedes `<script>` auf dem Weg nach draußen einen
 * Zufallswert (`worker/index.ts`), und die Regel nennt nur noch diesen. **Ein
 * Eventhandler in einem Attribut kann keinen Zufallswert tragen** — er ist
 * damit tot, und das ist der ganze Gewinn dieser Änderung.
 *
 * **Kein `'strict-dynamic'`, und das ist eine Entscheidung, keine
 * Nachlässigkeit.** Es würde `'self'` unwirksam machen; alles, was diese Seite
 * nachlädt, kommt aber von dieser Herkunft und ist damit von `'self'` gedeckt.
 * Der Gewinn wäre null, der Preis eine zusätzliche Abhängigkeit. Erst wenn je
 * ein fremdes Skript nötig wird, ist `'strict-dynamic'` der nächste Schritt.
 *
 * Was die Regel schon vorher leistete und weiter leistet: `script-src 'self'`
 * verbietet fremde Skripte, `connect-src` begrenzt jedes Übertragungsziel auf
 * diese Herkunft und Supabase. Ein gestohlenes Sitzungstoken kommt schwer
 * heraus. Zusammen mit `frame-ancestors`, `object-src` und `base-uri` ist das
 * Tiefenverteidigung.
 *
 * Inline-Style-Blöcke erhalten denselben Nonce wie Skripte. Das letzte
 * Style-Attribut im React-Code wurde in eine CSS-Klasse verschoben, damit
 * `style-src` ohne `'unsafe-inline'` auskommt.
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

export function securityHeaders(supabaseUrl: string | undefined, nonce?: string): Record<string, string> {
  return {
    "strict-transport-security": HSTS,
    "x-content-type-options": "nosniff",
    // Keeps the full card URL from travelling to eBay's CDN with every image.
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    // frame-ancestors covers modern browsers; this covers the rest.
    "x-frame-options": "DENY",
    [CSP_HEADER_NAME]: contentSecurityPolicy(supabaseUrl, nonce),
  };
}

/** Adds the headers without touching any the route set deliberately. */
export function withSecurityHeaders(response: Response, supabaseUrl: string | undefined, nonce?: string): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(supabaseUrl, nonce))) {
    if (!headers.has(name)) headers.set(name, value);
  }
  // A 101 or 204 carries no body and rejects a rebuilt Response.
  if (response.status === 101 || response.status === 204 || response.status === 304) {
    return new Response(null, { status: response.status, statusText: response.statusText, headers });
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
