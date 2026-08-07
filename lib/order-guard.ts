/** How much stock one customer may hold unpaid at the same time.
 *
 * Every order reserves its items for `RESERVATION_MINUTES` and only the
 * scheduled run gives them back. Without a ceiling on *concurrent* holds, one
 * account can walk the catalogue and park the entire stock behind unpaid
 * orders: `/api/products` hands out all product ids, an order takes up to
 * `MAX_ORDER_POSITIONS` of them, and nothing stopped the next order from
 * taking the next batch. Six requests covered 296 cards, and the shop showed
 * every one of them as unavailable. See docs/security-findings.md, SEC-03.
 *
 * The bound is deliberately expressed in *units of stock*, not in orders: what
 * hurts is how many cards are unbuyable, and three orders of fifty do the same
 * damage as one of a hundred and fifty.
 *
 * Kept free of database imports so the attack can be replayed in a test.
 */

/** How long an order holds its items before the scheduled run frees them. */
export const RESERVATION_MINUTES = 15;

/** Positions a single order may carry. Unchanged — this is the customer-facing
 *  cart limit and was never the problem. */
export const MAX_ORDER_POSITIONS = 50;

/** Units of stock one customer may hold across *all* unpaid orders.
 *
 * Set to the same number as a single full cart on purpose: nobody who could
 * previously place an order is turned away by this. It only stops the same
 * account from holding several full carts at once, which is not shopping.
 */
export const MAX_RESERVED_UNITS_PER_USER = 50;

export type ReservationCheck = { allowed: true } | { allowed: false; message: string };

/**
 * @param alreadyReserved units this customer is already holding in unpaid orders
 * @param requested units the new order would add
 */
export function checkReservationCapacity(alreadyReserved: number, requested: number): ReservationCheck {
  if (alreadyReserved + requested <= MAX_RESERVED_UNITS_PER_USER) return { allowed: true };
  return {
    allowed: false,
    message: `Du hast bereits ${alreadyReserved} Artikel in offenen Bestellungen. Bitte schließe eine davon ab oder brich sie ab, bevor du weitere reservierst.`,
  };
}
