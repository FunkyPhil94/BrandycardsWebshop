"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { SiteFooter, SiteHeader } from "../site-chrome";

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

export default function AccountPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [recovery, setRecovery] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery");

  async function syncProfile(sessionUser: User | null, accessToken?: string, profile?: { username?: string; displayName?: string }) {
    if (!sessionUser || !accessToken) return;
    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ username: profile?.username ?? sessionUser.user_metadata?.username, displayName: profile?.displayName ?? sessionUser.user_metadata?.displayName }),
    });
    if (response.ok) {
      const body = await response.json() as { username?: string | null; displayName?: string | null };
      setUsername(body.username ?? profile?.username ?? sessionUser.user_metadata?.username ?? "");
      setDisplayName(body.displayName ?? profile?.displayName ?? sessionUser.user_metadata?.displayName ?? "");
    }
  }

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth.getSession().then(({ data }) => {
        setUser(data.session?.user ?? null);
        void syncProfile(data.session?.user ?? null, data.session?.access_token);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        setUser(session?.user ?? null);
        void syncProfile(session?.user ?? null, session?.access_token);
      });
      return () => listener.subscription.unsubscribe();
    } catch {
      return undefined;
    }
  }, []);

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setMessage("Du wurdest abgemeldet.");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.updateUser({ data: { username, displayName } });
      if (error) throw error;
      await syncProfile(data.user, (await supabase.auth.getSession()).data.session?.access_token, { username, displayName });
      setUser(data.user);
      setMessage("Dein Profil wurde gespeichert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Das Profil konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (recovery) {
        if (password !== passwordConfirmation) throw new Error("Die Passwörter stimmen nicht überein.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecovery(false);
        setPassword("");
        setPasswordConfirmation("");
        setMessage("Dein Passwort wurde erfolgreich geändert. Das alte Passwort ist nicht mehr gültig.");
      } else if (mode === "reset") {
        const returnPath = safeReturnPath();
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account?next=${encodeURIComponent(returnPath)}` });
        if (error) throw error;
        setMessage("Wenn ein Konto existiert, wurde eine E-Mail zum Zurücksetzen versendet.");
      } else if (mode === "signup") {
        // Length and equality are decided here; the password is never sent to
        // our own server, only to Supabase. See docs/security-findings.md, SEC-07.
        if (password.length < 8) throw new Error("Das Passwort muss mindestens 8 Zeichen lang sein.");
        if (password !== passwordConfirmation) throw new Error("Die Passwörter stimmen nicht überein.");
        const validation = await fetch("/api/account/validate-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        const validationBody = await validation.json() as { error?: string };
        if (!validation.ok) throw new Error(validationBody.error ?? "Die Registrierungsdaten sind ungültig.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username }, emailRedirectTo: `${window.location.origin}/account?next=${encodeURIComponent(safeReturnPath())}` },
        });
        if (error) throw error;
        if (data.session) window.location.assign(safeReturnPath());
        else setMessage("Bitte bestätige deine E-Mail-Adresse.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await syncProfile(data.user, data.session?.access_token);
        window.location.assign(safeReturnPath());
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Anmeldung konnte nicht verarbeitet werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <SiteHeader />
      <section className="account-page">
      <Link className="back-link" href="/">← Zurück zum Shop</Link>
      <section className="account-card" aria-labelledby="account-title">
        <p className="eyebrow">BRANDYCARDS ACCOUNT</p>
        {user && !recovery && <>
          <div className="account-session"><span>Angemeldet als</span><strong>{user.email}</strong><button type="button" onClick={signOut}>Abmelden</button></div>
          <section className="profile-panel" aria-labelledby="profile-title">
            <h2 id="profile-title">Mein Profil</h2>
            <form onSubmit={saveProfile}>
              {/* Die E-Mail-Adresse identifiziert das Konto bei Supabase und
                  wird hier nur angezeigt. Damit das sichtbar ist statt sich
                  erst beim Tippen zu zeigen, ist sie als `disabled` markiert
                  und nicht bloß `readOnly` — Letzteres nimmt den Fokus an und
                  verweigert dann stumm die Eingabe. */}
              <label className="form-field"><span>E-Mail-Adresse</span><input type="email" value={user.email ?? ""} disabled /><small>Die E-Mail-Adresse deines Kontos lässt sich hier nicht ändern.</small></label>
              <label className="form-field"><span>Benutzername *</span><input type="text" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" /><small>3–30 Zeichen: nur Buchstaben, Zahlen und Unterstrich (_).</small></label>
              <label className="form-field"><span>Anzeigename</span><input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} /></label>
              <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Speichere …" : "Profil speichern"}</button>
            </form>
          </section>
        </>}
        {(!user || recovery) && <>
          <h1 id="account-title">{recovery ? "Neues Passwort festlegen." : mode === "login" ? "Willkommen zurück." : mode === "signup" ? "Konto erstellen." : "Passwort zurücksetzen."}</h1>
          <p>{recovery ? "Wähle ein neues Passwort und bestätige es." : mode === "signup" ? "Speichere Bestellungen und verwalte deine Anfragen." : mode === "reset" ? "Wir senden dir einen sicheren Link per E-Mail." : "Melde dich an, um deine Bestellungen und Anfragen zu sehen."}</p>
          <form onSubmit={submit}>
            {!recovery && <label className="form-field"><span>E-Mail-Adresse *</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>}
            {!recovery && mode === "signup" && <label className="form-field"><span>Benutzername *</span><input type="text" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" autoComplete="username" /><small>3–30 Zeichen: nur Buchstaben, Zahlen und Unterstrich (_).</small></label>}
            {(!recovery && mode === "reset") ? null : <label className="form-field"><span>{recovery ? "Neues Passwort *" : "Passwort *"}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "signup" || recovery ? "new-password" : "current-password"} /></label>}
            {(recovery || mode === "signup") && <label className="form-field"><span>Passwort bestätigen *</span><input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" /></label>}
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Bitte warten …" : recovery ? "Neues Passwort speichern" : mode === "login" ? "Anmelden" : mode === "signup" ? "Konto erstellen" : "Reset-Link senden"}</button>
          </form>
        </>}
        {message && <p className="form-feedback" role="status">{message}</p>}
        {(!user || recovery) && <div className="account-links">
          {!recovery && mode === "login" && <><button type="button" onClick={() => setMode("signup")}>Neues Konto erstellen</button><button type="button" onClick={() => setMode("reset")}>Passwort vergessen?</button></>}
          {!recovery && mode !== "login" && <button type="button" onClick={() => setMode("login")}>Zur Anmeldung</button>}
        </div>}
      </section>
      </section>
      <SiteFooter />
    </main>
  );
}
