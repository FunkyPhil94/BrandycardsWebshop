import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
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
  url.searchParams.set("scope", process.env.EBAY_WRITE_OAUTH_SCOPE || "https://api.ebay.com/oauth/api_scope/sell.inventory");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "login");
  return NextResponse.json({ url: url.toString() }, { headers: { "cache-control": "no-store" } });
}
