"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ebayImageVariant } from "../../../lib/ebay-images.ts";
import { EBAY_SHOP_URL, SiteFooter, SiteHeader, formatPrice, useCart } from "../../site-chrome";

type Detail = {
  id: string;
  title: string;
  description: string | null;
  descriptionHtml: string | null;
  category: "Festpreis" | "Auktion";
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
  const { addToCart } = useCart();

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
          <p className="eyebrow">{card.category === "Auktion" ? "EBAY AUKTION" : "SOFORT-KAUFEN"}</p>
          <h1>{card.title}</h1>
          {price && <p className="detail-price">{price}</p>}
          <p className="detail-stock">{card.quantity > 0 ? `${card.quantity} verfügbar` : "Derzeit nicht verfügbar"}</p>

          <div className="detail-actions">
            {card.category === "Auktion"
              ? <a className="button button-primary" href={card.listingUrl || EBAY_SHOP_URL} target="_blank" rel="noreferrer">Auf eBay bieten <span>↗</span></a>
              : <button className="button button-primary" type="button" disabled={card.quantity === 0} onClick={() => addToCart(card.id)}>
                  {card.quantity === 0 ? "Nicht verfügbar" : "In den Warenkorb"} <span>+</span>
                </button>}
            {card.listingUrl && <a className="text-link" href={card.listingUrl} target="_blank" rel="noreferrer">Angebot bei eBay <span>↗</span></a>}
          </div>

          <dl className="detail-facts">
            <div><dt>Versand</dt><dd>Versandkostenfrei ab 75 € innerhalb Deutschlands</dd></div>
            <div><dt>Zustand</dt><dd>Siehe Artikelbeschreibung</dd></div>
            <div><dt>Verpackung</dt><dd>Bruch- und feuchtigkeitssicher</dd></div>
          </dl>
        </div>
      </section>

      <section className="detail-description">
        <h2>Artikelbeschreibung</h2>
        {card.descriptionHtml
          /* Server-sanitised in /api/products/[id]; see lib/sanitize-html.ts. */
          ? <div className="ebay-description" dangerouslySetInnerHTML={{ __html: card.descriptionHtml }} />
          : card.description
            ? <p>{card.description}</p>
            : <p className="detail-empty">Für diese Karte liegt noch keine Beschreibung vor. Das Angebot bei eBay enthält alle Details.</p>}
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
