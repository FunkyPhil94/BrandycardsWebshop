-- Entdopplung der Aufrufzählung je Besucheradresse und Tag.
--
-- Bis hierher zählte jeder Seitenaufruf. Ab jetzt zählt eine Adresse je
-- Seitenbereich einmal am Tag, und die Kacheln oben im Adminbereich zählen sie
-- genau einmal -- unabhängig davon, wie viele Bereiche sie besucht hat.
--
-- **Die Adresse selbst wird nicht gespeichert.** In `visit_key` steht
-- SHA-256(Tagessalz + Adresse [+ Pfadmuster]). Das Salz liegt als
-- Cloudflare-Secret `PAGE_VIEW_SALT` und geht zusammen mit dem Datum ein, hat
-- also täglich eine andere Wirkung; in die Datenbank kommt es nie. Ohne das
-- Secret lässt sich aus einer Zeile keine Adresse zurückrechnen, und mit dem
-- Wechsel des Datums passt der Hash von gestern zu keiner Adresse mehr.
--
-- Der Tag steckt **im Schlüssel**, nicht nur in der Spalte: Damit kollidiert
-- der Schlüssel von gestern mit nichts, das Schreiben braucht keine
-- Ablaufprüfung, und `day` dient allein dem Aufräumen durch
-- `foldExpiredPageViews`.
--
-- Die Besucherzahl der Kacheln liegt als eigene Zeile in `page_views` unter dem
-- reservierten Pfad `*besucher`. Der kann mit keinem echten Muster kollidieren
-- (`normalisiereAufrufpfad` gibt nur Pfade zurück, die mit `/` beginnen), und
-- er erbt damit Stundeneimer, Fensterabfragen, Archivierung und Aufbewahrung,
-- ohne dass es davon eine zweite Ausführung gibt.
--
-- Von Hand geschrieben, weil `drizzle/meta/_journal.json` bei 0002 endet
-- (siehe CLAUDE.md).
CREATE TABLE IF NOT EXISTS page_view_visits (
  visit_key TEXT PRIMARY KEY NOT NULL,
  day TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS page_view_visits_day_idx ON page_view_visits (day);
