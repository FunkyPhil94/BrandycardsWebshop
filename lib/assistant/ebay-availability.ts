/** Übersetzt den Zustand einer lesenden eBay-Quelle in eine Assistant-Antwort.
 *
 * Bewusst ohne Datenbank und ohne eBay, damit jeder der sechs Fälle geprüft
 * werden kann, ohne etwas anzuschließen.
 *
 * **Der Kern:** Eine leere Tabelle ist mehrdeutig. Sie kann heißen „das
 * Postfach ist leer", „wir durften nie hineinsehen" oder „wir haben noch nicht
 * nachgesehen". Nur `ebay_read_syncs` weiß, welcher der drei Fälle vorliegt —
 * und diese Funktion ist die einzige Stelle, an der daraus eine Aussage wird.
 */

import type { EbayReadSyncStatus } from "../../db/schema.ts";
import type { AssistantUnavailableCode } from "./contracts.ts";

export type EbayReadSyncState = {
  status: EbayReadSyncStatus;
  lastSuccessAt: string | null;
};

export type EbayReadAvailability =
  | { available: true; freshness: string | null }
  | { available: false; code: AssistantUnavailableCode; message: string };

/** Wie die Quelle in der Antwort heißen soll — für einen lesbaren Satz. */
export type EbayReadSourceLabel = "Aufrufzahlen" | "eBay-Postfach" | "Käufer-Preisvorschläge";

const SCOPE_HINT: Record<EbayReadSourceLabel, string> = {
  // Nur bei den Aufrufzahlen ist der fehlende Scope der erwartete Zustand und
  // der Weg heraus bekannt: Die Zustimmung fordert heute nur `sell.inventory`
  // an. Bei den anderen beiden wäre derselbe Satz eine Vermutung.
  "Aufrufzahlen": " Dafür ist der Scope sell.analytics.readonly nötig; die vorhandene eBay-Zustimmung deckt ihn nicht ab und muss vom Kontoinhaber erneuert werden.",
  "eBay-Postfach": " Die vorhandene eBay-Zustimmung reicht dafür nicht aus.",
  "Käufer-Preisvorschläge": " Die vorhandene eBay-Zustimmung reicht dafür nicht aus.",
};

export function ebayReadAvailability(
  state: EbayReadSyncState | undefined,
  label: EbayReadSourceLabel,
): EbayReadAvailability {
  if (!state) {
    return {
      available: false,
      code: "NOT_SYNCED",
      message: `${label}: Es gab noch keinen Abruf bei eBay, es liegen also keine Daten vor.`,
    };
  }

  switch (state.status) {
    case "OK":
      return { available: true, freshness: state.lastSuccessAt };
    case "NOT_CONFIGURED":
      return {
        available: false,
        code: "SOURCE_NOT_CONNECTED",
        message: `${label}: Die eBay-Zugangsdaten sind auf dem Server nicht hinterlegt.`,
      };
    case "SCOPE_NOT_GRANTED":
      return {
        available: false,
        code: "SCOPE_NOT_GRANTED",
        message: `${label}: eBay verweigert den lesenden Zugriff.${SCOPE_HINT[label]}`,
      };
    case "RATE_LIMITED":
      return {
        available: false,
        code: "RATE_LIMITED",
        message: `${label}: Das eBay-Aufrufkontingent war beim letzten Abruf erschöpft.${
          state.lastSuccessAt ? " Es liegt ein älterer Stand vor, der hier bewusst nicht als aktuell ausgegeben wird." : ""
        }`,
      };
    case "UPSTREAM_ERROR":
      return {
        available: false,
        code: "UPSTREAM_ERROR",
        // Ohne Fremdtext: Was eBay im Fehlerfall schreibt, ist übersetzt,
        // wechselhaft und gelegentlich technisch -- in einer Sprachantwort hat
        // es nichts verloren. Der Grund steht in `ebay_read_syncs.detail`.
        message: `${label}: Der letzte Abruf bei eBay ist fehlgeschlagen.${
          state.lastSuccessAt ? " Es liegt ein älterer Stand vor, der hier bewusst nicht als aktuell ausgegeben wird." : ""
        }`,
      };
  }
}
