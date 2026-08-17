"use client";

import { FormEvent, useEffect, useState } from "react";
import { NurAngemeldet, useKontoSitzung } from "../account-shell";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { useI18n } from "../../i18n";
import { isLocale } from "../../../lib/i18n";

export default function KontoProfilPage() {
  return <NurAngemeldet><Profil /></NurAngemeldet>;
}

function Profil() {
  const { user, token } = useKontoSitzung();
  const { t, locale, setLocale } = useI18n();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Der gespeicherte Stand kommt vom Server, nicht aus den Supabase-Metadaten:
  // Bei einem Namen, der schon vergeben war, unterscheiden sich beide.
  useEffect(() => {
    if (!user) return;
    let abgebrochen = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/profile", { headers: { Authorization: `Bearer ${await token()}` } });
        if (!response.ok) return;
        const body = await response.json() as { username?: string | null; displayName?: string | null; preferredLocale?: unknown };
        if (abgebrochen) return;
        setUsername(body.username ?? user.user_metadata?.username ?? "");
        setDisplayName(body.displayName ?? user.user_metadata?.displayName ?? "");
        if (isLocale(body.preferredLocale)) setLocale(body.preferredLocale);
      } catch {
        // Die Felder bleiben leer; Speichern funktioniert trotzdem.
      }
    })();
    return () => { abgebrochen = true; };
  }, [setLocale, token, user]);

  async function speichern(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ data: { username, displayName } });
      if (error) throw error;
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, preferredLocale: locale }),
      });
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? t("Das Profil konnte nicht gespeichert werden."));
      setMessage(t("Dein Profil wurde gespeichert."));
    } catch (error) {
      setMessage(error instanceof Error ? t(error.message) : t("Das Profil konnte nicht gespeichert werden."));
    } finally {
      setBusy(false);
    }
  }

  return <section className="profile-panel" aria-labelledby="profile-title">
    <h1 id="profile-title">{t("Mein Profil")}</h1>
    <form onSubmit={speichern}>
      {/* Die E-Mail-Adresse identifiziert das Konto bei Supabase und wird hier
          nur angezeigt. Damit das sichtbar ist statt sich erst beim Tippen zu
          zeigen, ist sie als `disabled` markiert und nicht bloß `readOnly`.
          Letzteres nimmt den Fokus an und verweigert dann stumm die Eingabe. */}
      <label className="form-field"><span>{t("E-Mail-Adresse")}</span><input type="email" value={user?.email ?? ""} disabled /><small>{t("Die E-Mail-Adresse deines Kontos lässt sich hier nicht ändern.")}</small></label>
      <label className="form-field"><span>{t("Benutzername *")}</span><input type="text" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" /><small>{t("3 bis 30 Zeichen: nur Buchstaben, Zahlen und Unterstrich (_).")}</small></label>
      <label className="form-field"><span>{t("Anzeigename")}</span><input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} /></label>
      <label className="form-field"><span>{t("Sprache des Kontos")}</span><select value={locale} onChange={(event) => { const next = event.target.value; if (next === "de" || next === "en") setLocale(next); }}><option value="de">{t("Deutsch")}</option><option value="en">{t("English")}</option></select><small>{t("Diese Auswahl gilt auch auf anderen Geräten und für deine Kundenmails.")}</small></label>
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? t("Speichere …") : t("Profil speichern")}</button>
    </form>
    {message && <p className="form-feedback" role="status">{message}</p>}
  </section>;
}
