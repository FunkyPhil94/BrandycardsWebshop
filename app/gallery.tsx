"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cartButtonState } from "../lib/cart.ts";
import { EBAY_SHOP_URL, formatPrice, useCart } from "./site-chrome";

const ROTATE_MS = 2000;
export const GALLERY_SIZE = 5;

type Highlight = {
  id: string;
  title: string;
  description: string | null;
  category: "Festpreis" | "Auktion";
  priceAmountCents: number | null;
  priceCurrency: string;
  quantity: number;
  listingUrl: string | null;
  imageUrl: string | null;
};

type View = "newest" | "priciest";

const VIEWS: Array<{ id: View; label: string; hint: string }> = [
  { id: "newest", label: "Neu dabei", hint: "Die fünf zuletzt eingestellten Karten" },
  { id: "priciest", label: "Beliebt", hint: "Die fünf hochwertigsten Karten" },
];

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );
}

export function Gallery() {
  const [view, setView] = useState<View>("newest");
  const [sets, setSets] = useState<Record<View, Highlight[]>>({ newest: [], priciest: [] });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const reducedMotion = usePrefersReducedMotion();
  const { cart, addToCart, removeFromCart } = useCart();
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products/highlights")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((data: { newest?: Highlight[]; priciest?: Highlight[] }) => {
        if (cancelled) return;
        setSets({ newest: data.newest ?? [], priciest: data.priciest ?? [] });
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const cards = sets[view].slice(0, GALLERY_SIZE);
  const total = cards.length;

  const advance = useCallback((step = 1) => {
    setIndex((current) => (total ? (current + step + total) % total : 0));
  }, [total]);

  // Auto-advance. Pauses on hover and keyboard focus so a card can actually be
  // read, and stays off entirely when the visitor asked for reduced motion.
  useEffect(() => {
    if (reducedMotion || paused || total < 2) return;
    const timer = window.setInterval(() => advance(1), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [advance, paused, reducedMotion, total]);

  // Full-resolution cards weigh a few hundred KB each. With a two second
  // interval the first pass through would flash placeholders, so warm the
  // browser cache for the active view up front.
  useEffect(() => {
    for (const card of cards) {
      if (!card.imageUrl) continue;
      const preload = new Image();
      preload.src = card.imageUrl;
    }
  }, [cards]);

  function selectView(next: View) {
    setView(next);
    setIndex(0);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") { event.preventDefault(); advance(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); advance(-1); }
  }

  const current = cards[index];

  return <section className="gallery-section" aria-labelledby="gallery-title">
    <div className="gallery-heading">
      <div>
        <p className="eyebrow">AUS DEM BESTAND</p>
        <h2 id="gallery-title">Fünf Karten,<br /><em>frisch gezeigt.</em></h2>
      </div>
      <div className="gallery-views" role="tablist" aria-label="Auswahl der Galerie">
        {VIEWS.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            type="button"
            aria-selected={view === entry.id}
            className={view === entry.id ? "active" : ""}
            onClick={() => selectView(entry.id)}
            title={entry.hint}
          >{entry.label}</button>
        ))}
      </div>
    </div>

    <div
      className="gallery-stage"
      ref={regionRef}
      role="region"
      aria-roledescription="Karussell"
      aria-label="Ausgewählte Karten"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {status === "loading" && <p className="gallery-empty">Karten werden geladen …</p>}
      {status === "error" && <p className="gallery-empty">Die Karten konnten gerade nicht geladen werden. <Link className="text-link" href="/karten">Zum Kartenbestand <span>→</span></Link></p>}
      {status === "ready" && total === 0 && <p className="gallery-empty">Zurzeit sind keine Karten verfügbar.</p>}

      {current && <>
        <button
          type="button"
          className="gallery-card"
          onClick={() => advance(1)}
          aria-label={`Nächste Karte. Aktuell: ${current.title}`}
        >
          <span className="gallery-frame">
            {current.imageUrl
              /* The gallery is the showpiece: full resolution, eager, and
               * never upscaled from a thumbnail. */
              // eslint-disable-next-line @next/next/no-img-element
              ? <img
                  src={current.imageUrl}
                  alt={current.title}
                  width={900}
                  height={1600}
                  decoding="async"
                />
              : <span className="gallery-fallback" aria-hidden="true">BC</span>}
          </span>
          <span className="gallery-badge">{current.category === "Auktion" ? "eBay Auktion" : "Sofort-Kaufen"}</span>
        </button>

        <div className="gallery-detail">
          <p className="product-meta">{current.category === "Auktion" ? "Auktion auf eBay" : "Sofort verfügbar"}</p>
          <h3>
            {current.category === "Auktion"
              ? <a href={current.listingUrl || EBAY_SHOP_URL} target="_blank" rel="noreferrer">{current.title}</a>
              : <Link href="/karten">{current.title}</Link>}
          </h3>
          {/* Immer gerendert, auch ohne Text: Die Bühne wechselt alle zwei
              Sekunden die Karte, und ein Absatz, der mal da ist und mal nicht,
              lässt das Layout bei jedem Wechsel springen. */}
          <p className="gallery-description">{current.description}</p>
          <div className="gallery-actions">
            {formatPrice(current.priceAmountCents, current.priceCurrency) && <strong>{formatPrice(current.priceAmountCents, current.priceCurrency)}</strong>}
            {current.category === "Auktion"
              ? <a className="button button-primary" href={current.listingUrl || EBAY_SHOP_URL} target="_blank" rel="noreferrer">Auf eBay ansehen <span>↗</span></a>
              : (() => {
                  const state = cartButtonState(current.quantity, cart[current.id] ?? 0);
                  return <button
                    className={state.action === "remove" ? "button button-outline" : "button button-primary"}
                    type="button"
                    disabled={state.disabled}
                    onClick={() => state.action === "remove" ? removeFromCart(current.id) : addToCart(current.id, current.quantity)}
                  >
                    {state.label}{state.action && <span>{state.action === "remove" ? "×" : "+"}</span>}
                  </button>;
                })()}
          </div>
        </div>

        <div className="gallery-controls">
          <button type="button" onClick={() => advance(-1)} aria-label="Vorherige Karte">←</button>
          <div className="gallery-dots" role="tablist" aria-label="Karte auswählen">
            {cards.map((card, dot) => (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={dot === index}
                aria-label={`Karte ${dot + 1} von ${total}`}
                className={dot === index ? "active" : ""}
                onClick={() => setIndex(dot)}
              />
            ))}
          </div>
          <button type="button" onClick={() => advance(1)} aria-label="Nächste Karte">→</button>
        </div>

        <p className="gallery-live" role="status" aria-live="polite">Karte {index + 1} von {total}</p>
      </>}
    </div>
  </section>;
}
