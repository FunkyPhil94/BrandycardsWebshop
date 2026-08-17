"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "./admin-auth";
import { ViewsPanel } from "./views-panel";

type Counts = { products: number; inquiries: number; cardSubmissions: number; orders: number };

/** Die Übersicht: „wie läuft es gerade?" und nichts anderes.
 *
 * `ViewsPanel` steht hier und nicht in einem eigenen Bereich, weil es dieselbe
 * Frage beantwortet wie die Bestandszahlen darüber. Die Begründung stand vor der
 * Aufteilung schon an dieser Stelle und gilt unverändert.
 */
export default function AdminUebersichtPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/dashboard", { headers: await authHeaders() });
        const body = await response.json() as { counts?: Counts; error?: string };
        if (!response.ok || !body.counts) throw new Error(body.error ?? "Kennzahlen konnten nicht geladen werden.");
        if (!cancelled) setCounts(body.counts);
      } catch (error) {
        if (!cancelled) setNote(error instanceof Error ? error.message : "Kennzahlen konnten nicht geladen werden.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <>
    <h1>Übersicht.</h1>
    {note && <p className="form-feedback error" role="status">{note}</p>}
    {counts && <div className="admin-stats">
      <div><strong>{counts.products}</strong><span>Produkte</span></div>
      <div><strong>{counts.inquiries}</strong><span>Anfragen</span></div>
      <div><strong>{counts.cardSubmissions}</strong><span>Kartenangebote</span></div>
      <div><strong>{counts.orders}</strong><span>Bestellungen</span></div>
    </div>}
    <ViewsPanel />
  </>;
}
