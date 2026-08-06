"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type Mode = "login" | "signup" | "reset";

export default function AccountPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [recovery, setRecovery] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery");

  async function syncProfile(sessionUser: User | null, accessToken?: string) {
    if (!sessionUser || !accessToken) return;
    await fetch("/api/account/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ username: sessionUser.user_metadata?.username }),
    });
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
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` });
        if (error) throw error;
        setMessage("Wenn ein Konto existiert, wurde eine E-Mail zum Zurücksetzen versendet.");
      } else if (mode === "signup") {
        const validation = await fetch("/api/account/validate-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, passwordConfirmation }),
        });
        const validationBody = await validation.json() as { error?: string };
        if (!validation.ok) throw new Error(validationBody.error ?? "Die Registrierungsdaten sind ungültig.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username }, emailRedirectTo: `${window.location.origin}/account` },
        });
        if (error) throw error;
        setMessage(data.session ? "Konto erstellt." : "Bitte bestätige deine E-Mail-Adresse.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await syncProfile(data.user, data.session?.access_token);
        setMessage("Anmeldung erfolgreich.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Anmeldung konnte nicht verarbeitet werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-page">
      <Link className="back-link" href="/">← Zurück zu BrandyCards</Link>
      <section className="account-card" aria-labelledby="account-title">
        <p className="eyebrow">BRANDYCARDS ACCOUNT</p>
        {user && <div className="account-session"><span>Angemeldet als</span><strong>{user.email}</strong><button type="button" onClick={signOut}>Abmelden</button></div>}
        <h1 id="account-title">{recovery ? "Neues Passwort festlegen." : mode === "login" ? "Willkommen zurück." : mode === "signup" ? "Konto erstellen." : "Passwort zurücksetzen."}</h1>
        <p>{recovery ? "Wähle ein neues Passwort und bestätige es." : mode === "signup" ? "Speichere Bestellungen und verwalte deine Anfragen." : mode === "reset" ? "Wir senden dir einen sicheren Link per E-Mail." : "Melde dich an, um deine Bestellungen und Anfragen zu sehen."}</p>
        <form onSubmit={submit}>
          {!recovery && <label className="form-field"><span>E-Mail-Adresse *</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>}
          {!recovery && mode === "signup" && <label className="form-field"><span>Benutzername *</span><input type="text" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" autoComplete="username" /></label>}
          {(!recovery && mode === "reset") ? null : <label className="form-field"><span>{recovery ? "Neues Passwort *" : "Passwort *"}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "signup" || recovery ? "new-password" : "current-password"} /></label>}
          {(recovery || mode === "signup") && <label className="form-field"><span>Passwort bestätigen *</span><input type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" /></label>}
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Bitte warten …" : recovery ? "Neues Passwort speichern" : mode === "login" ? "Anmelden" : mode === "signup" ? "Konto erstellen" : "Reset-Link senden"}</button>
        </form>
        {message && <p className="form-feedback" role="status">{message}</p>}
        <div className="account-links">
          {!recovery && mode === "login" && <><button type="button" onClick={() => setMode("signup")}>Neues Konto erstellen</button><button type="button" onClick={() => setMode("reset")}>Passwort vergessen?</button></>}
          {!recovery && mode !== "login" && <button type="button" onClick={() => setMode("login")}>Zur Anmeldung</button>}
        </div>
      </section>
    </main>
  );
}
