/** NOTE (docs/security-findings.md, SEC-12): this route deliberately has no
 * `requireAdmin` check, and adding one would break the flow rather than secure
 * it — eBay redirects the *browser* here, and a navigation carries no
 * `Authorization` header, which is where this app's Supabase session lives.
 *
 * What guards it instead: `state` is HMAC-signed with EBAY_CLIENT_SECRET,
 * valid for ten minutes, and only ever handed out by the admin-protected
 * `/start` route; eBay's `code` is single-use.
 *
 * **SEC-12 ist seit dem 2026-08-09 geschlossen.** Der Refresh-Token steht nicht
 * mehr in der Antwort auf die Umleitung. Er wird unter einer kurzlebigen
 * Anspruchs-Kennung in `ebay_oauth_claims` geparkt; abholen kann ihn nur der
 * angemeldete Adminbereich über `/api/admin/ebay/oauth/claim`, und die Zeile
 * wird dabei gelöscht. Wer die Kennung aus einem Protokoll fischt, hält damit
 * nichts in der Hand — ohne Adminsitzung gibt sie nichts heraus.
 */
import { getDb } from "../../../../../../db";
import { ebayOauthClaims } from "../../../../../../db/schema";

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

  // Der Token wandert in die Ablage statt auf diese Seite. Zehn Minuten Frist:
  // lang genug, um in den Adminbereich zu wechseln, kurz genug, dass eine
  // vergessene Zeile nicht tagelang einen gültigen Token trägt.
  try {
    const db = getDb();
    const claimId = crypto.randomUUID().replaceAll("-", "");
    await db.insert(ebayOauthClaims).values({
      id: claimId,
      refreshToken: result.refresh_token,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    // Weiterleitung in den Adminbereich: Dort liegt die Supabase-Sitzung, mit
    // der sich der Token abholen lässt. Die Kennung darf in der Adresszeile
    // stehen — allein ist sie wertlos.
    return new Response(null, {
      status: 303,
      headers: { location: `/admin?ebayClaim=${claimId}`, "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("eBay OAuth claim konnte nicht gespeichert werden", error);
    // **Bewusst ohne Rückfall auf die alte Anzeige.** Den Token hier doch noch
    // auszugeben, hieße die Lücke im Fehlerfall wieder aufzureißen — und der
    // Fehlerfall ist genau der, in dem niemand hinsieht. Lieber der Weg zurück
    // über „eBay OAuth verbinden": Der kostet zwei Klicks.
    return page("Token konnte nicht übergeben werden", "<p>Die Anmeldung bei eBay hat geklappt, das Ablegen des Tokens nicht. Bitte im Adminbereich „eBay OAuth verbinden“ noch einmal starten.</p>");
  }
}
