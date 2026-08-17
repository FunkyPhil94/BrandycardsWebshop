import type { AssistantToolDataMap } from "./contracts.ts";
import { baueTagesreihe, MAX_TAGES_SAEULEN, type Tagesreihe } from "./statistics-series.ts";

/** Erzeugt das eigenständige HTML-Dokument für Statistikantworten.
 *
 * **Serverseitig, und das ist eine Architekturentscheidung.** Phase 4 hat jede
 * Formatierung aus dem Desktop entfernt; ein Test verbietet sie dort. Die Grafik
 * entsteht deshalb hier, deterministisch aus denselben typisierten DTOs, aus
 * denen auch der Antworttext gebaut wird. Der Desktop zeigt nur an.
 *
 * **Gestaltet nach dem `dataviz`-Verfahren**, nicht nach Gefühl. Die Farben sind
 * mit `validate_palette.js` gegen die echten Flächen der App gemessen:
 * `#F1EEE8` hell, `#383838` dunkel, Serien aus den validierten Slots 1 und 2.
 * Alle Prüfungen bestanden — mit einer Auflage: Das Orange liegt hell bei
 * 2,76:1, also unter 3:1. Das verpflichtet zu sichtbaren Labels **und** einer
 * Tabellenansicht; beide sind unten deshalb Pflicht, nicht Zierde.
 *
 * **Keine zwei y-Achsen.** Umsatz und Stückzahl sind zwei Skalen und werden
 * umgeschaltet, nicht übereinandergelegt — die willkürliche Ausrichtung zweier
 * Achsen erfindet eine Korrelation, die in den Daten nicht steht.
 */

/** Was das Dokument braucht. Beide Teile sind optional: Wer nur nach der
 *  Statistik fragt, bekommt Kacheln ohne Verlauf, und umgekehrt. */
export type StatistikAnsicht = {
  verkauf?: AssistantToolDataMap["sales_overview"];
  kennzahlen?: AssistantToolDataMap["assistant_statistics"];
};

function maskiere(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** JSON so einbetten, dass kein `</script>` den Kontext verlässt. */
function alsDatenblock(wert: unknown): string {
  return JSON.stringify(wert).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

function euro(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function kachel(label: string, wert: string | number): string {
  return `<div class="tile"><span class="tile-label">${maskiere(label)}</span><span class="tile-value">${maskiere(String(wert))}</span></div>`;
}

/** Die Kennzahlenkacheln.
 *
 * Fünf Zähler sind Zahlen, kein Diagramm — der Skill nennt „acht Farben, wenn
 * die Geschichte eine Zahl ist" den häufigsten Formfehler. Also Kacheln.
 */
function kacheln(kennzahlen: AssistantToolDataMap["assistant_statistics"]): string {
  return [
    kachel("Verkaufsfähige Karten", kennzahlen.sellableCards.toLocaleString("de-DE")),
    kachel("Offene Preisvorschläge", kennzahlen.openShopOffers.toLocaleString("de-DE")),
    kachel("Zu bearbeitende Bestellungen", kennzahlen.actionableOrders.toLocaleString("de-DE")),
    kachel("Neue Shop-Anfragen", kennzahlen.newShopInquiries.toLocaleString("de-DE")),
    kachel("Offene eBay-Aufträge", kennzahlen.unresolvedEbayJobs.toLocaleString("de-DE")),
  ].join("");
}

function kanalZeile(name: string, kanal: AssistantToolDataMap["sales_overview"]["channels"]["shop"]): string {
  if (!kanal.available) {
    return `<tr><th scope="row">${maskiere(name)}</th><td colspan="2" class="nicht-gelesen">nicht gelesen${kanal.unavailableCode ? ` (${maskiere(kanal.unavailableCode)})` : ""}</td></tr>`;
  }
  return `<tr><th scope="row">${maskiere(name)}</th><td>${maskiere(String(kanal.itemCount))}</td><td>${maskiere(kanal.revenueCents === null ? "—" : euro(kanal.revenueCents))}</td></tr>`;
}

export function rendereStatistikAnsicht(ansicht: StatistikAnsicht): string | null {
  if (!ansicht.verkauf && !ansicht.kennzahlen) return null;

  const reihe: Tagesreihe | null = ansicht.verkauf ? baueTagesreihe(ansicht.verkauf) : null;
  const verkauf = ansicht.verkauf;

  // Die Leitzahl: genau eine je Ansicht. Fehlt eine Hälfte der Quellen, gibt es
  // keine Gesamtsumme -- eine Zahl aus halber Grundlage wäre schlimmer als keine.
  const leitzahl = verkauf?.totalRevenueCents ?? null;

  const kopf = verkauf
    ? `<p class="hero-label">Umsatz, letzte ${maskiere(String(verkauf.days))} Tage</p>
       <p class="hero">${leitzahl === null ? "unvollständig" : maskiere(euro(leitzahl))}</p>
       <p class="hero-fuss">${maskiere(verkauf.revenueBasis)}</p>`
    : `<p class="hero-label">Shop-Kennzahlen</p>`;

  const filterzeile = reihe
    ? `<div class="filter" role="group" aria-label="Darstellung">
         <div class="gruppe" role="group" aria-label="Zeitfenster">
           ${[7, 30, 90].map((tage) => `<button type="button" class="knopf" data-fenster="${tage}">${tage} Tage</button>`).join("")}
         </div>
         <div class="gruppe" role="group" aria-label="Kennzahl">
           <button type="button" class="knopf" data-metrik="umsatz">Umsatz</button>
           <button type="button" class="knopf" data-metrik="stueck">Stückzahl</button>
         </div>
       </div>`
    : "";

  const diagramm = reihe
    ? `<figure class="karte">
         <figcaption>
           <span id="diagramm-titel">Verkäufe im Zeitverlauf</span>
           <span class="legende">
             <span class="key"><span class="swatch s-shop"></span>Shop</span>
             <span class="key"><span class="swatch s-ebay"></span>eBay</span>
           </span>
         </figcaption>
         <div class="plot-huelle">
           <svg id="plot" role="img" aria-labelledby="diagramm-titel" preserveAspectRatio="none"></svg>
           <div id="tooltip" role="status" aria-live="polite"></div>
         </div>
         <p class="aufloesung" id="aufloesung"></p>
       </figure>`
    : "";

  const tabelle = verkauf
    ? `<details class="tabelle">
         <summary>Zahlen als Tabelle</summary>
         <table>
           <caption>Verkäufe der letzten ${maskiere(String(verkauf.days))} Tage, ab ${maskiere(verkauf.since.slice(0, 10))}</caption>
           <thead><tr><th scope="col">Kanal</th><th scope="col">Karten</th><th scope="col">Umsatz</th></tr></thead>
           <tbody>
             ${kanalZeile("Shop", verkauf.channels.shop)}
             ${kanalZeile("eBay", verkauf.channels.ebay)}
           </tbody>
         </table>
         <div id="tabelle-verlauf"></div>
       </details>`
    : "";

  const hinweis = reihe && reihe.ohneDatum > 0
    ? `<p class="hinweis">${reihe.ohneDatum} Verkäufe ohne Datum sind in den Summen enthalten, aber in keiner Säule.</p>`
    : "";

  return `<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Statistik</title>
<style>
:root {
  color-scheme: light;
  --surface: #F1EEE8;
  --plane: #F7F3EC;
  --ink: #1A1A1A;
  --ink-2: #625A53;
  --muted: #6E665F;
  --grid: #DDD7CD;
  --axis: #C2BAB0;
  --ring: rgba(26,26,26,0.10);
  --s-shop: #2a78d6;
  --s-ebay: #eb6834;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --surface: #383838;
    --plane: #2B2B2B;
    --ink: #F5F5F5;
    --ink-2: #D0CBC4;
    --muted: #B6B0A8;
    --grid: #4A4A4A;
    --axis: #5C5C5C;
    --ring: rgba(255,255,255,0.12);
    --s-shop: #3987e5;
    --s-ebay: #d95926;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 14px;
  background: var(--plane); color: var(--ink);
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.hero-label { margin: 0; color: var(--ink-2); font-size: 12px; }
.hero { margin: 2px 0 0; font-size: 48px; font-weight: 600; line-height: 1.05; letter-spacing: -0.01em; }
.hero-fuss { margin: 4px 0 0; color: var(--muted); font-size: 11px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 8px; margin: 14px 0 0; }
.tile { background: var(--surface); border: 1px solid var(--ring); border-radius: 10px; padding: 9px 11px; display: flex; flex-direction: column; gap: 3px; }
.tile-label { color: var(--ink-2); font-size: 11px; }
.tile-value { font-size: 21px; font-weight: 600; }
.filter { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 8px; }
.gruppe { display: flex; gap: 2px; background: var(--surface); border: 1px solid var(--ring); border-radius: 9px; padding: 2px; }
.knopf {
  appearance: none; border: 0; background: transparent; color: var(--ink-2);
  font: inherit; font-size: 12px; padding: 5px 10px; border-radius: 7px; cursor: pointer;
  min-height: 26px;
}
.knopf:hover:not(:disabled) { background: var(--plane); color: var(--ink); }
.knopf[aria-pressed="true"] { background: var(--plane); color: var(--ink); font-weight: 600; box-shadow: 0 0 0 1px var(--ring) inset; }
.knopf:disabled { opacity: 0.4; cursor: default; }
.knopf:focus-visible { outline: 2px solid var(--s-shop); outline-offset: 1px; }
.karte { margin: 0; background: var(--surface); border: 1px solid var(--ring); border-radius: 12px; padding: 12px 12px 8px; }
figcaption { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; justify-content: space-between; color: var(--ink-2); font-size: 12px; }
.legende { display: flex; gap: 10px; }
.key { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-2); }
.swatch { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.s-shop { background: var(--s-shop); }
.s-ebay { background: var(--s-ebay); }
.plot-huelle { position: relative; margin-top: 8px; }
svg { display: block; width: 100%; height: 190px; }
#tooltip {
  position: absolute; pointer-events: none; opacity: 0; transition: opacity .1s;
  background: var(--plane); color: var(--ink); border: 1px solid var(--ring);
  border-radius: 8px; padding: 6px 8px; font-size: 12px; white-space: nowrap;
  box-shadow: 0 2px 10px rgba(0,0,0,0.18);
}
#tooltip.an { opacity: 1; }
#tooltip b { font-weight: 600; }
#tooltip .z { display: flex; align-items: center; gap: 5px; }
.aufloesung, .hinweis { margin: 6px 0 0; color: var(--muted); font-size: 11px; }
.tabelle { margin: 12px 0 0; }
summary { cursor: pointer; color: var(--ink-2); font-size: 12px; }
summary:focus-visible { outline: 2px solid var(--s-shop); outline-offset: 2px; }
table { border-collapse: collapse; margin: 8px 0 0; width: 100%; font-size: 12px; }
caption { text-align: left; color: var(--muted); font-size: 11px; padding-bottom: 6px; }
th, td { text-align: right; padding: 4px 6px; border-bottom: 1px solid var(--grid); font-variant-numeric: tabular-nums; }
th[scope="row"], thead th:first-child { text-align: left; font-variant-numeric: normal; }
.nicht-gelesen { color: var(--muted); text-align: left; font-variant-numeric: normal; }
</style>
${kopf}
${ansicht.kennzahlen ? `<div class="tiles">${kacheln(ansicht.kennzahlen)}</div>` : ""}
${filterzeile}
${diagramm}
${hinweis}
${tabelle}
${reihe ? `<script>
const TAGE = ${alsDatenblock(reihe.tage)};
const MAX_TAGES_SAEULEN = ${MAX_TAGES_SAEULEN};
const GEFRAGT = ${alsDatenblock(verkauf?.days ?? 30)};
(function () {
  const svg = document.getElementById("plot");
  const tip = document.getElementById("tooltip");
  const NS = "http://www.w3.org/2000/svg";
  let fenster = Math.min(GEFRAGT, 90);
  let metrik = "umsatz";

  const el = (name, attrs) => {
    const knoten = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) knoten.setAttribute(k, String(v));
    return knoten;
  };
  const euro = (c) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " \\u20AC";
  const wert = (e) => metrik === "umsatz" ? e.shopCents + e.ebayCents : e.shopStueck + e.ebayStueck;
  const zeige = (c) => metrik === "umsatz" ? euro(c) : String(c);
  const tagLabel = (iso) => iso.slice(8, 10) + "." + iso.slice(5, 7) + ".";

  // Verdichtet Tage zu Wochen, sobald das Fenster mehr Saeulen ergaebe als
  // lesbar sind. Die Schwelle kommt aus dem Server -- sie existiert genau einmal.
  function sichtbar() {
    const tage = TAGE.slice(-fenster);
    if (tage.length <= MAX_TAGES_SAEULEN) {
      return { eimer: tage.map((t) => ({ ...t, label: tagLabel(t.tag), von: t.tag, bis: t.tag })), aufloesung: "Tage" };
    }
    const eimer = [];
    for (let i = tage.length; i > 0; i -= 7) {
      const teil = tage.slice(Math.max(0, i - 7), i);
      eimer.unshift(teil.reduce((a, t) => ({
        label: "ab " + tagLabel(teil[0].tag), von: teil[0].tag, bis: teil[teil.length - 1].tag,
        shopCents: a.shopCents + t.shopCents, ebayCents: a.ebayCents + t.ebayCents,
        shopStueck: a.shopStueck + t.shopStueck, ebayStueck: a.ebayStueck + t.ebayStueck,
      }), { shopCents: 0, ebayCents: 0, shopStueck: 0, ebayStueck: 0 }));
    }
    return { eimer, aufloesung: "Wochen" };
  }

  function obergrenze(werte) {
    const groesster = Math.max(0, ...werte);
    if (groesster === 0) return metrik === "umsatz" ? 100 : 1;
    const stelle = Math.pow(10, Math.floor(Math.log10(groesster)));
    for (const s of [1, 2, 2.5, 5, 10]) if (s * stelle >= groesster) return s * stelle;
    return 10 * stelle;
  }

  function zeichne() {
    const { eimer, aufloesung } = sichtbar();
    const B = 520, H = 190, L = 52, R = 8, O = 12, U = 26;
    svg.setAttribute("viewBox", "0 0 " + B + " " + H);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    document.getElementById("aufloesung").textContent =
      eimer.length + " " + aufloesung + ", " + (metrik === "umsatz" ? "Bruttoumsatz" : "verkaufte Karten") + " je Balken.";

    const max = obergrenze(eimer.map(wert));
    const plotB = B - L - R, plotH = H - O - U;
    const y = (v) => O + plotH - (v / max) * plotH;

    // Gitter: durchgezogene Haarlinien, eine Stufe von der Flaeche entfernt.
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      svg.appendChild(el("line", { x1: L, x2: B - R, y1: y(v), y2: y(v), stroke: "var(--grid)", "stroke-width": 1 }));
      const t = el("text", { x: L - 7, y: y(v) + 3.5, "text-anchor": "end", fill: "var(--muted)", "font-size": 10 });
      t.style.fontVariantNumeric = "tabular-nums";
      t.textContent = metrik === "umsatz" ? Math.round(v / 100).toLocaleString("de-DE") : String(Math.round(v));
      svg.appendChild(t);
    }
    svg.appendChild(el("line", { x1: L, x2: B - R, y1: y(0), y2: y(0), stroke: "var(--axis)", "stroke-width": 1 }));

    const band = plotB / Math.max(1, eimer.length);
    const breite = Math.min(24, Math.max(3, band - 4));
    const spitze = eimer.reduce((a, e, i) => wert(e) > wert(eimer[a]) ? i : a, 0);

    eimer.forEach((e, i) => {
      const x = L + band * i + (band - breite) / 2;
      const unten = metrik === "umsatz" ? e.shopCents : e.shopStueck;
      const oben = metrik === "umsatz" ? e.ebayCents : e.ebayStueck;
      const gesamt = unten + oben;

      // Gestapelt, mit 2px Flaechenspalt zwischen den Segmenten -- kein Rahmen.
      let kopfY = y(gesamt);
      if (oben > 0) {
        const hoehe = Math.max(1, y(unten) - y(gesamt) - (unten > 0 ? 2 : 0));
        svg.appendChild(el("rect", { x, y: kopfY, width: breite, height: hoehe, rx: Math.min(4, breite / 2), fill: "var(--s-ebay)" }));
      }
      if (unten > 0) {
        const oben_y = oben > 0 ? y(unten) : y(unten);
        const hoehe = Math.max(1, y(0) - oben_y);
        // Nur die oberste Marke bekommt runde Enden; unten sitzt sie auf der Achse.
        svg.appendChild(el("rect", { x, y: oben_y, width: breite, height: hoehe, rx: oben > 0 ? 0 : Math.min(4, breite / 2), fill: "var(--s-shop)" }));
      }

      // Direktes Label **nur** am Spitzenwert -- eine Zahl auf jeder Saeule waere Chaos.
      if (i === spitze && gesamt > 0) {
        const t = el("text", { x: x + breite / 2, y: Math.max(O + 9, y(gesamt) - 5), "text-anchor": "middle", fill: "var(--ink)", "font-size": 10, "font-weight": 600 });
        t.textContent = zeige(gesamt);
        svg.appendChild(t);
      }

      // Trefferflaeche ueber die ganze Bandbreite, mindestens 24px hoch gedacht.
      const ziel = el("rect", { x: L + band * i, y: O, width: band, height: plotH, fill: "transparent" });
      ziel.setAttribute("tabindex", "0");
      ziel.setAttribute("role", "img");
      ziel.setAttribute("aria-label", e.label + ": Shop " + zeige(unten) + ", eBay " + zeige(oben));
      const an = () => {
        tip.innerHTML = "<b>" + e.label + "</b>"
          + '<div class="z"><span class="swatch s-shop"></span>Shop ' + zeige(unten) + "</div>"
          + '<div class="z"><span class="swatch s-ebay"></span>eBay ' + zeige(oben) + "</div>";
        tip.classList.add("an");
        const links = Math.min(Math.max(0, (L + band * i + band / 2) / B * svg.clientWidth - 60), Math.max(0, svg.clientWidth - 130));
        tip.style.left = links + "px";
        tip.style.top = "0px";
      };
      const aus = () => tip.classList.remove("an");
      ziel.addEventListener("mouseenter", an);
      ziel.addEventListener("mouseleave", aus);
      ziel.addEventListener("focus", an);
      ziel.addEventListener("blur", aus);
      svg.appendChild(ziel);

      if (eimer.length <= 12 || i % Math.ceil(eimer.length / 8) === 0) {
        const t = el("text", { x: L + band * i + band / 2, y: H - 8, "text-anchor": "middle", fill: "var(--muted)", "font-size": 10 });
        t.textContent = e.label.replace("ab ", "");
        svg.appendChild(t);
      }
    });

    const rumpf = eimer.map((e) => "<tr><th scope=\\"row\\">" + e.label + "</th><td>" + zeige(metrik === "umsatz" ? e.shopCents : e.shopStueck)
      + "</td><td>" + zeige(metrik === "umsatz" ? e.ebayCents : e.ebayStueck) + "</td></tr>").join("");
    document.getElementById("tabelle-verlauf").innerHTML =
      '<table><caption>Verlauf, ' + aufloesung + '</caption><thead><tr><th scope="col">Zeitraum</th><th scope="col">Shop</th><th scope="col">eBay</th></tr></thead><tbody>' + rumpf + "</tbody></table>";
  }

  function knoepfeStellen() {
    for (const b of document.querySelectorAll("[data-fenster]")) {
      const tage = Number(b.dataset.fenster);
      b.disabled = tage > TAGE.length;
      b.setAttribute("aria-pressed", String(tage === fenster));
      b.title = b.disabled ? "Dafür wurden nur " + TAGE.length + " Tage abgefragt." : "";
    }
    for (const b of document.querySelectorAll("[data-metrik]")) {
      b.setAttribute("aria-pressed", String(b.dataset.metrik === metrik));
    }
  }

  document.addEventListener("click", (e) => {
    const knopf = e.target.closest("[data-fenster],[data-metrik]");
    if (!knopf || knopf.disabled) return;
    if (knopf.dataset.fenster) fenster = Number(knopf.dataset.fenster);
    if (knopf.dataset.metrik) metrik = knopf.dataset.metrik;
    knoepfeStellen();
    zeichne();
  });

  knoepfeStellen();
  zeichne();
  addEventListener("resize", zeichne);
})();
</script>` : ""}`;
}
