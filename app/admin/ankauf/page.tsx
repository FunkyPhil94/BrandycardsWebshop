"use client";

import { useEffect, useRef, useState } from "react";
import { authHeaders } from "../admin-auth";
import { RequestsPanel, type Submission } from "../requests-panel";

/** Anfragen und eingesendete Karten.
 *
 * **Der teuerste Bereich, und deshalb ein eigener.** Für jedes eingesendete Bild
 * läuft ein angemeldeter Abruf: Die Dateien liegen nicht öffentlich, ein
 * `<img src="/api/…">` käme ohne Adminkopf an. Bis zum 2026-08-17 passierte das
 * bei **jedem** Aufruf der Adminkonsole — auch wenn man nur eine Bestellung
 * ansehen wollte. Jetzt nur noch hier.
 */
export default function AdminAnkaufPage() {
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [note, setNote] = useState("");
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  /** Die erzeugten Objekt-URLs, für das Freigeben beim Verlassen. In einer Ref
   *  und nicht im Zustand: Freigeben ist kein Rendern, und ein Zustandssetzer im
   *  Aufräumschritt wird von React vorzeitig ausgeführt. */
  const objektUrls = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const headers = await authHeaders();
        const response = await fetch("/api/admin/dashboard", { headers });
        const body = await response.json() as { recentSubmissions?: Submission[]; error?: string };
        if (!response.ok || !body.recentSubmissions) throw new Error(body.error ?? "Kartenangebote konnten nicht geladen werden.");
        if (cancelled) return;
        setSubmissions(body.recentSubmissions);

        const eintraege = await Promise.all(body.recentSubmissions.flatMap((submission) => submission.assets.map(async (asset) => {
          const bild = await fetch(`/api/admin/card-submissions/assets?assetId=${encodeURIComponent(asset.id)}`, { headers });
          if (!bild.ok) return null;
          return [asset.id, URL.createObjectURL(await bild.blob())] as const;
        })));
        const gefunden = eintraege.filter((eintrag): eintrag is readonly [string, string] => eintrag !== null);
        if (cancelled) {
          // Angekommen, nachdem die Seite verlassen wurde: sofort freigeben,
          // sonst bliebe der Speicher bis zum Neuladen belegt.
          for (const [, url] of gefunden) URL.revokeObjectURL(url);
          return;
        }
        objektUrls.current = gefunden.map(([, url]) => url);
        setAssetUrls(Object.fromEntries(gefunden));
      } catch (error) {
        if (!cancelled) setNote(error instanceof Error ? error.message : "Kartenangebote konnten nicht geladen werden.");
      }
    })();
    return () => {
      cancelled = true;
      for (const url of objektUrls.current) URL.revokeObjectURL(url);
      objektUrls.current = [];
    };
  }, []);

  if (note) return <p className="form-feedback error" role="status">{note}</p>;
  if (!submissions) return <p className="form-feedback" role="status">Lade …</p>;

  return <RequestsPanel
    submissions={submissions}
    assetUrls={assetUrls}
    onSubmissionDeleted={(id) => setSubmissions((current) => current?.filter((eintrag) => eintrag.id !== id) ?? current)}
  />;
}
