"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ebayImageVariant } from "../../../lib/ebay-images.ts";
import { cartButtonState } from "../../../lib/cart.ts";
import { useI18n } from "../../i18n";
import { Lightbox } from "../../lightbox";
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
  const { t, locale } = useI18n();

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

  // Escape und die Sperre des Hintergrundscrollens stecken jetzt in der
  // Lightbox selbst (app/lightbox.tsx) — sie gilt für alle, die sie benutzen.
  const closeZoom = useCallback(() => setZoomed(false), []);

  const price = card ? formatPrice(card.priceAmountCents, card.priceCurrency, locale) : null;
  const images = card?.imageUrls ?? [];
  const current = images[active];

  return <main>
    <SiteHeader active="/karten" />

    <div className="detail-back">
      <Link className="text-link" href="/karten">← {t("Zurück zu allen Karten")}</Link>
    </div>

    {status === "loading" && <section className="page-intro"><p>{t("Karte wird geladen …")}</p></section>}
    {status === "missing" && <section className="page-intro">
      <p className="eyebrow">{t("NICHT VERFÜGBAR")}</p>
      <h1>{t("Diese Karte gibt es nicht mehr.")}</h1>
      <p>{t("Sie wurde verkauft oder ist nicht mehr gelistet. Vielleicht wirst du im übrigen Bestand fündig.")}</p>
      <div className="hero-actions"><Link className="button button-primary" href="/karten">{t("Alle Karten ansehen")} <span>→</span></Link></div>
    </section>}
    {status === "error" && <section className="page-intro"><h1>{t("Etwas ist schiefgelaufen.")}</h1><p>{t("Die Karte konnte nicht geladen werden. Bitte lade die Seite neu.")}</p></section>}

    {status === "ready" && card && <>
      <section className="detail-layout">
        <div className="detail-media">
          <button
            type="button"
            className="detail-image"
            onClick={() => current && setZoomed(true)}
            aria-label={current ? `${card.title} ${t("vergrößern")}` : card.title}
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
                aria-label={t("Bild {{index}} von {{total}}", { index: index + 1, total: images.length })}
                aria-current={index === active}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ebayImageVariant(url, 225)} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>}
        </div>

        <div className="detail-info">
          <p className="eyebrow">{card.category === "Direkt bei uns" ? t("VORVERKAUF") : t("SOFORT-KAUFEN")}</p>
          <h1>{card.title}</h1>
          {price && <p className="detail-price">{price}</p>}
          <p className="detail-stock">{card.quantity > 0 ? t("{{count}} verfügbar", { count: card.quantity }) : t("Derzeit nicht verfügbar")}</p>

          <div className="detail-actions">
            {card.category === "Direkt bei uns"
              ? <span className="detail-offer-only">{t("Nur Preisvorschlag möglich")}</span>
              : (() => {
                  const state = cartButtonState(card.quantity, cart[card.id] ?? 0);
                  return <button
                    className={state.action === "remove" ? "button button-outline" : "button button-primary"}
                    type="button"
                    disabled={state.disabled}
                    onClick={() => state.action === "remove" ? removeFromCart(card.id) : addToCart(card.id, card.quantity)}
                  >
                    {t(state.label)}{state.action && <span>{state.action === "remove" ? "×" : "+"}</span>}
                  </button>;
                })()}
            {card.listingUrl && <a className="text-link" href={card.listingUrl} target="_blank" rel="noreferrer">{t("Angebot bei eBay")} <span>↗</span></a>}
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
          <div><dt>{t("Versand")}</dt><dd>{t("Deutschland 3,45 € · EU 14,49 €")}</dd></div>
          <div><dt>{t("Zustand")}</dt><dd>{t("Siehe Artikelbeschreibung")}</dd></div>
          </dl>
        </div>
      </section>

      <section className="detail-description">
        <h2>{t("Artikelbeschreibung")}</h2>
        {card.specs.length > 0 && <div className="spec-table">
          <h3>{t("Kartendetails")}</h3>
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
          : <p className="detail-empty">{t("Für diese Karte liegt noch keine Beschreibung vor. Das Angebot bei eBay enthält alle Details.")}</p>)}
      </section>

      {zoomed && current && <Lightbox
        key={current}
        src={current}
        alt={card.title}
        label={`${card.title} ${t("vergrößert")}`}
        schliessenLabel={t("Schließen")}
        onClose={closeZoom}
      />}
    </>}

    <SiteFooter />
  </main>;
}
