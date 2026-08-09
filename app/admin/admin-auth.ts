"use client";

import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

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
