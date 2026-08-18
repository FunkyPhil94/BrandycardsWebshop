import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { pageViewVisits, pageViews } from "../../../db/schema";
import {
  BESUCHER_ZEILE,
  besucherAdresse,
  besucherSchluessel,
  normalisiereAufrufpfad,
  stundenEimer,
  tagesEimer,
} from "../../../lib/page-views";
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
 * **Seit dem 2026-08-18 wird entdoppelt, und zwar zweifach verschieden.** Eine
 * Adresse zählt je Seitenbereich einmal am Tag *und* in der Kachel oben genau
 * einmal, unabhängig davon, wie viele Bereiche sie besucht hat. Das sind zwei
 * Fragen — „welche Bereiche werden benutzt" und „wie viele Leute waren da" —
 * und deshalb zwei Schlüssel. Die Summe der Bereiche ist absichtlich größer als
 * die Kachel.
 *
 * **Die Adresse erreicht die Datenbank nicht.** Gespeichert wird nur ein
 * SHA-256-Wert, in den ein täglich wirkendes Salz eingeht, das als
 * Cloudflare-Secret liegt. Die Begründung samt Grenzen steht in
 * `drizzle/0019_page_view_unique_visits.sql`.
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
    const eimer = stundenEimer();
    const salz = typeof env.PAGE_VIEW_SALT === "string" ? env.PAGE_VIEW_SALT.trim() : "";
    const adresse = besucherAdresse(request.headers);

    // Fehlt das Salz oder die Adresse, wird **gezählt statt verworfen.** Ein zu
    // hoher Zähler ist ein erkennbarer Fehler; ein stiller Ausfall der Messung
    // wäre keiner. Der Protokolleintrag ist die einzige Stelle, an der ein
    // fehlendes Secret nach dem Ausrollen auffällt.
    if (!salz || !adresse) {
      if (!salz) console.error("Aufrufzähler: PAGE_VIEW_SALT fehlt, es wird nicht entdoppelt");
      await hochzaehlen(db, eimer, [pfad, BESUCHER_ZEILE]);
      return new NextResponse(null, { status: 204 });
    }

    const tag = tagesEimer();
    const [bereichsschluessel, kachelschluessel] = await Promise.all([
      besucherSchluessel(salz, adresse, tag, pfad),
      besucherSchluessel(salz, adresse, tag),
    ]);

    // **Die Entscheidung fällt in der Datenbank, nicht davor.** Ein vorheriges
    // `SELECT` und ein späteres `INSERT` wären zwei Schritte, zwischen die ein
    // zweiter Aufruf desselben Besuchers passt — und dann zählte er doppelt.
    // `ON CONFLICT DO NOTHING … RETURNING` liefert genau dann eine Zeile, wenn
    // dieser Schlüssel heute neu ist. Der Tag steckt im Schlüssel, deshalb
    // braucht es keine Ablaufprüfung.
    const neu = async (schluessel: string) => {
      const zeilen = await db.insert(pageViewVisits)
        .values({ visitKey: schluessel, day: tag })
        .onConflictDoNothing()
        .returning({ visitKey: pageViewVisits.visitKey });
      return zeilen.length > 0;
    };
    const [bereichNeu, kachelNeu] = await Promise.all([neu(bereichsschluessel), neu(kachelschluessel)]);

    const zuZaehlen = [...(bereichNeu ? [pfad] : []), ...(kachelNeu ? [BESUCHER_ZEILE] : [])];
    if (zuZaehlen.length > 0) await hochzaehlen(db, eimer, zuZaehlen);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Auch die Ratengrenze endet in 204: Ein 429 im Netzwerkprotokoll des
    // Besuchers wäre eine Warnung über etwas, das ihn nichts angeht.
    if (!(error instanceof RateLimitError)) console.error("Aufrufzähler fehlgeschlagen", error);
    return new NextResponse(null, { status: 204 });
  }
}

/** Zählt die genannten Zeilen im Stundeneimer hoch.
 *
 * Ohne vorheriges Lesen: Der eindeutige Index (bucket_start, path) entscheidet,
 * ob eine Zeile entsteht oder eine bestehende hochzählt — und zwar in der
 * Datenbank, sodass zwei gleichzeitige Aufrufe sich nicht überschreiben.
 */
async function hochzaehlen(db: ReturnType<typeof getDb>, eimer: string, pfade: string[]) {
  // Nacheinander statt als `batch`: Es sind höchstens zwei Anweisungen, und
  // `batch` verlangt ein Tupel bekannter Länge — der Zuschnitt darauf käme als
  // Typumgehung daher und würde nichts verbessern. Halb misslingen darf hier
  // ohnehin: Fehlt eine der beiden Zählungen, ist eine Zahl um eins zu klein.
  for (const pfad of pfade) {
    await db.insert(pageViews)
      .values({ bucketStart: eimer, path: pfad, viewCount: 1 })
      .onConflictDoUpdate({
        target: [pageViews.bucketStart, pageViews.path],
        set: { viewCount: sql`${pageViews.viewCount} + 1`, updatedAt: sql`CURRENT_TIMESTAMP` },
      });
  }
}
