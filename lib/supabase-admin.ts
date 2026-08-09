/** Der einzige Ort, an dem der Service-Role-Key benutzt wird.
 *
 * Der Key darf bei Supabase **alles** — er umgeht jede Zeilenregel. Er liegt
 * als Cloudflare-Secret, erreicht nie den Browser und wird hier nur für einen
 * einzigen Aufruf gebraucht: das Löschen eines Anmeldekontos auf Wunsch des
 * Kunden. Die Kundenanmeldung selbst läuft weiter über den öffentlichen
 * Schlüssel in `lib/supabase-server.ts`.
 */

export type SupabaseDeleteResult =
  | { ok: true }
  /** Kein Key hinterlegt. Kein Fehler, sondern der Zustand vor der
   *  Einrichtung — der Aufrufer muss dann abbrechen, statt halb zu löschen. */
  | { ok: false; grund: "nicht-konfiguriert" }
  | { ok: false; grund: "abgelehnt"; status: number; detail: string }
  | { ok: false; grund: "unerreichbar"; detail: string };

export function hasSupabaseAdminAccess(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function deleteSupabaseUser(authSubject: string): Promise<SupabaseDeleteResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, grund: "nicht-konfiguriert" };

  try {
    const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(authSubject)}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    // 404 heißt: Das Konto ist bei Supabase schon weg. Für den Aufrufer ist das
    // dasselbe Ergebnis wie ein erfolgreicher Löschlauf — sonst bliebe ein
    // Kunde nach einem halb durchgelaufenen Versuch für immer hängen.
    if (response.ok || response.status === 404) return { ok: true };
    return { ok: false, grund: "abgelehnt", status: response.status, detail: (await response.text()).slice(0, 300) };
  } catch (error) {
    return { ok: false, grund: "unerreichbar", detail: error instanceof Error ? error.message : String(error) };
  }
}
