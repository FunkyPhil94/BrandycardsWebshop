"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type Dashboard = {
  user: { email: string; role: string };
  counts: { products: number; inquiries: number; cardSubmissions: number; orders: number };
  recentSubmissions: Array<{ id: string; email: string; name: string | null; title: string; status: string; createdAt: string; assets: Array<{ id: string; originalName: string; mimeType: string; byteSize: number }> }>;
};

export default function AdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("Lade Administrationsbereich …");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [deletingSubmission, setDeletingSubmission] = useState<string | null>(null);

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
        if (!cancelled) {
          const nextDashboard = body as Dashboard;
          setDashboard(nextDashboard);
          const entries = await Promise.all(nextDashboard.recentSubmissions.flatMap((submission) => submission.assets.map(async (asset) => {
            const imageResponse = await fetch(`/api/admin/card-submissions/assets?assetId=${encodeURIComponent(asset.id)}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!imageResponse.ok) return null;
            return [asset.id, URL.createObjectURL(await imageResponse.blob())] as const;
          })));
          if (!cancelled) setAssetUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Zugriff verweigert.");
      }
    })();
    return () => {
      cancelled = true;
      setAssetUrls((current) => { Object.values(current).forEach((url) => URL.revokeObjectURL(url)); return {}; });
    };
  }, []);

  async function deleteSubmission(submissionId: string) {
    if (!window.confirm("Dieses Kartenangebot und alle zugehörigen Bilder endgültig löschen?")) return;
    setDeletingSubmission(submissionId);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Bitte melde dich zuerst an.");
      const response = await fetch(`/api/admin/card-submissions?submissionId=${encodeURIComponent(submissionId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Löschen fehlgeschlagen.");
      setDashboard((current) => current ? { ...current, recentSubmissions: current.recentSubmissions.filter((item) => item.id !== submissionId), counts: { ...current.counts, cardSubmissions: Math.max(0, current.counts.cardSubmissions - 1) } } : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setDeletingSubmission(null);
    }
  }

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
          <div className="admin-submissions">
            <h2>Neue Kartenangebote</h2>
            {dashboard.recentSubmissions.length === 0 ? <p className="form-feedback">Noch keine Angebote eingegangen.</p> : dashboard.recentSubmissions.map((submission) => <article key={submission.id} className="admin-submission"><div><strong>{submission.title}</strong><span>{submission.email}{submission.name ? ` · ${submission.name}` : ""}</span><div className="admin-submission-images">{submission.assets.map((asset) => assetUrls[asset.id] ? <img key={asset.id} src={assetUrls[asset.id]} alt={`Eingesendetes Bild zu ${submission.title}`} loading="lazy" /> : null)}</div></div><div className="admin-submission-meta"><span>{submission.assets.length} Bild(er)</span><span>{submission.status}</span><button type="button" onClick={() => void deleteSubmission(submission.id)} disabled={deletingSubmission === submission.id}>{deletingSubmission === submission.id ? "Löschen …" : "Angebot löschen"}</button></div></article>)}
          </div>
          <p className="form-feedback">Weitere Verwaltungsfunktionen werden als nächster Schritt ergänzt.</p>
        </> : <p className="form-feedback error" role="status">{message}</p>}
      </section>
    </main>
  );
}
