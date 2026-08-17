-- Aufrufzähler des eigenen Shops.
--
-- Handgeschrieben wie 0003-0013. `npm run db:generate` scheidet aus, solange
-- drizzle/meta/_journal.json bei 0002 endet -- der Generator diffte gegen einen
-- Schnappschuss von vor zwoelf Migrationen und erzeugte sie alle noch einmal.
--
-- Ein reines CREATE. Keine bestehende Tabelle wird angefasst, ein Rueckbau
-- besteht aus einem DROP TABLE und loest keine Kaskade aus.
--
-- **Ein Eimer je Stunde und Pfadmuster, kein Ereignisprotokoll.** Eine Zeile je
-- Aufruf waere die naheliegende Form und die falsche: Sie waechst mit dem
-- Erfolg des Shops, und die Auswertung ueber 30 Tage muesste jedes Mal alles
-- lesen. So kostet ein Aufruf denselben einen Schreibvorgang, die Auswertung
-- liest hoechstens 720 Eimer je Muster -- und es gibt schlicht keine Stelle,
-- an der etwas ueber die einzelne Person stehen koennte.
CREATE TABLE IF NOT EXISTS `page_views` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	-- Beginn der Stunde als ISO-8601 in UTC, von der Anwendung geschrieben.
	-- NICHT CURRENT_TIMESTAMP: dessen Format `YYYY-MM-DD HH:MM:SS` liesse sich
	-- mit ISO-8601 nicht vergleichen, und die Fensterabfragen sind Vergleiche.
	`bucket_start` text NOT NULL,
	-- Bereits normalisiert (`lib/page-views.ts`), nie der rohe Pfad.
	`path` text NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
-- Traegt das Hochzaehlen: `ON CONFLICT (bucket_start, path) DO UPDATE`
-- braucht diesen eindeutigen Index, sonst schlaegt jeder zweite Aufruf einer
-- Seite in derselben Stunde fehl.
CREATE UNIQUE INDEX IF NOT EXISTS `page_views_bucket_unique` ON `page_views` (`bucket_start`, `path`);
--> statement-breakpoint
-- Traegt die drei Fenster und die Aufbewahrungsloeschung: beide fragen ueber
-- `bucket_start >= ?` beziehungsweise `< ?`.
CREATE INDEX IF NOT EXISTS `page_views_bucket_idx` ON `page_views` (`bucket_start`);
