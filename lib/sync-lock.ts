/** Sperre und Fristen für den eBay-Import.
 *
 * Warum es dieses Modul gibt — der Ausfall vom 2026-08-07:
 * Ein Lauf blieb hängen und legte den Import über eine Stunde still. Die
 * Sperre in `lib/ebay-sync.ts` war ein Wahrheitswert, der nur im `finally`
 * eines `await` zurückgesetzt wurde. Kommt dieses `await` nie zurück — weil
 * ein `fetch` ohne Zeitgrenze wartet oder weil Cloudflare den Aufruf abräumt —,
 * bleibt die Sperre für die Lebensdauer des Isolates gesetzt. Jeder weitere
 * Cron-Schlag im selben Isolate flog sofort mit „läuft bereits" heraus.
 *
 * Zwei Lehren, beide hier abgebildet:
 * 1. **Eine Sperre braucht eine Verfallszeit, keinen Wahrheitswert.** Ein
 *    abgestürzter Lauf darf sie höchstens so lange halten, wie ein Lauf dauern
 *    darf.
 * 2. **Zeitstempel aus dieser Datenbank sind keine vergleichbaren
 *    Zeichenketten.** Siehe `isSyncRunStale`.
 *
 * Bewusst ohne Datenbank- und Netzabhängigkeit, damit `tests/ebay-sync-timeout.test.mjs`
 * das Verhalten ohne D1 und ohne eBay prüfen kann.
 */

import { parseDbTimestamp } from "./retention.ts";

/** Wie lange ein Lauf höchstens dauern darf.
 *
 * Ein gesunder Lauf braucht rund 77 Sekunden (gemessen am 2026-08-07 über
 * mehrere Läufe). Fünf Minuten lassen reichlich Luft für einen langsamen Tag
 * und liegen zugleich unter jedem Cron-Takt, den dieser Shop je hatte — eine
 * abgelaufene Sperre kann also nie einen noch laufenden Import abwürgen.
 */
export const SYNC_RUN_DEADLINE_MS = 5 * 60_000;

/** Ab wann eine `sync_runs`-Zeile auf `RUNNING` als verwaist gilt.
 *
 * Gleich der Frist oben: Länger als die Frist kann ein Lauf nicht ehrlich
 * laufen, also ist alles darüber hinaus eine Leiche. Früher standen hier
 * 30 Minuten — das war der Grund, warum der Import nach einem Absturz so lange
 * brauchte, bis er sich selbst wieder freigab.
 */
export const STALE_RUN_AFTER_MS = SYNC_RUN_DEADLINE_MS;

/** Ist diese `RUNNING`-Zeile eine Leiche?
 *
 * **Die Falle:** `sync_runs.started_at` kommt aus SQLites `CURRENT_TIMESTAMP`
 * und lautet `2026-08-07 13:20:40`; die Vergleichsgrenze wird im Anwendungs-
 * code als ISO-8601 gebildet und lautet `2026-08-07T12:50:40.000Z`. Der frühere
 * Code verglich beide als Zeichenketten. An Stelle 10 steht links ein
 * Leerzeichen (0x20), rechts ein `T` (0x54) — der Vergleich war damit
 * **unabhängig vom Alter immer wahr**. Jede laufende Synchronisierung galt als
 * verwaist, auch eine, die drei Sekunden alt war. Beide Seiten müssen erst zu
 * echten Zeitpunkten werden; `parseDbTimestamp` aus `lib/retention.ts` kann
 * beide Formate.
 *
 * Ohne verwertbaren Zeitstempel wird nichts freigegeben — im Zweifel laufen
 * lassen statt einen gesunden Lauf abzuschießen.
 */
export function isSyncRunStale(
  startedAt: string | null,
  now: Date = new Date(),
  afterMs: number = STALE_RUN_AFTER_MS,
) {
  const stamp = parseDbTimestamp(startedAt);
  if (stamp === null) return false;
  return stamp <= now.getTime() - afterMs;
}

/** Eine Sperre, die von selbst wieder aufgeht.
 *
 * Hält ein Aufrufer sie länger als `leaseMs`, gilt sie als verfallen und der
 * nächste Aufrufer bekommt sie. Das ist der ganze Unterschied zum früheren
 * `localSyncLock`: Ein Lauf, der nie zurückkommt, sperrt jetzt für die Dauer
 * einer Frist statt für die Lebensdauer des Isolates.
 */
export class ExpiringLock {
  #heldSince: number | null = null;

  /** Gibt `true` zurück, wenn die Sperre erworben wurde. */
  tryAcquire(nowMs: number = Date.now(), leaseMs: number = SYNC_RUN_DEADLINE_MS) {
    if (this.#heldSince !== null && nowMs - this.#heldSince < leaseMs) return false;
    this.#heldSince = nowMs;
    return true;
  }

  release() {
    this.#heldSince = null;
  }

  /** Nur für Tests und Diagnose. */
  isHeld(nowMs: number = Date.now(), leaseMs: number = SYNC_RUN_DEADLINE_MS) {
    return this.#heldSince !== null && nowMs - this.#heldSince < leaseMs;
  }
}

/** Stellt eine beliebige Zusage unter eine Frist.
 *
 * Die Zeitgrenzen an den einzelnen `fetch`-Aufrufen (`lib/ebay-client.ts`)
 * decken den wahrscheinlichsten Fall ab, aber nicht jeden: Ein Lauf kann auch
 * an einem `db.batch` hängenbleiben, und der Ausfall vom 2026-08-07 lässt sich
 * im Nachhinein keinem einzelnen `await` zuordnen. Deshalb bekommt zusätzlich
 * der **ganze** Lauf eine Frist — unabhängig davon, wo er stecken bleibt.
 */
export function withDeadline<T>(task: Promise<T>, ms: number, message: string): Promise<T> {
  // Die verspätete Ablehnung der eigentlichen Aufgabe darf den Prozess nicht
  // mit einer unbehandelten Zusage beschäftigen — sie interessiert niemanden
  // mehr, sobald die Frist abgelaufen ist.
  task.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([task, deadline]).finally(() => clearTimeout(timer)) as Promise<T>;
}
