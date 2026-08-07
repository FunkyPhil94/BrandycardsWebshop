"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type Product = {
  id: string;
  title: string;
  priceAmountCents: number | null;
  priceCurrency: string;
  quantity: number;
  category: string;
};
type Address = { name: string; street: string; postalCode: string; city: string; country: string };

const countryNames: Record<string, string> = {
  DE: "Deutschland", AT: "Österreich", BE: "Belgien", FR: "Frankreich",
  IT: "Italien", NL: "Niederlande", ES: "Spanien",
};

function formatMoney(cents: number, currency = "EUR") {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency });
}

export default function CheckoutPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [address, setAddress] = useState<Address>({ name: "", street: "", postalCode: "", city: "", country: "DE" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setCart(JSON.parse(sessionStorage.getItem("brandycards-cart") ?? "{}")); } catch { setCart({}); }
    }, 0);
    fetch("/api/products")
      .then((response) => response.json())
      .then((data) => setProducts(data.products ?? []))
      .catch(() => setMessage("Produkte konnten nicht geladen werden."));
    return () => window.clearTimeout(timer);
  }, []);

  // Auf den verfügbaren Bestand begrenzt. Der Warenkorb liegt im
  // sessionStorage und kann eine Menge aus einer Zeit tragen, in der es die
  // Karte noch mehrfach gab — oder von Hand gesetzt worden sein. Der Server
  // lehnt zu viel ohnehin ab (app/api/orders/route.ts); hier verhindert es,
  // dass jemand erst nach der Adresseingabe davon erfährt.
  const items = useMemo(() => products
    .filter((product) => product.category === "Festpreis" && cart[product.id] > 0 && product.quantity > 0)
    .map((product) => ({ product, quantity: Math.min(cart[product.id], product.quantity) })), [cart, products]);
  const subtotal = items.reduce((sum, item) => sum + (item.product.priceAmountCents ?? 0) * item.quantity, 0);
  const shipping = address.country === "DE" ? 345 : 1449;
  const total = subtotal + shipping;

  function updateQuantity(id: string, quantity: number) {
    const next = { ...cart };
    if (quantity < 1) delete next[id]; else next[id] = quantity;
    setCart(next);
    sessionStorage.setItem("brandycards-cart", JSON.stringify(next));
    // Die Zahl im Warenkorbsymbol der Kopfleiste hängt an diesem Ereignis
    // (`useCart` in `app/site-chrome.tsx`). Ohne den Aufruf blieb sie nach dem
    // Entfernen stehen, bis die Seite neu geladen wurde.
    window.dispatchEvent(new Event("brandycards-cart-changed"));
  }

  async function startPayPal(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;
      if (!session) throw new Error("Bitte melde dich zuerst an, bevor du zur Zahlung gehst.");

      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })), shippingAddress: address }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error ?? "Bestellung konnte nicht angelegt werden.");

      sessionStorage.setItem("brandycards-pending-order", orderData.order.id);
      const paypalResponse = await fetch("/api/paypal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId: orderData.order.id }),
      });
      const paypalData = await paypalResponse.json();
      if (!paypalResponse.ok) throw new Error(paypalData.error ?? "PayPal ist derzeit nicht verfügbar.");
      const approval = paypalData.links?.find((link: { rel?: string }) => link.rel === "approve");
      if (!approval?.href) throw new Error("PayPal-Freigabelink fehlt.");
      window.location.assign(approval.href);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout fehlgeschlagen.");
      setBusy(false);
    }
  }

  return (
    <main className="checkout-page">
      <div className="checkout-shell">
        <Link className="checkout-back" href="/">← Zurück zum Shop</Link>
        <p className="eyebrow">BRANDYCARDS CHECKOUT</p>
        <div className="checkout-heading">
          <div><h1>Deine Bestellung</h1><p>Prüfe deine Auswahl und gib die Lieferadresse ein.</p></div>
          <span className="checkout-step">SCHRITT 1 VON 2</span>
        </div>

        {items.length === 0 ? (
          <section className="checkout-empty"><h2>Dein Warenkorb ist leer.</h2><p>Füge zuerst einen verfügbaren Artikel hinzu.</p><Link className="button button-primary" href="/">Zum Shop</Link></section>
        ) : (
          <div className="checkout-layout">
            <form onSubmit={startPayPal} className="checkout-form">
              <section className="checkout-panel"><div className="panel-heading"><span>01</span><h2>Lieferadresse</h2></div><p className="panel-intro">Wir versenden innerhalb Deutschlands und der EU.</p>
                <div className="checkout-fields">
                  {(["name", "street", "postalCode", "city"] as const).map((field) => <label key={field}>{field === "name" ? "Name" : field === "street" ? "Straße und Hausnummer" : field === "postalCode" ? "Postleitzahl" : "Ort"}<input required autoComplete={field === "postalCode" ? "postal-code" : field} value={address[field]} onChange={(event) => setAddress({ ...address, [field]: event.target.value })} /></label>)}
                  <label>Land<select value={address.country} onChange={(event) => setAddress({ ...address, country: event.target.value })}>{Object.entries(countryNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
                </div>
              </section>
              <section className="checkout-panel checkout-payment"><div className="panel-heading"><span>02</span><h2>Zahlung</h2></div><p className="panel-intro">Die Zahlung wird sicher über PayPal abgewickelt. Du wirst anschließend zu PayPal weitergeleitet.</p><div className="paypal-note"><strong>PayPal</strong><span>Nur PayPal-Zahlung verfügbar</span></div></section>
              {message && <p className="form-feedback error" role="alert">{message}</p>}
              <button className="button button-primary checkout-submit" disabled={busy}>{busy ? "Weiterleitung zu PayPal …" : "Mit PayPal fortfahren"}<span>→</span></button>
            </form>

            <aside className="checkout-summary"><p className="eyebrow">DEINE AUSWAHL</p><h2>Bestellübersicht</h2><div className="checkout-items">{items.map(({ product, quantity }) => <div className="checkout-item" key={product.id}><div><strong>{product.title}</strong><span>{formatMoney(product.priceAmountCents ?? 0, product.priceCurrency)} × {quantity}</span></div><button type="button" onClick={() => updateQuantity(product.id, quantity - 1)}>Entfernen</button></div>)}</div><div className="checkout-total"><div><span>Zwischensumme</span><strong>{formatMoney(subtotal)}</strong></div><div><span>Versand</span><strong>{formatMoney(shipping)}</strong></div><div className="total-line"><span>Gesamt</span><strong>{formatMoney(total)}</strong></div></div><p className="checkout-hint">Mit dem Klick auf „Mit PayPal fortfahren“ stimmst du den Bestellbedingungen zu.</p></aside>
          </div>
        )}
      </div>
      <nav className="legal-nav"><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><a href="/agb">AGB</a><a href="/widerruf">Widerruf</a><a href="/versand-zahlung">Versand &amp; Zahlung</a></nav>
    </main>
  );
}
