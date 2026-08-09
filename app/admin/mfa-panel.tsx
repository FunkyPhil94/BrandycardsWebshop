"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

export function MfaPanel({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("Lade MFA-Status …");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await getSupabaseBrowserClient().auth.mfa.listFactors();
      if (error) { setNote("Der MFA-Status konnte nicht geladen werden."); return; }
      const verified = data.totp.find((factor) => factor.status === "verified");
      setFactorId(verified?.id ?? null);
      setNote(verified ? "Deine Authenticator-App ist eingerichtet. Bestätige den aktuellen Code, um den Adminbereich zu öffnen." : "Für den Adminbereich ist jetzt eine Authenticator-App erforderlich.");
    })();
  }, []);

  async function einrichten() {
    setBusy(true);
    setNote("");
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.mfa.enroll({ factorType: "totp", friendlyName: "BrandyCards Admin" });
      if (error || !data || data.type !== "totp") throw new Error(error?.message ?? "Die Authenticator-App konnte nicht eingerichtet werden.");
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setNote("Scanne den QR-Code mit deiner Authenticator-App und gib danach den 6-stelligen Code ein.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Die Authenticator-App konnte nicht eingerichtet werden.");
    } finally { setBusy(false); }
  }

  async function bestaetigen() {
    if (!factorId || !/^\d{6}$/u.test(code)) { setNote("Bitte einen 6-stelligen Code eingeben."); return; }
    setBusy(true);
    setNote("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) throw new Error(challengeError?.message ?? "Der MFA-Code konnte nicht angefordert werden.");
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (error) throw new Error("Der MFA-Code ist ungültig oder abgelaufen.");
      await supabase.auth.refreshSession();
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aal || aal.currentLevel !== "aal2") throw new Error("Die Zwei-Faktor-Anmeldung wurde noch nicht bestätigt.");
      onVerified();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Die MFA-Bestätigung ist fehlgeschlagen.");
    } finally { setBusy(false); }
  }

  return <section className="account-card admin-card admin-mfa-card" aria-labelledby="admin-mfa-title">
    <p className="eyebrow">BRANDYCARDS ADMIN</p>
    <h1 id="admin-mfa-title">Zwei-Faktor-Schutz.</h1>
    <p>Für kritische Shop- und eBay-Aktionen muss zusätzlich zum Passwort ein Code aus deiner Authenticator-App bestätigt werden.</p>
    {qrCode
      ? <div className="admin-mfa-enrollment">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="QR-Code für die BrandyCards-Authenticator-App" />
          {secret && <p className="admin-mfa-secret">Falls der Scan nicht funktioniert: <code>{secret}</code></p>}
        </div>
      : !factorId && <button className="button button-primary" type="button" onClick={() => void einrichten()} disabled={busy}>Authenticator-App einrichten</button>}
    {factorId && <label className="form-field admin-mfa-code"><span>6-stelliger Authenticator-Code</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/gu, "").slice(0, 6))} autoComplete="one-time-code" /></label>}
    {factorId && <button className="button button-primary" type="button" onClick={() => void bestaetigen()} disabled={busy || !/^\d{6}$/u.test(code)}>{busy ? "Wird geprüft …" : "Adminbereich öffnen"}</button>}
    {note && <p className="form-feedback" role="status">{note}</p>}
  </section>;
}
