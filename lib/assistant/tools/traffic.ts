import { and, gte, lt, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ebayListingTraffic, ebayListingTrafficDaily, pageViewArchive, pageViews } from "../../../db/schema";
import { readEbayReadSyncStates } from "../../ebay-read-sync";
import { ebayReadAvailability } from "../ebay-availability";
import {
  availableAssistantResult,
  boundedOverviewDays,
  SALES_OVERVIEW_DEFAULT_DAYS,
  type AssistantToolInput,
  type AssistantToolResult,
} from "../contracts";

/** Wie viele Bereiche einzeln genannt werden. Mehr wäre eine Liste, keine
 *  Auskunft — die vollständige Aufschlüsselung steht im Adminbereich. */
const MAX_SEITEN = 6;

/** Aufrufe: der eigene Shop und die eBay-Angebote, **getrennt** ausgewiesen.
 *
 * **Warum getrennt und niemals addiert.** Das sind zwei verschiedene Orte. Ein
 * Aufruf auf `shop.brandycards.de/karten` und ein Aufruf eines eBay-Angebots
 * haben nichts miteinander zu tun; eine Summe daraus benennt nichts. Wer nach
 * „den Aufrufen" fragt, meint fast immer eines von beiden — genannt werden
 * deshalb beide, aber als zwei Zahlen.
 *
 * **Die beiden Hälften sind unterschiedlich gut.**
 *
 * Der Shop wird selbst gezählt: exakt, je Stunde, für beliebige Zeiträume, und
 * `gesamt` stimmt auch nach der Aufbewahrungsfrist, weil ablaufende Eimer ins
 * Archiv summiert werden.
 *
 * Bei eBay gibt es kein `gesamt` und kann es keines geben — geliefert wird ein
 * rollendes 30-Tage-Fenster, und die eigene Tageshistorie beginnt erst am
 * 2026-08-14. Ein aus Fensterständen zusammengerechnetes „insgesamt" wäre
 * Erfindung, nicht Messung.
 *
 * **`messungSeit` ist kein Beiwerk.** Solange die Messung jünger ist als das
 * erfragte Fenster, ist die Zahl kein Monatswert, sondern alles, was es
 * überhaupt gibt. Ohne die Angabe liest sich „30 Tage: 40" als schwacher Monat
 * statt als junger Zähler.
 */
export async function getTrafficOverview(
  input: Pick<AssistantToolInput<"traffic_overview">, "days" | "bis">,
  now: Date = new Date(),
): Promise<AssistantToolResult<"traffic_overview">> {
  const db = getDb();
  const days = boundedOverviewDays(input.days ?? SALES_OVERVIEW_DEFAULT_DAYS);
  // Dieselbe Fensterrechnung wie in der Verkaufsübersicht, damit „letzte 7
  // Tage" in beiden Antworten denselben Zeitraum meint.
  const ende = input.bis
    ? new Date(Math.min(new Date(`${input.bis}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000, now.getTime()))
    : now;
  const since = new Date(ende.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const until = ende.toISOString();
  // Die Tageshistorie führt den Tag als `JJJJMMTT`, ohne Trenner.
  const tagVon = since.slice(0, 10).replaceAll("-", "");
  const tagBis = until.slice(0, 10).replaceAll("-", "");

  const [seitenRows, [archiv], [laufend], [erster], [rollend], [historie], syncStates] = await Promise.all([
    db.select({
      pfad: pageViews.path,
      aufrufe: sql<number>`coalesce(sum(${pageViews.viewCount}), 0)`,
    }).from(pageViews)
      .where(and(gte(pageViews.bucketStart, since), lt(pageViews.bucketStart, until)))
      .groupBy(pageViews.path),
    // Der Gesamtstand steht in **zwei** Tabellen. Ohne das Archiv wäre
    // „insgesamt" in Wahrheit „letzte 90 Tage" und schrumpfte ab Tag 91.
    db.select({ summe: sql<number>`coalesce(sum(${pageViewArchive.viewCount}), 0)` }).from(pageViewArchive),
    db.select({ summe: sql<number>`coalesce(sum(${pageViews.viewCount}), 0)` }).from(pageViews),
    db.select({ erster: sql<string | null>`min(${pageViews.bucketStart})` }).from(pageViews),
    db.select({
      aufrufe: sql<number>`coalesce(sum(${ebayListingTraffic.viewsTotal}), 0)`,
      einblendungen: sql<number>`coalesce(sum(${ebayListingTraffic.impressionsTotal}), 0)`,
    }).from(ebayListingTraffic),
    db.select({
      aufrufe: sql<number>`coalesce(sum(case when ${ebayListingTrafficDaily.day} >= ${tagVon} and ${ebayListingTrafficDaily.day} <= ${tagBis} then ${ebayListingTrafficDaily.viewsTotal} else 0 end), 0)`,
      erster: sql<string | null>`min(${ebayListingTrafficDaily.day})`,
    }).from(ebayListingTrafficDaily),
    readEbayReadSyncStates(db),
  ]);

  const seiten = seitenRows
    .map((zeile) => ({ pfad: zeile.pfad, aufrufe: Number(zeile.aufrufe) }))
    .filter((zeile) => zeile.aufrufe > 0)
    .sort((a, b) => b.aufrufe - a.aufrufe || a.pfad.localeCompare(b.pfad));

  const availability = ebayReadAvailability(syncStates.get("TRAFFIC"), "Aufrufzahlen");
  // `JJJJMMTT` zurück in ein lesbares Datum — sonst stünde „20260814" in der
  // Antwort.
  const historieSeit = historie?.erster
    ? `${historie.erster.slice(0, 4)}-${historie.erster.slice(4, 6)}-${historie.erster.slice(6, 8)}`
    : null;

  return availableAssistantResult("traffic_overview", {
    days,
    since,
    until,
    spanneGenannt: input.bis !== undefined,
    shop: {
      fenster: seiten.reduce((summe, zeile) => summe + zeile.aufrufe, 0),
      gesamt: Number(archiv?.summe ?? 0) + Number(laufend?.summe ?? 0),
      messungSeit: erster?.erster ?? null,
      seiten: seiten.slice(0, MAX_SEITEN),
    },
    ebay: availability.available
      ? {
          available: true,
          unavailableCode: null,
          unavailableMessage: null,
          rollendeAufrufe: Number(rollend?.aufrufe ?? 0),
          rollendeEinblendungen: Number(rollend?.einblendungen ?? 0),
          fensterAufrufe: Number(historie?.aufrufe ?? 0),
          historieSeit,
          gesamtVerfuegbar: false,
        }
      : {
          available: false,
          unavailableCode: availability.code,
          unavailableMessage: availability.message,
          rollendeAufrufe: null,
          rollendeEinblendungen: null,
          fensterAufrufe: null,
          historieSeit,
          gesamtVerfuegbar: false,
        },
  }, availability.available ? ["SHOP_DB", "EBAY_READ_API"] : ["SHOP_DB"], availability.available ? availability.freshness : null);
}
