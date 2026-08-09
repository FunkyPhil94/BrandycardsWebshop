import { desc, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { ebayOutbox } from "../../../../../db/schema";
import { requireAdmin } from "../../../../../lib/admin-access";

const PAGE_SIZE = 25;

/** Die eBay-Warteschlange zum Ansehen (ai-todo Punkt 12.5).
 *
 * **Der Grund für diese Route:** Hängende Rücknahmen waren bis zum 2026-08-09
 * unsichtbar. Verkauft der Shop eine Karte, wird bei eBay die Menge auf 0
 * gesetzt — scheitert das dauerhaft, bleibt die Karte dort im Verkauf, und ein
 * Doppelverkauf ist genau der Fall, den die Outbox verhindern soll. Wer davon
 * nichts sieht, merkt es erst am Storno.
 *
 * Deshalb liefert die Antwort **`lastError` und `availableAt` mit**: „FAILED"
 * allein beantwortet keine Frage. Interessant ist, *woran* es scheiterte und
 * *wann* der nächste Versuch läuft.
 *
 * `payload` bleibt draußen — die Rohdaten des Auftrags helfen beim Lesen nicht
 * und machen die Antwort nur groß.
 */
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard.response) return guard.response;

  try {
    const db = getDb();
    const url = new URL(request.url);
    // Standardmäßig ohne die erledigten: Der Betreiber sucht hier nach
    // Problemen, nicht nach Bestätigungen. `?alle=1` zeigt trotzdem alles.
    const alle = url.searchParams.get("alle") === "1";

    const rows = await db.select({
      id: ebayOutbox.id,
      operation: ebayOutbox.operation,
      ebayItemId: ebayOutbox.ebayItemId,
      status: ebayOutbox.status,
      attemptCount: ebayOutbox.attemptCount,
      availableAt: ebayOutbox.availableAt,
      lastAttemptAt: ebayOutbox.lastAttemptAt,
      succeededAt: ebayOutbox.succeededAt,
      lastError: ebayOutbox.lastError,
      createdAt: ebayOutbox.createdAt,
    }).from(ebayOutbox)
      .where(alle ? undefined : ne(ebayOutbox.status, "SUCCEEDED"))
      .orderBy(desc(ebayOutbox.createdAt))
      .limit(PAGE_SIZE);

    return NextResponse.json({
      jobs: rows,
      // Ob der Schreibpfad überhaupt eingeschaltet ist. Ohne diese Zahl läse
      // sich eine Liste voller `PENDING` wie ein Stau, während in Wahrheit
      // nichts ausgeführt wird.
      writeEnabled: process.env.EBAY_WRITE_ENABLED === "true",
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("admin outbox list failed", error);
    return NextResponse.json({ error: "Die eBay-Warteschlange konnte nicht geladen werden." }, { status: 503 });
  }
}
