import type { AssistantToolDataMap } from "./contracts.ts";
import { baueTagesreihe, MAX_TAGES_SAEULEN, type Tageswert } from "./statistics-series.ts";

/** Zeichnet die Statistikansicht als eigenständiges SVG.
 *
 * **Serverseitig, und das ist eine Architekturentscheidung.** Phase 4 hat jede
 * Formatierung aus dem Desktop entfernt; ein Test verbietet sie dort. Das Bild
 * entsteht deshalb hier, deterministisch aus denselben typisierten DTOs, aus
 * denen auch der Antworttext gebaut wird. Der Desktop zeigt nur an.
 *
 * **Ein Bild, kein Web.** Der Betreiber wollte keine Web-Komponente im Programm.
 * WinUI stellt SVG über `SvgImageSource` nativ dar — die Umschalter sind echte
 * Knöpfe daneben und tauschen das mitgelieferte Bild aus.
 *
 * Daraus folgen drei Regeln, die beim Ändern gelten:
 *
 * 1. **Alles gehört ins Bild** — Leitzahl, Kacheln, Diagramm. Würde WinUI die
 *    Zahlen als eigene Elemente setzen, formatierte der Client wieder Daten.
 * 2. **Kein `<style>`, keine CSS-Variablen, keine Media-Queries.** Was
 *    `SvgImageSource` davon versteht, ist ungewiss; darauf zu bauen hieße raten.
 *    Farben stehen als Attribute an den Formen.
 * 3. **Das Thema kommt herein**, weil ein Bild nicht auf `prefers-color-scheme`
 *    reagieren kann.
 *
 * **Gestaltet nach dem `dataviz`-Verfahren.** Die Farben sind mit
 * `validate_palette.js` gegen die echten Flächen der App gemessen (`#F1EEE8`
 * hell, `#383838` dunkel, Serien aus den validierten Slots 1 und 2). Alle
 * Prüfungen bestanden — mit einer Auflage: Das Orange liegt hell bei 2,76:1,
 * unter 3:1. Das verpflichtet zu sichtbaren Labels; deshalb trägt jede Säule
 * ihren Kanal in der Legende und der Spitzenwert sein direktes Label, und die
 * Zahlen stehen zusätzlich in der Textantwort daneben.
 *
 * **Keine zwei y-Achsen.** Umsatz und Stückzahl sind zwei Skalen und bekommen
 * je ein eigenes Bild — die willkürliche Ausrichtung zweier Achsen erfindet eine
 * Korrelation, die in den Daten nicht steht.
 */

export type Thema = "hell" | "dunkel";
export type Metrik = "umsatz" | "stueck";

export type StatistikAnsicht = {
  verkauf?: AssistantToolDataMap["sales_overview"];
  kennzahlen?: AssistantToolDataMap["assistant_statistics"];
};

/** Ein fertiges Bild samt der Angaben, die der Desktop zum Umschalten braucht. */
export type StatistikBild = {
  /** Stabiler Schlüssel, z. B. `30-umsatz`. */
  schluessel: string;
  fenster: number;
  metrik: Metrik;
  /** Beschriftung des Umschalters. */
  titel: string;
  /** Was unter dem Bild steht — Auflösung und Bezugsgröße. */
  hinweis: string;
  svg: string;
};

type Farben = {
  flaeche: string; karte: string; ink: string; ink2: string; muted: string;
  gitter: string; achse: string; rahmen: string; shop: string; ebay: string;
};

const PALETTE: Record<Thema, Farben> = {
  // Slots 1 und 2 der validierten Kategorialpalette, gemessen gegen #F1EEE8.
  hell: {
    flaeche: "#F7F3EC", karte: "#F1EEE8", ink: "#1A1A1A", ink2: "#625A53", muted: "#6E665F",
    gitter: "#DDD7CD", achse: "#C2BAB0", rahmen: "#DCD5CA", shop: "#2a78d6", ebay: "#eb6834",
  },
  // Dieselben acht Hues, für die dunkle Fläche gestuft — kein automatischer
  // Umschlag, sondern eigene, gegen #383838 gemessene Stufen (3,22 / 3,02).
  dunkel: {
    flaeche: "#2B2B2B", karte: "#383838", ink: "#F5F5F5", ink2: "#D0CBC4", muted: "#B6B0A8",
    gitter: "#4A4A4A", achse: "#5C5C5C", rahmen: "#454545", shop: "#3987e5", ebay: "#d95926",
  },
};

const FENSTER = [7, 30, 90] as const;
const SCHRIFT = "system-ui, -apple-system, Segoe UI, sans-serif";
const B = 520;

type Saeule = { label: string; kurz: string; shop: number; ebay: number };

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

/** Kürzt an der Wortgrenze statt mitten im Wort.
 *
 * SVG kennt keinen Textfluss: Was nicht passt, läuft aus dem Bild oder muss
 * vorher enden. Ein harter Schnitt bei Zeichen 78 träfe „Versandkos" — das
 * Auslassungszeichen sagt wenigstens, dass etwas fehlt. */
export function kuerzeAufWortgrenze(text: string, grenze: number): string {
  if (text.length <= grenze) return text;
  const rumpf = text.slice(0, grenze);
  const luecke = rumpf.lastIndexOf(" ");
  return `${(luecke > grenze * 0.6 ? rumpf.slice(0, luecke) : rumpf).trimEnd()} …`;
}

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

/** Runde Achsenwerte tragen die Zahlen, die nicht direkt beschriftet werden. */
function obergrenze(werte: number[], metrik: Metrik): number {
  const groesster = Math.max(0, ...werte);
  if (groesster === 0) return metrik === "umsatz" ? 100 : 1;
  const stelle = 10 ** Math.floor(Math.log10(groesster));
  for (const schritt of [1, 2, 2.5, 5, 10]) if (schritt * stelle >= groesster) return schritt * stelle;
  return 10 * stelle;
}

function text(inhalt: string, x: number, y: number, o: { fill: string; size: number; anchor?: string; weight?: number }): string {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${o.fill}" font-family="${SCHRIFT}" font-size="${o.size}"`
    + `${o.weight ? ` font-weight="${o.weight}"` : ""}${o.anchor ? ` text-anchor="${o.anchor}"` : ""}>${maskiere(inhalt)}</text>`;
}

function kachel(x: number, y: number, breite: number, label: string, wert: string, f: Farben): string {
  // Zeilenumbruch von Hand: SVG kennt keinen Textfluss, und ein zu langes Label
  // würde sonst über die Kachel hinauslaufen statt umzubrechen.
  const woerter = label.split(" ");
  const zeilen: string[] = [];
  let zeile = "";
  for (const wort of woerter) {
    const versuch = zeile ? `${zeile} ${wort}` : wort;
    if (versuch.length > Math.floor((breite - 18) / 5.4) && zeile) {
      zeilen.push(zeile);
      zeile = wort;
    } else {
      zeile = versuch;
    }
  }
  if (zeile) zeilen.push(zeile);
  const sichtbar = zeilen.slice(0, 2);

  return `<rect x="${x}" y="${y}" width="${breite}" height="62" rx="10" fill="${f.karte}" stroke="${f.rahmen}" stroke-width="1"/>`
    + sichtbar.map((z, i) => text(z, x + 10, y + 17 + i * 11, { fill: f.ink2, size: 10 })).join("")
    + text(wert, x + 10, y + 51, { fill: f.ink, size: 20, weight: 600 });
}

function zeichneBild(
  ansicht: StatistikAnsicht,
  tage: Tageswert[] | null,
  fenster: number,
  metrik: Metrik,
  thema: Thema,
): { svg: string; hinweis: string } {
  const f = PALETTE[thema];
  const verkauf = ansicht.verkauf;
  const teile: string[] = [];
  let y = 0;

  // ---- Leitzahl -----------------------------------------------------------
  if (verkauf) {
    teile.push(text(`Umsatz, letzte ${verkauf.days} Tage`, 14, 22, { fill: f.ink2, size: 12 }));
    teile.push(text(verkauf.totalRevenueCents === null ? "unvollständig" : euro(verkauf.totalRevenueCents), 14, 66, { fill: f.ink, size: 42, weight: 600 }));
    teile.push(text(kuerzeAufWortgrenze(verkauf.revenueBasis, 78), 14, 84, { fill: f.muted, size: 10 }));
    y = 98;
  } else {
    teile.push(text("Shop-Kennzahlen", 14, 24, { fill: f.ink2, size: 13, weight: 600 }));
    y = 38;
  }

  // ---- Kacheln ------------------------------------------------------------
  if (ansicht.kennzahlen) {
    const k = ansicht.kennzahlen;
    const werte: [string, string][] = [
      ["Verkaufsfähige Karten", k.sellableCards.toLocaleString("de-DE")],
      ["Offene Preisvorschläge", k.openShopOffers.toLocaleString("de-DE")],
      ["Zu bearbeitende Bestellungen", k.actionableOrders.toLocaleString("de-DE")],
      ["Neue Shop-Anfragen", k.newShopInquiries.toLocaleString("de-DE")],
      ["Offene eBay-Aufträge", k.unresolvedEbayJobs.toLocaleString("de-DE")],
    ];
    const spalten = 3;
    const breite = (B - 28 - (spalten - 1) * 8) / spalten;
    werte.forEach(([label, wert], i) => {
      const spalte = i % spalten;
      const reihe = Math.floor(i / spalten);
      teile.push(kachel(14 + spalte * (breite + 8), y + reihe * 70, breite, label, wert, f));
    });
    y += Math.ceil(werte.length / spalten) * 70 + 6;
  }

  // ---- Diagramm -----------------------------------------------------------
  let hinweis = "";
  if (tage && verkauf) {
    const { liste, aufloesung } = saeulen(tage, fenster, metrik);
    hinweis = `${liste.length} ${aufloesung}, ${metrik === "umsatz" ? "Bruttoumsatz" : "verkaufte Karten"} je Balken.`;

    const kartenHoehe = 214;
    teile.push(`<rect x="14" y="${y}" width="${B - 28}" height="${kartenHoehe}" rx="12" fill="${f.karte}" stroke="${f.rahmen}" stroke-width="1"/>`);
    teile.push(text("Verkäufe im Zeitverlauf", 26, y + 20, { fill: f.ink2, size: 12 }));

    // Legende — bei zwei Serien immer vorhanden, nie Farbe allein.
    teile.push(`<rect x="${B - 132}" y="${y + 11}" width="9" height="9" rx="2" fill="${f.shop}"/>`);
    teile.push(text("Shop", B - 119, y + 19, { fill: f.ink2, size: 11 }));
    teile.push(`<rect x="${B - 78}" y="${y + 11}" width="9" height="9" rx="2" fill="${f.ebay}"/>`);
    teile.push(text("eBay", B - 65, y + 19, { fill: f.ink2, size: 11 }));

    const L = 66, R = 26, O = y + 34, U = y + kartenHoehe - 34;
    const plotB = B - L - R;
    const plotH = U - O;
    const max = obergrenze(liste.map((s) => s.shop + s.ebay), metrik);
    const skala = (v: number) => U - (v / max) * plotH;
    const zeige = (v: number) => (metrik === "umsatz" ? euro(v) : String(v));

    for (let i = 0; i <= 4; i += 1) {
      const v = (max / 4) * i;
      teile.push(`<line x1="${L}" x2="${B - R}" y1="${skala(v).toFixed(1)}" y2="${skala(v).toFixed(1)}" stroke="${f.gitter}" stroke-width="1"/>`);
      teile.push(text(metrik === "umsatz" ? Math.round(v / 100).toLocaleString("de-DE") : String(Math.round(v)), L - 7, skala(v) + 3.5, { fill: f.muted, size: 10, anchor: "end" }));
    }
    teile.push(`<line x1="${L}" x2="${B - R}" y1="${skala(0)}" y2="${skala(0)}" stroke="${f.achse}" stroke-width="1"/>`);

    const band = plotB / Math.max(1, liste.length);
    const dick = Math.min(24, Math.max(3, band - 4));
    const spitze = liste.reduce((a, s, i) => (s.shop + s.ebay > liste[a].shop + liste[a].ebay ? i : a), 0);

    liste.forEach((s, i) => {
      const x = L + band * i + (band - dick) / 2;
      const gesamt = s.shop + s.ebay;
      const ecke = Math.min(4, dick / 2).toFixed(1);
      if (s.ebay > 0) {
        const hoehe = Math.max(1, skala(s.shop) - skala(gesamt) - (s.shop > 0 ? 2 : 0));
        teile.push(`<rect x="${x.toFixed(1)}" y="${skala(gesamt).toFixed(1)}" width="${dick.toFixed(1)}" height="${hoehe.toFixed(1)}" rx="${ecke}" fill="${f.ebay}"/>`);
      }
      if (s.shop > 0) {
        teile.push(`<rect x="${x.toFixed(1)}" y="${skala(s.shop).toFixed(1)}" width="${dick.toFixed(1)}" height="${Math.max(1, skala(0) - skala(s.shop)).toFixed(1)}" rx="${s.ebay > 0 ? "0" : ecke}" fill="${f.shop}"/>`);
      }
      // Direktes Label **nur** am Spitzenwert — eine Zahl auf jeder Säule wäre Chaos.
      if (i === spitze && gesamt > 0) {
        teile.push(text(zeige(gesamt), x + dick / 2, Math.max(O + 9, skala(gesamt) - 5), { fill: f.ink, size: 10, weight: 600, anchor: "middle" }));
      }
      if (liste.length <= 12 || i % Math.ceil(liste.length / 8) === 0) {
        teile.push(text(s.kurz, L + band * i + band / 2, U + 14, { fill: f.muted, size: 10, anchor: "middle" }));
      }
    });

    teile.push(text(hinweis, 26, y + kartenHoehe - 8, { fill: f.muted, size: 10 }));
    y += kartenHoehe + 6;
  }

  const H = Math.round(y + 8);
  const beschreibung = verkauf
    ? `Statistik: Umsatz der letzten ${verkauf.days} Tage, ${hinweis}`
    : "Shop-Kennzahlen";

  return {
    hinweis,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img">`
      + `<title>${maskiere(beschreibung)}</title>`
      + `<rect width="${B}" height="${H}" fill="${f.flaeche}"/>`
      + teile.join("")
      + `</svg>`,
  };
}

/** Erzeugt die Bilder für alle sinnvollen Ansichten.
 *
 * Alle auf einmal, damit das Umschalten im Desktop sofort geht und keine zweite
 * Anfrage kostet — dieselbe Überlegung wie bei der Lesartenprüfung, wo die
 * Ratenbegrenzung das Bündeln erzwang.
 */
export function rendereStatistikBilder(ansicht: StatistikAnsicht, thema: Thema = "hell"): StatistikBild[] {
  if (!ansicht.verkauf && !ansicht.kennzahlen) return [];

  const reihe = ansicht.verkauf ? baueTagesreihe(ansicht.verkauf) : null;
  if (!reihe || !ansicht.verkauf) {
    const { svg, hinweis } = zeichneBild(ansicht, null, 0, "umsatz", thema);
    return [{ schluessel: "kennzahlen", fenster: 0, metrik: "umsatz", titel: "Kennzahlen", hinweis, svg }];
  }

  const bilder: StatistikBild[] = [];
  for (const fenster of FENSTER) {
    if (fenster > reihe.tage.length) continue;
    for (const metrik of ["umsatz", "stueck"] as Metrik[]) {
      const { svg, hinweis } = zeichneBild(ansicht, reihe.tage, fenster, metrik, thema);
      bilder.push({
        schluessel: `${fenster}-${metrik}`,
        fenster,
        metrik,
        titel: `${fenster} Tage · ${metrik === "umsatz" ? "Umsatz" : "Stückzahl"}`,
        hinweis,
        svg,
      });
    }
  }
  return bilder;
}
