"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../admin-auth";
import { OutboxPanel } from "../outbox-panel";

/** Alles, was mit eBay zu tun hat — an einer Stelle und **mit Erklärung**.
 *
 * Vorher standen diese vier Schaltflächen fast gleich aussehend untereinander auf
 * der Startseite der Adminkonsole, und man musste raten, welche gerade die
 * richtige ist. Der Unterschied zwischen „Angebote holen" und „Rücknahmen
 * ausführen" ist die Richtung des Schreibzugriffs — das ist zu wichtig, um es
 * aus dem Namen eines Knopfes zu erschließen.
 */
export default function AdminEbayPage() {
  const [syncBusy, setSyncBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [writeCheckBusy, setWriteCheckBusy] = useState(false);
  const [outboxBusy, setOutboxBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [ebayToken, setEbayToken] = useState<string | null>(null);

  /** Holt den bei der eBay-Rückkehr geparkten Refresh-Token ab (SEC-12).
   *
   * Die Kennung steht in der Adresszeile, der Token nicht — er kommt nur gegen
   * eine gültige Adminsitzung heraus und ist danach aus der Datenbank
   * verschwunden. Die Kennung wird sofort aus der Adresszeile entfernt, damit
   * sie nicht im Verlauf stehen bleibt und ein Neuladen keine irreführende
   * Fehlermeldung erzeugt.
   *
   * Die Rückkehr von eBay zeigt auf **diesen** Bereich
   * (`app/api/admin/ebay/oauth/callback/route.ts`).
   */
  useEffect(() => {
    const claimId = new URLSearchParams(window.location.search).get("ebayClaim");
    if (!claimId) return;
    window.history.replaceState(null, "", window.location.pathname);
    let cancelled = false;
    void (async () => {
      try {
        const response = await adminFetch("/api/admin/ebay/oauth/claim", {
          method: "POST",
          json: true,
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
      const response = await adminFetch("/api/admin/ebay-sync", { method: "POST" });
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
      const response = await adminFetch("/api/admin/ebay/write-check");
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
      const response = await adminFetch("/api/admin/ebay/outbox/run", { method: "POST" });
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
      const response = await adminFetch("/api/admin/ebay/oauth/start");
      const body = await response.json() as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "eBay OAuth konnte nicht gestartet werden.");
      window.location.assign(body.url);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "eBay OAuth konnte nicht gestartet werden.");
      setOauthBusy(false);
    }
  }

  return <>
    <h1>eBay.</h1>

    <div className="admin-actions">
      <div className="admin-action">
        <div>
          <strong>Angebote holen</strong>
          <span>Liest den aktuellen Stand bei eBay und schreibt ihn in den Katalog. Ändert bei eBay nichts.</span>
        </div>
        <button className="button button-primary" type="button" onClick={runEbaySync} disabled={syncBusy}>{syncBusy ? "Sync läuft …" : "Synchronisieren"}</button>
      </div>

      <div className="admin-action">
        <div>
          <strong>Rücknahmen ausführen</strong>
          <span>Arbeitet wartende Änderungen <em>zu eBay hin</em> ab, statt auf den Lauf alle drei Minuten zu warten. Nur wirksam, wenn der Schreibpfad eingeschaltet ist.</span>
        </div>
        <button className="button button-outline" type="button" onClick={runEbayOutbox} disabled={outboxBusy}>{outboxBusy ? "Läuft …" : "Jetzt ausführen"}</button>
      </div>

      <div className="admin-action">
        <div>
          <strong>Schreibzugriff prüfen</strong>
          <span>Fragt bei eBay nach, ob der hinterlegte Token schreiben darf. Verändert nichts — der erste Schritt, wenn Rücknahmen liegen bleiben.</span>
        </div>
        <button className="button button-outline" type="button" onClick={checkEbayWrite} disabled={writeCheckBusy}>{writeCheckBusy ? "Wird geprüft …" : "Prüfen"}</button>
      </div>

      <div className="admin-action">
        <div>
          <strong>Zustimmung erneuern</strong>
          <span>Führt durch die eBay-Anmeldung und erzeugt einen neuen Refresh-Token. Nötig, wenn die Prüfung oben den Schreibzugriff verweigert.</span>
        </div>
        <button className="button button-outline" type="button" onClick={connectEbay} disabled={oauthBusy}>{oauthBusy ? "Wird gestartet …" : "OAuth verbinden"}</button>
      </div>
    </div>

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

    <OutboxPanel />
  </>;
}
