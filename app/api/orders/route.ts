import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { ebayListings, inventory, orderItems, orders, products, reservations } from "../../../db/schema";
import { getAuthenticatedAppUser } from "../../../lib/app-user";
import { checkReservationCapacity, MAX_ORDER_POSITIONS, RESERVATION_MINUTES } from "../../../lib/order-guard";
import { effectiveUnitPrice } from "../../../lib/offer-price";
import { acceptedOfferPrices } from "../../../lib/price-offers";
import { releaseExpiredReservations, reservedUnitsForGuest, reservedUnitsForUser } from "../../../lib/paypal/settle-order";
import { enforcePublicRateLimit } from "../../../lib/rate-limit";
import { EU_COUNTRIES } from "../../../lib/shipping-countries";

class OrderIssue extends Error {
  constructor(public readonly publicMessage: string) {
    super(publicMessage);
  }
}

type CartItem = { productId?: unknown; quantity?: unknown };
type Address = { name?: unknown; street?: unknown; postalCode?: unknown; city?: unknown; country?: unknown };

function cleanAddress(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const address = value as Address;
  const name = typeof address.name === "string" ? address.name.trim() : "";
  const street = typeof address.street === "string" ? address.street.trim() : "";
  const postalCode = typeof address.postalCode === "string" ? address.postalCode.trim() : "";
  const city = typeof address.city === "string" ? address.city.trim() : "";
  const country = typeof address.country === "string" ? address.country.trim().toUpperCase() : "";
  if (!name || !street || !postalCode || !city || (country !== "DE" && !EU_COUNTRIES.has(country))) return null;
  return { name, street, postalCode, city, country };
}

function orderNumber() {
  return `BC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "orders");
    const appUser = await getAuthenticatedAppUser(request);
    const body = await request.json() as { items?: unknown; shippingAddress?: unknown; customerEmail?: unknown };
    const guestEmail = cleanEmail(body.customerEmail);
    const orderGuestEmail = appUser ? null : guestEmail;
    if (!appUser && !guestEmail) return NextResponse.json({ error: "Bitte gib eine E-Mail-Adresse f\u00fcr die Bestellbest\u00e4tigung an." }, { status: 400 });
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ORDER_POSITIONS) return NextResponse.json({ error: "Der Warenkorb ist leer." }, { status: 400 });
    const shippingAddress = cleanAddress(body.shippingAddress);
    if (!shippingAddress) return NextResponse.json({ error: "Bitte vervollständige die Lieferadresse für Deutschland oder die EU." }, { status: 400 });
    const requested = new Map<string, number>();
    for (const item of body.items as CartItem[]) {
      const productId = typeof item.productId === "string" ? item.productId.trim() : "";
      const quantity = typeof item.quantity === "number" && Number.isInteger(item.quantity) ? item.quantity : 0;
      if (!productId || quantity < 1 || quantity > 20) return NextResponse.json({ error: "Ungültige Warenkorbposition." }, { status: 400 });
      requested.set(productId, (requested.get(productId) ?? 0) + quantity);
    }
    const db = getDb();

    // Give this customer's own lapsed holds back before counting what they
    // hold. Without it the ceiling below would lock someone out for up to an
    // hour over a checkout they abandoned fifteen minutes ago.
    if (appUser) await releaseExpiredReservations(db, new Date().toISOString(), appUser.id);
    else await releaseExpiredReservations(db, new Date().toISOString(), undefined, guestEmail ?? undefined);
    const requestedUnits = [...requested.values()].reduce((sum, quantity) => sum + quantity, 0);
    const heldUnits = appUser
      ? await reservedUnitsForUser(db, appUser.id)
      : await reservedUnitsForGuest(db, guestEmail ?? "");
    const capacity = checkReservationCapacity(heldUnits, requestedUnits);
    if (!capacity.allowed) throw new OrderIssue(capacity.message);

    const ids = Array.from(requested.keys());
    // **Das Listing hängt per `leftJoin`, der Bestand weiterhin zwingend.**
    // Von Hand eingestellte Karten haben kein Listing; mit `innerJoin` ließen
    // sie sich nicht kaufen — die Bestellung scheiterte mit „nicht mehr
    // verfügbar", obwohl die Karte im Schaufenster stand. Der Bestand dagegen
    // bleibt bei **jeder** Karte Pflicht: ohne ihn gibt es nichts zu reservieren.
    const rows = await db.select({ product: products, listing: ebayListings, stock: inventory }).from(products)
        .leftJoin(ebayListings, and(eq(ebayListings.productId, products.id), eq(ebayListings.status, "ACTIVE"), eq(ebayListings.listingType, "FIXED_PRICE")))
        .innerJoin(inventory, eq(inventory.productId, products.id)).where(and(inArray(products.id, ids), eq(products.status, "ACTIVE")));
    if (rows.length !== ids.length) throw new OrderIssue("Ein Artikel ist nicht mehr verfügbar.");
    // Eine eBay-Karte ohne aktives Festpreis-Listing gehört nicht in eine
    // Bestellung. Vor dem `leftJoin` erledigte das die Verknüpfung selbst.
    for (const row of rows) {
        if (row.product.origin !== "MANUAL" && !row.listing) throw new OrderIssue(`Artikel nicht mehr verfügbar: ${row.product.title}`);
    }
    // Negotiated prices are resolved here, never taken from the request. The
    // browser only names product ids; what each one costs for this customer is
    // decided server-side from their accepted, unexpired offers.
    const negotiated = appUser ? await acceptedOfferPrices(db, appUser.id, ids) : new Map<string, number>();
    const lineItems = rows.map(({ product, listing, stock }) => {
        const quantity = requested.get(product.id) ?? 0;
        // eBay-Karten haben einen serverseitig ermittelten Listing-Preis.
        // Vorverkaufskarten haben keinen Festpreis und dürfen nur mit einem
        // angenommenen, noch gültigen Angebot bestellt werden.
        const listenpreis = product.origin === "MANUAL" ? null : listing?.priceAmountCents ?? null;
        if (stock.availableQuantity < quantity || stock.status === "UNAVAILABLE" || stock.status === "SOLD") throw new OrderIssue(`Artikel nicht mehr verfügbar: ${product.title}`);
        // Bei eBay senkt ein accepted offer nur; bei Vorverkauf ist es der
        // gesamte Preis. Die Regel steht in `lib/offer-price.ts`.
        const unitPrice = effectiveUnitPrice(listenpreis, negotiated.get(product.id));
        if (unitPrice === null) throw new OrderIssue(`Für ${product.title} gibt es noch keinen angenommenen Preisvorschlag.`);
        return { product, listing, stock, quantity, unitPrice, total: unitPrice * quantity };
    });
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const shipping = shippingAddress.country === "DE" ? 345 : 1449;
    const total = subtotal + shipping;
    const id = crypto.randomUUID();
    const number = orderNumber();
    const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60_000).toISOString();

    // Cloudflare D1 rejects SQL BEGIN/COMMIT statements. Drizzle's generic
    // transaction helper emits those statements, so use D1's native batch API.
    // D1 executes the batch atomically while keeping all writes on one request.
    //
    // The quantities are written relative to the stored value, never as an
    // absolute number computed from the row we read earlier: two concurrent
    // orders can both pass the `gte` guard and would then write the same
    // absolute value, losing one booking. Relative arithmetic makes the write
    // itself the arithmetic. See docs/security-findings.md, SEC-10.
    const bookedAt = new Date().toISOString();
    const stockWrites = lineItems.map((item) => db.update(inventory).set({
      availableQuantity: sql`${inventory.availableQuantity} - ${item.quantity}`,
      reservedQuantity: sql`${inventory.reservedQuantity} + ${item.quantity}`,
      status: "RESERVED",
      version: sql`${inventory.version} + 1`,
      updatedAt: bookedAt,
    }).where(and(eq(inventory.id, item.stock.id), gte(inventory.availableQuantity, item.quantity))));
    const stockResults = await db.batch(stockWrites as unknown as Parameters<typeof db.batch>[0]);
    if (stockResults.some((result) => result.meta.changes !== 1)) {
      // Undo relatively as well — restoring the snapshot would overwrite
      // whatever the concurrent order booked in between.
      const rollbackWrites = lineItems.map((item, index) => stockResults[index].meta.changes === 1
        ? db.update(inventory).set({
            availableQuantity: sql`${inventory.availableQuantity} + ${item.quantity}`,
            reservedQuantity: sql`${inventory.reservedQuantity} - ${item.quantity}`,
            status: sql`CASE WHEN ${inventory.reservedQuantity} - ${item.quantity} = 0 THEN 'AVAILABLE' ELSE 'RESERVED' END`,
            version: sql`${inventory.version} + 1`,
            updatedAt: new Date().toISOString(),
          }).where(and(eq(inventory.id, item.stock.id), gte(inventory.reservedQuantity, item.quantity)))
        : null).filter((write): write is NonNullable<typeof write> => write !== null);
      if (rollbackWrites.length) await db.batch(rollbackWrites as unknown as Parameters<typeof db.batch>[0]);
      throw new OrderIssue("Ein Artikel wurde gerade von einem anderen Kunden reserviert.");
    }
    const writes = [
      db.insert(orders).values({ id, orderNumber: number, userId: appUser?.id ?? null, guestEmail: orderGuestEmail, status: "PENDING", currency: "EUR", subtotalAmountCents: subtotal, shippingAmountCents: shipping, totalAmountCents: total, shippingAddress, billingAddress: shippingAddress }),
      // `listing` fehlt bei manuellen Karten. Die Momentaufnahme in der
      // Bestellposition hält dann fest, dass es keine gab — der Beleg soll
      // sagen, was war, nicht so tun, als wäre alles gleich.
      ...lineItems.map((item) => db.insert(orderItems).values({ orderId: id, productId: item.product.id, titleSnapshot: item.product.title, skuSnapshot: item.listing?.sku ?? null, quantity: item.quantity, unitAmountCents: item.unitPrice, totalAmountCents: item.total, productSnapshot: { title: item.product.title, listingId: item.listing?.id ?? null, origin: item.product.origin } })),
      ...lineItems.map((item) => db.insert(reservations).values({ orderId: id, productId: item.product.id, inventoryId: item.stock.id, userId: appUser?.id ?? null, guestEmail: orderGuestEmail, quantity: item.quantity, status: "ACTIVE", expiresAt })),
    ] as const;
    await db.batch(writes);
    const created = { id, orderNumber: number, subtotal, shipping, total, expiresAt };
    return NextResponse.json({ order: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof OrderIssue ? error.publicMessage : "Bestellung konnte nicht angelegt werden.";
    console.error("Order creation failed", error);
    return NextResponse.json({ error: message }, { status: error instanceof OrderIssue ? 409 : 500 });
  }
}

function cleanEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email) ? email : null;
}
