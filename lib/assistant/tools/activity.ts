import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { avatarEvents, ebayListings, ebaySales, inquiries, orders, priceOffers, products } from "../../../db/schema";
import {
  ACTIVITY_DIGEST_DEFAULT_HOURS,
  availableAssistantResult,
  type AssistantActivityEntry,
  type AssistantToolInput,
  type AssistantToolResult,
} from "../contracts";
import { assistantTimestamp } from "../time";

/** Was in den letzten Stunden passiert ist.
 *
 * **Der Anlass, wörtlich.** Der Betreiber am 2026-08-18: „ich kann nicht fragen,
 * was in der X letzten Stunde so passiert ist. Ich hätte gerne ein Update zu
 * allem, was in dem Zeitraum passiert ist."
 *
 * **Warum nicht `avatar_events` allein**, obwohl es die naheliegende Quelle
 * wäre: Diese Tabelle kennt genau vier Ereignisarten (Vorschlag eingegangen,
 * angenommen, abgelehnt, Karte verkauft). Ein Überblick daraus verschwiege neue
 * Bestellungen, neue Anfragen und neu eingestellte Karten — und zwar
 * stillschweigend, was hier die schlechteste aller Eigenschaften ist. Gelesen
 * werden deshalb die Fachtabellen mit Zeitfenster; `avatar_events` liefert nur
 * das, was sonst nirgends steht.
 *
 * **„Nichts passiert" darf hier gesagt werden**, anders als bei den
 * Aufrufzahlen. Diese Tabellen sind vollständig und haben keinen Messbeginn,
 * hinter dem sich etwas verstecken könnte: Ein leeres Fenster ist wirklich leer,
 * nicht bloß unbeobachtet.
 */
export async function getActivityDigest(input: AssistantToolInput): Promise<AssistantToolResult<"activity_digest">> {
  const db = getDb();
  const stunden = input.stunden ?? ACTIVITY_DIGEST_DEFAULT_HOURS;
  const seit = new Date(Date.now() - stunden * 3_600_000).toISOString();

  // **`datetime(...)` auf beiden Seiten.** Die Zeitstempel liegen als Text in
  // D1; ein Zeichenkettenvergleich stimmt nur, solange jede Zeile dieselbe
  // Schreibweise trägt. Genau darauf verlässt sich der Rest dieses Verzeichnisses
  // ebenfalls, und aus demselben Grund.
  const imFenster = (spalte: unknown) => gte(sql`datetime(${spalte})`, sql`datetime(${seit})`);

  const [shopBestellungen, ebayVerkaeufe, vorschlaege, anfragen, eingestellt, ereignisse] = await Promise.all([
    db.select({
      orderNumber: orders.orderNumber,
      totalAmountCents: orders.totalAmountCents,
      currency: orders.currency,
      createdAt: orders.createdAt,
    }).from(orders).where(imFenster(orders.createdAt)).orderBy(desc(sql`datetime(${orders.createdAt})`)),

    db.select({
      title: ebaySales.title,
      amountCents: ebaySales.amountCents,
      currency: ebaySales.currency,
      soldAt: ebaySales.soldAt,
    }).from(ebaySales).where(imFenster(ebaySales.soldAt)).orderBy(desc(sql`datetime(${ebaySales.soldAt})`)),

    db.select({
      title: products.title,
      proposedAmountCents: priceOffers.proposedAmountCents,
      currency: priceOffers.currency,
      createdAt: priceOffers.createdAt,
    }).from(priceOffers)
      .leftJoin(products, eq(products.id, priceOffers.productId))
      .where(imFenster(priceOffers.createdAt))
      .orderBy(desc(sql`datetime(${priceOffers.createdAt})`)),

    db.select({
      title: products.title,
      createdAt: inquiries.createdAt,
    }).from(inquiries)
      .leftJoin(products, eq(products.id, inquiries.productId))
      .where(imFenster(inquiries.createdAt))
      .orderBy(desc(sql`datetime(${inquiries.createdAt})`)),

    db.select({
      title: products.title,
      priceAmountCents: sql<number | null>`coalesce(${ebayListings.priceAmountCents}, ${products.priceAmountCents})`,
      currency: products.priceCurrency,
      createdAt: products.createdAt,
    }).from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .where(imFenster(products.createdAt))
      .orderBy(desc(sql`datetime(${products.createdAt})`)),

    // Nur die beiden Arten, die sonst nirgends stehen. `CARD_SOLD` und
    // `OFFER_RECEIVED` kämen über `ebay_sales` und `price_offers` doppelt.
    db.select({
      eventType: avatarEvents.eventType,
      aggregateId: avatarEvents.aggregateId,
      createdAt: avatarEvents.createdAt,
    }).from(avatarEvents)
      .where(and(
        imFenster(avatarEvents.createdAt),
        sql`${avatarEvents.eventType} IN ('OFFER_ACCEPTED', 'OFFER_REJECTED')`,
      ))
      .orderBy(desc(sql`datetime(${avatarEvents.createdAt})`)),
  ]);

  const eintraege: AssistantActivityEntry[] = [
    ...shopBestellungen.map((zeile): AssistantActivityEntry => ({
      art: "SHOP_BESTELLUNG",
      bezeichnung: zeile.orderNumber,
      betragCents: zeile.totalAmountCents,
      currency: zeile.currency,
      zeitpunkt: assistantTimestamp(zeile.createdAt),
    })),
    ...ebayVerkaeufe.map((zeile): AssistantActivityEntry => ({
      art: "EBAY_VERKAUF",
      // Ein eBay-Posten ohne Titel ist ein bekannter Fall; „unbenannte Karte"
      // sagt das, statt eine Bezeichnung zu erfinden.
      bezeichnung: zeile.title ?? "unbenannte Karte",
      betragCents: zeile.amountCents,
      currency: zeile.currency,
      zeitpunkt: assistantTimestamp(zeile.soldAt),
    })),
    ...vorschlaege.map((zeile): AssistantActivityEntry => ({
      art: "SHOP_PREISVORSCHLAG",
      bezeichnung: zeile.title ?? "unbekannte Karte",
      betragCents: zeile.proposedAmountCents,
      currency: zeile.currency,
      zeitpunkt: assistantTimestamp(zeile.createdAt),
    })),
    ...anfragen.map((zeile): AssistantActivityEntry => ({
      art: "SHOP_ANFRAGE",
      bezeichnung: zeile.title ?? "ohne Kartenbezug",
      betragCents: null,
      currency: "EUR",
      zeitpunkt: assistantTimestamp(zeile.createdAt),
    })),
    ...eingestellt.map((zeile): AssistantActivityEntry => ({
      art: "KARTE_EINGESTELLT",
      bezeichnung: zeile.title,
      betragCents: zeile.priceAmountCents,
      currency: zeile.currency,
      zeitpunkt: assistantTimestamp(zeile.createdAt),
    })),
    ...ereignisse.map((zeile): AssistantActivityEntry => ({
      art: zeile.eventType === "OFFER_ACCEPTED" ? "VORSCHLAG_ANGENOMMEN" : "VORSCHLAG_ABGELEHNT",
      bezeichnung: zeile.aggregateId,
      betragCents: null,
      currency: "EUR",
      zeitpunkt: assistantTimestamp(zeile.createdAt),
    })),
  ];

  // **Über alle Arten hinweg neu zuerst.** Ein Bericht, der nach Tabellen
  // gruppiert, verlangt vom Leser das Zusammensortieren im Kopf — und genau das
  // ist die Frage: *was* ist passiert, in welcher Reihenfolge.
  eintraege.sort((a, b) => (b.zeitpunkt ?? "").localeCompare(a.zeitpunkt ?? ""));

  return availableAssistantResult("activity_digest", {
    stunden,
    seit,
    eintraege: eintraege.slice(0, input.limit),
    gesamtAnzahl: eintraege.length,
    leer: eintraege.length === 0,
  }, ["SHOP_DB", "EBAY_CACHE"], eintraege[0]?.zeitpunkt ?? null);
}
