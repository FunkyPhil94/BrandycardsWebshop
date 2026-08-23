import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ebayListings, inventory, products } from "../../../db/schema";
import { istImKatalogSichtbar } from "../../catalog-availability";
import { alsSuchmuster, availableAssistantResult, type AssistantToolDataMap, type AssistantToolInput, type AssistantToolResult } from "../contracts";
import { assistantTimestamp } from "../time";

/** Durchsucht die angebotenen Karten nach ihrem Titel.
 *
 * **Der Anlass, wörtlich.** Der Betreiber fragte am 2026-08-18 „habe ich eine
 * Karte von Lewandowski?" und bekam eine Absage. Seine Erwartung: K.A.R.L.
 * kennt die Karten, die im Shop angeboten werden. Sie war berechtigt — es gab
 * kein Werkzeug dafür.
 *
 * **Was „angeboten" heißt, entscheidet nicht diese Datei.** Die Regel steht in
 * {@link istImKatalogSichtbar} und ist die schwierige: Vormerkungen ohne
 * Bestand bleiben sichtbar, Auktionen nie, manuelle Karten hängen am Bestand,
 * und `origin` wird vor `kind` gefragt. Eine zweite Fassung hier würde
 * auseinanderlaufen, und dann sagt der Assistent etwas anderes als die Seite,
 * auf die der Betreiber schaut. Vorgefiltert wird in SQL nur, was billig und
 * unstrittig ist; **die Entscheidung fällt an der reinen Funktion.**
 */
export async function searchCards(input: AssistantToolInput): Promise<AssistantToolResult<"card_search">> {
  // Ohne Suchbegriff gäbe es nichts zu suchen. Der Planer setzt ihn immer; das
  // hier ist die Zusicherung für jeden anderen Aufrufer.
  const suche = input.suche ?? "";
  if (suche.length === 0) {
    return availableAssistantResult("card_search", {
      suche, angeboten: [], nichtAngebotenAnzahl: 0, gekuerzt: false,
    }, ["SHOP_DB"]);
  }

  const muster = alsSuchmuster(suche);
  // **Titel *und* Beschreibung**, auf ausdrücklichen Wunsch des Betreibers vom
  // 2026-08-18, nachdem die Unschärfe benannt war: Eine Beschreibung nennt
  // Serie, Verein und Zustand, manchmal auch Spieler, die im Titel keinen Platz
  // hatten. Der Preis dafür sind weichere Treffer — „Barcelona" findet auch
  // Karten, in deren Beschreibung der Verein nur als Vergleich vorkommt.
  //
  // `coalesce`, weil `description` nullbar ist: Ohne sie wäre die ganze
  // Verkettung `NULL` und die Zeile fiele stillschweigend aus jedem Treffer.
  const durchsucht = sql`lower(${products.title} || ' ' || coalesce(${products.description}, ''))`;
  // **`ESCAPE` gehört dazu, nicht dahinter.** `alsSuchmuster` setzt Rückstriche
  // vor `%` und `_`; ohne diese Klausel wäre der Rückstrich für SQLite ein
  // gewöhnliches Zeichen und die Entwertung wirkungslos.
  const treffer = await getDb().select({
    productId: products.id,
    title: products.title,
    kind: products.kind,
    origin: products.origin,
    status: products.status,
    productPriceAmountCents: products.priceAmountCents,
    productPriceCurrency: products.priceCurrency,
    listingType: ebayListings.listingType,
    listingQuantity: ebayListings.quantity,
    listingPriceAmountCents: ebayListings.priceAmountCents,
    listingPriceCurrency: ebayListings.priceCurrency,
    lastSyncedAt: ebayListings.lastSyncedAt,
    inventoryId: inventory.id,
    availableQuantity: inventory.availableQuantity,
    inventoryStatus: inventory.status,
  }).from(products)
    .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
    .leftJoin(inventory, eq(inventory.productId, products.id))
    .where(and(
      eq(products.status, "ACTIVE"),
      sql`${durchsucht} LIKE ${muster} ESCAPE '\\'`,
    ))
    .orderBy(products.title);

  // **Der zweite Zweig zählt, was es *nicht* mehr gibt.** Produktiv trifft
  // „Lewandowski" zwei Karten: eine aktive und eine mit beendetem Listing. Ohne
  // diese Zahl klingt die Antwort wie „du hast genau eine" — und der Betreiber,
  // der zwei im Kopf hat, hält den Assistenten für kaputt. Gezählt statt
  // genannt: Historie soll die Antwort nicht fluten.
  const [{ anzahl: gesamtTreffer } = { anzahl: 0 }] = await getDb()
    .select({ anzahl: sql<number>`count(*)`.mapWith(Number) })
    .from(products)
    .where(sql`${durchsucht} LIKE ${muster} ESCAPE '\\'`);

  const angeboten: AssistantToolDataMap["card_search"]["angeboten"] = [];
  for (const zeile of treffer) {
    // **`null`, wenn es keine Bestandszeile gibt** — nicht `{ menge: 0 }`. Der
    // Unterschied ist der ganze Sinn von `verfuegbareMenge`: Eine eBay-Karte
    // ohne eigene Bestandsführung fällt auf die Listingmenge zurück, eine
    // manuelle Karte ohne Bestandszeile gilt als nicht vorhanden. Eine
    // erfundene Nullzeile hätte beides falsch entschieden.
    const bestand = zeile.inventoryId === null || zeile.availableQuantity === null
      ? null
      : { availableQuantity: zeile.availableQuantity, status: zeile.inventoryStatus ?? "" };
    if (!istImKatalogSichtbar(zeile.kind, zeile.listingType, zeile.listingQuantity, bestand, zeile.origin)) continue;

    angeboten.push({
      productId: zeile.productId,
      title: zeile.title,
      // Manuelle Karten sind der Vorverkauf. Der Bereich gehört in die Antwort:
      // Sie sind angeboten, aber nicht auf demselben Weg zu haben wie eine
      // eBay-Karte, und der Betreiber sucht sie an einer anderen Stelle.
      bereich: zeile.origin === "MANUAL" ? "VORVERKAUF" : "KATALOG",
      priceAmountCents: zeile.listingPriceAmountCents ?? zeile.productPriceAmountCents,
      priceCurrency: zeile.listingPriceCurrency ?? zeile.productPriceCurrency,
      menge: zeile.listingQuantity ?? zeile.availableQuantity ?? null,
    });
  }

  const gezeigt = angeboten.slice(0, input.limit);
  const freshness = treffer
    .map((zeile) => assistantTimestamp(zeile.lastSyncedAt))
    .filter((wert): wert is string => Boolean(wert))
    .sort()
    .at(-1) ?? null;

  return availableAssistantResult("card_search", {
    suche,
    angeboten: gezeigt,
    // Nicht angeboten ist alles, was der Titel trifft, minus das, was angeboten
    // ist — **nicht** minus das, was gezeigt wird. Sonst wüchse die Zahl, sobald
    // die Liste gekürzt wird, und behauptete verschwundene Karten.
    nichtAngebotenAnzahl: Math.max(0, gesamtTreffer - angeboten.length),
    gekuerzt: angeboten.length > gezeigt.length,
  }, ["SHOP_DB", "EBAY_CACHE"], freshness);
}
