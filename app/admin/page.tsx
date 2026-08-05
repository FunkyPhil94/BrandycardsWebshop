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
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

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

  async function runEbaySync() {
    setSyncBusy(true);
    setSyncMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Bitte melde dich zuerst an.");
      const response = await fetch("/api/admin/ebay-sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json() as { error?: string; importedCount?: number; updatedCount?: number; skippedCount?: number };
      if (!response.ok) throw new Error(body.error ?? "eBay-Synchronisierung fehlgeschlagen.");
      setSyncMessage(`Sync abgeschlossen: ${body.importedCount ?? 0} importiert, ${body.updatedCount ?? 0} aktualisiert, ${body.skippedCount ?? 0} übersprungen.`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "eBay-Synchronisierung fehlgeschlagen.");
    } finally {
      setSyncBusy(false);
    }
  }

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
          <button className="button button-primary admin-sync-button" type="button" onClick={runEbaySync} disabled={syncBusy}>{syncBusy ? "eBay-Sync läuft …" : "eBay-Angebote synchronisieren"}</button>
          {syncMessage && <p className="form-feedback" role="status">{syncMessage}</p>}
          <p className="form-feedback">Weitere Verwaltungsfunktionen werden als nächster Schritt ergänzt.</p>
        </> : <p className="form-feedback error" role="status">{message}</p>}
      </section>
    </main>
  );
}
