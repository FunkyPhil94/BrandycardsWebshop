import { NextResponse } from "next/server";
import { recordAdminAudit } from "../../../../../../lib/admin-audit";
import { requireAdmin } from "../../../../../../lib/admin-access";

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string) {
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!secret) throw new Error("EBAY_CLIENT_SECRET fehlt.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

/** Welche Rechte bei der Zustimmung angefragt werden.
 *
 * Bis Phase 8 war das dieselbe Zeichenkette wie der Schreib-Scope — und genau
 * daran scheitern die Aufrufzahlen: `sell.analytics.readonly` war nie Teil der
 * Zustimmung, und einem bereits ausgestellten Refresh-Token lässt sich ein
 * Scope nicht nachträglich anheften. Der einzige Weg führt über eine neue
 * Zustimmung mit erweiterter Liste.
 *
 * **Die Voreinstellung ändert nichts.** Ohne `EBAY_OAUTH_CONSENT_SCOPES` wird
 * exakt derselbe eine Scope angefragt wie bisher; der bestehende Token bleibt
 * gültig und muss nicht erneuert werden. Wer die Aufrufzahlen freischalten
 * will, setzt die Variable auf beide Scopes, durchläuft die Zustimmung erneut
 * und hinterlegt den neuen Refresh-Token — bewusst ein ausdrücklicher
 * Handgriff des Kontoinhabers und keine stille Rechteausweitung.
 */
function consentScopes() {
  const configured = process.env.EBAY_OAUTH_CONSENT_SCOPES?.trim();
  if (configured) return configured.split(/\s+/u).join(" ");
  return process.env.EBAY_WRITE_OAUTH_SCOPE || "https://api.ebay.com/oauth/api_scope/sell.inventory";
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request, { recentAuthSeconds: 600 });
  if (auth.response) return auth.response;
  const clientId = process.env.EBAY_CLIENT_ID;
  const runame = process.env.EBAY_RUNAME;
  if (!clientId || !runame) return NextResponse.json({ error: "eBay OAuth ist noch nicht vollständig konfiguriert." }, { status: 503 });
  const payload = `${Date.now()}.${base64Url(crypto.getRandomValues(new Uint8Array(18)))}`;
  const state = `${payload}.${await sign(payload)}`;
  const url = new URL("https://auth.ebay.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", runame);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", consentScopes());
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "login");
  await recordAdminAudit({ request, actorUserId: auth.user.id, action: "ebay.oauth_start", entityType: "ebay_oauth" });
  return NextResponse.json({ url: url.toString() }, { headers: { "cache-control": "no-store" } });
}
