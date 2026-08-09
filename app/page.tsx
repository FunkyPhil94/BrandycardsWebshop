"use client";

import Link from "next/link";
import { Gallery } from "./gallery";
import { useI18n } from "./i18n";
import { SiteFooter, SiteHeader } from "./site-chrome";

const DESTINATIONS = [
  {
    href: "/karten",
    eyebrow: "DER BESTAND",
    title: "Alle Karten",
    // Kein „Auktion" mehr: Auktionen erscheinen seit dem 2026-08-08 nicht mehr
    // im Shop, weil sich ihre Menge bei eBay nicht zurücknehmen lässt. Der
    // Satz wäre sonst ein Versprechen, das der Katalog nicht einlöst.
    text: "Der komplette Bestand mit Suche und Filter. Zum Festpreis kaufen oder deinen Preis vorschlagen.",
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
  const { t } = useI18n();
  return <main>
    <SiteHeader />

    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">{t("THE HOME OF SPORTS CARDS")}</p>
        <h1>{t("Cards with")}<br /><em>{t("character.")}</em></h1>
        <p className="hero-text">{t("Ausgewählte Sportkarten für Sammler und Liebhaber, sicher verpackt und mit Liebe zum Detail.")}</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/karten">{t("Kollektion entdecken")} <span>↘</span></Link>
          <Link className="text-link" href="/ueber-uns">{t("Mehr über BrandyCards")} <span>→</span></Link>
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

    <section className="ticker" aria-label={t("BrandyCards Werte")}>
      <span>AUTHENTIC CARDS</span><i>✦</i><span>FAIR PRICES</span><i>✦</i><span>FAST SHIPPING</span><i>✦</i><span>MADE FOR COLLECTORS</span>
    </section>

    <Gallery />

    {/* Der Grund, hier zu kaufen statt auf eBay — und bis heute stand er
        nirgends. Das Formular auf der Detailseite findet nur, wer schon dort
        ist. Die Regeln stehen bewusst dabei: Sie kommen aus
        lib/price-offers.ts, und ein Versprechen, das der Shop nicht einlöst,
        wäre schlimmer als gar keine Werbung. */}
    <section className="split-section" aria-labelledby="verhandeln-title">
      <div className="split-copy">
        <p className="eyebrow">{t("JEDER PREIS IST EIN ANFANG")}</p>
        <h2 id="verhandeln-title">{t("Mach uns ein Angebot.")}</h2>
        <p>{t("Du kannst jede Karte zum angegebenen Preis kaufen — oder uns sagen, was sie dir wert ist. Wir sind zwei Brüder mit einer Sammelleidenschaft, keine Preisautomatik. Wenn dein Vorschlag passt, nehmen wir ihn an, und der Betrag wird im Checkout automatisch verrechnet.")}</p>
        <p>{t("Drei Vorschläge je Karte, mindestens 50 Cent unter dem Preis, ein angenommener Preis gilt 48 Stunden. Mehr Regeln gibt es nicht — nur ein Kundenkonto, damit wir wissen, für wen der Preis gilt.")}</p>
        <Link className="text-link" href="/karten">{t("Karten ansehen und vorschlagen")} <span>→</span></Link>
      </div>
      <div className="split-panel" aria-hidden="true">
        <div className="panel-card">
          <span>{t("Dein")}<br />{t("Preis")}</span>
          <b>?</b>
        </div>
        <p className="panel-note">{t("DREI VERSUCHE")}<br /><strong>{t("48 STUNDEN GÜLTIG")}</strong></p>
      </div>
    </section>

    <section className="destinations" aria-label={t("Bereiche des Shops")}>
      {DESTINATIONS.map((entry) => (
        <Link className="destination-card" key={entry.href} href={entry.href}>
          <p className="eyebrow">{t(entry.eyebrow)}</p>
          <h2>{t(entry.title)}</h2>
          <p className="destination-text">{t(entry.text)}</p>
          <span className="text-link">{t(entry.cta)} <span>→</span></span>
        </Link>
      ))}
    </section>

    <SiteFooter />
  </main>;
}
