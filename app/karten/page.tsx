"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cartButtonState } from "../../lib/cart.ts";
import { ebayImageVariant } from "../../lib/ebay-images.ts";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, PageSize, clampPage, pageNumbers, pageSlice, toPageSize } from "../../lib/pagination.ts";
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
  const [selected, setSelected] = useState<Product | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const { cart, addToCart, removeFromCart } = useCart();
  const interest = useFormSubmit();
  const { t, locale } = useI18n();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((data: { products?: Product[] }) => {
        if (cancelled) return;
        setCatalog(data.products ?? []);
        // Seitengröße und Seitenzahl stehen in der URL. Gelesen wird sie erst
        // hier, wenn der Bestand da ist: `window` gibt es beim Rendern auf dem
        // Server nicht, und vor dem ersten Treffer gäbe es ohnehin nichts zu
        // blättern. Beides in einem Zug gesetzt, damit kein Zwischenzustand
        // mit falscher Seite sichtbar wird.
        const params = new URLSearchParams(window.location.search);
        setPageSize(toPageSize(params.get("pro")));
        setPage(clampPage(params.get("seite"), (data.products ?? []).length, toPageSize(params.get("pro"))));
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter((product) => !needle || product.title.toLowerCase().includes(needle));
  }, [catalog, query]);

  const view = useMemo(() => pageSlice(filtered, page, pageSize), [filtered, page, pageSize]);

  // Beachte: Angezeigt wird durchgehend `view.page`, nicht `page`. Schrumpft
  // die Trefferliste, klemmt `pageSlice` die Seite selbst auf einen gültigen
  // Wert; `page` darf dabei stehen bleiben. Das ist nicht nur bequemer als ein
  // Zurückschreiben im Effekt (das erzeugt eine zweite Renderrunde), es ist
  // auch das freundlichere Verhalten: Wer eine Suche wieder löscht, landet auf
  // der Seite, auf der er vorher war.

  // Zurück in die URL, damit ein Sprung in eine Karte und zurück nicht auf
  // Seite 1 landet. `replaceState`, nicht `pushState`: Sonst müsste man sich
  // durch jede besuchte Seite zurückklicken, um wieder aus dem Bestand
  // herauszukommen.
  useEffect(() => {
    if (status !== "ready") return;
    const params = new URLSearchParams(window.location.search);
    if (pageSize === DEFAULT_PAGE_SIZE) params.delete("pro"); else params.set("pro", String(pageSize));
    if (view.page <= 1) params.delete("seite"); else params.set("seite", String(view.page));
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [status, pageSize, view.page]);

  /** Blättern soll den Anfang des Rasters zeigen. Ohne das steht man nach dem
   *  Klick auf „Weiter" am Fuß der neuen Seite und sieht die letzten Karten. */
  function goToPage(ziel: number) {
    setPage(clampPage(ziel, filtered.length, pageSize));
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
        <strong>{t("Bei jeder Karte kannst du verhandeln.")}</strong> {t("Öffne sie und schlag uns deinen Preis vor — drei Versuche je Karte, ein angenommener Preis gilt 48 Stunden.")}
      </p>
    </section>

    <section className="shop-section" id="shop">
      <div className="shop-toolbar">
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
          {/* Jede Sucheingabe setzt auf Seite 1 zurück — sonst sucht man von
              Seite 7 aus und bekommt eine leere Ansicht zu sehen. */}
          <input id="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("Spieler, Set oder Kartennummer")} aria-label={t("Karten durchsuchen")} />
        </label>
      </div>

      {status === "loading" && <div className="empty-state">{t("Karten werden geladen …")}</div>}
      {status === "error" && <div className="empty-state">{t("Die Karten konnten gerade nicht geladen werden. Bitte lade die Seite neu.")}</div>}

      {status === "ready" && <>
        <p className="result-count" role="status">
          {view.total === catalog.length
            ? <>{t("Karte {{first}}–{{last}} von {{total}}", { first: view.first, last: view.last, total: view.total })}</>
            : <>{t("Karte {{first}}–{{last}} von {{total}} Treffern · {{count}} Karten im Bestand", { first: view.first, last: view.last, total: view.total, count: catalog.length })}</>}
        </p>
        <div className="product-grid">
          {view.items.map((product) => (
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
                    : <strong className="interest-price">{t("Interesse bekunden")}</strong>}
                  {product.category === "Vormerkliste"
                    ? <button className="product-cta" type="button" onClick={() => { interest.setFeedback(null); setSelected(product); }}>{t("Vormerken")} <span>→</span></button>
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
        {filtered.length === 0 && <div className="empty-state">{t("Keine Karten für diese Suche gefunden.")}</div>}

        {view.pages > 1 && <nav className="pager" aria-label={t("Seiten")}>
          <button type="button" className="pager-step" onClick={() => goToPage(view.page - 1)} disabled={view.page <= 1}>← {t("Zurück")}</button>
          <div className="pager-pages">
            {pageNumbers(view.page, view.pages).map((nummer, index) => nummer === null
              ? <span key={`luecke-${index}`} className="pager-gap" aria-hidden="true">…</span>
              : <button
                  key={nummer}
                  type="button"
                  className={nummer === view.page ? "pager-page aktiv" : "pager-page"}
                  onClick={() => goToPage(nummer)}
                  aria-label={t("Seite {{number}}", { number: nummer })}
                  aria-current={nummer === view.page ? "page" : undefined}
                >{nummer}</button>)}
          </div>
          <button type="button" className="pager-step" onClick={() => goToPage(view.page + 1)} disabled={view.page >= view.pages}>{t("Weiter")} →</button>
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
