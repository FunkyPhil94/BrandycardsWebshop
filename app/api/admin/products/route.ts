import { and, desc, eq, like, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAssetBucket, getDb } from "../../../../db";
import { ebayListings, inventory, productAssets, products, reservations } from "../../../../db/schema";
import { recordAdminAudit } from "../../../../lib/admin-audit";
import { requireAdmin } from "../../../../lib/admin-access";
import { HANDFELDER, handfelder, type Handfeld } from "../../../../lib/manual-overrides";

const PAGE_SIZE = 30;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 4000;
/** 100 000 Cent = 1000 €. Keine technische Grenze, sondern eine Bremse gegen
 *  den verrutschten Dezimalpunkt: 1500 statt 15,00 ist der teure Tippfehler. */
const MAX_QUANTITY = 99;
const MAX_MANUAL_IMAGES = 2;
const MAX_IMAGE_BYTES = 10_000_000;
const MAX_MANUAL_UPLOAD_BYTES = 22_000_000;

class AdminProductInputError extends Error {
  constructor(public readonly status: 400 | 411 | 413, message: string) {
    super(message);
  }
}

function text(wert: unknown, maxLaenge: number): string | null {
  if (typeof wert !== "string") return null;
  const sauber = wert.trim();
  return sauber.length === 0 || sauber.length > maxLaenge ? null : sauber;
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
        effectivePriceCents: row.origin === "MANUAL" ? null : row.listingPriceCents,
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
 * **Produkt, Bestandszeile und Bilder gehören in einen Batch.** Bleibt die
 * Bestandszeile aus, ist die Karte unsichtbar (`verfuegbareMenge` liefert 0 für
 * manuelle Karten ohne Bestand) und unverkäuflich (`app/api/orders/route.ts`
 * lehnt ab) — und zwar ohne Fehlermeldung. Das war Falle Nummer 4 aus ai-todo
 * Punkt 11.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const response = await createManualProductWithImages(request, guard.user.id);
      if (response.ok) await recordAdminAudit({ request, actorUserId: guard.user.id, action: "product.create", entityType: "product", entityId: response.headers.get("x-product-id") });
      return response;
    }
    const body = await request.json() as { title?: unknown; description?: unknown; quantity?: unknown };
    const title = text(body.title, MAX_TITLE);
    const description = typeof body.description === "string" && body.description.trim() ? text(body.description, MAX_DESCRIPTION) : null;
    const menge = typeof body.quantity === "number" && Number.isInteger(body.quantity) && body.quantity >= 1 && body.quantity <= MAX_QUANTITY ? body.quantity : null;
    if (!title || !menge) {
      return NextResponse.json({ error: "Titel und Menge (1 bis 99) müssen stimmen." }, { status: 400 });
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
        title, description, priceAmountCents: null, priceCurrency: "EUR",
        createdByUserId: guard.user?.id ?? null, createdAt: now, updatedAt: now,
      }),
      db.insert(inventory).values({ productId: id, availableQuantity: menge, status: "AVAILABLE", updatedAt: now }),
    ]);

    await recordAdminAudit({ request, actorUserId: guard.user.id, action: "product.create", entityType: "product", entityId: id });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminProductInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("admin product create failed", error);
    return NextResponse.json({ error: "Die Karte konnte nicht angelegt werden." }, { status: 503 });
  }
}

type UploadedManualImage = { bytes: Uint8Array; mimeType: string; extension: string };

async function createManualProductWithImages(request: Request, createdByUserId: string | null) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength === null) throw new AdminProductInputError(411, "Die Upload-Anfrage muss ihre Größe angeben.");
  const contentLength = Number(declaredLength);
  if (!Number.isFinite(contentLength) || contentLength < 0) throw new AdminProductInputError(400, "Die angegebene Upload-Größe ist ungültig.");
  if (contentLength > MAX_MANUAL_UPLOAD_BYTES) throw new AdminProductInputError(413, "Die Bilder sind zusammen zu groß.");

  const form = await request.formData();
  const title = text(form.get("title"), MAX_TITLE);
  const rawDescription = form.get("description");
  const description = typeof rawDescription === "string" && rawDescription.trim() ? text(rawDescription, MAX_DESCRIPTION) : null;
  const mengeNumber = Number(form.get("quantity"));
  const menge = Number.isInteger(mengeNumber) && mengeNumber >= 1 && mengeNumber <= MAX_QUANTITY ? mengeNumber : null;
  if (!title || !menge) throw new AdminProductInputError(400, "Titel und Menge (1 bis 99) müssen stimmen.");
  if (typeof rawDescription === "string" && rawDescription.trim() && !description) {
    throw new AdminProductInputError(400, "Die Beschreibung ist zu lang.");
  }

  const files = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_MANUAL_IMAGES) throw new AdminProductInputError(400, "Maximal zwei Bilder pro Vorverkaufskarte sind erlaubt.");
  const uploads = await Promise.all(files.map(readManualImage));
  if (uploads.reduce((total, upload) => total + upload.bytes.byteLength, 0) > MAX_MANUAL_UPLOAD_BYTES) {
    throw new AdminProductInputError(413, "Die Bilder sind zusammen zu groß.");
  }

  const db = getDb();
  const bucket = getAssetBucket();
  const id = crypto.randomUUID().replaceAll("-", "");
  const now = new Date().toISOString();
  const assets = uploads.map((upload, sortOrder) => {
    const assetId = crypto.randomUUID().replaceAll("-", "");
    return {
      id: assetId,
      productId: id,
      storageKey: `products/${id}/${assetId}.${upload.extension}`,
      sourceUrl: `/api/products/${id}/assets/${assetId}`,
      mimeType: upload.mimeType,
      byteSize: upload.bytes.byteLength,
      sortOrder,
      isPublic: true,
      createdAt: now,
      upload,
    };
  });
  const storedKeys: string[] = [];

  try {
    for (const asset of assets) {
      await bucket.put(asset.storageKey, asset.upload.bytes, { httpMetadata: { contentType: asset.mimeType } });
      storedKeys.push(asset.storageKey);
    }
    const writes = [
      db.insert(products).values({
        id, kind: "PRELISTED", origin: "MANUAL", status: "ACTIVE",
        title, description, priceAmountCents: null, priceCurrency: "EUR",
        createdByUserId, createdAt: now, updatedAt: now,
      }),
      db.insert(inventory).values({ productId: id, availableQuantity: menge, status: "AVAILABLE", updatedAt: now }),
      ...assets.map((asset) => db.insert(productAssets).values({
        id: asset.id,
        productId: asset.productId,
        storageKey: asset.storageKey,
        sourceUrl: asset.sourceUrl,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        sortOrder: asset.sortOrder,
        isPublic: asset.isPublic,
        createdAt: asset.createdAt,
      })),
    ] as const;
    await db.batch(writes);
  } catch (error) {
    console.error("manual product upload failed", error);
    await Promise.allSettled(storedKeys.map((storageKey) => bucket.delete(storageKey)));
    throw error;
  }

  return NextResponse.json({ ok: true, id, images: assets.length }, { status: 201, headers: { "x-product-id": id } });
}

async function readManualImage(file: File): Promise<UploadedManualImage> {
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    throw new AdminProductInputError(400, "Jedes Bild muss zwischen 1 Byte und 10 MB groß sein.");
  }
  const mimeType = file.type.toLowerCase();
  if (!/^image\/(jpeg|png|webp)$/u.test(mimeType)) {
    throw new AdminProductInputError(400, "Nur JPG-, PNG- und WebP-Bilder sind erlaubt.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
  const valid = mimeType === "image/jpeg"
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mimeType === "image/png"
      ? bytes.length >= pngHeader.length && bytes.slice(0, pngHeader.length).every((value, index) => value === pngHeader[index])
      : new TextDecoder().decode(bytes.slice(0, 12)).startsWith("RIFF") && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!valid) throw new AdminProductInputError(400, "Der tatsächliche Bildtyp stimmt nicht mit dem Dateityp überein.");
  return { bytes, mimeType, extension: mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length) };
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
      if (manuell) return NextResponse.json({ error: "Vorverkaufskarten haben keinen Festpreis. Der Preis entsteht aus einem angenommenen Preisvorschlag." }, { status: 409 });
      if (!manuell) return NextResponse.json({ error: "Der Preis einer eBay-Karte kommt von eBay und lässt sich hier nicht ändern." }, { status: 409 });
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

      // **Nicht schreiben, während ein Kunde die Karte hält.** Die Zahl steht
      // für „so viele sind noch zu haben" und landet in `availableQuantity`.
      // Liegt daneben eine aktive Reservierung, ist unklar, ob sie mitgemeint
      // ist — und die falsche Auslegung erzeugt Bestand, den es nicht gibt:
      // Der Kunde im Checkout bekommt sein Stück, der nächste kauft dasselbe
      // noch einmal. Bei Einzelstücken ist das der Doppelverkauf im eigenen
      // Haus, ohne eBay. Deshalb hier abbrechen statt raten; die Reservierung
      // läuft nach 15 Minuten von selbst ab.
      // Siehe docs/pruefbericht-2026-08-09.md, S-03.
      const [gehalten] = await db.select({ menge: sql<number>`COALESCE(SUM(${reservations.quantity}), 0)` })
        .from(reservations)
        .where(and(eq(reservations.productId, id), eq(reservations.status, "ACTIVE")));
      const reserviert = Number(gehalten?.menge ?? 0);
      if (reserviert > 0) {
        return NextResponse.json({
          error: `Diese Karte liegt gerade in einer offenen Bestellung (${reserviert} Stück reserviert). Die Menge lässt sich erst ändern, wenn die Bestellung bezahlt oder abgelaufen ist — das dauert höchstens 15 Minuten.`,
        }, { status: 409 });
      }

      anweisungen.push(db.update(inventory).set({
        availableQuantity: menge,
        // **`UNAVAILABLE`, nicht `SOLD`.** Menge 0 von Hand heißt „biete ich
        // gerade nicht an", nicht „verkauft" — `soldQuantity` bleibt dabei 0,
        // und ein `SOLD` daneben wäre schlicht falsch. Für die Sichtbarkeit
        // macht es keinen Unterschied (`verfuegbareMenge` behandelt beide
        // gleich), für die Wahrheit der Zeile schon. `SOLD` setzt allein
        // `settlePaidOrder`, nach einer echten Zahlung.
        status: menge > 0 ? "AVAILABLE" : "UNAVAILABLE",
        updatedAt: new Date().toISOString(),
      }).where(eq(inventory.productId, id)));
    }

    if (!anweisungen.length) return NextResponse.json({ ok: true, unchanged: true });
    await db.batch(anweisungen as [(typeof anweisungen)[number], ...typeof anweisungen]);
    await recordAdminAudit({ request, actorUserId: guard.user.id, action: "product.update", entityType: "product", entityId: id, metadata: { fields: Object.keys(werte).join(",") || (body.quantity !== undefined ? "quantity" : "unchanged") } });
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
    await recordAdminAudit({ request, actorUserId: guard.user.id, action: "product.override_reset", entityType: "product", entityId: id, metadata: { field: feld } });
    return NextResponse.json({ ok: true, manualOverrides: uebrig });
  } catch (error) {
    console.error("admin product override reset failed", error);
    return NextResponse.json({ error: "Die Markierung konnte nicht zurückgenommen werden." }, { status: 503 });
  }
}
