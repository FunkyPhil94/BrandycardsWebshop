-- Benutzer- und Anzeigename entfernen (U5).
--
-- Beide wurden nirgends angezeigt: nicht in E-Mails, nicht in Bestellungen,
-- nicht im Adminbereich, nicht im Checkout. Der Versand nutzt die Adresse aus
-- der Bestellung, die Anmeldung die E-Mail-Adresse. Was blieb, waren
-- personenbezogene Daten ohne Zweck -- und ein Sperr-Risiko: `username` kam aus
-- Supabase-`user_metadata`, das der Kunde selbst beschreiben kann, und lief
-- gegen `users_username_unique` bei jeder authentifizierten Anfrage.
--
-- Der Index muss zuerst weg: SQLite verweigert DROP COLUMN auf einer
-- indizierten Spalte.
--
-- Von Hand geschrieben, weil `drizzle/meta/_journal.json` bei 0002 endet
-- (siehe CLAUDE.md).
DROP INDEX IF EXISTS users_username_unique;
ALTER TABLE users DROP COLUMN username;
ALTER TABLE users DROP COLUMN display_name;
