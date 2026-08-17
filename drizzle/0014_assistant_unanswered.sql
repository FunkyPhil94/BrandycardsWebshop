-- Welche Fragen der Assistent nicht beantworten konnte.
--
-- Der Assistent hat zwoelf Werkzeuge. Welche fehlen, wusste bis hierher
-- niemand: Eine Frage, die in UNSUPPORTED endete, verschwand spurlos, und der
-- Ausbau der Werkzeuge waere damit geraten statt gemessen.
--
-- **Nur Unbeantwortetes.** Beantwortete Fragen stehen hier bewusst nicht: Dort
-- ist bereits bekannt, welche Werkzeuge gegriffen haben, und ein Mitschnitt
-- jeder Frage waere ein wachsendes Taetigkeitsprotokoll ohne zusaetzlichen
-- Nutzen.
--
-- `reason` trennt die Faelle, die in der Antwort gleich aussehen:
--   UNSUPPORTED          -- kein Werkzeug passt fachlich. Das ist eine Luecke.
--   MODEL_NOT_CONFIGURED -- OPENAI_API_KEY fehlt serverseitig.
--   MODEL_FAILED         -- Modell eingerichtet, aber nicht erreichbar.
-- Ohne diese Spalte wuerde eine Betriebsstoerung als Werkzeugbedarf gezaehlt.
CREATE TABLE IF NOT EXISTS `assistant_unanswered` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
	`question` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
-- Nach Grund und Zeit ausgewertet: „was fehlt gerade" ist eine Frage an die
-- letzten Wochen, nicht an die gesamte Historie.
CREATE INDEX IF NOT EXISTS `assistant_unanswered_reason_idx` ON `assistant_unanswered` (`reason`, `created_at`);
