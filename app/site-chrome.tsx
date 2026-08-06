"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

export const EBAY_SHOP_URL = "https://www.ebay.de/str/brandycards";
const CART_KEY = "brandycards-cart";
const CART_EVENT = "brandycards-cart-changed";

export type CartState = Record<string, number>;

const EMPTY_CART: CartState = {};

// useSyncExternalStore hands the same object back on every render unless the
// stored string actually changed. Parsing fresh each time would return a new
// reference and spin React into an endless re-render.
let cache: { raw: string; value: CartState } = { raw: "{}", value: EMPTY_CART };

function parseCart(raw: string): CartState {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return EMPTY_CART;
    return parsed as CartState;
  } catch {
    return EMPTY_CART;
  }
}

function subscribeCart(onChange: () => void) {
  window.addEventListener(CART_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CART_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function cartSnapshot(): CartState {
  const raw = sessionStorage.getItem(CART_KEY) ?? "{}";
  if (raw !== cache.raw) cache = { raw, value: parseCart(raw) };
  return cache.value;
}

/** Shared cart state. The header renders on every page, so the count has to
 * survive navigation and stay in step when another component adds an item.
 * sessionStorage is not available while rendering on the server, hence the
 * empty server snapshot. */
export function useCart() {
  const cart = useSyncExternalStore(subscribeCart, cartSnapshot, () => EMPTY_CART);

  const addToCart = useCallback((productId: string) => {
    const next = { ...cartSnapshot() };
    next[productId] = (next[productId] ?? 0) + 1;
    sessionStorage.setItem(CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CART_EVENT));
  }, []);

  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  return { cart, count, addToCart };
}

const NAV = [
  { href: "/karten", label: "Karten" },
  { href: "/anfragen", label: "Anfragen" },
  { href: "/verkaufen", label: "Verkaufen" },
  { href: "/ueber-uns", label: "Über uns" },
];

export function SiteHeader({ active }: { active?: string }) {
  const { count } = useCart();
  return <>
    <div className="announcement"><span>✦</span> Versand innerhalb Deutschlands 3,45 € · EU 14,49 € <span>→</span></div>
    <header className="site-header">
      <Link className="brand" href="/" aria-label="BrandyCards Startseite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/BrandyCards_Logo_transparent.png" alt="BrandyCards" />
      </Link>
      <nav className="main-nav" aria-label="Hauptnavigation">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} aria-current={active === item.href ? "page" : undefined}>{item.label}</Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link className="account-link" href="/account">Konto <span>↗</span></Link>
        <Link className="cart-button" href="/checkout" aria-label={`Warenkorb, ${count} Artikel`}>Warenkorb <b>{count}</b></Link>
      </div>
    </header>
  </>;
}

export function SiteFooter() {
  return <footer id="contact">
    <div className="footer-top">
      <Link className="brand" href="/" aria-label="BrandyCards Startseite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/BrandyCards_Logo_transparent.png" alt="BrandyCards" />
      </Link>
      <p>Collect the moment.</p>
      <div className="footer-links">
        <Link href="/karten">Karten</Link>
        <Link href="/anfragen">Karte anfragen</Link>
        <Link href="/verkaufen">Karten verkaufen</Link>
        <Link href="/ueber-uns">Über uns</Link>
        <Link href="/account">Konto ↗</Link>
        <a href={EBAY_SHOP_URL} target="_blank" rel="noreferrer">eBay-Shop ↗</a>
      </div>
    </div>
    <div className="footer-bottom">
      <span>© 2026 BrandyCards · Leverkusen</span>
      <span className="legal-nav">
        <Link href="/impressum">Impressum</Link>
        <Link href="/datenschutz">Datenschutz</Link>
        <Link href="/agb">AGB</Link>
        <Link href="/widerruf">Widerruf</Link>
        <Link href="/versand-zahlung">Versand &amp; Zahlung</Link>
      </span>
      <span>Designed for collectors</span>
    </div>
  </footer>;
}

export function formatPrice(cents: number | null, currency = "EUR") {
  if (cents === null) return null;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}
