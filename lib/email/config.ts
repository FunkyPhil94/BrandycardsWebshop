/** Zugangsdaten und Absender für den E-Mail-Versand.
 *
 * Der Schlüssel liegt als Cloudflare-Secret `RESEND_API_KEY` und gehört
 * **niemals** ins Repository, nicht in `wrangler.toml` und nicht in
 * `.env.example`.
 */

export type EmailConfig = {
  apiKey: string;
  /** Absender, z. B. `BrandyCards <post@brandycards.de>`. */
  from: string;
  /** Antwortadresse, falls der Kunde einfach zurückschreibt. */
  replyTo: string;
  /** Für Links in den Nachrichten. */
  shopUrl: string;
};

const STANDARD_FROM = "BrandyCards <post@brandycards.de>";
const STANDARD_SHOP_URL = "https://shop.brandycards.de";

/** Die Konfiguration — oder `null`, wenn kein Schlüssel hinterlegt ist.
 *
 * **`null` ist ein gültiger Betriebszustand, kein Fehler.** Solange der
 * Betreiber die Domain bei Resend nicht verifiziert und das Secret nicht
 * gesetzt hat, soll der Shop unverändert funktionieren und nur nichts
 * verschicken. Deshalb wird hier nichts geworfen; der Aufrufer entscheidet.
 */
export function getEmailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  const shopUrl = (process.env.SHOP_BASE_URL?.trim() || STANDARD_SHOP_URL).replace(/\/+$/u, "");
  const from = process.env.EMAIL_FROM?.trim() || STANDARD_FROM;
  return {
    apiKey,
    from,
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || "post@brandycards.de",
    shopUrl,
  };
}

/** Wie lange ein Versandversuch höchstens dauern darf.
 *
 * Der Versand wird abgewartet (siehe `send.ts`), verzögert also die Antwort an
 * den Kunden. Fünf Sekunden sind großzügig für einen HTTP-Aufruf und immer noch
 * kurz genug, dass eine hängende Gegenstelle den Checkout nicht aufhält.
 */
export function getEmailTimeoutMs(): number {
  const konfiguriert = Number(process.env.EMAIL_TIMEOUT_MS);
  return Number.isFinite(konfiguriert) && konfiguriert > 0 ? konfiguriert : 5_000;
}
