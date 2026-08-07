"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ebayImageVariant } from "../../lib/ebay-images.ts";
import { BotGuardFields, Field, FormFeedback, PrivacyNotice, botGuardPayload, postJson, useFormSubmit } from "../forms";
import { EBAY_SHOP_URL, SiteFooter, SiteHeader, formatPrice, useCart } from "../site-chrome";

type Product = {
  id: string;
  title: string;
  description: string | null;
  category: "Festpreis" | "Auktion" | "Vormerkliste";
  priceAmountCents: number | null;
  priceCurrency: string;
  quantity: number;
  listingUrl: string | null;
  imageUrls: string[];
};

function meta(category: Product["category"]) {
  if (category === "Auktion") return "Auktion auf eBay · Kauf direkt bei eBay";
  if (category === "Vormerkliste") return "Noch nicht im Verkauf · Interesse vormerken";
  return "eBay synchronisiert · Sofort-Kaufen";
}

function badge(category: Product["category"]) {
  if (category === "Auktion") return "eBay Auktion";
  if (category === "Vormerkliste") return "Vormerkliste";
  return "Sofort-Kaufen";
}

export default function KartenPage() {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const { addToCart } = useCart();
  const interest = useFormSubmit();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((data: { products?: Product[] }) => {
        if (cancelled) return;
        setCatalog(data.products ?? []);
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter((product) => !needle || product.title.toLowerCase().includes(needle));
  }, [catalog, query]);

  return <main>
    <SiteHeader active="/karten" />

    <section className="page-intro">
      <p className="eyebrow">DER BESTAND</p>
      <h1>Alle Karten.</h1>
      <p>Unser gesamter Bestand — jede Karte einzeln geprüft, beschrieben und sicher verpackt.</p>
    </section>

    <section className="shop-section" id="shop">
      <div className="shop-toolbar">
        <label className="search-field" htmlFor="search">
          <span aria-hidden="true">⌕</span>
          <input id="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Spieler, Set oder Kartennummer" aria-label="Karten durchsuchen" />
        </label>
      </div>

      {status === "loading" && <div className="empty-state">Karten werden geladen …</div>}
      {status === "error" && <div className="empty-state">Die Karten konnten gerade nicht geladen werden. Bitte lade die Seite neu.</div>}

      {status === "ready" && <>
        <p className="result-count" role="status">{filtered.length} von {catalog.length} Karten</p>
        <div className="product-grid">
          {filtered.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="product-image">
                <Link href={`/karten/${product.id}`} className="product-image-link" aria-label={product.title}>
                  {product.imageUrls?.[0]
                    /* The grid never shows a card wider than ~430px, so the
                     * 900x1600 original would be wasted bytes across 296 cards.
                     * Lazy loading keeps the initial page light. */
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img
                        className="card-art product-photo"
                        src={ebayImageVariant(product.imageUrls[0], 800)}
                        alt={product.title}
                        loading="lazy"
                        decoding="async"
                        width={450}
                        height={800}
                      />
                    : <div className="card-art card-art-gold" aria-hidden="true"><span className="art-mark">BC</span></div>}
                </Link>
                <span className="product-badge">{badge(product.category)}</span>
              </div>
              <div className="product-info">
                <p className="product-meta">{meta(product.category)}</p>
                <h2><Link href={`/karten/${product.id}`}>{product.title}</Link></h2>
                {product.description && <p className="product-description">{product.description}</p>}
                <div className="product-footer">
                  {formatPrice(product.priceAmountCents, product.priceCurrency)
                    ? <strong>{formatPrice(product.priceAmountCents, product.priceCurrency)}</strong>
                    : <strong className="interest-price">Interesse bekunden</strong>}
                  {product.category === "Auktion"
                    ? <a className="product-cta ebay" href={product.listingUrl || EBAY_SHOP_URL} target="_blank" rel="noreferrer">Auf eBay ansehen ↗</a>
                    : product.category === "Vormerkliste"
                      ? <button className="product-cta" type="button" onClick={() => { interest.setFeedback(null); setSelected(product); }}>Vormerken <span>→</span></button>
                      : <button className="product-cta" type="button" disabled={product.quantity === 0} onClick={() => addToCart(product.id)} title={product.quantity === 0 ? "Nicht verfügbar" : "Zum Warenkorb hinzufügen"}>In den Warenkorb <span>+</span></button>}
                </div>
              </div>
            </article>
          ))}
        </div>
        {filtered.length === 0 && <div className="empty-state">Keine Karten für diese Suche gefunden.</div>}
      </>}

      <div className="center-action">
        <a className="button button-outline" href={EBAY_SHOP_URL} target="_blank" rel="noreferrer">Alle eBay-Angebote ansehen <span>↗</span></a>
      </div>
    </section>

    {selected && <section className="form-section compact-form" aria-labelledby="interest-title">
      <div className="form-heading">
        <p className="eyebrow">VORMERKEN</p>
        <h2 id="interest-title">{selected.title}</h2>
        <p>Hinterlasse deine E-Mail-Adresse — wir melden uns, sobald die Karte in den Verkauf geht.</p>
      </div>
      <form onSubmit={(event) => interest.run(event, async (form) => postJson("/api/prelisted-interest", {
        ...botGuardPayload(form),
        productId: selected.id,
        email: new FormData(form).get("email"),
      }))}>
        <BotGuardFields />
        <Field label="E-Mail-Adresse" name="email" type="email" />
        <PrivacyNotice />
        <div className="form-row">
          <button className="button button-primary" type="submit" disabled={interest.pending}>{interest.pending ? "Wird gesendet …" : "Vormerkung senden"}</button>
          <button className="text-link" type="button" onClick={() => setSelected(null)}>Abbrechen</button>
        </div>
        <FormFeedback feedback={interest.feedback} />
      </form>
    </section>}

    <section className="cta-strip">
      <p>Nicht gefunden, wonach du suchst?</p>
      <Link className="button button-primary" href="/anfragen">Karte anfragen <span>↘</span></Link>
    </section>

    <SiteFooter />
  </main>;
}
