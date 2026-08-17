import { getAuthenticatedAppUser } from "./app-user";
import { getSupabaseAccessTokenClaims, type SupabaseAccessTokenClaims } from "./supabase-server";

type AdminAccessOptions = {
  requireMfa?: boolean;
  /** Verlangt eine **erneute** Bestätigung mit dem Authenticator-Code, wenn die
   *  letzte länger als so viele Sekunden zurückliegt.
   *
   * **Sparsam einsetzen.** Der ganze Adminbereich steht ohnehin hinter einer
   * Zwei-Faktor-Anmeldung (`aal2`, siehe unten); diese Option ist die
   * *zusätzliche* Nachfrage mitten in der Arbeit. Bis zum 2026-08-17 trug sie
   * fast jede schreibende Route — auch das Ablehnen eines Preisvorschlags und
   * das Umstellen eines Angebotsstatus. Damit wurde der Code zum Türsteher vor
   * der Alltagsarbeit, und ein Schutz, den man zwanzigmal am Tag wegtippt,
   * schützt nichts mehr: Er erzieht dazu, den Code reflexhaft einzugeben, ohne
   * hinzusehen, wofür.
   *
   * **Sie gehört an Aktionen, die Zugang verschaffen, Geld bewegen oder Daten
   * endgültig vernichten** — eBay-OAuth, Gerätekopplung, Erstattung, das
   * Löschen von Kartenangeboten samt Bildern. Dort ist die Nachfrage selten
   * genug, dass man beim Tippen noch überlegt.
   *
   * Alles andere kommt ohne aus: Statusänderungen, Produktpflege, Sync-Läufe.
   * Sie sind nachvollziehbar (`recordAdminAudit`) und umkehrbar.
   */
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
