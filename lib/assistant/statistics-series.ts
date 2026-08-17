import type { AssistantToolDataMap } from "./contracts.ts";

/** Aus Einzelverkäufen eine Tagesreihe machen — ohne dabei zu lügen.
 *
 * Getrennt vom Zeichnen, weil hier die Entscheidungen liegen, die man prüfen
 * können muss: welche Tage vorkommen, und was mit Verkäufen ohne verlässlichen
 * Zeitpunkt passiert.
 *
 * **Immer Tage, nie Wochen.** Der Tag ist die atomare Wahrheit; verdichtet wird
 * erst bei der Anzeige, wenn das gewählte Fenster zu viele Säulen ergäbe. Würde
 * der Server schon wöchentlich bündeln, zeigte ein Umschalten auf „7 Tage" zwei
 * Wochensäulen — die Interaktion würde die Daten verfälschen.
 */

export type Tageswert = {
  /** ISO-Datum, die stabile Kennung. */
  tag: string;
  shopCents: number;
  ebayCents: number;
  shopStueck: number;
  ebayStueck: number;
};

export type Tagesreihe = {
  tage: Tageswert[];
  /** Verkäufe ohne verwertbaren Zeitpunkt.
   *
   * Sie fallen aus der Reihe und werden **genannt**, nicht stillschweigend
   * geschluckt: Sonst ergäbe die Summe der Säulen weniger als die Kennzahl
   * darüber, und niemand wüsste warum. */
  ohneDatum: number;
};

/** Ab wie vielen Tagen die Anzeige auf Wochen verdichtet.
 *
 * Nicht Geschmack, sondern Lesbarkeit: 90 Säulen in einem Panel von rund 500
 * Pixeln wären unter zwei Pixel je Säule, während die Markenregel eine sichtbare
 * Breite verlangt. Der Wert wird ins Dokument übergeben, damit die Schwelle
 * genau einmal existiert.
 */
export const MAX_TAGES_SAEULEN = 31;

function istEndlicheZahl(wert: unknown): wert is number {
  return typeof wert === "number" && Number.isFinite(wert);
}

const ZWEISTELLIG = (zahl: number) => String(zahl).padStart(2, "0");

function tagesAnfang(datum: Date): Date {
  return new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
}

function isoTag(datum: Date): string {
  return `${datum.getUTCFullYear()}-${ZWEISTELLIG(datum.getUTCMonth() + 1)}-${ZWEISTELLIG(datum.getUTCDate())}`;
}

/**
 * Baut die Tagesreihe für das Diagramm.
 *
 * **Lückenlos, auch wo nichts verkauft wurde.** Ein Tag ohne Verkauf ist eine
 * Aussage und erscheint als Nullsäule. Würden nur Tage mit Verkäufen gezeichnet,
 * stünden zwei Säulen mit drei Wochen Abstand nebeneinander und der Verlauf wäre
 * frei erfunden.
 *
 * `jetzt` ist einsetzbar, damit die Reihe testbar ist, ohne von der Uhr des
 * Testlaufs abzuhängen.
 */
export function baueTagesreihe(
  daten: AssistantToolDataMap["sales_overview"],
  jetzt: Date = new Date(),
): Tagesreihe {
  const seit = tagesAnfang(new Date(daten.since));
  const bis = tagesAnfang(jetzt);
  const tage = new Map<string, Tageswert>();

  for (const lauf = new Date(seit); lauf <= bis; lauf.setUTCDate(lauf.getUTCDate() + 1)) {
    const tag = isoTag(lauf);
    tage.set(tag, { tag, shopCents: 0, ebayCents: 0, shopStueck: 0, ebayStueck: 0 });
  }

  let ohneDatum = 0;
  for (const verkauf of daten.sales) {
    const zeitpunkt = verkauf.soldAt ? new Date(verkauf.soldAt) : null;
    if (!zeitpunkt || Number.isNaN(zeitpunkt.getTime())) {
      ohneDatum += 1;
      continue;
    }

    // Ein Verkauf außerhalb des Fensters gehört nicht in die Reihe; er wurde
    // nicht „verloren", sondern nie angefragt.
    const ziel = tage.get(isoTag(tagesAnfang(zeitpunkt)));
    if (!ziel) continue;

    const stueck = istEndlicheZahl(verkauf.quantity) ? verkauf.quantity : 1;
    const cents = istEndlicheZahl(verkauf.amountCents) ? verkauf.amountCents : 0;
    if (verkauf.channel === "SHOP") {
      ziel.shopCents += cents;
      ziel.shopStueck += stueck;
    } else {
      ziel.ebayCents += cents;
      ziel.ebayStueck += stueck;
    }
  }

  return { tage: [...tage.values()], ohneDatum };
}
