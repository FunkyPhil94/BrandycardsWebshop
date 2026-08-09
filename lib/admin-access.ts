import { getAuthenticatedAppUser } from "./app-user";
import { getSupabaseAccessTokenClaims, type SupabaseAccessTokenClaims } from "./supabase-server";

type AdminAccessOptions = {
  requireMfa?: boolean;
  recentAuthSeconds?: number;
};

function jsonError(error: string, status: number, code?: string) {
  return new Response(JSON.stringify({ error, ...(code ? { code } : {}) }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function recentMfaTimestamp(claims: SupabaseAccessTokenClaims): number | null {
  if (!Array.isArray(claims.amr)) return null;
  const methods = claims.amr
    .map((entry) => typeof entry === "string" ? { method: entry } : entry)
    .filter((entry): entry is { method?: string; timestamp?: number } => Boolean(entry && typeof entry === "object"));
  const mfa = methods
    .filter((entry) => entry.method === "totp" || entry.method === "phone" || entry.method === "webauthn" || entry.method === "otp")
    .map((entry) => entry.timestamp)
    .filter((timestamp): timestamp is number => typeof timestamp === "number" && Number.isFinite(timestamp));
  return mfa.length ? Math.max(...mfa) : null;
}

export function hasRecentMfa(claims: SupabaseAccessTokenClaims, maxAgeSeconds: number, nowSeconds = Math.floor(Date.now() / 1000)) {
  const timestamp = recentMfaTimestamp(claims);
  return timestamp !== null && timestamp <= nowSeconds + 60 && nowSeconds - timestamp <= maxAgeSeconds;
}

export async function requireAdmin(request: Request, options: AdminAccessOptions = {}) {
  let user;
  try {
    user = await getAuthenticatedAppUser(request);
  } catch {
    return { response: jsonError("Authentifizierung konnte nicht geprüft werden.", 401) };
  }
  if (!user) return { response: jsonError("Nicht authentifiziert.", 401) };
  if (user.role !== "ADMIN") return { response: jsonError("Keine Berechtigung.", 403) };

  const claims = getSupabaseAccessTokenClaims(request);
  if (options.requireMfa !== false && claims.aal !== "aal2") {
    return { response: jsonError("Für den Administrationsbereich ist eine bestätigte Zwei-Faktor-Anmeldung erforderlich.", 428, "MFA_REQUIRED") };
  }
  if (options.recentAuthSeconds && !hasRecentMfa(claims, options.recentAuthSeconds)) {
    return { response: jsonError("Bitte bestätige deine Identität erneut mit dem Authenticator-Code.", 428, "RECENT_MFA_REQUIRED") };
  }
  return { response: undefined, user, claims };
}
