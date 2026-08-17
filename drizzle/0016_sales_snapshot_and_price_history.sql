-- Historie mitschreiben statt wegwerfen.
--
-- **Der Befund vom 2026-08-17.** Gefragt war, welche Artikel besser laufen,
-- welche Preislagen sich verkaufen und ob Reduzieren hilft. Beim Nachsehen in
-- Produktion: Von 158 Verkaeufen liessen sich nur 52 ihrem Angebot zuordnen,
-- `category_id` und `condition_id` waren fuer **alle 535** Angebote leer, und
-- eine Preishistorie gab es nirgends. Nicht der Assistent war der Engpass --
-- die Datenbank warf weg, was die Fragen beantwortet haette.
--
-- Rein additiv: Keine bestehende Spalte aendert ihre Bedeutung, keine Zeile
-- wird umgeschrieben. Rueckwirkend fuellen laesst sich nichts davon; die 106
-- verwaisten Verkaeufe bleiben leer. Der Nutzen faengt ab jetzt an.

-- --- 1) Momentaufnahme des Angebots auf der Verkaufszeile --------------------
--
-- Verschwindet ein Angebot bei eBay, bleibt die Verkaufszeile stehen -- Preis,
-- Kategorie und Zustand aber sind weg. Was hier steht, wird beim Einsammeln
-- kopiert, solange das Angebot noch da ist, und ueberlebt es damit.
--
-- `item_price_cents` ist der Postenpreis **ohne Versand und Steuern**
-- (`lineItemCost`), ausdruecklich getrennt von `amount_cents` aus `total`.
-- Beide zu vermischen hiesse, den ausgewiesenen Umsatzbegriff rueckwirkend zu
-- aendern: Bestehende Zeilen bekaemen eine neue Bedeutung, ohne dass es ihnen
-- anzusehen waere. Fuer die Frage "welche Preislage verkauft sich" ist der
-- Wert ohne Versand der richtige -- Versand variiert nach Ziel und sagt ueber
-- die Karte nichts.
ALTER TABLE `ebay_sales` ADD `item_price_cents` integer;
ALTER TABLE `ebay_sales` ADD `listing_price_cents` integer;
ALTER TABLE `ebay_sales` ADD `category_id` text;
ALTER TABLE `ebay_sales` ADD `condition_id` text;

-- --- 2) Jede tatsaechliche Preisaenderung -----------------------------------
--
-- `ebay_listings.price_amount_cents` traegt immer nur den aktuellen Preis; der
-- Sync ueberschreibt ihn im Drei-Minuten-Takt. Ob ein Preis je gesenkt wurde
-- und was danach geschah, stand deshalb nirgends -- und ohne das ist "hilft es
-- zu reduzieren?" nicht beantwortbar, sondern nur beantwortbar *aussehend*.
--
-- Geschrieben wird **nur bei echter Aenderung**. Ein Eintrag je Lauf waere bei
-- 535 Angeboten alle drei Minuten ein Vielfaches der Nutzdaten -- genau der
-- Fehler, den `sync_events` schon einmal gemacht hat (~31 700 Zeilen in 24
-- Stunden, ohne je eine Frage zu beantworten).
--
-- Die Zeile haengt am `ebay_item_id`, nicht am Angebotsdatensatz: Sie soll auch
-- dann noch dastehen, wenn das Angebot laengst weg ist. Deshalb auch **kein**
-- Fremdschluessel mit `ON DELETE cascade` -- der loeschte genau die Historie,
-- derentwegen die Tabelle existiert.
CREATE TABLE IF NOT EXISTS `ebay_listing_price_history` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`ebay_item_id` text NOT NULL,
	`product_id` text,
	-- `null` beim allerersten beobachteten Preis: Es gab keinen vorherigen.
	-- Eine 0 stuende fuer "war vorher gratis" und waere schlicht falsch.
	`vorher_cents` integer,
	`nachher_cents` integer,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`changed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS `ebay_price_history_item_idx`
	ON `ebay_listing_price_history` (`ebay_item_id`, `changed_at`);
