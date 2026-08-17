import { gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { pageViewArchive, pageViews } from "../../../../db/schema";
import { requireAdmin } from "../../../../lib/admin-access";
import { AUFRUF_FENSTER, fensterBeginn, type AufrufFenster } from "../../../../lib/page-views";

/** Die Aufrufzahlen für die drei Fenster des Adminbereichs.
 *
 * **Eine Abfrage für alle drei.** Drei getrennte Abfragen läsen dieselben
 * Eimer bis zu dreimal — die 24 Stunden liegen vollständig in den 7 Tagen und
 * die in den 30. Gelesen wird deshalb einmal das größte Fenster, und die
 * kleineren entstehen daraus über bedingte Summen.
 */
export async function GET(request: Request) {
  try {
    const access = await requireAdmin(request);
    if (access.response) return access.response;

    const db = getDb();
    const jetzt = new Date();
    const beginn = Object.fromEntries(
      (Object.keys(AUFRUF_FENSTER) as AufrufFenster[]).map((fenster) => [fenster, fensterBeginn(fenster, jetzt)]),
    ) as Record<AufrufFenster, string>;

    const summe = (fenster: AufrufFenster) =>
      sql<number>`coalesce(sum(case when ${pageViews.bucketStart} >= ${beginn[fenster]} then ${pageViews.viewCount} else 0 end), 0)`;

    const [zeilen, [erfassung], [alleEimer], [archiv]] = await Promise.all([
      db.select({
        pfad: pageViews.path,
        tag: summe("tag"),
        woche: summe("woche"),
        monat: summe("monat"),
      }).from(pageViews)
        .where(gte(pageViews.bucketStart, beginn.monat))
        .groupBy(pageViews.path),
      // Ohne diesen Zeitpunkt wäre „30 Tage: 40" nicht zu deuten. Solange die
      // Messung jünger als 30 Tage ist, ist die Zahl kein Monatswert, sondern
      // alles, was es überhaupt gibt — und der Betreiber muss das sehen können,
      // statt es zu erraten.
      db.select({ erstesEimer: sql<string | null>`min(${pageViews.bucketStart})` }).from(pageViews),
      // Der Gesamtstand steht in **zwei** Tabellen, und das ist kein Versehen:
      // `page_views` hält nur, was jünger als die Aufbewahrungsfrist ist. Wer
      // hier `page_view_archive` wegließe, bekäme keine Gesamtzahl, sondern
      // eine, die ab Tag 91 schrumpft. Siehe `lib/page-views-retention.ts`.
      db.select({ summe: sql<number>`coalesce(sum(${pageViews.viewCount}), 0)` }).from(pageViews),
      db.select({ summe: sql<number>`coalesce(sum(${pageViewArchive.viewCount}), 0)` }).from(pageViewArchive),
    ]);

    // Die Aufschlüsselung folgt dem größten Fenster, damit die Reihenfolge
    // nicht springt, sobald in den letzten 24 Stunden wenig los war.
    const seiten = zeilen
      .map((zeile) => ({ pfad: zeile.pfad, tag: Number(zeile.tag), woche: Number(zeile.woche), monat: Number(zeile.monat) }))
      .filter((zeile) => zeile.monat > 0)
      .sort((a, b) => b.monat - a.monat || a.pfad.localeCompare(b.pfad));

    const gesamt = (fenster: AufrufFenster) => seiten.reduce((summe, zeile) => summe + zeile[fenster], 0);

    return NextResponse.json({
      ok: true,
      erfasstSeit: erfassung?.erstesEimer ?? null,
      fenster: {
        tag: { titel: AUFRUF_FENSTER.tag.titel, gesamt: gesamt("tag") },
        woche: { titel: AUFRUF_FENSTER.woche.titel, gesamt: gesamt("woche") },
        monat: { titel: AUFRUF_FENSTER.monat.titel, gesamt: gesamt("monat") },
        insgesamt: { titel: "Insgesamt", gesamt: Number(alleEimer?.summe ?? 0) + Number(archiv?.summe ?? 0) },
      },
      seiten,
    });
  } catch (error) {
    console.error("Aufrufzahlen konnten nicht gelesen werden", error);
    return NextResponse.json({ error: "Aufrufzahlen sind derzeit nicht verfügbar." }, { status: 503 });
  }
}
