"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cartButtonState } from "../../lib/cart.ts";
import { ebayImageVariant } from "../../lib/ebay-images.ts";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, PageSize, pageNumbers, toPageSize } from "../../lib/pagination.ts";
import { BotGuardFields, Field, FormFeedback, PrivacyNotice, botGuardPayload, postJson, useFormSubmit } from "../forms";
import { useI18n } from "../i18n";
import { EBAY_SHOP_URL, SiteFooter, SiteHeader, formatPrice, useCart } from "../site-chrome";

type Product = {
  id: string;
  title: string;
  description: string | null;
  category: "Festpreis" | "Vormerkliste" | "Direkt bei uns";
  priceAmountCents: number | null;
  priceCurrency: string;
  quantity: number;
  listingUrl: string | null;
  imageUrls: string[];
};

type CatalogCategory = "" | "fixed" | "manual" | "prelisted";

type CatalogResponse = {
  products?: Product[];
  page?: number;
  total?: number;
  totalPages?: number;
  first?: number;
  last?: number;
};

/** Die Zeile unter dem Ausweis — oder nichts.
 *
 * **Für Festpreiskarten steht hier absichtlich nichts mehr.** Bis zum
 * 2026-08-08 stand dort „eBay synchronisiert · Sofort-Kaufen": Die zweite
 * Hälfte wiederholte den Ausweis darüber, die erste war eine Innensicht, die
 * Kundschaft bestenfalls nichts sagt und schlimmstenfalls zu der Frage führt,
 * ob man nun zu eBay müsse. Ersatzlos gestrichen statt durch eine andere
 * Behauptung ersetzt.
 *
 * Die Vormerkliste behält ihren Hinweis — dort steht echte Information.
 */
function meta(category: Product["category"]) {
  if (category === "Vormerkliste") return "Noch nicht im Verkauf · Interesse vormerken";
  return null;
}

function badge(category: Product["category"]) {
  if (category === "Vormerkliste") return "Vormerkliste";
  if (category === "Direkt bei uns") return "Vorverkauf";
  return "Sofort-Kaufen";
}

export default function KartenPage() {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogCategory>("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 1, first: 0, last: 0 });
  const [initialized, setInitialized] = useState(false);
  const { cart, addToCart, removeFromCart } = useCart();
  const interest = useFormSubmit();
  const { t, locale } = useI18n();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const urlCategory = params.get("category");
      setQuery(params.get("q") ?? "");
      setCategory(urlCategory === "fixed" || urlCategory === "manual" || urlCategory === "prelisted" ? urlCategory : "");
      setMinPrice(params.get("min") ?? "");
      setMaxPrice(params.get("max") ?? "");
      setPageSize(toPageSize(params.get("pro")));
      const urlPage = Number(params.get("seite"));
      setPage(Number.isInteger(urlPage) && urlPage > 0 ? urlPage : 1);
      setInitialized(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ pro: String(pageSize), seite: String(page) });
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      if (minPrice.trim()) params.set("min", minPrice.trim());
      if (maxPrice.trim()) params.set("max", maxPrice.trim());
      setStatus("loading");
      fetch(`/api/products?${params}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
        .then((data: CatalogResponse) => {
          setCatalog(data.products ?? []);
          setPageInfo({ total: data.total ?? 0, totalPages: data.totalPages ?? 1, first: data.first ?? 0, last: data.last ?? 0 });
          if (data.page && data.page !== page) setPage(data.page);
          setStatus("ready");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setStatus("error");
        });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [category, initialized, maxPrice, minPrice, page, pageSize, query]);

  // Filter and page state stay shareable without adding a browser-history entry
  // for every keypress or page click.
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(window.location.search);
    if (query.trim()) params.set("q", query.trim()); else params.delete("q");
    if (category) params.set("category", category); else params.delete("category");
    if (minPrice.trim()) params.set("min", minPrice.trim()); else params.delete("min");
    if (maxPrice.trim()) params.set("max", maxPrice.trim()); else params.delete("max");
    if (pageSize === DEFAULT_PAGE_SIZE) params.delete("pro"); else params.set("pro", String(pageSize));
    if (page <= 1) params.delete("seite"); else params.set("seite", String(page));
    const next = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`);
  }, [category, initialized, maxPrice, minPrice, page, pageSize, query]);

  /** Blättern soll den Anfang des Rasters zeigen. Ohne das steht man nach dem
   *  Klick auf „Weiter" am Fuß der neuen Seite und sieht die letzten Karten. */
  function goToPage(ziel: number) {
    setPage(Math.max(1, ziel));
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <main>
    <SiteHeader active="/karten" />

    <section className="page-intro">
      <p className="eyebrow">{t("DER BESTAND")}</p>
      <h1>{t("Alle Karten.")}</h1>
      <p>{t("Unser gesamter Bestand. Jede Karte einzeln geprüft, beschrieben und sicher verpackt.")}</p>
      {/* Hier entscheidet sich der Blick: Wer im Raster steht, hat den
          Verhandlungsabschnitt der Startseite womöglich nie gesehen. */}
      <p>
        <strong>{t("Bei jeder Karte kannst du verhandeln.")}</strong> {t("Öffne die Karte und nenne uns deinen Preis. Du hast drei Versuche pro Karte. Ein angenommener Preis gilt 48 Stunden.")}
      </p>
    </section>

    <section className="shop-section" id="shop">
      <div className="shop-toolbar catalog-toolbar">
        <label className="page-size" htmlFor="page-size">
          {t("Karten je Seite")}
          <select
            id="page-size"
            value={pageSize}
            onChange={(event) => { setPageSize(toPageSize(event.target.value)); setPage(1); }}
          >
            {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <label className="search-field" htmlFor="search">
          <span aria-hidden="true">⌕</span>
          <input id="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("Spieler, Set oder Kartennummer")} aria-label={t("Karten durchsuchen")} />
        </label>
        <label className="catalog-select" htmlFor="catalog-category">
          <span>{t("Kategorie")}</span>
          <select id="catalog-category" value={category} onChange={(event) => { setCategory(event.target.value as CatalogCategory); setPage(1); }}>
            <option value="">{t("Alle Kategorien")}</option>
            <option value="fixed">{t("Festpreis")}</option>
            <option value="manual">{t("Vorverkauf")}</option>
            <option value="prelisted">{t("Vormerkliste")}</option>
          </select>
        </label>
        <label className="catalog-price" htmlFor="catalog-min-price">
          <span>{t("Preis ab")}</span>
          <input id="catalog-min-price" value={minPrice} onChange={(event) => { setMinPrice(event.target.value); setPage(1); }} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0,00" />
        </label>
        <label className="catalog-price" htmlFor="catalog-max-price">
          <span>{t("Preis bis")}</span>
          <input id="catalog-max-price" value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); setPage(1); }} inputMode="decimal" type="number" min="0" step="0.01" placeholder="∞" />
        </label>
      </div>

      {status === "loading" && <div className="empty-state">{t("Karten werden geladen …")}</div>}
      {status === "error" && <div className="empty-state">{t("Die Karten konnten gerade nicht geladen werden. Bitte lade die Seite neu.")}</div>}

      {status === "ready" && <>
        <p className="result-count" role="status">
          {t("Karte {{first}} bis {{last}} von {{total}}", { first: pageInfo.first, last: pageInfo.last, total: pageInfo.total })}
        </p>
        <div className="product-grid">
          {catalog.map((product) => (
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
                <span className="product-badge">{t(badge(product.category))}</span>
              </div>
              <div className="product-info">
                {/* Nur zeichnen, wenn es etwas zu sagen gibt — ein leerer
                    Absatz hinterließe seinen Abstand und risse ein Loch. */}
                {meta(product.category) && <p className="product-meta">{t(meta(product.category) ?? "")}</p>}
                <h2><Link href={`/karten/${product.id}`}>{product.title}</Link></h2>
                {product.description && <p className="product-description">{product.description}</p>}
                <div className="product-footer">
                  {formatPrice(product.priceAmountCents, product.priceCurrency, locale)
                    ? <strong>{formatPrice(product.priceAmountCents, product.priceCurrency, locale)}</strong>
                    : <strong className="interest-price">{t(product.category === "Direkt bei uns" ? "Preis auf Anfrage" : "Interesse bekunden")}</strong>}
                  {product.category === "Vormerkliste"
                    ? <button className="product-cta" type="button" onClick={() => { interest.setFeedback(null); setSelected(product); }}>{t("Vormerken")} <span>→</span></button>
                    : product.category === "Direkt bei uns"
                      ? <Link className="product-cta" href={`/karten/${product.id}`}>{t("Preis vorschlagen")} <span>→</span></Link>
                    : (() => {
                          const state = cartButtonState(product.quantity, cart[product.id] ?? 0);
                          return <button
                            className={state.action === "remove" ? "product-cta entfernen" : "product-cta"}
                            type="button"
                            disabled={state.disabled}
                            onClick={() => state.action === "remove" ? removeFromCart(product.id) : addToCart(product.id, product.quantity)}
                            title={state.label}
                          >{t(state.label)}{state.action && <span>{state.action === "remove" ? "×" : "+"}</span>}</button>;
                        })()}
                </div>
              </div>
            </article>
          ))}
        </div>
        {catalog.length === 0 && <div className="empty-state">{t("Keine Karten für diese Suche gefunden.")}</div>}

        {pageInfo.totalPages > 1 && <nav className="pager" aria-label={t("Seiten")}>
          <button type="button" className="pager-step" onClick={() => goToPage(page - 1)} disabled={page <= 1}>← {t("Zurück")}</button>
          <div className="pager-pages">
            {pageNumbers(page, pageInfo.totalPages).map((nummer, index) => nummer === null
              ? <span key={`luecke-${index}`} className="pager-gap" aria-hidden="true">…</span>
              : <button
                  key={nummer}
                  type="button"
                  className={nummer === page ? "pager-page aktiv" : "pager-page"}
                  onClick={() => goToPage(nummer)}
                  aria-label={t("Seite {{number}}", { number: nummer })}
                  aria-current={nummer === page ? "page" : undefined}
                >{nummer}</button>)}
          </div>
          <button type="button" className="pager-step" onClick={() => goToPage(page + 1)} disabled={page >= pageInfo.totalPages}>{t("Weiter")} →</button>
        </nav>}
      </>}

      <div className="center-action">
        <a className="button button-outline" href={EBAY_SHOP_URL} target="_blank" rel="noreferrer">{t("Alle eBay-Angebote ansehen")} <span>↗</span></a>
      </div>
    </section>

    {selected && <section className="form-section compact-form" aria-labelledby="interest-title">
      <div className="form-heading">
        <p className="eyebrow">{t("VORMERKEN")}</p>
        <h2 id="interest-title">{selected.title}</h2>
        <p>{t("Hinterlasse deine E-Mail-Adresse. Wir melden uns, sobald die Karte in den Verkauf geht.")}</p>
      </div>
      <form onSubmit={(event) => interest.run(event, async (form) => postJson("/api/prelisted-interest", {
        ...botGuardPayload(form),
        productId: selected.id,
        email: new FormData(form).get("email"),
      }, t("Danke! Deine Vormerkung ist bei uns eingegangen. Wir melden uns, sobald die Karte verfügbar ist."), t("Die Anfrage konnte nicht gesendet werden.")))}>
        <BotGuardFields />
        <Field label={t("E-Mail-Adresse")} name="email" type="email" />
        <PrivacyNotice />
        <div className="form-row">
          <button className="button button-primary" type="submit" disabled={interest.pending}>{interest.pending ? t("Wird gesendet …") : t("Vormerkung senden")}</button>
          <button className="text-link" type="button" onClick={() => setSelected(null)}>{t("Abbrechen")}</button>
        </div>
        <FormFeedback feedback={interest.feedback} />
      </form>
    </section>}

    <section className="cta-strip">
      <p>{t("Nicht gefunden, wonach du suchst?")}</p>
      <Link className="button button-primary" href="/anfragen">{t("Karte anfragen")} <span>↘</span></Link>
    </section>

    <SiteFooter />
  </main>;
}
