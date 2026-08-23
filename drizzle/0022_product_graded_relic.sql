-- Bewertung und Relikt als eigene Spalten an `products`.
--
-- Anlass: Der Vorverkauf bekommt eine Reihe Checkboxen -- Numbered, Autograph,
-- Graded, Relic. Die ersten beiden gab es schon (Migration 0021), diese beiden
-- fehlten.
--
-- **Beide als 0/1, nicht als Text.** Die Note einer Bewertung ("PSA 10") und
-- die Art eines Relikts ("Jersey") gehören in den Titel, wo der Kunde sie
-- liest. Der Filter beantwortet nur die Ja-Nein-Frage; ein Textfeld hier wäre
-- eine zweite, ungepflegte Wahrheit neben dem Titel.
--
-- `NOT NULL DEFAULT 0`: Eine Karte, bei der niemand etwas eingetragen hat, ist
-- nicht bewertet und kein Relikt. `NULL` als dritter Zustand brächte nichts,
-- was die Oberfläche unterscheiden könnte.
--
-- Von Hand geschrieben, weil `drizzle/meta/_journal.json` bei 0002 endet
-- (siehe CLAUDE.md).
ALTER TABLE products ADD COLUMN graded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN relic INTEGER NOT NULL DEFAULT 0;
