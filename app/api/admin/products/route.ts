import { and, desc, eq, like, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { ebayListings, inventory, products } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin-access";
import { HANDFELDER, handfelder, type Handfeld } from "../../../../lib/manual-overrides";

const PAGE_SIZE = 30;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 4000;
/** 100 000 Cent = 1000 €. Keine technische Grenze, sondern eine Bremse gegen
 *  den verrutschten Dezimalpunkt: 1500 statt 15,00 ist der teure Tippfehler. */
const MAX_PRICE_CENTS = 100_000;
const MAX_QUANTITY = 99;

function text(wert: unknown, maxLaenge: number): string | null {
  if (typeof wert !== "string") return null;
  const sauber = wert.trim();
  return sauber.length === 0 || sauber.length > maxLaenge ? null : sauber;
}

function cents(wert: unknown): number | null {
  if (typeof wert !== "number" || !Number.isInteger(wert) || wert < 1 || wert > MAX_PRICE_CENTS) return null;
  return wert;
}

/** Alle Karten für die Adminliste — eBay-Karten und manuelle nebeneinander.
 *
 * Bewusst beide Sorten in einer Liste: Der Betreiber sucht eine Karte, nicht
 * einen Bezugsweg. Woher sie stammt, steht als Ausweis daneben. */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const db = getDb();
    const suche = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    // `like` mit führendem Platzhalter kann keinen Index nutzen. Bei ~550
    // Karten ist ein voller Durchlauf billiger als jede Zusatzstruktur — wer
    // das ändert, sollte vorher messen statt zu vermuten.
    const filter = suche
      ? and(like(sql`lower(${products.title})`, `%${suche.toLocaleLowerCase("de-DE")}%`))
      : undefined;

    const rows = await db.select({
      id: products.id,
      title: products.title,
      description: products.description,
      status: products.status,
      origin: products.origin,
      kind: products.kind,
      priceAmountCents: products.priceAmountCents,
      priceCurrency: products.priceCurrency,
      manualOverrides: products.manualOverrides,
      updatedAt: products.updatedAt,
      listingPriceCents: ebayListings.priceAmountCents,
      listingUrl: ebayListings.listingUrl,
      listingStatus: ebayListings.status,
      availableQuantity: inventory.availableQuantity,
      inventoryStatus: inventory.status,
    }).from(products)
      .leftJoin(ebayListings, eq(ebayListings.productId, products.id))
      .leftJoin(inventory, eq(inventory.productId, products.id))
      .where(filter)
      .orderBy(desc(products.updatedAt))
      .limit(PAGE_SIZE);

    return NextResponse.json({
      products: rows.map((row) => ({
        ...row,
        manualOverrides: [...handfelder(row.manualOverrides)],
        // Der wirksame Preis: Bei eBay-Karten das Listing, bei manuellen das
        // Produkt. Die Oberfläche soll nicht dieselbe Fallunterscheidung noch
        // einmal treffen müssen.
        effectivePriceCents: row.origin === "MANUAL" ? row.priceAmountCents : row.listingPriceCents,
      })),
      handfelder: [...HANDFELDER],
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("admin product list failed", error);
    return NextResponse.json({ error: "Karten konnten nicht geladen werden." }, { status: 503 });
  }
}

/** Legt eine von Hand eingestellte Karte an.
 *
 * **Produkt und Bestandszeile gehören in einen Batch.** Bleibt die
 * Bestandszeile aus, ist die Karte unsichtbar (`verfuegbareMenge` liefert 0 für
 * manuelle Karten ohne Bestand) und unverkäuflich (`app/api/orders/route.ts`
 * lehnt ab) — und zwar ohne Fehlermeldung. Das war Falle Nummer 4 aus ai-todo
 * Punkt 11.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const body = await request.json() as { title?: unknown; description?: unknown; priceAmountCents?: unknown; quantity?: unknown };
    const title = text(body.title, MAX_TITLE);
    const description = typeof body.description === "string" && body.description.trim() ? text(body.description, MAX_DESCRIPTION) : null;
    const preis = cents(body.priceAmountCents);
    const menge = typeof body.quantity === "number" && Number.isInteger(body.quantity) && body.quantity >= 1 && body.quantity <= MAX_QUANTITY ? body.quantity : null;
    if (!title || !preis || !menge) {
      return NextResponse.json({ error: "Titel, Preis (1 Cent bis 1000 €) und Menge (1 bis 99) müssen stimmen." }, { status: 400 });
    }

    const db = getDb();
    const id = crypto.randomUUID().replaceAll("-", "");
    const now = new Date().toISOString();
    await db.batch([
      // `kind: "PRELISTED"` ist **kein** Versehen: Die CHECK-Bedingung auf
      // `kind` ließ sich auf D1 nicht erweitern, `origin` trägt die Bedeutung.
      // Begründung im Kopf von drizzle/0006_manual_cards_and_oauth_claims.sql.
      db.insert(products).values({
        id, kind: "PRELISTED", origin: "MANUAL", status: "ACTIVE",
        title, description, priceAmountCents: preis, priceCurrency: "EUR",
        createdByUserId: guard.user?.id ?? null, createdAt: now, updatedAt: now,
      }),
      db.insert(inventory).values({ productId: id, availableQuantity: menge, status: "AVAILABLE", updatedAt: now }),
    ]);

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    console.error("admin product create failed", error);
    return NextResponse.json({ error: "Die Karte konnte nicht angelegt werden." }, { status: 503 });
  }
}

/** Ändert eine bestehende Karte.
 *
 * **Jedes geänderte Feld einer eBay-Karte wird als Handmarkierung vermerkt.**
 * Sonst schreibt der Import es beim nächsten Lauf zurück — nach drei Minuten,
 * ohne Meldung, und die Änderung sah erfolgreich aus. Bei manuellen Karten
 * gibt es nichts, was überschreiben könnte; die Markierung schadet dort aber
 * auch nicht und hält die Regel einheitlich.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const body = await request.json() as {
      id?: unknown; title?: unknown; description?: unknown; status?: unknown;
      priceAmountCents?: unknown; quantity?: unknown;
    };
    const id = typeof body.id === "string" && /^[a-f0-9]{32}$/iu.test(body.id) ? body.id : null;
    if (!id) return NextResponse.json({ error: "Unbekannte Karte." }, { status: 400 });

    const db = getDb();
    const vorher = await db.query.products.findFirst({ where: eq(products.id, id) });
    if (!vorher) return NextResponse.json({ error: "Unbekannte Karte." }, { status: 404 });
    const manuell = vorher.origin === "MANUAL";

    const werte: Record<string, unknown> = {};
    const neueMarkierungen = new Set<Handfeld>(handfelder(vorher.manualOverrides));

    if (body.title !== undefined) {
      const title = text(body.title, MAX_TITLE);
      if (!title) return NextResponse.json({ error: "Der Titel darf nicht leer sein." }, { status: 400 });
      if (title !== vorher.title) { werte.title = title; neueMarkierungen.add("title"); }
    }
    if (body.description !== undefined) {
      const description = typeof body.description === "string" && body.description.trim()
        ? text(body.description, MAX_DESCRIPTION) : null;
      if (body.description !== null && typeof body.description === "string" && body.description.trim() && !description) {
        return NextResponse.json({ error: "Die Beschreibung ist zu lang." }, { status: 400 });
      }
      if (description !== vorher.description) { werte.description = description; neueMarkierungen.add("description"); }
    }
    if (body.status !== undefined) {
      const status = body.status === "ACTIVE" || body.status === "INACTIVE" ? body.status : null;
      if (!status) return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
      if (status !== vorher.status) { werte.status = status; neueMarkierungen.add("status"); }
    }
    if (body.priceAmountCents !== undefined) {
      // Der Preis einer eBay-Karte steht im Listing und wird von dort
      // überschrieben. Ihn hier zu ändern, hielte einen Tag lang und wäre dann
      // weg — also gar nicht erst anbieten, statt eine Änderung vorzutäuschen.
      if (!manuell) return NextResponse.json({ error: "Der Preis einer eBay-Karte kommt von eBay und lässt sich hier nicht ändern." }, { status: 409 });
      const preis = cents(body.priceAmountCents);
      if (!preis) return NextResponse.json({ error: "Der Preis muss zwischen 1 Cent und 1000 € liegen." }, { status: 400 });
      if (preis !== vorher.priceAmountCents) werte.priceAmountCents = preis;
    }

    const anweisungen = [];
    if (Object.keys(werte).length) {
      anweisungen.push(db.update(products).set({
        ...werte,
        // Markierungen nur an eBay-Karten: Bei manuellen Karten gibt es keinen
        // Import, der etwas zurückschreiben könnte — eine Markierung dort wäre
        // eine Behauptung ohne Wirkung.
        ...(manuell ? {} : { manualOverrides: [...neueMarkierungen] }),
        updatedAt: new Date().toISOString(),
      }).where(eq(products.id, id)));
    }
    if (body.quantity !== undefined) {
      if (!manuell) return NextResponse.json({ error: "Die Menge einer eBay-Karte kommt von eBay." }, { status: 409 });
      const menge = typeof body.quantity === "number" && Number.isInteger(body.quantity) && body.quantity >= 0 && body.quantity <= MAX_QUANTITY ? body.quantity : null;
      if (menge === null) return NextResponse.json({ error: "Die Menge muss zwischen 0 und 99 liegen." }, { status: 400 });
      anweisungen.push(db.update(inventory).set({
        availableQuantity: menge,
        status: menge > 0 ? "AVAILABLE" : "SOLD",
        updatedAt: new Date().toISOString(),
      }).where(eq(inventory.productId, id)));
    }

    if (!anweisungen.length) return NextResponse.json({ ok: true, unchanged: true });
    await db.batch(anweisungen as [(typeof anweisungen)[number], ...typeof anweisungen]);
    return NextResponse.json({ ok: true, manualOverrides: manuell ? [] : [...neueMarkierungen] });
  } catch (error) {
    console.error("admin product update failed", error);
    return NextResponse.json({ error: "Die Änderung konnte nicht gespeichert werden." }, { status: 503 });
  }
}

/** Nimmt eine Handmarkierung zurück: Ab dem nächsten Lauf schreibt der Import
 *  dieses Feld wieder. Ohne diesen Weg wäre jede einmal gesetzte Markierung
 *  endgültig — und der Katalog driftete still von eBay weg. */
export async function DELETE(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") ?? "";
    const feld = url.searchParams.get("feld") ?? "";
    if (!/^[a-f0-9]{32}$/iu.test(id) || !(HANDFELDER as readonly string[]).includes(feld)) {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }
    const db = getDb();
    const vorher = await db.query.products.findFirst({ where: eq(products.id, id) });
    if (!vorher) return NextResponse.json({ error: "Unbekannte Karte." }, { status: 404 });
    const uebrig = [...handfelder(vorher.manualOverrides)].filter((eintrag) => eintrag !== feld);
    await db.update(products).set({ manualOverrides: uebrig, updatedAt: new Date().toISOString() }).where(eq(products.id, id));
    return NextResponse.json({ ok: true, manualOverrides: uebrig });
  } catch (error) {
    console.error("admin product override reset failed", error);
    return NextResponse.json({ error: "Die Markierung konnte nicht zurückgenommen werden." }, { status: 503 });
  }
}
