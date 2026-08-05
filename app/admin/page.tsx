"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type Dashboard = {
  user: { email: string; role: string };
  counts: { products: number; inquiries: number; cardSubmissions: number; orders: number };
};

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("Lade Administrationsbereich …");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (!cancelled) setMessage("Bitte melde dich zuerst an.");
          return;
        }
        const response = await fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${token}` } });
        const body = await response.json() as { error?: string } & Partial<Dashboard>;
        if (!response.ok) throw new Error(body.error ?? "Zugriff verweigert.");
        if (!cancelled) setDashboard(body as Dashboard);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Zugriff verweigert.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="account-page">
      <Link className="back-link" href="/">← Zurück zu BrandyCards</Link>
      <section className="account-card admin-card" aria-labelledby="admin-title">
        <p className="eyebrow">BRANDYCARDS ADMIN</p>
        <h1 id="admin-title">Übersicht.</h1>
        {dashboard ? <>
          <p>Angemeldet als <strong>{dashboard.user.email}</strong>.</p>
          <div className="admin-stats">
            <div><strong>{dashboard.counts.products}</strong><span>Produkte</span></div>
            <div><strong>{dashboard.counts.inquiries}</strong><span>Anfragen</span></div>
            <div><strong>{dashboard.counts.cardSubmissions}</strong><span>Kartenangebote</span></div>
            <div><strong>{dashboard.counts.orders}</strong><span>Bestellungen</span></div>
          </div>
          <p className="form-feedback">Weitere Verwaltungsfunktionen werden als nächster Schritt ergänzt.</p>
        </> : <p className="form-feedback error" role="status">{message}</p>}
      </section>
    </main>
  );
}
