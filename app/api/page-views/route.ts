import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { pageViews } from "../../../db/schema";
import { normalisiereAufrufpfad, stundenEimer } from "../../../lib/page-views";
import { RateLimitError, enforcePublicRateLimit } from "../../../lib/rate-limit";

/** Nimmt einen Seitenaufruf entgegen. Aufgerufen von `app/view-tracker.tsx`.
 *
 * **Antwortet grundsätzlich mit 204 und niemals mit einem Fehler, der beim
 * Besucher ankommt.** Ein Zähler ist Beiwerk; er darf keine Fehlermeldung in
 * der Konsole erzeugen, keinen Wiederholungsversuch auslösen und schon gar
 * nicht die Seite beeinflussen. Was hier schiefgeht, gehört ins Serverprotokoll
 * und sonst nirgendwohin — der Preis ist, dass ein stiller Ausfall nur dort
 * sichtbar wird, dafür steht im Adminbereich der Zeitpunkt des ersten
 * erfassten Aufrufs.
 *
 * Gespeichert wird ausschließlich der hochgezählte Eimer. Die Adresse des
 * Besuchers geht in die Ratengrenze und ist danach weg; sie erreicht die
 * Datenbank nicht.
 */
export async function POST(request: Request) {
  try {
    await enforcePublicRateLimit(request, "page-views", "beacon");

    const body = await request.json().catch(() => null) as { path?: unknown } | null;
    const pfad = normalisiereAufrufpfad(typeof body?.path === "string" ? body.path : "");
    // `null` heißt „bewusst nicht gezählt" (Adminbereich, unbrauchbare
    // Eingabe). Kein Fehler — es gibt nur nichts zu tun.
    if (!pfad) return new NextResponse(null, { status: 204 });

    const db = getDb();
    // Ein Schreibvorgang je Aufruf, ohne vorheriges Lesen. Der eindeutige
    // Index (bucket_start, path) entscheidet, ob eine Zeile entsteht oder eine
    // bestehende hochzählt — und zwar in der Datenbank, sodass zwei
    // gleichzeitige Aufrufe sich nicht gegenseitig überschreiben können.
    await db.insert(pageViews)
      .values({ bucketStart: stundenEimer(), path: pfad, viewCount: 1 })
      .onConflictDoUpdate({
        target: [pageViews.bucketStart, pageViews.path],
        set: { viewCount: sql`${pageViews.viewCount} + 1`, updatedAt: sql`CURRENT_TIMESTAMP` },
      });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Auch die Ratengrenze endet in 204: Ein 429 im Netzwerkprotokoll des
    // Besuchers wäre eine Warnung über etwas, das ihn nichts angeht.
    if (!(error instanceof RateLimitError)) console.error("Aufrufzähler fehlgeschlagen", error);
    return new NextResponse(null, { status: 204 });
  }
}
