/** Was mit einem `PAYMENT.CAPTURE.COMPLETED` von PayPal zu geschehen hat.
 *
 * Die Entscheidung hängt allein am Zustand der gespeicherten Zahlung, nicht am
 * Inhalt des Ereignisses. Sie steht hier als reine Funktion, damit sie ohne
 * Netz und ohne Datenbank prüfbar ist — dieselbe Trennung wie
 * `lib/ebay-stock-check.ts` gegen `lib/ebay-stock-guard.ts`.
 *
 * **Der Fall, der zählt, ist `REFUNDED`.** Eine erstattete Zahlung darf nie
 * wieder als bezahlt gelten: Sonst stünde eine Bestellung auf `PAID`, deren
 * Geld längst zurückgeflossen ist, und der Bestand wäre erneut als verkauft
 * gebucht. Ein Test hält das fest.
 */
export type WebhookCaptureAction = "einziehen" | "dublette" | "erstattet";

export function webhookCaptureAction(paymentStatus: string): WebhookCaptureAction {
  // Bereits eingezogen: Der Kunde ist aus PayPal zurückgekehrt und hat den
  // Einzug gewonnen, bevor der Webhook eintraf. Das ist der Normalfall, kein
  // Fehler — beide Wege feuern bei jeder Zahlung.
  if (paymentStatus === "CAPTURED") return "dublette";
  if (paymentStatus === "REFUNDED") return "erstattet";
  return "einziehen";
}
