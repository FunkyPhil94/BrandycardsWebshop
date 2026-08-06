"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../../../lib/supabase-browser";

type CaptureState = "loading" | "success" | "error";

export default function PayPalSuccessPage() {
  const [state, setState] = useState<CaptureState>("loading");
  const [message, setMessage] = useState("Wir bestätigen deine Zahlung …");
  const [orderReference, setOrderReference] = useState("");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const paypalOrderId = params.get("token");
      const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;
      const orderId = sessionStorage.getItem("brandycards-pending-order");

      if (!paypalOrderId || !session || !orderId) {
        setState("error");
        setMessage("Die Zahlung konnte nicht eindeutig zugeordnet werden.");
        return;
      }

      setOrderReference(orderId.slice(0, 8).toUpperCase());
      const response = await fetch("/api/paypal/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId, paypalOrderId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setState("error");
        setMessage(data.error ?? "Die Zahlung konnte nicht bestätigt werden.");
        return;
      }

      sessionStorage.removeItem("brandycards-pending-order");
      sessionStorage.removeItem("brandycards-cart");
      setState("success");
      setMessage("Zahlung erfolgreich bestätigt.");
    };

    void run();
  }, []);

  return (
    <main className="paypal-return-page" aria-labelledby="paypal-return-title">
      <div className="paypal-return-shell">
        <Link className="checkout-back" href="/">← Zurück zum Shop</Link>
        <section className={`paypal-return-card paypal-return-card-${state}`}>
          <p className="eyebrow">PayPal · {state === "success" ? "Zahlung bestätigt" : "Bestellstatus"}</p>
          <div className="paypal-return-icon" aria-hidden="true">{state === "loading" ? "…" : state === "success" ? "✓" : "!"}</div>
          <h1 id="paypal-return-title">{state === "success" ? "Vielen Dank für deine Bestellung." : state === "loading" ? "Zahlung wird verarbeitet" : "Zahlung nicht abgeschlossen"}</h1>
          <p className="paypal-return-message" aria-live="polite">{message}</p>
          {state === "success" && <p className="paypal-return-reference">Bestellreferenz <strong>BC-{orderReference}</strong></p>}
          {state === "success" && <p className="paypal-return-note">Wir bereiten deine Bestellung jetzt für den Versand vor. Eine Bestätigung erhältst du per E-Mail.</p>}
          {state === "error" && <p className="paypal-return-note">Bitte versuche es erneut. Falls der Betrag bereits abgebucht wurde, kontaktiere uns bitte vor einem weiteren Versuch.</p>}
          <div className="paypal-return-actions">
            {state === "success" ? <Link className="button button-primary" href="/">Zum Shop <span>→</span></Link> : <Link className="button button-primary" href="/checkout">Erneut zum Checkout <span>→</span></Link>}
            {state === "error" && <Link className="text-link" href="/">Weiter einkaufen</Link>}
          </div>
        </section>
      </div>
      <nav className="legal-nav"><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><a href="/agb">AGB</a><a href="/widerruf">Widerruf</a><a href="/versand-zahlung">Versand &amp; Zahlung</a></nav>
    </main>
  );
}
