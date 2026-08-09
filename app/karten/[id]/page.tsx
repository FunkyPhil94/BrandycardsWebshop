"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ebayImageVariant } from "../../../lib/ebay-images.ts";
import { cartButtonState } from "../../../lib/cart.ts";
import { SiteFooter, SiteHeader, formatPrice, useCart } from "../../site-chrome";
import { OfferForm } from "./offer-form";

type CardSpec = { label: string; value: string };
type CardSection = { heading: string; html: string };

type Detail = {
  id: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  specs: CardSpec[];
  sections: CardSection[];
  category: "Festpreis" | "Direkt bei uns";
  priceAmountCents: number | null;
  priceCurrency: string;
  quantity: number;
  listingUrl: string | null;
  imageUrls: string[];
};

export default function KartenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  type Loaded = { id: string; status: "loading" | "ready" | "missing" | "error"; card: Detail | null };
  const [loaded, setLoaded] = useState<Loaded>({ id, status: "loading", card: null });
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const { cart, addToCart, removeFromCart } = useCart();

  // Deriving the pending state from the requested id keeps the effect free of a
  // reset call: a new id simply reads as loading until its response lands.
  const { status, card } = loaded.id === id ? loaded : { status: "loading" as const, card: null };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/${id}`)
      .then(async (response) => {
        if (response.status === 404) return { id, status: "missing" as const, card: null };
        if (!response.ok) throw new Error("failed");
        return { id, status: "ready" as const, card: (await response.json()) as Detail };
      })
      .then((next) => {
        if (cancelled) return;
        setLoaded(next);
        setActive(0);
      })
      .catch(() => { if (!cancelled) setLoaded({ id, status: "error", card: null }); });
    return () => { cancelled = true; };
  }, [id]);

  // The lightbox traps nothing but Escape; closing has to work without a mouse.
  const closeZoom = useCallback(() => setZoomed(false), []);
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeZoom(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [closeZoom, zoomed]);

  const price = card ? formatPrice(card.priceAmountCents, card.priceCurrency) : null;
  const images = card?.imageUrls ?? [];
  const current = images[active];

  return <main>
    <SiteHeader active="/karten" />

    <div className="detail-back">
      <Link className="text-link" href="/karten">← Zurück zu allen Karten</Link>
    </div>

    {status === "loading" && <section className="page-intro"><p>Karte wird geladen …</p></section>}
    {status === "missing" && <section className="page-intro">
      <p className="eyebrow">NICHT VERFÜGBAR</p>
      <h1>Diese Karte gibt es nicht mehr.</h1>
      <p>Sie wurde verkauft oder ist nicht mehr gelistet. Vielleicht wirst du im übrigen Bestand fündig.</p>
      <div className="hero-actions"><Link className="button button-primary" href="/karten">Alle Karten ansehen <span>→</span></Link></div>
    </section>}
    {status === "error" && <section className="page-intro"><h1>Etwas ist schiefgelaufen.</h1><p>Die Karte konnte nicht geladen werden. Bitte lade die Seite neu.</p></section>}

    {status === "ready" && card && <>
      <section className="detail-layout">
        <div className="detail-media">
          <button
            type="button"
            className="detail-image"
            onClick={() => current && setZoomed(true)}
            aria-label={current ? `${card.title} vergrößern` : card.title}
          >
            {current
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={current} alt={card.title} width={900} height={1600} />
              : <span className="gallery-fallback" aria-hidden="true">BC</span>}
            {current && <span className="detail-zoom-hint">Zum Vergrößern klicken ⤢</span>}
          </button>

          {images.length > 1 && <div className="detail-thumbs">
            {images.map((url, index) => (
              <button
                key={url}
                type="button"
                className={index === active ? "active" : ""}
                onClick={() => setActive(index)}
                aria-label={`Bild ${index + 1} von ${images.length}`}
                aria-current={index === active}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ebayImageVariant(url, 225)} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>}
        </div>

        <div className="detail-info">
          <p className="eyebrow">{card.category === "Direkt bei uns" ? "VORVERKAUF" : "SOFORT-KAUFEN"}</p>
          <h1>{card.title}</h1>
          {price && <p className="detail-price">{price}</p>}
          <p className="detail-stock">{card.quantity > 0 ? `${card.quantity} verfügbar` : "Derzeit nicht verfügbar"}</p>

          <div className="detail-actions">
            {card.category === "Direkt bei uns"
              ? <span className="detail-offer-only">Nur Preisvorschlag möglich</span>
              : (() => {
                  const state = cartButtonState(card.quantity, cart[card.id] ?? 0);
                  return <button
                    className={state.action === "remove" ? "button button-outline" : "button button-primary"}
                    type="button"
                    disabled={state.disabled}
                    onClick={() => state.action === "remove" ? removeFromCart(card.id) : addToCart(card.id, card.quantity)}
                  >
                    {state.label}{state.action && <span>{state.action === "remove" ? "×" : "+"}</span>}
                  </button>;
                })()}
            {card.listingUrl && <a className="text-link" href={card.listingUrl} target="_blank" rel="noreferrer">Angebot bei eBay <span>↗</span></a>}
          </div>

          {/* **Nicht `=== "Festpreis"` prüfen.** Von Hand eingestellte Karten
              tragen die Kategorie „Direkt bei uns" und sollen laut Entscheidung
              des Betreibers vom 2026-08-08 **genauso verhandelbar** sein wie
              eBay-Karten. Mit einer Prüfung auf „Festpreis" fehlte ihnen der
              Kasten stillschweigend — der Shop bewirbt Verhandeln, und
              ausgerechnet die eigenen Karten hätten es nicht angeboten. */}
          {card.quantity > 0 &&
            <OfferForm productId={card.id} listPriceCents={card.priceAmountCents} currency={card.priceCurrency} />}

          <dl className="detail-facts">
            <div><dt>Versand</dt><dd>Deutschland 3,45 € · EU 14,49 €</dd></div>
            <div><dt>Zustand</dt><dd>Siehe Artikelbeschreibung</dd></div>
          </dl>
        </div>
      </section>

      <section className="detail-description">
        <h2>Artikelbeschreibung</h2>
        {card.specs.length > 0 && <div className="spec-table">
          <h3>Kartendetails</h3>
          <dl>
            {card.specs.map((spec) => (
              <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>
            ))}
          </dl>
        </div>}

        {card.sections.map((section) => (
          <article className="detail-block" key={section.heading}>
            <h3>{section.heading}</h3>
            {/* Sanitised server-side and re-rendered in the shop's own styling;
                see lib/sanitize-html.ts and lib/ebay-description.ts. */}
            <div className="detail-prose" dangerouslySetInnerHTML={{ __html: section.html }} />
          </article>
        ))}

        {card.specs.length === 0 && card.sections.length === 0 && (card.descriptionHtml
          ? <div className="ebay-description" dangerouslySetInnerHTML={{ __html: card.descriptionHtml }} />
          : card.description
            ? <p>{card.description}</p>
            : <p className="detail-empty">Für diese Karte liegt noch keine Beschreibung vor. Das Angebot bei eBay enthält alle Details.</p>)}
      </section>

      {zoomed && current && <div
        className="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={`${card.title} vergrößert`}
        onClick={closeZoom}
      >
        <button type="button" className="lightbox-close" onClick={closeZoom} aria-label="Schließen">✕</button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt={card.title} onClick={(event) => event.stopPropagation()} />
      </div>}
    </>}

    <SiteFooter />
  </main>;
}
