"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch, authHeaders } from "./admin-auth";
import { Lightbox } from "../lightbox";

type Inquiry = {
  id: string;
  email: string;
  name: string | null;
  title: string;
  text: string | null;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  productTitle: string | null;
};

const ANFRAGE_LABEL: Record<string, string> = {
  NEW: "Neu", IN_REVIEW: "In Prüfung", RESPONDED: "Beantwortet", CLOSED: "Geschlossen", SPAM: "Spam",
};

/** Die Stände, die ein Kartenangebot annehmen kann.
 *
 * `REJECTED` und `CLOSED` starten zugleich die 90-Tage-Löschfrist
 * (`lib/retention.ts`) — das steht in der Oberfläche daneben, sonst löscht der
 * geplante Lauf später etwas, womit niemand gerechnet hat. */
const ANGEBOT_LABEL: Record<string, string> = {
  NEW: "Neu", IN_REVIEW: "In Prüfung", NEEDS_INFO: "Rückfrage", ACCEPTED: "Angekauft", REJECTED: "Abgelehnt", CLOSED: "Geschlossen",
};
const LOESCHFRIST_STARTET = new Set(["REJECTED", "CLOSED"]);

function datum(wert: string | null) {
  if (!wert) return null;
  const zeit = new Date(wert);
  return Number.isNaN(zeit.getTime()) ? wert : zeit.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export type Submission = { id: string; email: string; name: string | null; title: string; text?: string | null; requestedAmountCents?: number | null; status: string; createdAt: string; assets: Array<{ id: string }> };

const EURO = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** Die Preisvorstellung des Anbieters — oder der ausdrückliche Hinweis, dass
 *  keine genannt wurde.
 *
 * „Keine Preisvorstellung" muss dastehen und darf nicht einfach fehlen: Das
 * Feld ist im Formular freiwillig, und eine leere Stelle wäre nicht von einem
 * Anzeigefehler zu unterscheiden — was sie bis zum 2026-08-17 auch war. */
function preis(cents: number | null | undefined) {
  return typeof cents === "number" && Number.isFinite(cents) ? EURO.format(cents / 100) : "keine Preisvorstellung";
}

/** Anfragen und Kartenangebote bearbeiten statt nur zählen (ai-todo Punkt 12.4). */
export function RequestsPanel({ submissions, assetUrls, onSubmissionDeleted }: {
  submissions: Submission[];
  assetUrls: Record<string, string>;
  onSubmissionDeleted: (id: string) => void;
}) {
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [stati, setStati] = useState<Record<string, string>>({});
  /** Bilder, die der Browser nicht darstellen konnte.
   *
   * Das Ersatzsymbol des Browsers sagt nicht, *warum* nichts zu sehen ist — es
   * sieht bei einer blockierten Adresse genauso aus wie bei einer Datei, die
   * gar kein Bild enthält. Am 2026-08-17 hat genau diese Ununterscheidbarkeit
   * eine lange Fehlersuche gekostet: Die CSP verbot `blob:` (behoben), und
   * zugleich lagen fünf Testdateien ohne Bilddaten im Speicher. Steht der Grund
   * dabei, ist das beim nächsten Mal in einer Sekunde entschieden. */
  const [unlesbar, setUnlesbar] = useState<Record<string, true>>({});
  /** Das Bild, das gerade groß angezeigt wird — oder keines.
   *
   * Dieselbe Lightbox wie auf der Kartendetailseite (`app/karten/[id]/page.tsx`,
   * Klassen `.lightbox` / `.lightbox-close`). Bewusst keine zweite Lösung: Zwei
   * Vergrößerungen für dasselbe Problem wären doppelte Pflege und liefen beim
   * nächsten Umbau auseinander. */
  const [grossbild, setGrossbild] = useState<{ url: string; alt: string } | null>(null);

  // Escape und die Scrollsperre stecken in der Lightbox selbst.
  const grossbildSchliessen = useCallback(() => setGrossbild(null), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/inquiries", { headers: await authHeaders() });
        const data = await response.json() as { inquiries?: Inquiry[]; error?: string };
        if (!response.ok || !data.inquiries) throw new Error(data.error ?? "Anfragen konnten nicht geladen werden.");
        if (!cancelled) setInquiries(data.inquiries);
      } catch (error) {
        if (cancelled) return;
        setNote(error instanceof Error ? error.message : "Anfragen konnten nicht geladen werden.");
        setInquiries([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function anfrageSetzen(id: string, status: string) {
    setBusy(id);
    setNote("");
    try {
      const response = await adminFetch("/api/admin/inquiries", { method: "PATCH", json: true, body: JSON.stringify({ id, status }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Fehlgeschlagen.");
      setInquiries((current) => current?.map((eintrag) => eintrag.id === id ? { ...eintrag, status } : eintrag) ?? current);
      setNote(`Anfrage auf „${ANFRAGE_LABEL[status] ?? status}“ gesetzt.`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function angebotSetzen(submissionId: string, status: string) {
    setBusy(submissionId);
    setNote("");
    try {
      const response = await adminFetch("/api/admin/card-submissions", { method: "PATCH", json: true, body: JSON.stringify({ submissionId, status }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Fehlgeschlagen.");
      setStati((current) => ({ ...current, [submissionId]: status }));
      setNote(LOESCHFRIST_STARTET.has(status)
        ? `Angebot auf „${ANGEBOT_LABEL[status] ?? status}“ gesetzt. Es wird samt Bildern in 90 Tagen automatisch gelöscht.`
        : `Angebot auf „${ANGEBOT_LABEL[status] ?? status}“ gesetzt.`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function angebotLoeschen(submissionId: string) {
    if (!window.confirm("Dieses Kartenangebot und alle zugehörigen Bilder endgültig löschen?")) return;
    setBusy(submissionId);
    try {
      const response = await adminFetch(`/api/admin/card-submissions?submissionId=${encodeURIComponent(submissionId)}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen.");
      onSubmissionDeleted(submissionId);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  return <section className="admin-section">
    <h2>Anfragen &amp; Kartenangebote</h2>
    {note && <p className="form-feedback" role="status">{note}</p>}

    <h3 className="admin-subheading">Anfragen{inquiries ? ` (${inquiries.length})` : ""}</h3>
    {!inquiries ? <p className="form-feedback">Lade …</p>
      : inquiries.length === 0 ? <p className="form-feedback">Noch keine Anfragen eingegangen.</p>
      : <div className="admin-requests">
          {inquiries.map((eintrag) => <article className="admin-request" key={eintrag.id}>
            <div className="admin-request-head">
              <strong>{eintrag.title}</strong>
              <span>{datum(eintrag.createdAt)}</span>
            </div>
            <p className="admin-request-from">{eintrag.email}{eintrag.name ? ` · ${eintrag.name}` : ""}{eintrag.productTitle ? ` · zu: ${eintrag.productTitle}` : ""}</p>
            {eintrag.text && <p className="admin-request-text">{eintrag.text}</p>}
            <div className="admin-request-actions">
              <select value={eintrag.status} disabled={busy === eintrag.id} onChange={(event) => void anfrageSetzen(eintrag.id, event.target.value)}>
                {Object.entries(ANFRAGE_LABEL).map(([wert, label]) => <option key={wert} value={wert}>{label}</option>)}
              </select>
              <a className="text-link" href={`mailto:${eintrag.email}?subject=${encodeURIComponent(`Deine Anfrage: ${eintrag.title}`)}`}>Antworten <span>↗</span></a>
            </div>
          </article>)}
        </div>}

    <h3 className="admin-subheading">Kartenangebote ({submissions.length})</h3>
    {submissions.length === 0 ? <p className="form-feedback">Noch keine Angebote eingegangen.</p>
      : <div className="admin-requests">
          {submissions.map((angebot) => {
            const status = stati[angebot.id] ?? angebot.status;
            return <article className="admin-request" key={angebot.id}>
              <div className="admin-request-head">
                <strong>{angebot.title}</strong>
                <span>{datum(angebot.createdAt)}</span>
              </div>
              <p className="admin-request-from">{angebot.email}{angebot.name ? ` · ${angebot.name}` : ""} · {angebot.assets.length} Bild(er) · <strong>{preis(angebot.requestedAmountCents)}</strong></p>
              {angebot.text && <p className="admin-request-text">{angebot.text}</p>}
              <div className="admin-submission-images">
                {angebot.assets.map((asset) => {
                  if (!assetUrls[asset.id]) return <span key={asset.id} className="admin-submission-image-broken">Bild nicht abrufbar</span>;
                  if (unlesbar[asset.id]) return <span key={asset.id} className="admin-submission-image-broken">Datei ist kein Bild</span>;
                  const alt = `Eingesendetes Bild zu ${angebot.title}`;
                  // Eine Schaltfläche, kein anklickbares Bild: So ist die
                  // Vergrößerung auch mit der Tastatur erreichbar.
                  return <button key={asset.id} type="button" className="admin-submission-thumb"
                    onClick={() => setGrossbild({ url: assetUrls[asset.id], alt })} aria-label={`${alt} vergrößern`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrls[asset.id]} alt={alt} loading="lazy"
                      onError={() => setUnlesbar((current) => ({ ...current, [asset.id]: true }))} />
                  </button>;
                })}
              </div>
              <div className="admin-request-actions">
                <select value={status} disabled={busy === angebot.id} onChange={(event) => void angebotSetzen(angebot.id, event.target.value)}>
                  {Object.entries(ANGEBOT_LABEL).map(([wert, label]) => <option key={wert} value={wert}>{label}</option>)}
                </select>
                {LOESCHFRIST_STARTET.has(status) && <span className="admin-request-hint">Löschung samt Bildern in 90 Tagen</span>}
                <a className="text-link" href={`mailto:${angebot.email}?subject=${encodeURIComponent(`Dein Kartenangebot: ${angebot.title}`)}`}>Antworten <span>↗</span></a>
                <button type="button" className="admin-request-delete" disabled={busy === angebot.id} onClick={() => void angebotLoeschen(angebot.id)}>Löschen</button>
              </div>
            </article>;
          })}
        </div>}

    {grossbild && <Lightbox key={grossbild.url} src={grossbild.url} alt={grossbild.alt} label={grossbild.alt} onClose={grossbildSchliessen} zoombar />}
  </section>;
}
