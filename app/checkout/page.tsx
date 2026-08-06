"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

type Product = { id: string; title: string; priceAmountCents: number | null; priceCurrency: string; quantity: number; category: string };
type Address = { name: string; street: string; postalCode: string; city: string; country: string };

export default function CheckoutPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [address, setAddress] = useState<Address>({ name: "", street: "", postalCode: "", city: "", country: "DE" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const storedCart = (() => { try { return JSON.parse(sessionStorage.getItem("brandycards-cart") ?? "{}"); } catch { return {}; } })();
    setTimeout(() => setCart(storedCart), 0);
    fetch("/api/products").then((response) => response.json()).then((data) => setProducts(data.products ?? [])).catch(() => setMessage("Produkte konnten nicht geladen werden."));
  }, []);

  const items = useMemo(() => products.filter((product) => product.category === "Festpreis" && cart[product.id] > 0).map((product) => ({ product, quantity: cart[product.id] })), [cart, products]);
  const subtotal = items.reduce((sum, item) => sum + (item.product.priceAmountCents ?? 0) * item.quantity, 0);
  const shipping = address.country === "DE" ? 345 : 1449;
  const total = subtotal + shipping;

  function updateQuantity(id: string, quantity: number) {
    const next = { ...cart };
    if (quantity < 1) delete next[id]; else next[id] = quantity;
    setCart(next); sessionStorage.setItem("brandycards-cart", JSON.stringify(next));
  }

  async function startPayPal(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;
      if (!session) throw new Error("Bitte melde dich zuerst an.");
      const orderResponse = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })), shippingAddress: address }) });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error ?? "Bestellung konnte nicht angelegt werden.");
      sessionStorage.setItem("brandycards-pending-order", orderData.order.id); const paypalResponse = await fetch("/api/paypal/orders", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ orderId: orderData.order.id }) });
      const paypalData = await paypalResponse.json();
      if (!paypalResponse.ok) throw new Error(paypalData.error ?? "PayPal ist derzeit nicht verfügbar.");
      const approval = paypalData.links?.find((link: { rel?: string }) => link.rel === "approve");
      if (!approval?.href) throw new Error("PayPal-Freigabelink fehlt.");
      window.location.assign(approval.href);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Checkout fehlgeschlagen."); setBusy(false); }
  }

  return <main className="checkout-page"><div className="legal-page"><a className="text-link" href="/">← Zurück zum Shop</a><p className="eyebrow">BRANDYCARDS CHECKOUT</p><h1>Deine Bestellung</h1>{items.length === 0 ? <p>Dein Warenkorb ist leer. <a href="/">Zurück zum Shop</a></p> : <><div className="checkout-items">{items.map(({ product, quantity }) => <div className="checkout-item" key={product.id}><strong>{product.title}</strong><span>{((product.priceAmountCents ?? 0) / 100).toLocaleString("de-DE", { style: "currency", currency: product.priceCurrency })} × {quantity}</span><button type="button" onClick={() => updateQuantity(product.id, quantity - 1)}>Entfernen</button></div>)}</div><form onSubmit={startPayPal} className="checkout-form"><h2>Lieferadresse</h2>{(["name", "street", "postalCode", "city"] as const).map((field) => <label key={field}>{field === "name" ? "Name" : field === "street" ? "Straße und Hausnummer" : field === "postalCode" ? "PLZ" : "Ort"}<input required value={address[field]} onChange={(event) => setAddress({ ...address, [field]: event.target.value })} /></label>)}<label>Land<select value={address.country} onChange={(event) => setAddress({ ...address, country: event.target.value })}><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="FR">Frankreich</option><option value="NL">Niederlande</option><option value="BE">Belgien</option><option value="IT">Italien</option><option value="ES">Spanien</option></select></label><div className="checkout-total"><span>Zwischensumme: { (subtotal / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) }</span><span>Versand: { (shipping / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) }</span><strong>Gesamt: { (total / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) }</strong></div><button className="button button-primary" disabled={busy}>{busy ? "Wird zu PayPal weitergeleitet …" : "Mit PayPal fortfahren"}</button>{message && <p className="form-feedback error" role="alert">{message}</p>}</form></>}</div></main>;
}
