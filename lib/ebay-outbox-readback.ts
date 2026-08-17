// Mit Endung, und das ist Absicht: Nur so lädt Node das Modul im Test. Die
// endungslose Schreibweise in `ebay-outbox.ts` funktioniert allein, weil jene
// Datei ausschließlich gebündelt wird.
import { getEbayAvailability } from "./ebay-client.ts";
import { notifyOperationalAlert } from "./ops-alerts.ts";

/** Nachlesen, was bei eBay nach einer Rücknahme wirklich steht.
 *
 * **Eigenes Modul, und das aus einem konkreten Grund.** `lib/ebay-outbox.ts`
 * importiert `../db` als Verzeichnis und ist damit aus den Node-Tests nicht
 * ladbar — deshalb prüft bis heute kein Test die Outbox-Schleife. Die
 * entscheidbaren Teile gehören auf diese Seite der Grenze, wie es
 * `ebay-outbox-plan.ts` schon vormacht.
 */

/** Ob die nachgelesene Menge ein Problem anzeigt.
 *
 * `null` heißt „nicht ablesbar", nicht „nicht null". Ohne diese Unterscheidung
 * meldete jede unvollständige eBay-Antwort einen Doppelverkauf — dieselbe Linie,
 * die `AssistantSalesChannel.available` und die `UNAVAILABLE`-Codes ziehen:
 * „nichts da" ist nicht „nicht nachgesehen".
 */
export function istMengeVerdaechtig(menge: number | null): boolean {
  return menge !== null && menge > 0;
}

type Verfuegbarkeitsabfrage = (ids: string[]) => Promise<Map<string, { quantityAvailable: number | null }>>;

/** Liest nach einer Rücknahme nach, was bei eBay wirklich steht.
 *
 * **`Ack: Success` ist nicht dasselbe wie „die Menge ist 0".** Bis zum
 * 2026-08-17 belegte ein erfolgreicher Auftrag nur, dass eBay die Anfrage
 * angenommen hat; der Abnahmetest am 2026-08-08 lief gegen ein bereits
 * beendetes Angebot. Ob die Menge eines **laufenden** Angebots tatsächlich auf 0
 * fällt, hat nie jemand gesehen — und genau das ist die Richtung, die
 * Doppelverkäufe verhindert.
 *
 * Damit wird der nächste echte Verkauf zum Beleg, ohne dass jemand im richtigen
 * Moment mitlesen muss.
 *
 * **Streng informativ:** Ein Fehlschlag hier lässt den Auftrag `SUCCEEDED`. Der
 * Schreibvorgang war erfolgreich, und eine Diagnose darf den Geschäftsvorgang
 * nicht gefährden — ein Wurf an dieser Stelle schickte den Auftrag in
 * `RETRY_WAIT` und setzte dieselbe Menge ein zweites Mal.
 *
 * Kosten: ein Trading-Aufruf je erfolgreicher Rücknahme. Der Topf von 5 000
 * Aufrufen/Tag ist geteilt (siehe `tests/ebay-stock-check.test.mjs`);
 * Rücknahmen entstehen einmal je verkaufter Karte und fallen darin nicht auf.
 */
export async function pruefeMengeNach(
  job: { id: string; ebayItemId: string | null },
  verfuegbarkeit: Verfuegbarkeitsabfrage = getEbayAvailability,
  alarm: typeof notifyOperationalAlert = notifyOperationalAlert,
) {
  if (!job.ebayItemId) return;
  try {
    const menge = (await verfuegbarkeit([job.ebayItemId])).get(job.ebayItemId)?.quantityAvailable ?? null;
    console.log("[ebay-outbox] Menge nach der Rücknahme nachgelesen.", { jobId: job.id, ebayItemId: job.ebayItemId, menge });

    // **Der Fall, der bleibend wichtig ist.** Meldet eBay Erfolg, während die
    // Menge danach nicht 0 ist, wäre die Karte hier verkauft und dort weiter
    // käuflich — ein stiller Doppelverkaufspfad.
    if (istMengeVerdaechtig(menge)) {
      await alarm({
        key: `ebay-outbox:${job.id}:menge-nicht-null`,
        category: "eBay-Rücknahme",
        title: "eBay meldete Erfolg, das Angebot ist aber weiter käuflich",
        detail: `Für eBay-Artikel ${job.ebayItemId} wurde die Menge auf 0 gesetzt und der Aufruf war erfolgreich; nachgelesen steht dort weiterhin ${menge}. Die Karte ist im Shop verkauft und bei eBay möglicherweise noch zu haben.`,
      });
    }
  } catch (error) {
    console.warn("[ebay-outbox] Menge konnte nach der Rücknahme nicht nachgelesen werden.", { jobId: job.id, ebayItemId: job.ebayItemId, error });
  }
}
