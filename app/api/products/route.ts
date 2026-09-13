import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { ebayListings, inventory, productAssets, products } from "../../../db/schema";
import { istImKatalogSichtbar, verfuegbareMenge } from "../../../lib/catalog-availability";
import { istSportart, sportartName } from "../../../lib/karten-sportart";
import { clampPage, pageCount, toPageSize } from "../../../lib/pagination";

/** The catalogue changes when the eBay sync runs, not between two page views.
 *
 * Search, filters and pagination are deliberately applied before the query
 * leaves D1. The old endpoint loaded every card and made the browser filter
 * and slice it, which made the first response grow with the catalogue and
 * made the checkout unable to find cards outside the first page.
 */
export const CATALOGUE_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=60";

const MAX_ID_LOOKUP = 50;
const MAX_SEARCH_LENGTH = 100;
const MAX_PRICE_CENTS = 10_000_000;
// „manual" ist hier bewusst **keine** Kategorie mehr: Vorverkaufskarten
// erscheinen im Katalog gar nicht, eine Kategorie dafür wäre ein Filter auf
// eine leere Menge. Wer sie will, fragt `origin=MANUAL` — das tut `/vorverkauf`.
const CATEGORIES = ["fixed", "prelisted"] as const;

type Category = (typeof CATEGORIES)[number];

function cleanSearch(value: string | null) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("de-DE")
    // `%` and `_` are LIKE wildcards. They have no useful meaning in the
    // public catalogue search and must not turn a narrow query into a full
    // table scan with surprising matches.
    .replace(/[%_\\]/gu, " ")
    .replace(/\s+/gu, " ")
    .slice(0, MAX_SEARCH_LENGTH);
}

function parsePriceCents(value: string | null) {
  if (value === null || value.trim() === "") return null;
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.min(MAX_PRICE_CENTS, Math.round(amount * 100));
}

function requestedIds(value: string | null) {
  if (!value) return [];
  const ids = [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
  return ids.length <= MAX_ID_LOOKUP && ids.every((id) => /^[a-f0-9]{32}$/iu.test(id)) ? ids : null;
}

/** SQL equivalent of `istImKatalogSichtbar` for the rows that can leave D1.
 *
 * The pure helper remains the final guard while mapping rows. This predicate
 * is what makes the count and the page slice agree: sold cards and auctions
 * are removed before `LIMIT/OFFSET`, rather than after it.
 */
function visibleInSql() {
  // Keep this as one explicit predicate. Drizzle's helpers are excellent for
  // ordinary equality filters, but combining nullable left-join columns with
  // `NOT IN` can make the generated expression disagree with SQLite's NULL
  // semantics. This SQL mirrors the pure helper exactly and is covered by the
  // production smoke test against the live D1 data.
  return sql`(
    (${products.origin} = 'MANUAL'
      AND ${inventory.availableQuantity} > 0
      AND ${inventory.status} NOT IN ('SOLD', 'UNAVAILABLE'))
    OR (${products.origin} = 'EBAY' AND ${products.kind} = 'PRELISTED')
    OR (${products.origin} = 'EBAY'
      AND ${ebayListings.status} = 'ACTIVE'
      AND ${ebayListings.listingType} <> 'AUCTION'
      AND ${ebayListings.quantity} > 0
      AND (${inventory.id} IS NULL OR (
        ${inventory.availableQuantity} > 0
        AND ${inventory.status} NOT IN ('SOLD', 'UNAVAILABLE'))))
  )`;
}

/** Variante und Parallele als **ein** Wert — „Base", „Base Blue & Pink".
 *
 * Zusammengesetzt in SQL statt in zwei Feldern, weil der Vorverkauf beides als
 * eine Auswahl zeigt. Getrennt gespeichert bleibt es trotzdem: Die Mischung ist
 * eine Entscheidung der Anzeige, und aus der zusammengesetzten Zeichenkette
 * ließen sich die Teile nicht verlustfrei zurückgewinnen.
 *
 * `trim` fängt den Fall ohne Parallele ab, sonst hinge dort ein Leerzeichen. */
const variantenAusdruck = sql<string>`trim(coalesce(${products.variant}, '') || ' ' || coalesce(${products.parallel}, ''))`;

/** Merkmale einer Karte, quer zu Set und Variante.
 *
 * **Eigene Schalter, kein Eintrag im Set-Auswahlfeld.** Bis zum 2026-08-20
 * stand „Numbered" als reservierter Wert in der Set-Auswahl. Das war eng: In
 * einem Auswahlfeld schließen sich die Einträge aus, „nummeriert **und** mit
 * Autogramm" ließ sich gar nicht ausdrücken. Als vier unabhängige Schalter
 * lassen sie sich beliebig kombinieren.
 *
 * **Warum eigene Spalten und kein Blick in den Titel:** `title GLOB
 * '*[0-9]/[0-9]*'` traf am 2026-08-20 zweihundertzwölf von zweihundert-
 * dreiundsechzig Karten, weil die Saison `26/27` aussieht wie eine Auflage.
 * Nummeriert sind acht. Ein Filter, der fast alles zeigt, sieht nicht kaputt
 * aus — nur nutzlos.
 */
export const MERKMALE = [
  {
    param: "nummeriert",
    titel: "Numbered",
    bedingung: () => sql`${products.numbering} IS NOT NULL AND ${products.numbering} <> ''`,
  },
  { param: "autogramm", titel: "Autograph", bedingung: () => sql`${products.autograph} = 1` },
  { param: "graded", titel: "Graded", bedingung: () => sql`${products.graded} = 1` },
  { param: "relic", titel: "Relic", bedingung: () => sql`${products.relic} = 1` },
] as const;

function categoryCondition(category: Category) {
  if (category === "prelisted") return and(eq(products.origin, "EBAY"), eq(products.kind, "PRELISTED"));
  return and(eq(products.origin, "EBAY"), ne(products.kind, "PRELISTED"));
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const ids = requestedIds(params.get("ids"));
    if (ids === null) {
      return NextResponse.json({ error: "Ungültige Produktreferenzen." }, { status: 400 });
    }

    const byId = ids.length > 0;
    const pageSize = byId ? ids.length : toPageSize(params.get("pro") ?? params.get("pageSize"));
    const requestedPage = params.get("seite") ?? params.get("page") ?? "1";
    const q = cleanSearch(params.get("q"));
    const category = CATEGORIES.includes(params.get("category") as Category)
      ? params.get("category") as Category
      : null;
    const origin = params.get("origin") === "MANUAL" || params.get("origin") === "EBAY"
      ? params.get("origin") as "MANUAL" | "EBAY"
      : null;
    // Set und Variante des Vorverkaufs. Die Variante trägt die Parallele
    // mit — die Auswahl zeigt „Base Blue & Pink" als einen Eintrag, weil der
    // Betreiber es so wollte; getrennt gespeichert bleibt sie trotzdem.
    const serie = (params.get("serie") ?? "").trim().slice(0, 120);
    const variante = (params.get("variante") ?? "").trim().slice(0, 240);
    // Die Sportart. **Ein unbekannter Wert filtert nicht, statt nichts zu
    // zeigen:** Ein `?sport=Handball` aus einem alten Lesezeichen soll den
    // Katalog nicht auf null Karten schrumpfen lassen, ohne dass erkennbar
    // wäre, warum.
    const sport = istSportart(params.get("sport")) ? params.get("sport")! : null;
    const gewaehlteMerkmale = MERKMALE.filter((merkmal) => params.get(merkmal.param) === "1");
    const minPrice = parsePriceCents(params.get("min"));
    const maxPrice = parsePriceCents(params.get("max"));

    const conditions = [
      eq(products.status, "ACTIVE"),
      visibleInSql(),
    ];
    if (ids.length) conditions.push(inArray(products.id, ids));
    // **Vorverkaufskarten gehören in den Vorverkauf, nicht in den Katalog.**
    // Sie tauchen in Listen nur auf, wenn ausdrücklich `origin=MANUAL` gefragt
    // wird — so wie `/vorverkauf` es tut.
    //
    // Die Ausnahme für `ids` ist **kein Schlupfloch, sondern die Bedingung
    // dafür, dass die Karte überhaupt kaufbar bleibt**: Die Detailseite, der
    // Warenkorb und die Bestellprüfung holen Karten über ihre Kennung. Ohne
    // die Ausnahme wäre eine Vorverkaufskarte zwar im Vorverkauf sichtbar,
    // aber beim Anklicken verschwunden.
    if (!byId && origin !== "MANUAL") conditions.push(ne(products.origin, "MANUAL"));
    if (q) {
      const searchable = sql`lower(coalesce(${products.title}, '') || ' ' || coalesce(${products.description}, '') || ' ' || coalesce(${ebayListings.sku}, ''))`;
      conditions.push(sql`${searchable} LIKE ${`%${q}%`}`);
    }
    if (category) conditions.push(categoryCondition(category)!);
    if (origin) conditions.push(eq(products.origin, origin));
    if (minPrice !== null) {
      const price = sql`coalesce(${ebayListings.priceAmountCents}, ${products.priceAmountCents})`;
      conditions.push(sql`${price} IS NOT NULL AND ${price} >= ${minPrice}`);
    }
    if (maxPrice !== null) {
      const price = sql`coalesce(${ebayListings.priceAmountCents}, ${products.priceAmountCents})`;
      conditions.push(sql`${price} IS NOT NULL AND ${price} <= ${maxPrice}`);
    }

    // **Keine Auswahl darf an ihrem eigenen Filter schrumpfen.** Wer „Nitro
    // Boost" wählt und danach nur noch „Nitro Boost" zur Auswahl hat, kommt
    // ohne Umweg über „alle" nicht mehr heraus. Deshalb drei Zwischenstände:
    // die Setliste zählt ohne Set, Variante und Merkmale; die Variantenliste
    // mit Set, aber ohne Variante und Merkmale; die Zahlen an den Schaltern
    // mit Set und Variante, aber ohne die Schalter.
    // **Die Sportart steht vor der Einordnung, nicht daneben.** Sie ist die
    // gröbste Einteilung des Bestands; Sets, Varianten und Merkmale sollen
    // innerhalb der gewählten Sportart zählen. Umgekehrt zählt die
    // Sportartliste selbst ohne sie — sonst bliebe nach einer Wahl nur noch
    // diese eine Sportart zur Auswahl, und man käme ohne Umweg nicht heraus.
    const ohneSportart = [...conditions];
    if (sport) conditions.push(eq(products.sport, sport));
    const ohneEinordnung = [...conditions];
    if (serie) conditions.push(eq(products.series, serie));
    const ohneVariante = [...conditions];
    if (variante) conditions.push(eq(variantenAusdruck, variante));
    const ohneMerkmale = [...conditions];
    for (const merkmal of gewaehlteMerkmale) conditions.push(merkmal.bedingung());

    const db = getDb();
    const where = and(...conditions);
    const [{ total: rawTotal }] = await db.select({ total: sql<number>`count(*)` })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(where);
    const total = Number(rawTotal ?? 0);
    const totalPages = pageCount(total, pageSize);
    const page = byId ? 1 : clampPage(requestedPage, total, pageSize);

    const rows = await db.select({ product: products, listing: ebayListings, stock: inventory })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(where)
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(pageSize)
      .offset(byId ? 0 : (page - 1) * pageSize);

    const productIds = rows.map((row) => row.product.id);
    const assets = productIds.length
      ? await db.select({ productId: productAssets.productId, sourceUrl: productAssets.sourceUrl })
        .from(productAssets)
        .where(inArray(productAssets.productId, productIds))
        .orderBy(asc(productAssets.sortOrder))
      : [];
    const assetsByProduct = new Map<string, string[]>();
    for (const asset of assets) {
      if (!asset.sourceUrl) continue;
      const list = assetsByProduct.get(asset.productId) ?? [];
      list.push(asset.sourceUrl);
      assetsByProduct.set(asset.productId, list);
    }

    const result = rows.flatMap((row) => {
      const manuell = row.product.origin === "MANUAL";
      if (!istImKatalogSichtbar(row.product.kind, row.listing?.listingType, row.listing?.quantity, row.stock, row.product.origin)) return [];
      return [{
        id: row.product.id,
        title: row.product.title,
        description: row.product.description,
        category: manuell ? "Direkt bei uns" as const : row.product.kind === "PRELISTED" ? "Vormerkliste" as const : "Festpreis" as const,
        // A manually entered pre-sale card has no fixed price. Its amount is
        // created only by an accepted offer and resolved again at checkout.
        priceAmountCents: manuell ? null : row.listing?.priceAmountCents ?? null,
        priceCurrency: manuell ? row.product.priceCurrency : row.listing?.priceCurrency ?? "EUR",
        quantity: manuell
          ? verfuegbareMenge(null, row.stock, "MANUAL")
          : row.product.kind === "PRELISTED" ? 0 : verfuegbareMenge(row.listing?.quantity, row.stock),
        listingUrl: row.listing?.listingUrl ?? null,
        imageUrls: assetsByProduct.get(row.product.id) ?? [],
        origin: row.product.origin,
      }];
    });

    // Nur auf Anfrage. **Nicht mehr nur für den Vorverkauf:** Der Katalog
    // braucht seit dem 2026-08-20 dieselben vier Schalter. Set- und
    // Variantenliste kommen dort von allein leer zurück — eBay-Karten tragen
    // keine gepflegte Einordnung —, und die Oberfläche blendet leere Listen
    // ohnehin aus.
    const facetten = params.get("facetten") === "1"
      ? await ladeFacetten(db, ohneSportart, ohneEinordnung, ohneVariante, ohneMerkmale)
      : null;

    const headers = { "cache-control": byId ? "no-store" : CATALOGUE_CACHE_CONTROL };
    return NextResponse.json({
      products: result,
      ...(facetten ? { facetten } : {}),
      page,
      pageSize,
      total,
      totalPages,
      first: result.length ? (page - 1) * pageSize + 1 : 0,
      last: result.length ? (page - 1) * pageSize + result.length : 0,
    }, { headers });
  } catch (error) {
    console.error("public product query failed", error);
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

/** Die Auswahllisten: Sportarten, Sets und, im gewählten Set, Varianten.
 *
 * Alle zählen mit, wie viele Karten dahinterstehen — eine Auswahl, die zu
 * null Treffern führt, soll gar nicht erst angeboten werden.
 *
 * **Jede Liste zählt ohne ihren eigenen Filter und ohne die feineren
 * darunter**, sonst schrumpfte sie auf die getroffene Wahl zusammen und man
 * käme ohne Umweg über „alle" nicht mehr heraus. Die Reihenfolge von grob nach
 * fein: Sportart, Set, Variante, Merkmale.
 */
async function ladeFacetten(
  db: ReturnType<typeof getDb>,
  ohneSportart: Parameters<typeof and>,
  basis: Parameters<typeof and>,
  mitSet: Parameters<typeof and>,
  mitVariante: Parameters<typeof and>,
) {
  // Dieselben Verbünde wie die Hauptabfrage: `visibleInSql()` in `basis` greift
  // auf `ebay_listings` und `inventory` zu. Ohne sie liefe die Bedingung ins
  // Leere und die Zahlen stimmten nicht mit der Liste überein.
  const [sportarten, serien, varianten, merkmale] = await Promise.all([
    // **Nur die Sportarten, die es wirklich gibt.** Anders als bei den vier
    // Merkmalen ist hier keine feste Reihe gewollt: Eine Auswahl mit
    // „Baseball (0)" und „Eishockey (0)" verspricht ein Sortiment, das der
    // Laden nicht führt. Die Merkmale sind vier Schalter, die springen würden;
    // eine Auswahlliste springt nicht.
    db.select({ name: products.sport, anzahl: sql<number>`count(*)` })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(and(...ohneSportart))
      .groupBy(products.sport)
      .orderBy(desc(sql`count(*)`), asc(products.sport)),
    db.select({ name: products.series, anzahl: sql<number>`count(*)` })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(and(...basis, sql`${products.series} IS NOT NULL AND ${products.series} <> ''`))
      .groupBy(products.series)
      .orderBy(asc(products.series)),
    db.select({ name: variantenAusdruck, anzahl: sql<number>`count(*)` })
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(and(...mitSet, sql`${variantenAusdruck} <> ''`))
      .groupBy(variantenAusdruck)
      .orderBy(asc(variantenAusdruck)),
    // Eine Zeile mit einer Spalte je Merkmal statt einer Abfrage je Merkmal:
    // vier weitere Rundgänge zur Datenbank für vier Zahlen wären verschwendet.
    db.select(Object.fromEntries(MERKMALE.map((merkmal) =>
      [merkmal.param, sql<number>`sum(case when ${merkmal.bedingung()} then 1 else 0 end)`],
    )) as Record<string, ReturnType<typeof sql<number>>>)
      .from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(and(...mitVariante)),
  ]);

  const zahlen = merkmale[0] as Record<string, number> | undefined;
  return {
    // Der Anzeigename kommt aus der Anwendung, nicht aus der Datenbank: In der
    // Spalte steht `AMERICAN_FOOTBALL`, in der Auswahl soll „American Football"
    // stehen. Ein Wert, den `SPORTARTEN` nicht kennt, behält seinen rohen
    // Namen — sichtbar und zuordenbar ist besser als unsichtbar.
    sportarten: sportarten
      .filter((zeile) => zeile.name)
      .map((zeile) => ({ wert: zeile.name, name: sportartName(zeile.name), anzahl: Number(zeile.anzahl) })),
    serien: serien.map((zeile) => ({ name: zeile.name ?? "", anzahl: Number(zeile.anzahl) })),
    varianten: varianten.map((zeile) => ({ name: zeile.name, anzahl: Number(zeile.anzahl) })),
    // **Alle vier, auch die mit null Treffern.** Anders als bei den
    // Auswahllisten ist hier eine feste Reihe gewollt: Vier Schalter, die je
    // nach Bestand auftauchen und verschwinden, ließen die Leiste springen und
    // die Frage offen, ob es die Sorte überhaupt gibt. Die Null steht dabei,
    // und der Schalter ist dann nicht bedienbar.
    merkmale: MERKMALE.map((merkmal) => ({
      param: merkmal.param,
      name: merkmal.titel,
      anzahl: Number(zahlen?.[merkmal.param] ?? 0),
    })),
  };
}
