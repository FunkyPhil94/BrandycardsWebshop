"use client";

import { useEffect, useState } from "react";
import { OffersPanel } from "./offers-panel";
import { OrdersPanel } from "./orders-panel";
import { OutboxPanel } from "./outbox-panel";
import { ProductsPanel } from "./products-panel";
import { RequestsPanel } from "./requests-panel";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { SiteFooter, SiteHeader } from "../site-chrome";

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
  const [oauthBusy, setOauthBusy] = useState(false);
  const [writeCheckBusy, setWriteCheckBusy] = useState(false);
  const [outboxBusy, setOutboxBusy] = useState(false);
  const [ebayToken, setEbayToken] = useState<string | null>(null);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});

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

  /** Holt den bei der eBay-Rückkehr geparkten Refresh-Token ab (SEC-12).
   *
   * Die Kennung steht in der Adresszeile, der Token nicht — er kommt nur gegen
   * eine gültige Adminsitzung heraus und ist danach aus der Datenbank
   * verschwunden. Die Kennung wird sofort aus der Adresszeile entfernt, damit
   * sie nicht im Verlauf stehen bleibt und ein Neuladen keine irreführende
   * Fehlermeldung erzeugt.
   */
  useEffect(() => {
    const claimId = new URLSearchParams(window.location.search).get("ebayClaim");
    if (!claimId) return;
    window.history.replaceState(null, "", window.location.pathname);
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Bitte melde dich zuerst an und starte „eBay OAuth verbinden“ erneut.");
        const response = await fetch("/api/admin/ebay/oauth/claim", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ claimId }),
        });
        const body = await response.json() as { refreshToken?: string; error?: string };
        if (!response.ok || !body.refreshToken) throw new Error(body.error ?? "Der Token konnte nicht abgeholt werden.");
        if (!cancelled) setEbayToken(body.refreshToken);
      } catch (error) {
        if (!cancelled) setSyncMessage(error instanceof Error ? error.message : "Der Token konnte nicht abgeholt werden.");
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
      const body = await response.json() as { error?: string; detail?: string; importedCount?: number; updatedCount?: number; skippedCount?: number; unchangedCount?: number; mergedCount?: number };
      if (!response.ok) throw new Error(body.detail ? `${body.error ?? "eBay-Synchronisierung fehlgeschlagen."} (${body.detail})` : body.error ?? "eBay-Synchronisierung fehlgeschlagen.");
      // „unverändert" gehört sichtbar dazu: Seit der Sync nur noch echte
      // Änderungen schreibt, meldet ein ruhiger Lauf 0 aktualisiert. Ohne die
      // Zahl daneben läse sich das wie ein Lauf, der nichts gesehen hat.
      //
      // Übernahmen stehen nur da, wenn es welche gab — dann aber deutlich:
      // Für den Betreiber verschwindet dabei eine Karte aus dem Vorverkauf,
      // die er selbst angelegt hat.
      const uebernommen = body.mergedCount ?? 0;
      setSyncMessage(`Sync abgeschlossen: ${body.importedCount ?? 0} importiert, ${body.updatedCount ?? 0} aktualisiert, ${body.unchangedCount ?? 0} unverändert, ${body.skippedCount ?? 0} übersprungen.`
        + (uebernommen ? ` ${uebernommen} Karte(n) aus dem Vorverkauf übernommen — sie laufen jetzt über eBay.` : ""));
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "eBay-Synchronisierung fehlgeschlagen.");
    } finally {
      setSyncBusy(false);
    }
  }

  /** Prüft, ob der hinterlegte eBay-Token schreiben darf.
   *
   * Muss hier stehen und nicht in einem Terminal: Die Adminrouten erkennen die
   * Anmeldung am `Authorization: Bearer`-Header, den nur ein Aufruf aus der
   * angemeldeten Oberfläche mitbringt. Eine URL in der Adresszeile oder ein
   * blanker `curl` bekämen 401 — unabhängig davon, wer davorsitzt.
   */
  async function checkEbayWrite() {
    setWriteCheckBusy(true);
    setSyncMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Bitte melde dich zuerst an.");
      const response = await fetch("/api/admin/ebay/write-check", { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json() as { ok?: boolean; detail?: string; writeEnabled?: boolean; error?: string };
      if (body.error) throw new Error(body.error);
      if (body.ok) {
        // Der Schalter gehört in dieselbe Meldung: Eine geglückte Anmeldung
        // heißt noch nicht, dass Aufträge auch ausgeführt werden.
        setSyncMessage(body.writeEnabled
          ? "eBay-Schreibzugriff steht: Anmeldung erfolgreich, und der Schreibpfad ist eingeschaltet."
          : "eBay-Schreibzugriff steht: Anmeldung erfolgreich. Ausgeführt wird noch nichts — EBAY_WRITE_ENABLED ist aus.");
        return;
      }
      // Ohne den nächsten Schritt wäre das nur ein roter Hinweis.
      setSyncMessage(`eBay-Schreibzugriff fehlt: ${body.detail ?? "Anmeldung abgelehnt."} — bitte einmal „eBay OAuth verbinden" ausführen, das erneuert die Zustimmung mit Schreibrecht.`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "eBay-Schreibzugriff konnte nicht geprüft werden.");
    } finally {
      setWriteCheckBusy(false);
    }
  }

  /** Arbeitet wartende eBay-Rücknahmen sofort ab, statt bis zum Cron zu warten. */
  async function runEbayOutbox() {
    setOutboxBusy(true);
    setSyncMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Bitte melde dich zuerst an.");
      const response = await fetch("/api/admin/ebay/outbox/run", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json() as { processed?: number; writeEnabled?: boolean; error?: string; detail?: string };
      if (!response.ok) throw new Error(body.detail ? `${body.error ?? "Fehlgeschlagen."} (${body.detail})` : body.error ?? "Fehlgeschlagen.");
      // Ohne den Schalterhinweis läse sich „0 abgearbeitet" wie „nichts zu tun",
      // während in Wahrheit der Schreibpfad aus ist.
      setSyncMessage(body.writeEnabled
        ? `eBay-Rücknahmen: ${body.processed ?? 0} abgearbeitet.`
        : `eBay-Rücknahmen: nichts ausgeführt — EBAY_WRITE_ENABLED ist aus. Wartende Aufträge bleiben liegen.`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "eBay-Rücknahmen fehlgeschlagen.");
    } finally {
      setOutboxBusy(false);
    }
  }

  async function connectEbay() {
    setOauthBusy(true);
    setSyncMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Bitte melde dich zuerst an.");
      const response = await fetch("/api/admin/ebay/oauth/start", { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json() as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "eBay OAuth konnte nicht gestartet werden.");
      window.location.assign(body.url);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "eBay OAuth konnte nicht gestartet werden.");
      setOauthBusy(false);
    }
  }

  return (
    <main>
      <SiteHeader />
      <section className="account-page">
      <Link className="back-link" href="/">← Zurück zum Shop</Link>
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
          <button className="button button-outline admin-sync-button" type="button" onClick={connectEbay} disabled={oauthBusy}>{oauthBusy ? "eBay OAuth wird gestartet …" : "eBay OAuth verbinden / Refresh-Token erstellen"}</button>
          <button className="button button-outline admin-sync-button" type="button" onClick={checkEbayWrite} disabled={writeCheckBusy}>{writeCheckBusy ? "eBay-Schreibzugriff wird geprüft …" : "eBay-Schreibzugriff prüfen"}</button>
          <button className="button button-outline admin-sync-button" type="button" onClick={runEbayOutbox} disabled={outboxBusy}>{outboxBusy ? "eBay-Rücknahmen laufen …" : "eBay-Rücknahmen jetzt ausführen"}</button>
          {syncMessage && <p className="form-feedback" role="status">{syncMessage}</p>}
          {/* Genau einmal sichtbar: Die Zeile in der Datenbank ist beim Abholen
              gelöscht worden. Wer die Seite neu lädt, sieht das hier nicht
              wieder — deshalb steht der nächste Schritt gleich dabei. */}
          {ebayToken && <div className="ebay-token" role="status">
            <h2>Refresh-Token erstellt</h2>
            <p>Hinterlege ihn in Cloudflare als Secret <strong>EBAY_REFRESH_TOKEN</strong>. Er wird <strong>nur dieses eine Mal</strong> angezeigt.</p>
            <textarea readOnly value={ebayToken} onFocus={(event) => event.currentTarget.select()} />
            <div className="ebay-token-actions">
              <button type="button" className="button button-outline" onClick={() => void navigator.clipboard.writeText(ebayToken)}>Token kopieren</button>
              <button type="button" className="button button-outline" onClick={() => setEbayToken(null)}>Ausblenden</button>
            </div>
          </div>}
          <OffersPanel />
          <ProductsPanel />
          <OrdersPanel />
          <RequestsPanel
            submissions={dashboard.recentSubmissions}
            assetUrls={assetUrls}
            onSubmissionDeleted={(id) => setDashboard((current) => current
              ? { ...current, recentSubmissions: current.recentSubmissions.filter((item) => item.id !== id), counts: { ...current.counts, cardSubmissions: Math.max(0, current.counts.cardSubmissions - 1) } }
              : current)}
          />
          <OutboxPanel />
        </> : <p className="form-feedback error" role="status">{message}</p>}
      </section>
      </section>
      <SiteFooter />
    </main>
  );
}
