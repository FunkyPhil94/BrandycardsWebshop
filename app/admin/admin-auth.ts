"use client";

import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

/** Ein Aufruf in den Adminbereich, der den Authenticator **nur dann** verlangt,
 *  wenn der Server ihn verlangt.
 *
 * Vorher rief jede schreibende Stelle `authHeaders(…, true)` und löste damit die
 * Code-Abfrage aus, *bevor* jemand geprüft hatte, ob sie nötig ist — auch wenn
 * die letzte Bestätigung zehn Sekunden alt war. Der Code stand dann zwanzigmal
 * am Tag im Weg, und ein Schutz, den man reflexhaft wegtippt, schützt nichts.
 *
 * Jetzt entscheidet **eine** Stelle, nämlich `requireAdmin` auf dem Server: Erst
 * wird gesendet, und nur bei `428` mit `RECENT_MFA_REQUIRED` wird der Code
 * geholt und der Aufruf einmal wiederholt. Wer innerhalb der Frist arbeitet,
 * wird gar nicht gefragt. Welche Aktionen die Nachfrage auslösen, steht in
 * `lib/admin-access.ts` — hier steht kein zweites Regelwerk daneben.
 *
 * `MFA_REQUIRED` (die Sitzung ist überhaupt nicht auf `aal2`) läuft durch
 * denselben Weg: Eine bestandene TOTP-Prüfung hebt die Sitzung an.
 */
export async function adminFetch(input: string, init: RequestInit & { json?: boolean } = {}) {
  const { json = false, headers: zusatz, ...rest } = init;
  const senden = async (frisch: boolean) => fetch(input, {
    ...rest,
    headers: { ...(await authHeaders(json, frisch)), ...(zusatz as Record<string, string> | undefined) },
  });

  const antwort = await senden(false);
  if (antwort.status !== 428) return antwort;
  const grund = await antwort.clone().json().catch(() => null) as { code?: string } | null;
  if (grund?.code !== "RECENT_MFA_REQUIRED" && grund?.code !== "MFA_REQUIRED") return antwort;
  return senden(true);
}

export async function authHeaders(json = false, freshMfa = false): Promise<HeadersInit> {
  const supabase = getSupabaseBrowserClient();
  if (freshMfa) {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((entry) => entry.status === "verified");
    if (factorsError || !factor) throw new Error("Bitte richte zuerst eine Authenticator-App für das Adminkonto ein.");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError || !challenge) throw new Error(challengeError?.message ?? "Der MFA-Code konnte nicht angefordert werden.");
    const code = window.prompt("Bitte den aktuellen 6-stelligen Code deiner Authenticator-App eingeben.")?.trim() ?? "";
    if (!/^\d{6}$/u.test(code)) throw new Error("Die erneute MFA-Bestätigung wurde abgebrochen.");
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
    if (verifyError) throw new Error("Der MFA-Code ist ungültig oder abgelaufen.");
    await supabase.auth.refreshSession();
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { "Content-Type": "application/json" } : {}) };
}
