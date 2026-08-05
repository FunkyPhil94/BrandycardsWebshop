"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

const EBAY_SHOP_URL = "https://www.ebay.de/str/brandycards";

type Product = {
  id?: string;
  title: string;
  category: "Festpreis" | "Auktion" | "Vormerkliste";
  price?: string;
  meta: string;
  accent: string;
  badge: string;
  description: string;
  productId?: string;
  listingUrl?: string | null;
  imageUrls?: string[];
  quantity?: number;
};

const products: Product[] = [];

type Feedback = { type: "success" | "error"; message: string } | null;

function CardArtwork({ accent, index }: { accent: string; index: number }) {
  return <div className={`card-art card-art-${accent}`} aria-hidden="true"><span className="art-glow" /><span className="art-number">{String(index + 1).padStart(2, "0")}</span><span className="art-mark">BC</span><span className="art-lines" /><span className="art-label">TRADING<br />CARDS</span></div>;
}

function Field({ label, name, type = "text", required = true, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return <label className="form-field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span><input name={name} type={type} required={required} placeholder={placeholder} /></label>;
}

function PrivacyNotice() {
  return <p className="form-feedback">Wir verwenden deine Angaben nur zur Bearbeitung deiner Anfrage. Mehr dazu in unserer <a href="/datenschutz">Datenschutz- und Löschinformation</a>.</p>;
}

async function postForm(path: string, payload: Record<string, unknown>): Promise<string> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error?.message === "string" ? data.error.message : "Die Anfrage konnte nicht gesendet werden.");
  return "Danke! Deine Anfrage ist bei uns eingegangen. Wir melden uns per E-Mail.";
}

async function postMultipart(path: string, form: HTMLFormElement): Promise<string> {
  const response = await fetch(path, { method: "POST", body: new FormData(form) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error?.message === "string" ? data.error.message : "Die Anfrage konnte nicht gesendet werden.");
  return "Danke! Dein Kartenangebot und die Bilder sind sicher bei uns eingegangen.";
}

export default function Home() {
  const [activeFilter, setActiveFilter] = useState("Alle Angebote");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [imageMetadata, setImageMetadata] = useState<Array<{ name: string; mimeType: string; size: number }>>([]);
  const [catalog, setCatalog] = useState<Product[]>(products);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    fetch("/api/products")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Produkte konnten nicht geladen werden.")))
      .then((data: { products?: Array<{ id: string; title: string; description: string | null; category: "Festpreis" | "Auktion" | "Vormerkliste"; priceAmountCents: number | null; priceCurrency: string; quantity: number; listingUrl: string | null; imageUrls: string[] }> }) => setCatalog((data.products ?? []).map((product) => ({
        id: product.id,
        title: product.title,
        category: product.category,
        price: product.priceAmountCents === null ? undefined : new Intl.NumberFormat("de-DE", { style: "currency", currency: product.priceCurrency }).format(product.priceAmountCents / 100),
        meta: product.category === "Auktion" ? "Auktion auf eBay · Kauf direkt bei eBay" : product.category === "Vormerkliste" ? "Noch nicht im Verkauf · Interesse vormerken" : "eBay synchronisiert · Sofort-Kaufen",
        accent: "gold",
        badge: product.category === "Auktion" ? "eBay Auktion" : product.category === "Vormerkliste" ? "Vormerkliste" : "Sofort-Kaufen",
        description: product.description ?? "",
        listingUrl: product.listingUrl,
        imageUrls: product.imageUrls,
        quantity: product.quantity,
      }))))
      .catch(() => setCatalog([]));
  }, []);

  const filteredProducts = useMemo(() => catalog.filter((product) => (activeFilter === "Alle Angebote" || product.category === activeFilter) && product.title.toLowerCase().includes(query.toLowerCase())), [activeFilter, catalog, query]);

  async function submit(path: string, formId: string, event: FormEvent<HTMLFormElement>, payload: Record<string, unknown>) {
    event.preventDefault(); setFeedback((current) => ({ ...current, [formId]: null })); setLoading(formId);
    try { const message = formId === "submission" ? await postMultipart(path, event.currentTarget) : await postForm(path, payload); setFeedback((current) => ({ ...current, [formId]: { type: "success", message } })); event.currentTarget.reset(); if (formId === "submission") setImageMetadata([]); }
    catch (error) { setFeedback((current) => ({ ...current, [formId]: { type: "error", message: error instanceof Error ? error.message : "Es ist ein Fehler aufgetreten." } })); }
    finally { setLoading(null); }
  }

  function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setImageMetadata(files.map((file) => ({ name: file.name, mimeType: file.type, size: file.size })));
  }

  return <main>
    <div className="announcement"><span>✦</span> Versandkostenfrei ab 75 € innerhalb Deutschlands <span>→</span></div>
    <header className="site-header"><a className="brand" href="#top" aria-label="BrandyCards Startseite"><img className="brand-logo" src="/BrandyCards_Logo_transparent.png" alt="BrandyCards" /><span className="sr-only">BrandyCards</span></a><nav className="main-nav" aria-label="Hauptnavigation"><a href="#shop">Shop</a><a href="#coming-soon">Demnächst</a><a href="#about">Über uns</a></nav><div className="header-actions"><button className="icon-button" aria-label="Suche" onClick={() => document.getElementById("search")?.focus()}>⌕</button><a className="account-link" href="/account">Konto <span>↗</span></a><button className="cart-button" aria-label="Warenkorb">Warenkorb <b>{cartCount}</b></button></div></header>
    <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow">THE HOME OF FOOTBALL CARDS</p><h1>Cards with<br /><em>character.</em></h1><p className="hero-text">Ausgewählte Fußballkarten für Sammler. Persönlich ausgesucht, sicher verpackt und mit Liebe zum Detail.</p><div className="hero-actions"><a className="button button-primary" href="#shop">Kollektion entdecken <span>↘</span></a><a className="text-link" href="#about">Mehr über BrandyCards <span>→</span></a></div></div><div className="hero-art" aria-label="Abstrakte Darstellung einer Premium-Sammelkarte"><div className="hero-card hero-card-back"><span>BRANDY<br />CARDS</span></div><div className="hero-card hero-card-front"><div className="hero-card-top">BRANDYCARDS <span>01 / 01</span></div><div className="hero-player">BC</div><div className="hero-card-bottom"><strong>THE<br />COLLECTOR&apos;S<br />CHOICE</strong><span>LEVERKUSEN<br />GERMANY</span></div></div><span className="hero-stamp">EST.<br /><strong>2024</strong></span></div></section>
    <section className="ticker" aria-label="BrandyCards Werte"><span>AUTHENTIC CARDS</span><i>✦</i><span>FAIR PRICES</span><i>✦</i><span>FAST SHIPPING</span><i>✦</i><span>MADE FOR COLLECTORS</span></section>
    <section className="shop-section" id="shop"><div className="section-heading"><div><p className="eyebrow">CURATED FOR YOU</p><h2>Aktuelle Karten</h2></div><p>Aktuelle Festpreisangebote und eBay-Auktionen aus unserem Bestand.</p></div><div className="shop-toolbar"><div className="filter-tabs">{["Alle Angebote", "Festpreis", "Auktion", "Vormerkliste"].map((filter) => <button key={filter} className={activeFilter === filter ? "active" : ""} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</div><label className="search-field" htmlFor="search"><span>⌕</span><input id="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Spieler, Set oder Kartennummer" aria-label="Karten durchsuchen" /></label></div><div className="product-grid">{filteredProducts.map((product, index) => <article className="product-card" key={product.title}><div className="product-image">{product.imageUrls?.[0] ? <img className="card-art product-photo" src={product.imageUrls[0]} alt="" /> : <CardArtwork accent={product.accent} index={index} />}<span className="product-badge">{product.badge}</span><button className="heart" aria-label={`${product.title} merken`}>♡</button></div><div className="product-info"><p className="product-meta">{product.meta}</p><h3>{product.title}</h3><p className="product-description">{product.description}</p><div className="product-footer">{product.price ? <strong>{product.price}</strong> : <strong className="interest-price">Interesse bekunden</strong>}{product.category === "Auktion" ? <a className="product-cta ebay" href={product.listingUrl || EBAY_SHOP_URL} target="_blank" rel="noreferrer">Auf eBay ansehen ↗</a> : product.category === "Vormerkliste" ? <button className="product-cta" onClick={() => setSelectedProduct(product)}>Vormerken <span>→</span></button> : <button className="product-cta" disabled={product.quantity === 0} onClick={() => setCartCount((count) => count + 1)} title={product.quantity === 0 ? "Nicht verfügbar" : "Zum Warenkorb hinzufügen"}>In den Warenkorb <span>+</span></button>}</div></div></article>)}</div>{filteredProducts.length === 0 && <div className="empty-state">Keine Karten für diese Suche gefunden.</div>}<div className="center-action"><a className="button button-outline" href={EBAY_SHOP_URL} target="_blank" rel="noreferrer">Alle eBay-Angebote ansehen <span>↗</span></a></div></section>
    <section className="split-section" id="coming-soon"><div className="split-copy"><p className="eyebrow">NOT ON SALE. YET.</p><h2>Deine Wunschkarte<br /><em>könnte hier sein.</em></h2><p>Manche Karten sind schon in unserer Sammlung, aber noch nicht im Verkauf. Hinterlasse dein Interesse – wir melden uns, sobald sie verfügbar ist.</p><a className="button button-primary" href="#inquiry">Karte anfragen <span>↘</span></a></div><div className="split-panel"><div className="panel-card"><span>COMING<br />SOON</span><b>✦</b></div><div className="panel-note">Nur Titel. Kein Overhead.<br /><strong>Einfach Interesse zeigen.</strong></div></div></section>
    {selectedProduct && <section className="form-section compact-form" aria-labelledby="interest-title"><div className="form-heading"><p className="eyebrow">VORMERKEN</p><h2 id="interest-title">{selectedProduct.title}</h2><p>Die Demo-Karte hat noch keine echte Produkt-ID. Die Vormerkung wird nach dem eBay-Import aktiv.</p></div><form onSubmit={(event) => { event.preventDefault(); setFeedback((current) => ({ ...current, interest: { type: "error", message: "Diese Demo-Karte ist noch nicht mit der Produktdatenbank verbunden." } })); }}><Field label="E-Mail-Adresse" name="email" type="email" /><button className="button button-primary" type="submit">Vormerkung senden</button>{feedback.interest && <p className={`form-feedback ${feedback.interest.type}`} role="status">{feedback.interest.message}</p>}</form></section>}
    <section className="service-section" id="inquiry"><div className="service-card"><span className="service-icon">↗</span><p className="eyebrow">DU SUCHST ETWAS BESTIMMTES?</p><h2>Wir helfen beim Finden.</h2><p>Schreib uns, welche Karte du suchst. Auch ohne Kundenkonto – nur deine E-Mail-Adresse genügt.</p><a href="#contact-form" className="text-link">Karte anfragen <span>→</span></a></div><div className="service-card service-card-dark"><span className="service-icon">＋</span><p className="eyebrow">DEINE KARTEN. DEINE CHANCE.</p><h2>Verkaufe an BrandyCards.</h2><p>Du möchtest deine Karten anbieten? Schick uns Bilder und optional deine Preisvorstellung.</p><a href="#sell" className="text-link">Karten anbieten <span>→</span></a></div></section>
    <section className="forms-section" id="contact-form"><div className="form-card"><p className="eyebrow">KONTAKT</p><h2>Karte anfragen</h2><p>Du suchst eine bestimmte Karte? Sende uns Titel, Nachricht und E-Mail-Adresse.</p><form onSubmit={(event) => { const data = new FormData(event.currentTarget); return submit("/api/inquiries", "inquiry", event, { title: data.get("title"), message: data.get("message"), email: data.get("email") }); }}><Field label="Kartentitel" name="title" placeholder="z. B. 2024 Topps Chrome …" /><label className="form-field"><span>Nachricht *</span><textarea name="message" required maxLength={4000} rows={4} placeholder="Wonach suchst du?" /></label><Field label="E-Mail-Adresse" name="email" type="email" /><PrivacyNotice /><button className="button button-primary" type="submit" disabled={loading === "inquiry"}>{loading === "inquiry" ? "Wird gesendet …" : "Anfrage senden"}</button>{feedback.inquiry && <p className={`form-feedback ${feedback.inquiry.type}`} role="status">{feedback.inquiry.message}</p>}</form></div><div className="form-card" id="sell"><p className="eyebrow">ANKAUF</p><h2>Eigene Karten anbieten</h2><p>Bilder werden sicher in unserem privaten Speicher abgelegt und nur von BrandyCards verwaltet.</p><form onSubmit={(event) => { return submit("/api/card-submissions", "submission", event, {}); }}><Field label="Kartentitel" name="title" /><Field label="Gewünschter Preis in €" name="price" type="number" required={false} placeholder="Optional" /><label className="form-field"><span>Nachricht</span><textarea name="message" maxLength={4000} rows={4} placeholder="Zustand, Anzahl oder weitere Hinweise" /></label><Field label="E-Mail-Adresse" name="email" type="email" /><label className="form-field"><span>Bilder auswählen <small>(JPG, PNG oder WebP, max. 10 MB je Bild)</small></span><input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImages} /><small>{imageMetadata.length ? `${imageMetadata.length} Bild(er) ausgewählt.` : "Noch keine Bilder ausgewählt."}</small></label><PrivacyNotice /><button className="button button-primary" type="submit" disabled={loading === "submission"}>{loading === "submission" ? "Wird gesendet …" : "Karte anbieten"}</button>{feedback.submission && <p className={`form-feedback ${feedback.submission.type}`} role="status">{feedback.submission.message}</p>}</form></div></section>
    <section className="offer-section"><div className="form-card"><p className="eyebrow">PREISVORSCHLAG</p><h2>Interesse an einer Karte?</h2><p>Preisvorschläge werden nach dem eBay-Import für echte Produktkarten freigeschaltet. Demo-Karten können noch nicht verbindlich angeboten werden.</p><form onSubmit={(event) => { event.preventDefault(); setFeedback((current) => ({ ...current, offer: { type: "error", message: "Demo-Karten sind noch nicht mit der Produktdatenbank verbunden." } })); }}><Field label="Kartentitel" name="title" /><Field label="Dein Preis in €" name="price" type="number" /><label className="form-field"><span>Nachricht</span><textarea name="message" rows={3} placeholder="Optional" /></label><Field label="E-Mail-Adresse" name="email" type="email" /><PrivacyNotice /><button className="button button-primary" type="submit">Preisvorschlag senden</button>{feedback.offer && <p className={`form-feedback ${feedback.offer.type}`} role="status">{feedback.offer.message}</p>}</form></div></section>
    <section className="about-section" id="about"><p className="eyebrow">FROM LEVERKUSEN, WITH PASSION</p><h2>Für Karten, die<br /><em>mehr erzählen.</em></h2><p>BrandyCards ist ein Familienprojekt von zwei Brüdern. Wir sammeln, handeln und teilen die Begeisterung für Fußballkarten – ehrlich, persönlich und mit einem Auge fürs Detail.</p><div className="about-signature">B<span>×</span>B <small>BRÜDER · BRANDY · BALL</small></div></section>
    <footer id="contact"><div className="footer-top"><a className="brand" href="#top" aria-label="BrandyCards Startseite"><img className="brand-logo" src="/BrandyCards_Logo_transparent.png" alt="BrandyCards" /></a><p>Collect the moment.</p><div className="footer-links"><a href="/account">Konto ↗</a><a href="#contact-form">Kontakt</a><a href="/datenschutz">Datenschutz</a><a href={EBAY_SHOP_URL} target="_blank" rel="noreferrer">eBay-Shop ↗</a></div></div><div className="footer-bottom"><span>© 2026 BrandyCards · Leverkusen</span><span>Datenschutz &amp; Löschung</span><span>Designed for collectors</span></div></footer>
  </main>;
}
