"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Meldet jeden sichtbar gewordenen Seitenaufruf an `/api/page-views`.
 *
 * Steht im Wurzel-Layout und damit auf jeder Seite. **Zählt im Browser und
 * nicht im Worker**, weil der Worker zusätzlich Suchmaschinen, Vorabrufe und
 * jede nachgeladene Datei sähe — die Zahl im Adminbereich wäre ein Vielfaches
 * dessen, was jemand tatsächlich angesehen hat.
 *
 * Es wird nichts gespeichert, gelesen oder gesetzt: kein Cookie, keine
 * Kennung, keine Sitzungsnummer. Die Meldung enthält den Pfad und sonst nichts.
 */
export function ViewTracker() {
  const pathname = usePathname();
  // React ruft Effekte im Entwicklungsmodus doppelt auf, und `usePathname`
  // liefert bei einem Rerender denselben Wert. Ohne diese Merkstelle stünde
  // jeder Aufruf zweimal in der Zählung.
  const zuletztGemeldet = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || zuletztGemeldet.current === pathname) return;
    zuletztGemeldet.current = pathname;

    // `keepalive`, damit die Meldung auch dann noch abgeht, wenn der Besucher
    // im selben Moment weiterklickt. `sendBeacon` schiede aus: Der Worker
    // weist JSON-Anfragen ohne `content-length` mit 411 ab, und das Setzen
    // dieser Kopfzeile liegt bei `sendBeacon` nicht in unserer Hand.
    //
    // Der Fehlerfall ist bewusst leer. Ein Zähler, der dem Besucher eine rote
    // Zeile in die Konsole schreibt, ist schlimmer als ein Zähler, der einen
    // Aufruf verpasst.
    void fetch("/api/page-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
