import Link from "next/link";
import { Gallery } from "./gallery";
import { SiteFooter, SiteHeader } from "./site-chrome";

const DESTINATIONS = [
  {
    href: "/karten",
    eyebrow: "DER BESTAND",
    title: "Alle Karten",
    text: "Der komplette Bestand mit Suche und Filter. Festpreis, Auktion und Vormerkliste.",
    cta: "Zum Kartenbestand",
  },
  {
    href: "/anfragen",
    eyebrow: "DU SUCHST ETWAS BESTIMMTES?",
    title: "Karte anfragen",
    text: "Nicht gefunden, wonach du suchst? Schreib uns, auch ohne Kundenkonto.",
    cta: "Anfrage stellen",
  },
  {
    href: "/verkaufen",
    eyebrow: "DEINE KARTEN. DEINE CHANCE.",
    title: "An uns verkaufen",
    // „Preisvorschlag" ist im Shop die Verhandlung auf der Käuferseite
    // (lib/price-offers.ts). Hier bietet der Kunde uns seine Karten an und
    // nennt seinen Preis. /verkaufen sagt dazu bereits „Preisvorstellung"
    // und „Wunschpreis". Die Kachel ist jetzt an ihr Ziel angeglichen.
    text: "Karten anbieten und deinen Wunschpreis nennen. Bilder kannst du direkt mitschicken.",
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
        <p className="hero-text">Ausgewählte Sportkarten für Sammler und Liebhaber, sicher verpackt und mit Liebe zum Detail.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/karten">Kollektion entdecken <span>↘</span></Link>
          <Link className="text-link" href="/ueber-uns">Mehr über BrandyCards <span>→</span></Link>
        </div>
      </div>
      {/* Zierrat, kein Inhalt: Die „Karte" ist aus CSS gezeichnet, ihre
          Beschriftungen wiederholen nur, was daneben im Text steht.
          `aria-hidden`, weil Vorleseprogramme sonst „BRANDYCARDS 01 / 01 BC
          THE COLLECTOR'S CHOICE …" mitlesen — das vorherige `aria-label` an
          einem `div` ohne Rolle war wirkungslos. Nicht markierbar, damit sie
          sich beim Ziehen über die Seite wie ein Bild verhält und nicht in
          eine Ansammlung blauer Kästen zerfällt. */}
      <div className="hero-art" aria-hidden="true">
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
