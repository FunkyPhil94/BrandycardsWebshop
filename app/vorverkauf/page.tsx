"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { pageNumbers } from "../../lib/pagination.ts";

type Product = {
  id: string;
  title: string;
  description: string | null;
  origin?: string;
  priceAmountCents: number | null;
  priceCurrency: string;
  quantity: number;
  imageUrls: string[];
};

type Facette = { name: string; anzahl: number };
/** Merkmal quer zu den Sets. `wert` ist der reservierte Filterwert, `name` die
 *  Beschriftung — beides getrennt, weil der Wert nie übersetzt werden darf. */
type Merkmal = { wert: string; name: string; anzahl: number };

type Antwort = {
  products?: Product[];
  total?: number;
  totalPages?: number;
  page?: number;
  facetten?: { serien: Facette[]; varianten: Facette[]; merkmale: Merkmal[] };
};

/** Wie viele Karten auf eine Seite gehen.
 *
 *  100 ist die größte Größe, die `lib/pagination.ts` zulässt, und sie ist hier
 *  Absicht: Der Vorverkauf ist ein überschaubarer, kuratierter Ausschnitt — man
 *  soll ihn überblicken, nicht durchblättern. **Eine Blätterleiste braucht es
 *  trotzdem:** Am 2026-08-18 kamen 144 Karten auf einmal herein, und die Seite
 *  holte weiterhin nur die ersten 100. Die übrigen 44 waren im Shop
 *  vorhanden, bezahlbar, verlinkt — und auf keiner Seite zu sehen. */
const PRO_SEITE = 100;

/** Der Vorverkauf: Karten, die es hier gibt, aber (noch) nicht bei eBay.
 *
 * **Warum eine eigene Seite und kein Filter auf `/karten`:** Entscheidung des
 * Betreibers vom 2026-08-08. Diese Karten sind sein Argument gegen den Umweg
 * über eBay — im normalen Bestand gingen sie zwischen 294 anderen unter.
 * Seit dem 2026-08-18 erscheinen sie im Katalog gar nicht mehr.
 *
 * Die Liste kommt aus demselben `/api/products` wie der Katalog und wird hier
 * über `origin` gefiltert. Eine eigene Route wäre eine zweite Stelle, an der
 * dieselben Sichtbarkeitsregeln stehen — und die zweite Stelle ist die, die
 * beim nächsten Umbau vergessen wird. **Das gilt auch für die Suche:** Sie
 * läuft über dasselbe `q` wie im Katalog, serverseitig, statt hier im Browser
 * eine zweite Suchlogik über die geladene Seite zu legen.
 */
export default function VorverkaufPage() {
  const [cards, setCards] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [suche, setSuche] = useState("");
  const [serie, setSerie] = useState("");
  const [variante, setVariante] = useState("");
  const [facetten, setFacetten] = useState<{ serien: Facette[]; varianten: Facette[]; merkmale: Merkmal[] }>(
    { serien: [], varianten: [], merkmale: [] });
  const [seite, setSeite] = useState(1);
  const [seitenInfo, setSeitenInfo] = useState({ total: 0, totalPages: 1 });
  const [bereit, setBereit] = useState(false);
  const { t } = useI18n();

  // Suchbegriff und Seite aus der Adresse übernehmen, damit ein geteilter Link
  // dieselbe Ansicht öffnet.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setSuche(params.get("q") ?? "");
      setSerie(params.get("set") ?? "");
      setVariante(params.get("variante") ?? "");
      const gewuenscht = Number(params.get("seite"));
      setSeite(Number.isInteger(gewuenscht) && gewuenscht > 0 ? gewuenscht : 1);
      setBereit(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!bereit) return;
    const controller = new AbortController();
    // Entprellt wie im Katalog: eine Anfrage je Tastendruck wäre bei 144 Karten
    // nicht falsch, aber unnötig.
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ origin: "MANUAL", pro: String(PRO_SEITE), seite: String(seite), facetten: "1" });
      if (suche.trim()) params.set("q", suche.trim());
      if (serie) params.set("serie", serie);
      if (variante) params.set("variante", variante);
      setStatus("loading");
      fetch(`/api/products?${params}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
        .then((daten: Antwort) => {
          // Weiterhin eine Positivliste, obwohl die API bereits auf MANUAL
          // einschränkt. Hier darf nie eine eBay-Karte erscheinen, falls diese
          // Einschränkung je aufweicht.
          setCards((daten.products ?? []).filter((product) => product.origin === "MANUAL"));
          setSeitenInfo({ total: daten.total ?? 0, totalPages: daten.totalPages ?? 1 });
          if (daten.facetten) setFacetten(daten.facetten);
          if (daten.page && daten.page !== seite) setSeite(daten.page);
          setStatus("ready");
        })
        .catch((fehler: unknown) => {
          if (fehler instanceof DOMException && fehler.name === "AbortError") return;
          setStatus("error");
        });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [bereit, seite, serie, suche, variante]);

  // Ohne neuen Verlaufseintrag je Tastendruck — sonst führt der Zurück-Knopf
  // durch jeden einzelnen Buchstaben.
  useEffect(() => {
    if (!bereit) return;
    const params = new URLSearchParams(window.location.search);
    if (suche.trim()) params.set("q", suche.trim()); else params.delete("q");
    if (serie) params.set("set", serie); else params.delete("set");
    if (variante) params.set("variante", variante); else params.delete("variante");
    if (seite <= 1) params.delete("seite"); else params.set("seite", String(seite));
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
  }, [bereit, seite, serie, suche, variante]);

  function zuSeite(ziel: number) {
    setSeite(Math.max(1, ziel));
    document.getElementById("vorverkauf")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const gesucht = suche.trim().length > 0 || serie !== "" || variante !== "";

  function alleZeigen() {
    setSuche("");
    setSerie("");
    setVariante("");
    setSeite(1);
  }

  return (
    <main>
      <SiteHeader active="/vorverkauf" />
      <section className="shop-section" id="vorverkauf">
        <div className="section-heading">
          <h2>{t("Vorverkauf.")}</h2>
          <p>{t("Karten, die du hier bekommst, bevor sie bei eBay stehen.")}</p>
        </div>

        <div className="shop-toolbar vorverkauf-toolbar">
          <label className="search-field" htmlFor="vorverkauf-suche">
            <span aria-hidden="true">⌕</span>
            <input
              id="vorverkauf-suche"
              value={suche}
              onChange={(ereignis) => { setSuche(ereignis.target.value); setSeite(1); }}
              placeholder={t("Spieler, Set oder Kartennummer")}
              aria-label={t("Vorverkauf durchsuchen")}
            />
          </label>
          {/* Set und Variante als zwei Auswahlfelder. **Ein Wechsel des Sets
              setzt die Variante zurück** — „Nitro Boost" aus dem einen Set gibt
              es im anderen womöglich gar nicht, und die Auswahl stünde dann auf
              einem Wert, zu dem es keine Karte gibt. */}
          {(facetten.serien.length > 1 || facetten.merkmale.length > 0)
            && <label className="catalog-select" htmlFor="vorverkauf-set">
            <span>{t("Set")}</span>
            <select id="vorverkauf-set" value={serie}
              onChange={(ereignis) => { setSerie(ereignis.target.value); setVariante(""); setSeite(1); }}>
              <option value="">{t("Alle Sets")}</option>
              {facetten.serien.map((eintrag) => <option key={eintrag.name} value={eintrag.name}>
                {eintrag.name} ({eintrag.anzahl})
              </option>)}
              {/* Eigene Gruppe: „Numbered" und „Autograph" sind keine Sets,
                  sondern Eigenschaften quer dazu. In einer Liste mit den Sets
                  ohne Trennung sähen sie aus wie zwei weitere Serien. */}
              {facetten.merkmale.length > 0 && <optgroup label={t("Merkmal")}>
                {facetten.merkmale.map((eintrag) => <option key={eintrag.wert} value={eintrag.wert}>
                  {eintrag.name} ({eintrag.anzahl})
                </option>)}
              </optgroup>}
            </select>
          </label>}

          {facetten.varianten.length > 1 && <label className="catalog-select" htmlFor="vorverkauf-variante">
            <span>{t("Variante")}</span>
            <select id="vorverkauf-variante" value={variante}
              onChange={(ereignis) => { setVariante(ereignis.target.value); setSeite(1); }}>
              <option value="">{t("Alle Varianten")}</option>
              {facetten.varianten.map((eintrag) => <option key={eintrag.name} value={eintrag.name}>
                {eintrag.name} ({eintrag.anzahl})
              </option>)}
            </select>
          </label>}

          {status === "ready" && seitenInfo.total > 0 && <p className="shop-toolbar-count">
            {gesucht
              ? t("{{count}} Treffer", { count: seitenInfo.total })
              : t("{{count}} Karten im Vorverkauf", { count: seitenInfo.total })}
          </p>}
        </div>

        {status === "loading" && <p className="empty-state">{t("Lade …")}</p>}
        {status === "error" && <p className="empty-state">{t("Die Karten konnten gerade nicht geladen werden. Bitte lade die Seite neu.")}</p>}

        {/* Zwei verschiedene Leerzustände, und der Unterschied ist der Punkt:
            „nichts gefunden" ist eine Auskunft über die Suche, „gerade nichts
            im Vorverkauf" eine über den Shop. Wer beides zusammenwirft, lässt
            den Besucher glauben, es gebe hier nie etwas. */}
        {status === "ready" && cards.length === 0 && gesucht && <div className="empty-state">
          <p><strong>{t("Keine Karte passt zu dieser Auswahl.")}</strong></p>
          <p><button type="button" className="text-link text-link-inline" onClick={alleZeigen}>
            {t("Alle Karten zeigen")}
          </button></p>
        </div>}

        {status === "ready" && cards.length === 0 && !gesucht && <div className="empty-state">
          <p><strong>{t("Gerade ist nichts im Vorverkauf.")}</strong></p>
          <p>{t("Hier bieten wir Karten direkt an, bevor sie in unseren eBay-Shop wechseln. Schau später wieder vorbei oder stöbere im gesamten Bestand.")}</p>
          <p><Link className="text-link text-link-inline" href="/karten">{t("Gesamten Bestand ansehen")} <span>→</span></Link></p>
        </div>}

        {status === "ready" && cards.length > 0 && <div className="product-grid">
          {cards.map((card) => {
            return <article className="product-card" key={card.id}>
              <div className="product-image">
                <Link href={`/karten/${card.id}`} className="product-image-link" aria-label={card.title}>
                  {card.imageUrls?.[0]
                    /* Dieselbe Behandlung wie im Katalog: das Bild klein
                     * ausliefern und verzögert laden. Manuelle Karten tragen
                     * keine eBay-URL, deshalb ohne `ebayImageVariant`. */
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img className="card-art product-photo" src={card.imageUrls[0]} alt={card.title} loading="lazy" decoding="async" width={450} height={800} />
                    : <div className="card-art card-art-gold" aria-hidden="true"><span className="art-mark">BC</span></div>}
                </Link>
                <span className="product-badge">{t("Vorverkauf")}</span>
              </div>
              <div className="product-info">
                <p className="product-meta">{t("Direkt bei uns")}</p>
                <h3><Link href={`/karten/${card.id}`}>{card.title}</Link></h3>
                {card.description && <p className="product-description">{card.description}</p>}
                <div className="product-footer">
                  <strong>{t("Preis auf Anfrage")}</strong>
                  <Link className="product-cta" href={`/karten/${card.id}`}>{t("Preis vorschlagen")} <span>→</span></Link>
                </div>
              </div>
            </article>;
          })}
        </div>}

        {status === "ready" && seitenInfo.totalPages > 1 && <nav className="pager" aria-label={t("Seiten")}>
          <button type="button" className="pager-step" onClick={() => zuSeite(seite - 1)} disabled={seite <= 1}>← {t("Zurück")}</button>
          <div className="pager-pages">
            {pageNumbers(seite, seitenInfo.totalPages).map((nummer, index) => nummer === null
              ? <span key={`luecke-${index}`} className="pager-gap" aria-hidden="true">…</span>
              : <button
                  key={nummer}
                  type="button"
                  className={nummer === seite ? "pager-page aktiv" : "pager-page"}
                  onClick={() => zuSeite(nummer)}
                  aria-label={t("Seite {{number}}", { number: nummer })}
                  aria-current={nummer === seite ? "page" : undefined}
                >{nummer}</button>)}
          </div>
          <button type="button" className="pager-step" onClick={() => zuSeite(seite + 1)} disabled={seite >= seitenInfo.totalPages}>{t("Weiter")} →</button>
        </nav>}
      </section>
      <SiteFooter />
    </main>
  );
}
