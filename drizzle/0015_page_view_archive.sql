-- Der Gesamtstand der Aufrufe, unabhaengig von der Aufbewahrungsfrist.
--
-- Handgeschrieben wie 0003-0014, aus demselben Grund: drizzle/meta/_journal.json
-- endet bei 0002, `npm run db:generate` erzeugte alle Migrationen erneut.
--
-- **Warum es diese Tabelle ueberhaupt gibt.** Naheliegend waere gewesen,
-- „insgesamt" als `SUM(view_count) FROM page_views` zu lesen. Das waere aber
-- nicht der Gesamtstand, sondern „letzte 90 Tage": Der geplante Lauf loescht
-- aeltere Eimer. Ab Tag 91 wuerde die Zahl anfangen zu schrumpfen, obwohl der
-- Shop mehr Aufrufe hat als je zuvor -- und niemand haette einen Anlass, das zu
-- hinterfragen.
--
-- Der Cron summiert ablaufende Eimer deshalb hierher, bevor er sie loescht.
-- Der Gesamtstand ist damit Archiv + noch vorhandene Eimer. Die Alternative --
-- bei jedem Aufruf zusaetzlich einen Gesamtzaehler hochzuzaehlen -- haette den
-- Weg jedes Besuchers zwei Schreibvorgaenge statt einen gekostet.
CREATE TABLE IF NOT EXISTS `page_view_archive` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	-- Dasselbe normalisierte Muster wie in `page_views`.
	`path` text NOT NULL,
	-- Summe aller bereits geloeschten Eimer dieses Musters.
	`view_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
-- Traegt das Aufaddieren beim Ablauf: `ON CONFLICT (path) DO UPDATE`.
CREATE UNIQUE INDEX IF NOT EXISTS `page_view_archive_path_unique` ON `page_view_archive` (`path`);
