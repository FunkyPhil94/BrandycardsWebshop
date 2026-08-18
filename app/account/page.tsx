"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { useKontoSitzung } from "./account-shell";
import { useI18n } from "../i18n";

type Mode = "login" | "signup" | "reset";

function safeReturnPath() {
  if (typeof window === "undefined") return "/";
  const requested = new URLSearchParams(window.location.search).get("next");
  if (requested && requested.startsWith("/") && !requested.startsWith("//")) return requested;
  const referrer = document.referrer;
  if (referrer) {
    try {
      const url = new URL(referrer);
      if (url.origin === window.location.origin && url.pathname !== "/account") return `${url.pathname}${url.search}${url.hash}`;
    } catch { /* Ignore malformed referrers. */ }
  }
  return "/";
}

/** Der Einstieg ins Konto: angemeldet die Übersicht, abgemeldet die Anmeldung.
 *
 * **Beides bleibt hier zusammen.** Ein eigener Pfad für die Anmeldung würde
 * jeden Verweis auf `/account` zu einer Weiche machen und die Rückkehr aus den
 * Supabase-Mails (Bestätigung, Passwort-Reset) über eine Weiterleitung schicken.
 */
export default function AccountPage() {
  const { user, bereit } = useKontoSitzung();
  const [recovery, setRecovery] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery");

  useEffect(() => {
    try {
      const { data: listener } = getSupabaseBrowserClient().auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
      });
      return () => listener.subscription.unsubscribe();
    } catch {
      return undefined;
    }
  }, []);

  if (!bereit) return null;
  if (user && !recovery) return <Uebersicht />;
  return <Anmeldung recovery={recovery} beendeRecovery={() => setRecovery(false)} />;
}

/** Die Übersicht führt weiter, sie wiederholt nichts.
 *
 * Bewusst **ohne Zahlen**: Sie stünden für drei Abfragen, die nur dazu dienen,
 * eine Ziffer neben eine Verknüpfung zu setzen — und wären beim ersten Blick
 * nach einer Bestellung schon veraltet. Wer wissen will, was ansteht, ist einen
 * Klick entfernt.
 */
function Uebersicht() {
  const { t } = useI18n();
  return <>
    <h1>{t("Dein Konto.")}</h1>
    <p>{t("Hier findest du deine Bestellungen, deine Preisvorschläge, die Karten, die du uns angeboten hast, und deine gespeicherten Daten.")}</p>
    <div className="account-tiles">
      <Link href="/account/bestellungen">
        <strong>{t("Meine Bestellungen")}</strong>
        <span>{t("Stand, Beträge und Sendungsverfolgung")}</span>
      </Link>
      <Link href="/account/preisvorschlaege">
        <strong>{t("Meine Preisvorschläge")}</strong>
        <span>{t("Was du geboten hast und wie wir entschieden haben")}</span>
      </Link>
      <Link href="/account/kartenangebote">
        <strong>{t("Meine angebotenen Karten")}</strong>
        <span>{t("Karten, die du uns zum Ankauf geschickt hast")}</span>
      </Link>
      <Link href="/account/profil">
        <strong>{t("Mein Profil")}</strong>
        <span>{t("Sprache und Angaben zu deinem Konto")}</span>
      </Link>
      <Link href="/account/daten">
        <strong>{t("Meine Daten")}</strong>
        <span>{t("Auskunft herunterladen oder Konto löschen")}</span>
      </Link>
    </div>
  </>;
}

function Anmeldung({ recovery, beendeRecovery }: { recovery: boolean; beendeRecovery: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (recovery) {
        if (password !== passwordConfirmation) throw new Error(t("Die Passwörter stimmen nicht überein."));
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        beendeRecovery();
        setPassword("");
        setPasswordConfirmation("");
        setMessage(t("Dein Passwort wurde erfolgreich geändert. Das alte Passwort ist nicht mehr gültig."));
      } else if (mode === "reset") {
        const returnPath = safeReturnPath();
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account?next=${encodeURIComponent(returnPath)}` });
        if (error) throw error;
        setMessage(t("Wenn ein Konto existiert, wurde eine E-Mail zum Zurücksetzen versendet."));
      } else if (mode === "signup") {
        // Length and equality are decided here; the password is never sent to
        // our own server, only to Supabase. See docs/security-findings.md, SEC-07.
        if (password.length < 8) throw new Error(t("Das Passwort muss mindestens 8 Zeichen lang sein."));
        if (password !== passwordConfirmation) throw new Error(t("Die Passwörter stimmen nicht überein."));
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/account?next=${encodeURIComponent(safeReturnPath())}` },
        });
        if (error) throw error;
        if (data.session) window.location.assign(safeReturnPath());
        else setMessage(t("Bitte bestätige deine E-Mail-Adresse."));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(safeReturnPath());
      }
    } catch (error) {
      setMessage(error instanceof Error ? t(error.message) : t("Die Anmeldung konnte nicht verarbeitet werden."));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <h1 id="account-title">{t(recovery ? "Neues Passwort festlegen." : mode === "login" ? "Willkommen zurück." : mode === "signup" ? "Konto erstellen." : "Passwort zurücksetzen.")}</h1>
    <p>{t(recovery ? "Wähle ein neues Passwort und bestätige es." : mode === "signup" ? "Speichere Bestellungen und verwalte deine Anfragen." : mode === "reset" ? "Wir senden dir einen sicheren Link per E-Mail." : "Melde dich an, um deine Bestellungen und Anfragen zu sehen.")}</p>
    <form onSubmit={submit}>
      {!recovery && <label className="form-field"><span>{t("E-Mail-Adresse *")}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>}
      {(!recovery && mode === "reset") ? null : <label className="form-field"><span>{t(recovery ? "Neues Passwort *" : "Passwort *")}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "signup" || recovery ? "new-password" : "current-password"} /></label>}
      {(recovery || mode === "signup") && <label className="form-field"><span>{t("Passwort bestätigen *")}</span><input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" /></label>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? t("Bitte warten …") : t(recovery ? "Neues Passwort speichern" : mode === "login" ? "Anmelden" : mode === "signup" ? "Konto erstellen" : "Reset-Link senden")}</button>
    </form>
    {message && <p className="form-feedback" role="status">{message}</p>}
    <div className="account-links">
      {!recovery && mode === "login" && <><button type="button" onClick={() => setMode("signup")}>{t("Neues Konto erstellen")}</button><button type="button" onClick={() => setMode("reset")}>{t("Passwort vergessen?")}</button></>}
      {!recovery && mode !== "login" && <button type="button" onClick={() => setMode("login")}>{t("Zur Anmeldung")}</button>}
    </div>
  </>;
}
