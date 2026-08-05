"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type Mode = "login" | "signup" | "reset";

export default function AccountPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  async function syncProfile(sessionUser: User | null, accessToken?: string) {
    if (!sessionUser || !accessToken) return;
    await fetch("/api/account/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth.getSession().then(({ data }) => {
        setUser(data.session?.user ?? null);
        void syncProfile(data.session?.user ?? null, data.session?.access_token);
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
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
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` });
        if (error) throw error;
        setMessage("Wenn ein Konto existiert, wurde eine E-Mail zum Zurücksetzen versendet.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/account` } });
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
        <h1 id="account-title">{mode === "login" ? "Willkommen zurück." : mode === "signup" ? "Konto erstellen." : "Passwort zurücksetzen."}</h1>
        <p>{mode === "signup" ? "Speichere Bestellungen und verwalte deine Anfragen." : mode === "reset" ? "Wir senden dir einen sicheren Link per E-Mail." : "Melde dich an, um deine Bestellungen und Anfragen zu sehen."}</p>
        <form onSubmit={submit}>
          <label className="form-field"><span>E-Mail-Adresse *</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          {mode !== "reset" && <label className="form-field"><span>Passwort *</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>}
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Bitte warten …" : mode === "login" ? "Anmelden" : mode === "signup" ? "Konto erstellen" : "Reset-Link senden"}</button>
        </form>
        {message && <p className="form-feedback" role="status">{message}</p>}
        <div className="account-links">
          {mode === "login" && <><button type="button" onClick={() => setMode("signup")}>Neues Konto erstellen</button><button type="button" onClick={() => setMode("reset")}>Passwort vergessen?</button></>}
          {mode !== "login" && <button type="button" onClick={() => setMode("login")}>Zur Anmeldung</button>}
        </div>
      </section>
    </main>
  );
}
