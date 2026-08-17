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
/** Eine fertig formatierte Ansicht.
 *
 * **Die Texte sind Zeichenketten, das Diagramm ist ein textfreies SVG.** Grund:
 * Direct2D — und damit `SvgImageSource` in WinUI — stellt `<text>` nicht dar und
 * überspringt es stillschweigend. Am 2026-08-17 kamen die Bilder deshalb ohne
 * eine einzige Beschriftung im Assistenten an.
 *
 * Der Desktop setzt die Texte als echte Steuerelemente. Er **formatiert nichts**
 * — alles kommt fertig von hier —, er platziert nur. Damit bleibt die Trennung
 * aus Phase 4 gewahrt, und der Text wird scharf, skaliert mit der DPI und ist
 * vorlesbar.
 */
export type StatistikBild = {
  /** Stabiler Schlüssel, z. B. `30-umsatz`. */
  schluessel: string;
  fenster: number;
  metrik: Metrik;
  /** Beschriftung des Umschalters. */
  titel: string;
  /** Was unter dem Diagramm steht — Auflösung und Bezugsgröße. */
  hinweis: string;
  /** Überschrift der Leitzahl, z. B. „Umsatz, letzte 30 Tage". */
  heroLabel: string;
  /** Die Leitzahl selbst, fertig gesetzt. */
  heroWert: string;
  kacheln: Array<{ label: string; wert: string }>;
  /** Serienname und Farbe für die Legende — die Farbe gehört zum Plättchen,
   *  nie zum Text. */
  legende: Array<{ name: string; farbe: string }>;
  /** Achsenwerte von oben nach unten, passend zu den vier Gitterteilungen. */
  achse: string[];
  /** Eine Beschriftung je Säule, leer wo keine stehen soll — bei dreißig Säulen
   *  wäre unter jeder ein Datum unlesbar. */
  xAchse: string[];
  /** Anfang und Ende des gezeigten Zeitraums. Ein Datum je Säule wäre im Panel
   *  unlesbar und würde bei nativer Platzierung gegen die Balken verrutschen. */
  zeitraum: string;
  /** Der Spitzenwert im Klartext, statt als Beschriftung im Bild. */
  spitze: string | null;
  /** Nur Balken und Gitterlinien — kein `<text>`, weil Direct2D keins zeichnet. */
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

/** Die Fenster, die immer angeboten werden — sofern Daten dafür da sind. */
const STANDARD_FENSTER = [7, 30, 90] as const;

/** Welche Zeitfenster angeboten werden.
 *
 * **Das erfragte Fenster ist immer dabei.** Wer „die letzten 45 Tage" fragt,
 * soll seine 45 Tage sehen und nicht nur 7 und 30 — die Frage bestimmt den
 * Zeitraum, die Umschalter erweitern ihn nur. Ohne diese Vereinigung wäre der
 * Zeitraum in Wahrheit fest, egal was gefragt wurde.
 *
 * Angeboten wird nur, wofür auch Tage vorliegen: Ein Knopf „90 Tage" über einer
 * Reihe von sieben Tagen zeigte drei leere Wochen und behauptete damit, es sei
 * nichts verkauft worden.
 */
export function fensterAuswahl(gefragt: number, verfuegbareTage: number): number[] {
  const kandidaten = new Set<number>(STANDARD_FENSTER);
  if (gefragt > 0) kandidaten.add(gefragt);
  return [...kandidaten].filter((tage) => tage <= verfuegbareTage).sort((a, b) => a - b);
}

type Saeule = { label: string; kurz: string; shop: number; ebay: number };

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

function zeichnePlot(liste: Saeule[], metrik: Metrik, f: Farben): { svg: string; achse: string[] } {
  const B = 520, H = 200, L = 4, R = 4, O = 6, U = 6;
  const max = obergrenze(liste.map((s) => s.shop + s.ebay), metrik);
  const plotB = B - L - R;
  const plotH = H - O - U;
  const y = (v: number) => O + plotH - (v / max) * plotH;
  const teile: string[] = [];

  // Gitter: durchgezogene Haarlinien, eine Stufe von der Fläche entfernt.
  for (let i = 0; i <= 4; i += 1) {
    const wert = (max / 4) * i;
    teile.push(`<line x1="${L}" x2="${B - R}" y1="${y(wert).toFixed(1)}" y2="${y(wert).toFixed(1)}" stroke="${i === 0 ? f.achse : f.gitter}" stroke-width="1"/>`);
  }

  const band = plotB / Math.max(1, liste.length);
  const dick = Math.min(24, Math.max(3, band - 4));

  liste.forEach((s, i) => {
    const x = L + band * i + (band - dick) / 2;
    const gesamt = s.shop + s.ebay;
    const ecke = Math.min(4, dick / 2).toFixed(1);
    if (s.ebay > 0) {
      const hoehe = Math.max(1, y(s.shop) - y(gesamt) - (s.shop > 0 ? 2 : 0));
      teile.push(`<rect x="${x.toFixed(1)}" y="${y(gesamt).toFixed(1)}" width="${dick.toFixed(1)}" height="${hoehe.toFixed(1)}" rx="${ecke}" fill="${f.ebay}"/>`);
    }
    if (s.shop > 0) {
      teile.push(`<rect x="${x.toFixed(1)}" y="${y(s.shop).toFixed(1)}" width="${dick.toFixed(1)}" height="${Math.max(1, y(0) - y(s.shop)).toFixed(1)}" rx="${s.ebay > 0 ? "0" : ecke}" fill="${f.shop}"/>`);
    }
  });

  // Achsenwerte von oben nach unten, passend zu den Gitterteilungen.
  const achse = [4, 3, 2, 1, 0].map((i) => {
    const wert = (max / 4) * i;
    return metrik === "umsatz"
      ? `${Math.round(wert / 100).toLocaleString("de-DE")} €`
      : String(Math.round(wert));
  });

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" preserveAspectRatio="none">${teile.join("")}</svg>`,
    achse,
  };
}

/** Erzeugt die Ansichten für alle sinnvollen Fenster.
 *
 * Alle auf einmal, damit das Umschalten im Desktop sofort geht und keine zweite
 * Anfrage kostet.
 */
export function rendereStatistikBilder(ansicht: StatistikAnsicht, thema: Thema = "hell"): StatistikBild[] {
  if (!ansicht.verkauf && !ansicht.kennzahlen) return [];
  const f = PALETTE[thema];

  const kacheln = ansicht.kennzahlen
    ? [
        { label: "Verkaufsfähige Karten", wert: ansicht.kennzahlen.sellableCards.toLocaleString("de-DE") },
        { label: "Offene Preisvorschläge", wert: ansicht.kennzahlen.openShopOffers.toLocaleString("de-DE") },
        { label: "Zu bearbeitende Bestellungen", wert: ansicht.kennzahlen.actionableOrders.toLocaleString("de-DE") },
        { label: "Neue Shop-Anfragen", wert: ansicht.kennzahlen.newShopInquiries.toLocaleString("de-DE") },
        { label: "Offene eBay-Aufträge", wert: ansicht.kennzahlen.unresolvedEbayJobs.toLocaleString("de-DE") },
      ]
    : [];

  const verkauf = ansicht.verkauf;
  if (!verkauf) {
    return [{
      schluessel: "kennzahlen", fenster: 0, metrik: "umsatz", titel: "Kennzahlen",
      hinweis: "Stand jetzt.", heroLabel: "Shop-Kennzahlen", heroWert: "",
      kacheln, legende: [], achse: [], xAchse: [], zeitraum: "", spitze: null, svg: "",
    }];
  }

  const reihe = baueTagesreihe(verkauf);
  const bilder: StatistikBild[] = [];

  for (const fenster of fensterAuswahl(verkauf.days, reihe.tage.length)) {
    for (const metrik of ["umsatz", "stueck"] as Metrik[]) {
      const { liste, aufloesung } = saeulen(reihe.tage, fenster, metrik);
      const { svg, achse } = zeichnePlot(liste, metrik, f);
      const zeige = (v: number) => (metrik === "umsatz" ? euro(v) : `${v}`);

      // Die Leitzahl gehört zum **gezeigten** Fenster, nicht zur gestellten
      // Frage: Sonst stünde über einem 7-Tage-Diagramm der 90-Tage-Umsatz.
      const fensterTage = reihe.tage.slice(-fenster);
      const fensterUmsatz = fensterTage.reduce((summe, t) => summe + t.shopCents + t.ebayCents, 0);
      const spitzeIndex = liste.reduce((a, s, i) => (s.shop + s.ebay > liste[a].shop + liste[a].ebay ? i : a), 0);
      const spitzeWert = liste.length ? liste[spitzeIndex].shop + liste[spitzeIndex].ebay : 0;

      bilder.push({
        schluessel: `${fenster}-${metrik}`,
        fenster,
        metrik,
        titel: `${fenster} Tage · ${metrik === "umsatz" ? "Umsatz" : "Stückzahl"}`,
        hinweis: `${liste.length} ${aufloesung}, ${metrik === "umsatz" ? "Bruttoumsatz" : "verkaufte Karten"} je Balken.`,
        heroLabel: metrik === "umsatz" ? `Umsatz, letzte ${fenster} Tage` : `Verkaufte Karten, letzte ${fenster} Tage`,
        // `null` heißt „eine Hälfte fehlt" — eine Summe daraus wäre schlimmer
        // als keine.
        heroWert: verkauf.totalRevenueCents === null && metrik === "umsatz"
          ? "unvollständig"
          : zeige(metrik === "umsatz" ? fensterUmsatz : fensterTage.reduce((s, t) => s + t.shopStueck + t.ebayStueck, 0)),
        kacheln,
        legende: [{ name: "Shop", farbe: f.shop }, { name: "eBay", farbe: f.ebay }],
        achse,
        // Nicht unter jeder Säule: Bei dreißig Tagen stünde Datum an Datum.
        xAchse: liste.map((s, i) => (liste.length <= 10 || i % Math.ceil(liste.length / 6) === 0 ? s.kurz : "")),
        zeitraum: fensterTage.length
          ? `${tagLabel(fensterTage[0].tag)} – ${tagLabel(fensterTage[fensterTage.length - 1].tag)}`
          : "",
        spitze: spitzeWert > 0 ? `Höchster Wert: ${zeige(spitzeWert)} (${liste[spitzeIndex].label})` : null,
        svg,
      });
    }
  }

  return bilder;
}
