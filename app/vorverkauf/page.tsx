"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cartButtonState } from "../../lib/cart.ts";
import { SiteFooter, SiteHeader, formatPrice, useCart } from "../site-chrome";

type Product = {
  id: string;
  title: string;
  description: string | null;
  origin?: string;
  priceAmountCents: number | null;
  priceCurrency: string;
  quantity: number;
  imageUrls: string[];
};

/** Der Vorverkauf: Karten, die es hier gibt, aber (noch) nicht bei eBay.
 *
 * **Warum eine eigene Seite und kein Filter auf `/karten`:** Entscheidung des
 * Betreibers vom 2026-08-08. Diese Karten sind sein Argument gegen den Umweg
 * über eBay — im normalen Bestand gingen sie zwischen 294 anderen unter.
 *
 * Die Liste kommt aus demselben `/api/products` wie der Katalog und wird hier
 * über `origin` gefiltert. Eine eigene Route wäre eine zweite Stelle, an der
 * dieselben Sichtbarkeitsregeln stehen — und die zweite Stelle ist die, die
 * beim nächsten Umbau vergessen wird.
 */
export default function VorverkaufPage() {
  const [cards, setCards] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const { cart, addToCart, removeFromCart } = useCart();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((data: { products?: Product[] }) => {
        if (cancelled) return;
        setCards((data.products ?? []).filter((product) => product.origin === "MANUAL"));
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  return (
    <main>
      <SiteHeader active="/vorverkauf" />
      <section className="shop-section">
        <div className="section-heading">
          <h2>Vorverkauf.</h2>
          <p>Karten, die du hier bekommst, bevor sie bei eBay stehen.</p>
        </div>

        {status === "loading" && <p className="empty-state">Lade …</p>}
        {status === "error" && <p className="empty-state">Die Karten konnten gerade nicht geladen werden. Bitte lade die Seite neu.</p>}
        {/* Ein leerer Bereich braucht mehr als „keine Treffer": Wer hierher
            klickt, soll nicht denken, der Shop sei kaputt. */}
        {status === "ready" && cards.length === 0 && <div className="empty-state">
          <p><strong>Gerade ist nichts im Vorverkauf.</strong></p>
          <p>Hier stehen Karten, die wir direkt anbieten, bevor sie in unseren eBay-Shop wandern. Schau später wieder vorbei — oder sieh dir den <Link className="text-link" href="/karten">gesamten Bestand <span>→</span></Link> an.</p>
        </div>}

        {status === "ready" && cards.length > 0 && <div className="product-grid">
          {cards.map((card) => {
            const knopf = cartButtonState(card.quantity, cart[card.id] ?? 0);
            return <article className="product-card" key={card.id}>
              <div className="product-image">
                <Link href={`/karten/${card.id}`} className="product-image-link" aria-label={card.title}>
                  {card.imageUrls?.[0]
                    /* Dieselbe Behandlung wie im Katalog: das Bild klein
                     * ausliefern und verzögert laden. Manuelle Karten tragen
                     * keine eBay-URL, deshalb ohne `ebayImageVariant`. */
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img className="card-art product-photo" src={card.imageUrls[0]} alt={card.title} loading="lazy" decoding="async" width={450} height={800} />
                    : <div className="card-art card-art-gold" aria-hidden="true"><span className="art-mark">BC</span></div>}
                </Link>
                <span className="product-badge">Vorverkauf</span>
              </div>
              <div className="product-info">
                <p className="product-meta">Direkt bei uns</p>
                <h3><Link href={`/karten/${card.id}`}>{card.title}</Link></h3>
                {card.description && <p className="product-description">{card.description}</p>}
                <div className="product-footer">
                  <strong>{formatPrice(card.priceAmountCents, card.priceCurrency) ?? "Preis auf Anfrage"}</strong>
                  {knopf.action === "remove"
                    ? <button type="button" className="product-cta" onClick={() => removeFromCart(card.id)}>{knopf.label} <span>×</span></button>
                    : <button type="button" className="product-cta" disabled={knopf.disabled} onClick={() => addToCart(card.id, card.quantity)}>{knopf.label} <span>→</span></button>}
                </div>
              </div>
            </article>;
          })}
        </div>}
      </section>
      <SiteFooter />
    </main>
  );
}
