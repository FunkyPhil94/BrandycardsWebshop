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

/** Vier Zustände, und der vierte ist der wichtige.
 *
 * **„Abgemeldet" und „Abfrage fehlgeschlagen" sind nicht dasselbe.** Vorher gab
 * es nur `signedIn: boolean`, und jeder Fehlschlag landete auf `false`. Wer
 * angemeldet war und dessen Zugriffstoken gerade ablief, bekam deshalb die
 * Aufforderung, sich anzumelden — am 2026-08-17 beim Betreiber aufgetreten,
 * nachdem er drei Vorschläge gesendet hatte: Statt „keine weiteren Vorschläge
 * möglich" stand der Anmeldekasten da, obwohl der Server längst
 * `attemptsLeft: 0` lieferte.
 *
 * Ob jemand angemeldet ist, weiß **Supabase**. Ob die Abfrage geklappt hat, sagt
 * der Aufruf. Zwei Fragen, zwei Antworten.
 */
type Zustand =
  | { art: "laedt" }
  | { art: "abgemeldet" }
  | { art: "bereit"; offers: Offer[]; attemptsLeft: number }
  | { art: "fehler" };

const LABEL: Record<Offer["status"], string> = {
  NEW: "In Prüfung",
  IN_REVIEW: "In Prüfung",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  EXPIRED: "Abgelaufen",
  WITHDRAWN: "Zurückgezogen",
};

/** Das Zugriffstoken der laufenden Sitzung — oder `null`, wenn keine läuft.
 *
 * Kein stiller Rückfall auf leere Kopfzeilen: Ein fehlendes Token bedeutet
 * abgemeldet, und das muss die aufrufende Stelle unterscheiden können. */
async function sitzungsToken(): Promise<string | null> {
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function OfferForm({ productId, listPriceCents, currency }: { productId: string; listPriceCents: number | null; currency: string }) {
  const [zustand, setZustand] = useState<Zustand>({ art: "laedt" });
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
      const token = await sitzungsToken();
      if (cancelled) return;
      if (!token) { setZustand({ art: "abgemeldet" }); return; }
      try {
        const response = await fetch(`/api/price-offers?productId=${productId}`, { headers: { Authorization: `Bearer ${token}` } });
        // 401 heißt: Das Token trägt nicht mehr. Das *ist* abgemeldet — anders
        // als ein 429, 500 oder ein abgebrochenes Netz, wo niemand weiß, wie es
        // um die Vorschläge steht.
        if (response.status === 401) { if (!cancelled) setZustand({ art: "abgemeldet" }); return; }
        if (!response.ok) throw new Error("failed");
        const data = await response.json() as { signedIn: boolean; offers: Offer[]; attemptsLeft: number };
        if (cancelled) return;
        setZustand(data.signedIn ? { art: "bereit", offers: data.offers, attemptsLeft: data.attemptsLeft } : { art: "abgemeldet" });
      } catch {
        if (!cancelled) setZustand({ art: "fehler" });
      }
    })();
    return () => { cancelled = true; };
  }, [productId, reloadToken]);

  /** Noch einmal nachfragen, sobald sich die Anmeldung ändert.
   *
   * **Ohne das entscheidet ein Wettlauf über den Kasten.** Die Prüfung oben
   * läuft einmal beim Aufbau der Seite. Liegt in dem Moment noch kein Token
   * vor — Supabase liest die Sitzung asynchron aus dem Speicher und erneuert
   * ein abgelaufenes Zugriffstoken erst im Hintergrund —, gilt der Besucher als
   * abgemeldet.
   *
   * `onAuthStateChange` meldet sich, sobald die Sitzung steht (auch bei
   * `TOKEN_REFRESHED` und nach dem Abmelden), und der Zähler stößt die Prüfung
   * erneut an. Das bleibt richtig und nötig — es ersetzt aber nicht die
   * Unterscheidung oben: Kommt gar kein Ereignis mehr, weil die Sitzung längst
   * steht und nur der Aufruf scheiterte, muss der Fehler als Fehler dastehen.
   */
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      subscription = getSupabaseBrowserClient().auth.onAuthStateChange(() => {
        setReloadToken((token) => token + 1);
      }).data.subscription;
    } catch {
      // Ohne Supabase-Konfiguration bleibt es beim einmaligen Versuch oben.
    }
    return () => subscription?.unsubscribe();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setFeedback(null);
    try {
      const token = await sitzungsToken();
      const response = await fetch("/api/price-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

  const offers = zustand.art === "bereit" ? zustand.offers : [];
  const accepted = offers.find((offer) => offer.status === "ACCEPTED");
  useEffect(() => {
    if (!accepted || !accepted.expiresAt || Date.parse(accepted.expiresAt) <= Date.now() || cart[productId] > 0) return;
    // Das Angebot ist personengebunden und wird serverseitig erneut geprüft.
    // Im Browser legen wir nur die Karte hinein, nie den Betrag.
    addToCart(productId, 1);
  }, [accepted, addToCart, cart, productId]);

  if (zustand.art === "laedt") return null;

  if (zustand.art === "abgemeldet") {
    return <div className="offer-box">
      <h3>{t("Mach uns ein Angebot")}</h3>
      <p>{t("Du musst diese Karte nicht zum angegebenen Preis nehmen. Sag uns einfach, was sie dir wert ist. Für ein Angebot brauchst du ein Kundenkonto. So wissen wir, für wen der vereinbarte Preis gilt.")}</p>
      <Link className="button button-outline" href="/account">{t("Anmelden oder registrieren")} <span>→</span></Link>
    </div>;
  }

  // Der Fehlerfall sagt, was los ist, und bietet den Weg heraus an. Vorher stand
  // hier der Anmeldekasten — eine Auskunft, die schlicht falsch war.
  if (zustand.art === "fehler") {
    return <div className="offer-box">
      <h3>{t("Preis vorschlagen")}</h3>
      <p>{t("Der Stand deiner Vorschläge lässt sich gerade nicht abrufen. Deine bisherigen Vorschläge sind davon nicht betroffen.")}</p>
      <button type="button" className="button button-outline" onClick={() => setReloadToken((token) => token + 1)}>{t("Erneut versuchen")}</button>
    </div>;
  }

  const open = offers.find((offer) => offer.status === "NEW" || offer.status === "IN_REVIEW");

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
      : zustand.attemptsLeft <= 0
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
              ? t("Nenn uns deinen Preis. Er muss mindestens 50 Cent unter dem aktuellen Preis von {{price}} liegen.", { price: formatPrice(listPriceCents, currency, locale) ?? "" })
              : t("Für diese Karte gibt es keinen Festpreis. Nenn uns einfach deinen Preis.")}
              {" "}{t("Wenn wir ihn annehmen, gilt dein Preis 48 Stunden und wird im Checkout automatisch verwendet.")}</p>
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
            <p className="offer-meta">{t("Noch {{left}} von 3 Vorschlägen für diese Karte.", { left: zustand.attemptsLeft })}</p>
          </>}
    {feedback && <p className={`form-feedback ${feedback.type}`} role="status">{feedback.message}</p>}
  </div>;
}
