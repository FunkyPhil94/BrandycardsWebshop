"use client";

import { useEffect, useState } from "react";
import { adminFetch, authHeaders } from "./admin-auth";
import { formatPrice } from "../site-chrome";

type AdminOffer = {
  id: string;
  productId: string;
  title: string;
  listPriceCents: number | null;
  amount: number;
  currency: string;
  message: string | null;
  status: string;
  createdAt: string;
  email: string | null;
};

export function OffersPanel() {
  const [offers, setOffers] = useState<AdminOffer[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // A counter rather than a callback: every state change happens after an
  // await, which keeps the effect free of synchronous setState cascades.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const response = await fetch("/api/admin/offers", { headers });
        if (!response.ok) throw new Error("failed");
        const data = await response.json() as { offers: AdminOffer[] };
        if (!cancelled) setOffers(data.offers);
      } catch {
        if (cancelled) return;
        setNote("Preisvorschläge konnten nicht geladen werden.");
        setOffers([]);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadToken]);

  async function decide(offerId: string, action: "accept" | "reject") {
    setBusy(offerId);
    setNote("");
    try {
      const response = await adminFetch("/api/admin/offers", {
        method: "POST",
        json: true,
        body: JSON.stringify({ offerId, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Entscheidung fehlgeschlagen.");
      setNote(action === "accept" ? "Angenommen. Der Preis gilt 48 Stunden." : "Abgelehnt.");
      setReloadToken((token) => token + 1);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Entscheidung fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  if (!offers) return null;

  return <section className="admin-section">
    <h2>Preisvorschläge ({offers.length})</h2>
    {note && <p className="form-feedback" role="status">{note}</p>}
    {offers.length === 0
      ? <p>Keine offenen Vorschläge.</p>
      : <div className="admin-offers">
          {offers.map((offer) => {
            const discount = offer.listPriceCents ? Math.round((1 - offer.amount / offer.listPriceCents) * 100) : null;
            return <article className="admin-offer" key={offer.id}>
              <strong>{offer.title}</strong>
              <div className="offer-row">
                <span>
                  {formatPrice(offer.amount, offer.currency)}
                  {offer.listPriceCents && <> statt {formatPrice(offer.listPriceCents, offer.currency)}{discount !== null && <> · −{discount}%</>}</>}
                </span>
                <span>{offer.email ?? "unbekannt"}</span>
              </div>
              {offer.message && <p className="offer-message">{`„${offer.message}“`}</p>}
              <div className="offer-actions">
                <button type="button" className="accept" disabled={busy === offer.id} onClick={() => decide(offer.id, "accept")}>
                  {busy === offer.id ? "…" : "Annehmen"}
                </button>
                <button type="button" className="reject" disabled={busy === offer.id} onClick={() => decide(offer.id, "reject")}>
                  Ablehnen
                </button>
              </div>
            </article>;
          })}
        </div>}
  </section>;
}
