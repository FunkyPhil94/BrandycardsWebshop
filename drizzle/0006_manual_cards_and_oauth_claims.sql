-- Drei Vorhaben, eine Migration: manuelle Karten (ai-todo Punkt 11),
-- Handmarkierungen gegen den Sync (Punkt 12.1) und die Anspruchs-Kennung für
-- die eBay-OAuth-Rückseite (SEC-12 aus Punkt 8).
--
-- ============================================================================
-- Warum hier KEIN neuer `kind`-Wert steht, obwohl der Arbeitsvorrat einen
-- verlangte. Zwei Versuche, beide am lokalen D1 durchgespielt, beide verworfen:
--
-- 1. **Neue Tabelle, kopieren, `DROP TABLE products`, umbenennen.** Danach
--    waren `ebay_listings` und `inventory` **leer**. Ist die
--    Fremdschlüsselprüfung aktiv, führt `DROP TABLE` ein stilles `DELETE FROM`
--    aus und löst jede `ON DELETE CASCADE`-Aktion aus. `defer_foreign_keys`
--    hilft nicht — es verschiebt Verletzungsmeldungen, es schaltet keine
--    Aktionen ab. In Produktion hätte das 543 Angebote und den Bestand
--    mitgenommen.
-- 2. **`PRAGMA legacy_alter_table` + Umbenennen der alten Tabelle.** Scheitert
--    hart: Die bestehende CHECK-Bedingung ist qualifiziert geschrieben
--    (`"products"."kind"`), nach dem Umbenennen zeigt sie ins Leere —
--    `no such column: products.kind`.
--
-- **Und `PRAGMA foreign_keys = OFF` greift in D1 nicht.** Gemessen, nicht
-- vermutet: Nach dem Setzen liefert `PRAGMA foreign_keys` weiterhin `1`.
--
-- Damit ist die CHECK-Bedingung auf `kind` auf dieser Datenbank unveränderlich.
-- Die Unterscheidung zieht deshalb `origin` ein, eine Spalte **ohne**
-- CHECK-Bedingung. `kind` bleibt, was es war, und behält seine Bedeutung für
-- den Waisen-Sweep: Der räumt `EBAY_SYNCED` ohne Listing ab, und genau davor
-- müssen manuelle Karten geschützt sein.
--
-- **Die Regel, die daraus folgt und die `tests/manual-cards.test.mjs`
-- festhält:** Manuelle Karten sind `kind = 'PRELISTED'` **und**
-- `origin = 'MANUAL'`. `kind` allein sagt nichts mehr darüber, ob eine Karte
-- käuflich ist — dafür ist `origin` zuständig. In Produktion gab es zum
-- Zeitpunkt dieser Migration **keine einzige** `PRELISTED`-Zeile, die Umdeutung
-- trifft also keinen Bestand.
-- ============================================================================
ALTER TABLE `products` ADD `origin` text DEFAULT 'EBAY' NOT NULL;
--> statement-breakpoint
-- Preis und Währung am Produkt. Bei eBay-Karten stehen sie weiterhin im
-- Listing und bleiben hier leer; eine manuelle Karte hat kein Listing und
-- braucht sie deshalb bei sich.
ALTER TABLE `products` ADD `price_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `products` ADD `price_currency` text DEFAULT 'EUR' NOT NULL;
--> statement-breakpoint
-- Welche Felder von Hand gesetzt wurden, als JSON-Liste von Feldnamen. Der
-- Sync überschreibt jedes Feld, das hier **nicht** steht — und lässt jedes in
-- Ruhe, das darin steht. Ohne diese Spalte macht der nächste Import jede
-- Korrektur des Betreibers wieder zunichte.
ALTER TABLE `products` ADD `manual_overrides` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `products_origin_status_idx` ON `products` (`origin`,`status`);
--> statement-breakpoint
-- Schlüssel für das automatische Zusammenführen: Erscheint eine von Hand
-- eingestellte Karte später bei eBay, findet der Sync sie über den Titel.
CREATE INDEX IF NOT EXISTS `products_origin_title_idx` ON `products` (`origin`,`title`);
--> statement-breakpoint
-- SEC-12: Die eBay-OAuth-Rückseite darf den Refresh-Token nicht mehr in die
-- Antwort auf die Umleitung schreiben — eine Browser-Navigation trägt keine
-- Anmeldung. Der Token wird hier kurz geparkt und **einmalig** vom angemeldeten
-- Adminbereich abgeholt; die Zeile wird beim Abholen gelöscht.
CREATE TABLE IF NOT EXISTS `ebay_oauth_claims` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ebay_oauth_claims_expiry_idx` ON `ebay_oauth_claims` (`expires_at`);
