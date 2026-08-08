import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { ebayListings, inventory, orderItems, orders, products, reservations } from "../../../db/schema";
import { getAuthenticatedAppUser } from "../../../lib/app-user";
import { checkReservationCapacity, MAX_ORDER_POSITIONS, RESERVATION_MINUTES } from "../../../lib/order-guard";
import { effectiveUnitPrice } from "../../../lib/offer-price";
import { acceptedOfferPrices } from "../../../lib/price-offers";
import { releaseExpiredReservations, reservedUnitsForUser } from "../../../lib/paypal/settle-order";
import { enforcePublicRateLimit } from "../../../lib/rate-limit";

const EU_COUNTRIES = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "ES", "FI", "FR", "GR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"]);

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
    if (!appUser) return NextResponse.json({ error: "Bitte melde dich für den Checkout an." }, { status: 401 });
    const body = await request.json() as { items?: unknown; shippingAddress?: unknown };
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
    await releaseExpiredReservations(db, new Date().toISOString(), appUser.id);
    const requestedUnits = [...requested.values()].reduce((sum, quantity) => sum + quantity, 0);
    const capacity = checkReservationCapacity(await reservedUnitsForUser(db, appUser.id), requestedUnits);
    if (!capacity.allowed) throw new OrderIssue(capacity.message);

    const ids = Array.from(requested.keys());
    const rows = await db.select({ product: products, listing: ebayListings, stock: inventory }).from(products)
        .innerJoin(ebayListings, and(eq(ebayListings.productId, products.id), eq(ebayListings.status, "ACTIVE"), eq(ebayListings.listingType, "FIXED_PRICE")))
        .innerJoin(inventory, eq(inventory.productId, products.id)).where(and(inArray(products.id, ids), eq(products.status, "ACTIVE")));
    if (rows.length !== ids.length) throw new OrderIssue("Ein Artikel ist nicht mehr verfügbar.");
    // Negotiated prices are resolved here, never taken from the request. The
    // browser only names product ids; what each one costs for this customer is
    // decided server-side from their accepted, unexpired offers.
    const negotiated = await acceptedOfferPrices(db, appUser.id, ids);
    const lineItems = rows.map(({ product, listing, stock }) => {
        const quantity = requested.get(product.id) ?? 0;
        if (!listing.priceAmountCents || listing.priceAmountCents < 1 || stock.availableQuantity < quantity || stock.status === "UNAVAILABLE" || stock.status === "SOLD") throw new OrderIssue(`Artikel nicht mehr verfügbar: ${product.title}`);
        // An accepted offer only ever lowers the price; should the list price
        // have dropped below it in the meantime, the customer pays the lower one.
        // Die Regel steht in `lib/price-offers.ts`, weil der Checkout sie seit
        // dem 2026-08-08 zum Anzeigen ebenfalls braucht — zweimal geschrieben
        // wäre sie zweimal zu pflegen.
        const unitPrice = effectiveUnitPrice(listing.priceAmountCents, negotiated.get(product.id));
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
      db.insert(orders).values({ id, orderNumber: number, userId: appUser.id, status: "PENDING", currency: "EUR", subtotalAmountCents: subtotal, shippingAmountCents: shipping, totalAmountCents: total, shippingAddress, billingAddress: shippingAddress }),
      ...lineItems.map((item) => db.insert(orderItems).values({ orderId: id, productId: item.product.id, titleSnapshot: item.product.title, skuSnapshot: item.listing.sku, quantity: item.quantity, unitAmountCents: item.unitPrice, totalAmountCents: item.total, productSnapshot: { title: item.product.title, listingId: item.listing.id } })),
      ...lineItems.map((item) => db.insert(reservations).values({ orderId: id, productId: item.product.id, inventoryId: item.stock.id, userId: appUser.id, quantity: item.quantity, status: "ACTIVE", expiresAt })),
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
