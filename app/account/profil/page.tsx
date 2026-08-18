"use client";

import { FormEvent, useEffect, useState } from "react";
import { NurAngemeldet, useKontoSitzung } from "../account-shell";
import { useI18n } from "../../i18n";
import { isLocale } from "../../../lib/i18n";

/** Was am Konto einstellbar ist — und das ist wenig, mit Absicht.
 *
 * Bis zum 2026-08-17 standen hier ein Benutzer- und ein Anzeigename. Beide
 * wurden **nirgends** angezeigt: nicht in E-Mails, nicht in Bestellungen, nicht
 * im Adminbereich. Der Versand nutzt die Adresse aus der Bestellung, die
 * Anmeldung die E-Mail. Zwei Felder, die nur sich selbst verwalteten — dafür
 * personenbezogene Daten ohne Zweck und ein eindeutiger Index, der bei einer
 * Namenskollision das ganze Konto hätte sperren können (U5 in docs/ai-todo.md).
 */
export default function KontoProfilPage() {
  return <NurAngemeldet><Profil /></NurAngemeldet>;
}

function Profil() {
  const { user, token } = useKontoSitzung();
  const { t, locale, setLocale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Die im Konto hinterlegte Sprache gilt auch auf anderen Geräten und für die
  // Kundenmails — deshalb kommt sie vom Server und nicht aus diesem Browser.
  useEffect(() => {
    if (!user) return;
    let abgebrochen = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/profile", { headers: { Authorization: `Bearer ${await token()}` } });
        if (!response.ok) return;
        const body = await response.json() as { preferredLocale?: unknown };
        if (abgebrochen) return;
        if (isLocale(body.preferredLocale)) setLocale(body.preferredLocale);
      } catch {
        // Die Auswahl dieses Browsers bleibt gültig; Speichern funktioniert weiter.
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
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLocale: locale }),
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
      <label className="form-field"><span>{t("Sprache des Kontos")}</span><select value={locale} onChange={(event) => { const next = event.target.value; if (next === "de" || next === "en") setLocale(next); }}><option value="de">{t("Deutsch")}</option><option value="en">{t("English")}</option></select><small>{t("Diese Auswahl gilt auch auf anderen Geräten und für deine Kundenmails.")}</small></label>
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? t("Speichere …") : t("Profil speichern")}</button>
    </form>
    {message && <p className="form-feedback" role="status">{message}</p>}
  </section>;
}
