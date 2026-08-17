import type { AssistantToolDataMap } from "./contracts.ts";
import { baueTagesreihe, MAX_TAGES_SAEULEN, type Tageswert } from "./statistics-series.ts";

/** Erzeugt das eigenständige HTML-Dokument für Statistikantworten.
 *
 * **Serverseitig, und das ist eine Architekturentscheidung.** Phase 4 hat jede
 * Formatierung aus dem Desktop entfernt; ein Test verbietet sie dort. Die Grafik
 * entsteht deshalb hier, deterministisch aus denselben typisierten DTOs, aus
 * denen auch der Antworttext gebaut wird. Der Desktop zeigt nur an.
 *
 * **Das Diagramm ist fertig gezeichnet, bevor ein Skript läuft.** Am 2026-08-17
 * zeigte eine Vorschau ohne JavaScript Kacheln, Umschalter und Kartenrahmen —
 * und einen leeren Diagrammbereich. Im WebView2 wäre das nie aufgefallen, dort
 * laufen Skripte. Ein Diagramm ohne Rückfall ist trotzdem falsch gebaut.
 *
 * Alle sechs Ansichten (drei Fenster × zwei Kennzahlen) werden deshalb hier
 * gezeichnet; das Skript schaltet nur Sichtbarkeit um und legt den Tooltip
 * darüber. **Eine** Zeichenimplementierung — serverseitig vorzeichnen *und* im
 * Skript neu zeichnen hätte dieselbe Grafik zweimal beschrieben.
 *
 * **Gestaltet nach dem `dataviz`-Verfahren.** Die Farben sind mit
 * `validate_palette.js` gegen die echten Flächen der App gemessen (`#F1EEE8`
 * hell, `#383838` dunkel, Serien aus den validierten Slots 1 und 2). Alle
 * Prüfungen bestanden — mit einer Auflage: Das Orange liegt hell bei 2,76:1,
 * also unter 3:1. Das verpflichtet zu sichtbaren Labels **und** einer
 * Tabellenansicht; beide sind deshalb Pflicht, nicht Zierde.
 *
 * **Keine zwei y-Achsen.** Umsatz und Stückzahl sind zwei Skalen und werden
 * umgeschaltet, nicht übereinandergelegt — die willkürliche Ausrichtung zweier
 * Achsen erfindet eine Korrelation, die in den Daten nicht steht.
 */

export type StatistikAnsicht = {
  verkauf?: AssistantToolDataMap["sales_overview"];
  kennzahlen?: AssistantToolDataMap["assistant_statistics"];
};

type Metrik = "umsatz" | "stueck";

type Saeule = {
  label: string;
  kurz: string;
  shop: number;
  ebay: number;
};

const FENSTER = [7, 30, 90] as const;
const PLOT = { breite: 520, hoehe: 190, links: 52, rechts: 8, oben: 12, unten: 26 };

function maskiere(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function euro(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const tagLabel = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** Verdichtet Tage zu Wochen, sobald das Fenster mehr Säulen ergäbe als lesbar
 *  sind. Die Schwelle steht in `statistics-series.ts` und existiert genau einmal. */
function saeulen(tage: Tageswert[], fenster: number, metrik: Metrik): { liste: Saeule[]; aufloesung: string } {
  const teil = tage.slice(-fenster);
  const wert = (t: Tageswert, kanal: "shop" | "ebay") =>
    metrik === "umsatz" ? (kanal === "shop" ? t.shopCents : t.ebayCents) : (kanal === "shop" ? t.shopStueck : t.ebayStueck);

  if (teil.length <= MAX_TAGES_SAEULEN) {
    return {
      liste: teil.map((t) => ({ label: tagLabel(t.tag), kurz: tagLabel(t.tag), shop: wert(t, "shop"), ebay: wert(t, "ebay") })),
      aufloesung: "Tage",
    };
  }

  const liste: Saeule[] = [];
  for (let i = teil.length; i > 0; i -= 7) {
    const woche = teil.slice(Math.max(0, i - 7), i);
    liste.unshift({
      label: `ab ${tagLabel(woche[0].tag)}`,
      kurz: tagLabel(woche[0].tag),
      shop: woche.reduce((a, t) => a + wert(t, "shop"), 0),
      ebay: woche.reduce((a, t) => a + wert(t, "ebay"), 0),
    });
  }
  return { liste, aufloesung: "Wochen" };
}

/** Die Achsenobergrenze: der größte Wert, aufgerundet auf eine runde Zahl.
 *  Runde Achsenwerte tragen die Werte, die nicht direkt beschriftet werden. */
function obergrenze(werte: number[], metrik: Metrik): number {
  const groesster = Math.max(0, ...werte);
  if (groesster === 0) return metrik === "umsatz" ? 100 : 1;
  const stelle = 10 ** Math.floor(Math.log10(groesster));
  for (const schritt of [1, 2, 2.5, 5, 10]) {
    if (schritt * stelle >= groesster) return schritt * stelle;
  }
  return 10 * stelle;
}

function zeichne(liste: Saeule[], metrik: Metrik): string {
  const { breite: B, hoehe: H, links: L, rechts: R, oben: O, unten: U } = PLOT;
  const zeige = (v: number) => (metrik === "umsatz" ? euro(v) : String(v));
  const max = obergrenze(liste.map((s) => s.shop + s.ebay), metrik);
  const plotB = B - L - R;
  const plotH = H - O - U;
  const y = (v: number) => O + plotH - (v / max) * plotH;
  const teile: string[] = [];

  // Gitter: durchgezogene Haarlinien, eine Stufe von der Fläche entfernt.
  for (let i = 0; i <= 4; i += 1) {
    const v = (max / 4) * i;
    teile.push(`<line x1="${L}" x2="${B - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--grid)" stroke-width="1"/>`);
    const beschriftung = metrik === "umsatz" ? Math.round(v / 100).toLocaleString("de-DE") : String(Math.round(v));
    teile.push(`<text x="${L - 7}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="10" class="tick">${maskiere(beschriftung)}</text>`);
  }
  teile.push(`<line x1="${L}" x2="${B - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--axis)" stroke-width="1"/>`);

  const band = plotB / Math.max(1, liste.length);
  const dick = Math.min(24, Math.max(3, band - 4));
  const spitze = liste.reduce((a, s, i) => (s.shop + s.ebay > liste[a].shop + liste[a].ebay ? i : a), 0);

  liste.forEach((s, i) => {
    const x = L + band * i + (band - dick) / 2;
    const gesamt = s.shop + s.ebay;
    const ecke = Math.min(4, dick / 2);

    // Gestapelt, mit 2px Flächenspalt zwischen den Segmenten — kein Rahmen.
    if (s.ebay > 0) {
      const hoehe = Math.max(1, y(s.shop) - y(gesamt) - (s.shop > 0 ? 2 : 0));
      teile.push(`<rect x="${x.toFixed(1)}" y="${y(gesamt).toFixed(1)}" width="${dick.toFixed(1)}" height="${hoehe.toFixed(1)}" rx="${ecke.toFixed(1)}" fill="var(--s-ebay)"/>`);
    }
    if (s.shop > 0) {
      const hoehe = Math.max(1, y(0) - y(s.shop));
      teile.push(`<rect x="${x.toFixed(1)}" y="${y(s.shop).toFixed(1)}" width="${dick.toFixed(1)}" height="${hoehe.toFixed(1)}" rx="${s.ebay > 0 ? 0 : ecke.toFixed(1)}" fill="var(--s-shop)"/>`);
    }

    // Direktes Label **nur** am Spitzenwert — eine Zahl auf jeder Säule wäre Chaos.
    if (i === spitze && gesamt > 0) {
      teile.push(`<text x="${(x + dick / 2).toFixed(1)}" y="${Math.max(O + 9, y(gesamt) - 5).toFixed(1)}" text-anchor="middle" fill="var(--ink)" font-size="10" font-weight="600">${maskiere(zeige(gesamt))}</text>`);
    }

    // Trefferfläche über die volle Bandbreite und Plothöhe. Die Bänder stoßen
    // lückenlos aneinander — man kann nicht danebenzeigen, auch wenn ein
    // einzelnes Band bei dreißig Säulen nur rund 15px breit ist.
    teile.push(
      `<rect class="ziel" x="${(L + band * i).toFixed(1)}" y="${O}" width="${band.toFixed(1)}" height="${plotH}" fill="transparent" tabindex="0" role="img"`
      + ` aria-label="${maskiere(`${s.label}: Shop ${zeige(s.shop)}, eBay ${zeige(s.ebay)}`)}"`
      + ` data-titel="${maskiere(s.label)}" data-shop="${maskiere(zeige(s.shop))}" data-ebay="${maskiere(zeige(s.ebay))}"`
      + ` data-mitte="${((L + band * i + band / 2) / B).toFixed(4)}"><title>${maskiere(`${s.label}: Shop ${zeige(s.shop)}, eBay ${zeige(s.ebay)}`)}</title></rect>`,
    );

    if (liste.length <= 12 || i % Math.ceil(liste.length / 8) === 0) {
      teile.push(`<text x="${(L + band * i + band / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="var(--muted)" font-size="10">${maskiere(s.kurz)}</text>`);
    }
  });

  return teile.join("");
}

function verlaufTabelle(liste: Saeule[], aufloesung: string, metrik: Metrik): string {
  const zeige = (v: number) => (metrik === "umsatz" ? euro(v) : String(v));
  const zeilen = liste
    .map((s) => `<tr><th scope="row">${maskiere(s.label)}</th><td>${maskiere(zeige(s.shop))}</td><td>${maskiere(zeige(s.ebay))}</td></tr>`)
    .join("");
  return `<table><caption>Verlauf, ${maskiere(aufloesung)}</caption><thead><tr><th scope="col">Zeitraum</th><th scope="col">Shop</th><th scope="col">eBay</th></tr></thead><tbody>${zeilen}</tbody></table>`;
}

function kachel(label: string, wert: string): string {
  return `<div class="tile"><span class="tile-label">${maskiere(label)}</span><span class="tile-value">${maskiere(wert)}</span></div>`;
}

function kacheln(k: AssistantToolDataMap["assistant_statistics"]): string {
  return [
    kachel("Verkaufsfähige Karten", k.sellableCards.toLocaleString("de-DE")),
    kachel("Offene Preisvorschläge", k.openShopOffers.toLocaleString("de-DE")),
    kachel("Zu bearbeitende Bestellungen", k.actionableOrders.toLocaleString("de-DE")),
    kachel("Neue Shop-Anfragen", k.newShopInquiries.toLocaleString("de-DE")),
    kachel("Offene eBay-Aufträge", k.unresolvedEbayJobs.toLocaleString("de-DE")),
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

  const verkauf = ansicht.verkauf;
  const reihe = verkauf ? baueTagesreihe(verkauf) : null;
  const vorgabeFenster = verkauf ? Math.min(Math.max(7, verkauf.days), 90) : 0;

  const kopf = verkauf
    ? `<p class="hero-label">Umsatz, letzte ${maskiere(String(verkauf.days))} Tage</p>
<p class="hero">${verkauf.totalRevenueCents === null ? "unvollständig" : maskiere(euro(verkauf.totalRevenueCents))}</p>
<p class="hero-fuss">${maskiere(verkauf.revenueBasis)}</p>`
    : `<p class="hero-label">Shop-Kennzahlen</p>`;

  let filterzeile = "";
  let diagramm = "";
  let verlauf = "";

  if (reihe && verkauf) {
    const verfuegbar = (tage: number) => tage <= reihe.tage.length;
    const gewaehlt = FENSTER.includes(vorgabeFenster as 7 | 30 | 90)
      ? vorgabeFenster
      : FENSTER.filter((f) => verfuegbar(f)).at(-1) ?? 7;

    filterzeile = `<div class="filter" role="group" aria-label="Darstellung">
<div class="gruppe" role="group" aria-label="Zeitfenster">${FENSTER.map((tage) =>
      `<button type="button" class="knopf" data-fenster="${tage}" aria-pressed="${tage === gewaehlt}"${verfuegbar(tage) ? "" : ` disabled title="Dafür wurden nur ${reihe.tage.length} Tage abgefragt."`}>${tage} Tage</button>`,
    ).join("")}</div>
<div class="gruppe" role="group" aria-label="Kennzahl">${(["umsatz", "stueck"] as Metrik[]).map((m) =>
      `<button type="button" class="knopf" data-metrik="${m}" aria-pressed="${m === "umsatz"}">${m === "umsatz" ? "Umsatz" : "Stückzahl"}</button>`,
    ).join("")}</div></div>`;

    const gruppen: string[] = [];
    const tabellen: string[] = [];
    let hinweisAufloesung = "";
    for (const fenster of FENSTER) {
      if (!verfuegbar(fenster)) continue;
      for (const metrik of ["umsatz", "stueck"] as Metrik[]) {
        const { liste, aufloesung } = saeulen(reihe.tage, fenster, metrik);
        const aktiv = fenster === gewaehlt && metrik === "umsatz";
        if (aktiv) {
          hinweisAufloesung = `${liste.length} ${aufloesung}, ${metrik === "umsatz" ? "Bruttoumsatz" : "verkaufte Karten"} je Balken.`;
        }
        gruppen.push(`<g class="sicht" data-sicht="${fenster}-${metrik}" data-hinweis="${maskiere(`${liste.length} ${aufloesung}, ${metrik === "umsatz" ? "Bruttoumsatz" : "verkaufte Karten"} je Balken.`)}"${aktiv ? "" : ' hidden aria-hidden="true"'}>${zeichne(liste, metrik)}</g>`);
        tabellen.push(`<div class="sicht-tabelle" data-sicht="${fenster}-${metrik}"${aktiv ? "" : " hidden"}>${verlaufTabelle(liste, aufloesung, metrik)}</div>`);
      }
    }

    diagramm = `<figure class="karte">
<figcaption><span id="diagramm-titel">Verkäufe im Zeitverlauf</span>
<span class="legende"><span class="key"><span class="swatch s-shop"></span>Shop</span><span class="key"><span class="swatch s-ebay"></span>eBay</span></span></figcaption>
<div class="plot-huelle">
<svg id="plot" viewBox="0 0 ${PLOT.breite} ${PLOT.hoehe}" preserveAspectRatio="none" role="img" aria-labelledby="diagramm-titel">${gruppen.join("")}</svg>
<div id="tooltip" role="status" aria-live="polite"></div>
</div>
<p class="aufloesung" id="aufloesung">${maskiere(hinweisAufloesung)}</p></figure>`;
    verlauf = tabellen.join("");
  }

  const hinweis = reihe && reihe.ohneDatum > 0
    ? `<p class="hinweis">${reihe.ohneDatum} Verkäufe ohne Datum sind in den Summen enthalten, aber in keiner Säule.</p>`
    : "";

  const tabelle = verkauf
    ? `<details class="tabelle"><summary>Zahlen als Tabelle</summary>
<table><caption>Verkäufe der letzten ${maskiere(String(verkauf.days))} Tage, ab ${maskiere(verkauf.since.slice(0, 10))}</caption>
<thead><tr><th scope="col">Kanal</th><th scope="col">Karten</th><th scope="col">Umsatz</th></tr></thead>
<tbody>${kanalZeile("Shop", verkauf.channels.shop)}${kanalZeile("eBay", verkauf.channels.ebay)}</tbody></table>
${verlauf}</details>`
    : "";

  return `<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Statistik</title>
<style>
:root {
  color-scheme: light;
  --surface: #F1EEE8; --plane: #F7F3EC;
  --ink: #1A1A1A; --ink-2: #625A53; --muted: #6E665F;
  --grid: #DDD7CD; --axis: #C2BAB0; --ring: rgba(26,26,26,0.10);
  --s-shop: #2a78d6; --s-ebay: #eb6834;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --surface: #383838; --plane: #2B2B2B;
    --ink: #F5F5F5; --ink-2: #D0CBC4; --muted: #B6B0A8;
    --grid: #4A4A4A; --axis: #5C5C5C; --ring: rgba(255,255,255,0.12);
    --s-shop: #3987e5; --s-ebay: #d95926;
  }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 14px; background: var(--plane); color: var(--ink); font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
.hero-label { margin: 0; color: var(--ink-2); font-size: 12px; }
.hero { margin: 2px 0 0; font-size: 48px; font-weight: 600; line-height: 1.05; letter-spacing: -0.01em; }
.hero-fuss { margin: 4px 0 0; color: var(--muted); font-size: 11px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 8px; margin: 14px 0 0; }
.tile { background: var(--surface); border: 1px solid var(--ring); border-radius: 10px; padding: 9px 11px; display: flex; flex-direction: column; gap: 3px; }
.tile-label { color: var(--ink-2); font-size: 11px; }
.tile-value { font-size: 21px; font-weight: 600; }
.filter { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 8px; }
.gruppe { display: flex; gap: 2px; background: var(--surface); border: 1px solid var(--ring); border-radius: 9px; padding: 2px; }
.knopf { appearance: none; border: 0; background: transparent; color: var(--ink-2); font: inherit; font-size: 12px; padding: 5px 10px; border-radius: 7px; cursor: pointer; min-height: 26px; }
.knopf:hover:not(:disabled) { background: var(--plane); color: var(--ink); }
.knopf[aria-pressed="true"] { background: var(--plane); color: var(--ink); font-weight: 600; box-shadow: 0 0 0 1px var(--ring) inset; }
.knopf:disabled { opacity: 0.4; cursor: default; }
.knopf:focus-visible { outline: 2px solid var(--s-shop); outline-offset: 1px; }
.karte { margin: 0; background: var(--surface); border: 1px solid var(--ring); border-radius: 12px; padding: 12px 12px 8px; }
figcaption { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; justify-content: space-between; color: var(--ink-2); font-size: 12px; }
.legende { display: flex; gap: 10px; }
.key { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-2); }
.swatch { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.s-shop { background: var(--s-shop); } .s-ebay { background: var(--s-ebay); }
.plot-huelle { position: relative; margin-top: 8px; }
svg { display: block; width: 100%; height: 190px; }
.tick { font-variant-numeric: tabular-nums; }
.ziel:focus-visible { outline: 2px solid var(--s-shop); outline-offset: -2px; }
#tooltip { position: absolute; pointer-events: none; opacity: 0; transition: opacity .1s; background: var(--plane); color: var(--ink); border: 1px solid var(--ring); border-radius: 8px; padding: 6px 8px; font-size: 12px; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,0.18); }
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
${diagramm ? `<script>
(function () {
  // **Das Skript zeichnet nichts.** Alle Ansichten sind fertig gerendert; hier
  // wird nur umgeschaltet und der Tooltip gelegt. Ohne dieses Skript bleibt das
  // Diagramm vollständig sichtbar -- nur eben ohne Umschalter und Tooltip.
  var tip = document.getElementById("tooltip");
  var svg = document.getElementById("plot");
  var fenster = document.querySelector("[data-fenster][aria-pressed='true']").dataset.fenster;
  var metrik = "umsatz";

  function stelle() {
    var schluessel = fenster + "-" + metrik;
    document.querySelectorAll(".sicht").forEach(function (g) {
      var an = g.dataset.sicht === schluessel;
      g.hidden = !an;
      g.setAttribute("aria-hidden", String(!an));
      if (an) document.getElementById("aufloesung").textContent = g.dataset.hinweis;
    });
    document.querySelectorAll(".sicht-tabelle").forEach(function (d) { d.hidden = d.dataset.sicht !== schluessel; });
    document.querySelectorAll("[data-fenster]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.fenster === fenster)); });
    document.querySelectorAll("[data-metrik]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.metrik === metrik)); });
    tip.classList.remove("an");
  }

  document.addEventListener("click", function (e) {
    var knopf = e.target.closest("[data-fenster],[data-metrik]");
    if (!knopf || knopf.disabled) return;
    if (knopf.dataset.fenster) fenster = knopf.dataset.fenster;
    if (knopf.dataset.metrik) metrik = knopf.dataset.metrik;
    stelle();
  });

  function an(e) {
    var z = e.target;
    tip.innerHTML = "<b>" + z.dataset.titel + "</b>"
      + '<div class="z"><span class="swatch s-shop"></span>Shop ' + z.dataset.shop + "</div>"
      + '<div class="z"><span class="swatch s-ebay"></span>eBay ' + z.dataset.ebay + "</div>";
    tip.classList.add("an");
    var mitte = Number(z.dataset.mitte) * svg.clientWidth;
    tip.style.left = Math.min(Math.max(0, mitte - 60), Math.max(0, svg.clientWidth - 132)) + "px";
    tip.style.top = "0px";
  }
  function aus() { tip.classList.remove("an"); }
  svg.addEventListener("mouseover", function (e) { if (e.target.classList.contains("ziel")) an(e); });
  svg.addEventListener("mouseout", function (e) { if (e.target.classList.contains("ziel")) aus(); });
  svg.addEventListener("focusin", function (e) { if (e.target.classList.contains("ziel")) an(e); });
  svg.addEventListener("focusout", aus);
})();
</script>` : ""}`;
}
