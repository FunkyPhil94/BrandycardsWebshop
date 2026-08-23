-- Serie, Reihe und Veredelung als eigene Spalten an `products`.
--
-- Anlass: Der Vorverkauf soll sich auf ein Set und darin auf eine Variante
-- einschränken lassen, bevor „Premier League Merlin" als zweites Set dazukommt.
--
-- **Warum nicht aus dem Titel lesen.** Die Auskunft steht dort bereits, aber
-- als Fließtext -- und im selben Feld stehen rund 270 eBay-Titel, die über
-- Jahre unterschiedlich gebaut wurden. Ein Zerleger dafür wäre eine Sammlung
-- von Sonderfällen, die bei jedem neuen Set nachgezogen werden müsste, und
-- seine Fehlgriffe wären stumm: eine Karte, die unter keinem Filter auftaucht,
-- fällt niemandem auf.
--
-- Nullbar und ohne Vorgabewert: eBay-Karten haben diese Angaben nicht und
-- sollen sie auch nicht vortäuschen. Die vorhandenen 208 Vorverkaufskarten
-- füllt der nächste Lauf der Massenanlage nach -- ihr Zustand `aktualisieren`
-- greift künftig auch bei fehlender Serie, nicht nur bei abweichender Menge.
--
-- Kein Index: Der Vorverkauf umfasst gut 200 Zeilen, und `origin = 'MANUAL'`
-- ist bereits indiziert. Ein Index auf `series` würde hier nichts messbar
-- machen, was nicht ohnehin schnell ist.
--
-- Von Hand geschrieben, weil `drizzle/meta/_journal.json` bei 0002 endet
-- (siehe CLAUDE.md).
ALTER TABLE products ADD COLUMN series TEXT;
ALTER TABLE products ADD COLUMN variant TEXT;
ALTER TABLE products ADD COLUMN parallel TEXT;
