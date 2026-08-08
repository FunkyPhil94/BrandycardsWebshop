import { NextResponse } from "next/server";
import { getDb } from "../../../../../../db";
import { requireAdmin } from "../../../../../../lib/admin-access";
import { processEbayOutbox } from "../../../../../../lib/ebay-outbox";

/** Arbeitet die eBay-Rücknahmen sofort ab, statt auf den geplanten Lauf zu warten.
 *
 * `processEbayOutbox` hängt sonst ausschließlich im geplanten Lauf, und der
 * kommt alle zwei Stunden. Ein Auftrag, der aus irgendeinem Grund liegen
 * bleibt, läge damit bis zu zwei Stunden — und in genau der Zeit steht eine
 * verkaufte Karte bei eBay weiter zum Verkauf. Dieser Knopf verkürzt das auf
 * einen Klick.
 *
 * (Das Cron-Muster steht bewusst nicht als Zeichenfolge in diesem Kommentar:
 * es enthält die Folge, die einen Blockkommentar beendet, und hat genau das
 * beim ersten Schreiben auch getan.)
 *
 * **Der Schreibschalter gilt weiterhin.** Steht `EBAY_WRITE_ENABLED` nicht auf
 * `true`, kehrt die Verarbeitung sofort mit 0 zurück; der Knopf kann den
 * Schalter nicht übergehen. Das steht in der Antwort, sonst sähe „0 Aufträge"
 * aus wie „nichts zu tun", während in Wahrheit der Schalter aus ist.
 */
export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if (access.response) return access.response;

  const writeEnabled = process.env.EBAY_WRITE_ENABLED === "true";
  try {
    const processed = await processEbayOutbox(getDb());
    return NextResponse.json({ ok: true, processed, writeEnabled });
  } catch (error) {
    console.error("[ebay-outbox] Lauf von Hand fehlgeschlagen", error);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({
      error: "eBay-Rücknahmen konnten nicht ausgeführt werden.",
      detail: message.slice(0, 300),
      writeEnabled,
    }, { status: 503 });
  }
}
