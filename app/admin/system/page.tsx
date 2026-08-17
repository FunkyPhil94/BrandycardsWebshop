"use client";

import { useState } from "react";
import { adminFetch } from "../admin-auth";
import { useAdminSitzung } from "../admin-shell";

/** Verbindungen und Sicherheit — selten gebraucht, deshalb hinten. */
export default function AdminSystemPage() {
  const { email } = useAdminSitzung();
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function createDesktopPairing() {
    setPairingBusy(true);
    setPairingCode(null);
    setPairingExpiresAt(null);
    setNote("");
    try {
      const response = await adminFetch("/api/admin/avatar/pairing", { method: "POST" });
      const body = await response.json() as { code?: string; expiresAt?: string; error?: string };
      if (!response.ok || !body.code) throw new Error(body.error ?? "Desktop-Avatar-Kopplung konnte nicht erstellt werden.");
      setPairingCode(body.code);
      setPairingExpiresAt(body.expiresAt ?? null);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Desktop-Avatar-Kopplung konnte nicht erstellt werden.");
    } finally {
      setPairingBusy(false);
    }
  }

  return <>
    <h1>System.</h1>

    <section className="admin-section">
      <h2>Zwei-Faktor-Anmeldung</h2>
      <div className="admin-security-banner" role="status">
        <span className="admin-security-dot" aria-hidden="true" />
        <div><strong>MFA aktiv</strong><span>Authenticator-App bestätigt · AAL2 · {email}</span></div>
      </div>
      <p className="privacy-note">
        Der gesamte Adminbereich steht hinter dieser Anmeldung. Eine <strong>erneute</strong> Codeabfrage
        verlangen nur noch Aktionen, die Zugang verschaffen, Geld bewegen oder Daten endgültig
        vernichten — eBay-Zustimmung, Gerätekopplung, Erstattung und das Löschen von Kartenangeboten.
        Alltagsarbeit fragt nicht mehr nach.
      </p>
    </section>

    <section className="admin-section avatar-pairing-panel">
      <div>
        <p className="eyebrow">DESKTOP-VERBINDUNG</p>
        <h2>Avatar auf diesem PC koppeln.</h2>
        <p>Erzeuge einen kurz gültigen Code und gib ihn einmalig in der Desktop-App ein. Es werden keine eBay- oder Cloudflare-Zugangsdaten übertragen.</p>
      </div>
      <button className="button button-outline" type="button" onClick={createDesktopPairing} disabled={pairingBusy}>{pairingBusy ? "Code wird erstellt …" : "Pairing-Code erzeugen"}</button>
      {pairingCode && <div className="avatar-pairing-code" role="status">
        <strong>{pairingCode}</strong>
        <span>Gültig bis {pairingExpiresAt ? new Date(pairingExpiresAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "bald"} Uhr · nur einmal verwendbar</span>
      </div>}
    </section>

    {note && <p className="form-feedback error" role="status">{note}</p>}
  </>;
}
