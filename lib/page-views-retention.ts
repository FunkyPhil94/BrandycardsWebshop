import { lt, sql } from "drizzle-orm";
import type { getDb } from "../db";
import { pageViewArchive, pageViews } from "../db/schema";
import { aufrufAufbewahrungGrenze } from "./page-views";

/**
 * Lässt abgelaufene Aufrufeimer verfallen — **ohne den Gesamtstand zu
 * verlieren.**
 *
 * Die Reihenfolge ist der ganze Punkt: erst die ablaufenden Eimer ins Archiv
 * summieren, dann löschen. Umgekehrt oder getrennt wäre es ein Zähler, der
 * ab Tag 91 rückwärts läuft.
 *
 * **Beides geht als `batch` an D1 und damit in einer Transaktion.** Zwei
 * einzelne Anweisungen hätten zwei Arten, halb zu misslingen: Bricht es nach
 * dem Archivieren ab, werden dieselben Eimer beim nächsten Lauf ein zweites
 * Mal archiviert und der Gesamtstand ist zu hoch; bricht es nach dem Löschen
 * ab, sind die Aufrufe weg. Keiner der beiden Fälle fiele jemandem auf.
 *
 * Der Lesevorgang davor braucht keine Absicherung: Die betroffenen Eimer sind
 * 90 Tage alt, in sie schreibt niemand mehr.
 */
export async function foldExpiredPageViews(db: ReturnType<typeof getDb>, jetzt: Date = new Date()) {
  const grenze = aufrufAufbewahrungGrenze(jetzt);

  const abgelaufen = await db.select({
    pfad: pageViews.path,
    summe: sql<number>`sum(${pageViews.viewCount})`,
  }).from(pageViews)
    .where(lt(pageViews.bucketStart, grenze))
    .groupBy(pageViews.path);

  if (abgelaufen.length === 0) return { archiviert: 0, muster: 0 };

  await db.batch([
    db.insert(pageViewArchive)
      .values(abgelaufen.map((zeile) => ({ path: zeile.pfad, viewCount: Number(zeile.summe) })))
      .onConflictDoUpdate({
        target: pageViewArchive.path,
        set: { viewCount: sql`${pageViewArchive.viewCount} + excluded.view_count`, updatedAt: sql`CURRENT_TIMESTAMP` },
      }),
    db.delete(pageViews).where(lt(pageViews.bucketStart, grenze)),
  ]);

  return {
    archiviert: abgelaufen.reduce((summe, zeile) => summe + Number(zeile.summe), 0),
    muster: abgelaufen.length,
  };
}
