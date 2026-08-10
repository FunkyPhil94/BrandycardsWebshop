"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { istKaufbareKategorie } from "../../lib/catalog-availability";
import { effectiveUnitPrice } from "../../lib/offer-price";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { useI18n } from "../i18n";

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

function formatMoney(cents: number, currency = "EUR", locale: "de" | "en" = "de") {
  return (cents / 100).toLocaleString(locale === "en" ? "en-IE" : "de-DE", { style: "currency", currency });
}

export default function CheckoutPage() {
  const { t, locale } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [address, setAddress] = useState<Address>({ name: "", street: "", postalCode: "", city: "", country: "DE" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [offers, setOffers] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let gespeicherterWarenkorb: Record<string, number> = {};
      try { gespeicherterWarenkorb = JSON.parse(sessionStorage.getItem("brandycards-cart") ?? "{}"); } catch { gespeicherterWarenkorb = {}; }
      setCart(gespeicherterWarenkorb);
      const ids = Object.entries(gespeicherterWarenkorb)
        .filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0)
        .map(([id]) => id);
      if (!ids.length) {
        setProducts([]);
        return;
      }
      fetch(`/api/products?ids=${encodeURIComponent(ids.join(","))}`)
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
        .then((data) => setProducts(data.products ?? []))
        .catch(() => setMessage(t("Produkte konnten nicht geladen werden.")));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [t]);

  // Die ausgehandelten Preise sind reine Anzeige. Was am Ende berechnet wird,
  // entscheidet allein der Server (`app/api/orders/route.ts`) — er schlägt die
  // Angebote selbst nach und übernimmt nie einen Betrag aus dem Browser.
  //
  // Deshalb wird hier auch **kein Fehler** gezeigt, wenn die Abfrage
  // fehlschlägt oder niemand angemeldet ist (401): Dann stehen die
  // Listenpreise da, und der Kunde zahlt trotzdem den ausgehandelten Preis.
  // Eine Fehlermeldung würde einen Schaden behaupten, den es nicht gibt.
  useEffect(() => {
    let abgemeldet = false;
    (async () => {
      try {
        const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;
        if (!session || abgemeldet) return;
        const response = await fetch("/api/account/offers", { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!response.ok || abgemeldet) return;
        const data = await response.json() as { offers?: Array<{ productId?: string; amountCents?: number }> };
        const gefunden: Record<string, number> = {};
        for (const offer of data.offers ?? []) {
          if (typeof offer.productId === "string" && typeof offer.amountCents === "number") gefunden[offer.productId] = offer.amountCents;
        }
        setOffers(gefunden);
      } catch {
        // Siehe oben: stillschweigend bei den Listenpreisen bleiben.
      }
    })();
    return () => { abgemeldet = true; };
  }, []);

  // Auf den verfügbaren Bestand begrenzt. Der Warenkorb liegt im
  // sessionStorage und kann eine Menge aus einer Zeit tragen, in der es die
  // Karte noch mehrfach gab — oder von Hand gesetzt worden sein. Der Server
  // lehnt zu viel ohnehin ab (app/api/orders/route.ts); hier verhindert es,
  // dass jemand erst nach der Adresseingabe davon erfährt.
  //
  // **`istKaufbareKategorie` statt `=== "Festpreis"`.** Bis zum 2026-08-09 stand
  // hier die Zeichenkette, und eine von Hand eingestellte Karte („Direkt bei
  // uns") fiel damit stillschweigend aus dem Warenkorb: hineinlegen ging, der
  // Checkout meldete „Dein Warenkorb ist leer". Beim Durchstich gefunden, nicht
  // von einem Test. Die Entscheidung steht jetzt einmal in
  // `lib/catalog-availability.ts` und wird dort geprüft.
  const items = useMemo(() => {
    const result: Array<{
      product: Product;
      quantity: number;
      listPrice: number | null;
      unitPrice: number;
      ausgehandelt: boolean;
      akzeptiert: boolean;
    }> = [];
    for (const product of products) {
      if (!istKaufbareKategorie(product.category) || cart[product.id] <= 0 || product.quantity <= 0) continue;
      const listPrice = product.priceAmountCents;
      // Ohne Festpreis darf nur ein angenommenes Angebot die Karte in den
      // Checkout bringen. Die verbindliche Prüfung macht der Server erneut.
      const agreed = offers[product.id];
      const unitPrice = effectiveUnitPrice(listPrice, agreed);
      if (unitPrice === null) continue;
      result.push({
        product,
        quantity: Math.min(cart[product.id], product.quantity),
        listPrice,
        unitPrice,
        ausgehandelt: listPrice !== null && unitPrice < listPrice,
        akzeptiert: agreed !== undefined,
      });
    }
    return result;
  }, [cart, products, offers]);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const ersparnis = items.reduce((sum, item) => sum + (item.listPrice === null ? 0 : item.listPrice - item.unitPrice) * item.quantity, 0);
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
      if (!session) throw new Error(t("Bitte melde dich zuerst an, bevor du zur Zahlung gehst."));

      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ items: items.map(({ product, quantity }) => ({ productId: product.id, quantity })), shippingAddress: address }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(orderData.error ?? t("Bestellung konnte nicht angelegt werden."));

      sessionStorage.setItem("brandycards-pending-order", orderData.order.id);
      const paypalResponse = await fetch("/api/paypal/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ orderId: orderData.order.id }),
      });
      const paypalData = await paypalResponse.json();
      if (!paypalResponse.ok) throw new Error(paypalData.error ?? t("PayPal ist derzeit nicht verfügbar."));
      const approval = paypalData.links?.find((link: { rel?: string }) => link.rel === "approve");
      if (!approval?.href) throw new Error(t("PayPal-Freigabelink fehlt."));
      window.location.assign(approval.href);
    } catch (error) {
      setMessage(error instanceof Error ? t(error.message) : t("Checkout fehlgeschlagen."));
      setBusy(false);
    }
  }

  return (
    <main className="checkout-page">
      <div className="checkout-shell">
        <Link className="checkout-back" href="/">{t("← Zurück zum Shop")}</Link>
        <p className="eyebrow">{t("BRANDYCARDS CHECKOUT")}</p>
        <div className="checkout-heading">
          <div><h1>{t("Deine Bestellung")}</h1><p>{t("Prüfe deine Auswahl und gib die Lieferadresse ein.")}</p></div>
          <span className="checkout-step">{t("SCHRITT 1 VON 2")}</span>
        </div>

        {items.length === 0 ? (
          <section className="checkout-empty"><h2>{t("Dein Warenkorb ist leer.")}</h2><p>{t("Füge zuerst einen verfügbaren Artikel hinzu.")}</p><Link className="button button-primary" href="/">{t("Zum Shop")}</Link></section>
        ) : (
          <div className="checkout-layout">
            <form onSubmit={startPayPal} className="checkout-form">
              <section className="checkout-panel"><div className="panel-heading"><span>01</span><h2>{t("Lieferadresse")}</h2></div><p className="panel-intro">{t("Wir versenden innerhalb Deutschlands und der EU.")}</p>
                <div className="checkout-fields">
                  {(["name", "street", "postalCode", "city"] as const).map((field) => <label key={field}>{t(field === "name" ? "Name" : field === "street" ? "Straße und Hausnummer" : field === "postalCode" ? "Postleitzahl" : "Ort")}<input required autoComplete={field === "postalCode" ? "postal-code" : field} value={address[field]} onChange={(event) => setAddress({ ...address, [field]: event.target.value })} /></label>)}
                  <label>{t("Land")}<select value={address.country} onChange={(event) => setAddress({ ...address, country: event.target.value })}>{Object.entries(countryNames).map(([code, name]) => <option key={code} value={code}>{t(name)}</option>)}</select></label>
                </div>
              </section>
              <section className="checkout-panel checkout-payment"><div className="panel-heading"><span>02</span><h2>{t("Zahlung")}</h2></div><p className="panel-intro">{t("Die Zahlung wird sicher über PayPal abgewickelt. Du wirst anschließend zu PayPal weitergeleitet.")}</p><div className="paypal-note"><strong>PayPal</strong><span>{t("Nur PayPal-Zahlung verfügbar")}</span></div></section>
              {message && <p className="form-feedback error" role="alert">{message}</p>}
              <button className="button button-primary checkout-submit" disabled={busy}>{busy ? t("Weiterleitung zu PayPal …") : t("Mit PayPal fortfahren")}<span>→</span></button>
            </form>

            <aside className="checkout-summary"><p className="eyebrow">{t("DEINE AUSWAHL")}</p><h2>{t("Bestellübersicht")}</h2><div className="checkout-items">{items.map(({ product, quantity, listPrice, unitPrice, ausgehandelt, akzeptiert }) => <div className="checkout-item" key={product.id}><div><strong>{product.title}</strong><span>{ausgehandelt ? <>
              <s className="checkout-listenpreis">{formatMoney(listPrice ?? 0, product.priceCurrency, locale)}</s>{" "}
              <span className="checkout-verhandelt">{formatMoney(unitPrice, product.priceCurrency, locale)}</span>
            </> : formatMoney(unitPrice, product.priceCurrency, locale)} × {quantity}</span>{(ausgehandelt || akzeptiert) && <span className="checkout-verhandelt-hinweis">{t(ausgehandelt ? "Dein ausgehandelter Preis" : "Dein akzeptierter Preis")}</span>}</div><button type="button" onClick={() => updateQuantity(product.id, quantity - 1)}>{t("Entfernen")}</button></div>)}</div><div className="checkout-total"><div><span>{t("Zwischensumme")}</span><strong>{formatMoney(subtotal, "EUR", locale)}</strong></div>{ersparnis > 0 && <div className="checkout-ersparnis"><span>{t("Deine Ersparnis")}</span><strong>−{formatMoney(ersparnis, "EUR", locale)}</strong></div>}<div><span>{t("Versand")}</span><strong>{formatMoney(shipping, "EUR", locale)}</strong></div><div className="total-line"><span>{t("Gesamt")}</span><strong>{formatMoney(total, "EUR", locale)}</strong></div></div><p className="checkout-hint">{t("Mit dem Klick auf „Mit PayPal fortfahren“ stimmst du den Bestellbedingungen zu.")}</p></aside>
          </div>
        )}
      </div>
      <nav className="legal-nav"><a href="/impressum">{t("Impressum")}</a><a href="/datenschutz">{t("Datenschutz")}</a><a href="/agb">{t("AGB")}</a><a href="/widerruf">{t("Widerruf")}</a><a href="/versand-zahlung">{t("Versand & Zahlung")}</a></nav>
    </main>
  );
}
