/** Zustand des Warenkorbknopfes — an einer Stelle, damit Galerie, Übersicht
 *  und Detailseite nicht auseinanderlaufen.
 *
 *  Steht hier und nicht in `app/site-chrome.tsx`, weil es reine
 *  Entscheidungslogik ohne React ist und sich so ohne Browser prüfen lässt
 *  (`tests/cart-and-pagination.test.mjs`).
 */

export type CartAction = "add" | "remove" | null;

export type CartButtonState = {
  /** Kein sinnvoller Klick möglich. */
  disabled: boolean;
  label: string;
  action: CartAction;
};

/**
 * @param available Bestand aus der Datenbank.
 * @param inCart    Wie oft die Karte bereits im Warenkorb liegt.
 *
 * **Die Reihenfolge der Prüfungen ist die eigentliche Aussage:** „liegt im
 * Warenkorb" kommt **vor** „nicht verfügbar". Sonst entstünde eine Sackgasse —
 * eine Karte, die nach dem Hinzufügen ausverkauft ist (der Import läuft alle
 * zwei Stunden, das kommt vor), ließe sich nicht mehr herausnehmen und der
 * Kunde säße mit einem Warenkorb da, den er nicht leeren kann.
 */
export function cartButtonState(available: number, inCart: number): CartButtonState {
  const bestand = Number.isInteger(available) && available > 0 ? available : 0;
  const drin = Number.isInteger(inCart) && inCart > 0 ? inCart : 0;

  if (drin > 0 && drin >= bestand) return { disabled: false, label: "Aus dem Warenkorb", action: "remove" };
  if (bestand < 1) return { disabled: true, label: "Nicht verfügbar", action: null };
  return { disabled: false, label: "In den Warenkorb", action: "add" };
}
