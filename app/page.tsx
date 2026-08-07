import Link from "next/link";
import { Gallery } from "./gallery";
import { SiteFooter, SiteHeader } from "./site-chrome";

const DESTINATIONS = [
  {
    href: "/karten",
    eyebrow: "DER BESTAND",
    title: "Alle Karten",
    text: "Der komplette Bestand mit Suche und Filter — Festpreis, Auktion und Vormerkliste.",
    cta: "Zum Kartenbestand",
  },
  {
    href: "/anfragen",
    eyebrow: "DU SUCHST ETWAS BESTIMMTES?",
    title: "Karte anfragen",
    text: "Nicht gefunden, wonach du suchst? Schreib uns — auch ohne Kundenkonto.",
    cta: "Anfrage stellen",
  },
  {
    href: "/verkaufen",
    eyebrow: "DEINE KARTEN. DEINE CHANCE.",
    title: "An uns verkaufen",
    text: "Karten anbieten oder einen Preisvorschlag machen. Bilder direkt mitschicken.",
    cta: "Karten anbieten",
  },
  {
    href: "/ueber-uns",
    eyebrow: "FROM LEVERKUSEN, WITH PASSION",
    title: "Über BrandyCards",
    text: "Zwei Brüder, eine Sammlung und ziemlich viel Liebe zum Detail.",
    cta: "Mehr erfahren",
  },
];

export default function Home() {
  return <main>
    <SiteHeader />

    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">THE HOME OF SPORTS CARDS</p>
        <h1>Cards with<br /><em>character.</em></h1>
        <p className="hero-text">Ausgewählte Fußballkarten für Sammler und Liebhaber, sicher verpackt und mit Liebe zum Detail.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/karten">Kollektion entdecken <span>↘</span></Link>
          <Link className="text-link" href="/ueber-uns">Mehr über BrandyCards <span>→</span></Link>
        </div>
      </div>
      <div className="hero-art" aria-label="Abstrakte Darstellung einer Premium-Sammelkarte">
        <div className="hero-card hero-card-back"><span>BRANDY<br />CARDS</span></div>
        <div className="hero-card hero-card-front">
          <div className="hero-card-top">BRANDYCARDS <span>01 / 01</span></div>
          <div className="hero-player">BC</div>
          <div className="hero-card-bottom"><strong>THE<br />COLLECTOR&apos;S<br />CHOICE</strong><span>LEVERKUSEN<br />GERMANY</span></div>
        </div>
        <span className="hero-stamp">EST.<br /><strong>2026</strong></span>
      </div>
    </section>

    <section className="ticker" aria-label="BrandyCards Werte">
      <span>AUTHENTIC CARDS</span><i>✦</i><span>FAIR PRICES</span><i>✦</i><span>FAST SHIPPING</span><i>✦</i><span>MADE FOR COLLECTORS</span>
    </section>

    <Gallery />

    <section className="destinations" aria-label="Bereiche des Shops">
      {DESTINATIONS.map((entry) => (
        <Link className="destination-card" key={entry.href} href={entry.href}>
          <p className="eyebrow">{entry.eyebrow}</p>
          <h2>{entry.title}</h2>
          <p className="destination-text">{entry.text}</p>
          <span className="text-link">{entry.cta} <span>→</span></span>
        </Link>
      ))}
    </section>

    <SiteFooter />
  </main>;
}
