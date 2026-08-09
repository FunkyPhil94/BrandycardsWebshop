"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "./admin-auth";

type Job = {
  id: string;
  operation: string;
  ebayItemId: string | null;
  status: string;
  attemptCount: number;
  availableAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
};

const LABEL: Record<string, string> = {
  PENDING: "Wartet", PROCESSING: "Läuft", RETRY_WAIT: "Wartet auf Wiederholung",
  SUCCEEDED: "Erledigt", FAILED: "Fehlgeschlagen", CANCELLED: "Abgebrochen",
};

function datum(wert: string | null) {
  if (!wert) return "—";
  const zeit = new Date(wert);
  return Number.isNaN(zeit.getTime()) ? wert : zeit.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

/** Die eBay-Warteschlange (ai-todo Punkt 12.5).
 *
 * **Warum das eine eigene Ansicht verdient:** Verkauft der Shop eine Karte,
 * nimmt ein Auftrag von hier sie bei eBay zurück. Bleibt er hängen, steht die
 * Karte dort weiter im Verkauf — und der nächste Käufer bei eBay bekommt etwas,
 * das es nicht mehr gibt. Bis zum 2026-08-09 war das nur in der Datenbank zu
 * sehen.
 */
export function OutboxPanel() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [writeEnabled, setWriteEnabled] = useState(true);
  const [alle, setAlle] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/admin/ebay/outbox${alle ? "?alle=1" : ""}`, { headers: await authHeaders() });
        const data = await response.json() as { jobs?: Job[]; writeEnabled?: boolean; error?: string };
        if (!response.ok || !data.jobs) throw new Error(data.error ?? "Die Warteschlange konnte nicht geladen werden.");
        if (cancelled) return;
        setJobs(data.jobs);
        setWriteEnabled(data.writeEnabled !== false);
      } catch (error) {
        if (cancelled) return;
        setNote(error instanceof Error ? error.message : "Die Warteschlange konnte nicht geladen werden.");
        setJobs([]);
      }
    })();
    return () => { cancelled = true; };
  }, [alle]);

  if (!jobs) return null;

  return <section className="admin-section">
    <h2>eBay-Warteschlange ({jobs.length})</h2>
    {/* Ohne diesen Hinweis läse sich eine Liste voller „Wartet" wie ein Stau,
        während in Wahrheit gar nichts ausgeführt wird. */}
    {!writeEnabled && <p className="form-feedback error" role="status">
      <strong>EBAY_WRITE_ENABLED ist aus.</strong> Aufträge sammeln sich an, werden aber nicht ausgeführt — verkaufte Karten bleiben bei eBay im Verkauf.
    </p>}
    {note && <p className="form-feedback" role="status">{note}</p>}
    <div className="admin-products-toolbar">
      <label className="admin-outbox-toggle">
        <input type="checkbox" checked={alle} onChange={(event) => setAlle(event.target.checked)} /> Auch erledigte anzeigen
      </label>
    </div>
    {jobs.length === 0
      ? <p className="form-feedback">{alle ? "Die Warteschlange ist leer." : "Nichts hängt — alle Aufträge sind erledigt."}</p>
      : <div className="admin-orders">
          {jobs.map((job) => <article className={`admin-outbox-job${job.status === "FAILED" ? " ist-fehler" : ""}`} key={job.id}>
            <div className="admin-outbox-head">
              <span className={`admin-order-status status-${job.status.toLowerCase()}`}>{LABEL[job.status] ?? job.status}</span>
              <span className="admin-order-mono">{job.ebayItemId ?? "—"}</span>
              <span>{job.operation}</span>
              <span>{job.attemptCount} Versuch(e)</span>
            </div>
            <dl className="admin-order-facts">
              <div><dt>Angelegt</dt><dd>{datum(job.createdAt)}</dd></div>
              <div><dt>Letzter Versuch</dt><dd>{datum(job.lastAttemptAt)}</dd></div>
              {/* Der nächste Versuchszeitpunkt beantwortet die eigentliche
                  Frage bei einem hängenden Auftrag: warten oder eingreifen? */}
              <div><dt>Nächster Versuch</dt><dd>{datum(job.availableAt)}</dd></div>
            </dl>
            {job.lastError && <p className="admin-outbox-error">{job.lastError}</p>}
          </article>)}
        </div>}
  </section>;
}
