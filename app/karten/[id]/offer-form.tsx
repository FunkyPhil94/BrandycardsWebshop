"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { formatPrice, useCart } from "../../site-chrome";
import { useI18n } from "../../i18n";

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
  const { cart, addToCart } = useCart();
  const { t, locale } = useI18n();

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
      if (!response.ok) throw new Error(payload?.error?.message ?? t("Dein Vorschlag konnte nicht gesendet werden."));
      setFeedback({ type: "success", message: t("Danke! Wir schauen uns deinen Vorschlag an und melden uns per E-Mail.") });
      form.reset();
      setReloadToken((token) => token + 1);
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? t(error.message) : t("Es ist ein Fehler aufgetreten.") });
    } finally {
      setPending(false);
    }
  }

  const accepted = state?.offers.find((offer) => offer.status === "ACCEPTED");
  useEffect(() => {
    if (!accepted || !accepted.expiresAt || Date.parse(accepted.expiresAt) <= Date.now() || cart[productId] > 0) return;
    // Das Angebot ist personengebunden und wird serverseitig erneut geprüft.
    // Im Browser legen wir nur die Karte hinein, nie den Betrag.
    addToCart(productId, 1);
  }, [accepted, addToCart, cart, productId]);

  if (!state) return null;

  if (!state.signedIn) {
    return <div className="offer-box">
      <h3>{t("Mach uns ein Angebot")}</h3>
      <p>{t("Du musst diese Karte nicht zum angegebenen Preis nehmen — sag uns, was sie dir wert ist. Verhandeln geht nur mit Kundenkonto, so wissen wir, für wen der Preis gilt.")}</p>
      <Link className="button button-outline" href="/account">{t("Anmelden oder registrieren")} <span>→</span></Link>
    </div>;
  }

  const open = state.offers.find((offer) => offer.status === "NEW" || offer.status === "IN_REVIEW");

  if (accepted) {
    return <div className="offer-box offer-accepted">
      <h3>{t("Dein Preis steht")}</h3>
      <p>{t("Wir haben {{amount}} angenommen. Die Karte liegt jetzt in deinem Warenkorb und der Betrag wird im Checkout automatisch verwendet.", { amount: formatPrice(accepted.amount, accepted.currency, locale) ?? "" })}</p>
      <Link className="button button-primary" href="/checkout">{t("Zum Warenkorb")} <span>→</span></Link>
      {accepted.expiresAt && <p className="offer-meta">{t("Gültig bis {{date}}", { date: new Date(accepted.expiresAt).toLocaleString(locale === "en" ? "en-IE" : "de-DE", { dateStyle: "medium", timeStyle: "short" }) })}</p>}
    </div>;
  }

  return <div className="offer-box">
    <h3>{t("Preis vorschlagen")}</h3>
    {open
      ? <>
          <p>{t("Dein Vorschlag über {{amount}} liegt uns vor. Wir melden uns per E-Mail.", { amount: formatPrice(open.amount, open.currency, locale) ?? "" })}</p>
          <p className="offer-meta">{t("Status: {{status}}", { status: t(LABEL[open.status]) })}</p>
        </>
      : state.attemptsLeft <= 0
        ? <p>{t(listPriceCents
          ? "Für diese Karte hast du alle Vorschläge genutzt. Der reguläre Preis gilt weiterhin."
          : "Für diese Karte hast du alle Vorschläge genutzt. Ein neuer Vorschlag ist derzeit nicht möglich.")}</p>
        : <>
            {/* Der Mindestabstand muss vor dem Absenden sichtbar sein, sonst
                bekommt der Kunde eine Ablehnung, die er nicht versteht. Er hatte
                am 2026-08-08 erst einen eigenen Absatz in Versalien, dann eine
                graue Zeile am Feld — beides hat der Betreiber verworfen. Jetzt
                steht er als halber Satz im Fließtext, ohne eigene Gestaltung. */}
            <p>{listPriceCents
              ? t("Nenn uns deinen Preis — mindestens 50 Cent unter den {{price}}, die die Karte aktuell kostet.", { price: formatPrice(listPriceCents, currency, locale) ?? "" })
              : t("Für diese Karte gibt es keinen Festpreis. Nenn uns einfach deinen Preis.")}
              {" "}{t("Nehmen wir an, gilt dein Preis 48 Stunden und wird im Checkout automatisch verwendet.")}</p>
            <form onSubmit={submit}>
              <label className="form-field">
                <span>{t("Dein Preis in €")}<b aria-hidden="true"> *</b></span>
                <input name="price" type="number" step="0.01" min={listPriceCents ? "0.5" : "0.01"} required
                  max={listPriceCents ? ((listPriceCents - 50) / 100).toFixed(2) : undefined} />
              </label>
              <label className="form-field">
                <span>{t("Nachricht")}</span>
                <textarea name="message" rows={3} maxLength={1000} placeholder={t("Optional, zum Beispiel wenn du mehrere Karten möchtest")} />
              </label>
              <button className="button button-primary" type="submit" disabled={pending}>
                {pending ? t("Wird gesendet …") : t("Vorschlag senden")}
              </button>
            </form>
            <p className="offer-meta">{t("Noch {{left}} von 3 Vorschlägen für diese Karte.", { left: state.attemptsLeft })}</p>
          </>}
    {feedback && <p className={`form-feedback ${feedback.type}`} role="status">{feedback.message}</p>}
  </div>;
}
