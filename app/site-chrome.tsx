"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
// 500 px breit fuer eine Darstellung mit 164 px - deckt auch dreifache
// Punktdichte ab. Die Vorlage liegt daneben als …-original.png und wird
// bewusst nicht importiert, landet also nicht im Bauergebnis.
import logo from "./brand/brandycards-logo.png";
import { LanguageSwitch, useI18n } from "./i18n";
import type { Locale } from "../lib/i18n";

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

  /** Legt eine Karte in den Warenkorb — höchstens so oft, wie es sie gibt.
   *
   * Fast jede Karte ist ein Einzelstück. Ohne diese Grenze ließ sich dieselbe
   * Karte beliebig oft hinzufügen; abgelehnt wurde das erst serverseitig beim
   * Anlegen der Bestellung (`app/api/orders/route.ts`), also nachdem der Kunde
   * die Lieferadresse ausgefüllt hatte. Der Server bleibt die verbindliche
   * Instanz — diese Prüfung erspart nur den Umweg.
   *
   * `available` ist die Menge aus der Datenbank. Fehlt sie oder ist sie
   * unbrauchbar, gilt 0: lieber nichts hinzufügen als zu viel.
   */
  const addToCart = useCallback((productId: string, available: number) => {
    const limit = Number.isInteger(available) && available > 0 ? available : 0;
    const current = cartSnapshot();
    const held = current[productId] ?? 0;
    if (held >= limit) return false;
    const next = { ...current, [productId]: held + 1 };
    sessionStorage.setItem(CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CART_EVENT));
    return true;
  }, []);

  /** Nimmt eine Karte wieder heraus — vollständig, nicht um eins verringert.
   *
   * Fast jede Karte ist ein Einzelstück; „Menge um eins senken" und „entfernen"
   * fallen dort zusammen. Vorher gab es diesen Weg nur im Checkout, der Knopf
   * in der Übersicht stand deaktiviert auf „Bereits im Warenkorb" — eine
   * Sackgasse.
   */
  const removeFromCart = useCallback((productId: string) => {
    const current = cartSnapshot();
    if (!(productId in current)) return false;
    const next = { ...current };
    delete next[productId];
    sessionStorage.setItem(CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CART_EVENT));
    return true;
  }, []);

  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  return { cart, count, addToCart, removeFromCart };
}

const NAV = [
  { href: "/karten", label: "Karten" },
  // Der Vorverkauf steht fest in der Navigation, nicht erst ab der ersten
  // Karte. **Abweichung von ai-todo Punkt A**, wo „erst mit der ersten Karte
  // erscheinen" stand: Dafür müsste die Kopfzeile auf jeder Seite den Katalog
  // laden, nur um über einen Menüpunkt zu entscheiden — und ein Punkt, der
  // auftaucht und wieder verschwindet, verwirrt wiederkehrende Kunden mehr als
  // ein Bereich, der gerade leer ist. Den leeren Fall erklärt die Seite selbst.
  { href: "/vorverkauf", label: "Vorverkauf" },
  { href: "/anfragen", label: "Anfragen" },
  { href: "/verkaufen", label: "Verkaufen" },
  { href: "/ueber-uns", label: "Über uns" },
];

export function SiteHeader({ active }: { active?: string }) {
  const { count } = useCart();
  const { t } = useI18n();
  const [menuOffen, setMenuOffen] = useState(false);
  const leisteRef = useRef<HTMLDivElement>(null);

  // Escape schließt, ein Klick außerhalb der Leiste ebenfalls. Beides hängt nur
  // am geöffneten Zustand — im geschlossenen liegen keine Listener herum.
  useEffect(() => {
    if (!menuOffen) return;
    const beiTaste = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOffen(false); };
    const beiKlick = (event: MouseEvent) => {
      if (!leisteRef.current?.contains(event.target as Node)) setMenuOffen(false);
    };
    document.addEventListener("keydown", beiTaste);
    document.addEventListener("pointerdown", beiKlick);
    return () => {
      document.removeEventListener("keydown", beiTaste);
      document.removeEventListener("pointerdown", beiKlick);
    };
  }, [menuOffen]);

  return <>
    <div className="announcement"><span>✦</span> {t("Versand innerhalb Deutschlands 3,45 € · EU 14,49 €")} <span>→</span></div>
    {/* Der Balken trägt das Kleben und den Hintergrund, nicht die Kopfzeile
        selbst: `.site-header` ist auf 1400px begrenzt und zentriert, ein
        `position:sticky` darauf ließe den Inhalt an den Rändern durchscheinen. */}
    <div className="site-header-bar" ref={leisteRef}>
      <header className="site-header">
        <Link className="brand" href="/" aria-label={t("BrandyCards Startseite")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src={logo.src} width={logo.width} height={logo.height} alt="BrandyCards" />
        </Link>
        <nav className="main-nav" aria-label={t("Hauptnavigation")}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={active === item.href ? "page" : undefined}>{t(item.label)}</Link>
          ))}
        </nav>
        <div className="header-actions">
          <LanguageSwitch />
          <Link className="account-link" href="/account">{t("Konto")} <span>↗</span></Link>
          <Link className="cart-button" href="/checkout" aria-label={t("Warenkorb, {{count}} Artikel", { count })}>{t("Warenkorb")} <b>{count}</b></Link>
          {/* Nur unter 850px sichtbar. Oberhalb blendet CSS Schaltfläche und
              Liste aus — ein offen gelassenes Menü ist beim Vergrößern des
              Fensters dadurch folgenlos, ohne dass Zustand aufgeräumt wird. */}
          <button
            className="nav-toggle"
            type="button"
            aria-expanded={menuOffen}
            aria-controls="mobile-nav"
            aria-label={menuOffen ? t("Menü schließen") : t("Menü öffnen")}
            onClick={() => setMenuOffen((offen) => !offen)}
          >
            <span className={menuOffen ? "nav-toggle-icon offen" : "nav-toggle-icon"} aria-hidden="true">
              <i /><i /><i />
            </span>
          </button>
        </div>
      </header>
      {/* Absolut positioniert, nicht im Fluss: Die Leiste muss ihre Höhe
          behalten, sonst stimmt --header-h im geöffneten Zustand nicht mehr. */}
      <nav id="mobile-nav" className={menuOffen ? "mobile-nav offen" : "mobile-nav"} aria-label={t("Hauptnavigation")} hidden={!menuOffen}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active === item.href ? "page" : undefined}
            onClick={() => setMenuOffen(false)}
          >{t(item.label)}</Link>
        ))}
      </nav>
    </div>
  </>;
}

export function SiteFooter() {
  const { t } = useI18n();
  return <footer id="contact">
    <div className="footer-top">
      <Link className="brand" href="/" aria-label={t("BrandyCards Startseite")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src={logo.src} width={logo.width} height={logo.height} alt="BrandyCards" />
      </Link>
      <p>Collect the moment.</p>
      <div className="footer-links">
        <Link href="/karten">{t("Karten")}</Link>
        <Link href="/anfragen">{t("Karte anfragen")}</Link>
        <Link href="/verkaufen">{t("Karten verkaufen")}</Link>
        <Link href="/ueber-uns">{t("Über uns")}</Link>
        <Link href="/account">{t("Konto ↗")}</Link>
        <a href={EBAY_SHOP_URL} target="_blank" rel="noreferrer">{t("eBay-Shop ↗")}</a>
      </div>
    </div>
    <div className="footer-bottom">
      <span>© 2026 BrandyCards · Leverkusen</span>
      <span className="legal-nav">
        <Link href="/impressum">{t("Impressum")}</Link>
        <Link href="/datenschutz">{t("Datenschutz")}</Link>
        <Link href="/agb">{t("AGB")}</Link>
        <Link href="/widerruf">{t("Widerruf")}</Link>
        <Link href="/versand-zahlung">{t("Versand & Zahlung")}</Link>
      </span>
      <span>Designed for collectors</span>
    </div>
  </footer>;
}

export function formatPrice(cents: number | null, currency = "EUR", locale: Locale = "de") {
  if (cents === null) return null;
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "de-DE", { style: "currency", currency }).format(cents / 100);
}
