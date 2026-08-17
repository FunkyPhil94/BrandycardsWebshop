import type { AssistantToolDataMap } from "./contracts.ts";

/** Die Tagesreihe für das Diagramm.
 *
 * **Seit dem 2026-08-17 rechnet dieses Modul nicht mehr selbst.** Es verdichtete
 * `sales` auf Tage — und `sales` ist auf `limit` gekürzt, höchstens zwanzig
 * Einträge, während die Leitzahl darüber alle meint. Die Säulen wären
 * stillschweigend zu niedrig gewesen. Das Werkzeug liefert die Verdichtung jetzt
 * vollständig mit; hier wird sie nur noch übernommen.
 */

export type Tageswert = {
  tag: string;
  shopCents: number;
  ebayCents: number;
  shopStueck: number;
  ebayStueck: number;
};

export type Tagesreihe = {
  tage: Tageswert[];
  /** Verkäufe ohne verwertbaren Zeitpunkt — genannt, nicht verschluckt: Sonst
   *  ergäbe die Summe der Säulen weniger als die Kennzahl darüber. */
  ohneDatum: number;
};

/** Ab wie vielen Tagen die Anzeige auf Wochen verdichtet.
 *
 * Nicht Geschmack, sondern Lesbarkeit: 90 Säulen in einem Bild von 520 Punkten
 * Breite wären unter zwei Punkte je Säule, während die Markenregel eine
 * sichtbare Breite verlangt.
 */
export const MAX_TAGES_SAEULEN = 31;

export function baueTagesreihe(daten: AssistantToolDataMap["sales_overview"]): Tagesreihe {
  return {
    tage: (daten.dailySeries ?? []).map((eintrag) => ({
      tag: eintrag.day,
      shopCents: eintrag.shopCents,
      ebayCents: eintrag.ebayCents,
      shopStueck: eintrag.shopItems,
      ebayStueck: eintrag.ebayItems,
    })),
    ohneDatum: daten.ohneDatum ?? 0,
  };
}

/** Verdichtet **alle** Verkäufe des Fensters auf Tagessummen.
 *
 * **Warum nicht aus `sales`.** Jene Liste ist auf `limit` gekürzt; ein Diagramm
 * daraus zeigte bei 161 Verkäufen zwanzig und stünde unter einer Leitzahl, die
 * alle meint. Diese Reihe ist vollständig und dennoch klein: höchstens ein
 * Eintrag je Tag.
 *
 * **Lückenlos ab `since`**, auch wo nichts verkauft wurde — ein Tag ohne
 * Verkauf ist eine Aussage. Verkäufe ohne verwertbaren Zeitpunkt werden
 * gezählt, nicht verschluckt: Sonst ergäbe die Summe der Tage weniger als der
 * Gesamtumsatz, und niemand wüsste warum.
 */
export function verdichteAufTage(
  verkaeufe: Array<{ channel: "SHOP" | "EBAY"; quantity: number; amountCents: number | null; soldAt: string | null }>,
  since: string,
  jetzt: Date,
) {
  const tagesAnfang = (datum: Date) => new Date(Date.UTC(datum.getUTCFullYear(), datum.getUTCMonth(), datum.getUTCDate()));
  const iso = (datum: Date) => datum.toISOString().slice(0, 10);

  const tage = new Map<string, { day: string; shopCents: number; ebayCents: number; shopItems: number; ebayItems: number }>();
  const bis = tagesAnfang(jetzt);
  for (const lauf = tagesAnfang(new Date(since)); lauf <= bis; lauf.setUTCDate(lauf.getUTCDate() + 1)) {
    tage.set(iso(lauf), { day: iso(lauf), shopCents: 0, ebayCents: 0, shopItems: 0, ebayItems: 0 });
  }

  let ohneDatum = 0;
  for (const verkauf of verkaeufe) {
    const zeitpunkt = verkauf.soldAt ? new Date(verkauf.soldAt) : null;
    if (!zeitpunkt || Number.isNaN(zeitpunkt.getTime())) {
      ohneDatum += 1;
      continue;
    }
    const ziel = tage.get(iso(tagesAnfang(zeitpunkt)));
    if (!ziel) continue;
    const stueck = Number.isFinite(verkauf.quantity) ? verkauf.quantity : 1;
    const cents = Number.isFinite(verkauf.amountCents ?? NaN) ? (verkauf.amountCents as number) : 0;
    if (verkauf.channel === "SHOP") {
      ziel.shopCents += cents;
      ziel.shopItems += stueck;
    } else {
      ziel.ebayCents += cents;
      ziel.ebayItems += stueck;
    }
  }

  return { dailySeries: [...tage.values()], ohneDatum };
}
