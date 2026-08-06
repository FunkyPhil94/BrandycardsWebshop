import Link from "next/link";

export default function PayPalCancelPage() {
  return (
    <main className="paypal-return-page" aria-labelledby="paypal-cancel-title">
      <div className="paypal-return-shell">
        <Link className="checkout-back" href="/">← Zurück zum Shop</Link>
        <section className="paypal-return-card paypal-return-card-cancel">
          <p className="eyebrow">PayPal · Zahlung abgebrochen</p>
          <div className="paypal-return-icon" aria-hidden="true">×</div>
          <h1 id="paypal-cancel-title">Deine Bestellung ist noch nicht abgeschlossen.</h1>
          <p className="paypal-return-message">Bei PayPal wurde keine Zahlung eingezogen.</p>
          <p className="paypal-return-note">Du kannst zum Checkout zurückkehren und die Zahlung erneut versuchen oder weiter im Shop stöbern.</p>
          <div className="paypal-return-actions">
            <Link className="button button-primary" href="/checkout">Zurück zum Checkout <span>→</span></Link>
            <Link className="text-link" href="/">Weiter einkaufen</Link>
          </div>
        </section>
      </div>
      <nav className="legal-nav"><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><a href="/agb">AGB</a><a href="/widerruf">Widerruf</a><a href="/versand-zahlung">Versand &amp; Zahlung</a></nav>
    </main>
  );
}
