"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { formatPrice } from "../../site-chrome";

type Offer = {
  id: string;
  amount: number;
  currency: string;
  status: "NEW" | "IN_REVIEW" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "WITHDRAWN";
  createdAt: string;
  expiresAt: string | null;
};

type State = { signedIn: boolean; offers: Offer[]; attemptsLeft: number };

const LABEL: Record<Offer["status"], string> = {
  NEW: "In Prüfung",
  IN_REVIEW: "In Prüfung",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  EXPIRED: "Abgelaufen",
  WITHDRAWN: "Zurückgezogen",
};

async function authHeaders(): Promise<HeadersInit> {
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export function OfferForm({ productId, listPriceCents, currency }: { productId: string; listPriceCents: number | null; currency: string }) {
  const [state, setState] = useState<State | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // A counter rather than a callback: every state change happens after an
  // await, which keeps the effect free of synchronous setState cascades.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const response = await fetch(`/api/price-offers?productId=${productId}`, { headers });
        if (!response.ok) throw new Error("failed");
        const data = await response.json() as State;
        if (!cancelled) setState(data);
      } catch {
        if (!cancelled) setState({ signedIn: false, offers: [], attemptsLeft: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, [productId, reloadToken]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/price-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ productId, price: data.get("price"), message: data.get("message") || undefined }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message ?? "Dein Vorschlag konnte nicht gesendet werden.");
      setFeedback({ type: "success", message: "Danke! Wir schauen uns deinen Vorschlag an und melden uns per E-Mail." });
      form.reset();
      setReloadToken((token) => token + 1);
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Es ist ein Fehler aufgetreten." });
    } finally {
      setPending(false);
    }
  }

  if (!state) return null;

  if (!state.signedIn) {
    return <div className="offer-box">
      <h3>Mach uns ein Angebot</h3>
      <p>
        Du musst diese Karte nicht zum angegebenen Preis nehmen — sag uns, was sie dir wert ist.
        Verhandeln geht nur mit Kundenkonto, so wissen wir, für wen der Preis gilt.
      </p>
      <Link className="button button-outline" href="/account">Anmelden oder registrieren <span>→</span></Link>
    </div>;
  }

  const accepted = state.offers.find((offer) => offer.status === "ACCEPTED");
  const open = state.offers.find((offer) => offer.status === "NEW" || offer.status === "IN_REVIEW");

  if (accepted) {
    return <div className="offer-box offer-accepted">
      <h3>Dein Preis steht</h3>
      <p>Wir haben <strong>{formatPrice(accepted.amount, accepted.currency)}</strong> angenommen. Der Betrag wird im Checkout automatisch verrechnet.</p>
      {accepted.expiresAt && <p className="offer-meta">Gültig bis {new Date(accepted.expiresAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</p>}
    </div>;
  }

  return <div className="offer-box">
    <h3>Preis vorschlagen</h3>
    {open
      ? <>
          <p>Dein Vorschlag über <strong>{formatPrice(open.amount, open.currency)}</strong> liegt uns vor. Wir melden uns per E-Mail.</p>
          <p className="offer-meta">Status: {LABEL[open.status]}</p>
        </>
      : state.attemptsLeft <= 0
        ? <p>Für diese Karte hast du alle Vorschläge genutzt. Der reguläre Preis gilt weiterhin.</p>
        : <>
            {/* Der Mindestabstand muss vor dem Absenden sichtbar sein, sonst
                bekommt der Kunde eine Ablehnung, die er nicht versteht. Er stand
                bis zum 2026-08-08 als eigener Absatz in Versalien darüber — das
                erschlug den Kasten optisch. Jetzt läuft er als kleiner Hinweis
                am Eingabefeld mit, wo er gebraucht wird. */}
            <p>Nenn uns deinen Preis. {listPriceCents ? <>Aktuell kostet die Karte {formatPrice(listPriceCents, currency)}.</> : null} Nehmen wir an, gilt dein Preis 48 Stunden und wird im Checkout automatisch verrechnet.</p>
            <form onSubmit={submit}>
              <label className="form-field">
                <span>Dein Preis in €<b aria-hidden="true"> *</b></span>
                <small>Mindestens 50 Cent unter dem Kartenpreis.</small>
                <input name="price" type="number" step="0.01" min="0.5" required
                  max={listPriceCents ? ((listPriceCents - 50) / 100).toFixed(2) : undefined} />
              </label>
              <label className="form-field">
                <span>Nachricht</span>
                <textarea name="message" rows={3} maxLength={1000} placeholder="Optional, zum Beispiel wenn du mehrere Karten möchtest" />
              </label>
              <button className="button button-primary" type="submit" disabled={pending}>
                {pending ? "Wird gesendet …" : "Vorschlag senden"}
              </button>
            </form>
            <p className="offer-meta">Noch {state.attemptsLeft} von 3 Vorschlägen für diese Karte.</p>
          </>}
    {feedback && <p className={`form-feedback ${feedback.type}`} role="status">{feedback.message}</p>}
  </div>;
}
