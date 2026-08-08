import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/admin-access";
import { checkEbayWriteAuth } from "../../../../../lib/ebay-client";

/** Prüft, ob der eBay-Schreibpfad sich überhaupt anmelden kann.
 *
 * Lesend läuft alles mit `sell.inventory.readonly`; das Zurücknehmen eines
 * verkauften Angebots braucht `sell.inventory`. Ob der hinterlegte
 * Refresh-Token diesen Scope trägt, sieht man dem Token nicht an — und es folgt
 * auch nicht daraus, dass der Zustimmungsweg ihn anfordert, denn der Token
 * kann auf anderem Weg entstanden sein.
 *
 * **Es wird kein Angebot angefasst.** Der Aufruf tauscht ein Token und sonst
 * nichts; er ist deshalb auch dann gefahrlos, wenn `EBAY_WRITE_ENABLED` noch
 * auf `false` steht — und genau dafür ist er gedacht: die Frage klären, bevor
 * der Schalter fällt.
 */
export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (access.response) return access.response;

  const result = await checkEbayWriteAuth();
  return NextResponse.json({
    ...result,
    // Der Schalter gehört in die Antwort: Eine geglückte Anmeldung heißt noch
    // nicht, dass Aufträge ausgeführt werden.
    writeEnabled: process.env.EBAY_WRITE_ENABLED === "true",
  }, { status: result.ok ? 200 : 502 });
}
