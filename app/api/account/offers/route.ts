import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { getAuthenticatedAppUser } from "../../../../lib/app-user";
import { acceptedOffersForUser } from "../../../../lib/price-offers";
import { enforcePublicRateLimit, RateLimitError } from "../../../../lib/rate-limit";

/** Die angenommenen, noch gültigen Angebote des angemeldeten Kunden.
 *
 * **Rein zum Anzeigen.** Der Checkout zeigte nach einer angenommenen
 * Verhandlung weiterhin den Listenpreis; der Rabatt tauchte erst in der
 * Serverantwort und bei PayPal auf. Kunden zahlten nie zu viel — sie sahen den
 * Vorteil nur zu spät.
 *
 * **Am verbindlichen Preis ändert diese Route nichts.** Er entsteht
 * ausschließlich in `app/api/orders/route.ts`, das die Angebote selbst
 * nachschlägt; aus dem Browser wird nie ein Betrag übernommen. Fiele diese
 * Route aus, sähe der Kunde den Listenpreis und zahlte trotzdem den
 * ausgehandelten.
 *
 * Deshalb ist sie auch auf die eigenen Angebote beschränkt: Sie liest nur, was
 * zu `appUser.id` gehört, und nimmt keine Kennung aus der Anfrage entgegen.
 */
export async function GET(request: Request) {
  try {
    await enforcePublicRateLimit(request, "account-offers");
    const appUser = await getAuthenticatedAppUser(request);
    if (!appUser) return NextResponse.json({ error: "Nicht authentifiziert." }, { status: 401 });

    const offers = await acceptedOffersForUser(getDb(), appUser.id);
    return NextResponse.json({
      offers: [...offers].map(([productId, offer]) => ({
        productId,
        amountCents: offer.amount,
        expiresAt: offer.expiresAt,
      })),
    });
  } catch (error) {
    // Die Begrenzung muss als 429 mit `retry-after` herauskommen, nicht als
    // 500: `enforcePublicRateLimit` wirft, und ohne diesen Zweig läge der
    // Unterschied zwischen „zu viele Anfragen" und „kaputt" nur im Protokoll.
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "retry-after": String(error.retryAfterSeconds) } });
    }
    console.error("Accepted offers lookup failed", error);
    return NextResponse.json({ error: "Angebote konnten nicht geladen werden." }, { status: 500 });
  }
}
