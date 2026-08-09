"use client";

import Link from "next/link";
import logo from "../brand/brandycards-logo.png";
import { EBAY_SHOP_URL, SiteFooter, SiteHeader } from "../site-chrome";
import { useI18n } from "../i18n";

export default function UeberUnsPage() {
  const { t } = useI18n();
  return <main>
    <SiteHeader active="/ueber-uns" />

    <section className="page-intro">
      <p className="eyebrow">{t("FROM LEVERKUSEN, WITH PASSION")}</p>
      <h1>{t("Für Karten, die")}<br /><em>{t("mehr erzählen.")}</em></h1>
      <p>{t("BrandyCards ist ein Familienprojekt von zwei Brüdern. Wir sammeln, handeln und teilen die Begeisterung für Sportkarten. Ehrlich, persönlich und mit einem Auge fürs Detail.")}</p>
    </section>

    <section className="about-columns">
      <article>
        <h2>{t("Wie alles anfing")}</h2>
        <p>{t("Angefangen hat es mit Päckchen auf dem Küchentisch und der Frage, wer die bessere Karte gezogen hat. Aus der Sammelleidenschaft wurde mit der Zeit ein Bestand, der zu groß für zwei Ordner war. Daraus wurde BrandyCards.")}</p>
      </article>
      <article>
        <h2>{t("Wie wir arbeiten")}</h2>
        <p>{t("Jede Karte geht durch unsere Hände, bevor sie in den Shop kommt. Zustand beschreiben wir so, wie wir ihn selbst beschrieben haben wollen. Verpackt wird stets bruch- und feuchtigkeitssicher.")}</p>
      </article>
      <article>
        <h2>{t("Warum auch eBay")}</h2>
        <p>{t("Ein Teil unseres Bestands läuft weiter über eBay, weil dort viele Sammler zu Hause sind. Der Shop hier zeigt denselben Bestand. Beides ist synchronisiert, damit dir auch nichts entgeht.")}</p>
      </article>
    </section>

    <section className="about-section">
      <p className="eyebrow">{t("ZWEI BRÜDER, EIN BESTAND")}</p>
      <h2>{t("Fragen gehen direkt")}<br /><em>{t("an uns beide.")}</em></h2>
      <p>{t("Kein Callcenter, kein Ticketsystem. Wer schreibt, bekommt Antwort von Philip oder Sebastian.")}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="about-logo" src={logo.src} width={logo.width} height={logo.height} alt="BrandyCards" />
      <div className="hero-actions center">
        <Link className="button button-primary" href="/anfragen">{t("Karte anfragen")} <span>↘</span></Link>
        <a className="text-link" href={EBAY_SHOP_URL} target="_blank" rel="noreferrer">{t("Unser eBay-Shop")} <span>↗</span></a>
      </div>
    </section>

    <SiteFooter />
  </main>;
}
