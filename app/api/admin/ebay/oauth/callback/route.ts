/** NOTE (docs/security-findings.md, SEC-12): this route deliberately has no
 * `requireAdmin` check, and adding one would break the flow rather than secure
 * it — eBay redirects the *browser* here, and a navigation carries no
 * `Authorization` header, which is where this app's Supabase session lives.
 *
 * What guards it instead: `state` is HMAC-signed with EBAY_CLIENT_SECRET,
 * valid for ten minutes, and only ever handed out by the admin-protected
 * `/start` route; eBay's `code` is single-use. The residual risk is an
 * attacker who reads `code` and `state` out of a proxy log or browser history
 * and replays them before the admin's own browser arrives — seconds, in
 * practice.
 *
 * Closing it properly means not printing the token in the response to the
 * redirect at all: park the exchange behind a short-lived claim id and let the
 * signed-in admin area fetch the token with its Bearer token. That needs a
 * place to park it, i.e. a migration, so it is left as an open finding rather
 * than half-built.
 */
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function validState(state: string) {
  const parts = state.split(".");
  if (parts.length !== 3 || !Number.isFinite(Number(parts[0])) || Date.now() - Number(parts[0]) > 10 * 60 * 1000) return false;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts[0]}.${parts[1]}`)));
  let binary = "";
  signature.forEach((byte) => { binary += String.fromCharCode(byte); });
  const expected = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return expected === parts[2];
}

function page(title: string, body: string) {
  return new Response(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui;max-width:760px;margin:48px auto;padding:0 20px;color:#17181b}textarea{width:100%;min-height:150px;font:14px monospace}button{padding:12px 18px}</style><h1>${escapeHtml(title)}</h1>${body}`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (error) return page("eBay-Anmeldung abgebrochen", `<p>${escapeHtml(error)}</p>`);
  if (!code || !state || !(await validState(state))) return page("eBay OAuth fehlgeschlagen", "<p>Der OAuth-Link ist ungültig oder abgelaufen. Bitte im Adminbereich erneut starten.</p>");
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const runame = process.env.EBAY_RUNAME;
  if (!clientId || !clientSecret || !runame) return page("eBay OAuth fehlgeschlagen", "<p>eBay OAuth ist serverseitig nicht vollständig konfiguriert.</p>");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: runame }),
  });
  const result = await response.json() as { refresh_token?: string; error_description?: string };
  if (!response.ok || !result.refresh_token) return page("eBay OAuth fehlgeschlagen", `<p>${escapeHtml(result.error_description || `HTTP ${response.status}`)}</p>`);
  return page("Refresh-Token erstellt", `<p>Der Refresh-Token wurde für dein Production-Keyset erstellt. Kopiere ihn in Cloudflare als Secret <strong>EBAY_REFRESH_TOKEN</strong>. Diese Seite nicht weitergeben.</p><textarea id="token" readonly>${escapeHtml(result.refresh_token)}</textarea><p><button onclick="navigator.clipboard.writeText(document.getElementById('token').value)">Token kopieren</button></p><p>Danach kannst du dieses Fenster schließen und im Adminbereich synchronisieren.</p>`);
}
