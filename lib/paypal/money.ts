const MAX_AMOUNT_CENTS = 10_000_000;

export function assertValidMoney(amountCents: number, currency: string): void {
  if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > MAX_AMOUNT_CENTS) {
    throw new Error("Ungültiger Zahlungsbetrag.");
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Ungültige Währung.");
  }
}

export function centsToPayPalValue(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}
