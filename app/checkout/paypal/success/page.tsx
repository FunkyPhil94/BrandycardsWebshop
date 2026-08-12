"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../../../lib/supabase-browser";
import { useI18n } from "../../../i18n";

type CaptureState = "loading" | "success" | "error";

export default function PayPalSuccessPage() {
  const { t } = useI18n();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const [state, setState] = useState<CaptureState>("loading");
  const [message, setMessage] = useState(() => t("Wir bestätigen deine Zahlung …"));
  const [orderReference, setOrderReference] = useState("");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const paypalOrderId = params.get("token");
      let accessToken = "";
      try { accessToken = (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token ?? ""; } catch { /* Gastcheckout ohne Supabase-Sitzung */ }
      const orderId = sessionStorage.getItem("brandycards-pending-order");

      if (!paypalOrderId || !orderId) {
        setState("error");
        setMessage(tRef.current("Die Zahlung konnte nicht eindeutig zugeordnet werden."));
        return;
      }

      setOrderReference(orderId.slice(0, 8).toUpperCase());
      const captureHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) captureHeaders.Authorization = `Bearer ${accessToken}`;
      const response = await fetch("/api/paypal/capture", {
        method: "POST",
        headers: captureHeaders,
        body: JSON.stringify({ orderId, paypalOrderId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setState("error");
        setMessage(data.error ?? tRef.current("Die Zahlung konnte nicht bestätigt werden."));
        return;
      }

      sessionStorage.removeItem("brandycards-pending-order");
      sessionStorage.removeItem("brandycards-cart");
      setState("success");
      setMessage(tRef.current("Zahlung erfolgreich bestätigt."));
    };

    void run();
  }, []);

  return (
    <main className="paypal-return-page" aria-labelledby="paypal-return-title">
      <div className="paypal-return-shell">
        <Link className="checkout-back" href="/">{t("← Zurück zum Shop")}</Link>
        <section className={`paypal-return-card paypal-return-card-${state}`}>
          <p className="eyebrow">PayPal · {t(state === "success" ? "Zahlung bestätigt" : "Bestellstatus")}</p>
          <div className="paypal-return-icon" aria-hidden="true">{state === "loading" ? "…" : state === "success" ? "✓" : "!"}</div>
          <h1 id="paypal-return-title">{t(state === "success" ? "Vielen Dank für deine Bestellung." : state === "loading" ? "Zahlung wird verarbeitet" : "Zahlung nicht abgeschlossen")}</h1>
          <p className="paypal-return-message" aria-live="polite">{message}</p>
          {state === "success" && <p className="paypal-return-reference">{t("Bestellreferenz")} <strong>BC-{orderReference}</strong></p>}
          {state === "success" && <p className="paypal-return-note">{t("Wir bereiten deine Bestellung jetzt für den Versand vor. Eine Bestätigung erhältst du per E-Mail.")}</p>}
          {state === "error" && <p className="paypal-return-note">{t("Bitte versuche es erneut. Falls der Betrag bereits abgebucht wurde, kontaktiere uns bitte vor einem weiteren Versuch.")}</p>}
          <div className="paypal-return-actions">
            {state === "success" ? <Link className="button button-primary" href="/">{t("Zum Shop")} <span>→</span></Link> : <Link className="button button-primary" href="/checkout">{t("Erneut zum Checkout")} <span>→</span></Link>}
            {state === "error" && <Link className="text-link" href="/">{t("Weiter einkaufen")}</Link>}
          </div>
        </section>
      </div>
      <nav className="legal-nav"><a href="/impressum">{t("Impressum")}</a><a href="/datenschutz">{t("Datenschutz")}</a><a href="/agb">{t("AGB")}</a><a href="/widerruf">{t("Widerruf")}</a><a href="/versand-zahlung">{t("Versand & Zahlung")}</a></nav>
    </main>
  );
}
