import { and, eq, gte, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { ebayListings, inventory, orderItems, orders, products, reservations } from "../../../db/schema";
import { getAuthenticatedAppUser } from "../../../lib/app-user";

const EU_COUNTRIES = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "ES", "FI", "FR", "GR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"]);
const RESERVATION_MINUTES = 15;

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
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) return NextResponse.json({ error: "Bitte melde dich für den Checkout an." }, { status: 401 });
    const body = await request.json() as { items?: unknown; shippingAddress?: unknown };
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) return NextResponse.json({ error: "Der Warenkorb ist leer." }, { status: 400 });
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
    const ids = Array.from(requested.keys());
    const rows = await db.select({ product: products, listing: ebayListings, stock: inventory }).from(products)
        .innerJoin(ebayListings, and(eq(ebayListings.productId, products.id), eq(ebayListings.status, "ACTIVE"), eq(ebayListings.listingType, "FIXED_PRICE")))
        .innerJoin(inventory, eq(inventory.productId, products.id)).where(and(inArray(products.id, ids), eq(products.status, "ACTIVE")));
    if (rows.length !== ids.length) throw new OrderIssue("Ein Artikel ist nicht mehr verfügbar.");
    const lineItems = rows.map(({ product, listing, stock }) => {
        const quantity = requested.get(product.id) ?? 0;
        if (!listing.priceAmountCents || listing.priceAmountCents < 1 || stock.availableQuantity < quantity || stock.status === "UNAVAILABLE" || stock.status === "SOLD") throw new OrderIssue(`Artikel nicht mehr verfügbar: ${product.title}`);
        return { product, listing, stock, quantity, total: listing.priceAmountCents * quantity };
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
    const writes = [
      db.insert(orders).values({ id, orderNumber: number, userId: appUser.id, status: "PENDING", currency: "EUR", subtotalAmountCents: subtotal, shippingAmountCents: shipping, totalAmountCents: total, shippingAddress, billingAddress: shippingAddress }),
      ...lineItems.map((item) => db.insert(orderItems).values({ orderId: id, productId: item.product.id, titleSnapshot: item.product.title, skuSnapshot: item.listing.sku, quantity: item.quantity, unitAmountCents: item.listing.priceAmountCents!, totalAmountCents: item.total, productSnapshot: { title: item.product.title, listingId: item.listing.id } })),
      ...lineItems.map((item) => db.update(inventory).set({ availableQuantity: item.stock.availableQuantity - item.quantity, reservedQuantity: item.stock.reservedQuantity + item.quantity, status: "RESERVED", version: item.stock.version + 1, updatedAt: new Date().toISOString() }).where(and(eq(inventory.id, item.stock.id), gte(inventory.availableQuantity, item.quantity)))),
      ...lineItems.map((item) => db.insert(reservations).values({ productId: item.product.id, inventoryId: item.stock.id, userId: appUser.id, quantity: item.quantity, status: "ACTIVE", expiresAt })),
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
