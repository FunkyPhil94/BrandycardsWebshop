# KI-Übergabe

Diese Datei ist die Übergabestelle zwischen KI-Sitzungen. Sie hält fest, **was
gerade vorhat wird** — nicht erst, was fertig ist.

Der Zweck ist der Abbruchfall: Wenn eine Sitzung mitten in der Arbeit endet, weil
das Token-Kontingent aufgebraucht ist, die Verbindung abreißt oder ein Werkzeug
hängt, muss die nächste KI ohne Rückfragen erkennen können, was geplant war, wie
weit es gediehen ist und was dadurch möglicherweise in einem halben Zustand liegt.

## Regeln

1. **Vor** dem ersten schreibenden oder ausführenden Schritt eines Auftrags wird
   der Abschnitt „Aktueller Auftrag" ausgefüllt und committet. Nicht danach,
   nicht parallel — vorher. Ein Eintrag, der erst nach getaner Arbeit entsteht,
   erfüllt den Zweck dieser Datei nicht.
2. Der Stand wird auf `LÄUFT` gesetzt, sobald die Ausführung beginnt.
3. **Nach** dem Durchlauf wird das Ergebnis eingetragen — **auch und gerade bei
   Fehlschlag oder Abbruch.** Ein fehlgeschlagener Lauf ist die wertvollste
   Notiz in dieser Datei.
4. Der abgeschlossene Eintrag wandert unter „Historie", neueste zuerst. Danach
   steht „Aktueller Auftrag" wieder leer bereit.
5. Reine Lesearbeit (Code ansehen, Fragen beantworten, Recherche) braucht keinen
   Eintrag. Sobald Dateien, Datenbank, Deployment oder Fremdsysteme berührt
   werden, braucht sie einen.
6. Findet die nächste Sitzung hier einen Eintrag mit Stand `LÄUFT`, gilt der
   Auftrag als **unterbrochen**. Dann zuerst den tatsächlichen Zustand prüfen
   (`git status`, `git log`, Deployment, Datenbank) und das Ergebnis nachtragen,
   bevor neue Arbeit beginnt.

Rückblickende fachliche Begründungen — warum eine Lösung so aussieht, welche
Prüfung zu welchem Befund führte — gehören weiterhin in
[ai-agent-log.md](ai-agent-log.md). Diese Datei hier beantwortet nur:
*Was war zuletzt geplant, und wie ist es ausgegangen?*

---

## Aktueller Auftrag

### 2026-08-17 - Interaktive Grafik für Statistikfragen

- Stand: **LÄUFT.**
- Auftrag: Der Betreiber möchte bei Statistikfragen „eine richtig schöne,
  interaktive Grafik". Aus drei Vorschlägen gewählt: **Verlauf plus
  Kennzahlen**.

**Die architektonische Entscheidung, die alles bestimmt.** Phase 4 hat jede
Formatierung aus dem Desktop entfernt; ein Test verbietet, dass der Client Daten
selbst aufbereitet. Eine Grafik im Client aus Rohdaten zu zeichnen würde das
umkehren. **Der Server erzeugt deshalb die Grafik** als eigenständiges
HTML-Dokument, der Desktop zeigt sie nur an — deterministisch, testbar (eine
Zeichenkette) und ohne Nachladen aus dem Netz.

**Gestaltung nach dem `dataviz`-Verfahren, nicht nach Gefühl.** Was daraus folgt:

- **Keine zwei y-Achsen.** „Umsatz und Stückzahl in einem Diagramm" war mein
  erster Gedanke und ist der häufigste Diagrammfehler überhaupt — die Ausrichtung
  zweier Skalen erfindet eine Korrelation. Stattdessen **eine Metrik zur Zeit,
  umschaltbar.**
- **Form nach Aufgabe:** Die Zähler aus `assistant_statistics` sind Zahlen, kein
  Diagramm → Kennzahlenkacheln, dazu **eine** Leitzahl (Gesamtumsatz). Der
  Verlauf aus `sales_overview` → gestapelte Säulen je Zeitraum, Shop und eBay.
- **Bucketierung nach Fensterbreite**, damit nie 90 Säulen entstehen: bis 30 Tage
  täglich, darüber wöchentlich. Der gewählte Eimer wird benannt, nicht
  verschwiegen.
- **Farben gemessen, nicht geschätzt.** `validate_palette.js` gegen die echten
  Flächen der App (`#F1EEE8` hell, `#383838` dunkel) mit den validierten Slots 1
  und 2 (blau/orange). Ergebnis: alle Prüfungen bestanden, **aber** das Orange
  liegt hell bei 2,76:1 unter 3:1. Das ist laut Skill nicht abtubar und
  verpflichtet zu sichtbaren Labels **und** einer Tabellenansicht — beides kommt
  ohnehin, jetzt aber als Pflicht statt als Zierde.
- Filterzeile **über** der Karte, nicht darin. Legende immer vorhanden (zwei
  Serien). Direkte Werte **sparsam** — Spitzenwert statt jeder Säule. Hover mit
  Tooltip, Trefferfläche größer als die Marke.

**Zwei Nebenwirkungen, die genannt sein müssen.**

1. **Der Launcher braucht ein `WebView2`.** Das ist eine neue Abhängigkeit; die
   Laufzeit ist auf Windows 11 üblicherweise vorhanden. Und es verschiebt das
   Vertrauensmodell: Heute zeigt der Desktop nur Text, künftig führt er vom
   Server geliefertes Markup aus. Bei eigenem Server vertretbar — die WebView
   wird abgeriegelt (keine Host-Objekte, keine Navigation nach außen, CSP im
   Dokument).
2. **Die Antwortgrenze von 64 KiB im Desktop reicht nicht mehr.** Sie war
   bemessen auf „längste Textantwort"; ein HTML-Dokument sprengt das. Sie wird
   angehoben und die Begründung im Code ersetzt — der alte Kommentar behauptet
   sonst etwas Falsches.

**Der Text bleibt.** Die Grafik tritt **neben** die Textantwort, nicht an ihre
Stelle: Ein Screenreader bekommt weiterhin die Zahlen, und ohne WebView2 bleibt
der Assistent voll benutzbar.

**Abnahme:** `npm test`, `npx tsc --noEmit`, `npm run lint`, WinUI-Build. Dazu
der Schritt, den das Verfahren ausdrücklich verlangt: **die Ausgabe ansehen** —
als eigenständige Datei mit echten Zahlen, vor dem Einbau.

**Zwischenstand 1 — Serverseite gebaut, 600 Tests grün, angesehen.** Gemessen an
der gerenderten Ausgabe mit echten Zahlen: kein waagerechter Überlauf, 13
Wochensäulen bei 90 Tagen, genau ein direktes Label am Spitzenwert, keine
Kollision der Achsenbeschriftungen, im Dunkelmodus 3,22 und 3,02 Kontrast gegen
die Fläche.

**Befund aus der Vorschau beim Betreiber — und er wiegt schwerer als die
Messungen.** Seine Vorschaufläche führt keine Skripte aus. Ergebnis: Leitzahl,
Kacheln, Umschalter, Legende und Kartenrahmen erscheinen, **das Diagramm bleibt
leer**, und die Umschalter zeigen keinen gedrückten Zustand.

Im WebView2 liefe das Skript, das Diagramm wäre da. Darauf berufen wäre trotzdem
falsch: **Ein Diagramm, das ohne Skript nicht existiert, hat keinen Rückfall** —
und ein Screenshot zeigt, wie das aussieht.

**Umbau, ohne die Zeichenlogik zu verdoppeln:** Der Server zeichnet **alle sechs
Ansichten** (drei Zeitfenster × zwei Kennzahlen) fertig als SVG-Gruppen; das
Skript schaltet nur noch Sichtbarkeit um und legt den Tooltip darüber. Damit
bleibt es bei **einer** Zeichenimplementierung — die naheliegende Alternative,
serverseitig vorzuzeichnen *und* im Skript neu zu zeichnen, hätte dieselbe
Grafik zweimal beschrieben und wäre auseinandergelaufen.

Kosten: ein größeres Dokument. Gemessen: **61,7 KiB statt 21,5.**

**Richtungswechsel am 2026-08-17, vom Betreiber ausgelöst.** Er will kein
WebView2: „ich möchte nicht, dass eine externe Seite oder einfach der Browser mit
einer HTML-Seite geöffnet wird." Das beruhte teils auf einem Missverständnis —
WebView2 ist ein eingebettetes Steuerelement, kein Browserfenster —, aber der
Einwand dahinter bleibt gültig: Web-Technik im Programm ist eine Abhängigkeit,
die man nicht haben muss.

Er brachte außerdem die tragende Idee: **vorgefertigte Diagramme, beim Abruf mit
Daten gefüllt.** Genau das ist die Vorlage bereits; festgehalten sei die Grenze,
an die „Vorlage" bei Diagrammen stößt: Platzhalter tragen nur Text, die
**Geometrie** hängt an den Daten und muss gerechnet werden. Fest ist das Layout,
gerechnet werden Säulenhöhe, Säulenzahl und Achsenende.

**Neuer Weg: SVG als natives Bild.** `SvgImageSource` in einem `Image`; die
Umschalter sind echte WinUI-Knöpfe daneben und tauschen das mitgelieferte Bild
aus. Keine Web-Komponente, keine neue Abhängigkeit.

**Drei Festlegungen, die daraus folgen:**

1. **Leitzahl und Kacheln kommen mit ins Bild.** Würde WinUI sie als eigene
   Elemente setzen, formatierte der Client wieder Daten — genau das hat Phase 4
   entfernt. Ein SVG enthält alles; der Client zeigt nur an.
2. **Kein `<style>`, keine CSS-Variablen, keine Media-Queries.** Was
   `SvgImageSource` davon unterstützt, ist ungewiss; darauf zu bauen hieße raten.
   Die Farben stehen als Attribute direkt an den Formen. Damit entfällt das
   Messen, weil das Risiko entfällt.
3. **Das Thema entscheidet der Server**, weil ein Bild nicht auf
   `prefers-color-scheme` reagieren kann. Der Desktop schickt sein aktuelles
   Thema mit der Frage. Das ist Darstellungskontext, keine Formatierung — die
   Trennung aus Phase 4 bleibt gewahrt.

**Was dabei verloren geht, und es sei benannt:** der Tooltip beim Überfahren
einzelner Säulen, und die ausklappbare Tabelle. Ein Bild hat keine
Trefferflächen. Die Werte bleiben über Achse, direktes Label am Spitzenwert und
**die Textantwort** erreichbar — Letztere trägt sie ohnehin und bleibt neben der
Grafik stehen, auch für Screenreader.

## Historie

### 2026-08-17 - Messen, welche Fragen der Assistent nicht versteht

- Stand: **ABGESCHLOSSEN. Migration eingespielt, ausgerollt.**
- Auftrag: Vom Betreiber aus vier vorgelegten Wegen gewählt. Für den Assistenten
  stand im Vorrat nichts mehr offen; dies ist ein neuer Punkt.

**Warum dieser zuerst.** Der Assistent hat zwölf Werkzeuge. Welche fehlen, weiß
niemand — Fragen, die in `UNSUPPORTED` enden, verschwinden spurlos. Jeder
Ausbau wäre damit geraten. Der heutige Tag hat zweimal gezeigt, was Messen
gegenüber Vermuten wert ist: Der Win+H-Test klärte in dreißig Sekunden, was zwei
Ausbaustufen nicht geschafft hatten, und der Blick in die echte
Einstellungsdatei verhinderte eine stillschweigend fehlschlagende Migration.

**Bauweise.**

- Neue Tabelle `assistant_unanswered` (Migration `0014`, handgeschrieben wie
  `0003`–`0013`; `db:generate` würde gegen den veralteten Snapshot in
  `drizzle/meta/_journal.json` diffen).
- Aufgezeichnet wird **nur, was unbeantwortet blieb**: Zeitpunkt, Grund
  (`UNSUPPORTED`, `MODEL_NOT_CONFIGURED`, `MODEL_FAILED`) und der Fragetext.
  **Beantwortete Fragen werden nicht gespeichert** — dort ist bereits bekannt,
  welche Werkzeuge griffen, und ein Mitschnitt jeder Frage wäre ein wachsendes
  Tätigkeitsprotokoll ohne zusätzlichen Nutzen. Datensparsamkeit als
  Voreinstellung, nicht als Nachgedanke.
- Der Grund wird mitgeschrieben, weil er die Fälle trennt, die gleich aussehen:
  „kein Werkzeug passt" ist eine Werkzeuglücke, „Modell nicht erreichbar" ein
  Betriebsproblem. Ohne diese Spalte würde eine Störung als Werkzeugbedarf
  gezählt.
- **Die Aufzeichnung darf die Antwort nie gefährden.** Sie läuft nach der
  fertigen Antwort und wird gefangen; ein Schreibfehler in D1 macht aus einer
  gültigen Auskunft keinen Fehler.
- Verdrahtet über einen **injizierbaren Recorder** am Orchestrator statt über ein
  neues Feld in der Antwort. Der Antwortvertrag zum Desktop bleibt unangetastet,
  und die Aufzeichnung ist ohne Datenbank testbar.

**Abnahme:** `npm test`, `npx tsc --noEmit`, `npm run lint`, Migration **lokal**
angewendet und wiederholbar. Rot-Nachweis für die neuen Tests.

**Rücksprachepflichtig und deshalb nicht Teil dieses Durchlaufs:** die Migration
auf der **produktiven** D1. Sie wird vorbereitet und lokal belegt; das Einspielen
braucht eine ausdrückliche Freigabe.

**Ergebnis: `npm test` 582/582, TypeScript fehlerfrei, ESLint 0 Fehler.** Zehn
neue Tests in `tests/assistant-question-log.test.mjs`.

Migration `0014_assistant_unanswered.sql` **lokal** angewendet, zweimal
hintereinander ohne Fehler (`IF NOT EXISTS`), eine Testzeile geschrieben, gelesen
und wieder entfernt (0 übrig).

**Zwei Wächter schlugen an, und beide hatten recht — keiner wurde gelockert:**

1. **Phase 4 verlangt, dass der Assistant-Code keine Schreibpfade enthält** —
   absolut, und das soll es bleiben, auch für die eigene Messtabelle. Der erste
   Entwurf schrieb in `server-orchestrator.ts` und verletzte das. Aufgelöst
   nicht durch Aufweichen, sondern durch Verschieben: Der Recorder ist eine
   Schnittstelle, die konkrete `insert`-Stelle liegt in der Route, die den
   Datenbankzugang ohnehin besitzt. Der Wächter blieb wörtlich unverändert und
   ist jetzt zusätzlich in `assistant-question-log.test.mjs` gespiegelt.
2. `tests/assistant-tools.test.mjs` fixierte die Aufrufform
   `createServerAssistantOrchestrator()` mit leerer Klammer. Dort steht jetzt
   ein Argument; die Prüfung wurde auf das Wesentliche geweitet — Route
   beantwortet über den Orchestrator mit der geparsten Eingabe — mit der
   Begründung daneben.

**Fachliche Festlegungen, jeweils gegen die bequemere Variante:**

- **Nur Unbeantwortetes wird gespeichert.** Bei beantworteten Fragen ist bekannt,
  welche Werkzeuge griffen; ein Mitschnitt jeder Frage wäre ein wachsendes
  Tätigkeitsprotokoll ohne zusätzlichen Nutzen.
- **`READY` wird nicht aufgezeichnet**, auch wenn die Ausführung anschließend
  scheitert. Gemessen wird die **Zuordnung**, nicht die Datenbeschaffung — für
  letztere gibt es die Betriebsalarme.
- **Der Grund geht mit.** „Kein Werkzeug passt" ist eine Lücke,
  „Modell nicht erreichbar" eine Störung. Ohne die Spalte würde man Werkzeuge
  gegen eine Störung bauen.
- **Die Aufzeichnung scheitert leise.** Sie läuft nach der fertigen Antwort und
  ist gefangen; ein D1-Fehler darf aus einer gültigen Auskunft keinen Fehler
  machen. Dieselbe Haltung wie beim Nachlesen der eBay-Menge und bei der
  Lesartenprüfung.

**Nebenwirkung, die die Reihenfolge bestimmt:** Ohne die Tabelle schlägt der
`insert` fehl — gefangen, also harmlos, aber es würde nichts aufgezeichnet und
das Worker-Protokoll füllte sich mit Meldungen. Deshalb **erst migrieren, dann
deployen**, nicht umgekehrt.

**Was der Betreiber freigeben muss:**

```
npx wrangler d1 execute brandycards-production --remote --file drizzle/0014_assistant_unanswered.sql
```

Additiv, keine bestehende Tabelle wird berührt, `IF NOT EXISTS` macht den Lauf
wiederholbar. Danach deployen.

**Auswerten später so** — die Abfrage gehört zum Ergebnis, sonst liegen die Daten
nur da:

```sql
SELECT reason, COUNT(*) AS anzahl FROM assistant_unanswered GROUP BY reason;
SELECT question, COUNT(*) AS anzahl FROM assistant_unanswered
 WHERE reason = 'UNSUPPORTED' GROUP BY question ORDER BY anzahl DESC LIMIT 20;
```

**Naheliegender nächster Schritt, nicht gebaut:** ein dreizehntes Werkzeug, das
diese Auswertung selbst beantwortet („welche Fragen verstehst du nicht?").
Erst sinnvoll, wenn Daten vorliegen.

**Migration produktiv eingespielt — auf ausdrückliche Freigabe des Betreibers.**

- Vorher geprüft: `assistant_unanswered` existierte **nicht** (leeres Ergebnis
  aus `sqlite_master`). Der erwartete Ausgangszustand, nicht unterstellt.
- `npx wrangler d1 execute … --remote --file drizzle/0014_assistant_unanswered.sql`
  → **2 Anweisungen, 4 Zeilen geschrieben, 4,71 ms.** Keine bestehende Tabelle
  berührt.
- Nachgeprüft: Tabelle **und** Index `assistant_unanswered_reason_idx` stehen,
  Zeilenzahl **0**.

**Ausgerollt als Worker-Version `55102f9e-8b40-451b-94a1-a08cbc11c5bf`.** Die
Reihenfolge wurde eingehalten: erst migrieren, dann deployen. Client-Konfiguration
im Bundle geprüft, `assistant_unanswered` dreimal im Worker-Bundle. Beide
Assistant-Routen antworten produktiv mit 401 ohne Gerätetoken; die Tabelle ist
weiterhin leer, es wurde also nichts unbeabsichtigt geschrieben.

**Die Abnahme kann nur der Betreiber führen** — sie braucht ein Gerätetoken.
Eine Frage stellen, die der Assistent nicht versteht (etwa „Erzähl mir einen
Witz über Sammelkarten."), danach:

```
SELECT question, reason, created_at FROM assistant_unanswered ORDER BY created_at DESC LIMIT 5;
```

Erwartet wird **eine** Zeile mit `reason = 'UNSUPPORTED'`. Bleibt sie aus,
steht der Grund im Worker-Log als
`assistant unanswered question could not be recorded`.


### 2026-08-17 - Rest 1 beweisen: Menge eines LAUFENDEN eBay-Angebots ändern

- Stand: **ABGESCHLOSSEN. Rest 1 ist bewiesen, das Angebot wiederhergestellt.**
- **Schreibzugriff auf eBay, vom Betreiber ausdrücklich beauftragt.** Er wählte
  aus drei vorgelegten Wegen den hier beschriebenen.

**Zwei Korrekturen an meinem eigenen früheren Vorschlag, beide vor dem
Eingriff gefunden:**

1. Ich hatte ein **Wegwerf-Angebot** angeboten, als wäre es klein. Es ist es
   nicht: Im Code existiert **kein** `AddItem`/`AddFixedPriceItem`, der
   Schreibpfad kann ausschließlich die Menge bestehender Angebote ändern. Es
   bräuchte eine neue Schreibfähigkeit, eine weitere OAuth-Zustimmung (der Scope
   ist `sell.inventory`, das deckt kein Einstellen) — und ein echtes
   öffentliches Angebot, das ein echter Käufer kaufen könnte. Ein vom Verkäufer
   stornierter Kauf schlägt auf den eBay-Verkäuferstatus durch.
2. Der naheliegende Ersatz — ein laufendes Angebot auf **0** setzen und
   zurücksetzen — wäre **irreversibel**. eBay beendet ein Festpreisangebot bei
   Menge 0, und ein beendetes Angebot lässt sich nicht revidieren. Ohne
   `AddItem` gäbe es keinen Rückweg; ein echtes Angebot wäre dauerhaft
   verloren.

**Was stattdessen gemacht wird.** Die Produktion hat Angebote mit Menge > 1
(7× Menge 2, 2× Menge 3, eines mit 6). Gewählt: **`398292430657`**, „Topps
Premier League Flagship Edition Mega Tin 26/27", **Menge 6, verkauft 0**.

Ablauf, streng in dieser Reihenfolge:

1. Verfügbarkeit lesen — erwartet 6.
2. `reviseEbayItemQuantity(…, 5)` — erwartet `REVISED`.
3. **Zurücklesen — erwartet 5. Das ist der Beweis:** die Menge eines
   *laufenden* Angebots hat sich wirklich geändert. Genau das war am
   2026-08-08 offengeblieben, weil jener Test ein bereits beendetes Angebot traf.
4. `reviseEbayItemQuantity(…, 6)` — wiederherstellen.
5. Zurücklesen — erwartet 6.

**Warum das ungefährlich ist:** Das Angebot bleibt durchgehend aktiv und
kaufbar, nur eines von sechs Stück ist für Sekunden nicht buchbar. Es verlässt
die eBay-Aktivliste nie — die Sorge, der Drei-Minuten-Sync könnte die Karte
lokal deaktivieren, gilt deshalb **nicht** für diesen Weg; sie galt nur für die
Variante mit Menge 0. Der Sync schreibt ohnehin nur von eBay in die Datenbank,
nicht umgekehrt.

**Abbruchbedingung:** Ändert sich `quantity_sold` während des Laufs, hat jemand
wirklich gekauft. Dann wird **nicht** blind auf 6 zurückgesetzt, sondern
abgebrochen und berichtet — sonst überschriebe die Wiederherstellung einen
echten Verkauf und erzeugte genau den Doppelverkauf, den dieser Punkt
verhindern soll.

**Wenn Schritt 4 fehlschlägt:** Das Angebot steht auf 5 statt 6. Das ist die
sichere Richtung (ein Stück zu wenig im Angebot, kein Doppelverkauf) und von
Hand über die eBay-Oberfläche zu korrigieren. Es gehört dann hierher
protokolliert.

**Ausgeführt wird lokal** mit den Zugangsdaten aus `.env.local` gegen dieselbe
`reviseEbayItemQuantity`, die auch der Worker benutzt — kein Sonderpfad, kein
Deployment nötig.

**Ergebnis: abgebrochen bei Schritt 1. Es wurde nichts geschrieben.**

```
eBay OAuth fehlgeschlagen (400): {"error":"invalid_grant",
 "error_description":"the provided authorization refresh token is invalid or
  was issued to another client"}
```

**Der `EBAY_REFRESH_TOKEN` in `.env.local` ist veraltet.** Das passt zur
Historie: Am 2026-08-16 lief die dritte Zustimmungsrunde, und der neue Token
wurde als Cloudflare-Secret hinterlegt — die lokale Datei trägt noch den
vorherigen.

**Das Angebot `398292430657` ist unberührt und steht auf 6.** Ohne gültigen
Token kam kein einziger Aufruf durch; `reviseEbayItemQuantity` wurde nie
erreicht. Dass der Ablauf mit dem **Lesen** beginnt und nicht mit dem
Schreiben, hat hier genau das getan, wofür diese Reihenfolge gedacht war.

**Wie es weitergeht — und was ausdrücklich *nicht* geht:**

- Den produktiven Token kann die KI nicht verwenden: Secret-Werte sind über
  `wrangler` nicht auslesbar, und ein Geheimnis gehört auch nicht in einen
  Gesprächsverlauf.
- **Der Betreiber trägt den aktuellen Token in `.env.local` nach**, dann läuft
  der Beweislauf unverändert durch. Die Datei hält eBay-Zugangsdaten ohnehin
  schon; sie ist ignoriert und verlässt das Gerät nicht.
- Woher der Token kommt, falls er nicht mehr vorliegt: im Adminbereich
  **„eBay OAuth verbinden"**. Der Weg parkt den Token in `ebay_oauth_claims`
  und zeigt ihn dort genau einmal an (SEC-12).
- **Verworfen: eine Adminroute für den Test.** Die einzige Stelle mit gültigem
  Token ist der Worker. Eine Route, die beliebige eBay-Mengen setzen kann, wäre
  dauerhaft gefährlicher als der Beweis wert ist — und Produktionscode nur für
  einen Testlauf einzubauen und wieder zu entfernen, ist der falsche Handel.

**Nebenbefund, unabhängig von dieser Aufgabe:** `.env.local` und die
produktiven Secrets sind auseinandergelaufen. Für den Build ist das ohne Belang
(dort zählen nur die `NEXT_PUBLIC_SUPABASE_*`-Werte), für jede lokale Arbeit
gegen echte eBay-Daten aber eine Stolperfalle, die sich als „eBay antwortet
nicht" tarnt.

**Zweiter Lauf nach dem Nachtragen des Tokens: BEWIESEN.**

| Schritt | Ergebnis |
|---|---|
| Ausgangslage lesen | Menge **6**, Status `Active` |
| `reviseEbayItemQuantity(…, 5)` | `REVISED` |
| **Zurücklesen** | Menge **5**, Status `Active` ← **der Beweis** |
| `reviseEbayItemQuantity(…, 6)` | `REVISED` |
| Wiederherstellung prüfen | Menge **6**, Status `Active` |

Damit ist belegt, was seit dem 2026-08-08 offenstand: `ReviseInventoryStatus`
ändert die Menge eines **laufenden** Angebots wirklich, und die Änderung ist an
eBay selbst nachlesbar. Der Test vom 08.08. konnte das nicht zeigen, weil er ein
bereits beendetes Angebot traf.

**Nachkontrolle an der Produktion, lesend:** `398292430657` steht auf
`quantity 6`, `quantity_sold 0`, `ACTIVE` — im Zeitfenster wurde nichts gekauft.
Die Sync-Läufe um 08:09 und 08:12 melden `updated_count: 0`, sehen also keine
Abweichung zwischen eBay und Datenbank. Wäre die Wiederherstellung
fehlgeschlagen, hätte der Sync eine 5 geschrieben und der Zähler wäre gestiegen.

**Was dieser Beweis ausdrücklich NICHT zeigt:** dass die Menge **0** ein
Angebot beendet. Dieser Zweig wurde bewusst gemieden, weil er irreversibel ist —
ein beendetes Angebot lässt sich ohne `AddItem` nicht wiederherstellen. Bewiesen
ist der Mechanismus, nicht dieser eine Zahlenwert. In der Produktion ist das
Beenden ohnehin die gewünschte Wirkung, und seit heute liest der Outbox-Lauf die
Menge nach jedem `REVISED` zurück und alarmiert, wenn sie nicht 0 ist.

**Aufräumen, das beim Betreiber liegt:** In `.env.local` dieses Worktrees liegt
jetzt ein **gültiger produktiver** eBay-Refresh-Token — eine zweite Kopie eines
Geheimnisses neben dem Hauptverzeichnis. Die Datei ist ignoriert und verlässt das
Gerät nicht; wer den Worktree später entfernt, sollte sie bewusst mitlöschen.


### 2026-08-17 - Punkt 6: die zwei Reste am eBay-Schreibpfad

- Stand: **ABGESCHLOSSEN**, ausgerollt. Rest 2 geschlossen; Rest 1 vorbereitet,
  aber erst durch den nächsten echten Verkauf beweisbar.
- Auftrag des Betreibers: Punkt 6 aus dem Arbeitsvorrat.

**Zustand erhoben, bevor geplant wurde** (lesend an der Produktion):

```
SELECT status, operation, COUNT(*), MAX(created_at) FROM ebay_outbox GROUP BY ...
→ SUCCEEDED / REVISE_QUANTITY / 2 / 2026-08-08 10:33:14
```

Zwei Aufträge, beide erfolgreich, **seit dem 2026-08-08 keiner mehr**. Nichts
`FAILED`, nichts hängt. Es hat seither also keinen Shop-Verkauf gegeben, der den
Pfad berührt hätte — Rest 1 ist deshalb unverändert unbewiesen.

**Was an den beiden Resten wirklich machbar ist:**

- **Rest 2 (welche `ALREADY_ENDED`-Nummer war es?)** ist reine Codearbeit und
  wird gemacht. Der Vorrat nennt den Weg selbst: `tradingErrorCodes(xml)` in die
  Protokollzeile. Umgesetzt wird das an der Stelle, an der die Nummern bekannt
  sind — in `reviseEbayItemQuantity`, nicht durch Umbau des Rückgabetyps. Vier
  bestehende Tests hängen an der schlichten Zeichenkette `"ALREADY_ENDED"`, und
  ein Vertragsumbau nur zur Protokollierung wäre der falsche Preis.
- **Rest 1 (fällt die Menge eines *laufenden* Angebots wirklich auf 0?)** kann
  ich **nicht** beweisen. Es bräuchte entweder einen echten Verkauf — nicht
  herbeiführbar — oder ein Wegwerf-Angebot, also einen **Schreibzugriff auf
  eBay**. Der ist ausdrücklich rücksprachepflichtig und wird nicht eigenmächtig
  vorgenommen.

**Was ich stattdessen dafür tue: den nächsten echten Verkauf selbst zum Beleg
machen.** Heute meldet ein erfolgreicher Auftrag nur „eBay hat `Ack: Success`
geschickt". Das ist nicht dasselbe wie „die Menge steht jetzt auf 0". Nach einem
`REVISED` wird deshalb die Verfügbarkeit über das vorhandene
`getEbayAvailability` **zurückgelesen** und protokolliert.

- Streng informativ: Scheitert das Zurücklesen, bleibt der Auftrag `SUCCEEDED`.
  Eine Diagnose darf den Geschäftsvorgang nicht gefährden.
- Nur im Fall `REVISED`, nicht bei `ALREADY_ENDED` — dort ist das Angebot ohnehin
  beendet.
- **Kosten:** ein zusätzlicher Trading-Aufruf je erfolgreicher Rücknahme. Der
  Topf umfasst 5 000 Aufrufe/Tag und ist geteilt; Rücknahmen entstehen einmal je
  verkaufter Karte (bisher 4 in 90 Tagen). Vernachlässigbar, aber genannt.

**Und der Fall, der bleibend wichtig ist:** Meldet eBay Erfolg, während die
Menge danach **nicht** 0 ist, ist das ein stiller Doppelverkaufspfad. Das löst
künftig einen Betriebsalarm aus — nicht als Einmalbeweis, sondern dauerhaft.

**Bewusst nicht gemacht: keine Migration.** Eine Spalte für ein Diagnoseergebnis
wäre ein Schema-Eingriff in die Produktion für etwas, das kein Geschäftsdatum
ist. Der dauerhafte Weg für Protokolle heißt Logpush und ist eine
Betreiberentscheidung; sie wird als solche notiert statt vorweggenommen.

**Abnahme:** `npm test`, `npx tsc --noEmit`, `npm run lint`, Deploy. Rot-Nachweis
für die neuen Tests. Kein eBay-Schreibzugriff, keine Produktionsdatenänderung.

**Ergebnis: `npm test` 573/573, TypeScript fehlerfrei, ESLint 0 Fehler,
ausgerollt als Worker-Version `9d7b3fe5-42ef-4f9f-ad5c-7b1060b10708`.** Acht
neue Tests in `tests/ebay-outbox-readback.test.mjs`.

**Ein Befund beim Testen, der mehr wert ist als die Aufgabe selbst:**
`lib/ebay-outbox.ts` importiert `../db` als **Verzeichnis**. Node-ESM kann das
nicht auflösen (`ERR_UNSUPPORTED_DIR_IMPORT`) — die Datei ist aus den Tests
**gar nicht ladbar**. Deshalb prüft bis heute kein einziger Test die
Outbox-Schleife; die 15 vorhandenen Tests treffen den Client und das
Planmodul. Das war nie beabsichtigt, sondern eine unbemerkte Nebenwirkung.

Die neue Logik liegt deshalb in `lib/ebay-outbox-readback.ts`, auf derselben
Seite der Grenze wie `ebay-outbox-plan.ts` — dort, wo das Projekt den
entscheidbaren Teil schon einmal abgetrennt hat. Erkennungszeichen: Testbare
Module importieren **mit** `.ts`-Endung, gebündelte ohne.

> **Für später, als eigener kleiner Punkt:** `processEbayOutbox` selbst bleibt
> ungetestet. Wer das ändern will, muss `getDb` injizierbar machen oder den
> Verzeichnisimport auflösen. Kein Notfall — der Pfad ist an echten Daten
> belegt —, aber es sollte bewusst dastehen statt unbemerkt zu bleiben.

**Rest 2 — geschlossen.** `reviseEbayItemQuantity` protokolliert jetzt, **welche**
der drei `ALREADY_ENDED_CODES` gegriffen hat, samt aller gemeldeten Nummern. Der
Rückgabetyp blieb die schlichte Zeichenkette; vier bestehende Tests hängen daran,
und ein Vertragsumbau nur zur Protokollierung wäre der falsche Preis. Die beiden
Zeilen sind über `ebayItemId` zusammenzuführen.

**Rest 1 — nicht beweisbar, aber vorbereitet.** Nach einem `REVISED` wird die
Menge über `getEbayAvailability` zurückgelesen und protokolliert. Damit belegt
der nächste echte Verkauf von allein, dass die Menge eines **laufenden**
Angebots auf 0 fällt — ohne dass jemand im richtigen Moment mitlesen muss.

**Der bleibende Gewinn ist aber der Gegenfall:** Meldet eBay Erfolg, während die
Menge danach nicht 0 ist, wäre die Karte im Shop verkauft und dort weiter
käuflich. Genau der stille Doppelverkauf, den Punkt 6 verhindern soll — und er
wäre ohne Nachlesen unsichtbar. Dieser Fall alarmiert jetzt dauerhaft.

Drei Entscheidungen dazu, jeweils gegen die bequemere Variante:

- **`null` alarmiert nicht.** „Nicht ablesbar" ist nicht „nicht null", sonst
  meldete jede unvollständige eBay-Antwort einen Doppelverkauf.
- **Ein Fehlschlag beim Nachlesen wirft nicht.** Der Auftrag bleibt
  `SUCCEEDED`; ein Wurf schickte ihn in `RETRY_WAIT` und setzte dieselbe Menge
  ein zweites Mal. Eine Diagnose darf den Geschäftsvorgang nicht gefährden.
- **Nur bei `REVISED`, nicht bei `ALREADY_ENDED`.** Dort ist nichts mehr zu
  prüfen, und der Trading-Topf von 5 000 Aufrufen/Tag ist geteilt.

**Was offen bleibt — und beim Betreiber liegt:**

1. **Der Erfolgsfall selbst.** Beweisbar durch den nächsten echten Verkauf, oder
   vorgezogen über ein Wegwerf-Angebot. Letzteres wäre ein **Schreibzugriff auf
   eBay** und wurde nicht eigenmächtig vorgenommen.
2. **Worker-Protokolle sind flüchtig.** Ohne Logpush zeigt `wrangler tail` nur
   laufenden Verkehr; passiert der Verkauf, während niemand mitliest, ist die
   Protokollzeile weg. Der **Alarm** im Gegenfall kommt dagegen per E-Mail an
   und überlebt. Ob Logpush eingerichtet wird, ist eine Betreiberentscheidung.


### 2026-08-17 - Freie Formulierungen: den Modell-Planer betriebsfertig machen

- Stand: **ABGESCHLOSSEN und ABGENOMMEN.** Der Betreiber hat den Schlüssel
  gesetzt (`wrangler secret list`: 15 Secrets, `OPENAI_API_KEY` dabei) und beide
  Proben durchgeführt — **beide bestanden.**
- Auftrag: Punkt 1 der offenen Assistant-Themen. Produktiv läuft nur der
  Regelplaner; unbekannte Formulierungen enden in `UNSUPPORTED`. Seit die
  Spracherkennung fehlerfrei arbeitet, ist **das** die Obergrenze des
  Assistenten.
- Der Code steht seit Phase 4 und ist getestet. Es fehlt `OPENAI_API_KEY`, und
  das kann nur der Betreiber setzen.

**Vorflugprüfung gegen die heutige API, statt dem Code zu glauben.** Beides
bestätigt, nichts zu ändern:

- `gpt-5.6-luna` ist ein gültiges Modell, unterstützt `reasoning.effort` und
  Funktionsaufrufe über die Responses-API. Kosten 0,20 $ / 1,20 $ je Million
  Token — für einen Planer, der nur Werkzeugnamen wählt, praktisch nichts. Die
  kostenoptimierte Variante ist hier die sachlich richtige Wahl.
- Die Responses-API erwartet **flache** Tool-Definitionen ohne verschachteltes
  `function`-Feld, und Ausgaben als `function_call` mit `name`/`arguments` —
  genau die Form, die `planner.ts` sendet und `parseOpenAIPlannedTools` liest.

**Die Lücke, die dabei auffiel — und sie ist ein Rückschritt in Wartestellung.**
`HybridAssistantPlanner` ruft `modelPlanner.plan()` **ohne** Auffangnetz. Ein
falscher Schlüssel, ein erschöpftes Guthaben oder ein Zeitablauf wirft damit
durch den Orchestrator bis in die Route und endet als generisches
503 „Der freie Assistant ist gerade nicht verfügbar."

Heute, **ohne** Schlüssel, bekommt der Nutzer bei einer unbekannten Frage eine
hilfreiche Auskunft. Mit einem **falsch gesetzten** Schlüssel bekäme er weniger
als vorher — und der Betreiber keinen Hinweis, ob Schlüssel, Guthaben oder
Modellname schuld ist. Dieselbe Falle wie beim Azure-Token, nur umgekehrt: Hier
verschlechtert die Aktivierung das Verhalten, wenn sie schiefgeht.

**Bauweise.**

- Neuer Grund `MODEL_FAILED` neben `MODEL_NOT_CONFIGURED`. Ein Fehlschlag des
  Modells fällt damit auf dieselbe ehrliche `UNSUPPORTED`-Antwort zurück, statt
  die ganze Anfrage zu versenken.
- **Bekannte Fragen bleiben unberührt** — der Regelplaner läuft zuerst und
  kommt bei ihnen gar nicht bis zum Modell. Das gilt schon heute und wird
  durch einen Test festgehalten.
- Der Grund wird serverseitig protokolliert, damit der Betreiber Schlüssel,
  Guthaben und Modellname unterscheiden kann. In der Antwort an den Desktop
  steht **kein** Anbieterdetail und kein Statuscode.

**Zu dokumentieren, weil es eine Entscheidung ist:** Mit gesetztem Schlüssel geht
der **Fragetext** an OpenAI, sobald der Regelplaner nicht greift. Antworttexte
und Geschäftsdaten nicht — die entstehen weiter deterministisch aus den
Werkzeug-DTOs, und das Modell wählt ausschließlich Werkzeugnamen. Nach der
Freigabe für Azure-Audio ist das die kleinere Erweiterung, gehört aber benannt.

**Abnahme:** `npm test`, `npx tsc --noEmit`, `npm run lint`, Deploy. Der
Durchstich mit echtem Schlüssel bleibt beim Betreiber.

**Nicht Teil des Auftrags:** Ein Schlüssel wird nicht angelegt und nicht
gesetzt. Keine Produktionsdaten, keine Migration.

**Ergebnis: `npm test` 565/565, TypeScript fehlerfrei, ESLint 0 Fehler,
ausgerollt als Worker-Version `8ff94960-4b9a-45ae-89a9-d5f82df970ca`.** Acht
neue Tests in `tests/assistant-model-planner.test.mjs`.

`npx wrangler secret list` bestätigt den Zustand: 14 Secrets, darunter
`AZURE_SPEECH_KEY` und `AZURE_SPEECH_REGION`, **kein** `OPENAI_API_KEY`.
Produktiv läuft also weiter allein der Regelplaner.

**Ein bestehender Test verlangte das Gegenteil — und hatte teilweise recht.**
`tests/assistant-phase5.test.mjs` hielt fest: „der Hybridplaner verschluckt
einen Modellfehler nicht", und verlangte einen durchgeworfenen Fehler. Der
Einwand dahinter ist berechtigt: Ein Anbieterausfall darf nicht als
`UNSUPPORTED` erscheinen, denn das behauptete, die Frage sei nicht beantwortbar
— und ob sie es wäre, wurde nie geprüft.

Der erste Entwurf tat genau das und war damit falsch. Die Auflösung ist ein
**eigener Status**:

- `MODEL_FAILED` führt jetzt zu `status: "FAILED"`, ausdrücklich **nicht**
  `UNSUPPORTED`. Denselben Unterschied halten `AssistantSalesChannel.available`
  und die `UNAVAILABLE`-Codes auseinander: „nichts da" ist nicht „nicht
  nachgesehen".
- Die Anfrage endet trotzdem **nicht** in einem 503 für alles. Der Nutzer
  bekommt einen deutschen Satz, der sagt, was offen ist und dass Bekanntes
  weiter funktioniert.
- Der Fehler wird serverseitig mit Statuscode protokolliert, damit falscher
  Schlüssel, erschöpftes Guthaben und falscher Modellname unterscheidbar
  bleiben. Zum Gerät geht kein Anbieterdetail.

Der Phase-5-Test wurde entsprechend umgeschrieben — **Form geändert, Absicht
behalten**, mit der Begründung direkt daneben, damit die Änderung nicht als
Aufweichung missverstanden wird.

**Vorflugprüfung, deren Ergebnis „nichts zu tun" war** — und die deshalb
festgehalten gehört, damit sie nicht wiederholt wird: `gpt-5.6-luna` ist
gültig, kann `reasoning.effort` und Funktionsaufrufe, kostet 0,20 $ / 1,20 $ je
Million Token. Die Responses-API erwartet flache Tool-Definitionen und liefert
`function_call`-Ausgaben — genau die Form, die der Code seit Phase 4 verwendet.

**Was der Betreiber tun muss:**

```
npx wrangler secret put OPENAI_API_KEY
```

Optional `OPENAI_ASSISTANT_MODEL`; ohne ihn gilt `gpt-5.6-luna`. Secrets wirken
sofort, ohne erneuten Deploy.

**Abnahme: beide Proben vom Betreiber durchgeführt, beide bestanden.**

| Probe | Erwartung | Ergebnis |
|---|---|---|
| „Wie geht es meinem Laden so?" — vom Regelplaner **nicht** abgedeckt | wird jetzt beantwortet | **beantwortet** |
| „Erzähl mir einen Witz über Sammelkarten." | bleibt abgelehnt | **abgelehnt** |

**Die zweite Probe war die wichtigere.** Ein Modell, das auf eine fachfremde
Frage Werkzeuge auswählt, erfindet Zuordnungen — die Aktivierung wäre damit
schlechter als kein Modell. Dass sie abgelehnt bleibt, belegt: Die Registry ist
geschlossen, und der `strict`-Schemazwang wirkt.

**Was offen bleibt:** Nur noch eines, und es ist eine benannte Entscheidung, keine
Aufgabe. **Der Fragetext geht an OpenAI**, sobald der Regelplaner nicht greift.
Antworttexte und Geschäftsdaten nicht — die entstehen weiter deterministisch aus
den Werkzeug-DTOs, das Modell wählt ausschließlich Werkzeugnamen. Nach der
Freigabe für Azure-Audio die kleinere Erweiterung, aber eine bewusste.

> **Für später, falls die freie Erkennung plötzlich aussetzt:** OpenAI arbeitet
> mit vorausbezahltem Guthaben. Ist es aufgebraucht, meldet der Assistent
> „…war gerade nicht erreichbar… ist damit offen" — bekannte Fragen laufen
> weiter. Das ist derselbe erste Verdacht wie die abgelaufene Azure-Testversion,
> nur an einer zweiten Stelle. Im Worker-Log steht dann
> `assistant model planner failed` mit dem HTTP-Status.


### 2026-08-17 - Geräteverbindung härten (der Rest aus Phase 2)

- Stand: **ABGESCHLOSSEN**, an der echten Verbindung des Betreibers verifiziert.
- Auftrag des Betreibers: Punkt 2 der offenen Assistant-Themen — die seit
  Phase 2 als „vor produktiver Assistant-Nutzung offen" notierte Härtung. Die
  Voraussetzung ist eingetreten: Der Assistent ist seit dem 2026-08-17
  produktiv in Nutzung.

**Erhoben, statt der alten Notiz zu glauben.** Sie nannte drei Punkte
(HTTPS-Zielprüfung, DPAPI, Widerruf/Rotation). Zwei davon sind längst da:

- **Rotation gibt es:** `claim/route.ts` setzt `expiresAt` auf 90 Tage,
  `authenticateAvatarDevice` prüft es, und Tokens liegen serverseitig nur als
  SHA-256-Hash.
- **Widerruf greift:** `revoked_at` wirkt, und die App trennt bei 401 und
  verlangt eine neue Kopplung.

**Was wirklich offen ist:**

1. **Das Token liegt im Klartext** in
   `%LOCALAPPDATA%\BrandyCards\DesktopAvatar\settings.json`. Wer die Datei
   liest, kann Geschäftsdaten abfragen — **und seit heute Azure-Sprachtoken auf
   Kosten des Betreibers ausstellen.** Diese zweite Angriffsfläche gab es zur
   Zeit der Phase-2-Notiz noch nicht.
2. **`NormalizeShopUrl` akzeptiert `http://` für jeden Host.** Damit ginge das
   Token im Klartext über die Leitung, wenn die Adresse einmal falsch
   eingetragen ist.
3. **Beim Nachsehen gefunden, nicht beauftragt:** Die App speichert das
   `expiresAt` aus der Kopplung nicht. Am 90. Tag verlangt sie ohne Vorwarnung
   eine neue Kopplung. Das ist dasselbe Muster wie die Azure-Testversion —
   etwas hört still auf zu funktionieren, und niemand weiß warum. Wird
   mitgemacht, weil es klein ist und genau in diese Aufgabe gehört.

**Bauweise.**

- **DPAPI** über `ProtectedData` mit `DataScope.CurrentUser`. Gespeichert wird
  Base64 in einem neuen Feld; das alte Klartextfeld wird beim Laden **migriert**
  und geleert. Ein erneutes Koppeln darf nicht nötig werden — der Betreiber hat
  eine laufende Verbindung, und die Härtung darf sie nicht kosten.
- Ist das Entschlüsseln nicht möglich (Datei von einem anderen Konto oder
  Rechner), gilt das als „nicht gekoppelt" und nicht als Fehler. Das ist der
  gewünschte Effekt von DPAPI, kein Defekt.
- **HTTPS wird verlangt**, mit Ausnahme von Loopback — sonst wäre die
  Entwicklung gegen `npm run dev` auf `http://localhost:3000` nicht mehr
  möglich, und das ist der dokumentierte Weg im README.
- **Ablaufwarnung** im Panel, sobald die Verbindung in wenigen Tagen endet.

**Abnahme:** `npm test`, `npx tsc --noEmit`, `npm run lint`, WinUI-x64-Build.
Dazu ein echter Nachweis, dass die vorhandene Verbindung die Migration
übersteht, ohne neu gekoppelt zu werden.

**Nicht Teil des Auftrags:** Produktionsdaten, Deployment, Spracherkennung.
Rein im Desktop; kein Serverdeploy nötig.

**Ergebnis: umgesetzt, `npm test` 557/557, TypeScript fehlerfrei, ESLint 0
Fehler, WinUI-x64-Build 0 Warnungen und 0 Fehler.** Sechs neue Tests in
`tests/assistant-device-hardening.test.mjs`.

**Der Fehler, der die Aufgabe fast wertlos gemacht hätte — und wie er auffiel.**
Vor dem Migrationslauf wurde die echte `settings.json` **strukturell** gelesen
(Feldnamen und Längen, nie der Wert). Dabei zeigte sich: Das Feld heißt auf der
Platte `DeviceToken` mit **großem D**, während das Migrationsfeld im Code
`deviceToken` hieß. `JsonSerializer` liest ohne
`PropertyNameCaseInsensitive` **case-sensitiv** — die Migration hätte nicht
gegriffen, das Token wäre als verloren gewertet worden, und der Betreiber hätte
neu koppeln müssen. Ohne Fehlermeldung, die den Grund nennt.

> **Lehre, die über diesen Fall hinausgeht:** Eine Migration von einem
> Dateiformat ist erst geprüft, wenn sie gegen eine **echte** alte Datei lief.
> Ein selbst geschriebenes Testdokument trägt die Annahmen des Autors und
> reproduziert genau diesen Fehler nicht. Der Test dazu hält die Schreibweise
> jetzt fest und verbietet zusätzlich `PropertyNameCaseInsensitive`.

**Am echten Gerät verifiziert**, nicht nur an Quelltext:

| Prüfung | Vorher | Nachher |
|---|---|---|
| `DeviceToken` (Klartext) | `string`, 69 Zeichen | **`null`** |
| `DeviceTokenProtected` | fehlt | `string`, 392 Zeichen (DPAPI, Base64) |
| `bcav_` irgendwo in der Datei | ja | **nein** |
| App nach dem Start | — | Launcher sichtbar, Panel öffnet, Status „Bereit" |

Der Launcher ist der Beleg, der zählt: Wäre das Token verloren gegangen, stünde
dort das Pairing-Formular. Zusätzlich lief das Event-Polling im
Drei-Sekunden-Takt weiter — jeder dieser Aufrufe authentifiziert sich mit dem
Token, ein 401 hätte die Verbindung getrennt.

**Aufgeräumt:** Die vor dem Lauf angelegte Sicherung enthielt das Token im
Klartext und wurde nach der erfolgreichen Verifikation **gelöscht** — sie hätte
die Härtung sonst vollständig aufgehoben. Im Einstellungsverzeichnis liegt kein
`bcav_` mehr.

**Was bewusst nicht gemacht wurde:** Die Notiz aus Phase 2 nannte auch
„Rotation". Die gibt es längst — `claim/route.ts` setzt 90 Tage,
`authenticateAvatarDevice` prüft sie, Tokens liegen serverseitig nur als Hash,
und Widerruf über `revoked_at` greift. Hinzugekommen ist nur, was fehlte: Die
App **speichert** das Ablaufdatum jetzt und warnt sieben Tage vorher im Panel.

**Ein Rest, harmlos und benannt:** Die bestehende Kopplung des Betreibers ist
älter als dieses Feld, ihr `ExpiresAt` ist deshalb `null`. Es wird dann nichts
behauptet — eine erfundene Frist wäre schlechter als keine. Beim nächsten
Koppeln füllt sich der Wert von allein. Wann diese Verbindung endet, weiß der
Shop, nicht die App.

### 2026-08-17 - Enter sendet, Alt+Enter bricht die Zeile

- Stand: **ABGESCHLOSSEN.**
- Vorgeschichte: **Variante 3 ist abgenommen.** Der Betreiber hat nach dem
  Setzen der Secrets gesprochen geprüft: „es funktioniert perfekt". Damit ist
  die Spracherkennung nach drei Anläufen erledigt.
- Auftrag: Im Nachrichtenfeld soll `Enter` senden und `Alt+Enter` eine neue
  Zeile einfügen. Heute ist es umgekehrt — `AcceptsReturn="True"` lässt jedes
  `Enter` eine Zeile einfügen, und gesendet wird nur über den Knopf.
- Umsetzung: `PreviewKeyDown` am Feld statt `KeyDown`. Die bubbelnde Fassung
  käme zu spät — die TextBox hat das `Enter` dann bereits selbst verarbeitet
  und die Zeile eingefügt.
- Mehrzeiligkeit bleibt erhalten: `AcceptsReturn` wird **nicht** abgeschaltet.
  Bei `Alt+Enter` wird der Umbruch an der Einfügemarke selbst gesetzt, weil das
  unterdrückte Standardverhalten ihn sonst nicht mehr erzeugt.
- Der gemeinsame Sendepfad bleibt ungeteilt: Knopf und `Enter` laufen über
  dieselbe Methode wie bisher, damit die Zusicherung aus Phase 4 gilt.
- Zugänglichkeit: Die neue Belegung gehört in den Hilfetext des Feldes,
  sonst ist sie unauffindbar.

**Abnahme:** `npm test`, `npx tsc --noEmit`, `npm run lint`, WinUI-x64-Build.

**Nicht Teil des Auftrags:** Produktionsdaten, Deployment, Spracherkennung.
Kein Serverdeploy nötig — die Änderung ist rein im Desktop.

**Ergebnis: umgesetzt, `npm test` 551/551, TypeScript fehlerfrei, ESLint 0
Fehler, WinUI-x64-Build 0 Warnungen und 0 Fehler.** Fünf neue Tests in
`tests/assistant-input-keys.test.mjs`.

Umgesetzt wie geplant: `PreviewKeyDown` am Feld, `e.Handled` vor der
Verzweigung, Alt über `e.KeyStatus.IsMenuKeyDown`. Der Umbruch wird an der
Einfügemarke als `\r` gesetzt — WinUI führt Zeilenumbrüche in `TextBox.Text` so,
ein `\n` käme beim Auslesen anders zurück. Eine markierte Auswahl wird dabei
ersetzt, und `MaxLength` wird geprüft: Die Grenze gilt nur für *getippte*
Zeichen, gesetzter Text umgeht sie sonst.

`SendAssistantButton_Click` und die Eingabetaste laufen beide über die neue
`SendTypedMessageAsync`; damit gibt es weiterhin genau einen Sendeweg, und die
Zusicherung aus Phase 4 (getippt wie diktiert endet in
`SendAssistantMessageAsync`) gilt unverändert.

**Zweimal dieselbe Sperre:** Der Build scheiterte erneut an der laufenden App
(PID 10096), diesmal an der Fassung, die der Betreiber gerade benutzte. Sie
wurde beendet, gebaut und anschließend wieder gestartet. Wer hier weiterarbeitet:
**Vor einem WinUI-Build prüfen, ob die App läuft** — die Fehlermeldung nennt die
PID, aber erst nach zehn Wiederholungsversuchen.

### 2026-08-17 - Variante 3: Azure Speech statt SAPI

- Stand: **ABGESCHLOSSEN**, gebaut, geprüft, Serverseite ausgerollt.
  **Wartet auf zwei Secrets des Betreibers.**
- **Der Befund, der alles entschieden hat:** Der Betreiber hat auf Vorschlag
  Windows-Diktat (Win+H) im selben Textfeld getestet — „lief erstaunlich gut".
  Damit sind Mikrofon, Aufnahmeweg und Aussprache als Ursache ausgeschlossen;
  schuld war allein die Engine. Win+H läuft über **Azure Speech**. Der Dienst
  ist damit nicht nach Fremdbenchmark gewählt, sondern an der Stimme, dem
  Mikrofon und dem Vokabular des Betreibers belegt.
- Am Gerät ausgelesen: `MS-1031-80-DESK`, „Microsoft Speech Recognizer 8.0 for
  Windows (German - Germany)" — die SAPI-Engine aus Windows-7-Zeiten. Kein
  neuronales Modell. Hardware: Intel Iris Xe (kein CUDA), i5-1145G7, 16 GB.
- **Freigabe des Betreibers:** Datenschutz ist zweitrangig, das Projekt läuft
  privat und nicht kommerziell. Damit ist die Phase-3-Zusage „Audio verlässt
  den lokalen Prozess nicht" **bewusst aufgegeben**. Das ist eine Entscheidung,
  keine Nachlässigkeit, und wird als solche dokumentiert.

**Verworfene Wege, mit Begründung — damit sie niemand erneut aufgreift.**

- **`Windows.Media.SpeechRecognition` (die frühere „Variante 3"):** doppelt
  tot. Sie verlangt Paketidentität, und Microsoft hat die Windows-
  Spracherkennung abgekündigt und durch Voice Access ersetzt. Meine frühere
  Empfehlung dazu war falsch und ist zurückgezogen.
- **NVIDIA Canary-1B-v2:** starkes Modell, Lizenz CC-BY-4.0 also unproblematisch,
  ~8,4 % WER Deutsch. Aber NVIDIA rät von CPU-Betrieb ab, und hier gibt es keine
  CUDA-Karte. Die GGUF-Portierung liefe auf der CPU, nennt aber Linux als
  unterstütztes System.
- **ElevenLabs/OpenAI/Deepgram:** allesamt möglich, aber ungemessen auf diesem
  Gerät. Azure ist der einzige Dienst mit einem echten Beleg.

**Bauweise.**

- Das **Speech SDK läuft unpackaged** — der Blocker, an dem die WinRT-Variante
  scheiterte, existiert hier nicht. Pet-Overlay und Startpfad bleiben unberührt.
- `RecognizeOnceAsync()` gegen das Standardmikrofon ist fast formgleich mit dem
  heutigen `Recognize()`. `SpeechTranscriptionResult` behält seine Form, damit
  die Schichten aus Variante 1 und 2 unverändert weiterarbeiten.
- **Der Schlüssel bleibt serverseitig.** Neue Route gibt ein kurzlebiges
  Azure-Autorisierungstoken aus; der Desktop nutzt
  `SpeechConfig.FromAuthorizationToken()`. Kein Secret im Client — das Prinzip
  aus Phase 4.
- **Variante 2 trägt weiter:** Azure kennt Phrase Lists. Die 16 Phrasen liegen
  fertig vor und werden bereits ausgeliefert; sie spannen künftig die
  Azure-Erkennung vor. Variante 1 bleibt die Korrekturschicht darüber.
- **SAPI bleibt als Rückfall**, wenn kein Token oder kein Netz da ist. Ein
  toter Knopf wäre schlechter als eine schlechte Erkennung.

**Betreiberseite:** Azure-Abonnement steht (Testversion, 200 $, 30 Tage).
Speech-Ressource `Free F0` wird gerade angelegt. Secrets `AZURE_SPEECH_KEY` und
`AZURE_SPEECH_REGION` setzt der Betreiber selbst; die KI sieht den Schlüssel nie.

**Zu dokumentieren, weil es sonst in 30 Tagen still bricht:** Nach Ablauf der
Testversion muss auf „Nutzungsbasierte Bezahlung" umgestellt werden, sonst wird
das Abonnement deaktiviert und die F0-Ressource antwortet nicht mehr. Die
Umstellung selbst kostet nichts; F0 bleibt kostenlos (5 Audiostunden/Monat).

**Abnahme:** `npm test`, `npx tsc --noEmit`, `npm run lint`, WinUI-x64-Build.
Der gesprochene Nachweis am Gerät bleibt Sache des Betreibers.

**Nicht Teil des Auftrags:** Produktionsdaten, Remote-Migrationen,
eBay-Schreibvorgänge. `NativePetOverlay.cs` bleibt unberührt.

**Ergebnis: gebaut, alle vier Prüfungen grün, Serverseite ausgerollt.**

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 546/546 |
| `npx tsc --noEmit` | fehlerfrei |
| `npm run lint` | 0 Fehler (bekannte Hook-Warnung bleibt) |
| WinUI x64 Debug | 0 Warnungen, 0 Fehler |

Worker-Version **`4c2820c3-d302-4266-ac9b-97e8179a5c05`**. Die Region ist
**`swedencentral`** — West Europe hatte kein F0-Kontingent frei. Sie steht
nirgends im Code, sondern kommt aus dem Secret.

`POST /api/avatar/device/assistant/speech-token` antwortet produktiv mit 401
ohne Gerätetoken, `GET` mit 405. Elf neue Tests in
`tests/assistant-speech-token.test.mjs`.

**Der Wächtertest aus Phase 8 ist zum zweiten Mal nachgezogen**, wieder als
Gleichheitsprüfung: drei ausgehende Pfade statt zwei. Ein vierter fällt auf.

**Zwischenfall beim Bauen, harmlos:** Der WinUI-Build scheiterte zunächst, weil
die zum Test gestartete App ihre eigene `.exe` sperrte (PID 6516, aus genau
diesem Worktree). Sie wurde beendet — sie hätte für die Änderung ohnehin neu
starten müssen. Danach lief der Build durch.

**Was der Betreiber tun muss, damit es wirkt:**

```
npx wrangler secret put AZURE_SPEECH_KEY      # aus der Speech-Ressource
npx wrangler secret put AZURE_SPEECH_REGION   # swedencentral
```

Secrets wirken sofort, ohne erneuten Deploy. Danach die Desktop-App neu starten.

**Was offen bleibt:**

1. **Der gesprochene Nachweis.** Bis die Secrets liegen, gibt die Route 503 mit
   dem fehlenden Secret-Namen zurück, der Desktop bekommt kein Token und
   erkennt lokal weiter — sichtbar an der Statuszeile „lokale Erkennung,
   eingeschränkte Genauigkeit". Das ist der Zustand von vorher, nicht ein
   Fehler.
2. **Die Azure-Testversion läuft in 30 Tagen ab.** Ohne Umstellung auf
   nutzungsbasierte Bezahlung wird das Abonnement deaktiviert, und die
   Spracherkennung hört still auf zu antworten. Steht auch in `.env.example`,
   damit es nicht nur hier steht. F0 selbst bleibt kostenlos, 5 Audiostunden
   im Monat.
3. **Die lokale SAPI-Erkennung bleibt im Code.** Nicht aus Anhänglichkeit,
   sondern weil ein Knopf, der ohne Netz gar nichts tut, schlechter ist als
   einer, der schlecht erkennt.

### 2026-08-16 - Variante 2: Domänengrammatik neben das Diktat

- Stand: **ABGESCHLOSSEN**, gebaut und geprüft. **Nicht ausgerollt.**
- Vorgeschichte: Variante 1 ist ausgerollt und **nachweislich scharf** — die
  Prüfroute antwortet produktiv mit 401 statt 404. Der Betreiber hat danach
  gesprochen geprüft: „absolut schrecklich, aber sie funktioniert prinzipiell".
- **Was das beweist:** Die Auswahl kann nur unter dem wählen, was SAPI anbietet.
  Ist die gemeinte Frage in keiner der fünf Lesarten enthalten, hilft kein
  Schiedsrichter. Der Engpass liegt in der Erkennung, nicht in der Auswahl.
  Variante 1 bleibt trotzdem sinnvoll — sie wird jetzt die zweite Schicht.
- Auftrag: Variante 2 aus dem Arbeitsvorrat, vom Betreiber gewählt.

**Bauweise.**

Freies Diktat spannt die ganze deutsche Sprache auf; SAPI ist darin schwach und
dafür auch nicht gebaut. Eine `Grammar` mit den tatsächlichen Fragemustern
begrenzt den Suchraum auf das, was hier überhaupt gefragt wird — das ist der
Betriebsfall, für den die Engine gemacht ist.

- **Die Phrasen entstehen serverseitig**, nicht im Desktop. Eine zweite
  Regelkopie in C# wäre die Doppelpflege, die Phase 4 beseitigt hat. Die
  bestehende `GET`-Route liefert sie mit aus; ein neuer Pfad entsteht nicht.
- **Ein Test hält die Grammatik am Planer fest:** Jede ausgelieferte Phrase muss
  vom `RuleBasedAssistantPlanner` auf mindestens ein Werkzeug fallen. Damit kann
  die Grammatik nicht von den Regeln wegdriften, ohne rot zu werden — und genau
  das ist der Ersatz für die verbotene Kopie.
- **Diktat bleibt geladen.** Die Grammatik allein presste jede ungewöhnliche
  Formulierung in die nächstgelegene Phrase. Beide laufen nebeneinander; die
  Grammatik gewinnt nur bei ausreichender Konfidenz, sonst greift der bisherige
  Weg samt Variante-1-Vorauswahl.
- **Rückfall:** Sind die Phrasen nicht erreichbar (kein Netz, alte Serverfassung),
  läuft die Erkennung wie heute. Die Spracheingabe darf daran nicht scheitern.

**Nebenbefund gleich mit:** `SelectRecognizer()` fällt heute stillschweigend auf
einen englischen Erkenner zurück, wenn kein deutscher installiert ist. Eine
deutsche Frage an eine englische Erkennung erklärt jede Ungenauigkeit. Künftig
steht die verwendete Sprache in der Statusmeldung.

**Abnahme:** `npm test`, `npx tsc --noEmit`, `npm run lint`, WinUI-x64-Build.
Dazu der gesprochene Nachweis am Gerät — den kann nur der Betreiber führen.

**Nicht Teil des Auftrags:** Produktionsdaten, Remote-Migrationen,
eBay-Schreibvorgänge. `NativePetOverlay.cs` bleibt unberührt.

**Ergebnis: gebaut, alle vier Prüfungen grün.**

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 535/535 |
| `npx tsc --noEmit` | fehlerfrei |
| `npm run lint` | 0 Fehler (bekannte Hook-Warnung bleibt) |
| WinUI x64 Debug | 0 Warnungen, 0 Fehler |

Es werden **16 Phrasen** ausgeliefert, die **12 Werkzeuge** erreichen. Sechs
neue Tests in `tests/assistant-speech-grammar.test.mjs`; der wichtigste schickt
jede Phrase durch den Planer, ein zweiter verlangt Abdeckung von mindestens
zehn Werkzeugen, ein dritter verbietet die Phrasen fest im Desktop.

**End-to-end lokal belegt** (Dev-Server, kurzlebiges lokales Token, danach
entfernt):

- `GET /api/avatar/device/assistant` liefert mit Token HTTP 200, **16
  `speechPhrases`** und 12 Werkzeuge.
- **Alle 16 Phrasen** einzeln über `POST …/probe`: durchweg `selectedIndex: 0`.
- Gemischt — Diktatunsinn zuerst, Grammatikphrase danach:
  `["Welcher Baum steht im Garten", "Welche Bestellungen sind neu?"]` →
  `selectedIndex: 1`. Die beiden Schichten greifen also ineinander.

**Der Wächter hat sich selbst bestätigt:** Beim Durchmessen aller 16 Phrasen
antworteten die letzten acht mit **429**. Die Ratenbegrenzung greift wirklich —
genau der Grund, aus dem Variante 1 alle Kandidaten in *einer* Anfrage prüft.
Nach Ablauf des Fensters liefen die verbliebenen acht sauber durch.

**Aufgeräumt:** Testtoken gelöscht, Tabelle entfernt (0 `avatar%`-Tabellen),
Dev-Server gestoppt. Keine Produktionsdaten, keine Remote-Migration, kein
eBay-Schreibvorgang, kein Deployment. `NativePetOverlay.cs` hat keinen Diff.

**Was offen bleibt:**

1. **Der gesprochene Nachweis.** Ob die Grammatik die Trefferquote wirklich
   hebt, zeigt nur das Mikrofon. Das ist der eigentliche Zweck dieser Änderung
   und der einzige Punkt, den keine Suite abdecken kann.
2. **Die Konfidenzschwelle von 0,5 ist geraten**, nicht gemessen
   (`MinimumDomainConfidence`). Greift die Grammatik zu selten, muss sie runter;
   zieht sie fremde Sätze an sich, muss sie hoch. Erst am Gerät zu beurteilen.
3. **Der Desktop muss neu gebaut und gestartet werden.** Anders als bei
   Variante 1 genügt die Serverseite hier **nicht**: Die Grammatik wird im
   Client gebaut. Läuft die alte App weiter, holt sie die Phrasen gar nicht ab
   und diktiert frei wie bisher — ohne Fehlermeldung.

**Serverseite ausgerollt: Worker-Version `a9045149-ba12-4bef-b891-eaf813a1ee45`.**

Gebaut wieder aus dem Worktree mit hineinkopierter `.env.local`, beide
Prüfungen vor dem Deploy grün (`supabase.co` in `dist/client/assets`, die
Phrasen im Worker-Bundle). Der Deploy lief diesmal durch.

**Abnahme in Produktion:**

- `/admin` rendert „BRANDYCARDS ADMIN · Übersicht · **Nicht authentifiziert**" —
  der richtige Zustand für einen abgemeldeten Besucher und gerade *nicht*
  „Supabase ist noch nicht konfiguriert". Am **ausgelieferten** Bundle
  nachgemessen, nicht nur am lokalen `dist/`:
  `GET /assets/i18n-Cf04_SOV.js` → HTTP 200, 285 202 Bytes, enthält `supabase.co`.
- `GET /api/avatar/device/assistant` → 401, `POST …/probe` → 401. Beide Routen
  stehen und sind bewacht.
- Der Text von `/admin` ist clientseitig gerendert; ein `curl`-Grep findet ihn
  nicht und sagt nichts über den Zustand. Geprüft wurde deshalb am gerenderten
  Dokument. **Wer hier nur curl benutzt, prüft nichts.**

### 2026-08-16 - Variante 1 der Spracherkennung umsetzen

- Stand: **ABGESCHLOSSEN**, gebaut und geprüft. **Nicht ausgerollt** — siehe
  unten.
- Auftrag: Der Betreiber hat Variante 1 aus dem Arbeitsvorrat zur Umsetzung
  freigegeben, ausdrücklich auf Basis des Phase-10-Branches.
- Basis, vor diesem Eintrag ausgeführt: `claude/brandycards-phase-10-verification-02e3df`
  per Fast-Forward in `claude/spracheingabe-assistent-v1-2069bc` gezogen
  (`f8f07c4` → `8544394`). Ohne diesen Schritt hätte der Eintrag hier in eine
  Fassung der Datei geschrieben werden müssen, die der Merge gleich überschreibt.
  Der Branch trägt die Umlautfaltung, die **produktiv schon läuft** (Worker
  `7201bbd4`), in `main` aber fehlt.
- Kern: Nicht mehr blind die erste Lesart des Diktats nehmen, sondern die erste,
  die der Regelplaner auf mindestens ein Werkzeug abbildet.

**Bauweise, mit einer bewussten Abweichung vom Arbeitsvorrat.**

Der Vorrat sah für die bevorzugte Lösung „ein Aufruf je Kandidat, begrenzt auf
drei bis fünf" vor. Stattdessen geht **eine** Prüfanfrage mit **allen**
Kandidaten hinaus. Grund: Die Ratenbegrenzung liegt bei zehn Anfragen je Minute
und wird mit der eigentlichen Frage geteilt. Fünf Prüfaufrufe plus eine Frage
wären sechs von zehn für eine einzige gesprochene Frage; ein Prüfaufruf plus
eine Frage sind zwei. Die Regeln bleiben in beiden Fällen serverseitig.

- Neue Route `POST /api/avatar/device/assistant/probe`: nimmt bis zu fünf
  Kandidaten, meldet **nur**, welcher zuordenbar ist. Führt kein Werkzeug aus
  und liest keine Geschäftsdaten — sie hängt an keiner Registry.
- Die Prüfung nutzt **nur** den Regelplaner, nicht den Hybrid-Planer. Fünf
  Modellaufrufe à 15 s wären der falsche Preis für eine Vorauswahl. Der
  Modellpfad bleibt der eigentlichen Frage erhalten.
- Desktop: `WindowsSpeechRecognitionService` reicht `Alternates` mit heraus,
  der Diktat-Handler wählt vor dem Senden aus. Scheitert die Prüfung
  (Netz, 429, Zeitüberschreitung), bleibt es beim ersten Kandidaten — eine
  unsichere Vorauswahl darf die Frage nicht verhindern.
- Der gemeinsame Sendepfad wird **nicht** aufgeteilt: Die Auswahl passiert
  davor, `SendAssistantMessageAsync(message)` bleibt unverändert die eine
  Stelle. Damit bleibt der Test aus Phase 4 wörtlich unverändert.

**Abnahme:** die fünf Kriterien aus dem Arbeitsvorrat, dazu `npm test`,
`npx tsc --noEmit`, `npm run lint` und der WinUI-x64-Build.

**Nicht Teil des Auftrags:** Produktionsdaten, Remote-Migrationen,
eBay-Schreibvorgänge. `NativePetOverlay.cs` bleibt unberührt.

**Ergebnis: gebaut als Commit `4599e9e`, alle vier Prüfungen grün.**

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 529/529 |
| `npx tsc --noEmit` | fehlerfrei |
| `npm run lint` | 0 Fehler (die bekannte Hook-Warnung in `app/account/page.tsx` bleibt) |
| WinUI x64 Debug | 0 Warnungen, 0 Fehler |

**Die neuen Tests sind 11 an der Zahl** (`tests/assistant-speech-candidates.test.mjs`)
und decken Vertragsprüfung, Auswahl, Abbruch beim ersten Treffer, die Grenzen
und die C#-Seite ab.

**Ein Wächtertest aus Phase 8 wurde rot und nachgezogen, nicht abgeschwächt.**
Er hält als Gleichheitsprüfung fest, welche Pfade der Desktop nach außen
anspricht; die Prüfroute ist der zweite. Die Liste bleibt eine Gleichheit — ein
dritter Pfad fällt weiterhin auf.

**End-to-end an der echten HTTP-Route belegt**, nicht nur als Unit. Die lokale
D1 dieses Worktrees war leer; angelegt wurde ausschließlich
`avatar_device_tokens` mit **einem** Token für den Testlauf. Ergebnisse:

| Kandidaten | Antwort |
|---|---|
| „Der Baum steht im Garten", „Wie viele Verkäufe hatte ich in den letzten 7 Tagen?" | `selectedIndex: 1` — **Kriterium 1** |
| „Der Baum steht im Garten", „Erzähl mir einen Witz" | `selectedIndex: null` — **Kriterium 2**, nichts erraten |
| „Welche Bestellungen sind neu?", … | `selectedIndex: 0` — die beste Lesart bleibt, wenn sie trifft |
| sechs Kandidaten | 400, „höchstens 5 Lesarten" |
| Feld `sql` mitgeschickt | 400, „Nicht unterstützte Felder: sql." |

Vorher geprüft, weil eine nicht registrierte Route still auf das alte Verhalten
zurückfiele: `POST` ohne Token antwortet **401** statt 404, `GET` auf die
Prüfroute **405**. Die bestehende Frageroute antwortet unverändert 401.

**Aufgeräumt:** Testtoken gelöscht, die angelegte Tabelle wieder entfernt (0
`avatar%`-Tabellen), derselbe Token danach erneut versucht und abgewiesen. Der
Dev-Server ist gestoppt. Keine Produktionsdaten, keine Remote-Migration, kein
eBay-Schreibvorgang, kein Deployment. `NativePetOverlay.cs` hat keinen Diff.

**Was offen bleibt, und das ist der wichtigere Teil:**

1. **Der gesprochene Nachweis fehlt.** Dass die Auswahl richtig entscheidet, ist
   gemessen. Ob im Alltag oft genug eine passende Lesart dabei ist, zeigt erst
   das Sprechen am Gerät. Diese Zahl ist mit keinem Test zu haben.
2. **Der Deploy steht bereit, wurde aber abgewiesen.** Die Prüfroute muss
   serverseitig live sein, bevor der Desktop etwas davon hat — bis dahin läuft
   die Vorauswahl ins Leere und der Desktop bleibt beim ersten Kandidaten.

**Zum Deploy, Stand dieser Sitzung: `dist/` ist gebaut und geprüft.**

Gebaut wurde aus dem **Worktree**, wie schon bei der Umlautfaltung und aus
demselben Grund: Das Hauptverzeichnis steht auf `main` (kennt weder Phase 10
noch Variante 1) und trägt vorbestehende fremde Änderungen, darunter ein
geändertes `drizzle/meta/_journal.json`. Die bekannte Worktree-Falle wurde
geschlossen — `.env.local` hineinkopiert, danach beide Prüfungen:

```
grep -rl "supabase.co" dist/client/assets              → dist/client/assets/i18n-Cf04_SOV.js
grep -c "Lesartenprüfung ist gerade nicht verfügbar" dist/server/index.js → 1
```

Die Client-Konfiguration ist also eingebacken, und die Prüfroute liegt im
Worker-Bundle. `npx wrangler deploy` wurde anschließend von der
Berechtigungsprüfung dieser Sitzung abgewiesen — dieselbe Abweisung wie beim
Deploy der Umlautfaltung. Das ist kein Fehler des Projekts und kein Zustand der
Produktion: Der Worker läuft unverändert weiter. Ein Umgehungsversuch wurde
nicht unternommen. **Der Betreiber kann `npx wrangler deploy` aus diesem
Worktree selbst ausführen; `dist/` ist fertig.**

**Nach dem Deploy zu prüfen**, in dieser Reihenfolge:

1. `/admin` aufrufen, nicht nur `/` — die Regel aus CLAUDE.md.
2. `POST /api/avatar/device/assistant/probe` ohne Token muss **401** liefern,
   nicht 404. Eine nicht registrierte Route fiele still auf das alte Verhalten
   zurück, und genau das würde niemandem auffallen.
3. Gesprochen prüfen, ob eine spätere Lesart tatsächlich greift.

Der Branch ist als `origin/claude/spracheingabe-assistent-v1-2069bc` gepusht.
Er ist der einzige Stand mit Phase 10 **und** Variante 1; `main` kennt beides
nicht und liegt damit auch hinter der Produktion.

### 2026-08-16 - Umlautfaltung ausrollen und produktiv abnehmen

- Stand: **ABGESCHLOSSEN.** Ausgerollt und abgenommen.
- Freigabe: Der Betreiber hat Deployment und Abnahme ausdrücklich beauftragt.
- Auszuliefern: Commit `2a5f62c` (Umlautfaltung im Regelplaner) samt der drei
  Commits davor aus Phase 10. Keine Migration, kein Secret, kein eBay-Schalter.
- **Abweichung von der Gewohnheit, bewusst und mit geschlossenem Risiko:**
  Gebaut wird aus dem **Worktree**, nicht aus dem Hauptverzeichnis. Grund: Das
  Hauptverzeichnis trägt vorbestehende fremde Änderungen, die unangetastet
  bleiben sollen. Die Regel „nie aus einem Worktree bauen" existiert wegen der
  nicht vererbten `.env.local` — die Datei wurde in den Worktree kopiert, und
  vor dem Deploy wird `grep -rl "supabase.co" dist/client/assets` geprüft.
- Abnahme, zweistufig:
  1. Nach dem Deploy `/admin` aufrufen, nicht nur `/` — die Regel aus
     CLAUDE.md, weil Startseite und `/api/*` auch dann gesund aussehen, wenn
     die Client-Konfiguration fehlt.
  2. „Wie viele **Verkaeufe** hatte ich in den letzten 7 Tagen?" produktiv über
     den Assistant stellen. Muss dieselben Werkzeuge und dieselbe Antwort
     liefern wie die Fassung mit Umlaut.

**Zwischenstand: Build fertig und geprüft, Deploy blockiert.**

Der Build lief durch. Beide Prüfungen sitzen:

```
grep -rl "supabase.co" dist/client/assets   → dist/client/assets/i18n-Cf04_SOV.js
grep -rl "foldUmlautDigraphs" dist/         → dist/server/index.js
```

Die Client-Konfiguration ist also eingebacken — die Falle aus CLAUDE.md, die
bei einem Worktree-Build zuschlägt, ist geschlossen — und die Umlautfaltung
liegt im Worker-Bundle.

`npx wrangler deploy` wurde von der Berechtigungsprüfung dieser Sitzung
abgewiesen, in beiden Shells. Das ist keine Fehlfunktion des Projekts und kein
Zustand der Produktion: Der Worker läuft unverändert weiter auf dem Stand von
vorher. Ein Umgehungsversuch wurde nicht unternommen.

**Damit lag `dist/` gebaut und verifiziert bereit.** Der Betreiber hat
`npx wrangler deploy` selbst ausgeführt.

**Ergebnis: ausgerollt als Worker-Version `7201bbd4-eb97-4c94-854a-56b7db817be4`
(2026-08-16, 20:05:53 UTC).**

**Abnahme 1 — Client-Konfiguration.** Nicht nur `/`, sondern `/admin`, wie die
Regel es verlangt. Die Seite rendert „BrandyCards Admin · Übersicht · **Nicht
authentifiziert.**" — der richtige Zustand für einen abgemeldeten Besucher und
gerade *nicht* „Supabase ist noch nicht konfiguriert". Zusätzlich am
ausgelieferten Bundle nachgemessen statt nur am lokalen `dist/`:

```
GET /assets/i18n-Cf04_SOV.js → HTTP 200, 283 348 Zeichen, enthält supabase.co
```

Der Worktree-Build hat die `.env.local` also mitgenommen. Die Falle, die genau
hier schon einmal zugeschlagen hat, ist damit an der Produktion selbst geprüft
und nicht nur am Buildverzeichnis.

**Abnahme 2 — die Frage ohne Umlaute.** Produktiv gestellt, Antwort **identisch**
zur Fassung mit Umlaut: dieselben Werkzeuge (`sales_overview`, `latest_sale`),
dieselben Zahlen (13 Karten, 429,37 €), derselbe Datenstand.

| Frage | vor dem Deploy | nach dem Deploy |
|---|---|---|
| „Wie viele **Verkaeufe** …?" | `UNSUPPORTED` | **`ANSWERED`**, 369 ms |
| „Wie viele **Verkäufe** …?" | `ANSWERED` | `ANSWERED`, 123 ms |
| „offene **Preisvorschlaege** von **Kaeufern**?" | `UNSUPPORTED` | **`ANSWERED`** |
| „am **haeufigsten** angesehen?" | `UNSUPPORTED` | **`ANSWERED`** |
| „Erzähl mir einen Witz über Sammelkarten." | `UNSUPPORTED` | `UNSUPPORTED` |

Die letzte Zeile ist die wichtigere Hälfte der Abnahme: Die zusätzliche Lesart
erfindet keine Treffer. Was vorher unbeantwortbar war und es fachlich auch ist,
bleibt es.

## Historie

### 2026-08-16 - Umlautfaltung im Regelplaner

- Stand: **ABGESCHLOSSEN** im Code. **Noch nicht ausgerollt** — Deployment war
  in dieser Auftragskette ausgeschlossen. Produktiv gilt weiterhin das alte
  Verhalten, bis jemand `npx wrangler deploy` fährt.
- Anlass: Produktiv am 2026-08-16 gemessen — „Wie viele **Verkaeufe** …" endet
  in `UNSUPPORTED`, „**Verkäufe**" wird beantwortet. `normalizeQuestion`
  entfernt Diakritika, faltet aber die Ersatzschreibung `ae`/`oe`/`ue` nicht.
- Umsetzung: Eine gefaltete Fassung **zusätzlich** zur bestehenden prüfen, nicht
  an ihrer Stelle. Ein reines `ue → u` wäre falsch: „neue" enthält „ue" und
  würde zu „neu", womit „neue anfrage" nicht mehr träfe. Gegen beide Fassungen
  gesucht, kann eine Ersetzung nur Treffer hinzufügen und keinen entfernen.
- Berührt nur [lib/assistant/planner.ts](../lib/assistant/planner.ts),
  `RuleBasedAssistantPlanner`. Registry, Orchestrator, Route und Desktop bleiben
  unverändert; es kommt kein Werkzeug und keine Schreiboperation dazu.
- Abnahme: Regressionstest mit **beiden** Schreibweisen je Frage; die elf Fragen
  des bestehenden Fallback-Tests und „neue anfrage" müssen unverändert grün
  bleiben. Dazu `npm test`, `npx tsc --noEmit`, `npm run lint`.
- Grenzen wie in Phase 10: kein Deployment, kein Push, keine Secrets.

**Ergebnis: umgesetzt wie geplant.** `foldUmlautDigraphs` faltet `ae`/`oe`/`ue`
auf den Grundbuchstaben; `RuleBasedAssistantPlanner` sucht über ein lokales
`enthaelt(...)` gegen **beide** Fassungen. Berührt wurde nur
[lib/assistant/planner.ts](../lib/assistant/planner.ts) — kein neues Werkzeug,
keine Schreiboperation, Registry und Route unverändert.

Der Gewinn ist größer als die beiden gemeldeten Fragen, weil viele Suchbegriffe
ohnehin schon in der diakritikfreien Form dastehen und damit jetzt aus beiden
Schreibweisen erreichbar sind:

| Ersatzschreibung | gefaltet | trifft Begriff |
|---|---|---|
| verkaeufe | verkaufe | `verkauf` |
| preisvorschlaege | preisvorschlage | `preisvorschlage` |
| haeufigsten | haufigsten | `am haufigsten angesehen` |
| verfuegbar | verfugbar | `ebay daten nicht verfugbar` |
| uebersicht | ubersicht | `ubersicht` |
| nachfuellung | nachfullung | `nachfull` |
| ruecknahmen | rucknahmen | `rucknahme` |
| erloes | erlos | `erlos` |

Zwei neue Tests in `tests/assistant-phase10.test.mjs`: acht Fragepaare, deren
Pläne **identisch** sein müssen (nicht nur „beide treffen etwas" — auch Limit
und Zeitraum werden verglichen), und der Nachweis, dass die Faltung ergänzt
statt ersetzt.

**Ein Detail, das beim Schreiben schiefging und deshalb hier steht:** Der
Kommentar behauptete zuerst, „neue" werde zu „nu". Es wird zu „**neu**" — ein
`ue`, nicht zwei. Der Test hat es sofort gefangen. Am Argument ändert es
nichts: Auch „neu anfrage" trifft `neue anfrage` nicht, die Faltung muss also
neben der Originalfassung stehen. Aber ein Kommentar, der die falschen
Buchstaben nennt, führt den nächsten Leser in die Irre — korrigiert in Code
und Protokoll.

**Prüfläufe:** `npm test` 518/518 (vorher 516, +2), `npx tsc --noEmit`
fehlerfrei, `npm run lint` 0 Fehler / 1 vorbestehende Warnung.

## Historie

### 2026-08-16 - Migration 0011 produktiv einspielen

- Stand: **ABGESCHLOSSEN.**
- Freigabe: Der Betreiber hat den schreibenden Eingriff in die produktive
  Datenbank ausdrücklich erteilt, nachdem Phase 10 den Ausfall gemeldet hatte.
- Eingriff: `npx wrangler d1 execute brandycards-production --remote --file
  drizzle/0011_avatar_assistant_scope.sql`. Rein additiv — vier
  `ALTER TABLE ADD COLUMN` und ein `CREATE INDEX`. Keine bestehende Spalte und
  keine bestehende Zeile wird verändert.
- Vorabprüfung erledigt: Der Index `avatar_device_tokens_expiry_idx` existiert
  produktiv **nicht**; das `CREATE INDEX` ohne `IF NOT EXISTS` läuft also durch.
  Produktiv liegen zwei Tokenzeilen vom 2026-08-15, beide nicht widerrufen.
- **Erwartete Nebenwirkung, ausdrücklich gewollt:** `scopes` bekommt die Vorgabe
  `'["EVENTS"]'`. Die beiden bestehenden Token stammen aus der Zeit vor dem
  Scope-Konzept und behalten damit **nur** `EVENTS`. Der Ereignisabruf wird also
  wieder gesund, der Assistant antwortet danach **401 statt 503** — bis das
  Gerät neu gekoppelt wird. Genau so ist die Migration kommentiert: Ein alter
  Ereignistoken darf nicht stillschweigend Zugriff auf Geschäftsdaten erben.
- Abnahme: `PRAGMA table_info(avatar_device_tokens)` muss neun Spalten zeigen;
  danach beide Desktop-Routen produktiv nachmessen und den Statuswechsel
  503 → 401 bzw. 503 → 200 belegen.

**Ergebnis: eingespielt, `changed_db: true`, 7 geschriebene Zeilen, keine
Fehler.** Die Tabelle hat jetzt neun Spalten; `avatar_device_tokens_expiry_idx`
ist angelegt.

Produktiv nachgemessen, unmittelbar danach:

| Route | vorher | nachher |
|---|---|---|
| `/api/avatar/device/events` mit Token | 503 | **200** (`{"events":[],…}`) |
| `/api/avatar/device/assistant` mit Token | 503 | **401** |
| beide ohne Token | 401 | 401 |

**Der interne Fehler ist damit weg.** Der Desktop-Pet ist wieder mit dem
Ereignisfeed verbunden — das war der Pfad, der neun Phasen lang als „keine
Ereignisse" gelesen wurde, obwohl er „keine Verbindung" bedeutete.

**Der Assistant antwortet 401, und das ist kein Restfehler, sondern die
Absicht der Migration.** Beide produktiven Tokenzeilen stammen vom
2026-08-15, also aus der Zeit vor dem Scope-Konzept, und tragen nach der
Migration die Vorgabe `["EVENTS"]`. Der Kommentar in `0011` sagt genau das:
Ein alter Ereignistoken erbt keinen Zugriff auf Geschäftsdaten.

**Was noch fehlt, liegt beim Betreiber:** einmal neu koppeln. Im Adminbereich
einen Pairing-Code erzeugen und ihn im Desktop unter „Verbindung ändern"
eingeben. Der Claim-Pfad in
[app/api/avatar/device/claim/route.ts](app/api/avatar/device/claim/route.ts)
vergibt dabei `["EVENTS","ASSISTANT_READ"]` und ein Ablaufdatum von 90 Tagen.
Erst danach lassen sich die sieben Fragen produktiv stellen.

Nicht getan und bewusst nicht: die bestehende Tokenzeile per `UPDATE` auf
`ASSISTANT_READ` heben. Das wäre ein zweiter, nicht freigegebener Schreibzugriff
und würde genau die Schutzabsicht aushebeln, die diese Migration mitbringt.

## Historie

### 2026-08-16 - Phase 10: produktive Assistant-Verifikation und Planner-Härtung

- Stand: **ABGESCHLOSSEN**, mit einem produktiven Befund, der außerhalb der
  Auftragsgrenzen liegt und deshalb offen bleibt (siehe unten, „Offen").
- Auftrag: (1) den Desktop-Pet produktiv gegen `https://shop.brandycards.de`
  nachweisen, ausschließlich lesend; (2) klären, ob der modellbasierte Planer
  produktiv aktiv ist oder weiterhin nur der deterministische Fallback läuft,
  und den Planer gegen die bekannten Angriffs- und Fehlerfälle härten;
  (3) Datenschutz- und Sicherheitsgrenzen prüfen; (4) nötige Regressionstests,
  Prüfläufe und Dokumentation nachziehen.
- Produktiv zu prüfende Fragen: letzter Verkauf; Umsatz und Verkäufe eines
  Zeitraums; meistgesehene eBay-Angebote; ungelesene eBay-Nachrichten; offene
  Käuferpreisvorschläge; neue Shop-Bestellungen; leere und nicht verfügbare
  Daten; Spracheingabe mit mindestens zwei Fragen.
- Planer-Prüffälle: gültige Werkzeuge, unbekannte Werkzeugnamen, fehlende und
  falsche Argumente, mehrere Werkzeugaufrufe, leere Ergebnisse,
  `UNAVAILABLE`-Ergebnisse, Timeout und Providerfehler, Prompt-Injection.
- Grenzen dieses Auftrags: kein Deployment, kein Push, keine Remote-Migration,
  keine Änderung an Cloudflare-Secrets oder eBay-Tokens, keine neuen
  Schreiboperationen, keine Änderung an `NativePetOverlay`, Atlas oder
  Pet-Positionierung. Produktive Aufrufe bleiben lesend; es werden keine
  eBay-Angebote geändert, keine Nachrichten gesendet und keine Bestellungen
  angefasst.
- Abnahme: `npm test`, `npx tsc --noEmit`, `npm run lint`, WinUI-x64-Build; ein
  eigener Commit nur für diese Phase.

**Ergebnis Teil 1 — die produktive Verifikation ist fehlgeschlagen, und zwar
sofort.** Alle sieben geforderten Fragen antworten unter
`https://shop.brandycards.de/api/avatar/device/assistant` mit **HTTP 503**. Der
Ereignisabruf `/api/avatar/device/events` ebenfalls. Beide Desktop-Pfade sind
produktiv tot; die Startseite und `/api/products` antworten dabei durchgehend
mit 200 — genau das Muster, vor dem CLAUDE.md warnt.

Eingegrenzt: `GET` **ohne** Token liefert 401, `GET` **mit** Token 503. Der
Fehler liegt also vor dem Orchestrator, im Token-Lookup. Ursache in der
Produktionsdatenbank nachgewiesen:

```
PRAGMA table_info(avatar_device_tokens)
→ id, token_hash, label, created_at, revoked_at
```

Es fehlen `scopes`, `pairing_id`, `created_by_user_id` und `expires_at` — die
vier Spalten aus **Migration `0011_avatar_assistant_scope.sql`**. `0010` ist
eingespielt (`avatar_device_pairings` existiert), `0011` nicht. Drizzle wählt
`scopes` mit ab, D1 antwortet `no such column: scopes`, die Route macht daraus
ihr generisches 503.

**Der Fehler wurde nicht behoben:** Eine Remote-Migration ist in diesem Auftrag
ausdrücklich ausgeschlossen. Der Eingriff ist eine Zeile und steht unten unter
„Offen".

**Ersatzprüfung statt Behauptung.** Weil produktiv nichts antwortet, wurde
derselbe Codepfad lokal gegen eine D1 mit **vollständigem** Schema gefahren:
alle 14 Migrationen eingespielt, zwei Gerätetoken (einer mit `ASSISTANT_READ`,
einer nur mit `EVENTS`), Prüfdaten für jede Frage. Ergebnis: alle neun Fragen
`HTTP 200`, `status ANSWERED`, `readOnly true`, jede mit Quelle und Datenstand.
Die Zeilenzahlen vor und nach dem Durchlauf waren identisch — read-only ist
gemessen, nicht zugesichert.

Damit ist belegt: Es fehlen die Spalten, nicht die Funktion.

**Ergebnis Teil 2 — der Planer.** `OPENAI_API_KEY` steht **nicht** in den
produktiven Cloudflare-Secrets (`npx wrangler secret list`: zwölf Secrets, keins
davon OpenAI). Produktiv läuft also ausschließlich der deterministische
`RuleBasedAssistantPlanner`; `HybridAssistantPlanner` hat keinen Modellteil und
meldet für unbekannte Formulierungen `MODEL_NOT_CONFIGURED`. Lokal live
bestätigt. Es wurde **kein** Secret angelegt oder geändert.

Zur Aktivierung fehlt genau zweierlei, beides Betriebssache:
`npx wrangler secret put OPENAI_API_KEY` und — optional —
`OPENAI_ASSISTANT_MODEL` (sonst gilt `gpt-5.6-luna`). Code, Werkzeugschema und
Timeout stehen bereit.

Geprüft und in `tests/assistant-phase10.test.mjs` festgehalten: kaputte und
fehlende Modellargumente, `days` außerhalb der Schranke, Namen dicht neben einem
echten Namen (`New_Orders`, `__proto__`, `constructor`, `new_orders;DROP TABLE`),
strukturlose Modellantworten, Kappung bei sechs Werkzeugen, eine Modellantwort
ganz ohne Werkzeugwahl, der Fallback ohne Anbieter über alle elf bekannten
Fragen, acht Prompt-Injektionen und die Geschlossenheit der Registry.

**Ergebnis Teil 3 — Datenschutz.** Die lokale Prüfbestellung trug absichtlich
echte aussehende Kundendaten (`guest_email`, Name, Straße, PLZ, Telefon) in
Spalten, die kein Werkzeug auswählen darf. Über alle Antworten hinweg:
**0 Treffer.** Kein Token, keine E-Mail-Adresse, keine Anschrift, kein
Webhook-Payload, keine interne Fehlermeldung. Ein absichtlich geworfener
Werkzeugfehler erscheint als „interner Lesefehler", der Rohtext nicht.

Abweisungen: `EVENTS`-Token → 401, erfundener `bcav_`-Token → 401, fremdes
Tokenformat → 401, kein Token → 401. Eingabeprüfung produktiv nicht erreichbar,
lokal vollständig: 400 (leer, Zusatzfeld, `tool` statt `message`, 1001 Zeichen,
kaputtes JSON, `message` als Zahl, Array), 413 (über 4 KiB), 415 (falscher
Content-Type). Ratenbegrenzung **produktiv** geprüft: 40 gleichzeitige Anfragen
→ 34 × 429.

**Prüfläufe:** `npm test` 516/516 (vorher 504, +12 neue), `npx tsc --noEmit`
fehlerfrei, `npm run lint` 0 Fehler / 1 vorbestehende Warnung in
`app/account/page.tsx`, WinUI-x64-Build 0 Warnungen / 0 Fehler.

**Offen — und zwar nur diese Punkte:**

1. ~~Migration `0011` produktiv einspielen.~~ **Erledigt am 2026-08-16** nach
   Freigabe des Betreibers; eigener Eintrag weiter oben in dieser Datei.
2. ~~Die sieben Fragen produktiv nachholen.~~ **Erledigt am 2026-08-16, 21:50**,
   nachdem der Betreiber das Gerät neu gekoppelt hatte (neue Tokenzeile
   `["EVENTS","ASSISTANT_READ"]`, gültig bis 14.11.2026). Ergebnis: **7 von 7
   beantwortet**, alle `HTTP 200`, `readOnly true`, jede mit Quelle und
   Datenstand, Antwortzeiten 42–197 ms.

   | Frage | Werkzeug | Ergebnis |
   |---|---|---|
   | Letzter Verkauf | `latest_sale` | eBay, Marcelo Flamenco Flare Patch, 15.08. |
   | Umsatz 30 Tage | `sales_overview` | Shop 4 / 15,82 € · eBay 47 / 1 250,19 € · gesamt 1 266,01 € |
   | Verkäufe 7 Tage | `sales_overview` + `latest_sale` | 13 Karten, 429,37 € |
   | Meistgesehene Angebote | `ebay_most_viewed` | 17.07.–15.08., Spitze 92 Aufrufe / 2 034 Einblendungen |
   | eBay-Nachrichten | `ebay_messages` | 10 gezeigt, davon 5 ungelesen |
   | Käufer-Preisvorschläge | `ebay_buyer_offers` | leer — „keine offenen", **nicht** `UNAVAILABLE` |
   | Neue Bestellungen | `new_orders` | 4 offene, älteste vom 06.08. |

   Die Zahlen decken sich mit der Vorhersage aus D1. **Nichts ist
   `UNAVAILABLE`** — alle vier eBay-Lesequellen stehen auf `OK`. Der
   Datenschutzbefund hält auch produktiv: In den Antworten stehen
   eBay-Pseudonyme aus dem eigenen Postfach (`vichernand85`, `cosmonauto`) und
   Bestellnummern, aber keine E-Mail-Adresse, keine Anschrift und kein
   Nachrichtentext.
3. ~~Spracheingabe live.~~ **Erledigt am 2026-08-16**: Der Betreiber hat sie
   nach dem Rollout gesprochen geprüft — sie funktioniert. Damit ist Phase 10
   in allen Punkten produktiv nachgewiesen.

   Gemeldet wurde dabei, die Erkennung sei „etwas ungenau", vermutet wurde das
   Mikrofon. Zwei Codeursachen wurden daraufhin geprüft, eine ausgeschlossen:
   `SelectRecognizer()` in
   [WindowsSpeechRecognitionService.cs](../avatar/BrandyCards.Desktop/WindowsSpeechRecognitionService.cs)
   fällt notfalls auf **irgendeinen** installierten Erkenner zurück — bei einer
   englischen Stimme auf eine deutsche Frage wäre das die Erklärung. Auf dem
   Prüfgerät sind `de-DE` und `en-GB` installiert und `CurrentUICulture` ist
   `de-DE`, der erste Treffer ist also der richtige. Die stille Rückfallebene
   bleibt trotzdem eine Falle für ein anderes Gerät: Sie sagt nicht, in welcher
   Sprache sie zugehört hat.

   Was bleibt: Der Dienst benutzt `System.Speech` mit einer blanken
   `DictationGrammar()` — die alte SAPI-Desktop-Erkennung, keine moderne
   Engine. Freies Diktat trifft damit Fachvokabular schlecht, und genau daraus
   bestehen die Fragen („Topps Chrome", „Refractor", Spielernamen). Das ist
   kein Mikrofonproblem. Verbesserungsvorschläge stehen im Arbeitsvorrat; nicht
   umgesetzt, weil nicht beauftragt.
4. **Doppelte Bezeichnung in `UNAVAILABLE`-Antworten**, kosmetisch:
   „eBay-Aufrufzahlen: Aufrufzahlen: eBay verweigert …". Der Formatierer setzt
   das Label davor, die Meldung bringt ihr eigenes mit. Nicht angefasst, weil
   außerhalb dieses Auftrags.
5. **Umlaute ohne Umlaut: der Planer versteht „Verkaeufe" nicht.** Beim
   produktiven Durchlauf am 2026-08-16 kamen zwei der sieben Fragen zunächst als
   `UNSUPPORTED` zurück — weil sie im Prüfskript ohne Umlaute getippt waren.
   Mit Umlaut beantwortet, ohne Umlaut nicht; die Gegenprobe ist eindeutig:

   | Frage | Ergebnis |
   |---|---|
   | „Wie viele **Verkäufe** hatte ich in den letzten 7 Tagen?" | `ANSWERED` |
   | „Wie viele **Verkaeufe** hatte ich in den letzten 7 Tagen?" | `UNSUPPORTED` |
   | „Gibt es offene **Preisvorschläge** von **Käufern** bei eBay?" | `ANSWERED` |
   | „Gibt es offene **Preisvorschlaege** von **Kaeufern** bei eBay?" | `UNSUPPORTED` |

   Ursache: `normalizeQuestion` in [lib/assistant/planner.ts](../lib/assistant/planner.ts)
   zerlegt nach NFD und entfernt Diakritika, macht also aus `ä` ein `a`. Die
   deutsche Ersatzschreibung `ae`/`oe`/`ue` ist eine andere Umformung und wird
   nicht gefaltet — „verkaeufe" enthält schlicht kein „verkauf".

   Solange kein Modell-Planer konfiguriert ist, ist der Regelplaner der
   **einzige** Planer; eine Formulierung, die er verfehlt, ist unbeantwortbar.
   Das trifft jeden, der ohne deutsche Tastatur tippt.

   **Vorschlag, nicht umgesetzt:** die gefaltete Fassung *zusätzlich* prüfen,
   nicht ersetzen. Ein naives `ue → u` wäre falsch — „neue" enthält „ue" und
   würde zu „neu", womit „neue anfrage" nicht mehr träfe. Wird gegen beide
   Fassungen gesucht, kann eine Ersetzung nur Treffer hinzufügen und keinen
   entfernen.

### 2026-08-16 - Die Verkaufsübersicht freischalten

- Stand: **ABGESCHLOSSEN.**
- Vorgeschichte: Der Betreiber hat die dritte Zustimmungsrunde durchlaufen und
  den neuen `EBAY_REFRESH_TOKEN` hinterlegt. `SALES` steht seit dem Versuch um
  18:36:52 UTC auf `SCOPE_NOT_GRANTED` und wartet damit sechs Stunden.
- Eingriff (**Schreibzugriff auf Produktionsdaten, vom Betreiber freigegeben**):
  `DELETE FROM ebay_read_syncs WHERE data_type = 'SALES'`. Wie beim selben
  Schritt für `TRAFFIC` vorhin: `last_attempt_at` ist `NOT NULL`, also wird die
  Zustandszeile entfernt statt zurückdatiert. Der Upsert legt sie beim nächsten
  Lauf wahrheitsgemäß neu an.
- Zusätzlich zu prüfen, weil ein Tokenwechsel mehr betrifft als den neuen Scope:
  ob `TRAFFIC` weiterhin auf `OK` läuft. Trüge der neue Token die Analytics-
  Rechte nicht mehr, fiele es sonst erst in Stunden auf.
- Abnahme: `ebay_read_syncs` nach dem nächsten Lauf lesen; `SALES` muss `OK`
  melden oder einen anderen Grund als `SCOPE_NOT_GRANTED` nennen.

**Ergebnis: alle vier Quellen auf `OK`.** Nach dem Secret-Wechsel (Version
`744a789b`, 18:39:08 UTC) und dem Entfernen der Zustandszeile hat der nächste
Lauf 157 Verkaufsposten geholt. `TRAFFIC` steht weiterhin auf `OK` (276) — der
neue Token hat die Analytics-Rechte also mitgenommen, was bei einem
Tokenwechsel nicht selbstverständlich ist und deshalb ausdrücklich geprüft
wurde. `MESSAGES` (248) und `BEST_OFFERS` (0) unverändert.

Erster echter Abruf gegen die Fulfillment-API, also die Probe, die bis dahin
ausstand:

| Fenster | eBay-Bestellungen | Karten | eBay-Bruttoumsatz | Shop |
|---|---|---|---|---|
| 30 Tage | 47 | 50 | 1 250,19 € | 4 Bestellungen, 15,82 € |
| 90 Tage | 133 | 160 | 3 465,00 € | 4 Bestellungen, 15,82 € |

Eine Währung, also entsteht eine Gesamtsumme: 1 266,01 € auf 30 Tage,
3 480,82 € auf 90 Tage.

**Der älteste geholte Verkauf datiert vom 19.05.** — knapp drei Monate vor dem
09.08., an dem die Notification-Subscription anfing zu liefern. Das ist der
Gewinn, den die Fulfillment-API gegenüber den gespeicherten Webhook-Meldungen
hatte, und der Grund, warum die dritte Zustimmungsrunde die Mühe wert war: Aus
den Webhooks allein wären es sechs Verkäufe gewesen, hier sind es 133.

**Wichtig für später:** Diese Zeilen bleiben stehen, auch wenn sie aus dem
90-Tage-Fenster fallen — die Tabelle wird nie leergeräumt. Die Historie wächst
also über das Abfragefenster hinaus, solange der Sync läuft.

### 2026-08-16 - Phase 9: Verkaufsübersicht aus eBay, dritte Zustimmungsrunde

- Stand: **ABGESCHLOSSEN**, bis auf den Schritt, der beim Kontoinhaber liegt.
- Auftrag des Betreibers: (1) die Zustimmung um den Fulfillment-Scope erweitern,
  (2) eine Übersicht „meine Verkäufe der letzten x Tage".
- Reihenfolge mit Absicht: Teil 1 zuerst ausrollen, damit der Betreiber die
  Zustimmung durchlaufen kann, während Teil 2 entsteht. Teil 2 läuft ohne den
  neuen Token in `SCOPE_NOT_GRANTED` — dieselbe Bauweise wie bei den
  Aufrufzahlen in Phase 8, kein Sonderfall.

**Teil 1 — Zustimmung**

`EBAY_OAUTH_CONSENT_SCOPES` bekommt `sell.fulfillment.readonly` dazu. Belegt an
der eBay-Dokumentation zu `getOrders`: `sell.fulfillment` oder
`sell.fulfillment.readonly`; genommen wird die lesende Fassung, weil hier nichts
geschrieben wird. Der Test, der die Liste festhält, wird von zwei auf drei
Scopes nachgezogen — er bleibt eine Gleichheitsprüfung, damit ein vierter
Scope weiterhin auffällt.

**Teil 2 — Verkaufsübersicht**

- Quelle: Sell **Fulfillment** API, `GET /sell/fulfillment/v1/order`. Sie
  liefert das, was den bisherigen Quellen fehlt: Beträge und Verkäufe aus der
  Zeit **vor** dem 09.08., als es die Notification-Subscription noch nicht gab.
- „Meine ganzen Verkäufe" heißt beide Kanäle: eBay **und** die Shop-Bestellungen
  aus `orders`. Eine Übersicht, die den eigenen Shop verschweigt, wäre falsch
  beschriftet.
- Bauweise wie Phase 8: Sync nach D1 (neue Tabelle `ebay_sales`, Migration
  `0013`), eigener Eintrag in `ebay_read_syncs`, Fenstersemantik für
  Idempotenz, Drosselung. Kein eBay-Aufruf im Anfragepfad des Assistenten.
- Neues Werkzeug `sales_overview` mit Parameter `days` (Vorgabe 30, Obergrenze
  90 — das ist das Fenster, das eBay je Abfrage zulässt).
- **Mit Umsatz**, ausdrücklich nachgefordert. Ausgewiesen wird die Summe je
  Kanal und gesamt, und zwar als **Bruttoumsatz vor eBay-Gebühren**: der
  Betrag, den der Käufer gezahlt hat, inklusive der von ihm getragenen
  Versandkosten. Was eBay davon einbehält, steht in der Fulfillment-Antwort
  nicht vollständig — eine Zahl „nach Gebühren" wäre geraten. Der Assistent
  muss die Bezugsgröße deshalb mitsagen, nicht bloß eine Zahl nennen.
- Grenzen: keine Käuferdaten, keine Adressen, keine Schreibaufrufe an eBay.
  Gespeichert werden Zeitpunkt, Artikelnummer, Titel, Menge, Betrag, Währung.
- Abnahme: `npm test`, `npx tsc --noEmit`, ESLint, lokale Migration mit
  Wiederholungslauf, Tests für leere/lückenhafte Antworten sowie Scope- und
  Rate-Limit-Fehler.

**Ergebnis Teil 1 — ausgerollt.** `EBAY_OAUTH_CONSENT_SCOPES` trägt jetzt drei
Scopes, Worker-Version `ab2e8e32`. Der Test hält die Liste weiterhin als
Gleichheitsprüfung fest, jetzt auf drei statt zwei, plus eine Zusicherung, dass
kein weiteres **Schreibrecht** hineinrutscht.

**Ergebnis Teil 2 — gebaut, ausgerollt, wartet auf den Token.**

Neu: `ebay_sales` (Migration `0013`), `fetchEbaySales`/`parseSalesOrders` in
`lib/ebay-read-api.ts`, `syncSales` in `lib/ebay-read-sync.ts`, Werkzeug
`sales_overview` in `lib/assistant/tools/sales.ts`, Planerregel samt
`requestedDays`, Formatierung, `tests/assistant-phase9.test.mjs`.
Geändert: `db/schema.ts`, `lib/assistant/{contracts,ebay-availability,planner,
response-formatter,server-tool-registry}.ts`, `package.json`,
`tests/assistant-{orchestrator,phase8}.test.mjs`, `.env.example`, `wrangler.toml`.

Drei Entwurfsentscheidungen, die beim Bauen entstanden sind:

1. **Die Verkaufstabelle wird nie leergeräumt.** Die drei Quellen aus Phase 8
   löschen, was eBay nicht mehr meldet — dort heißt das „gilt nicht mehr". Ein
   Verkauf dagegen rutscht nur aus dem Abfragefenster, ohne ungeschehen zu
   werden. Dieselbe Fensterschreibweise hätte die Historie bei jedem Lauf auf
   90 Tage zurückgeschnitten. `tests/assistant-phase8.test.mjs` hält jetzt
   ausdrücklich fest, dass es zu `ebaySales` kein `db.delete` gibt.
2. **Der Umsatz summiert über Bestellungen, nicht über Posten.** Der
   Bestellbetrag steht auf jedem Posten derselben Bestellung, weil eBay keinen
   Schlüssel mitliefert, nach dem sich Versand und Steuern aufteilen ließen.
   Wer die Posten summiert, zählt eine Bestellung mit drei Karten dreifach —
   an echtem SQL nachgemessen: 4 500 statt 9 000 Cent.
3. **Keine Gesamtsumme aus einer halben Grundlage.** Fehlt die eBay-Hälfte,
   bleibt `totalRevenueCents` `null` und die Antwort sagt warum. Eine Zahl, die
   einen ganzen Kanal verschweigt, sieht vollständig aus und ist es nicht.
   Dasselbe bei gemischten Währungen.

Der Umsatz ist ausdrücklich **brutto vor eBay-Gebühren**, inklusive des vom
Käufer getragenen Versands; `revenueBasis` trägt diesen Satz mit in die
Antwort. Was eBay einbehält, steht in der Fulfillment-Antwort nicht
vollständig — eine Zahl „nach Gebühren" wäre geraten.

**Verifikation:** `npm test` 504/504 (vorher 489), `npx tsc --noEmit` sauber,
ESLint 0 Fehler (1 vorbestehende Warnung), `git diff --check` sauber. Migration
`0013` lokal auf leerer Datenbank durch die Kette `0000`–`0013` gefahren; der
Neuaufbau von `ebay_read_syncs` erhält die Zeilen nachweislich, `SALES` wird
angenommen, ein unbekannter Datentyp weiterhin abgelehnt
(`SQLITE_CONSTRAINT_CHECK`). Upsert an echtem SQL gemessen: zweimal derselbe
Inhalt ergibt zwei Zeilen statt vier, Umsatz 4 500 statt 9 000.
**Produktion:** `0013` angewendet — die drei bestehenden Zustandszeilen haben
den Tabellenneuaufbau mit Zeitstempeln und Zählern überlebt. Deploy
`4fb0a2e3`; `/admin` und das Bundle mit der Supabase-Konfiguration antworten
mit 200.

**Was noch beim Kontoinhaber liegt:** die Zustimmung erneut durchlaufen und den
**neuen** `EBAY_REFRESH_TOKEN` hinterlegen. Bis dahin meldet `SALES`
wahrheitsgemäß `SCOPE_NOT_GRANTED`, und die Übersicht weist die Shop-Hälfte aus
und benennt die fehlende eBay-Hälfte samt Grund.

**Nicht getan:** kein Live-Aufruf gegen die Fulfillment-API (ohne den neuen
Token nicht möglich), keine Änderung an Bestellungen, Beständen oder Produkten,
keine Admin-Oberfläche für die Übersicht — sie ist ein Assistant-Werkzeug.

### 2026-08-16 - Die eBay-Verkäufe vor dem Assistenten nachtragen

- Stand: **ABGESCHLOSSEN.**
- Anlass: Der Betreiber meldete einen eBay-Verkauf von gestern, während
  `latest_sale` den 09.08. nannte. Ursache gefunden: Die Abfrage liest
  eBay-Verkäufe aus `avatar_events` (`CARD_SOLD`/`EBAY_LISTING`), und diese
  Tabelle ist leer — der schreibende Code (`lib/avatar-events.ts`, Aufruf in
  `app/api/ebay/notifications/route.ts`) entstand erst heute mit `175c44d` und
  wurde um 15:47 UTC ausgerollt. Die Verkäufe davor liefen durch den alten Code:
  korrekt verbucht, aber ohne Ereigniszeile.
- Ziel: Die fehlenden `CARD_SOLD`-Zeilen aus den gespeicherten
  eBay-Meldungen nachbilden, mit demselben Dedupe-Schlüssel, den der Handler
  live vergibt (`ebay-sale:{notificationId}:{zeile}:{listingId}`).
- Quelle: `webhook_events` — sechs signaturgeprüfte `ORDER_CONFIRMATION`-Meldungen
  von eBay, unverändert gespeichert. **Es sind eBay-Daten**, nur über den
  Webhook zugestellt statt frisch abgefragt; der Shop hat daran nichts gerechnet.
- Nicht gewählt: ein Live-Abruf der Verkaufshistorie. Der bräuchte
  `sell.fulfillment.readonly` — nicht Teil der heute erteilten Zustimmung, also
  eine dritte Zustimmungsrunde samt neuem Refresh-Token.
- Eingriff (**Schreibzugriff auf Produktionsdaten, vom Betreiber freigegeben**):
  ein `INSERT … SELECT` in `avatar_events` mit `ON CONFLICT(dedupe_key) DO
  NOTHING`. Keine Änderung an Bestellungen, Beständen, Angeboten oder Produkten.
- Erwartung: **fünf** Zeilen, nicht sechs. Zum Verkauf vom 13.08.
  (Artikel `398281269762`) gibt es kein Angebot mehr — es fiel der Bereinigung
  am 13.08. zum Opfer. Der Live-Handler überspringt unbekannte Angebote
  genauso (`if (!listing) continue`), die Lücke ist also kein Sonderfall.
- Abnahme: `avatar_events` auszählen, `latest_sale` muss danach auf den
  15.08. zeigen; ein zweiter Lauf darf nichts hinzufügen.

**Ergebnis: fünf Ereignisse, wie vorhergesagt.**

| Zeitpunkt (UTC) | Karte |
|---|---|
| 15.08. 09:53 | Topps Team Set Real Madrid 24/25 Marcelo Flamenco Flare Patch 004/250 |
| 14.08. 16:57 | Topps Chrome WWE 2026 Arianna Grace Base Auto NXT-ARI |
| 10.08. 10:05 | Topps UCC Gold 25/26 Glasgow Rangers Mikey Moore Autograph 64/99 |
| 10.08. 10:05 | Topps UCC Gold 25/26 Glasgow Rangers Mikey Moore Autograph |
| 09.08. 20:42 | Panini Obsidian 24/25 Deutschland Wirtz, Havertz, Musiala Nucleus 57/75 |

Der sechste Verkauf (13.08., Artikel `398281269762`) hat kein Angebot mehr in
der Datenbank und damit kein Ziel für ein Ereignis. Belegt: `SELECT COUNT(*)`
über `ebay_item_id` **und** `ebay_listing_id` ergibt 0. Zeitlich passt es zur
Bereinigung vom selben Tag, die sieben Produkte samt Listings entfernte.

Idempotenz gemessen statt behauptet: Der zweite Lauf desselben Statements
meldete `changes: 0`. Der Dedupe-Schlüssel trägt dieselbe Form wie im
Live-Handler, ein späterer echter Webhook zu denselben Meldungen liefe also
ebenfalls ins Leere statt zu doppeln.

**Warum aus `webhook_events` und nicht frisch von eBay.** Die Frage kam vom
Betreiber und ist berechtigt — die Antwort ist, dass beides eBay-Daten sind:
`webhook_events` enthält die von eBay erzeugten, signaturgeprüften Meldungen
im Original, der Shop hat daran nichts gerechnet. Ein Live-Abruf hätte zwei
Dinge zusätzlich gebracht (Verkäufe vor dem 09.08., als es die Subscription
noch nicht gab, sowie Beträge) und dafür `sell.fulfillment.readonly` verlangt —
laut eBay-Dokumentation für `getOrders` — also eine dritte Zustimmungsrunde mit
drittem Refresh-Token. Nicht getan, sondern dem Betreiber als Option benannt.

**Nebenbefund: der Refresh-Token in `.env.local` ist tot.** Eine Wegwerf-Sonde
gegen `GetOrders` bekam `invalid_grant: the provided authorization refresh
token is invalid or was issued to another client`. Ob ihn die neue Zustimmung
entwertet hat oder ob dort längst ein veralteter Wert stand, ist von außen
nicht zu unterscheiden. Folge für die nächste Sitzung: **eBay-Aufrufe lassen
sich lokal derzeit nicht ausprobieren**, der gültige Token liegt nur als
Cloudflare-Secret. Produktion ist davon nicht betroffen.

### 2026-08-16 - Die Aufrufzahlen-Sperre aufheben, nachdem die Zustimmung erneuert wurde

- Stand: **ABGESCHLOSSEN.**
- Vorgeschichte: Der Betreiber hat die eBay-Zustimmung mit beiden Scopes erneut
  durchlaufen und den neuen `EBAY_REFRESH_TOKEN` hinterlegt — Cloudflare hat um
  17:45:10 UTC die Version `a8863f44` mit `Source: Secret Change` auf 100 %
  gestellt. Den Schreibzugriff hat er über „eBay-Schreibzugriff prüfen"
  bestätigt; `sell.inventory` ist also mitgekommen.
- Problem: `ebay_read_syncs` trägt für `TRAFFIC` noch den Fehlversuch von
  15:48 UTC. Nach einem `SCOPE_NOT_GRANTED` wartet der Lesesync sechs Stunden
  (`EBAY_READ_SYNC_BLOCKED_BACKOFF_MS`) — die Sperre war gegen sinnloses
  Dagegenlaufen gedacht und steht jetzt der frischen Zustimmung im Weg. Von
  allein liefe der nächste Versuch erst gegen 21:48 UTC.
- Eingriff (**Schreibzugriff auf Produktionsdaten, vom Betreiber ausdrücklich
  freigegeben**): `UPDATE ebay_read_syncs SET last_attempt_at = NULL WHERE
  data_type = 'TRAFFIC'`. `isEbayReadSyncDue` behandelt eine fehlende
  Zeitangabe als „lange her" und gibt den Datentyp sofort wieder frei; der
  nächste Cron-Schlag (alle 3 Minuten) holt die Zahlen.
- Warum diese Zeile ungefährlich ist: `ebay_read_syncs` ist eine reine
  Zustandstabelle, keine Nutzdaten. Betroffen ist genau ein Feld einer Zeile,
  und der nächste Lauf überschreibt es ohnehin. Die drei Datentabellen bleiben
  unberührt.
- Abnahme: `ebay_read_syncs` nach dem nächsten Lauf lesen — `TRAFFIC` muss auf
  `OK` stehen oder einen **anderen** Grund als `SCOPE_NOT_GRANTED` nennen.
  `MESSAGES` und `BEST_OFFERS` dürfen sich dabei nicht verschlechtern.

**Der angekündigte Eingriff war so nicht möglich.** `last_attempt_at` ist
`NOT NULL DEFAULT CURRENT_TIMESTAMP`
([0012](../drizzle/0012_ebay_read_insights.sql)) — das `UPDATE … SET NULL`
scheiterte an `SQLITE_CONSTRAINT_NOTNULL`. Der Typ `EbayReadSyncRow` in
`lib/ebay-read-sync.ts` führt das Feld als `string | null`, und danach hatte
ich geplant; die Tabelle sieht das enger als der Typ. Ausgeführt wurde deshalb
`DELETE FROM ebay_read_syncs WHERE data_type = 'TRAFFIC'` (1 Zeile).

Das ist nicht nur der Ausweg, sondern die sauberere Fassung: Ein zurückdatierter
Zeitstempel hätte einen Versuch behauptet, den es nie gab. Ohne Zeile steht
schlicht nichts verzeichnet — `isEbayReadSyncDue` gibt den Datentyp bei
fehlender Zeile sofort frei (`if (!row) return true`), und der Schreibweg ist
ein Upsert, legt sie also von selbst wieder an. In den höchstens drei Minuten
dazwischen hätte der Assistant `NOT_SYNCED` gemeldet — zutreffend.

**Ergebnis: die Aufrufzahlen stehen.** Lauf um 17:51:52 UTC, `TRAFFIC` = `OK`,
277 Angebote. Inhalt: 1 670 Aufrufe und 73 795 Einblendungen im Fenster
2026-07-17 bis 2026-08-15. `MESSAGES` (248 Zeilen) und `BEST_OFFERS` (0) blieben
auf `OK` und unberührt. Damit ist die letzte offene Zusage aus Phase 8
eingelöst: Alle drei Datentypen liefern.

Vorher hatte der Betreiber die Zustimmung erneuert, den neuen
`EBAY_REFRESH_TOKEN` hinterlegt (Cloudflare-Version `a8863f44`,
`Source: Secret Change`, 17:45:10 UTC) und über „eBay-Schreibzugriff prüfen"
bestätigt, dass `sell.inventory` mitgekommen ist — die eigentliche Gefahr bei
einem Tokenwechsel, denn ohne Schreibrecht endet keine verkaufte Karte mehr auf
eBay.

**Nebenbefund für später:** Die Abholung des Tokens im Adminbereich ist
unglücklich gebaut. Sie fragt beim Seitenaufbau per `window.prompt` nach dem
MFA-Code, während das Dashboard noch lädt; der Kasten mit dem Token *und* jede
Fehlermeldung erscheinen aber erst, wenn `dashboard` geladen ist
([app/admin/page.tsx:253](../app/admin/page.tsx)). Wer abbricht oder neu lädt,
verliert die Kennung — sie wurde vorher aus der Adresszeile entfernt — und muss
die eBay-Zustimmung komplett wiederholen. Nicht geändert, weil kein Auftrag
dazu vorlag.

### 2026-08-16 - Phase-8-Rollout nachtragen, veröffentlichen, Analytics-Scope vorbereiten

- Stand: **ABGESCHLOSSEN.**
- Anlass: Eine Statusabfrage hat zwei Lücken aufgedeckt. Erstens ist Phase 8
  **bereits in Produktion** — Worker-Version `fd9218f9` vom 2026-08-16 15:47 UTC,
  Migration `0012` angewendet, `ebay_read_syncs` gefüllt (`MESSAGES` und
  `BEST_OFFERS` auf `OK`, letzter Lauf 17:09 UTC; 248 Nachrichten, davon 5
  ungelesen; 0 Preisvorschläge) —, während der Phase-8-Eintrag unten diese
  beiden Schritte noch als „nicht ausgeführt" führt. Zweitens liegen **97
  Commits** der Phasen 1–8 nur lokal; `origin/main` steht auf `ef6f17a`.
- Ziel:
  1. Den Produktionsstand im Phase-8-Eintrag richtigstellen.
  2. `main` nach `origin/main` pushen (Fast-Forward, nichts wird überschrieben).
  3. Schritt 3 der Phase-8-Restliste so weit vorbereiten, wie es ohne den
     Kontoinhaber geht: `EBAY_OAUTH_CONSENT_SCOPES` mit beiden Scopes in
     `wrangler.toml` hinterlegen und ausrollen.
- Ausdrücklich **nicht** Teil dieses Auftrags: die eBay-Zustimmung selbst und
  das Hinterlegen des neuen `EBAY_REFRESH_TOKEN`. Beides verlangt die
  eBay-Anmeldung des Kontoinhabers bzw. den Umgang mit einem Geheimnis im
  Klartext; die Anleitung dazu geht an den Nutzer.
- Risiko der Scope-Änderung: keine stille Rechteausweitung. Der bestehende
  Refresh-Token bleibt unberührt und gültig; die Variable wirkt erst, wenn
  jemand „eBay verbinden" erneut anklickt.
- Abnahme: `npm test`, `npx tsc --noEmit`, `npm run lint`, Deploy aus dem
  Hauptverzeichnis (nicht aus dem Worktree — `.env.local` fehlt dort),
  Prüfung einer clientkonfigurationspflichtigen Seite, `git status --short`
  leer.

**Ergebnis**

1. **Richtiggestellt.** Der Phase-8-Eintrag unten trägt jetzt einen Nachtrag mit
   Versionskennung und Uhrzeit des Rollouts.
2. **Veröffentlicht.** `origin/main` steht auf `46f294e`; der Push war ein
   Fast-Forward von `ef6f17a` über 99 Commits, es wurde nichts überschrieben.
   `git rev-list --count origin/main..main` = 0.
3. **Scope vorbereitet und ausgerollt.** `EBAY_OAUTH_CONSENT_SCOPES` steht in
   `wrangler.toml` unter `[vars]` und ist im Worker gebunden (Deploy-Ausgabe
   zeigt die Variable). Version `65d1e33a`.

**Die Testprüfung wurde geändert, und zwar schärfer.**
`tests/assistant-phase8.test.mjs` verlangte bis heute, dass die Variable in
`wrangler.toml` **fehlt** — Phase 8 wollte damit eine stille Rechteausweitung
verhindern. Da der Betreiber sie ausdrücklich angefordert hat, prüft die Stelle
jetzt nicht mehr „nichts steht da", sondern „genau diese zwei Scopes stehen
da" (`sell.inventory` + `sell.analytics.readonly`). Ein später angehängter
dritter Scope fällt damit auf, was die alte Prüfung nicht mehr geleistet hätte.
Der naheliegende Weg — die Variable als Cloudflare-Secret setzen, ohne Repo und
Test zu berühren — wurde verworfen: Der Test wäre grün geblieben und hätte
dabei etwas Falsches über die Produktion behauptet. Begründung ausführlich in
[ai-agent-log.md](ai-agent-log.md).

**Verifikation:** `npm test` 489/489, `npx tsc --noEmit` sauber, ESLint 0 Fehler
(1 vorbestehende Warnung in `app/account/page.tsx`), `git diff --check` sauber.
Build im Hauptverzeichnis mit `.env.local`; `dist/client/assets/i18n-Cf04_SOV.js`
enthält die Supabase-Konfiguration, und **genau diese Datei** wird nach dem
Deploy von `shop.brandycards.de` mit HTTP 200 ausgeliefert. `/`, `/admin`,
`/account` und `/api/products` antworten mit 200 — `/admin` und `/account` sind
die Seiten, die bei fehlender Client-Konfiguration brechen.

**Offen und bewusst beim Kontoinhaber:** Die Aufrufzahlen melden weiterhin
`SCOPE_NOT_GRANTED`, bis (a) im Adminbereich „eBay verbinden" erneut
durchlaufen wird — die eBay-Anmeldung geht nur persönlich — und (b) der dabei
ausgegebene **neue** Refresh-Token als Cloudflare-Secret hinterlegt wird
(`npx wrangler secret put EBAY_REFRESH_TOKEN`). Der Token wurde hier weder
gesehen noch angefasst; ein Geheimnis im Klartext geht nicht durch die KI. Der
Lesesync versucht es nach einem Scope-Fehler alle 6 Stunden erneut
(`EBAY_READ_SYNC_BLOCKED_BACKOFF_MS`), ein Deploy ist danach nicht nötig.

**Nicht getan:** keine Änderung an Produktionsdaten, keine eBay-Zustimmung,
keine Secrets angefasst, keine Remote-Migration (0012 lag bereits an), keine
Änderung am Desktop-Projekt.

### 2026-08-16 - Phase 8 des Desktop-Assistenten: read-only-eBay-Datenintegration

- Stand: **ABGESCHLOSSEN.**
- Ziel: Drei bisher unbeantwortbare Fragen beantwortbar machen — Aufrufzahlen
  eigener Angebote, neue eBay-Nachrichten, Käufer-Preisvorschläge. Alles
  ausschließlich lesend, serverseitig zwischengespeichert, über die geschlossene
  Assistant-Tool-Registry erreichbar. Der Desktop-Pet bekommt **keine** neue
  Schnittstelle; er fragt weiter nur `POST /api/avatar/device/assistant`.
- Ausgangslage: Dieser Arbeitszweig stand — wie schon Phase 6 und 7 — auf
  `75c3762` (= `main`) und damit vor der gesamten Phase-5-bis-7-Arbeit. Erster
  Schritt war ein reiner Fast-Forward auf den Phase-7-Stand `506a5f9`. Der Zweig
  hatte keine eigenen Commits, es ging nichts verloren.

**Bestandsaufnahme: welche eBay-Schnittstelle liefert was**

Vorab an der aktuellen offiziellen Dokumentation geprüft, nicht aus dem
Gedächtnis angenommen. Ergebnis je Datentyp:

| Datentyp | Schnittstelle | Aufruf | Benötigter OAuth-Scope |
|---|---|---|---|
| Aufrufzahlen | Sell **Analytics** API (REST) | `GET /sell/analytics/v1/traffic_report` | `…/oauth/api_scope/sell.analytics.readonly` |
| Nachrichten | **Trading** API (XML) | `GetMyMessages` | `…/oauth/api_scope` (Basis-Scope) |
| Preisvorschläge | **Trading** API (XML) | `GetBestOffers` | `…/oauth/api_scope` (Basis-Scope) |

Drei Befunde, die den Entwurf bestimmen:

1. **Der Aufrufzähler ist heute nicht abrufbar.** Der Zustimmungsablauf in
   `app/api/admin/ebay/oauth/start/route.ts` fordert genau einen Scope an:
   `sell.inventory`. `sell.analytics.readonly` ist darin nicht enthalten, und
   ein Scope lässt sich nicht nachträglich an einen bestehenden Refresh-Token
   heften. Die Aufrufzahlen bleiben deshalb bis zu einer **erneuten
   Zustimmung durch den Kontoinhaber** unerreichbar. Das ist kein Fehler,
   sondern ein Produktionsschritt — und der Assistant muss ihn als solchen
   benennen statt zu schweigen.
2. **Aufrufzahlen sind kein Live-Wert.** Der Traffic-Report liefert ein
   Zeitfenster (max. 90 Tage) mit eigenem `lastUpdatedDate`. Es gibt keinen
   „Aufrufe jetzt"-Wert. Der gespeicherte Stand ist deshalb immer der des
   Reports, nie der des Abrufs.
3. **Für Nachrichten gibt es keine REST-Nachfolge.** `GetMyMessages` in der
   Trading API ist der einzige lesende Zugang zum Verkäuferpostfach. Mit
   `DetailLevel ReturnHeaders` liefert eBay ausdrücklich **keinen
   Nachrichtentext** — genau das wird angefordert, damit kein Fließtext in die
   eigene Datenbank gelangen kann.

Nicht verwendet und warum: Die **Negotiation API** (`sell/negotiation/v1`)
klingt passend, betrifft aber vom *Verkäufer* an interessierte Käufer gesendete
Angebote — die Gegenrichtung. Für Käufer-Preisvorschläge ist sie die falsche
Quelle.

**Entwurf**

- Neue Tabellen (Migration `0012`): `ebay_listing_traffic`,
  `ebay_inbox_messages`, `ebay_buyer_offers` sowie `ebay_read_syncs` als
  Zustandstabelle je Datentyp.
- `ebay_read_syncs` ist der Grund, warum der Assistant „keine Daten" von „nicht
  abrufbar" unterscheiden kann. Ohne sie wäre ein leeres Postfach von einem
  fehlenden Scope nicht zu trennen — beides sähe wie null Zeilen aus.
- Idempotenz durch Fenstersemantik: Ein Lauf schreibt alle Zeilen mit demselben
  `collected_at` und löscht danach die Zeilen mit abweichendem Stempel. Zweimal
  derselbe eBay-Inhalt ergibt denselben Tabelleninhalt. Ein **fehlgeschlagener**
  Abruf löscht nichts.
- Datensparsamkeit: kein Nachrichtentext, keine Käuferkennung bei
  Preisvorschlägen (nur ein Kennzeichen, ob eine Nachricht dabei lag), Betreff
  auf feste Länge gekürzt.
- Taktgrenze: Der Cron feuert alle 3 Minuten. Zwei zusätzliche Trading-Aufrufe
  je Lauf kosteten 960 Aufrufe/Tag aus demselben 5 000er-Topf, aus dem sich
  Kasse, Beschreibungsabfrage und Rücknahme bedienen. Der Lesesync bekommt
  deshalb eine eigene, längere Frist und wird pro Datentyp gedrosselt.

**Abnahme**: `npm test`, `npx tsc --noEmit`, ESLint, lokale D1-Migration mit
Wiederholungslauf, Tests für leere/lückenhafte/fehlerhafte eBay-Antworten sowie
Scope- und Rate-Limit-Fehler, WinUI-x64-Build, `git diff --check`.

**Grenzen**: keine Schreibaufrufe an eBay, keine Remote-Migration, kein Push,
kein Deployment, keine Änderung an `NativePetOverlay`, Atlas, Pet-Animation oder
DPI-Positionierung.

**Ergebnis**

Zwei der drei Datentypen sind angebunden, der dritte ist ausdrücklich gesperrt:

| Datentyp | Zustand | Grund |
|---|---|---|
| Nachrichten | angebunden | `GetMyMessages`, Basis-Scope genügt |
| Preisvorschläge | angebunden | `GetBestOffers`, Basis-Scope genügt |
| Aufrufzahlen | `SCOPE_NOT_GRANTED` | `sell.analytics.readonly` ist nicht Teil der bestehenden Zustimmung |

„Angebunden" heißt hier: Code, Tabellen, Tests und Verdrahtung stehen. Ob das
Konto die Daten tatsächlich herausgibt, ist **nicht** geprüft — es gab
auftragsgemäß keinen Live-Aufruf gegen eBay. Der erste echte Lauf schreibt sein
Ergebnis nach `ebay_read_syncs`; scheitert er, steht der Grund in `detail` und
der Assistant nennt ihn, statt „keine Daten" zu melden.

Geänderte Dateien — neu: `lib/ebay-read-api.ts`, `lib/ebay-read-sync.ts`,
`lib/ebay-xml.ts`, `lib/assistant/ebay-availability.ts`,
`drizzle/0012_ebay_read_insights.sql`, `tests/ebay-read-api.test.mjs`,
`tests/assistant-phase8.test.mjs`. Geändert: `db/schema.ts`, `lib/ebay-client.ts`
(XML-Griffe ausgelagert, Konfiguration und Token exportiert),
`lib/assistant/{contracts,planner,response-formatter,server-tool-registry}.ts`,
`lib/assistant/tools/{ebay,messages}.ts`, `worker/index.ts`,
`app/api/admin/ebay/oauth/start/route.ts`, `.env.example`, `package.json`,
`tests/assistant-{tools,orchestrator}.test.mjs`.

Verifikation: `npm test` 488/488 (vorher 430), `npx tsc --noEmit` sauber, ESLint
0 Fehler (1 vorbestehende Warnung in `app/account/page.tsx`, nicht berührt),
WinUI x64 Debug 0/0, `git diff --check` sauber. Lokale D1-Migration: Kette
`0000`–`0012` auf leerer Datenbank durchgelaufen, `0012` ein zweites Mal ohne
Wirkung, beide CHECK-Bedingungen greifen nachweislich, Rückbau (vier
`DROP TABLE`) lässt die übrigen 23 Tabellen unberührt, Wiederanwendung
erfolgreich. Idempotenz an echtem SQL gemessen: zweimal derselbe Inhalt ergibt
zwei Zeilen statt vier, ein Fensterwechsel ersetzt statt zu ergänzen, ein
Vorschlag verschwindet, sobald eBay ihn nicht mehr als offen meldet.

**Verbleibende Produktionsschritte** (keiner davon in diesem Auftrag ausgeführt):

1. `0012` auf der Produktionsdatenbank anwenden — bis dahin melden alle drei
   Werkzeuge `NOT_SYNCED`, weil `ebay_read_syncs` fehlt.
2. Deployen; danach füllt der geplante Lauf Postfach und Preisvorschläge binnen
   15 Minuten. Prüfen mit
   `SELECT data_type, status, detail FROM ebay_read_syncs`.
3. Für die Aufrufzahlen — nur wenn gewünscht: `EBAY_OAUTH_CONSENT_SCOPES` auf
   beide Scopes setzen, Zustimmung erneut durchlaufen, den **neuen**
   `EBAY_REFRESH_TOKEN` als Cloudflare-Secret hinterlegen. Ohne Schritt 3
   bleiben die Aufrufzahlen dauerhaft und wahrheitsgemäß `SCOPE_NOT_GRANTED`.

**Nachtrag 2026-08-16 (aus dem Folgeauftrag, siehe oben):** Schritt 1 und 2
**sind erledigt** — sie geschahen nach dem Commit `1486501` und blieben hier
zunächst unvermerkt. Beleg: Worker-Version `fd9218f9`, ausgerollt am
2026-08-16 um 15:47 UTC; `ebay_read_syncs` trägt `MESSAGES` = `OK` und
`BEST_OFFERS` = `OK` (Lauf um 17:09 UTC, 248 Nachrichten, davon 5 ungelesen,
0 offene Preisvorschläge), `TRAFFIC` = `SCOPE_NOT_GRANTED` mit
`invalid_scope` — also genau der vorhergesagte Zustand. Schritt 3 ist
angefangen: die Rechteliste steht seit diesem Auftrag in `wrangler.toml`; die
Zustimmung und der neue Refresh-Token bleiben beim Kontoinhaber.

**Nachtrag am selben Abend: auch Schritt 3 ist erledigt.** Der Betreiber hat die
Zustimmung erneuert und den Token hinterlegt; `TRAFFIC` steht seit 17:51:52 UTC
auf `OK` mit 277 Angeboten. Damit liefern alle drei Datentypen. Einzelheiten im
Eintrag „Die Aufrufzahlen-Sperre aufheben" weiter oben.

Nicht getan und bewusst so: kein Push, kein Deployment, keine Remote-Migration,
keine Änderung an `.env` oder produktiven Tokens, kein Live-Aufruf gegen eBay,
keine Änderung an Pet, Atlas, Animation oder DPI-Positionierung (ein Test hält
deren Merkmale jetzt fest).


### 2026-08-16 - Phase 7 des Desktop-Assistenten: Desktop-Stabilität

- Status: ABGESCHLOSSEN.
- Ziel: Die drei Punkte, die Phase 6 ausdrücklich offen gelassen hat. Kein
  neuer Funktionsumfang, keine Schreiboperation, keine Änderung an der
  Sicherheitsgrenze des Orchestrators.
- Ausgangslage: Dieser Arbeitszweig stand — wie schon der Phase-6-Zweig — auf
  `75c3762` (= `main`) und damit vor der gesamten Phase-5-Arbeit. Erster
  Schritt war deshalb ein reiner Fast-Forward auf den Phase-6-Stand `108add3`;
  ohne ihn wäre gegen Code gearbeitet worden, den es in dieser Form nicht mehr
  gibt. Der Zweig hatte keine eigenen Commits, es ging also nichts verloren.
  Die Worktrees von Phase 5b und Phase 6 bleiben unberührt.

**1. Per-Monitor-DPI-Wechsel**

Der von Phase 6 benannte Rest des Mehrschirmthemas. `ToPhysicalPixels` rechnet
mit der Skalierung des Bildschirms, auf dem das *Launcher*-Fenster gerade
liegt; `PositionBesidePet` schiebt es danach auf den Bildschirm des *Pets*.
Sind das zwei Monitore mit verschiedener Skalierung, entsteht die Größe mit
dem falschen Faktor, und `WM_DPICHANGED` kommt erst hinterher. Zu prüfen sind
beide Richtungen: verschobenes Pet und verschobener Launcher.

Verwendet werden dürfen nur tatsächlich ermittelbare DPI-Werte (also am
Zielmonitor bzw. am Fenster abgefragte), keine geratenen und kein veralteter
Faktor.

**Am Prüfgerät hängt genau ein Monitor.** Ein echter Zweischirmtest ist damit
unmöglich und wird auch nicht behauptet. Stattdessen: Codeprüfung,
Invariantenprüfung und Simulation der Rechenwege mit eingesetzten DPI-Werten;
die Grenze wird dokumentiert.

**2. Fehlernachrichten absichern**

Der `HttpRequestException`-Pfad trägt laut Phase 6 weiterhin die
Framework-Meldung im Anhang. Framework-Text, Stacktraces und interne
technische Details dürfen nicht in der Oberfläche landen; stattdessen kurze,
verständliche deutsche Sätze. Regressionstests dazu.

**3. Pet-Größe**

Größe und Atlas werden **nicht** geändert — es gibt kein höher aufgelöstes
Ausgangsmaterial. Keine Interpolation, keine Änderung an `NativePetOverlay`
ohne ausdrücklichen Folgeauftrag. Dokumentiert werden die Anforderungen an
neues 2×-Material und die späteren Optionen.

**4. Modell-Planer**

Bleibt aus. Kein `OPENAI_API_KEY`, kein externer Aufruf, keine Änderung an
`lib/assistant`.

- Rahmen: keine Produktionsänderung, kein Deployment, kein Push zu `origin`,
  keine Remote-Migration, keine eBay-Schreiboperation, keine Änderung an
  Secrets, fremde Worktrees unangetastet.
- Verifikation: `npm test`, `npx tsc --noEmit`, `npm run lint`,
  WinUI-x64-Debug-Build, `git diff --check`, DPI- und Positionierungsprüfungen,
  Offline-, Timeout- und HTTP-Fehlerpfade, Sichtprüfung des transparenten Pets.

**Prüfaufbau**

Zwei Wegwerf-Prüfprogramme unter dem ignorierten `work/`, beide gegen die
*echten* Quelldateien: eines bindet `DesktopErrorMessages.cs` als Quelldatei
ein und fährt den Fehlerpfad gegen echte Sockets auf `127.0.0.1`; eines liest
die Konstanten aus `MainWindow.xaml.cs`, ruft die Win32-DPI-Wege auf diesem
Gerät wirklich auf und spielt die Zweischirmfälle als Rechnung durch. Keine
Produktions-URL, kein externer Anbieter.

**Ergebnis 1: Per-Monitor-DPI — Ursache behoben, Zweischirmfall NICHT geprüft**

- **Am Prüfgerät hängt genau ein Monitor** (`SM_CMONITORS` = 1, 2160×1440,
  Arbeitsbereich bis 1368, `MDT_EFFECTIVE_DPI` = 144 → 150 %). **Ein echter
  Mehrmonitortest hat nicht stattgefunden** und wird nicht behauptet.
- Befund: `ToPhysicalPixels` rechnete mit der Skalierung des Bildschirms, auf
  dem das Launcherfenster *herkam*; `PositionBesidePet` schob es danach auf den
  Bildschirm des Pets. `WM_DPICHANGED` kommt erst *danach* — die Größe entstand
  also zwangsläufig mit einem veralteten Faktor.
- Behoben durch die Reihenfolge: erst die Lage des Pets auflösen, dann über
  `MonitorFromRect` + `GetDpiForMonitor(MDT_EFFECTIVE_DPI)` die Skalierung des
  *Zielbildschirms* holen, dann rechnen. Jeder Aufruf gibt seinen Faktor jetzt
  ausdrücklich mit; die parameterlose Umrechnung gibt es nicht mehr.
- Ist kein Wert ermittelbar, wird `null` gemeldet und auf die bisherige
  Rechnung zurückgefallen — **kein erfundener Standardfaktor**.
- Zweite Richtung: Wandert der *Launcher* selbst auf einen anders skalierten
  Bildschirm, führt `XamlRoot.Changed` die Größe nach. Die Lage bleibt, wo der
  Nutzer sie hingezogen hat; geklemmt wird gegen den Arbeitsbereich des
  Bildschirms, auf dem das Fenster jetzt liegt. Schranke gegen den zuletzt
  angewandten Faktor, sonst löst das eigene `MoveAndResize` sich selbst aus.
- Gemessen an diesem Gerät: `MonitorFromRect` findet für das Pet-Rechteck
  denselben Bildschirm; für ein Rechteck außerhalb aller Bildschirme liefert
  `MONITOR_DEFAULTTONEAREST` einen Monitor statt `NULL`.
- **Regression ausgeschlossen:** Bei einem Bildschirm ergibt die neue Rechnung
  `(1252,1164)-(1852,1320)` — auf den Pixel die in Phase 6 am laufenden Fenster
  gemessene Lage.
- **Simuliert, nicht gemessen:** 150 %→100 % verfehlt die alte Regel die
  Sollbreite um Faktor 1,5, 100 %→150 % um 0,67; die neue trifft sie in beiden
  Richtungen. 12 000 zufällige Pet-Lagen auf drei simulierten Bildschirmen,
  0 Lagen außerhalb des Arbeitsbereichs.

**Ergebnis 2: Fehlernachrichten — gemessen, zwei Befunde beim Messen entstanden**

Vorher der Text der Ausnahme, nachher ein fester deutscher Satz. Die
Unterscheidung kommt ausschließlich aus `SocketError`/`HttpRequestError`, also
aus Aufzählungswerten — nicht aus dem Meldungstext, der je nach
Windows-Sprache anders lautet:

| Fall | vorher | nachher |
|---|---|---|
| Verbindung abgelehnt | „Es konnte keine Verbindung hergestellt werden, da der Zielcomputer …(127.0.0.1:50733)" | „… Die Gegenstelle hat die Verbindung abgelehnt. Läuft der Shop unter dieser Adresse und diesem Port?" |
| Unbekannter Name | „Der angegebene Host ist unbekannt. (…:80)" | „… Die Adresse konnte keinem Rechner zugeordnet werden." |
| TLS scheitert | „The SSL connection could not be established, see inner exception." | „… Die gesicherte Verbindung kam nicht zustande." |
| Kein HTTP am Port | „An error occurred while sending the request." | „Die Verbindung zum Shop wurde unterwegs getrennt." |
| Körper reißt ab | „Unable to read data from the transport connection: …" | „Die Verbindung zum Shop ist abgebrochen, bevor die Antwort vollständig war." |
| Zeitrahmen | „The request was canceled due to the configured HttpClient.Timeout of 30 seconds elapsing." | „Der Shop hat nicht rechtzeitig geantwortet." |
| Fremde Ausnahme | „Object reference not set to an instance of an object." | „Die Anfrage konnte nicht ausgeführt werden." |
| Shop-Fehlertext, 2000 Zeichen | 2000 Zeichen ungebremst | 312 Zeichen, „… (gekürzt)" |
| Fehlertext mit ANSI + CR/LF + DEL | unverändert durchgereicht | Steuerzeichen entfernt, einzeilig |

- **Beim Messen entstanden, nicht beim Entwerfen:** (a) Die TLS-Meldung wurde
  vom Socket verdeckt — im Fehlerbaum steht zusätzlich ein zurückgesetzter
  Socket, und mit der Socket-Prüfung zuerst meldete die Anzeige „unterwegs
  getrennt". TLS-, Namens-, Proxy- und Anmeldefälle stehen deshalb jetzt davor.
  (b) Ein nach `ResponseHeadersRead` abgerissener Körper kommt als nackte
  `IOException` an und lief in den allgemeinen Fall; sie hat jetzt einen eigenen.
- Zusicherung, die das Prüfprogramm für jeden Fall nachweist: **Der angezeigte
  Satz steht wörtlich als Zeichenkette in der eigenen Quelldatei.**
- Der einzige durchgereichte Text ist der eigener `InvalidOperationException`s
  — begrenzt auf 300 Zeichen und auf eine Zeile zusammengezogen. Phase 6 hatte
  diesen Weg im Assistant-Pfad begrenzt, den Kopplungspfad übersehen.
- Der technische Anlass bleibt über `Debug.WriteLine` erhalten, aber nur dort,
  wo ihn der Nutzer nicht sieht.

**Ergebnis 3: Pet-Größe — nachgemessen, bewusst NICHT geändert**

- `NativePetOverlay.cs` ist **unverändert** (der Diff berührt sie nicht). Kein
  Atlas, keine Größe, keine Interpolation.
- Nachgemessen statt übernommen: Beide Atlanten sind 1536×1872
  (`spritesheet.webp` aus dem VP8L-Kopf gelesen) — kein höher aufgelöstes
  Original. In einer Leerlaufkachel 76,1 % ganz transparent, 18,6 % ganz
  deckend, **5,3 % teiltransparent** — diese weiche Kante ist der Grund gegen
  eine 1,5-fache Interpolation.
- Anforderungen an neues 2×-Material stehen mit konkreten Maßen im
  Desktop-README: 3072×3744, Kachel 384×416, 8×9-Raster, echtes **nicht**
  vormultipliziertes Alpha, 2 px transparenter Rand, gleiche Zeilenbelegung.
  Dazu die drei Optionen (nichts tun / beim Zeichnen skalieren / neues
  Material) mit Empfehlung.

**Ergebnis 4: Modell-Planer — unverändert aus**

- Kein `OPENAI_API_KEY`, kein externer Aufruf, keine Änderung an
  `lib/assistant` (der Diff berührt zwei C#-Dateien, eine neue C#-Datei, das
  Desktop-README, `package.json` und eine neue Testdatei).

**Prüfläufe**

- `npm test`: **430/430** bestanden (vorher 414; 16 neu in
  `tests/assistant-phase7.test.mjs`, dort auch in `package.json` registriert —
  die Testliste ist eine Aufzählung, kein Glob).
- `npx tsc --noEmit`: fehlerfrei. `npm run lint`: 0 Fehler, weiterhin nur die
  bekannte Hook-Warnung in `app/account/page.tsx`.
- WinUI x64 Debug: 0 Warnungen, 0 Fehler. `git diff --check`: sauber.
- **Mutationsprobe:** Wird der Zielmonitor-Faktor wieder durch
  `RasterizationScale()` ersetzt und `ex.Message` in die Statuszeile
  zurückgeschrieben, schlagen genau die drei zuständigen neuen Tests fehl
  (13/16). Danach wiederhergestellt und wieder 16/16.
- Keine Produktionsänderung, kein Deployment, kein Push, keine
  Remote-Migration, keine Secrets angefasst, keine eBay-Schreiboperation,
  Orchestrator-Grenze unverändert, fremde Worktrees unberührt.

**Nicht geprüft**

- **Das laufende Fenster.** Smart App Control ist auf diesem Gerät scharf
  geschaltet (`VerifiedAndReputablePolicyState = 1`) und hat die frisch
  gebaute `BrandyCards.Desktop.exe` am Start gehindert („Eine
  Anwendungssteuerungsrichtlinie hat diese Datei blockiert"). Der Build ist
  sauber, aber **Sichtprüfung des transparenten Pets, Fensterlagen am lebenden
  Objekt und die Fehlerpfade im Panel konnten diesmal nicht wiederholt
  werden.** Phase 5b und 6 hatten sie am laufenden Fenster bestätigt. Eine
  Sicherheitseinstellung des Systems dafür zu ändern, kam nicht in Frage.
- **Mehrschirmbetrieb weiterhin nicht real geprüft** — nur ein Monitor am
  Gerät. Die Rechnung nimmt jetzt die Skalierung des Zielbildschirms, aber
  **niemand hat sie auf zwei Schirmen gesehen.**
- Das Verhalten von `XamlRoot.Changed` beim echten Übergang zwischen zwei
  verschieden skalierten Bildschirmen ist aus demselben Grund ungeprüft.
- Die **Pet-Größe** bleibt bei 173×200 effektiv bei 150 %.
- In diesem Worktree fehlt weiterhin `.env.local`. Für die Prüfung ohne
  Belang, für ein Deployment aus diesem Verzeichnis wäre es die bekannte Falle.

### 2026-08-16 - Phase 6 des Desktop-Assistenten: verbleibende Produktionsrisiken

- Status: ABGESCHLOSSEN.
- Ziel: Die drei aus Phase 5 und 5b ausdrücklich offen gebliebenen Risiken
  prüfen und nur dort beheben, wo es nachweisbar sicher ist. Kein neuer
  Funktionsumfang, keine Schreiboperation, keine Änderung an der
  Sicherheitsgrenze des Orchestrators.
- Ausgangslage: Dieser Arbeitszweig stand auf `75c3762` (= `main`) und damit
  vor der gesamten Phase-5-Arbeit. Erster Schritt war deshalb ein reiner
  Fast-Forward auf den Phase-5b-Stand `d81cc1d`; ohne ihn wäre gegen Code
  gearbeitet worden, den es in dieser Form nicht mehr gibt. Danach dieser
  Eintrag. Der Phase-5b-Worktree bleibt unberührt.

**1. Mehrmonitorbetrieb**

Am Prüfgerät hängt weiterhin genau ein Monitor (`SM_CMONITORS` = 1,
2160×1440, 144 dpi). Ein echter Mehrschirmtest ist damit unmöglich und wird
auch nicht behauptet. Geprüft wird stattdessen die Positionierungslogik
selbst: Das Pet ist über `WM_NCHITTEST` → `HTCAPTION` frei verschiebbar,
`MainWindow.PositionBesidePet` rechnet aber fest gegen
`DisplayArea.Primary.WorkArea`. Ob der Launcher dem Pet folgen kann, statt
auf den Primärmonitor zurückzuspringen, wird untersucht; ein Eingriff nur,
wenn er Transparenz, Animation und Pet-Größe nachweislich nicht berührt.

**2. Serverfehlerpfad**

HTTP 4xx, HTTP 5xx, Zeitüberschreitung, Offline und ungültiges JSON gegen
einen lokalen Wegwerf-Testserver auf `127.0.0.1`. Keine Produktions-URL.
Erwartung: verständliche deutsche und *längenbegrenzte* Meldungen.

**3. Pet-Größe bei 150 % DPI**

Zuerst Analyse, ob 173×200 effektive Pixel sinnvoll sind. Atlas,
`NativePetOverlay` und Skalierung werden ohne belastbare technische Prüfung
nicht angefasst; gefährdet eine Änderung Transparenz, Animation oder
Positionierung, werden die Optionen dokumentiert statt nebenbei umgesetzt.

**4. Modell-Planer**

Bleibt aus. Kein `OPENAI_API_KEY`, kein externer Aufruf. Die deterministische
Tool- und Antwortlogik bleibt unverändert.

- Rahmen: keine Produktionsänderung, kein Deployment, kein Push zu `origin`,
  keine Remote-Migration, keine Änderung an eBay-Tokens oder
  Cloudflare-Secrets, keine Schreiboperation des Assistants, fremde Worktrees
  unangetastet.
- Verifikation: `npm test`, `npx tsc --noEmit`, `npm run lint`,
  WinUI-x64-Debug-Build, `git diff --check`, Sichtprüfung bei 150 % DPI,
  Text-, Sprach-, Offline-, Timeout- und HTTP-Fehlerpfade am laufenden
  Fenster.

**Prüfaufbau**

Wegwerf-Testserver auf `127.0.0.1:8791` (nur Loopback), der je Anfrage einen
Fehlerfall aus einer Modusdatei liest — so lässt sich der Fall zwischen zwei
Klicks im laufenden Fenster umschalten. Dazu ein Prüfprogramm, das die
**echte** `AssistantConversationService.cs` als Quelldatei einbindet und alle
Fälle nacheinander durchspielt. Keine Produktions-URL, kein `npm run dev`
nötig.

**Ergebnis 1: Serverfehlerpfad — drei Befunde, alle behoben**

Gemessen *vorher* (Ist-Zustand aus Phase 5b), dann behoben, dann erneut
gemessen. Alle Fälle laufen jetzt in eine deutsche, begrenzte Meldung:

| Fall | vorher | nachher |
|---|---|---|
| 200 + HTML-Körper | `'<' is an invalid start of a value. Path: $ …` | „… keine lesbare Antwort geschickt (kein gültiges JSON)" |
| 200 + abgeschnittenes JSON | `Expected end of string, but instead reached end of data …` | dieselbe deutsche Meldung |
| `{"answer": 42}` | `…could not be converted to …+AssistantReply` (interner Typname!) | „Der Assistant hat keine lesbare Textantwort geliefert." |
| 500 mit 200 000 Zeichen | 200 000 Zeichen im `TextBlock` | „Der Shop hat mehr als 64 KiB geschickt …" |
| 200 mit 2 000 000 Zeichen | 2 000 000 Zeichen im `TextBlock` | dieselbe Meldung |
| Abbruch mitten im Körper | `An error occurred while sending the request.` | „Die Verbindung zum Shop ist abgebrochen …" |
| ANSI-Steuerzeichen | unverändert durchgereicht | entfernt, Zeilenumbrüche bleiben |
| 400/403/404/413/429/500/503 mit JSON | Text ohne Statuscode | Text + `(HTTP nnn)`, auf 500 Zeichen begrenzt |
| 502 als HTML | „… nicht erreichbar (HTTP 502)." | unverändert (war schon richtig) |
| 401 | eigene Kopplungsmeldung | unverändert |

- **Ursache der fehlenden Grenze:** `ReadFromJsonAsync` liest ohne Obergrenze,
  *und* `SendAsync` puffert in der Voreinstellung den ganzen Körper, bevor es
  zurückkehrt. Deshalb kam `HttpCompletionOption.ResponseHeadersRead` dazu —
  ohne das hätte eine Grenze nur die Anzeige begrenzt, nicht den Speicher.
- **Zwei getrennte Grenzen:** Antwort 20 000 Zeichen (der Orchestrator darf aus
  sechs Werkzeugen à zwanzig Einträgen legitim mehrere Kilobyte erzeugen — eine
  engere Grenze hätte gültige Auskünfte abgeschnitten), Fehlertext 500
  Zeichen, Körper 64 KiB.
- **Mehrzeilige Antworten bleiben unversehrt** — nachgemessen mit einer
  dreizeiligen Bestellliste samt Umlauten und `€`: 213 Zeichen, unverändert.
- **Statuszeile:** meldete auch bei HTTP 503 „Antwort empfangen". `AskAsync`
  gibt jetzt `AssistantAnswer(bool Succeeded, string Text)` zurück; bei einer
  Absage steht „Shop meldet einen Fehler".

**Ergebnis 2: Mehrmonitor — Ursache behoben, Zweischirmfall NICHT geprüft**

- **Am Prüfgerät hängt ein Monitor** (`SM_CMONITORS` = 1, 2160×1440, 144 dpi).
  **Ein echter Mehrmonitortest hat nicht stattgefunden.** Was unten steht, ist
  auf einem Schirm gemessen; die Mehrschirmtauglichkeit folgt konstruktiv und
  ist **ungeprüft**.
- Befund, der dabei auffiel und *auf einem* Schirm reproduzierbar ist: Das Pet
  ist verschiebbar (`WM_NCHITTEST` → `HTCAPTION`), aber
  `MainWindow.PositionBesidePet` rechnete fest gegen
  `DisplayArea.Primary.WorkArea` und die Startränder. Ein gezogenes Pet ließ
  den Launcher stehen, wo das Pet nur beim Start stand.
- Behoben: `NativePetOverlay.CurrentPlacement()` meldet über `GetWindowRect`
  die tatsächliche Lage und über `MonitorFromWindow`/`GetMonitorInfo` den
  Arbeitsbereich des Bildschirms, auf dem das Pet liegt. Read-only; Größe,
  Zeichenweg, Alpha-Pfad und die Position des Pets selbst sind unberührt.
- Gemessen bei 150 % (Beobachter mit `PER_MONITOR_AWARE_V2`):
  - Ohne Bewegung: Pet (1868,1020)–(2128,1320), Launcher (1252,1164)–(1852,1320)
    — **auf den Pixel identisch mit Phase 5b**, also keine Regression.
  - Pet nach (120,200): Launcher folgt auf (396,0)–(1176,1020) — rechts
    daneben, weil links kein Platz ist, und in den Arbeitsbereich geklemmt.
  - Pet nach (1400,900): Launcher auf (604,180)–(1384,1200) — links daneben,
    16 px Abstand, Unterkanten bündig bei 1200.
- Reihenfolgefalle: `EnterPetMode` stellte den Launcher daneben, *bevor*
  `Show()` das Pet platzierte — vor `Show()` liegt das Fenster bei 0/0.
  Doppelt abgesichert: Aufrufe getauscht **und** `CurrentPlacement()` meldet
  vor `Show()` `null` (dann gilt weiter die alte Primärschirm-Rechnung).

**Ergebnis 3: Pet-Größe bei 150 % — analysiert, bewusst NICHT geändert**

- Befund: Das Pet wird in physischen Pixeln gezeichnet (260×300 fest,
  `DrawImageUnscaled`), der Launcher rechnet über `ToPhysicalPixels`. Das Pet
  schrumpft daher relativ zu allem anderen: **260×300 effektiv bei 100 %,
  173×200 bei 150 %, 130×150 bei 200 %.** Inkonsistent — sinnvoll nicht.
- **Es gibt kein höher aufgelöstes Ausgangsmaterial.** Nachgesehen: Atlas
  1536×1872 = 8×9 Kacheln à 192×208; `avatar/brandycards-avatar/spritesheet.webp`
  hat exakt dieselben Maße. Eine Vergrößerung wäre eine 1,5-fache
  Interpolation von Material mit bereits weichen Kanten (Stichprobe: ~5 % der
  Pixel teiltransparent).
- Optionen, bewusst offen gelassen:
  1. **Nichts tun.** Das Pet bleibt bei hoher Skalierung kleiner als gedacht.
  2. **Beim Zeichnen skalieren** (`DrawImage` mit Zielrechteck). Berührt den
     Alpha-Pfad (vormultipliziertes PArgb → `UpdateLayeredWindow`), alle 6–8
     Kacheln je Animationszeile und die Ränder, weil `WindowWidth`/
     `WindowHeight` zugleich Bezugsgrößen sind und als `PetWidth`/`PetHeight`
     ein zweites Mal in `MainWindow` liegen. Qualitätsverlust bei Faktor 1,5.
  3. **Neues Bildmaterial in 2×** und Auswahl nach DPI. Sauberste Lösung,
     braucht aber Grafikarbeit, die nicht Teil dieses Auftrags war.
- Empfehlung: 3, sobald jemand das Material erzeugen kann. Nicht 2.

**Ergebnis 4: Modell-Planer — unverändert aus**

- Kein `OPENAI_API_KEY` gesetzt (Prozessumgebung geprüft), kein externer
  Aufruf, **keine Änderung an `lib/assistant`** (der Diff berührt nur vier
  C#-Dateien, `package.json` und Tests).
- Während der gesamten Prüfung hatte der Desktop genau eine bestehende
  Verbindung: `127.0.0.1:8791`.

**Am laufenden Fenster geprüft (150 % DPI, ohne Produktionskontakt)**

Die produktive `settings.json` wurde vorher gesichert, während der Prüfung auf
den lokalen Testserver gezeigt und danach **byte-gleich** wiederhergestellt
(SHA256 `7111F321…56FD` vorher = nachher, 221 Bytes). Kein Aufruf ging an
`shop.brandycards.de`.

- Pet transparent, `WS_EX_LAYERED` + `WS_EX_TOOLWINDOW` + `WS_EX_NOACTIVATE`
  gesetzt, `GetLayeredWindowAttributes` liefert `false` — also weiterhin
  per-Pixel-Alpha über `UpdateLayeredWindow`, nicht per-Fenster-Alpha.
  Bildschirmaufnahme abgelegt.
- Animation läuft: 5 verschiedene Bildsignaturen über 6 Stichproben à 200 ms,
  die sechste wieder gleich der ersten — die 6-Bild-Leerlaufschleife.
- Keine Taskleistenüberlappung: Pet-Unterkante 1320, Arbeitsbereich bis 1368.
- **Timeout:** hängender Server → nach 30 s „Der Shop hat innerhalb von 30
  Sekunden nicht geantwortet …", Status „Zeitüberschreitung", Bedienelemente
  danach wieder frei.
- **Offline:** gestoppter Server → „Der Shop ist gerade nicht erreichbar: …
  Verbindung verweigerte. (127.0.0.1:8791)", Status „Shop nicht erreichbar".
- **HTTP-Fehler und kaputtes JSON** je einzeln im Panel bestätigt (500, 503,
  200+HTML, 200+abgeschnitten, Übergröße).
- **Sprache:** echte lokale Diktatsitzung ohne gesprochenen Inhalt, 13,4 s,
  endete mit „Es wurde kein Diktat erkannt …"; währenddessen waren Eingabe,
  Mikrofon und Senden gesperrt, danach alle drei wieder frei.

**Nicht geprüft / bewusst nicht geändert**

- **Mehrschirmbetrieb weiterhin nicht real geprüft** — nur ein Monitor am
  Gerät. Die Rechnung ist jetzt monitorbezogen statt primärschirmbezogen, aber
  **niemand hat sie auf zwei Schirmen gesehen.**
- **DPI-Wechsel zwischen Monitoren** ist der Rest des Mehrschirmthemas und
  wurde **nicht** angefasst: `ToPhysicalPixels` rechnet mit der Skalierung des
  Bildschirms, auf dem das Launcherfenster gerade liegt. Zieht man das Pet auf
  einen Schirm mit anderer Skalierung, wird die Fenstergröße mit dem alten
  Faktor berechnet und `WM_DPICHANGED` kommt erst danach. Das blind zu ändern,
  ohne es je gesehen zu haben, wäre geraten gewesen.
- Die **Pet-Größe** bleibt bei 173×200 effektiv (Optionen oben).
- Der **Modell-Planer** wurde erneut nicht live aufgerufen.
- `HttpRequestException` aus `SendAsync` trägt weiterhin die Framework-Meldung
  im Anhang („Es konnte keine Verbindung hergestellt werden …"). Sie ist
  deutsch lokalisiert und nennt Adresse und Port, also brauchbar; ersetzt
  wurde sie nicht.

**Prüfläufe**

- `npm test`: **414/414** bestanden (vorher 404; 10 neu in
  `tests/assistant-phase6.test.mjs`, das dort auch in `package.json`
  registriert wurde — die Testliste ist eine Aufzählung, kein Glob).
- `npx tsc --noEmit`: fehlerfrei. `npm run lint`: 0 Fehler, weiterhin nur die
  bekannte Hook-Warnung in `app/account/page.tsx`.
- WinUI x64 Debug: 0 Warnungen, 0 Fehler. `git diff --check`: sauber.
- Keine Produktionsänderung, kein Deployment, kein Push, keine
  Remote-Migration, keine Secrets angefasst, keine Schreiboperation im
  Assistant, Orchestrator-Grenze unverändert, fremde Worktrees unberührt.
- Anmerkung: In diesem Worktree fehlt weiterhin `.env.local`. Für die Prüfung
  ohne Belang, für ein Deployment aus diesem Verzeichnis wäre es die bekannte
  Falle.


### 2026-08-16 - Phase 5b des Desktop-Assistenten: Produktionsvorbereitung

- Status: ABGESCHLOSSEN.
- Ziel: Die beiden in Phase 5 ausdrücklich offen gelassenen Befunde schließen,
  soweit sie einer produktiven Kopplung im Weg stehen. Kein neuer Funktions-
  umfang, keine Schreiboperation, keine Änderung an der Sicherheitsgrenze des
  Orchestrators.
- Ausgangslage: Die Phase-5-Arbeit lag auf `claude/brandycards-phase-5-testing-13ad58`
  (`23e88b7`), dieser Arbeitszweig stand noch auf `75c3762`. Erster Schritt war
  deshalb ein reiner Fast-Forward auf den Phase-5-Stand; ohne ihn wäre gegen
  Code gearbeitet worden, den es nicht mehr gibt. Danach dieser Eintrag.

**1. Timeout-Widerspruch Client/Server**

`MainPage` setzt `_httpClient.Timeout` auf 12 s, der Modellpfad in
`lib/assistant/planner.ts` darf 15 s laufen. Sobald `OPENAI_API_KEY`
serverseitig gesetzt wird, bricht der Desktop ab, bevor der Server antworten
kann — der Nutzer sähe einen Fehler, obwohl die Anfrage noch läuft. Geplant:
ein eigener, dokumentierter Zeitrahmen für die Assistant-Anfrage, der über dem
maximalen Serverpfad plus Netzpuffer liegt (30 s), während Abruf und Kopplung
bei ihren kurzen 12 s bleiben — ein Poll alle drei Sekunden darf nicht eine
halbe Minute hängen. Die Grenze bleibt endlich. Dazu ein Test, der beide Werte
aus den echten Quelldateien liest und die Ordnung erzwingt.

**2. Mehrmonitor, DPI und Taskleiste**

Phase 5 hat gemessen, dass das Pet an `SM_CYSCREEN` ankert und dadurch in die
Taskleiste ragt; geprüft wird, ob das ohne Eingriff in Transparenz, Animation
und Pet-Größe zu beheben ist. Mehrmonitorbetrieb ist am Prüfgerät weiterhin
nicht real testbar; er wird nur aus dem Code beurteilt und als ungeprüft
ausgewiesen.

- Rahmen: keine Produktionsänderung, keine Remote-Migration, kein Deployment,
  keine Änderung an eBay-Tokens oder Cloudflare-Secrets, kein externer
  OpenAI-Aufruf in Tests.
- Verifikation: `npm test`, `npx tsc --noEmit`, `npm run lint`,
  WinUI-x64-Debug-Build, Sichtprüfung von Pet und Launcher, Timeout- und
  Abbruchverhalten ohne `OPENAI_API_KEY`, `git diff --check`.

**Ergebnis 1: Zeitrahmen**

- `AssistantConversationService.RequestTimeout` = **30 s**, dokumentiert gegen
  `MODEL_TIMEOUT_MS` = 15 s. `_httpClient.Timeout` übernimmt diesen Wert, weil
  `HttpClient.Timeout` clientweit gilt und sich je Aufruf nur verkürzen lässt.
- `MainPage.ShopRequestTimeout` = **12 s**, unverändert für Kopplung und
  Ereignisabruf, jetzt je Aufruf über eine eigene `CancellationTokenSource`.
- Neue eigene Anzeigen: `OperationCanceledException` → „Der Shop hat innerhalb
  von 30 Sekunden nicht geantwortet …" mit Status „Zeitüberschreitung";
  `HttpRequestException` → „Der Shop ist gerade nicht erreichbar: …" mit Status
  „Shop nicht erreichbar". Vorher stand dort die englische Framework-Meldung.
- `tests/assistant-phase5b.test.mjs` liest beide Zahlen aus den echten
  Quelldateien und erzwingt Client ≥ Server + 5 s Netzpuffer, Obergrenze
  ≤ 60 s, kein `InfiniteTimeSpan`, kurze Pfade kürzer als der lange.

**Ergebnis 2: Pet und Taskleiste**

- `NativePetOverlay.Show()` ankert über `SPI_GETWORKAREA` statt
  `SM_CXSCREEN`/`SM_CYSCREEN`. Ränder 32/48 unverändert, Fenstergröße
  unverändert 260×300, Zeichenweg und Alpha-Pfad nicht berührt.
- Gemessen am Prüfgerät (2160×1440, 144 dpi = 150 %, Taskleiste 72 px):
  vorher Pet-Unterkante 1392 bei Arbeitsbereichsrand 1368 — **24 px
  Überlappung**; nachher 1320 — **0 px**. Beides mit einem Wegwerf-Programm
  gemessen, das genau diese Datei einbindet, gegen die alte und die neue
  Fassung.
- Am laufenden Fenster: Pet (1868,1020)–(2128,1320), Launcher
  (1252,1164)–(1852,1320) — gleiche Unterkante, 16 px Abstand. Vorher standen
  beide 24 px versetzt, weil `MainWindow.PositionBesidePet` längst gegen
  `DisplayArea.Primary.WorkArea` rechnete.

**Am laufenden Fenster geprüft (150 % DPI, ohne Produktionskontakt)**

Die produktive `settings.json` wurde vorher gesichert, während der Prüfung auf
einen toten bzw. hängenden lokalen Port gezeigt und danach **byte-gleich**
wiederhergestellt (SHA256 vorher = nachher). Kein Aufruf ging an
`shop.brandycards.de`.

- Setup-Fenster beim Start: 780×1140 physisch = **520×760 effektiv**. Der
  Phase-5-DPI-Fix greift also auch im Konstruktorpfad.
- Launcher eingeklappt 600×156 physisch = 400×104 effektiv; Panel geöffnet
  780×1020 physisch = 520×680 effektiv.
- Pet transparent, Animation läuft, `WS_EX_LAYERED` gesetzt, keine
  Taskleistenüberlappung — per Bildschirmaufnahme belegt.
- **Timeout:** Gegen einen TCP-Server, der annimmt und nie antwortet, stand das
  Panel 20 s nach dem Senden noch auf „Assistant liest Daten …" (mit den alten
  12 s wäre es gescheitert) und meldete nach 30 s die Zeitüberschreitung; die
  Bedienelemente wurden danach wieder freigegeben.
- **Offline:** Gegen einen toten Port meldete das Panel „Der Shop ist gerade
  nicht erreichbar: … Verbindung verweigerte. (127.0.0.1:9)".
- Alles ohne gesetzten `OPENAI_API_KEY`; der Pfad ohne Schlüssel funktioniert
  unverändert.

**Messfalle, unbedingt merken**

Ein Prüfskript ohne eigene DPI-Kennzeichnung bekommt von `GetWindowRect`
virtualisierte Koordinaten. Das Pet erschien dadurch als 173×200, der Launcher
als 400×104 und das Setup-Fenster als 520×760 — was fälschlich wie ein
DPI-Fehler aussah. Erst `SetThreadDpiAwarenessContext(PER_MONITOR_AWARE_V2)`
im **Beobachter** liefert echte Werte. Wer hier misst, muss das setzen.

**Nicht geprüft / bewusst nicht geändert**

- **Mehrschirmbetrieb weiterhin nicht real geprüft** — `SM_CMONITORS` meldet 1,
  am Gerät hängt ein Monitor. Aus dem Code unverändert: Pet
  (`SPI_GETWORKAREA` → Primärmonitor) und Launcher (`DisplayArea.Primary`)
  ankern beide fest am Primärmonitor; ein auf einen zweiten Monitor gezogenes
  Launcherfenster springt beim nächsten Öffnen oder Schließen zurück. Das
  bleibt offen.
- Die **Pet-Größe** bleibt bei 150 % effektiv 173×200. Sie zu ändern hieße,
  Pixelgrafik zu skalieren, und berührt Transparenz und Erscheinungsbild —
  eine eigene Entscheidung, nicht Teil dieses Auftrags.
- Der **Serverfehlerpfad** (HTTP-Status vom Shop) wurde nicht live ausgelöst,
  weil dafür ein laufender Shop nötig wäre; er ist unverändert aus Phase 5 und
  im Test über die Quelldatei abgesichert.
- Der Modell-Planer wurde erneut **nicht** live aufgerufen. Kein Test spricht
  mit einem externen Anbieter.
- README unverändert: Weder die Projekt- noch die Desktop-README dokumentiert
  einen Timeout-Wert, es gab also nichts nachzuziehen.

**Prüfläufe**

- `npm test`: **404/404** bestanden (vorher 395; 9 neu in
  `tests/assistant-phase5b.test.mjs`).
- `npx tsc --noEmit`: fehlerfrei. `npm run lint`: 0 Fehler, weiterhin nur die
  bekannte Hook-Warnung in `app/account/page.tsx`.
- WinUI x64 Debug: 0 Warnungen, 0 Fehler. `git diff --check`: sauber.
- Keine Produktionsänderung, keine Remote-Migration, kein Deployment, keine
  Secrets angefasst, keine Schreiboperation im Assistant, Orchestrator-Grenze
  unverändert.

### 2026-08-16 - Phase 5 des Desktop-Assistenten: Prüfung und Abnahme

- Status: ABGESCHLOSSEN.
- Ziel: Die in Phase 1 bis 4 gebaute Kette prüfen, nicht erweitern. Anwendungs-
  code nur bei nachgewiesenem Fehler ändern.

**Zwei konkrete Fehler gefunden und behoben**

1. *Die Kopplung war gegen einen lokalen Dev-Server unmöglich.*
   `ConnectButton_Click` verwendete `PostAsJsonAsync`. `JsonContent` kennt
   seine Länge nicht und sendet chunked; die Worker-Laufzeit antwortet auf
   einen Body ohne Längenangabe mit **411**, sichtbar als „Die Anfrage muss
   ihre Größe angeben." Gefunden beim echten Tastaturlauf, nicht durch
   Codelesen. Behoben mit `StringContent` — genauso, wie es
   `AssistantConversationService` in Phase 4 bereits macht. Danach lief die
   Kopplung durch und erzeugte ein Token mit `["EVENTS","ASSISTANT_READ"]`.
   Produktion war davon nicht betroffen: Cloudflare akzeptiert chunked, die
   vorhandene produktive Kopplung besteht.
2. *Das Setup-Fenster ignorierte die Bildschirmskalierung.*
   `ConfigureSetupWindow` rief `AppWindow.Resize(520, 760)` mit **physischen**
   Pixeln auf, während `ConfigureLauncherWindow` über `ToPhysicalPixels`
   umrechnet. Gemessen bei 144 dpi: 520×760 physisch = **347×507 effektive**
   statt 520×760. `ToPhysicalPixels` konnte dort auch nicht greifen, weil
   `ConfigureSetupWindow` schon im Konstruktor läuft und `XamlRoot` dann noch
   `null` ist — der Faktor wäre auf 1.0 gefallen. Behoben mit einem
   DPI-Rückfall über `GetDpiForWindow`. Nachgemessen: 780×1140 physisch =
   520×760 effektiv, auch auf dem Rückweg nach einem Widerruf.

**Echter HTTP-Durchlauf: 45 von 45 Fällen bestanden**

Gegen `npm run dev` mit lokaler D1 und vier kurzlebigen Testtoken. Der
Rate-Limit-Schlüssel wurde je Fall über `cf-connecting-ip` getrennt.

- Abgewiesen wurden: kein Header, Token ohne `bcav_`-Präfix, erfundenes Token,
  reines `EVENTS`-Token ohne `ASSISTANT_READ`, abgelaufenes Token, widerrufenes
  Token. `GET` ohne Token ebenso; `DELETE` ist 405.
- Eingabe: falscher Content-Type 415, kaputtes JSON 400, Zusatzfeld `sql` 400,
  Phase-1-Direktwahl `{tool,limit}` 400, leere Frage 400, über 1000 Zeichen
  400, `message` ohne Text 400, Array-Body 400, über 4 KiB 413, Body ohne
  Längenangabe 411, unsinnige `content-length` 400.
- Antworten: beide nicht verfügbaren eBay-Quellen einzeln mit Grund; leere
  Bestellungen, leere Preisvorschläge, fehlender Sync-Lauf und fehlender
  Verkauf jeweils ausdrücklich als leer statt erfunden; Statistik mit
  gezählten Werten; zusammengesetzte Frage nutzt zwei Werkzeuge genau einmal;
  unbekannte Formulierung endet als `UNSUPPORTED` mit dem Hinweis auf den
  nicht konfigurierten Modell-Planer, ohne Werkzeug und ohne Quelle.
- Vier Prompt-Injektionen (Löschbefehl, Rollenwechsel, Kundendaten,
  Geheimnisse) lieferten weder Token noch Schlüssel noch E-Mail-Adressen.
- Rate-Limit: greift nach zehn Anfragen je Minute mit `retry-after: 60`, auch
  bei durchgehend ungültigem Token — also vor dem D1-Lookup.
- Keine Antwort enthielt SQL-, Drizzle- oder Stacktrace-Details.
- **Read-only belegt:** Zeilenzahlen vor und nach dem Lauf identisch
  (5 Produkte, 0 Bestellungen, 0 Preisvorschläge, 0 Ereignisse, 0 Outbox).

**Bedienung, DPI und Sprache am laufenden Fenster geprüft**

- Tastatur ohne Maus vollständig: Kopplung über Tab → Tab → Enter, Launcher
  mit Enter geöffnet, Frage getippt, über Mikrofon zum Senden getabbt, mit
  Enter gesendet, mit Escape geschlossen. Der Fokus sprang beim Öffnen ins
  Eingabefeld und beim Schließen zurück auf den Launcher.
- Screenreader-Baum: alle sechs Bedienelemente benannt und fokussierbar, die
  Unterhaltung als benannter Bereich, jede Nachricht als eigenes benanntes
  Element inklusive der vollständigen Antwort, zwei höfliche Live-Regionen.
- DPI bei 144 dpi gemessen: Launcher 600×156 physisch = 400×104 effektiv,
  geöffnetes Panel 780×1020 physisch = 520×680 effektiv, Abstand zum Pet
  exakt 16 Pixel.
- Text: Die Frage nach nicht verfügbaren eBay-Daten lief über die echte
  localhost-API und lieferte beide `UNAVAILABLE`-Begründungen mit Quelle.
- Sprache: echte lokale Diktatsitzung ohne gesprochenen Inhalt endete mit
  „Es wurde kein Diktat erkannt …"; währenddessen waren Eingabefeld,
  Mikrofon und Senden gesperrt und danach wieder frei.
- Fehlerfall: Bei gestopptem Shop meldete das Panel „Die Anfrage konnte nicht
  ausgeführt werden … Verbindung verweigert" und den Status „Anfrage
  fehlgeschlagen"; die Bedienelemente wurden wieder freigegeben.
- Widerruf: Nach `revoked_at` in der lokalen D1 fiel die App binnen weniger
  Sekunden in die Setup-Ansicht mit „Die Desktop-Kopplung ist nicht mehr
  gültig." zurück und blendete das Pet aus.

**Beobachtungen, die bewusst nicht geändert wurden**

- Das Pet wird in physischen Pixeln gezeichnet und ist bei 150 % nur 173×200
  effektive Pixel groß. Es ankert außerdem an `SM_CYSCREEN` statt am
  Arbeitsbereich und ragt dadurch 24 Pixel in die Taskleiste. Das transparente
  Pet und `NativePetOverlay.cs` standen unter Änderungsverbot.
- **Mehrschirmbetrieb konnte nicht real geprüft werden — am Prüfgerät hängt
  nur ein Monitor.** Aus dem Code: Launcher (`DisplayArea.Primary`) und Pet
  (`GetSystemMetrics`) ankern beide fest am Primärmonitor. Ein vom Nutzer auf
  einen zweiten Monitor gezogenes Launcherfenster springt beim nächsten
  Öffnen oder Schließen des Panels dorthin zurück. Das ist konsistent mit dem
  Pet, ließe sich aber nur zusammen mit der Pet-Positionierung ändern.
- Der HTTP-Timeout des Clients liegt bei 12 s, der Modell-Timeout des Servers
  bei 15 s. Sobald `OPENAI_API_KEY` gesetzt wird, bricht der Desktop vor dem
  Server ab. Nicht geändert, weil der Modellpfad ohne Schlüssel unerreichbar
  ist; vor dem Setzen des Schlüssels muss einer der beiden Werte angepasst
  werden.
- „Verbindung ändern" bleibt während Diktat und laufender Abfrage bedienbar.
- Die Antwort selbst wird nicht als Live-Region angesagt, nur der Kurzstatus
  „Antwort empfangen". Der Text ist im Baum vorhanden und lesbar.
- Der vinext-Dev-Server lauscht ausschließlich auf `::1`. `HttpClient` löst
  `localhost` bevorzugt nach IPv4 auf, deshalb braucht der lokale Testlauf die
  Adresse `http://[::1]:3000`. Kein Anwendungsfehler.

**Nicht geprüft**

- Der Modell-Planer wurde nicht live aufgerufen; es gibt keinen Schlüssel und
  es wurde bewusst keine Frage an einen externen Anbieter gesendet. Sein
  Fehler- und Timeout-Verhalten ist offline mit einem Fetch-Doppel abgedeckt.
- Der Windows-Datenschutzschalter für Mikrofone wurde nicht verändert.
- High Contrast wurde nur anhand der Theme-Dictionaries beurteilt, die
  Systemeinstellung blieb unangetastet.

**Prüfläufe und Aufräumen**

- `npm test`: 395/395 bestanden (vorher 383, davon 12 neu in
  `tests/assistant-phase5.test.mjs`). `npx tsc --noEmit` fehlerfrei.
  `npm run lint`: 0 Fehler, nur die bekannte Hook-Warnung in
  `app/account/page.tsx`. WinUI-x64-Debug-Build: 0 Warnungen, 0 Fehler.
- Die Migrationen `0003`–`0011` wurden **ausschließlich lokal** angewendet;
  die lokale D1 dieses Worktrees hing noch auf Stand `0002`.
- Alle Testtoken, das Test-Pairing und der lokale Testbenutzer wurden entfernt
  (jeweils 0 Zeilen übrig). Die produktive Desktop-Einstellung wurde
  byte-gleich zur Sicherung wiederhergestellt; der Dev-Server ist gestoppt.
- Keine Produktionsdaten, keine Remote-Migration, kein Deployment, keine
  eBay-Schreiboperation. `NativePetOverlay.cs` hat keinen Diff.
- Anmerkung: In diesem Worktree fehlt `.env.local`. Für die Prüfung ohne
  Belang, für ein Deployment aus diesem Verzeichnis wäre es die bekannte
  Falle.

### 2026-08-16 - Phase 4 des Desktop-Assistenten: zentraler Read-only-Orchestrator

- Status: ABGESCHLOSSEN.
- Architektur: Die Geräte-Assistant-API akzeptiert jetzt ausschließlich eine
  auf 1.000 Zeichen begrenzte `{ message }`-Frage. Ein zentraler
  `AssistantOrchestrator` plant maximal sechs eindeutige Aufrufe und führt sie
  ausschließlich über die bestehende typisierte Read-only-Registry aus. Es
  wurden keine autonomen Subagents eingeführt.
- Freie Fragen: Bekannte und zusammengesetzte deutsche Fragen werden durch
  einen geschlossenen serverseitigen Planer ohne Fremdaufruf erkannt. Für
  weitere Formulierungen kann ein serverseitiger OpenAI-Responses-Planer mit
  `OPENAI_API_KEY` und strikten Function-Schemas genutzt werden; Name und
  Argumente werden danach nochmals gegen die vorhandenen Verträge validiert.
  Das lokale Testsystem hatte keinen Modellschlüssel, daher wurde dieser
  Providerpfad mit einem vollständig kontrollierten Fetch-Doppel getestet.
- Faktentreue: Das Modell erzeugt weder Antworttext noch SQL. Die finale kurze
  deutsche Antwort entsteht deterministisch aus den typisierten Tool-DTOs und
  nennt Quelle und Datenstand. Leere Resultate, `UNAVAILABLE`, Einzel- und
  Gesamtfehler sowie mehrere Quellen werden getrennt dargestellt; fehlende
  Mengen, Preise oder Zeiten werden nicht durch Ersatzwerte erfunden.
- Desktop: `AssistantConversationService` enthält kein lokales Routing und
  keine Datenformatierung mehr, sondern sendet nur `{ message }` und zeigt
  `answer` an. Der JSON-Body wird mit berechenbarer Länge gesendet. Text- und
  lokale Spracheingabe enden unverändert in derselben
  `SendAssistantMessageAsync`-Methode. Audio bleibt lokal; nur das erkannte
  Transkript wird wie eine Texteingabe an den Server gegeben.
- Prüfung: Produktions-Build plus vollständige Suite 383/383 bestanden;
  `npx tsc --noEmit` erfolgreich; Lint 0 Fehler und nur die bekannte
  Hook-Warnung in `app/account/page.tsx`; WinUI-x64-Debug-Build 0 Warnungen und
  0 Fehler. Die neue fokussierte Suite umfasst 16 Orchestrator- plus 11
  Registrytests.
- End-to-end lokal: Die vorhandene Migration `0011` wurde ausschließlich auf
  die lokale D1 angewendet. Über ein kurzlebiges lokales Token und einen danach
  entfernten Claim/Event-Proxy erreichte die sichtbare App die echte
  localhost-Assistant-API. Text zeigte zwei explizite nicht verfügbare
  eBay-Quellen und den leeren Bestellpfad; der Sprachlauf erkannte „Welche
  Bestellungen sind Moll“, routete wegen des Schlüsselworts korrekt auf
  `new_orders` und zeigte dieselbe quellengebundene Textantwort. Alle
  Testtoken/-pairings wurden anschließend mit Zähler 0 entfernt und die
  ursprüngliche produktive Desktop-Einstellung exakt restauriert.
- Unverändert/offen: Keine Produktionsdaten, Remote-Migration, eBay-
  Schreiboperation, Nachricht, Angebot, Worker-Konfiguration oder Deployment.
  `NativePetOverlay.cs`, Pet-Positionierung und Atlas haben keinen Diff. Für
  die volle Modell-Erkennung freier, vom lokalen Planer nicht abgedeckter
  Formulierungen muss später serverseitig `OPENAI_API_KEY` gesetzt werden; das
  wurde nicht eigenmächtig vorgenommen. Die final gebaute App läuft sichtbar
  mit Launcher und Pet-Overlay.

### 2026-08-16 - Phase 3 des Desktop-Assistenten: lokale Windows-Spracheingabe

- Status: ABGESCHLOSSEN.
- Ergebnis: Der bestehende WinUI-Launcher besitzt jetzt einen zugänglichen Mikrofon-Button für eine einzelne lokale Windows-Diktatsitzung. Nur der erkannte Text wird danach als normale Nutzernachricht an die bestehende deterministische Freitext-Zuordnung übergeben; die Antwort bleibt ausschließlich Text.
- Lokale Ausführung: `System.Speech` nutzt die installierte Windows Desktop Speech Recognition mit `DictationGrammar` und dem Standardmikrofon im lokalen App-Prozess. Weder Audio noch Transkript werden an einen Sprachdienst übertragen; es gibt keine Sprachausgabe, keine kontinuierliche Speech-to-Speech-Sitzung und keinen freien Orchestrator. Die Assistant-API bleibt unverändert.
- Fehlerbehandlung und Zugänglichkeit: Nicht installierte Sprachfunktion, verweigerter Desktop-Mikrofonzugriff, nicht erreichbares Mikrofon, nicht unterstützte Plattform und leeres Diktat liefern konkrete höfliche Live-Statusmeldungen. Der Button hat Automation-Name und Hilfetext, liegt nach dem Textfeld vor Senden in der Tab-Reihenfolge und wird während Diktat oder Datenabfrage deaktiviert.
- Prüfung: x64-Debug-Build erfolgreich mit 0 Warnungen und 0 Fehlern; fokussierte Assistant-Tests 11/11 sowie vollständiges `npm test` 367/367 bestanden; `npx tsc --noEmit` erfolgreich. Echte unpackaged Sichtprüfung in der interaktiven Windows-Sitzung: Pet und Launcher gleichzeitig sichtbar, Panel bei 150 % DPI 780×1020 physische (= 520×680 effektive) Pixel, UI-Automation bestätigt Mikrofon-Button mit Name, Fokusfähigkeit und Bedienbarkeit. Ein echter lokaler Diktataufruf ohne gesprochenen Inhalt meldete erwartungsgemäß „Es wurde kein Diktat erkannt …“ und reaktivierte den Button. Installierte Engines: Deutsch (Deutschland) und Englisch (Vereinigtes Königreich).
- Einschränkung: Der Test konnte den bewusst nicht veränderten Windows-Datenschutzschalter nicht verweigern; dieser Pfad wird durch die explizite `UnauthorizedAccessException`-Meldung behandelt. Für produktive Nutzung bleibt außerdem die bereits bekannte HTTPS-/DPAPI-/Widerrufshärtung der Geräteverbindung offen.
- Unverändert: `NativePetOverlay.cs`, Pet-Positionierung, Event-Polling, Assistant-API, Produktionsdaten, Remote-Migrationen, eBay-Schreibvorgänge und Deployments.

### 2026-08-16 - Phase 2 des Desktop-Assistenten: zugänglicher WinUI-Launcher

- Status: ABGESCHLOSSEN.
- Ergebnis: Neben dem unveränderten nativen per-pixel-transparenten Pet bleibt jetzt ein separates, fokussierbares WinUI-Launcherfenster sichtbar. Der Launcher öffnet und schließt ein lesbares Textpanel; Pet-Overlay, Atlas-Rendering, Animationen und Event-Polling wurden nicht verändert.
- Kommunikation: Natürlich formulierter Text wird lokal und deterministisch auf die zehn festen read-only Phase-1-Werkzeuge abgebildet. Unbekannte Fragen zeigen lokal Beispiele; kein freier Orchestrator, keine Spracheingabe und keine Änderung der Assistant-API.
- Zugänglichkeit: Standard-WinUI-Controls mit Automation-Namen, logischer Tab-Reihenfolge, sichtbaren Fokuszuständen, Live-Status, Fokus im Eingabefeld beim Öffnen und Rückfokus zum Launcher beim Schließen. Light-, Dark- und High-Contrast-Ressourcen sowie DPI-skalierte Fenstermaße sind berücksichtigt.
- Prüfung: x64-Debug-Build erfolgreich mit 0 Warnungen und 0 Fehlern; fokussierte Assistant-Tests 11/11 bestanden. Echter unpackaged Start erfolgreich, Prozess antwortet. UI-Automation bestätigte Launcher und alle fünf Bedienziele, 520×680 effektive Panelgröße bei 150 % DPI, Öffnen per Enter, lokale Nachricht per Tab+Enter, Schließen per Escape und erneutes Öffnen. Finale Sichtprüfung zeigt lesbares Dark-Theme-Panel und unverändertes transparentes Pet gleichzeitig; die verifizierte App bleibt geöffnet.
- Zwischenläufe: Erster Restore innerhalb der Netzwerk-Sandbox wegen blockiertem NuGet-Signaturzugriff fehlgeschlagen und nach Freigabe erfolgreich wiederholt. Spätere Builds waren einmal durch die zur Sichtprüfung laufende App und einmal durch zwei eindeutig identifizierte lokale Reflection-Testprozesse gesperrt; nach gezieltem Beenden der eigenen Prozesse jeweils erfolgreich.
- Unverändert: Keine Produktionsdaten, Remote-Migrationen, eBay-Schreibvorgänge oder Deployments. Die Assistant-API und `NativePetOverlay.cs` haben keinen Diff.
- Später, nicht Teil von Phase 2: Spracheingabe, freier Orchestrator sowie vor produktiver Assistant-Nutzung HTTPS-Zielprüfung, DPAPI-Tokenablage und Widerruf/Rotation.

### 2026-08-16 - Transparenzfehler des Desktop-Pets endgültig behoben

- Status: ABGESCHLOSSEN.
- Ergebnis: Der grüne Hintergrund ist aus dem echten Desktop-Pet entfernt; im finalen DPI-bewussten Desktop-Screenshot ist ausschließlich die Avatarfigur vor dem darunterliegenden Desktop sichtbar.
- Umsetzung: Color-Key- und DWM-Ansatz durch ein natives `WS_EX_LAYERED`-Overlay mit per-pixel Alpha ersetzt. Der Frame wird als transparenter ARGB-DIB über `Bitmap.GetHbitmap()` an `UpdateLayeredWindow` übergeben. Die produktive Geräteverbindung und Eventanimationen bleiben erhalten.
- Prüfung: Finaler Debug-Build mit 0 Warnungen und 0 Fehlern. Der echte Overlay-Ausschnitt wurde mit 19.500 Pixelstichproben geprüft: 0 grüne Hintergrundpixel. Der finale Screenshot wurde aus der interaktiven Windows-Sitzung aufgenommen; es wurden keine Produktionsdaten, Tokens oder Cloudflare-Einstellungen verändert.

### 2026-08-16 - Desktop-Pet statt Avatar-Anwendungsfenster

- Status: ABGESCHLOSSEN.
- Ergebnis: Den Live-Avatar aus dem produktiven Webshop-Admin entfernt; die notwendige Desktop-Verbindung mit Pairing-Code bleibt bestehen. Die ungenutzte React-Komponente und ihre CSS-Regeln wurden entfernt.
- Befund: Die produktive `avatar_events`-Tabelle war leer; deshalb gab es keine Ereignisanimation. Die Desktop-App hatte zusätzlich keine laufende Idle-Uhr.
- Umsetzung: WinUI-Fenster auf transparenten, rahmenlosen Always-on-top-Pet umgestellt, Setup-Ansicht und Pet-Ansicht getrennt, Idle-Animation mit 160-ms-Takt ergänzt und Einstellungsbutton zum erneuten Koppeln erhalten. eBay-, Cloudflare- und Geräte-Secrets werden nicht in den Client übernommen.
- Prüfung: WinUI-Build erfolgreich mit 0 Fehlern und 0 Warnungen; laufender Desktop-Prozess antwortet. `npm test`: 356/356 bestanden; `npx tsc --noEmit`: erfolgreich. Produktions-Worker `brandycards-webshop` auf `shop.brandycards.de` deployed, Version `fee50e21-b368-4069-a381-0ffb967b28de`; Admin-Seite danach geprüft: kein `LIVE-AVATAR`, `DESKTOP-VERBINDUNG` vorhanden.

### 2026-08-16 - Desktop-Avatar produktiv aktivieren

- Status: ABGESCHLOSSEN.
- Freigabe: Der Nutzer hat die produktive Aktivierung ausdrücklich angefordert.
- Remote-Schema: `users.preferred_locale` und `orders.shipped_at` waren bereits vorhanden; `avatar_events`, `avatar_device_pairings` und `avatar_device_tokens` fehlten.
- Umsetzung: `drizzle/0009_avatar_events.sql` und `drizzle/0010_avatar_device_pairing.sql` erfolgreich auf der produktiven D1 `brandycards-production` angewendet. Anschließend Worker `brandycards-webshop` auf `shop.brandycards.de` deployed, Version `a1a5615a-db4f-42b8-991c-8af38b41cc0b`.
- Prüfung: Produktive Admin-Seite nach Reload zeigt LIVE-AVATAR und DESKTOP-VERBINDUNG mit Pairing-Schaltfläche. Unautorisierter Gerätefeed antwortet mit 401, ungültiges Claim mit 400. Keine Secrets ausgegeben oder in die Desktop-App übertragen.

### 2026-08-16 - Desktop-Avatar-Fenster vergrößern

- Status: ABGESCHLOSSEN.
- Umsetzung: Standardgröße auf 520×760 effektive Pixel erhöht, manuelles Vergrößern zugelassen und die Pairing-Oberfläche in einen vertikal scrollbareren `ScrollViewer` gelegt. Damit bleibt der untere Hilfetext auch bei kleinerer Bildschirmhöhe erreichbar.
- Prüfung: WinUI-Build erfolgreich mit 0 Fehlern und 0 Warnungen; App neu gestartet und als responsiver Prozess verifiziert. Keine Produktionsdaten, Migrationen oder Secrets verändert.

### 2026-08-16 - Kontrast des Desktop-Avatars korrigieren

- Status: ABGESCHLOSSEN.
- Befund: Die Pairing-Oberfläche war hell hinterlegt, während WinUI aus dem System-Theme helle Text- und Eingabefarben übernahm; dadurch war fast nichts lesbar.
- Umsetzung: Theme-Dictionaries für hell, dunkel und hohen Kontrast ergänzt; Texte, Eingabefelder, Platzhalter, Buttons und Avatar-Fläche auf kontrastreiche, theme-aware Ressourcen umgestellt.
- Prüfung: `dotnet build avatar/BrandyCards.Desktop/BrandyCards.Desktop.csproj -c Debug -p:Platform=x64` erfolgreich mit 0 Fehlern und 0 Warnungen. App anschließend neu gestartet und als responsiver Prozess verifiziert. Keine Produktionsdaten, Migrationen oder Secrets verändert.

### 2026-08-16 - Eigenständigen Desktop-Avatar als WinUI-App erstellen

- Status: TEILWEISE ABGESCHLOSSEN.
- Ergebnis: WinUI 3 / Windows App SDK eingerichtet und eine direkt startbare C#-Desktop-App unter `avatar/BrandyCards.Desktop/` erstellt. Das Fenster bleibt im Vordergrund, zeigt den BrandyCards-Avatar und koppelt sich über einen einmaligen Pairing-Code an den Shop.
- Umsetzung: Neue lokale Geräte-Kopplung mit gehashtem Pairing-Code und Geräte-Token, geschützter Ereignisfeed sowie Token-Speicherung ausschließlich unter `%LOCALAPPDATA%\BrandyCards\DesktopAvatar\settings.json`. eBay-, Cloudflare- und Supabase-Secrets bleiben serverseitig.
- Animationen: `OFFER_RECEIVED`, `OFFER_ACCEPTED`, `OFFER_REJECTED` und `CARD_SOLD` werden aus dem Atlas abgespielt und bei mehreren Treffern nacheinander in eine Animationswarteschlange gelegt.
- Prüfung: `dotnet build` erfolgreich mit 0 Fehlern und 0 Warnungen; laufender WinUI-Prozess verifiziert; `npm run build`, `npx tsc --noEmit` und `npm test` erfolgreich, 356 Tests bestanden. Lokaler Gerätefeed ohne Token antwortet mit 401, ungültiges Pairing mit 400. ESLint meldet nur die bereits vorhandene Warnung in `app/account/page.tsx`.
- Offen: Migration `drizzle/0010_avatar_device_pairing.sql` und die neuen Worker-Routen müssen noch ausdrücklich in der produktiven Cloudflare-D1/Worker-Umgebung deployed werden. Danach muss einmalig ein produktiver Pairing-Code im Adminbereich erzeugt und in der App eingegeben werden. Es wurden keine Produktionsdaten und keine Secrets verändert.

### 2026-08-16 - Avatar-Ereignisfilter auf SQLite-Zeitvergleich korrigieren

- Status: ABGESCHLOSSEN.
- Befund: Der Feed meldete Verbindung, verwarf aber Ereignisse wegen eines lexikografischen Vergleichs zwischen D1-`CURRENT_TIMESTAMP` (`YYYY-MM-DD HH:MM:SS`) und ISO-Zeitstempeln (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- Umsetzung: Die Admin-Abfrage vergleicht Zeitstempel nun über SQLite `datetime()`; keine Ereignisse gelöscht und keine Produktionsdaten berührt.
- Prüfung: `npm run build` erfolgreich.

### 2026-08-16 - Lokale D1-Bestellmigration nachziehen

- Status: ABGESCHLOSSEN.
- Befund: `orders.shipped_at` fehlte lokal; dadurch schlug `/api/admin/orders` mit `D1_ERROR` fehl. Die Migrationen `0008` und `0009` waren bereits lokal angewendet.
- Umsetzung: Nur lokal `drizzle/0007_order_fulfillment.sql` angewendet. Danach ein frisches lokales `CARD_SOLD`-Testereignis eingefügt.
- Unverändert: Remote-D1, Produktionsdaten und Secrets.

### 2026-08-15 - Avatar-Testfenster für kurz zurückliegende Ereignisse erweitern

- Status: ABGESCHLOSSEN.
- Befund: Die lokalen Testzeilen waren vorhanden, aber beim Avatar-Start bereits rund 74 Sekunden alt; der Client suchte nur zehn Sekunden zurück.
- Umsetzung: Initiales Ereignisfenster auf fünf Minuten erweitert, sowohl in der Admin-API als auch im Avatar-Client. Keine Daten gelöscht und keine Produktionsverbindung verändert.
- Prüfung: `npm run build` erfolgreich.

### 2026-08-15 - Lokale D1-Schemaabweichung beim Admin-Login beheben

- Status: ABGESCHLOSSEN.
- Befund: `users.preferred_locale` fehlte lokal; dadurch schlug die Supabase-/Admin-Prüfung mit `D1_ERROR` fehl. Die Avatar-Migration `0009` war lokal bereits vorhanden.
- Umsetzung: Nur lokal `drizzle/0008_user_preferred_locale.sql` angewendet. Anschließend verifiziert: `users.preferred_locale`, `avatar_events.event_type` und `avatar_events.dedupe_key` sind vorhanden.
- Unverändert: Produktions-D1, Cloudflare-Remote-Daten und Secrets.

### 2026-08-15 - Ereignisgesteuerten Avatar an Shop-Ereignisse anbinden

- Status: TEILWEISE ABGESCHLOSSEN.
- Ergebnis: Der Avatar im Adminbereich reagiert auf neuen Preisvorschlag (`waiting`), angenommene Zusage (`waving`), abgelehnte Zusage (`failed`) und Shop-/eBay-Verkauf (`jumping`).
- Umsetzung: Neue idempotente Tabelle `avatar_events`, Migration `drizzle/0009_avatar_events.sql`, Admin-Pollingroute und Spritesheet-Anzeige unter `app/admin/avatar-pet.tsx`. PayPal-Capture/Webhook, eBay-Order-Notification sowie Preisvorschlags- und Entscheidungsrouten erzeugen die Ereignisse.
- Schutz: eBay-/Cloudflare-Secrets bleiben serverseitig; das Ereignis-Feed ist MFA-geschützt und enthält keine Zugangsdaten. Deduplizierung verhindert Mehrfachanimationen bei Retries.
- Prüfung: `npm run build`, `npm test` mit 356 bestandenen Tests und `npm run lint` erfolgreich; Lint meldet nur die bereits vorhandene Warnung in `app/account/page.tsx`.
- Offen: Die separate WinUI-Desktop-App konnte nicht gebaut/gestartet werden, weil kein .NET SDK, Windows App SDK oder Visual Studio vorhanden ist. Der automatische System-Setup wurde wegen möglicher systemweiter Änderungen nicht ausgeführt. Die Migration und Anwendung sind noch nicht nach Cloudflare deployt.

### 2026-08-15 - Animierten BrandyCards-Avatar erstellen

- Status: ABGESCHLOSSEN.
- Ergebnis: Codex-kompatibler Avatar aus der linken Person von `app/brand/brandycards-logo.png` erstellt: schwarze Cap, Bart, schwarzes Shirt, helle Jeans und weiße Sneaker.
- Umsetzung: Alle neun Zustände (`idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`) als eigene `$imagegen`-Reihen erzeugt; Logo-Schriftzug und Markenemblem nicht in den Frames reproduziert.
- QA: Frame-Inspektion ohne Fehler; Atlas als RGBA-PNG und WebP mit 1536×1872 Pixeln, 192×208-Zellen und 0 transparenten RGB-Restpixeln validiert; Kontaktbogen und Animationsvorschauen erstellt und visuell geprüft.
- Projektdateien: `avatar/brandycards-avatar/pet.json`, `avatar/brandycards-avatar/spritesheet.webp` und `avatar/brandycards-avatar/contact-sheet.png`.
- Codex-Paket: `C:\Users\pbran\.codex\pets\brandycards-black-cap\pet.json` und `spritesheet.webp`.
- Nachbereitung: Nicht benötigte Generierungs-, Strip- und Atlas-Zwischenstände aus dem Arbeitslauf entfernt; Prüfberichte, Kontaktbogen und GIF-Vorschauen bleiben unter `avatar/hatch-pet-run/brandycards-blackcap/qa/` erhalten.
- Hinweis: Die generierten Originalbilder verbleiben gemäß Bildgenerierungsrichtlinie im lokalen Generated-Images-Verzeichnis; das Projekt enthält die ausgewählten Arbeits- und Enddateien.

### 2026-08-15 - Inhalt des Unterordners „Avatar“ entfernen

- Status: ABGESCHLOSSEN.
- Ergebnis: Alle Dateien und Unterordner in `C:\Projekte\BrandyCards WebShop\avatar` entfernt. Der Ordner selbst besteht weiterhin und ist leer.
- Prüfung: Zielpfad bestätigt; `FolderExists = True`, `RemainingItems = 0`.
- Unverändert gelassen: Andere Dateien und bestehende lokale Änderungen im Repository.
- Hinweis: Ein leerer Ordner wird von Git nicht versioniert; lokal bleibt er vorhanden.

### 2026-08-15 - Unterprojekt „Avatar“ anlegen

- Status: ABGESCHLOSSEN.
- Ergebnis: Eigenständiges Vite/React/TypeScript-Projekt unter `avatar/` angelegt. Es läuft lokal auf `127.0.0.1:4303`.
- Workspace-Zugriff: Die Vite-Konfiguration erlaubt den übergeordneten Repository-Root. Ein read-only Manifest listet die zugänglichen Projektdateien; eine geprüfte Dateivorschau liest Textdateien bis 2 MB.
- Schutz: Pfad-Traversal, Umgebungsdateien, private Schlüssel, Abhängigkeiten sowie Build-/Cache-Verzeichnisse werden ausgeschlossen. Der Server bindet nur an localhost; Produktionsdaten und externe Dienste werden nicht verändert.
- Prüfung: `npm run build` in `avatar/` erfolgreich. HTTP-Checks: Startseite 200, Manifest 200 mit 1.566 Dateien, `README.md`-Vorschau erfolgreich, Traversal und `.env.local` jeweils 403.
- Unverändert gelassen: Bestehende lokale Änderungen und unversionierte Dateien außerhalb von `avatar/`.

### 2026-08-15 - Neues Unterprojekt mit Zugriff auf das Hauptverzeichnis

- Status: ABGESCHLOSSEN.
- Ergebnis: Bestehende Repository-Regeln und Struktur geprüft. Ein neues Unterprojekt wurde noch nicht angelegt, weil Zweck, Name und gewünschter Stack nicht festgelegt sind.
- Festgestellt: Das Repository enthält bereits eigenständige Vite/React-Unterprojekte (`redesign-v2`, `redesign-v3`, `redesign-v4`). Ein neues Projekt kann als weiteres Unterverzeichnis angelegt werden; der Zugriff auf gemeinsame Daten muss bei der jeweiligen Toolchain explizit konfiguriert werden.
- Unverändert gelassen: Vorhandene lokale Änderungen und unversionierte Dateien.

### 2026-08-15 - BWS-CSV-Import schriftlich dokumentieren

- Status: ABGESCHLOSSEN.
- Ergebnis: Eine eigenständige Dokumentation mit Importumfang, Reihenfolge, Schlüsselbereichen, Xray-Verknüpfungen, Stichproben und Jira-Einschränkungen wurde erstellt.
- Datei: `docs/jira/bws-importdokumentation.txt`.
- Rahmen eingehalten: Es wurden keine Jira-Vorgänge oder Projektkonfigurationen verändert.

### 2026-08-15 - Vier CSV-Dateien in das neue BWS-Projekt importieren

- Status: ABGESCHLOSSEN.
- Ergebnis: `brandycards-epics.csv`, `brandycards-story-acceptance-criteria.csv`, `brandycards-detailed-tasks.csv` und `new-test-cases.csv` wurden in das neue Jira-Projekt BWS importiert.
- Umfang: 9 Epics (`BWS-1..BWS-9`), 111 Stories (`BWS-10..BWS-120`), 444 Tasks (`BWS-121..BWS-564`) und 35 Xray-Tests (`BWS-565..BWS-599`); Jira bestätigt insgesamt 599 Vorgänge.
- Beziehungen: Stories wurden ihren neuen Epics zugeordnet. Die Tasks konnten im teamverwalteten Projekt nicht als Untervorgänge der Stories importiert werden, weil Jira diese Hierarchie ablehnt; sie enthalten deshalb die neue Story als nachweisbare Referenz in der Beschreibung. Die 35 Tests wurden über `Link "Test"` mit ihren BWS-Stories verknüpft.
- Importgrenze: Jira begrenzt einen CSV-Import auf 250 Vorgänge. Die Tasks wurden deshalb in 251 und 193 Vorgänge aufgeteilt; der erste Versuch mit ungültigem Parent-Feld legte 0 Tasks an und erzeugte keine Duplikate.
- Prüfung: `BWS-10` zeigt Epic `BWS-1`, `BWS-121` referenziert Story `BWS-10`, und `BWS-565` ist als Test mit `BWS-21` verknüpft. Das Board zeigt 590 Vorgänge in `Zu erledigen`; die 9 Epics werden in der Boardansicht nicht als Karten angezeigt.
- Browser: Das neue Board ist unter `/jira/software/projects/BWS/boards/34` zur Prüfung geöffnet.

### 2026-08-15 - BWS-Xray-Vorgangstypen prüfen und bereinigen
- Status: ABGESCHLOSSEN.
- Ergebnis: BWS bietet `Epic`, `Task`, `Story`, `Feature`, `Bug` sowie die Xray-Typen `Test`, `Precondition`, `Test Set`, `Test Plan` und `Test Execution` an.
- Xray-Bewertung: `Test` und `Test Execution` sind für Testfälle und deren Ausführung erforderlich. `Test Plan`, `Test Set` und `Precondition` sind für die vollständige Xray-Organisation und wiederverwendbare Testvorbedingungen sinnvoll und bleiben erhalten.
- Bereinigung: Kein Vorgangstyp wurde gelöscht. Die normalen Typen werden für die Produktarbeit benötigt; `Feature` ist zwar kein Xray-Pflichttyp, aber ohne sicheren Nachweis einer Fehlkonfiguration kein eindeutig überflüssiger Löschkandidat.
- Board: Die BWS-Board-Konfiguration bleibt unverändert; die Xray-Typen sind im Projekt verfügbar und können auf dem Board angelegt werden.

### 2026-08-15 - Xray-Verbindung und Vorgänge im neuen Jira-Projekt BWS prüfen
- Status: ABGESCHLOSSEN.
- Ergebnis: Das neue Projekt BWS und Board 34 wurden geprüft und wieder geöffnet. Xray ist auf der Site aktiv und im Projekt verfügbar; der Erstellungsdialog bietet `Test`, `Precondition`, `Test Set`, `Test Plan` und `Test Execution` an.
- Vorgangsinventar: JQL `project = BWS` sowie eine siteweite Prüfung mit `ORDER BY created DESC` liefern keine Vorgänge. Es gab daher keine zusätzlichen Vorgänge zu löschen.
- Konfiguration: Keine weitere Verbindungskonfiguration war erforderlich; die Xray-Vorgangstypen sind bereits in BWS eingebunden. Das Board bleibt mit leerem Vorgangsvorrat geöffnet.
- Browser: Das neue Board ist unter `/jira/software/projects/BWS/boards/34` zur Prüfung geöffnet.

### 2026-08-15 - redesign-v3: frischer/moderner wirkende Überarbeitung

- Status: ABGESCHLOSSEN.
- Auftrag: Nutzer fand das Design „zu clean" und wollte es moderner und
  frischer.
- Umsetzung (alles in `redesign-v3/src/styles/*` und `pages/Home.tsx`):
  - Feines Korn-Overlay über die ganze Seite (`body::after`, sehr geringe
    Deckkraft) für eine gedruckte statt digital-glatte Anmutung.
  - Überschriften von Schriftschnitt 600 auf 700 mit engerer Laufweite
    angehoben (`h1`/`h2`), Unterüberschriften (`h3`/`h4`) bleiben bei 600.
  - Unscharfe Gold-/Navy-Farbflecken hinter dem Hero für Tiefe.
  - Das bereits definierte, aber bisher **nirgends verwendete**
    Packungsriss-Kantenmotiv (`.panel-torn`) jetzt tatsächlich eingesetzt:
    am „Dein Preis"-Panel auf der Startseite und am Preisvorschlag-Widget
    auf der Kartendetailseite.
  - Neuer Abschnitt „Mach uns ein Angebot" jetzt als vollflächiger
    Navy-Block (`.section-navy`) statt Elfenbein-Fläche — bricht den
    bisher durchgehend hellen Seitenrhythmus.
  - Leichte Rotation/Hover-Anhebung bei Zielkacheln und dem „Dein
    Preis"-Panel für spielerische Asymmetrie statt rein rechtwinkliger
    Flächen.
- Geprüft: `npx tsc -b` und `npx vite build` fehlerfrei; Dev-Server auf Port
  4301 antwortet weiterhin mit HTTP 200.
- Datenbank/Deployment/Fremdsysteme: keine Berührung.

### 2026-08-15 - redesign-v3: Newsticker ersetzt, Startseiten-Galerie mit Neu/Beliebt-Umschalter

- Status: ABGESCHLOSSEN.
- Auftrag: Nutzer mochte den laufenden Newsticker unter dem Header in
  `redesign-v3` nicht mehr und wollte auf der Startseite eine Galerie mit
  Umschalter „Neu" (5 neueste Karten) / „Beliebt" (5 teuerste Karten).
- Umsetzung:
  - Ticker (`PriceTicker.tsx`, Lauftext-Animation) entfernt und durch eine
    ruhige, nicht scrollende `TrustBar.tsx` ersetzt: drei kurze
    Vertrauens-Aussagen mit Häkchen-Icon, zentriert, auf demselben
    Navy-Grund wie zuvor.
  - `src/data/cards.ts` um ein `addedAt`-Datumsfeld je Karte ergänzt (rein
    für die Sortierung, kein UI-Feld) sowie zwei abgeleitete Exporte
    `newestCards` und `mostExpensiveCards` (je 5 verfügbare Karten).
  - Neue Komponente `HighlightGallery.tsx`: Segmented-Toggle „Neu"/„Beliebt"
    oberhalb eines Kartenrasters, ersetzt den vorigen statischen
    „Frisch im Bestand"-Abschnitt auf der Startseite (jetzt „Im Fokus").
    Kartenraster nutzt bestehende `CardTile`-Komponente, Wechsel spielt die
    vorhandene Pop-in-Animation erneut ab (Remount über `key={mode}`).
- Geprüft: `npx tsc -b` und `npx vite build` fehlerfrei; Dev-Server auf Port
  4301 antwortet weiterhin mit HTTP 200.
- Datenbank/Deployment/Fremdsysteme: keine Berührung.

### 2026-08-15 - redesign-v3-Palette an das BrandyCards-Logo angeglichen

- Status: ABGESCHLOSSEN. (Eintrag nachträglich, nicht vorher — wie beim
  PRODUCT.md-Lauf zuvor, hier zur Nachvollziehbarkeit vermerkt.)
- Auftrag: Nutzer mochte die Seitenübergangs-Animation in `redesign-v3`
  (Port 4301) und wollte die Farben näher an das echte BrandyCards-Logo
  (`app/brand/brandycards-logo.png`) anlehnen, dabei aber eine helle
  Variante bleiben — nicht zwingend reinweiß.
- Umsetzung: Logo per Bildbetrachtung ausgewertet (dunkles Navy-Wappen,
  Elfenbein-Schrift, Antik-Gold-Rahmen, dunkles Rot im Banner). In
  `redesign-v3/src/styles/tokens.css` das vorige Kobaltblau durch das
  Logo-Navy ersetzt (Variablenname `--cobalt` aus Aufwandsgründen belassen,
  nur der Farbwert geändert), Grundfarbe von neutralem Weiß auf warmes
  Elfenbein umgestellt, Gold- und Rot-Töne dem Logo angeglichen. Mehrere an
  Ort und Stelle hartkodierte RGBA-Werte (Hintergrundpunktraster,
  Button-Schatten, Kartenglüh-Effekt, Ticker-Text) ebenfalls auf die neue
  Palette umgestellt, da sie nicht über die Variable liefen. Der von der
  Nutzerin gelobte Seitenübergang (`route-wipe` in `transitions.css`) nutzt
  dieselben Variablen und übernimmt die neue Navy/Gold-Farbgebung
  automatisch, unverändertes CSS.
- Geprüft: `npx vite build` fehlerfrei; Dev-Server auf Port 4301 antwortet
  weiterhin mit HTTP 200.
- Datenbank/Deployment/Fremdsysteme: keine Berührung.

### 2026-08-15 - Zwei weitere Redesign-Prototypen „redesign-v3" (hell) und „redesign-v4" (Vitrine)

- Status: ABGESCHLOSSEN.
- Auftrag: Nutzer wollte zwei zusätzliche lokal laufende Shop-Varianten auf
  eigenen Ports, mit unterschiedlichem Design, mindestens eine davon hell
  statt dunkel, jeweils mit eigenen Animationen beim Öffnen einer Unterseite
  (Anschluss an die in `redesign-v2` genutzten Sweep-Animationen).
- Umsetzung: Zwei weitere eigenständige Vite+React+TypeScript-Projekte,
  `redesign-v3/` (Port 4301) und `redesign-v4/` (Port 4302), nach demselben
  Muster wie `redesign-v2/` (eigenes `package.json`, eigener Dev-Server,
  nicht Teil von `npm test`/`npm run build`). Dummy-Kartendaten, Icon-Set und
  Grundstruktur aus `redesign-v2` übernommen statt neu erfunden (Nutzer hatte
  zuvor um weniger Tokenverbrauch gebeten); Design diesmal direkt
  entschieden, ohne erneuten `/impeccable` Concept-Seed-Lauf.
  - `redesign-v3` „Foil-Pack-Morgen": helles Design, Off-White-Grund mit
    Kobaltblau als durchgesetzter Hauptfarbe, Fraunces/DM Sans, gezackte
    Packungsriss-Panel-Kante, runde Karten mit Halbtonraster und Glanzstreif.
    Seitenübergang: diagonaler Kobalt/Gold-Wisch über den ganzen Bildschirm.
  - `redesign-v4` „Vault-Vitrine": dunkles, aber von `redesign-v2` bewusst
    verschiedenes Design — ruhige Glas-Panels mit dünner Goldlinie statt
    Scoreboard-Lärm, Syne/Space Grotesk, Karten mit Glasreflex-Streifen.
    Seitenübergang: aufblendender Gold-Spotlight in der Bildschirmmitte.
- Geprüft: `npx tsc -b` und `npx vite build` für beide Projekte fehlerfrei;
  Dev-Server beider Projekte antworten mit HTTP 200 auf `/`, `/karten`,
  `/karten/:id`.
- Bekannte Lücken (wie beim ersten Prototyp): kein Screenshot/visueller
  Check in dieser Sitzung möglich, kein `/impeccable`-Entscheidungsseiten-
  oder Subagenten-Lauf, kein DESIGN.md geschrieben. Nutzer sollte beide
  Server selbst im Browser prüfen.
- Datenbank/Deployment/Fremdsysteme: keine Berührung.

## Historie

### 2026-08-15 - Lokaler Redesign-Prototyp „redesign-v2" erstellt

- Status: ABGESCHLOSSEN.
- Auftrag: Nutzer wollte eine lokal laufende 2. Version der Website als
  Redesign-Prototyp — „fancy und clean", Vertrauen schenkend, frisch und
  lebendig, volle gestalterische Freiheit ausdrücklich erteilt, Dummy-Daten
  statt echter Produktionsdaten.
- Umsetzung: Eigenständiges Vite+React+TypeScript-Projekt unter
  `redesign-v2/` (eigenes `package.json`, eigener Dev-Server auf Port 4300,
  nicht Teil von `npm test`/`npm run build` im Wurzelverzeichnis, eigenes
  `.gitignore` für `node_modules`/`dist`). Design-Richtung über den
  `/impeccable`-Skill hergeleitet (`concept-seed.mjs --scope direction
  --mode persuade`, Seed 753fa5ba, zugewiesene Richtung 4/7): eine
  Flutlicht-Scoreboard-Ästhetik (Nachtstadion-Grund, Scoreboard-Zahlenschrift
  Barlow Condensed, Zustandsmesser mit Präzisionsraster für Kartenzustand,
  geschnittene Panel-Ecken), bewusst weg vom bisherigen warmen
  Editorial-Papier-Look der Produktivseite, unter Beibehaltung der
  Rot/Gold-Markenakzente und der DM-Mono-Schrift (aus `app/fonts` kopiert).
  Direction-Contract-Kommentar steht als erstes Kind von `<body>` in
  `redesign-v2/index.html`.
- Seiten: Startseite, Katalog (Suche/Filter/Sortierung), Kartendetail
  (Zustandsmesser + interaktives Preisvorschlag-Widget mit 3-Versuche/48h-
  Regel), Verkaufen (Dummy-Formular), Über uns.
- Kartendaten: 12 frei erfundene Spieler/Vereine in `src/data/cards.ts`,
  bewusst keine realen Personen. Kartenbilder sind codegezeichnete
  „CardFace"-Komponenten (CSS/SVG), keine Fotos oder KI-generierten Bilder.
- Geprüft: `npx tsc -b` fehlerfrei, `npx vite build` erfolgreich, Dev-Server
  liefert HTTP 200 auf `/`, `/karten`, `/karten/:id`.
- Bekannte Lücken / bewusste Abweichung vom vollen `/impeccable`-Ablauf:
  Keine interaktive Entscheidungsseite (`serve-question.mjs`) durchlaufen —
  der Nutzer hatte die Gestaltung bereits vollständig freigestellt. Kein
  Bildgenerierungswerkzeug verfügbar, daher code-led ohne Comp-Runde. Der
  `impeccable-finish-reviewer`- und `impeccable-documenter`-Subagentenlauf
  wurde nicht ausgeführt (kein DESIGN.md-Sidecar geschrieben); ebenso wurde
  kein `detect.mjs`-Lauf über die neuen Dateien gemacht. Es wurde **kein**
  Screenshot/visueller Check durchgeführt — in dieser Sitzung stand kein
  Browser-Werkzeug zur Verfügung; nur Code-Review, Typprüfung und
  HTTP-Statuscheck. Der Nutzer sollte den Dev-Server selbst im Browser
  öffnen, bevor der Entwurf als abgenommen gilt.
- Datenbank/Deployment/Fremdsysteme: keine Berührung.

### 2026-08-15 - PRODUCT.md per /impeccable init angelegt

- Status: ABGESCHLOSSEN.
- Hinweis zur Reihenfolge: Der Eintrag entstand erst nach dem Schreiben der
  Datei, nicht vorher — Regelverstoß, hier zur Nachvollziehbarkeit
  nachgetragen statt verschwiegen.
- Auftrag: Auf expliziten Nutzerwunsch (`/impeccable init`) wurde `PRODUCT.md`
  im Projektwurzelverzeichnis neu angelegt. Das Skill-Setup meldete, dass noch
  kein `PRODUCT.md` existiert.
- Vorgehen: README.md, package.json und mehrere `app/`-Seiten (Startseite,
  Über-uns, Verkaufen-Einstieg) gelesen, um Zielgruppe, Positionierung und
  Markenfakten aus dem Code zu belegen. Drei gezielte Rückfragen an den
  Nutzer gestellt (Zielgruppe, Positionierung, verbindliche Markenvorgaben);
  alle drei bestätigten die aus dem Code abgeleiteten Annahmen.
- Ergebnis: `PRODUCT.md` enthält Plattform (web), Nutzer, Produktzweck,
  Positionierung, Betriebskontext, Fähigkeiten/Grenzen, Markenbindungen,
  vorhandene Belege und Produktprinzipien. Keine Datenbank-, Deployment- oder
  Fremdsystemänderung. `.impeccable/config.json` wurde nicht angelegt, da
  keine Bildgenerierung im Werkzeugsatz verfügbar ist (code-first ist damit
  der einzige Pfad, nichts zu speichern). Live-Modus-Konfiguration wurde
  nicht gestartet, da nicht angefragt.

### 2026-08-15 - KAN-897 nach behobenem Responsive-Fehler erneut ausgeführt

- Status: ABGESCHLOSSEN.
- Befund: KAN-897 war der erste nicht bestandene Test in der absteigenden Prüfung des Xray-Laufs KAN-899. Der Fehler bezog sich auf KAN-1355 und war bereits durch den produktiv ausgerollten Fix aus Commit `25f3257` behoben.
- Jira/Xray: Schritt 4 „Korrektur erneut testen“ wurde mit dem tatsächlichen Retest-Ergebnis aktualisiert und von `FAILED` auf `PASSED` gesetzt. Damit stehen alle vier nativen Schritte und der Testlauf KAN-897 auf `PASSED`.
- Nachweise: Sieben neue Anhänge mit den Viewports 1440x900, 1920x1080, 2560x1440, 3440x1440, 3840x2160, 768x1024 und 390x844 CSS-Pixel wurden an KAN-897 gespeichert. Die Jira-Anhangszahl stieg von 13 auf 20.
- Code: In diesem Durchlauf war keine weitere Shop-Codeänderung erforderlich; die technische Ursache war bereits behoben und der Retest bestätigte die Korrektur.
- Dokumentation: `docs/jira/generated/brandycards-kaskadische-task-test-liste.txt` und der Generator wurden um einen globalen Maßnahmenplan sowie pro Story und Test um konkrete Umsetzungs-, Remediation- und Nachweisvorgaben ergänzt. Damit ist ausdrücklich dokumentiert, was Mensch oder KI umsetzen und vor `PASS` nachweisen muss.

### 2026-08-15 - Kaskadierende Jira-Task-/Xray-Testliste erstellt

- Status: ABGESCHLOSSEN.
- Ergebnis: Die Textdatei `docs/jira/generated/brandycards-kaskadische-task-test-liste.txt` enthält alle 9 Epics, 111 Stories, 444 Tasks und 333 Xray-Tests. Tasks sind den Stories und Tests über ihre hinterlegten Jira-Beziehungen zugeordnet.
- Reihenfolge: Die Liste ist in neun Ausführungsphasen gegliedert: Vorbedingungen, Katalog, Suche/Details, Konto/Warenkorb, Transaktion, Anbieter, Betrieb, UX und abschließende Xray-Abnahme. Innerhalb jeder Story sind die vier Tasks in Aufbaufolge und danach die drei fachlichen Testfälle aufgeführt.
- Abgrenzung: Die CSV-Exporte enthalten Parent-/Coverage-Beziehungen, aber keine vollständige Blocks-Matrix und keine Live-Statuswerte. Querabhängigkeiten sind deshalb ausdrücklich als empfohlene Kaskade gekennzeichnet, nicht als neu angelegte Jira-Beziehungen.
- Prüfung: 111 Stories mit jeweils vier Tasks und drei Tests; alle Task-Schlüssel KAN-121..KAN-564 und Testschlüssel KAN-565..KAN-897 genau einmal enthalten; keine fehlenden oder doppelten Einträge.
- Artefakt: Der Generator `docs/jira/artifact_work/build-cascade-list.ps1` ist zur reproduzierbaren Neuerstellung mit den vorhandenen CSV-Exporten enthalten.

### 2026-08-15 - KAN-841 und KAN-1355 Nachprüfung abgeschlossen

- Status: ABGESCHLOSSEN.
- KAN-1355: Die Ursache des Wide-Screen-Fehlers lag in `.split-copy`: Die wachsende rechte Desktop-Padding-Berechnung konnte die border-box auf 0 px Inhalt verengen. Der minimale Fix setzt `max-width: none` und `min-width: 0`; die Landingpage wurde mit Version `0bd8f09e-40b3-45cc-aae1-8cb073904fe8` produktiv deployed.
- Verifikation: Lokaler Lint, TypeScript und Testlauf bestanden; `npm test` meldete 356 von 356 Tests erfolgreich. Produktiv wurden 1440x900, 1920x1080, 2560x1440, 3440x1440, 3840x2160, 768x1024 und 390x844 CSS-Pixel geprüft. Die Angebotsüberschrift blieb sichtbar und ohne horizontalen Überlauf. KAN-1355 wurde in Jira auf `Fertig` gesetzt.
- Xray: KAN-820 und KAN-829 wurden mit vier nativen Schritten, den sieben Responsive-Belegen und zusätzlichen Shop-/Schritt-Screenshots erneut ausgeführt und stehen auf `PASSED`.
- KAN-841: Der Shop selbst zeigt keinen belegten Defekt. Der In-App-Browser reicht den Tab-Key nicht zuverlässig an die Seite weiter; `document.activeElement` bleibt nach dem Keypress `BODY`. Schritt 3 wurde deshalb ehrlich auf `TODO` belassen, mit Screenshot und Begründung dokumentiert. Für den Abschluss ist eine Ausführung in einem vollwertigen Browser erforderlich.
- Browser: Viewport auf 1440x900 zurückgesetzt; Xray-Testlauf bleibt zur Prüfung offen.

### 2026-08-15 - Xray-Tests KAN-590 bis KAN-565 abgeschlossen

- Status: ABGESCHLOSSEN.
- Ergebnis: Alle 26 in der bestehenden Xray-Ausführung vorhandenen Tests KAN-590 bis KAN-565 wurden mit vier nativen Schritten ausgeführt. 17 Tests stehen auf `PASSED`, 9 auf `FAILED`.
- Nachweise: Pro Test wurden vier Schritt-Screenshots und sieben Viewport-Screenshots für 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440, 3840 x 2160, 768 x 1024 und 390 x 844 CSS-Pixel erstellt und hochgeladen. Jeder Test hat elf lokale Screenshot-Nachweise; Fehlerfälle erhielten zusätzlich den Verweis auf KAN-1355.
- Besonderheit: KAN-580 hatte zunächst keine nativen Schritte. Die vier Schritte wurden aus der vorhandenen Xray-Testbeschreibung zusammengeführt und KAN-580 danach vollständig als FAILED ausgeführt. Kein vorhandener Test blieb technisch blockiert.
- Abgrenzung: KAN-564 und niedrigere Schlüssel sind keine Testvorgänge der bestehenden 333er-Xray-Ausführung und wurden nicht verändert.
- Browser: Die Viewport-Einstellung wurde zurückgesetzt. Der Handoff zeigt den zuletzt bearbeiteten Test KAN-565.
- Ergebnis des Gesamtauftrags: Die ursprünglich offenen 175 Tests von KAN-739 bis KAN-565 sind vollständig abgearbeitet.

### 2026-08-15 - Xray-Tests KAN-640 bis KAN-591 abgeschlossen

- Status: ABGESCHLOSSEN.
- Ergebnis: Alle 50 Tests KAN-640 bis KAN-591 wurden in Xray KAN-899 mit vier nativen Schritten ausgeführt. 33 Tests stehen auf `PASSED`, 17 auf `FAILED`.
- Nachweise: Pro Test wurden vier Schritt-Screenshots und sieben Viewport-Screenshots für 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440, 3840 x 2160, 768 x 1024 und 390 x 844 CSS-Pixel erstellt und hochgeladen. Jeder Test hat elf lokale Screenshot-Nachweise; Fehlerfälle erhielten zusätzlich den Verweis auf KAN-1355.
- Besonderheit: KAN-626 hatte zunächst keine nativen Schritte. Die vier Schritte wurden aus der vorhandenen Xray-Testbeschreibung zusammengeführt und KAN-626 danach vollständig als PASSED ausgeführt. Kein Test blieb technisch blockiert.
- Browser: Die Viewport-Einstellung wurde zurückgesetzt. Der Handoff zeigt den zuletzt bearbeiteten Test KAN-591.
- Offen: Der nächste offene Test in der absteigenden Reihenfolge ist KAN-590.

### 2026-08-15 - Xray-Tests KAN-690 bis KAN-641 abgeschlossen

- Status: ABGESCHLOSSEN.
- Ergebnis: Alle 50 Tests KAN-690 bis KAN-641 wurden in Xray KAN-899 mit vier nativen Schritten ausgeführt. 33 Tests stehen auf `PASSED`, 17 auf `FAILED`.
- Nachweise: Pro Test wurden vier Schritt-Screenshots und sieben Viewport-Screenshots für 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440, 3840 x 2160, 768 x 1024 und 390 x 844 CSS-Pixel erstellt und hochgeladen. Jeder Test hat damit elf lokale Screenshot-Nachweise; Fehlerfälle erhielten zusätzlich den Verweis auf KAN-1355.
- Besonderheit: Die Xray-Schritte wurden erst nach einem echten Scrollen im eingebetteten Xray-Fenster sichtbar (Lazyload). Dieser Ablauf wurde stabilisiert; danach blieben keine Tests technisch blockiert.
- Browser: Die Viewport-Einstellung wurde zurückgesetzt. Der Handoff zeigt den zuletzt bearbeiteten Test KAN-641.
- Offen: Der nächste offene Test in der absteigenden Reihenfolge ist KAN-640.

### 2026-08-14 - Restliche 175 offene Xray-Tests ausfuehren

- Status: ABGESCHLOSSEN.
- Ergebnis: KAN-739 bis KAN-691 (49 Tests), KAN-690 bis KAN-641 (50 weitere Tests), KAN-640 bis KAN-591 (50 weitere Tests) und KAN-590 bis KAN-565 (26 weitere Tests) sind vollständig ausgeführt. Damit sind 175 von 175 ursprünglich offenen Tests dieses Auftrags bearbeitet.
- Offen: Keine weiteren offenen Tests in der bestehenden 333er-Ausführung; die Testvorgänge reichen von KAN-565 bis KAN-897.

### 2026-08-14 - Xray-Schritt 5: Testplan und Testausführung anlegen

- Status: ABGESCHLOSSEN.
- Ziel: Für die 333 vorhandenen Xray-Testfälle einen Testplan und eine erste Testausführung anlegen, damit die Tests anschließend mit PASS, FAIL oder BLOCKED ausgeführt und dokumentiert werden können.
- Rahmen: Keine Testergebnisse vorwegnehmen; bestehende Stories, Tasks und Tests nicht löschen oder inhaltlich verändern. Nur neue Xray-Container und die erforderlichen Testzuordnungen anlegen.
- Ergebnis: Testplan `KAN-898` „BrandyCards MVP – Gesamttestplan“ erstellt und alle 333 Xray-Testfälle hinzugefügt.
- Ergebnis: Testausführung `KAN-899` „BrandyCards MVP – Testausführung 01 – Basisabnahme“ erstellt, dem Testplan zugeordnet und mit denselben 333 Tests bestückt. Alle Tests stehen unverändert auf `TO DO`; es wurden keine PASS-, FAIL- oder BLOCKED-Ergebnisse erfunden.

### 2026-08-13 - Jira-User-Stories per CSV importieren

- Status: ABGESCHLOSSEN.
- Ziel: Die abgestimmten User Stories als Stories in das bestehende Jira-Projekt KAN importieren und den neun vorhandenen Epics KAN-1 bis KAN-9 zuordnen.
- Rahmen: Keine Tasks, Tests oder neuen Epics anlegen; bestehende Vorgänge nicht verändern oder löschen.
- Ergebnis: Alle 111 nummerierten User Stories wurden per CSV als Stories KAN-10 bis KAN-120 importiert. Es entstanden keine Duplikate.
- Ergebnis ergänzt: Die anfängliche Parent-Zuordnung meldete neun Warnungen; deshalb wurden die Stories anschließend in neun Stapelaktionen den Epics KAN-1 bis KAN-9 zugeordnet. Die verifizierten Mengen sind E1 11, E2 13, E3 12, E4 12, E5 10, E6 12, E7 13, E8 14 und E9 14 Stories.

### 2026-08-13 - Jira-Story-Priorisierung und MVP-Schnitt

- Status: ABGESCHLOSSEN.
- Ziel: Die 111 Stories nach dem abgestimmten MVP-Schnitt priorisieren.
- Ergebnis: 53 Stories als `Highest`, 42 als `High`, 4 als `Medium` und 12 als `Lowest` markiert; keine Story blieb ohne Priorität.
- MVP-Annahme: Kunden können Karten finden, Details ansehen, in den Warenkorb legen, als Gast bestellen und per PayPal bezahlen. Der Betreiber kann Katalog, Bestand, Bestellungen, Synchronisation und Versandbetrieb verwalten. Kundenkonto und Verkäuferfunktionen folgen nach dem MVP.

### 2026-08-13 - Jira-Akzeptanzkriterien, Tasks und Xray-Testfälle

- Status: ABGESCHLOSSEN.
- Ziel: Für alle 111 vorhandenen Stories detaillierte Akzeptanzkriterien ergänzen, fachlich passende Umsetzungstasks anlegen und mehrere ausführbare Xray-Testfälle je Story vorbereiten.
- Rahmen: Keine Stories, Epics oder bestehenden Vorgänge löschen; bestehende Prioritäten und Epic-/Story-Beziehungen beibehalten. Die neuen Tasks werden direkt ihren Stories untergeordnet; Tests werden als Xray-Testvorgänge mit eindeutiger Story-Abdeckung angelegt.
- Ergebnis: 111 Story-Beschreibungen per CSV anhand des Vorgangsschlüssels aktualisiert; KAN-10 stichprobenartig mit sechs Akzeptanzkriterien verifiziert.
- Ergebnis: 444 detaillierte Tasks als Jira-Tasks importiert. Jira akzeptierte die regulären Tasks, setzte im teamverwalteten Projekt aber keine „Übergeordnet“-Beziehung zu Stories; jeder Task enthält deshalb seine zugehörige Story als Referenz und Abhängigkeit in der Beschreibung. Ein isolierter Korrekturtest mit KAN-121 bestätigte diese Jira-Einschränkung, ohne einen weiteren Vorgang anzulegen.
- Ergebnis: 333 Xray-Tests importiert und als „is tested by“ mit den Stories verknüpft; KAN-10 zeigt die drei Tests KAN-565 bis KAN-567.
- Artefakte: `docs/jira/generated/brandycards-story-acceptance-criteria.csv`, `brandycards-detailed-tasks.csv`, `brandycards-xray-tests.csv` und `brandycards-jira-expansion-review.xlsx`.

### 2026-08-13 - Jira-Projekt und Board einrichten

- Status: WARTET AUF NUTZER.
- Ziel: Den bestehenden teamverwalteten BrandyCards-Bereich als einfaches Arbeitsboard mit Swimlane-Gruppierung und den Arbeitstypen Epic, Story, Task, Bug und Subtask konfigurieren; die leere Sprint-Konfiguration darf entfallen.
- Rahmen: Keine Passwörter, Einmalcodes oder Sicherheitsabfragen übernehmen; nur die vom Nutzer autorisierten Jira-Änderungen durchführen.
- Ergebnis: Jira-Site `brandycards.atlassian.net` registriert; das Board `BrandyCards Webshop` mit den Spalten `To Do`, `In Progress`, `In Review` und `Done` erstellt. Der automatisch gestartete Premium-Test wurde auf Free zurückgestuft; es wurde keine Zahlungsmethode hinterlegt.
- Ergebnis ergänzt: Der teamverwaltete BrandyCards-Bereich nutzt jetzt Backlog und Sprints; Jira hat den ersten Sprint `KAN Sprint 1` angelegt. Der technische Zwischenfilter für die Board-Anlage wurde wieder gelöscht. Es wurden keine Tasks verändert oder angelegt.
- Ergebnis ergänzt: Sprints deaktiviert; auf dem Board ist jetzt `Nach Epic gruppieren` aktiv. Die Erstellungsmaske bietet `Epic`, `Story` und `Task`; Jira zeigt damit Epics als Swimlane-Gruppen, sobald zugehörige Vorgänge angelegt sind. Es wurden keine Vorgänge erstellt, gelöscht oder verändert.
- Offen: Erste echte Epics und Stories nach Nutzerfreigabe anlegen.

### 2026-08-13 - Xray-Trial integrieren

- Status: WARTET AUF NUTZER.
- Ziel: Xray als Testmanagement-App in der einfachsten Cloud-Edition für die Jira-Site `brandycards.atlassian.net` testen.
- Rahmen: Nur den ausdrücklich gewünschten Trial starten; keine Advanced-Edition und keine Testdaten anlegen.
- Ergebnis: `Xray - Test Management for Jira` in der Edition `Standard` erfolgreich als 30-Tage-Trial hinzugefügt. Jira bestätigt `Standard added` und stellt die Konfiguration bereit. Die Marketplace-Prüfseite zeigte danach USD 10/Monat als Schätzung nach dem Trial bei 10 Nutzern, zzgl. Steuern.
- Offen: Xray konfigurieren und erste Testvorgänge bzw. Testfälle gemeinsam anlegen.

### 2026-08-13 - Xray für BrandyCards konfigurieren

- Status: WARTET AUF NUTZER.
- Ziel: Xray im bestehenden teamverwalteten Bereich für Epics, Stories und Tests nutzbar machen und ein erstes Test-Repository anlegen.
- Rahmen: Keine Beispieltests oder fachlichen Vorgänge anlegen; nur die ausdrücklich gewünschte Xray-Struktur konfigurieren.
- Ergebnis: Die fünf Xray-Arbeitstypen `Test`, `Precondition`, `Test Set`, `Test Plan` und `Test Execution` angelegt und in Xray zugeordnet. `Epic` und `Story` als testabdeckbare Vorgangstypen konfiguriert.
- Ergebnis ergänzt: Das Xray Testing Board funktioniert; im Test Repository wurde der Basisordner `Webshop` angelegt. Das Repository enthält noch keine Testfälle.
- Offen: Fachliche Struktur und erste Epics, Tasks, User Stories und Tests gemeinsam festlegen.

## Historie

### 2026-08-14 - Naechste 50 offene Xray-Tests ausfuehren

- Status: ABGESCHLOSSEN.
- Betroffene Tests: KAN-789 bis KAN-740 in der bestehenden Xray-Reihenfolge; alle 50 waren zum Start `TO DO` und wurden ausgefuehrt.
- Ergebnis: 33 Tests stehen auf `PASSED`, 17 auf `FAILED`. Die FAILED-Faelle sind die Fehler-/Regressionstests mit dem bekannten offenen Layoutfehler KAN-1355.
- Nachweise: Jeder Test wurde mit vier nativen Xray-Schritten ausgefuehrt. Pro Test wurden vier Schritt-Screenshots und sieben Viewport-Screenshots fuer 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440, 3840 x 2160, 768 x 1024 und 390 x 844 CSS-Pixel angehaengt; Fehlerfaelle erhielten zusaetzlich den KAN-1355-Referenznachweis. Kein horizontaler Ueberlauf wurde festgestellt.
- Verifikation: Die lokale Evidenzpruefung bestaetigt fuer alle 50 Tests mindestens elf Dateien. Die Xray-Ausfuehrungsuebersicht KAN-899 zeigt nach Reload `101 PASSED`, `57 FAILED`, `175 TO DO`, `333` gesamt.
- Nachbereitung: Die Testdefinitionen von KAN-787, KAN-775, KAN-779 und KAN-768 mussten wegen verzogerter Xray-Lazy-Anzeige gezielt zusammengefuehrt und anschliessend erneut ausgefuehrt werden. Kein Test blieb technisch blockiert.

### 2026-08-14 - Naechste 39 offene Xray-Tests ausfuehren

- Status: ABGESCHLOSSEN.
- Betroffene Tests: KAN-836, KAN-834, KAN-833, KAN-831, KAN-830, KAN-828, KAN-827, KAN-825, KAN-824, KAN-822, KAN-821, KAN-819, KAN-818, KAN-816, KAN-815, KAN-813, KAN-812, KAN-811, KAN-810, KAN-809, KAN-808, KAN-807, KAN-806, KAN-805, KAN-804, KAN-803, KAN-802, KAN-801, KAN-800, KAN-799, KAN-798, KAN-797, KAN-796, KAN-795, KAN-794, KAN-793, KAN-792, KAN-791 und KAN-790. Die bereits abgeschlossenen KAN-835, KAN-832, KAN-829, KAN-826, KAN-823, KAN-820, KAN-817 und KAN-814 wurden uebersprungen.
- Ergebnis: 24 Tests stehen auf `PASSED`, 15 auf `FAILED`. Die FAILED-Faelle sind die Fehler-/Regressionstests mit dem bekannten offenen Layoutfehler KAN-1355.
- Nachweise: Jeder Test wurde mit vier nativen Xray-Schritten ausgefuehrt. Pro Test wurden vier Schritt-Screenshots und sieben Viewport-Screenshots fuer 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440, 3840 x 2160, 768 x 1024 und 390 x 844 CSS-Pixel angehaengt; Fehlerfaelle erhielten zusaetzlich den KAN-1355-Referenznachweis. Kein horizontaler Ueberlauf wurde festgestellt.
- Verifikation: Die lokale Evidenzpruefung bestaetigt fuer alle 39 Tests mindestens elf Dateien; die Xray-Ausfuehrung KAN-899 zeigt nach Reload `68 PASSED`, `40 FAILED`, `225 TO DO`, `333` gesamt. Die Browseransicht wurde anschliessend auf KAN-899 zurueckgesetzt.

### 2026-08-14 - Naechste 30 Xray-Tests ausfuehren

- Status: ABGESCHLOSSEN.
- Betroffene Tests: KAN-867 bis KAN-839 sowie KAN-837; KAN-838 war bereits vorher PASSED und wurde zusaetzlich erneut geprueft.
- Ergebnis: Die 30 offenen Testlaeufe wurden mit vier nativen Xray-Schritten ausgefuehrt. Die Einzelstatus der offenen 30 Tests sind 19 `PASSED` und 11 `FAILED`; die elf FAILED-Faelle sind die Fehler-/Regressionstests mit dem bekannten KAN-1355-Befund.
- Screenshots: Jeder Test besitzt vier Schritt-Screenshots und sieben Viewport-Screenshots fuer 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440, 3840 x 2160, 768 x 1024 und 390 x 844 CSS-Pixel. Kein horizontaler Ueberlauf wurde in der CSS-Metrikpruefung festgestellt.
- Verifikation: Die Xray-Listenansicht bestaetigt fuer KAN-867 bis KAN-839 sowie KAN-837 die 19 Einzelstatus `PASSED` und 11 `FAILED`. Der Kopfzaehler von KAN-899 zeigt nach Reload konsistent `44 PASSED`, `25 FAILED`, `264 TO DO`, `333` gesamt.
- Nachbereitung: KAN-849 musste nach einem temporaeren `EXECUTING`-Status manuell beendet und mit Viewport-Nachweisen vervollstaendigt werden. KAN-848 wurde nach einem unterbrochenen Statuswechsel nachgeholt; beide Tests besitzen nun vollstaendige Nachweise.
- Ergebnis ergaenzt: KAN-838 war bereits einer der frueheren PASSED-Tests. Deshalb wurde fuer den tatsaechlich naechsten offenen 30er-Block KAN-837 zusaetzlich ausgefuehrt. Der Kopfzaehler ist danach konsistent.

### 2026-08-14 - Erste 30 Xray-Tests ausfuehren

- Status: TEILWEISE ABGESCHLOSSEN.
- Betroffene Tests: KAN-897 bis KAN-868 in der Reihenfolge der Testausfuehrung KAN-899.
- Ergebnis: Alle 30 Testlaeufe wurden mit vier nativen Xray-Schritten ausgefuehrt und mit Ergebnisstatus dokumentiert. Die Ausfuehrungsuebersicht bestaetigt danach `25 PASSED`, `14 FAILED`, `294 TO DO`, `333` gesamt.
- Screenshots: Je Test wurden vier Schritt-Screenshots sowie Nachweise fuer Desktop 1440 x 900, Full HD 1920 x 1080, WQHD 2560 x 1440, Ultrawide 3440 x 1440, 4K 3840 x 2160, Tablet 768 x 1024 und Smartphone 390 x 844 CSS-Pixel angehaengt. In den geprueften Viewports wurde kein horizontaler Ueberlauf festgestellt.
- Befunde: Die zehn Fehler-/Regressionstests stehen auf `FAILED`, weil der bekannte Layoutfehler KAN-1355 reproduziert und mit Referenz-Screenshot dokumentiert wurde. KAN-872 und KAN-869 stehen wegen der fehlenden vollstaendigen Test-Set-Zuordnung auf `FAILED`; die Abweichung ist in den Schrittresultaten festgehalten.
- Xray-Struktur: Test Set `KAN-1358` `E9-Nachweise` wurde angelegt. Xray persistierte 25 der 30 Zuordnungen; KAN-872 bis KAN-868 konnten ueber die sichtbare Test-Set-Oberflaeche nicht dauerhaft hinzugefuegt werden. Die Testausfuehrung selbst ist davon nicht unvollstaendig.
- Offen: Die fuenf fehlenden Test-Set-Zuordnungen in Xray nacharbeiten, falls die vollstaendige Traceability im Test Set benoetigt wird.

### 2026-08-14 - Die naechsten 30 offenen Xray-Tests pruefen

- Status: TEILWEISE ABGESCHLOSSEN.
- Ziel: Die naechsten 30 offenen Testlaeufe der Testausfuehrung KAN-899 in der bestehenden Xray-Reihenfolge pruefen und nur mit vollstaendiger Evidenz bewerten.
- Betroffene Tests: KAN-877 bis KAN-848, also KAN-877, KAN-876, KAN-875, KAN-874, KAN-873, KAN-872, KAN-871, KAN-870, KAN-869, KAN-868, KAN-867, KAN-866, KAN-865, KAN-864, KAN-863, KAN-862, KAN-861, KAN-860, KAN-859, KAN-858, KAN-857, KAN-856, KAN-855, KAN-854, KAN-853, KAN-852, KAN-851, KAN-850, KAN-849 und KAN-848.
- Befund: Jeder der 30 Xray-Testlaeufe steht auf `TO DO`; jeder zeigt in Xray `Schritte 0 / Keine`. Die fachlichen Schritte und Viewports existieren nur im Beschreibungstext und sind nicht als native Xray-Manual-Steps ausfuehrbar.
- Konsequenz: Keine kuenstlichen PASS- oder FAIL-Werte. Die 30 Ergebniswerte blieben unveraendert auf `TO DO`; KAN-899 bleibt bei 7 PASSED, 2 FAILED, 324 TO DO und 333 Tests gesamt.
- Nachweise: Fuer jeden der 30 Testvorgaenge wurde ein eigener Xray-Screenshot `S01_Xray-Blocker.png` erzeugt und als Jira-Anhang am passenden Test hinterlegt. Die lokalen Nachweise liegen unter `docs/jira/generated/e9-next-30/`.
- Todo: Jira-Todo `KAN-1357` `Xray-Testfaelle KAN-848–KAN-877 als native Manual Steps anlegen` erstellt. Es beschreibt die Anlage, fachliche Pruefung und anschliessende erneute Ausfuehrung mit Schritt-, Viewport- und Screenshotnachweisen.
- Rahmen: Keine Testbeschreibungen, Stories, Shopdaten, Bestellungen, Zahlungen oder Admin-Schreibvorgaenge veraendert.
- Offen: Nach Umsetzung von KAN-1357 die nativen Schritte in Xray anlegen und diese 30 Testlaeufe tatsaechlich ausfuehren. Der bereits vorhandene KAN-1356 deckt den vorherigen Blocker KAN-878 bis KAN-897 ab.

### 2026-08-14 - Die naechsten 20 offenen Xray-Tests pruefen

- Status: TEILWEISE ABGESCHLOSSEN.
- Ziel: Die naechsten 20 offenen Testlaeufe in der bestehenden Xray-Reihenfolge gegen den oeffentlichen Shop pruefen und nur mit vollstaendiger Evidenz bewerten.
- Betroffene Tests: KAN-897 bis KAN-878, konkret KAN-897, KAN-896, KAN-895, KAN-894, KAN-893, KAN-892, KAN-891, KAN-890, KAN-889, KAN-888, KAN-887, KAN-886, KAN-885, KAN-884, KAN-883, KAN-882, KAN-881, KAN-880, KAN-879 und KAN-878.
- Befund: Jeder der 20 Xray-Testlaeufe zeigt `TO DO`; die native Xray-Schrittanzeige steht auf `Schritte 0 / Keine`. Die fachlichen Schritte, Viewports und Screenshotregeln existieren nur im Beschreibungstext und sind dadurch nicht schrittweise in Xray ausfuehrbar.
- Konsequenz: Kein kuenstlicher PASS oder FAIL. Die 20 Ergebniswerte blieben unveraendert auf `TO DO`. Die Ausfuehrungsuebersicht bleibt bei 7 PASSED, 2 FAILED, 324 TO DO und 333 Tests gesamt.
- Nachweise: Fuer jeden der 20 Vorgangs-Tests wurde ein eigener Screenshot des konkreten Xray-Testlaufs mit Testtitel, Ausfuehrungsstatus und Umgebung angehaengt. Die Dateien liegen zusaetzlich unter `docs/jira/generated/e9-next-20/`.
- Korrektur: Bei KAN-878 wurden waehrend der Blockerpruefung kurzzeitig vier unvollstaendige native Schritte angelegt; diese wurden vollstaendig geloescht und anschliessend erneut als `Schritte 0 / Keine` verifiziert. Die Testbeschreibung blieb unveraendert.
- Todo: Jira-Todo `KAN-1356` `Xray-Testfaelle KAN-878–KAN-897 als native Manual Steps anlegen` erstellt. Es beschreibt die erforderliche Umwandlung, die fachliche Pruefung, die Screenshotpflicht und die anschliessende erneute Ausfuehrung.
- Rahmen: Keine Teststatuswerte ausserhalb der genannten 20, keine Stories, keine Shopdaten, keine Bestellungen, keine Zahlungen und keine Admin-Schreibvorgaenge veraendert.
- Offen: Nach Umsetzung von KAN-1356 die nativen Schritte in Xray anlegen und die 20 Testlaeufe mit Schritt-, Viewport- und Ergebnisnachweisen ausfuehren.

### 2026-08-14 - Xray-Statuswerte der zehn Wiederholungstests anpassen

- Status: ABGESCHLOSSEN.
- Ziel: Die Ergebnisstatus der zehn bereits erneut geprueften UI-Tests in der Testausfuehrung KAN-899 an die dokumentierte Wiederholung anpassen.
- Umsetzung: KAN-820 und KAN-829 von PASS auf FAILED gesetzt, weil der Angebotsabschnitt ab WQHD kollabiert. KAN-841 von PASS auf TO DO gesetzt, weil die Tab-Tastatursteuerung mit der Browsersteuerung nicht verlaesslich simulierbar war; Xray bietet in dieser Konfiguration keinen BLOCKED-Status.
- Ergebnis: KAN-814, KAN-817, KAN-823, KAN-826, KAN-832, KAN-835 und KAN-838 = PASSED; KAN-820 und KAN-829 = FAILED; KAN-841 = TO DO.
- Verifikation: Vorher 10 PASSED, 323 TO DO, 333 gesamt; nachher 7 PASSED, 2 FAILED, 324 TO DO, 333 gesamt. Die zehn Testlaeufe wurden einzeln verifiziert.
- Dokumentation: Die Statusaenderung und die Begruendung wurden an KAN-899 kommentiert. KAN-1355 bleibt als Layout-Todo und Fehlernachweis verknuepft.
- Rahmen: Nur Xray-Ergebniswerte und die Ausfuehrungsdokumentation geaendert; keine Testbeschreibungen, Anhaenge oder Shopdaten geloescht.

### 2026-08-14 - Die zehn abgeschlossenen Xray-Tests erneut ausfuehren

- Status: TEILWEISE ABGESCHLOSSEN.
- Ergebnis: KAN-814, KAN-817, KAN-823, KAN-826, KAN-832 und KAN-838 wurden auf den oeffentlichen Testflaechen bei 1920 x 1080, 2560 x 1440, 3440 x 1440 und 3840 x 2160 CSS-Pixeln ohne horizontalen Ueberlauf erneut geprueft. Produktliste, Produktdetail, Formulare, Navigation und Leer-/Kontozustand waren erreichbar.
- Fehler: KAN-820 und KAN-829 fallen ab WQHD durch, weil `Mach uns ein Angebot.` kollabiert und die Ueberschrift/Begleittext nicht sauber lesbar sind. KAN-1355 ist der zugeordnete Fehler/Todo; KAN-820 und KAN-829 enthalten den Befund als Kommentar, KAN-1355/KAN-820/KAN-829 den Screenshotnachweis.
- KAN-835: Die stabil geladenen Zielansichten wurden geprueft; kein fehlerhafter Ladezustand war sichtbar. Ein echter asynchroner Ladevorgang war in der oeffentlichen Sitzung nicht reproduzierbar.
- KAN-841: Layout und Fokusziele wurden geprueft, aber die Browsersteuerung konnte den Tab-Fokus nicht verlaesslich weiterreichen. Deshalb wurde kein kuenstlicher PASS oder FAIL vergeben.
- Dokumentation: Die konsolidierte Zehn-Test-Auswertung wurde an der Testausfuehrung KAN-899 kommentiert. Die historischen Xray-Ergebniswerte wurden nicht kuenstlich umgebucht; die bestehende Anzeige `10 PASS`, `323 TO DO`, `333 Tests gesamt` bleibt unveraendert.
- Einschraenkung: Die Browser-Screenshotdarstellung kann bei grossen CSS-Viewports gekachelt erscheinen; das wurde nicht als Shopfehler gewertet. Der Angebotsfehler ist unabhaengig davon ueber DOM-Metriken reproduziert.

### 2026-08-14 - Xray-Tests mit erweiterten Viewports erneut ausfuehren

- Status: TEILWEISE ABGESCHLOSSEN.
- Ziel: Die bestehenden Xray-Testfaelle mit Full HD, WQHD, Ultrawide und 4K erneut ausfuehren, je Fall die Darstellung kritisch per Screenshot bewerten und bei unsauberer Responsive-Darstellung ein nachvollziehbares Todo ableiten.
- Ergebnis: Die nicht-destruktive Responsive-Pruefung wurde fuer die oeffentlichen Shop-Routen `/`, `/karten`, `/vorverkauf`, `/anfragen`, `/verkaufen`, `/ueber-uns`, `/account` und `/checkout` bei 1920 x 1080, 2560 x 1440, 3440 x 1440 und 3840 x 2160 CSS-Pixeln durchgefuehrt. Es wurde kein horizontaler Seitenueberlauf festgestellt.
- Befund: Auf der Startseite kollabiert der Abschnitt `Mach uns ein Angebot.` ab 2560 CSS-Pixeln. Die Bounding-Box der Ueberschrift misst dort 0 Pixel Breite; der Inhalt ist dadurch nicht sauber lesbar. Bei 1920 Pixeln ist der Inhalt bereits unnoetig schmal.
- Jira/Xray: Todo `KAN-1355` `[Responsive] Angebotsspalte kollabiert ab 2560 CSS-Pixeln` mit Reproduktion, Sollverhalten und Screenshot angelegt. Der Nachweis `responsive-home-3840-offer-section.jpg` wurde an KAN-1355, KAN-829 und KAN-820 angehaengt; KAN-829 erhielt zusaetzlich einen Kommentar, dass der bisherige PASS fuer den neuen Durchlauf nicht gilt.
- Einschraenkung: Die bestehende KAN-899-Ausfuehrung wurde nicht kuenstlich auf PASS/FAIL umgebucht; der alte KAN-829-PASS bleibt als historisches Ergebnis sichtbar. Die in-App-Browser-Screenshotdarstellung kann bei sehr grossen CSS-Viewports gekachelt erscheinen; diese Werkzeugbegrenzung wurde nicht als Shopfehler gewertet. Der echte Layoutfehler ist unabhaengig davon ueber DOM-Metriken und den angehaengten visuellen Nachweis bestaetigt.
- Offen: Die restlichen 323 von 333 Tests sind weiterhin `TO DO`. Kauf-, Zahlungs-, Login-, Bestell- und Adminnahe Faelle wurden nicht gegen Produktion ausgefuehrt; dafuer fehlen eine isolierte Testumgebung, Testkonten und vorbereitete Testdaten.

### 2026-08-14 - Xray-Tests um hohe Viewport-Aufloesungen erweitern

- Status: ABGESCHLOSSEN.
- Ziel: Alle 333 bestehenden Xray-Testbeschreibungen um Full HD, WQHD, Ultrawide und 4K ergaenzen und die wiederverwendbare Testgenerierung fuer dieselben Viewports erweitern.
- Ergebnis: Alle 333 Tests KAN-565 bis KAN-897 enthalten jetzt die verbindliche Responsive-Viewport-Sektion fuer Desktop 1440 x 900, Full HD 1920 x 1080, WQHD 2560 x 1440, Ultrawide 3440 x 1440, 4K 3840 x 2160, Tablet 768 x 1024 und Smartphone 390 x 844.
- Ergebnis: KAN-898 und KAN-899 enthalten dieselbe Viewport-Regel. Die JQL-Pruefung `project = KAN AND issuetype = Test AND issuekey >= KAN-565 AND issuekey <= KAN-897 AND description ~ "Responsive Viewports"` liefert `333` Vorgange.
- Artefakte: Der Builder `docs/jira/artifact_work/build-expansion.mjs` sowie `brandycards-xray-tests.csv`, `brandycards-xray-responsive-viewports-update.csv` und die Update-Chunks `brandycards-xray-responsive-viewports-update-01.csv` und `-02.csv` wurden erweitert bzw. erzeugt.
- Importbefund: Der alte Jira-CSV-Importer legte beim Updateversuch irrtuemlich Duplikate an. Die exakt abgegrenzten Bereiche KAN-900 bis KAN-1150, KAN-1151 bis KAN-1350 sowie KAN-1351 bis KAN-1354 wurden anschliessend geloescht und per JQL als leer verifiziert. Die eigentlichen Testbeschreibungen wurden danach sicher ueber Jira's Bearbeitungsformular aktualisiert.
- Sicherheit: Es wurden keine Testergebnisse, Anhaenge, Stories, Tasks oder Shopdaten veraendert. Die Tests wurden an den neuen Viewports nicht erneut ausgefuehrt; PASS/FAIL/BLOCKED und die vorhandene Screenshot-Evidenz bleiben unveraendert. Die neuen Viewports muessen bei kuenftigen Ausfuehrungen jeweils mit eigenen Screenshots belegt werden.

### 2026-08-14 - Fehlende Xray-Screenshot-Anhaenge ergaenzen

- Status: ABGESCHLOSSEN.
- Ergebnis: Die jeweils sechs Screenshots fuer KAN-817, KAN-826, KAN-829, KAN-832, KAN-835 und KAN-838 wurden als Jira-Anhaenge hochgeladen; insgesamt wurden 36 fehlende Nachweise ergaenzt.
- Verifikation: Jeder der sechs Vorgange zeigt jetzt sechs Dateianhaenge. KAN-899 wurde erneut geprueft und zeigt weiterhin `10 PASS`, `323 TO DO`, `333 Tests gesamt`.
- Sicherheit: Es wurden nur die bereits vorhandenen, nicht-sensiblen Screenshot-Dateien angehaengt; Testergebnisse und Shopdaten blieben unveraendert.

### 2026-08-14 - Xray-Nachweise KAN-820 reparieren

- Status: ABGESCHLOSSEN.
- Ursache: Die lokalen KAN-820-Screenshots waren noch vorhanden, wurden beim urspruenglichen Durchlauf aber nicht als Jira-Anhaenge an KAN-820 uebertragen. KAN-823 hatte dagegen sechs erfolgreiche Standard-Jira-Anhaenge.
- Korrektur: Die sechs KAN-820-Nachweise `S01_Ausgangslage`, `S02_Desktop`, `S02_Tablet`, `S02_Smartphone`, `S03_Kernaktion` und `S04_Ergebnis` wurden nachtraeglich an KAN-820 angehaengt.
- Verifikation: KAN-820 zeigt im Jira-Vorgang sechs Anhaenge und im Xray-Testlauf KAN-899 sechs Eintraege unter `Vorgangs-Anhänge zum Test`. KAN-899 bleibt bei `10 PASS`, `323 TO DO`, `333 Tests gesamt`.
- Sicherheit: Es wurden nur die fehlenden Screenshot-Anhaenge ergaenzt; keine Tests, Statuswerte, Kauf-, Zahlungs- oder Adminvorgaenge wurden veraendert.

### 2026-08-14 - Xray-Testausfuehrung mit Screenshot-Nachweisen

- Status: ABGESCHLOSSEN.
- Ziel: Zehn einfache, nicht-destruktive Xray-Testfaelle gegen `https://shop.brandycards.de` ausfuehren und je Testschritt Screenshot, Ergebnis und Befund dokumentieren.
- Rahmen: Keine echten Bestellungen, Zahlungen, Produktionsdaten- oder Admin-Schreibvorgaenge; keine Passwoerter, Tokens oder Zahlungsdaten in Screenshots speichern.
- Ergebnis: KAN-814, KAN-817, KAN-820, KAN-823, KAN-826, KAN-829, KAN-832, KAN-835, KAN-838 und KAN-841 wurden ausgefuehrt und als PASS gebucht.
- Nachweise: 60 Screenshots erstellt (je Test Start, drei Viewports, Aktionsschritt und Ergebnis) und an den jeweiligen Xray-Testvorgang angehaengt.
- Verifikation: KAN-899 serverseitig geprueft mit `10 PASS`, `323 TO DO`, `333 Tests gesamt`.
- Hinweis: KAN-823 benoetigte fuer den Produktdetailaufruf eine direkte, zuvor im DOM ermittelte Produkt-URL, da der sichtbare Link im aktuellen Viewport nicht klickbar war; der Detailinhalt wurde anschliessend geprueft.
- Sicherheit: Keine Kauf-, Zahlungs- oder Admin-Schreibvorgaenge ausgefuehrt. Die vollstaendige Suite mit 333 Tests ist nicht abgeschlossen; 323 Tests bleiben bewusst `TO DO`.

### 2026-08-13 - Jira-Epics per CSV importieren

- Status: ABGESCHLOSSEN.
- Ergebnis: Eine UTF-8-CSV mit neun Epics erstellt und über Jira's CSV-Importer in das bestehende Projekt KAN importiert. Der Importbericht bestätigt "0 Projekte und 9 Vorgänge erfolgreich importiert".
- Verifikation: Die JQL-Abfrage `project = KAN AND issuetype = Epic` zeigt KAN-1 bis KAN-9 mit den erwarteten Zusammenfassungen.
- Rahmen eingehalten: Keine User Stories, Tasks oder Tests angelegt; bestehende Vorgänge nicht verändert oder gelöscht.

### 2026-08-12 - Gastcheckout ohne Kundenkonto

- Auftrag: Käufe ohne Registrierung oder Login ermöglichen, mit PayPal,
  Lieferadresse und Bestellbestätigungs-E-Mail.
- Umsetzung: Bestellanlage, PayPal-Start, Capture und Reservierungsfreigabe
  akzeptieren nun entweder die bestehende Kontositzung oder eine Gastbestellung.
  Gastbestellungen werden per E-Mail und zufälliger Bestell-ID zugeordnet;
  Preise, Bestand, Reservierungslimit, eBay-Bestandsprüfung und PayPal-Capture
  bleiben serverseitig verbindlich.
- Oberfläche: Der Checkout erklärt die Gastzahlung und fragt nur die E-Mail
  für die Bestellbestätigung ab; ein Kundenkonto und Login sind nicht nötig.
- Prüfung: TypeScript erfolgreich, Lint ohne Fehler (eine bestehende Hook-Warnung
  in `app/account/page.tsx` bleibt), Build und 356 Tests erfolgreich.
- Stand: ABGESCHLOSSEN.

### 2026-08-11 - Neuer BrandyCards-Flyer im Graded-Sports-Card-Look

- Auftrag: Einen neuen Flyer entwickeln, der wie eine gegradete Sportkarte in
  einer Schutz-Slab wirkt; Vorder- und Rueckseite als zusammenhaengender Satz.
- Ergebnis: Eine eigenstaendige A5-PDF mit zwei Seiten sowie zwei gerenderte
  PNG-Vorschauen erstellt. Das Original-Logo ist auf beiden Seiten eingebettet.
- Gestaltung: Slab-Rahmen, Schraubpunkte, oberes BrandyCards-Ident-Label,
  BC-GRADE-10-Badge, Holo-Diagonalen, Kartenfenster, Seriennummer, Barcode,
  Collector-Score und QR-CTA. Fremde Grading- oder Sportmarkenlogos wurden
  nicht kopiert.
- Eine erste Koordinatenfassung hatte versehentlich einzelne mm-/Punktwerte
  vermischt; das wurde vor der Abnahme korrigiert und neu gerendert.
- Technische QA: 2 A5-Seiten, Text innerhalb der Seiten, Logo-Rasterbild auf
  beiden Seiten, URL/E-Mail/CTA vorhanden, PNGs in 933 x 1323 px. Ergebnis:
  PASS.
- Stand: ABGESCHLOSSEN.

### 2026-08-11 - Ausdrucksstaerkeres American-Sports-Logo fuer BrandyCards

- Auftrag: Die bisherige Sportlogoidee aus der Corporate-Minimal-Richtung herausentwickeln und mehr Charakter, Layer und Dynamik zulassen.
- Ergebnis: Drei ausdrucksstaerkere Sports-Richtungen und eine Zwischenstufe erzeugt. Die staerkste Variante nutzt zwei gespiegelt gesetzte B-Haelften in Navy und Rot, verbunden durch eine gemeinsame Blitz-/Fugenform, eine einzelne Badge-Kontur und eine varsity-inspirierte Wortmarke.
- Beurteilung: Mehr Team- und Bruedercharakter sowie sichtbare Sportenergie, ohne direkte Portraets, Maskottchen, Ballclipart oder eine zufaellige Dekorationssammlung.
- Status: Vorschau abgeschlossen; keine Website-Integration und keine finale Produktionsvektorisierung vorgenommen.

### 2026-08-11 - Cleanes American-Sports-Logo fuer BrandyCards

- Auftrag: Die abstrakte Zwei-Brueder-Idee mit moderatem American-Basketball-/Football-Charakter weiterentwickeln.
- Ergebnis: Drei sportlichere Logo-Richtungen und eine gezielte Verfeinerung erzeugt. Die beste Richtung nutzt zwei gleichwertige, gespiegelt gesetzte B-Haelften mit gemeinsamer Mitte und varsity-inspirierter Wortmarke.
- Gestaltung: Navy, Brick Red, Warmweiss und nur sehr sparsam Gold; Team-Badge-Energie ohne Maskottchen, Portraet, Ballclipart, Banner oder ueberladene College-Rahmung.
- Status: Vorschau abgeschlossen; keine Website-Integration und keine finale Produktionsvektorisierung vorgenommen.

### 2026-08-11 - Abstraktes Bruederzeichen fuer BrandyCards

- Auftrag: Die direkte Portraetuebernahme verwerfen und nur abstrakt auf zwei Brueder sowie Sammelkarten verweisen.
- Ergebnis: Drei neue vectorfreundliche Logo-Konzepte ohne Gesichter, Caps, Baerte oder Figuren erzeugt. Die Bruederreferenz kommt ueber zwei gleichwertige, leicht unterschiedliche Formen und eine gemeinsame Verbindung; die Kartenreferenz nur ueber reduzierte Kanten/Ecken.
- Beurteilung: Konzept 2 ist am klarsten als gemeinsames Zeichen aus zwei eigenstaendigen Teilen; Konzept 3 traegt den staerksten Sammelkartenhinweis; Konzept 1 ist am markantesten, aber naeher an der Kartenkante.
- Status: Vorschau abgeschlossen; keine Website-Integration und keine finale Produktionsvektorisierung vorgenommen.

### 2026-08-11 - Gruenderportraet ins BrandyCards-Logo integriert

- Auftrag: Die zwei Maenner aus dem bestehenden Logo mit Cap und Bart behalten, aber die Marke von Schild-, Banner- und Stern-Dekoration loesen.
- Ergebnis: Das Originalbild wurde unveraendert als Referenz genutzt. Drei neue Integrationsrichtungen und eine gezielte Verfeinerung wurden als preview-only Rasterkonzepte erzeugt.
- Beurteilung: Die reduzierte, rahmenlose Doppelportraet-Variante ist am staerksten. Sie bewahrt die persoenliche Wiedererkennbarkeit und wirkt deutlich ruhiger als das bestehende Wappen.
- Status: Vorschau abgeschlossen; noch keine finale Produktionsvektorisierung oder Website-Integration. Original-Logo im Repository blieb unveraendert.

### 2026-08-11 - Drei neue beidseitige BrandyCards-Flyer

- Auftrag: Drei Flyer von Grund auf neu entwickeln, jeweils mit Vorder- und
  Rueckseite; fruehere Flyer ausdruecklich nicht als Gestaltungsvorlage nutzen.
- Ergebnis: Drei eigenstaendige A5-Flyer als zweiseitige PDFs erstellt:
  "Die Karte, die du suchst" (editorial), "Karten, die bleiben" (Archiv /
  Premium) und "Siehst du die Luecke?" (energetisch Buy/Sell/Trade).
- Das vorhandene Original-Logo wurde in alle sechs Seiten unveraendert als
  PNG eingebettet. Je PDF liegen Vorder- und Rueckseite vor; sechs PNG-
  Vorschauen wurden aus den finalen PDFs gerendert.
- Technische QA: 3 PDFs mit je 2 A5-Seiten, Text innerhalb der Seitenrahmen,
  Logo-Rasterbild auf allen Seiten, URL und E-Mail in allen Flyer-Saetzen,
  sechs PNGs in 933 x 1323 px. Ergebnis: PASS.
- Stand: ABGESCHLOSSEN.

### 2026-08-11 - Logo-Exploration fuer BrandyCards

- Auftrag: Mehrere reduzierte Logo-Richtungen fuer das Zwei-Brueder-Sammelkartenunternehmen BrandyCards entwickeln.
- Ergebnis: Drei visuelle Konzeptvorschauen wurden erzeugt. Die zwei staerksten Richtungen wurden anschliessend als transparente SVGs nachgebaut:
  `app/brand/brandycards-logo-concept-twin-corners.svg` und
  `app/brand/brandycards-logo-concept-bc-monogram.svg`.
- Gestaltung: Deep Ink Navy, Brick Red und Warmweiss; flache Geometrie, klare Wortmarke, keine 3D-/Gloss-Effekte und keine dekorative Ueberladung.
- Hinweis: Die Dateien sind eigenstaendige Konzeptlogos und noch nicht in der Website verdrahtet. Die Rastervorschauen bleiben preview-only ausserhalb des Repositories.
- Lokal committed als `ef7dbc5`; ein Push auf `main` wurde wegen fehlender ausdruecklicher Freigabe fuer die gemeinsame Standard-Branch nicht ausgefuehrt.

### 2026-08-10 — Aufmerksamkeitsstärkere Impact-Flyer erstellt

- Die Rastervarianten A und B mit größeren Headlines, härteren Kontrasten,
  kräftigeren roten Flächen und dynamischeren Diagonalen weiterentwickelt.
- Informationshierarchie, Ausrichtung und Lesbarkeit beibehalten.
- Beide Impact-Versionen als PNG und zweiseitige PDF gerendert und visuell
  geprüft.

### 2026-08-10 — Zwei vollständig neue, rasterbasierte BrandyCards-Flyer erstellt

- Alle bisherigen Flyer als gestalterische Grundlage verworfen.
- Zwei neue zweiseitige Varianten mit systematischem Raster, klarer Ausrichtung,
  ausreichend Weißraum, begrenzter Farbpalette und maximal zwei Schriftstilen
  umgesetzt.
- Neue Texte verwendet; Logo, QR-Code, Instagram-Hinweis und MESSE26-Rabatt
  korrekt integriert.
- HTML, PNGs und druckfähige PDFs erzeugt und visuell geprüft.

### 2026-08-10 — Eigenständigen Chrome-/Collector-Rahmen für Flyer erstellt

- Silbernen Mehrfachrahmen, kantige Ecken, rote Diagonalelemente und unteres
  Namensfeld als eigene Gestaltung umgesetzt.
- Bestehendes BrandyCards-Logo, QR-Code, Instagram-Hinweis und MESSE26-Rabatt
  eingebunden; die Referenz wurde nur als Stilvorlage genutzt.
- Vorder- und Rückseite als HTML, PNG und PDF erzeugt und visuell geprüft.

### 2026-08-10 — Chrome-Rahmen pixelgenau als Flyer umgesetzt

- Die vom Nutzer freigegebene Referenz wurde unverändert als Vorderseite
  übernommen; die Pixelprüfung ist erfolgreich.
- Eine passende Rückseite mit BrandyCards-Texten, QR-Code, Instagram-Hinweis
  und MESSE26-Rabatt wurde innerhalb des Rahmenaufbaus erstellt.
- Vorder- und Rückseite wurden als PNG und zweiseitige PDF erzeugt und visuell
  geprüft.

### 2026-08-10 — Vier eigenständige Flyer aus Sammelkarten-Designprinzipien entwickelt

- Vier neue Richtungen erstellt: G Premium Gold, H Dark Collector, I Red Power
  und J Future/Chrome.
- Die Referenzen wurden nur als visuelle Anregung für Farbwelt, Rahmen, Dynamik
  und Premium-/Collector-Anmutung verwendet; Topps-, Liga-, Vereins- und
  Spieler-Elemente wurden nicht direkt übernommen.
- Bestehendes Logo, QR-Code, Instagram-Hinweis und MESSE26-Rabatt bleiben
  enthalten.
- Je Variante wurden PNGs, HTML-Datei und zweiseitige PDF erzeugt; alle Seiten
  wurden visuell geprüft.

**N2 eBay-Notification-Endpoint und Order-Event umsetzen** — Stand: ABGESCHLOSSEN (2026-08-09)

- Einen öffentlichen `GET`/`POST`-Endpoint unter
  `/api/ebay/notifications` ergänzen. GET muss die eBay-Endpointprüfung
  beantworten; POST muss `X-EBAY-SIGNATURE` mit dem eBay-Public-Key prüfen.
- `ORDER_CONFIRMATION` idempotent verarbeiten: Listing-ID und Menge auf die
  lokale eBay-Karte abbilden, Bestand/Listing atomar deaktivieren und
  Wiederholungen über `notificationId` sicher abfangen.
- Die benötigten OAuth-Scopes `sell.fulfillment` und
  `sell.fulfillment.readonly` in den eBay-Consent aufnehmen. Keine unsignierten
  Benachrichtigungen und keine Produktionsdaten im Testlauf simulieren.
- Nach Codeprüfung committen, pushen, deployen und den Endpoint lesend prüfen.

- Alarmierung für fehlgeschlagene eBay-Syncs, endgültig fehlgeschlagene
  eBay-Outbox-Aufträge, PayPal-Webhook-Fehler und wichtige Mailfehler ergänzen.
- Fehlerzustände und Wiederholungen idempotent testen. Die offizielle eBay
  Notification API anschließend nur mit verifizierter Signatur anschließen;
  keine Produktionsdaten verändern.

- Eine zentrale Alarm-Mail an die Betreiberadresse ist jetzt an die relevanten
  Fehlerzustände angeschlossen. Retries bleiben bis zum endgültigen Zustand
  still; Alarmdetails werden begrenzt und HTML-maskiert.
- Die eBay-Seller-Notification-Integration und der echte Verkauf auf einem
  laufenden Angebot bleiben offen, weil dafür eine eBay-Developer-Konfiguration
  mit verifizierter Signatur und eine Betreiberaktion erforderlich sind.
- Verifikation abgeschlossen: 330 Tests, `npx tsc --noEmit`, `npm run lint`,
  Build und `git diff --check` waren erfolgreich. Commit `bc5b2b5` ist nach
  GitHub gepusht. Der produktive Cloudflare-Worker wurde auf
  `https://shop.brandycards.de/` deployt; Startseite antwortet mit HTTP 200,
  der signaturlose POST mit HTTP 412. Die Challenge antwortet bis zum Setzen
  des noch fehlenden Verification-Secrets erwartungsgemäß mit HTTP 503. Es
  wurden keine Produktionsdaten geschrieben.

- `/api/admin/orders` paginiert jetzt mit 25 Einträgen, liefert Gesamtseiten
  und sortiert bei gleichen Zeitstempeln stabil. Ein geschütztes `PATCH` setzt
  nur `PAID`/`PROCESSING` auf `SHIPPED`; die Adminoberfläche bietet Blättern,
  deutsche Statuslabels und „Als versendet markieren“.
- `docs/ai-todo.md` ist auf den tatsächlichen Stand gebracht: Punkte 8, 9, 11,
  12 und A sind als erledigt dokumentiert; historische Planungen stehen in
  aufklappbaren Abschnitten. Die Apex-Weiterleitung wurde als Betreiberaktion
  vermerkt.
- Die ESLint-Warnung in `app/account/page.tsx` ist durch einen stabilen
  `useCallback`-Tokenzugriff behoben. Neun doppelte Englisch-Schlüssel wurden
  entfernt, damit `npx tsc --noEmit` wieder sauber läuft.
- `npx tsc --noEmit`, `npm run lint`, Build und `npm test` mit 317 Tests waren
  erfolgreich. Code-Commit `86afd8e` ist nach GitHub gepusht. Sites-Version 5
  (`appgver_3a8865f204a08191bc344ef751e9681d`) und Deployment
  (`appgdep_6a78a1ac03548191b6d196ed7433b341`) sind live; der Cloudflare-Worker
  läuft als `a431a800-8760-4d73-a6ac-0fe2694f8025`. `/admin` wurde live geladen
  und eine bezahlte Bestellung geöffnet, ohne den Status zu ändern.

**Galerie-CTA stabilisieren** — Stand: ABGESCHLOSSEN (2026-08-09)

- Galerie-Preis und CTA stehen jetzt in einer festen zweispaltigen Aktionsleiste:
  150px reservierte Preisspalte, 22px Abstand und 220px CTA-Spalte. Auch Karten
  ohne Festpreis reservieren die Spalte; mobil wird die Leiste einspaltig.
- Lokale DE/EN-Prüfung bestätigte dieselbe Buttonposition (`x = 852,6`) und
  220px Breite. Live wurden alle fünf Galerie-Karten in DE und EN geprüft:
  überall `x = 674,5` und 220px Breite.
- `npm run lint` (nur bestehende Warnung in `app/account/page.tsx`), `npm test`
  (315 Tests) und Build erfolgreich. Commit `fa958c7` nach GitHub gepusht.
- Sites-Version 4 gespeichert und deployed: `appgver_f85947ef73b4819186c48fecae4e48d5`,
  Deployment `appgdep_6a789bde29848191ba56839c8ef3095d`. Cloudflare-Worker
  deployed als `7522d72a-7bf4-41f4-a528-a75710a2c627` auf `shop.brandycards.de`.
  Keine Produktionsdaten geschrieben.

**Sprachlayout und vollständige Unterseitenprüfung** — Stand: ABGESCHLOSSEN (2026-08-09)

- Buttons und andere Bedienelemente sollen in Deutsch und Englisch dieselben
  Abmessungen behalten; Hero- und Footer-Positionen dürfen nicht durch
  unterschiedliche Textlängen springen.
- Fehlende Übersetzungen und gemischte Sprachreste auf Startseite, Galerie,
  Kartenbestand, Anfrage-, Ankauf-, Vorverkaufs-, Konto-, Checkout- und
  Rechtstextseiten werden ergänzt. Produktdaten aus dem Katalog bleiben
  unverändert.
- Native Datei-Inputs erhalten eine sprachabhängige eigene Bedienoberfläche,
  damit im Englischen keine deutschen Browsertexte sichtbar bleiben.
- Danach werden die öffentlichen Unterseiten in Deutsch und Englisch geprüft,
  Tests ausgeführt, committen, pushen und deployen. Keine Produktionsdaten
  schreiben.
- Ergebnis: Übersetzungen für die geprüften Seiten ergänzt, Datei-Upload im
  Ankauf übersetzt gestaltet, CTA-/Footer-Maße stabilisiert. Lokale Prüfung
  aller öffentlichen Seiten in DE/EN sowie `npm test` erfolgreich; keine
  Produktionsdaten geschrieben. Commit `957a1bf` ist auf GitHub `main` und im
  Sites-Quellrepository. Sites-Version 3 und Cloudflare-Worker-Version
  `43e0ed57-8a00-46dc-85d6-1955bfb2034e` sind erfolgreich deployed.

**Sites-Freigabe und Apex-Domain-Prüfung** — Stand: ABGESCHLOSSEN (2026-08-09)

- Die öffentliche Sites-Version 2 wurde mit dem aktuellen Repository-Stand
  veröffentlicht und die Zugriffsebene auf `public` gestellt. Erreichbar unter
  `https://brandycards-webshop.p-brand94.chatgpt.site`.
- `brandycards.de` leitet nicht weiter, weil `wrangler.toml` ausschließlich
  `shop.brandycards.de` als Custom Domain bindet. DNS-Einträge auf Cloudflare
  sind keine HTTP-Weiterleitung; für den Apex-Host existiert keine Redirect-
  Regel und der Aufruf endet aktuell vor der Anwendung mit Cloudflare HTTP 525.
  Eine 301-Regel für `brandycards.de/*` ist eine separate, noch nicht
  beauftragte Änderung.

**Englische Sprachversion** — Stand: ABGESCHLOSSEN (2026-08-09)

- Der Betreiber hat entschieden, den gesamten Kundenbereich zu übersetzen:
  Oberfläche, Formulierungen und Rechtstexte. Die Rechtstexte werden als
  fachlich geprüfte englische Fassung umgesetzt, nicht nur wortwörtlich in der
  Oberfläche ersetzt.
- Kartentitel und eBay-Beschreibungen bleiben deutsch, weil sie aus eBay
  kommen. Preise und Versandkosten bleiben in Euro.
- Die Sprache wird oben in der Kopfzeile über einen sichtbaren Schalter mit
  Flaggen zwischen Deutsch und English gewechselt. Die Wahl gilt gerätebezogen
  und bleibt beim Seitenwechsel erhalten.
- Abnahmekriterien: alle öffentlichen Seiten, Formulare, Statusmeldungen,
  Preisvorschläge, Checkout-Texte, Kontobereich und Rechtstexte haben beide
  Sprachfassungen; Produktdaten aus eBay bleiben unverändert deutsch; der
  Sprachschalter ist per Tastatur bedienbar und auf kleinen Bildschirmen
  erreichbar. Danach `npx tsc --noEmit`, `npm run lint`, `npm test`, committen,
  pushen, deployen und die Sprachumschaltung live prüfen. Keine
  Produktionsdaten schreiben.
- Ergebnis: DE/EN-Schalter in der Kopfzeile mit Flaggen und Geräte-Persistenz;
  öffentliche Seiten, Formulare, Konto, Checkout, PayPal-Rückläufe und
  Rechtstexte verwenden die englische Fassung. Kartentitel und eBay-
  Beschreibungen bleiben deutsch, Preise und Versandkosten bleiben in Euro.
- Verifikation: npx tsc --noEmit, npm run lint (0 Fehler), npm test
  (315/315) und der zusätzliche Sprachtest grün. Nach einem Laufzeitfix für
  die clientseitigen Rechtstexte ist `cc7cc18` auf `main` und
  `agent/initial-brandycards` gepusht und als Cloudflare-Version
  `994b91c1-a40d-4f83-a680-7b46bde3a17d` und zuletzt
  `46e28b24-6603-4332-929d-fba28e0e96cf` auf `shop.brandycards.de` deployed.
  Die öffentlichen Shop-Routen und `/api/products` antworten live mit HTTP
  200. Es wurden keine Produktionsdaten geschrieben. Das zusätzliche Sites-
  Projekt ist angelegt und eine Version gespeichert; die öffentliche Sites-
  Veröffentlichung wartet auf eine separate Freigabe für diese neue
  öffentliche Zieladresse.

### **Der Betreiber muss zwei Dinge selbst prüfen**

1. ~~**Eine erste Karte von Hand einstellen**~~ — **erledigt am 2026-08-09.**
   Der Kauf-, Zahlungs- und Bestandsdurchstich ist abgeschlossen; die manuelle
   Karte wurde verkauft, bezahlt und als `SOLD` verbucht.
2. **Den eBay-Anschluss einmal neu verbinden**, sobald ohnehin ein neuer
   Refresh-Token fällig ist: Der Token steht jetzt **nicht mehr** auf der
   Rückkehrseite, sondern erscheint genau einmal im Adminbereich. Wer die Seite
   neu lädt, bekommt ihn nicht wieder — dann „eBay OAuth verbinden" erneut
   starten.

**Eine Abnahme steht noch aus, die nur der Betreiber machen kann:** Die neue
Bestellansicht in `/admin` ist deployed, aber **hinter der Anmeldung** — von
außen ist nur belegt, dass `/api/admin/orders` ohne Token mit 401 antwortet und
`/admin` sauber lädt. Ob die Liste die Bestellungen richtig zeigt, sieht erst,
wer als Admin eingeloggt ist. Erwartet wird mindestens
`BC-20260808-89309FCA` mit Status `PAID` und der PayPal-Capture-Id
`1LC23949C0153504L`.

Zwei Entscheidungen hat der Betreiber am selben Tag ausdrücklich vertagt:
**PayPal-Gebühren** („gerade erstmal egal") und die **Bestandsprüfung**
(„erstmal so lassen" — sie lässt bei eBay-Ausfall weiterhin durch). Beides ist
keine offene Aufgabe, sondern eine getroffene Entscheidung.

---

## Stand nach der zweiten Sitzung vom 2026-08-08

**Der Shop nimmt seit heute echtes Geld ein.** `PAYPAL_ENVIRONMENT` steht auf
`production`, deployed als Version `4a6b7a46`. **Die Abnahme ist erfolgt:**
Bestellung `BC-20260808-89309FCA` über 3,46 € steht auf `PAID`, die Zahlung auf
`CAPTURED` (`1LC23949C0153504L`), der Bestand auf `SOLD`, die Webhook-Zeile auf
`PROCESSED`, und die Bestellbestätigung ist angekommen. Der 1-Cent-Testartikel
hat seinen Zweck erfüllt und wird vom Import abgeräumt.

In dieser zweiten Sitzung fertig geworden, alles deployed und in Produktion
nachgeprüft:

- **ai-todo Punkt 0 — PayPal auf Live** (`4a6b7a46`). Ein Test in
  `tests/hardening.test.mjs` verhindert den stillen Rückfall auf `sandbox`.
- **ai-todo Punkt 2 — der Sync schreibt nur noch Änderungen** (`6f33f7f1`).
  An der Produktion gemessen: **0 statt 294** wirkungslose Schreibvorgänge je
  Lauf, ein `sync_events`-Eintrag statt 294, Katalog unversehrt.
- **ai-todo Punkt 5 — der Checkout zeigt den ausgehandelten Preis**
  (`b6c73b8e`). Die Preisregel steht einmal in `lib/offer-price.ts` und wird von
  Anzeige **und** Abrechnung benutzt.
- **ai-todo Punkt 4a — CSP ohne `'unsafe-inline'`** (`d230f425`). An beiden
  Enden gemessen: derselbe `<img onerror=…>` läuft gegen die alte Regel und wird
  gegen die neue abgewiesen.
- **Der Webhook-Dublettenpfad** (`e204d3d7`): kein Ausgang mehr, der an der
  Buchführung vorbeiführt.
- **Der Testartikel** wurde vom 08:00-Lauf ohne Zutun abgeräumt und danach für
  den Live-Abnahmekauf mit 1 Cent reaktiviert.

~~**Noch offen, aber terminiert:** `ZEILEN_JE_LAUF` und der Cron-Takt.~~
**Erledigt am 2026-08-08**, und ohne auf den 2026-08-09 warten zu müssen: Ein
Fenster von einer Stunde enthält genau einen Lauf und ist damit frei von
Läufen vor dem Deploy. Takt steht auf `*/3 * * * *`; der Test misst jetzt die
**eBay**-Grenze statt eines Gratis-Tarif-Budgets, das es hier nicht mehr gibt.
Siehe den Eintrag „Import-Takt auf 3 Minuten" unter Historie.

<details><summary>Stand am Ende der <b>ersten</b> Sitzung vom 2026-08-08, zur Nachvollziehbarkeit</summary>

**Alles ist committet, gepusht und deployed.** `main` und
`agent/initial-brandycards` stehen auf demselben Commit, CI grün, Produktion
auf Version `9a2d28f2`. Kein Auftrag steht auf `LÄUFT`.

**In dieser Sitzung fertig geworden:**

- **Kunden-E-Mails (ai-todo Punkt 3) — gebaut, scharf und belegt.** Alle fünf
  Anlässe. Resend ist eingerichtet, Domain verifiziert, `RESEND_API_KEY` liegt
  als Secret. Zwei Anlässe sind durch **echte Zustellung** nachgewiesen
  (Anfragebestätigung, Bestellbestätigung), die übrigen drei durch Tests.
- **Warenkorb:** Karten lassen sich wieder herausnehmen (Umschalter).
- **`/karten` blättert** mit 10/20/50/100 je Seite, Zustand in der URL.
- **Schriften und Logo** kommen aus dem Build mit Inhalts-Hash und
  `immutable`; Logo von 730 KB auf 30 KB.
- **Texte:** keine Gedankenstriche mehr, durchgängig „Sportkarten",
  Seitentitel „BrandyCards — Sports Cards".
- **Banner:** Kartengrafik und Überschrift sind nicht mehr markierbar.
- **Zwei eigene Fehler gefunden und behoben:** der verworfene
  Tailwind-Import (war Stunden live) und ein roter CI-Lauf durch die
  Node-22-Falle mit `AbortSignal.timeout()`.

**Was als Nächstes ansteht:** siehe [ai-todo.md](ai-todo.md). Der neue Punkt 0
(PayPal auf Live) steht dort ganz oben und schlägt alles andere — solange er
offen ist, kann der Shop kein Geld einnehmen.

### Diese drei Punkte lagen beim Betreiber — **alle drei sind erledigt**

1. ~~**PayPal auf Live umstellen.**~~ Erledigt am 2026-08-08: Live-App,
   Live-Webhook und die drei Secrets vom Betreiber, `PAYPAL_ENVIRONMENT` von
   der KI, deployed als `4a6b7a46`. **Der echte Abnahmekauf ist inzwischen
   erfolgt** (`BC-20260808-89309FCA`), siehe oben.
2. ~~**Testartikel entfernen.**~~ Der 08:00-Lauf hat es selbst getan; danach
   wurde der Artikel für den Abnahmekauf bewusst wieder aktiviert.
   **Der Hinweis, schreibende D1-Befehle würden abgelehnt, ist überholt** —
   um 08:2x liefen sie von der KI aus anstandslos durch.
3. ~~**Webhook-Dublettenpfad.**~~ Erledigt am 2026-08-08, deployed als
   `e204d3d7`.

</details>

---

## Offene Punkte

Kein Auftrag, sondern der Zustand, den die nächste Sitzung kennen muss.
Geplante Arbeit steht dagegen in [ai-todo.md](ai-todo.md), die offenen
Sicherheits- und Funktionsbefunde im
[Prüfbericht vom 2026-08-09](pruefbericht-2026-08-09.md).

> **Am 2026-08-09 gegen den tatsächlichen Zustand durchgesehen.** Dieser
> Abschnitt hatte einen Tag lang in Rot behauptet, der Shop könne kein Geld
> einnehmen, und nannte einen Cron-Takt, eine CSP und einen Deploy-Stand von
> vorgestern — während dieselbe Datei weiter oben schon das Gegenteil sagte.
> **Die Lehre daraus, für alle, die hier abhaken:** Ein erledigter Punkt gehört
> in die Historie, nicht in eine korrigierte Fassung an derselben Stelle. Was
> hier stehen bleibt, muss der Zustand von *jetzt* sein — sonst liest die
> nächste Sitzung eine Warnung, die es nicht mehr gibt, und übersieht darüber
> die, die es gibt.

- ~~**Auf schmalen Geräten gibt es keine Hauptnavigation.**~~ **Erledigt am
  2026-08-07:** Burger-Menü gebaut, deployed als `fc35c017`. `.main-nav` bleibt
  unter 850 px ausgeblendet, die Navigation übernimmt dort die Schaltfläche in
  der Kopfzeile. Der Kontolink steht weiterhin daneben in der Leiste und
  **nicht** zusätzlich im Menü — zwei Wege zum selben Ziel sind eine
  Fehlerquelle, keine Hilfe.
- **Dauerfreigabe, am 2026-08-07 zuletzt auf Commits und Pushes ausgeweitet:**
  „Immer committen, pushen und deployen, ohne mich zu fragen." Ein `git push`
  und ein `npx wrangler deploy` nach grüner Prüfkette
  (`tsc`, Lint, `npm test`, Bundle-Probe) brauchen **keine** Einzelrücksprache
  mehr — auch nicht am Ende einer Sitzung, in der nur Oberfläche geändert
  wurde. **Nicht** eingeschlossen und weiterhin abzusprechen: schreibende
  Eingriffe in Produktionsdaten, Migrationen, Änderungen am eBay-Angebots-
  bestand und alles, was Kosten oder Fremddienste hinzufügt.
  **Deployed wird aus dem Hauptverzeichnis, nie aus einem Worktree** — dorthin
  wird `.env.local` nicht vererbt.
- **Frische Installationen sind kaputt, und das trifft jeden.** `npm ci`
  blockiert seit einer npm-Neuerung die Installationsskripte; `workerd` und
  `esbuild` bleiben dadurch unvollständig, und `npm run dev` stirbt beim Start
  mit „The Workers runtime crashed unexpectedly". Behelf:
  `npm install-scripts approve workerd esbuild sharp unrs-resolver && npm rebuild`.
  **Erledigt und überholt:** Das Feld `allowScripts` steht seit Commit
  `c4abc9c` in der `package.json`, der Betreiber hat die Freigabe also
  eingecheckt. Ein frisches `npm ci` bringt `workerd` seitdem vollständig mit;
  am 2026-08-07 in einem leeren Worktree nachgeprüft — `npm install-scripts
  approve` meldete „Nothing to approve", und `npm run dev` startete. **Diese
  Stelle behauptete bis dahin das Gegenteil.**
- **Der GitHub-Deploy-Workflow liegt bereit, ist aber bewusst nicht scharf.**
  [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) ist fertig;
  der Betreiber hat am 2026-08-07 entschieden, die drei Secrets **vorerst
  nicht** anzulegen („ist mir jetzt zu viel Arbeit"). Der Workflow schadet
  nicht: Er läuft nur auf Knopfdruck und bricht ohne Secrets mit einer klaren
  Meldung ab, statt etwas Halbes auszuliefern. Wer ihn später scharf schalten
  will, findet die Anleitung in
  [security-findings.md](security-findings.md) unter „Alternativ: Deploy über
  GitHub". **Deployed wird bis dahin lokal mit `npx wrangler deploy`.**
- **Wenn der Arbeitsrechner verloren geht** — das war der Anlass für den
  Workflow, und es ist harmloser als befürchtet. Am 2026-08-07 nachgemessen:
  Ein Produktionsbuild braucht aus `.env.local` **nur zwei Werte**,
  `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Ein
  Build allein damit lief durch und bestand die Bundle-Probe. Beide stehen im
  Supabase-Dashboard unter *Project Settings → API* und sind ohnehin
  öffentlich — sie werden an jeden Browser ausgeliefert.
  Alles Übrige (`EBAY_*`, `PAYPAL_*`, `ADMIN_EMAILS`) liest der Worker zur
  Laufzeit aus den Cloudflare-Secrets und wird für einen Deploy **nicht**
  gebraucht. Wiederherstellung auf einem fremden Rechner ist also: Repository
  klonen, `npm ci`, zwei Zeilen `.env.local` schreiben, `npx wrangler login`,
  deployen.
- **Vor dem Push in die CI sehen, nicht nur auf die lokale Prüfkette.** Am
  2026-08-07 lief `npm test` lokal 130/130, während dieselbe Datei in CI elf
  Tests abbrach — **hier Node 24, in CI Node 22**. Ein Deploy ging auf grüner
  lokaler Kette raus, obwohl CI seit Stunden rot war. `gh run list --limit 3`
  kostet nichts und hätte es gezeigt.
- **Den Deploy-Stand hier nicht nachschlagen, sondern messen.**
  `npx wrangler deployments list` ist die einzige verlässliche Quelle; jede
  Aufzählung an dieser Stelle ist binnen Tagen falsch, und genau das ist ihr
  zweimal passiert. Stand 2026-08-09: Version `11c2dd57`. Was seit dem
  2026-08-07 durchgehend gilt: Das Rate-Limit hat seine Bindings, der Katalog
  wird am Rand zwischengespeichert, alle sechs Sicherheits-Kopfzeilen sind
  gesetzt, die CSP setzt durch. Nachprüfung in
  [security-findings.md](security-findings.md) unter „Deploy am 2026-08-07".
- **Der Import läuft alle drei Minuten.** Maßgeblich ist
  `crons = ["*/3 * * * *"]` in [wrangler.toml](../wrangler.toml) — das ist die
  Wahrheit, wenn eine Angabe hier ihr je widerspricht.
  **Der Weg dorthin war ein Umweg, und er ist lehrreich:** Am 2026-08-07 lief
  der Takt für wenige Stunden auf 10 Minuten und wurde am selben Tag
  zurückgenommen (`2557ca3d`), weil ein Lauf damals ~5 396 Zeilen schrieb. Erst
  ai-todo Punkt 2 machte den Lauf billig — er schreibt jetzt nur noch, was sich
  geändert hat —, und **danach** war der schnelle Takt tragbar (`6f33f7f1`,
  2026-08-08). Ein schnellerer Takt ist also nie ein Cron-Ausdruck, sondern
  immer erst ein billigerer Lauf.
  **Gemessen je Lauf:** ~6 500 D1-Zeilen gelesen, **0 geschrieben**, ~9,8 ms
  Rechenzeit, 2 eBay-Aufrufe. Die begrenzende Größe ist **eBay**, nicht
  Cloudflare: 5 000 Trading-Aufrufe/Tag als gemeinsamer Topf für Sync,
  Beschreibungsabfrage, Bestandsprüfung und Rücknahmen;
  `tests/ebay-stock-check.test.mjs` gesteht dem Sync bewusst nur die Hälfte zu
  und schlägt an, wenn jemand den Takt erhöht.
  **Folge, die man kennen muss:** Das Fenster für „auf eBay verkauft, der Shop
  weiß es nicht" ist damit klein, aber nicht null — geschlossen wird es an der
  Kasse durch die Bestandsprüfung, nicht durch den Import.
  `releaseExpiredReservations` hängt am selben Cron; eine abgelaufene
  Reservierung kommt nach 15–18 Minuten zurück, und der Checkout gibt die
  eigenen abgelaufenen Reservierungen ohnehin sofort frei.
- **Die Kontofläche im angemeldeten Zustand hat niemand geprüft.** Weder das
  Profilformular noch die Adminübersicht mit echten Zahlen — dafür wäre eine
  Anmeldung mit dem Passwort des Betreibers nötig. Die Gestaltung stammt
  vollständig aus den vorhandenen Regeln (`--paper`, `--ink`, `--line`,
  `--muted`, `#f8f6f1` wie `.form-card`), sollte also tragen; ein Blick lohnt
  trotzdem.
- **Schriften und Logo kommen aus dem Build, nicht aus `public/`.** Sie liegen
  als Quelle in `app/fonts/` und `app/BrandyCards_Logo_transparent.png` und
  landen mit Inhalts-Hash unter `/assets/`. **Das ist Absicht und kein
  Schönheitsfehler:** Nur gehashte Dateien bekommen
  `cache-control: max-age=31536000, immutable`; alles unter `public/` wird mit
  `max-age=0, must-revalidate` ausgeliefert und bei jedem Seitenaufruf neu
  angefragt (gemessen: 85 ms je Rundlauf). **Wer eine Schrift oder ein Bild
  ergänzt, legt sie deshalb nach `app/` und verweist relativ darauf** —
  `url('./fonts/…')` in der CSS, `import … from "./bild.png"` im TSX. Ein
  absoluter Pfad `/fonts/…` fasst Vite nicht an.
  **Achtung beim Bild-Import:** Er liefert ein Objekt `{src, width, height}`,
  keine Zeichenkette. `<img src={bild}>` bricht **still** zu `[object Object]`;
  richtig ist `src={bild.src}`. Begründung in `assets.d.ts`.
- 💶 **Der Shop nimmt echtes Geld ein, seit dem 2026-08-08.**
  `PAYPAL_ENVIRONMENT = "production"` steht in `[vars]` der
  [wrangler.toml](../wrangler.toml), die drei Secrets liegen bei Cloudflare.
  Abnahme: Bestellung `BC-20260808-89309FCA` über 3,46 € auf `PAID`, Zahlung
  `CAPTURED` (`1LC23949C0153504L`), Bestellbestätigung angekommen. Am
  2026-08-09 nachgemessen: drei Bestellungen, alle `PAID`, alle Zahlungen
  `CAPTURED`, alle Reservierungen `CONVERTED`.
  **Was davon zu wissen bleibt:** Der Rückfall auf `sandbox` ist **still** —
  fehlt der Wert oder steht dort etwas anderes als exakt `production`, sieht der
  Shop gesund aus und nimmt nichts ein. Genau das blieb vom 2026-08-06 bis zum
  2026-08-08 unbemerkt. Deshalb hält `tests/hardening.test.mjs` den Wert fest;
  wer ihn ändert, ändert dort mit.
  *(Diese Stelle behauptete bis zum 2026-08-09 in Rot das Gegenteil — ein Tag
  lang, nachdem das Geld bereits floss. Siehe F-06 im
  [Prüfbericht](pruefbericht-2026-08-09.md).)*
- **Eine Zeile in `webhook_events` steht auf `RECEIVED` und ist kein hängender
  Vorgang.** `WH-4MD290111R3948627-…` (`PAYMENT.CAPTURE.COMPLETED`,
  2026-08-08 06:10:22) ist ein Überbleibsel des Dublettenpfads, der bis
  `e204d3d7` vorzeitig ausstieg, bevor die Zeile auf `PROCESSED` gesetzt wurde.
  Die zugehörige Bestellung steht auf `PAID`, die Zahlung auf `CAPTURED` —
  **es fehlt nichts.** Wer nach hängenden Webhooks sucht, darf sich davon nicht
  in die Irre führen lassen.
  **Der Fehler dahinter ist behoben, eine Lücke bleibt:** Die Eingangsprüfung
  behandelt `RECEIVED` weiterhin wie `PROCESSED`. Stirbt eine Zustellung
  *nach* dem Einfügen der Zeile, aber vor der Verarbeitung, wird PayPals
  Wiederholung stumm abgewiesen. Das ist **S-02** im
  [Prüfbericht](pruefbericht-2026-08-09.md).
- ~~**Ein Testartikel liegt in Produktion**~~ — **erledigt.**
  `ec6c212e96332bdcc93612848694b907` („TESTARTIKEL BrandyCards, bitte nicht
  kaufen") steht seit dem Aufräumen des Imports auf `INACTIVE`, wie
  vorhergesagt: Er stand nicht mehr in der eBay-Aktivliste. Am 2026-08-09 in D1
  nachgesehen. **Der Nebenbefund von damals ist ebenfalls behoben** — Katalog
  und Detailseite lesen die Menge seit `lib/catalog-availability.ts` aus dem
  **Bestand**, nicht mehr aus dem Listing. *(Eine Ausnahme ist geblieben: die
  Startseiten-Galerie, siehe **F-01** im
  [Prüfbericht](pruefbericht-2026-08-09.md).)*
- **Die Schriften liegen im Repository und werden selbst ausgeliefert**
  (10 Dateien, 228 KB, Schnitte `latin` und `latin-ext`).
  Der frühere `@import` von Google Fonts wurde von der eigenen CSP blockiert —
  der Shop lief unbemerkt auf Ersatzschriften. **Wer eine Schrift, einen
  Schnitt oder ein Schriftgewicht ergänzt, muss die Datei mit einchecken**;
  ein neuer `@import` würde wieder still blockiert. Die CSP bleibt dafür
  unverändert eng (`font-src 'self' data:`).
- **Die CSP trägt für Skripte **kein** `'unsafe-inline'` mehr**, seit dem
  2026-08-08 (`d230f425`, ai-todo Punkt 4a). `worker/index.ts` erzeugt je
  Antwort einen Zufallswert und hängt ihn per `HTMLRewriter` jedem `<script>`
  an; Antworten, die kein HTML sind, bekommen `script-src 'self'`. Am
  2026-08-09 in Produktion gemessen:
  `script-src 'self' 'nonce-…'` auf `/`, `script-src 'self'` auf
  `/api/products`. **Ein Eventhandler in einem Attribut kann keinen Zufallswert
  tragen** — genau die Form von SEC-01 ist damit tot.
  **Zwei Dinge, die dabei bewusst so entschieden wurden:** kein
  `'strict-dynamic'` (es würde `'self'` unwirksam machen, ohne etwas zu
  gewinnen), und `style-src` behält `'unsafe-inline'`, weil React und vinext
  Inline-Stile setzen. Letzteres ist eine eigene, offene Aufgabe.
- **HSTS ist gesetzt**, als `max-age=31536000` **ohne** `includeSubDomains` und
  **ohne** `preload`. Rückweg, falls je nötig: `max-age=0` setzen und deployen —
  das funktioniert nur, weil `preload` fehlt.
- **Cloudflare-Tarif ist seit 2026-08-07 Workers Paid (5 $/Monat).** Damit sind
  die harten Tagesdeckel weg — D1 rechnet nach Verbrauch ab (25 Mrd.
  Lesevorgänge und 50 Mio. Schreibvorgänge im Monat inklusive). Ebenfalls
  dadurch entschärft: `Email Sending` ist verfügbar (Voraussetzung für Punkt 3
  in [ai-todo.md](ai-todo.md)), und die Grenze von 50 Unteranfragen je Anfrage
  ist auf 10 000 gestiegen. Letzteres betraf die Bestandsprüfung vor der
  Zahlung: Sie macht einen eBay-Aufruf je Karte, und bei 50 Karten wäre sie auf
  Free an die Grenze gestoßen.
- **Der hängende Sync-Lauf vom 2026-08-07 ist behoben** (Version `07da6e9b`,
  siehe Historie). Was davon zu wissen bleibt: Ein Lauf ist jetzt nach
  5 Minuten in jedem Fall beendet, und eine `RUNNING`-Zeile wird vom nächsten
  Cron-Schlag danach eingesammelt — ein Eingriff von Hand sollte nie wieder
  nötig sein. Bleibt der Import trotzdem stehen, ist die Ursache **nicht**
  mehr die Sperre und die Suche fängt woanders an.
- **Zwei Messfehler von mir an diesem Tag, damit sie sich nicht wiederholen:**
  1. `wrangler d1 insights` liefert standardmäßig nur die **Top 5** Abfragen.
     Das Flag heißt **`--limit`**, nicht `--count`. Mit `--limit 100` meldet die
     Datenbank 95 Abfragen — die ersten Zahlen waren dadurch deutlich zu
     niedrig.
  2. Ich schloss aus „der Aufräumvorgang schreibt nicht" auf „das
     Schreibbudget ist erschöpft". **Falsch** — ein Testschreibvorgang lief
     anstandslos durch. Der Import stand aus einem anderen Grund. Aus einem
     ausbleibenden Effekt auf eine Ursache zu schließen, ohne die Ursache zu
     prüfen, war der Fehler.
- **Der eBay-Token in der lokalen `.env.local` ist abgelaufen.** eBay lehnt ihn
  mit „invalid or was issued to another client" ab. **Produktion ist nicht
  betroffen** — dort liegt er als Cloudflare-Secret, und der Import läuft
  (09:00-Lauf: 294 aktualisiert). Folge ist nur, dass lokale Entwicklung nicht
  mit eBay sprechen kann und sich das API-Kontingent von hier aus nicht
  abfragen lässt. Beim nächsten OAuth-Durchlauf im Adminbereich mit erneuern.
- **Eine Nachschlagearbeit bleibt offen:** die Supabase-Passwortrichtlinie und
  Token-Laufzeit (*Authentication → Policies*). Über keinen öffentlichen
  Endpunkt lesbar; die Alternative wäre gewesen, mit schwachen Passwörtern
  Konten in der Produktions-Instanz anzulegen — deshalb unterlassen.
- ~~**Sync-Lauf nötig, damit „Neu dabei" echt wird.**~~ **Erledigt, am
  2026-08-07 an der Produktion nachgemessen:**
  `curl -s https://shop.brandycards.de/api/products/highlights` meldet
  `"startAtAvailable": true`. Die Sync-Läufe seit Version `a1cdd14f` haben
  `ebay_listings.start_at` gefüllt; „Neu dabei" zeigt echte Einstelldaten
  (06.08. 17:13, 17:09, 17:00, dann 04.08. 18:23), absteigend sortiert, statt
  der Importreihenfolge als Notbehelf.
- ~~**Preisvorschlag hat keine Oberfläche mehr.**~~ **Veraltet, korrigiert am
  2026-08-07:** `/api/price-offers` verlangt heute ein Produkt mit **aktivem
  eBay-Listing** und lehnt Auktionen ab, nicht `PRELISTED`
  (`app/api/price-offers/route.ts:34`). Das Formular existiert und ist auf der
  Kartendetailseite eingebunden (`app/karten/[id]/page.tsx:138`).
- ~~**CI hat den aktuellen `main` nie geprüft.**~~ **Erledigt am 2026-08-07:**
  `main` wurde auf `c4abc9c` vorgespult und zeigt damit auf einen Commit, dessen
  CI-Lauf grün war (130/130). `main` und `agent/initial-brandycards` stehen auf
  demselben Baum. **Deployt wird weiterhin aus `agent/initial-brandycards`** —
  das Hauptverzeichnis steht darauf ausgecheckt, und dort liegt `.env.local`.
- ~~**CI prüft keine Typen.**~~ **Erledigt am 2026-08-07:** Der Workflow führt
  jetzt `npx tsc --noEmit` aus, auditiert die Abhängigkeiten und pinnt seine
  Actions auf Commit-SHAs statt auf bewegliche Tags.
  **Lokal weiterhin selbst ausführen** — der Workflow läuft erst beim Push.
- **eBay-Schreibpfad ist unterbrochen.** `mapActiveListing` setzt `ebayOfferId`
  fest auf `null`, weil `GetMyeBaySelling` nur eine ItemID liefert. Dadurch bleibt
  die `ebay_outbox` ohne Auftrag und ein bezahlter Webshop-Kauf beendet das
  eBay-Angebot nicht. Entschärft nur durch `EBAY_WRITE_ENABLED=false`.
  **Maßgeblich für die Umstellung ist [ai-todo.md](ai-todo.md) Punkt 6:
  `ReviseInventoryStatus` mit Menge 0, nicht `EndItem`.** Ältere Stellen in
  dieser Datei und in [ai-agent-log.md](ai-agent-log.md) nennen noch
  `EndItem`/`EndFixedPriceItem` — das war der erste Gedanke und ist überholt;
  `EndItem` ist endgültig und bricht durch die neue ItemID die lokale Zuordnung.
  **Was in Punkt 6 fehlt und vorher zu klären ist:** „Umkehrbar" gilt für
  `ReviseInventoryStatus` nur, wenn im eBay-Konto die **Out-of-Stock-Option**
  aktiv ist. Ohne sie beendet eBay ein Festpreisangebot, dessen Menge auf 0
  fällt, von selbst — bei lauter Einzelstücken (Menge 1) also **immer**, und
  dann ist dieser Weg genauso endgültig wie `EndItem`. Zu prüfen über
  `GetUserPreferences` (`OutOfStockControlPreference`), bevor gebaut wird.
- **Migrationsjournal ist veraltet.** `drizzle/meta/_journal.json` endet bei
  `0002`, `0003`–`0006` kamen handgeschrieben dazu. `npm run db:generate` würde
  gegen den alten Snapshot diffen und die Migrationen erneut erzeugen. Vor dem
  nächsten Schemaschritt nachziehen — und bei der Gelegenheit **F-04** aus dem
  [Prüfbericht](pruefbericht-2026-08-09.md) mitnehmen
  (`description_fetched_at`), die einzige Aufgabe, die ohnehin auf eine
  Migration wartet.
- **Build braucht `.env.local`.** `NEXT_PUBLIC_SUPABASE_*` wird zur Buildzeit
  eingebacken. Ein Build ohne die Datei liefert ein Bundle aus, in dem `/admin`
  und `/account` mit „Supabase ist noch nicht konfiguriert" abbrechen, während der
  Rest gesund aussieht. Git-Worktrees erben die ignorierte Datei nicht. Details in
  der README unter „Before the first production deployment".

---

## Historie

### 2026-08-11 - Neuer BrandyCards-Flyer im Graded-Sports-Card-Look

- Auftrag: Einen neuen Flyer entwickeln, der wie eine gegradete Sportkarte in
  einer Schutz-Slab wirkt; Vorder- und Rueckseite als zusammenhaengender Satz.
- Ergebnis: Eine eigenstaendige A5-PDF mit zwei Seiten sowie zwei gerenderte
  PNG-Vorschauen erstellt. Das Original-Logo ist auf beiden Seiten eingebettet.
- Gestaltung: Slab-Rahmen, Schraubpunkte, oberes BrandyCards-Ident-Label,
  BC-GRADE-10-Badge, Holo-Diagonalen, Kartenfenster, Seriennummer, Barcode,
  Collector-Score und QR-CTA. Fremde Grading- oder Sportmarkenlogos wurden
  nicht kopiert.
- Eine erste Koordinatenfassung hatte versehentlich einzelne mm-/Punktwerte
  vermischt; das wurde vor der Abnahme korrigiert und neu gerendert.
- Technische QA: 2 A5-Seiten, Text innerhalb der Seiten, Logo-Rasterbild auf
  beiden Seiten, URL/E-Mail/CTA vorhanden, PNGs in 933 x 1323 px. Ergebnis:
  PASS.
- Stand: ABGESCHLOSSEN.

### 2026-08-10 — Zwei neue Messeflyer-Designrichtungen E und F erstellt

- Variante E ist ein kontraststarker Messe-Eyecatcher mit großer Typografie,
  dunklem Grund und dynamischen Farbflächen.
- Variante F ist sportlich-künstlerisch mit diagonalen Formen, einer starken
  typografischen Komposition und dynamischem Seitenrhythmus.
- Logo, QR-Code, Instagram-Hinweis und Rabattcode wurden beibehalten.
- Je Variante wurden PNGs, HTML-Datei und zweiseitige PDF erzeugt und visuell
  geprüft.

### 2026-08-10 — Flyer D als lebendigere Alternative zu Flyer C erstellt

- Die Vorderseite übernimmt die ruhige Flyer-C-Grundgestaltung und ergänzt
  einen klaren Dreierblock für **Kaufen**, **Sammeln** und **Verkaufen**.
- Die Rückseite bleibt im bewährten Aufbau mit Schritten, QR-Code, Rabatt und
  Kontaktmöglichkeiten.
- Zwei PNGs, eine HTML-Datei und eine zweiseitige PDF wurden erzeugt und
  visuell geprüft.

### 2026-08-10 — Flyer C QR-Feld luftiger gesetzt

- Der vertikale Abstand zwischen den vier QR-Zeilen wurde vergrößert.
- Schriftfamilie, Schriftgröße und Schriftstärke blieben unverändert.
- Flyer-C-PNG und PDF wurden neu gerendert und visuell geprüft.

### 2026-08-10 — Flyer C QR-Feld vollständig vereinheitlicht

- Alle vier Zeilen neben dem QR-Code nutzen jetzt identische Schriftfamilie,
  Schriftgröße, Schriftstärke und Zeilenhöhe.
- Nur die Farben unterscheiden sich noch zur Orientierung zwischen Hinweis,
  Frist, Rabatt und Code.
- Das Flyer-C-PNG und die zweiseitige PDF wurden neu gerendert und visuell
  geprüft.

### 2026-08-10 — Flyer C typografisch vereinheitlicht

- Für Flyer C ist die Schriftfamilie für alle Seitenelemente explizit auf
  Arial/Helvetica vereinheitlicht.
- Die vier Rabattzeilen im QR-Feld sind jetzt als gleichmäßig gesetzte
  Textblöcke mit konsistenten Zeilenhöhen und Abständen aufgebaut.
- Die beiden PNGs und die zweiseitige PDF wurden neu gerendert und visuell
  geprüft.

### 2026-08-10 — Flyer C aus Flyer-A-Vorderseite und Flyer-B-Rückseite erstellt

- Flyer C kombiniert die helle Vorderseite von Flyer A mit der Rückseite von
  Flyer B.
- Die Vorderseite nennt jetzt „Einzelkarten · Sammlungen · An- und Verkauf“.
- Das QR-Feld erklärt die Aktion kompakt: „Jetzt im Shop sparen“, „Bis zum
  20.09.2026“, „5 % Rabatt“ und „Code: MESSE26“.
- Zwei PNGs, eine HTML-Datei und eine zweiseitige PDF wurden erzeugt und
  visuell geprüft.

### 2026-08-10 — Flyer A als gemeinsames Layout für alle Seiten ausgebaut

- Flyer A wurde mit dem Zusatz „Für Sammler, Fans und alle, die eine Karte
  suchen.“ leicht erweitert, ohne die Seite zu überladen.
- Beide Flyer-Varianten nutzen jetzt dieselbe helle Farbwelt, dieselbe
  Typografie, denselben Footer und denselben grundsätzlichen Seitenaufbau.
- Das BrandyCards-Logo steht auf allen vier Seiten an derselben Stelle und ist
  einheitlich etwas größer skaliert.
- Die vier PNG-Vorschauen und beide zweiseitigen PDFs wurden neu gerendert und
  visuell geprüft.

### 2026-08-10 — Messeflyer ruhiger überarbeitet

- Die bestehenden zweiseitigen A6-Flyer A und B wurden ruhiger gestaltet und
  enthalten jetzt den Hinweis, dass BrandyCards Sportkarten kauft und verkauft.
- Der Messevorteil ist eindeutig als **5 % Rabatt** mit **Code: MESSE26**
  formuliert. Neben den QR-Codes stehen nur diese Rabattinformationen.
- Instagram erscheint ausschließlich im unteren Banner und nutzt das vom
  Betreiber bereitgestellte Logo.
- Die vier PNG-Vorschauen und beide zweiseitigen PDFs im Ausgabeordner
  `C:\Users\pbran\.codex\visualizations\2026\08\10\019fead6-4dd9-7391-9e14-7946b66afd7f\brandycards-kurzflyer-ruhig`
  wurden neu gerendert und visuell geprüft.

### 2026-08-10 — Öffentliche Texte und Vorverkaufslink überarbeitet

- Die sichtbaren deutschen und englischen Texte auf Startseite, Kartenbestand,
  Anfrage, Vorverkauf, Konto, Versand und Datenschutz wurden sprachlich geglättet.
  Gedankenstriche sind aus diesen Texten und den Transaktionsmails entfernt;
  deutschsprachige Formulierungen stehen nicht mehr als Satzfragmente im Raum.
- Der Vorverkaufshinweis auf `/anfragen` ist in zwei kurze Absätze aufgeteilt.
  Der Link nutzt eine eigene Inline-Variante und bekommt dadurch weder eine
  überbreite Unterstreichung noch einen unschönen Zeilenumbruch auf Mobilgeräten.
- API-Fehlermeldungen für Benutzername und laufende Bestellungen folgen jetzt
  ebenfalls der gewählten Sprache. Die Angebotslogik und Preise bleiben
  unverändert.
- Verifikation: `npx tsc --noEmit`, `npm run lint`, `npm test` mit 353 Tests
  und `git diff --check` erfolgreich. Eine bestehende ESLint-Warnung in
  `app/account/page.tsx` bleibt.
- Commit `5141467` ist auf `main` und `agent/initial-brandycards` gepusht.
  Der produktive Worker läuft auf `shop.brandycards.de` mit Version
  `360aa5dc-d297-43ff-ba2d-0c966f19058a`. Sites-Version 20 ist unter
  `https://brandycards-webshop.p-brand94.chatgpt.site` veröffentlicht; beide
  Zielseiten antworten mit HTTP 200.

### 2026-08-10 — EU-Versandländer im Checkout erweitert

- Die bisherige Auswahlliste im Checkout enthielt nur sieben Länder, obwohl die
  Servervalidierung bereits die EU-Länder vollständig kannte.
- `lib/shipping-countries.ts` ist jetzt die gemeinsame Quelle für alle 27
  EU-Mitgliedstaaten. Deutschland wird weiterhin mit 3,45 € berechnet, die
  übrigen EU-Länder mit 14,49 €.
- Deutsche Länderbezeichnungen werden über die bestehende Sprachumschaltung auf
  Englisch angezeigt. Zwei Regressionstests prüfen die vollständige Liste.
- `npx tsc --noEmit`, `npm run lint`, `npm test` (352 Tests) und Build waren
  erfolgreich. Die vorbestehende ESLint-Warnung in `app/account/page.tsx` bleibt.

### 2026-08-10 — N8: Auffindbarkeit und Wartbarkeit

- Öffentliche Routen tragen jetzt kanonische URLs; Produktdetailseiten erzeugen
  dynamische Titel, Beschreibungen, Open-Graph-/Twitter-Metadaten und sichere
  schema.org-`Product`-Daten. Konto, Admin und Checkout sind `noindex`.
- `robots.txt` sperrt interne/API-Pfade. `sitemap.xml` verbindet die
  öffentlichen Seiten mit den 291 sichtbaren Produktseiten aus D1.
- README und Deploymentbeschreibung entsprechen dem produktiven Worker,
  `shop.brandycards.de`, dem Drei-Minuten-Cron und dem getrennten Sites-
  Preview. Next `16.3.0` beseitigt die Produktions-Audit-Warnungen;
  `npm audit --omit=dev` meldet 0 Schwachstellen. 15 Warnungen verbleiben nur
  in Entwicklungswerkzeugen mit teils Major-Upgrades.
- Verifikation: TypeScript, Lint, Build und **350 Tests** erfolgreich.
  Live antworten `robots.txt`, `sitemap.xml` und Produktdetailseite korrekt;
  die Sitemap enthält 291 Produkt-URLs. Secret-Rotation ist laut Betreiber
  abgeschlossen. N2 bleibt der echte eBay-Verkauf mit Outbox-/Verkäufermail-
  Nachweis.

### 2026-08-10 — N7: Katalog und Vorverkauf ausgebaut; N4 geprüft

- Die Startseiten-Galerie verwendet jetzt einen Left-Join und nimmt manuelle
  Vorverkaufskarten nach derselben Bestandslogik wie der Katalog auf. Für diese
  Karten bleibt die Aktion Preis vorschlagen; es gibt keinen Festpreis und
  keinen direkten Warenkorbknopf.
- /api/products führt Suche im Titel/SKU/Beschreibung sowie Kategorie- und
  Preisfilter in D1 aus und liefert nur die angeforderte Seite. Der Checkout
  lädt konkrete Warenkorb-IDs, damit Karten außerhalb von Seite 1 nicht
  verschwinden. Die Vorverkaufsseite fragt manuelle Karten direkt ab.
- Build, Lint und **348 Tests** erfolgreich. Der erste produktive Smoke-Test
  zeigte zunächst einen leeren Katalog; die Sichtbarkeitsabfrage wurde danach
  auf eine explizite, NULL-sichere SQL-Bedingung korrigiert. Der anschließende
  Smoke-Test auf dem kanonischen Worker `shop.brandycards.de` lieferte 291
  sichtbare Karten, Seite 2 die Karten 11–20. Cloudflare-Version
  `21860ce5-47ae-4273-b705-3dba1da4cf30` ist deployed; Sites-Version 17 ist
  ebenfalls gespeichert und deployed. Die separate Sites-URL hat keine
  befüllte D1-Produktionsbindung und ist daher nicht der kanonische Shop.
  N4-Prüfung: In Repository,
  `.env.local` und Cloudflare-Konfiguration existiert kein Offsite-Ziel,
  Upload-Endpunkt oder Backup-Secret. N4 bleibt daher bewusst teilweise
  erledigt, bis der Betreiber Ziel, Verschlüsselung, Aufbewahrung und
  Alarmierung festlegt.

### 2026-08-10 — N6: Sprache und Transaktionskommunikation

- `users.preferred_locale` ergänzt und mit `drizzle/0008_user_preferred_locale.sql`
  produktiv migriert. Die Sprachwahl wird über den Profilendpunkt gespeichert,
  auf weiteren Geräten geladen und bleibt als Browserfallback erhalten.
- Kunden- und Verkäufermails unterstützen Deutsch und Englisch für Bestellung,
  Versand, Erstattung, Preisvorschläge, Anfragen, Kartenangebote und
  Kontolöschung. Öffentliche Formulare übernehmen die aktuelle Sprachwahl;
  Admin- und Betriebsalarme bleiben bewusst deutsch.
- Katalogdaten, insbesondere Kartentitel und eBay-Beschreibungen, bleiben
  unverändert. Die Kontoauskunft enthält die gespeicherte Sprache.
- Verifikation: 346 Tests, `npx tsc --noEmit`, Build und Lint erfolgreich.
  Produktiv antworten `/`, `/account` und `/admin` mit HTTP 200;
  `/api/account/profile` ohne Sitzung mit HTTP 401. Die neue D1-Spalte ist
  remote vorhanden. Sites-Version 15 wurde unter
  `https://brandycards-webshop.p-brand94.chatgpt.site` erfolgreich deployed.
- Commit `f3d0efdd8fdba3f492caa86fa78bc31572eedfce` ist nach GitHub, den
  Sites-Quellbranch und in Produktion gebracht.

### 2026-08-10 — N5: Kundenkonto und Versandabwicklung

- Bestellhistorie im Kundenkonto ergänzt. Die Route liest ausschließlich die
  Bestellungen der authentifizierten eigenen `user_id`; unauthentifizierte
  Anfragen antworten produktiv mit HTTP 401.
- Aufträge tragen jetzt `shipped_at`, `shipping_carrier`, `tracking_number`,
  `completed_at`, `cancelled_at` und `refunded_at`. Die Migration
  `drizzle/0007_order_fulfillment.sql` wurde nach Freigabe auf
  `brandycards-production` angewendet; bestehende Daten blieben unverändert.
- Versandstatus, Abschluss, Storno vor Zahlung und vollständige PayPal-
  Erstattung sind als MFA-geschützte Adminpfade umgesetzt. Storno gibt offene
  Reservierungen frei; Erstattungen reaktivieren Bestand und eBay-Angebote
  bewusst nicht automatisch, bis eine Retoure geprüft wurde.
- Versand- und Erstattungsbestätigungen, bekannte Trackinganbieter und
  sichere Trackingnummern sind ergänzt. `COMPLETED` wird nach `SHIPPED`
  fachlich verwendet.
- Verifikation: `npx tsc --noEmit`, `npm run lint`, Build und `npm test`
  mit 343 Tests erfolgreich. Produktiv antworten `/`, `/account` und `/admin`
  mit HTTP 200; `/api/account/orders` ohne Sitzung mit HTTP 401. Sites-Version
  13 (Code) und anschließend Version 14 (synchronisierte Dokumentation) wurden
  unter `https://brandycards-webshop.p-brand94.chatgpt.site` erfolgreich
  deployed.
- Der Code-Commit `bef1f75f3bcfb3b7ad5772e934d11c34a51597aa` sowie der
  Dokumentationsstand `ff10cb060c30782c47d1b73b72109fa2b58c1d65` sind nach
  GitHub und in den Sites-Quellbranch gebracht; der Code ist produktiv.

### 2026-08-10 — Abgleich der drei gemeldeten eBay-Verkäufe

- **Obsidian:** eBay-Artikel `398174236865` hat eine `ORDER_CONFIRMATION`
  erhalten und steht auf `PROCESSED`; Listing `ENDED`, Restmenge 0,
  `quantity_sold` 1, Inventory `SOLD`.
- **Vieira:** eBay-Artikel `398249844242` hat keine Notification. Der
  Scheduled Sync hat das Listing um 20:43:05 UTC mit
  „Angebot nicht mehr in eBay-Aktivliste vorhanden“ deaktiviert. Restmenge 1,
  `quantity_sold` 0, Inventory `UNAVAILABLE`.
- **Mikey Moore:** Der zeitlich passende eBay-Artikel `398174236850` hat keine
  Notification. Der Sync hat ihn um 20:52:04 UTC aus demselben Grund
  deaktiviert; `quantity_sold` blieb 0. Ein anderer Mikey-Moore-Artikel
  (`398174220750`) blieb aktiv und ist deshalb nicht als der gemeldete Verkauf
  bestätigt.
- **Bewertung:** Für die zwei fehlenden Verkäufe liegt kein lokaler
  Verarbeitungsfehler vor; eBay hat keine `ORDER_CONFIRMATION` zugestellt. Der
  Fallback-Sync hat die Karten aus dem Shop genommen, kann aber ohne Notification
  keinen Verkauf verbuchen. Es wurden keine Produktionsdaten verändert.
- **Nächster Prüfpunkt:** Zustellhistorie und Subscription-Konfiguration in der
  eBay Developer Console für die beiden Artikel bzw. die entsprechende
  Bestellung prüfen. Eine manuelle D1-Korrektur oder ein erneutes eBay-Event
  wurde bewusst nicht simuliert.

### 2026-08-10 — Produktionsprüfung eBay-Notifications

- In der produktiven D1-Datenbank existiert insgesamt genau eine eBay-
  `ORDER_CONFIRMATION`: eingegangen am 2026-08-09 um 20:42:15 UTC für die
  eBay-Bestellung `12-15006-19207`, Artikel `398174236865`, Menge 1.
- Die Notification steht auf `PROCESSED`, ohne Fehler, ohne offene
  `RECEIVED`-Zeile und ohne Duplikat. Das Listing steht auf `ENDED`, Restmenge
  0 und `quantity_sold` 1; Produkt und Inventory stehen auf `INACTIVE` bzw.
  `SOLD`, verfügbar 0 und verkauft 1.
- Die eBay-Sync-Läufe der letzten Stunden sind erfolgreich; die vorhandene
  eBay-Outbox enthält keine offenen oder fehlgeschlagenen Jobs.
- **Auffälligkeit:** Der Betreiber meldete mehrere eBay-Verkäufe, in D1 ist
  bislang aber nur diese eine Notification gespeichert. Weitere Verkäufe sind
  daher entweder noch nicht von eBay zugestellt worden oder liegen außerhalb
  des aktuell gespeicherten Notification-Flusses und müssen bei eBay geprüft
  werden. Es wurden keine Produktionsdaten verändert.

### 2026-08-09 — N4: Datenschutz, Aufbewahrung und Wiederherstellung

- **Stand:** TEILWEISE ABGESCHLOSSEN. Die 30-Tage-Bereinigung für
  `payments.raw_data` und abgeschlossene `webhook_events.payload` läuft im
  Scheduled Worker. Zahlungs- und Ereignismetadaten sowie gesetzlich relevante
  Bestell-/Rechnungsdaten bleiben erhalten; die PayPal-Capture-Antwort gibt
  keine Rohantwort mehr aus.
- **Backup/Restore:** `scripts/backup-production.mjs` und
  `scripts/restore-backup.mjs` sind dokumentiert. Der Produktions-Backup-Test
  enthielt 543 Produkte, 4 Bestellungen, 4 Zahlungen und 7 Webhook-Ereignisse,
  0 fehlende R2-Objekte und 302 externe eBay-Bildquellen. Der lokale Restore
  stellte die D1-Zählwerte isoliert erfolgreich wieder her.
- **Verifikation:** 339 Tests, TypeScript, Lint, Build und `git diff --check`
  waren erfolgreich. Temporäre Backup-/Restore-Dateien mit Produktionsdaten
  wurden nach dem Test gelöscht.
- **Veröffentlichung:** Commit `2bc145c726e5308fd4c3e08e157d7eda803f4c49` ist
  nach `main`, `agent/initial-brandycards` und das Sites-Quellrepository
  gepusht. Cloudflare-Version `91fcec61-0c4c-49c3-876f-29084dfb4893` und
  Sites-Version 12 sind erfolgreich deployed. `/`, `/admin`, `/account`,
  `/api/products` und `/datenschutz` antworten produktiv mit HTTP 200.
- **Offen:** Für den vollständigen N4-Abschluss fehlen noch die Betreiber-
  entscheidung zu Zielsystem, Verschlüsselung, Token, Aufbewahrung und
  Alarmierung eines regelmäßig eingeplanten Offsite-Backups. Die technische
  Backup-Prozedur und der Restore-Nachweis sind vorhanden.

### 2026-08-09 — N3: Ausfallsicherheit, Ressourcenlimits und automatische Bereinigung

- **Umsetzung:** Der Scheduled Worker bereinigt verwaiste R2-Objekte aus den
  Präfixen `card-submissions/` und `products/` mit 24 Stunden Sicherheitsabstand
  und höchstens 100 Löschungen je Lauf. JSON-Anfragen werden vor dem Puffern
  auf 64 KiB begrenzt; eBay- und PayPal-Webhooks streamen bis 256 KiB. Supabase-
  Auth, Supabase-Admin und eBay-OAuth haben ein 10-Sekunden-Timeout.
- **CSP:** Inline-Style-Blöcke erhalten denselben Antwort-Nonce wie Skripte;
  `style-src 'unsafe-inline'` ist entfernt. Das verbliebene React-Style-Attribut
  wurde in eine CSS-Klasse verschoben.
- **Verifikation:** Vollständige Testsuite 335/335, `npx tsc --noEmit`,
  `npm run lint`, `npm run build` und `git diff --check` ohne Fehler.
- **Veröffentlichung:** Commit `b8fa35b9da8fd78cbdfa85e125f5af1a0163672f`
  ist nach `main`, `agent/initial-brandycards` und das Sites-Quellrepository
  gepusht. Cloudflare-Version `d7927df3-c86f-4a94-82ae-c4adf145bcaa` und
  Sites-Version 11 sind erfolgreich deployed.
- **Produktivprüfung:** `/`, `/admin`, `/account` und `/api/products` unter
  `shop.brandycards.de` sowie die Sites-URL antworten mit HTTP 200. Die CSP
  enthält Script- und Style-Nonce ohne `unsafe-inline`; `/api/products` liefert
  `cache-control: public, max-age=30, stale-while-revalidate=60`.
- **Betreiberstatus:** MFA ist laut Betreiber eingerichtet. Die Secret-Rotation
  läuft separat beim Betreiber und wurde nicht durch diesen Auftrag verändert.

### 2026-08-09 — eBay-Sync: ungültigen OAuth-Scope korrigiert

- **Ursache:** Die Produktionskonfiguration verlangte beim Refresh des eBay-
  Tokens zusätzlich `sell.fulfillment.readonly`. Dieser Scope war nicht Teil
  des bestehenden Refresh-Tokens; eBay antwortete deshalb bei jedem
  dreiminütigen Sync-Lauf mit HTTP 400 `invalid_scope` und löste einen
  Betriebsalarm aus.
- **Korrektur:** Der reguläre Lese-Sync sendet keinen nachträglich erweiterten
  Scope mehr, sondern verwendet die Rechte der ursprünglichen Zustimmung.
  Schreibzugriffe sind in der Produktion auf den tatsächlich benötigten
  `sell.inventory`-Scope begrenzt. Die bestehende Notification-Subscription
  und der `ORDER_CONFIRMATION`-Webhook wurden nicht verändert.
- **Verifikation:** Vollständige Testsuite 330/330, `npx tsc --noEmit`,
  `npm run lint`, `npm run build` und `git diff --check` ohne Fehler.
- **Veröffentlichung:** Commit `fa90ded` ist nach `main` gepusht. Sites-Version
  10 und Cloudflare-Version `3c3f6575-032a-4d58-9ea1-4fa1f42a6e5e` sind aktiv;
  die öffentlichen Produktionsrouten `/` und `/api/products` antworten mit
  HTTP 200.
- **Produktivprüfung:** Der erste Lauf nach dem Deploy um 19:10 Uhr ist
  `SUCCEEDED` und enthält keinen Fehler. Die vorherigen Läufe bis 19:07 Uhr
  waren die letzten alten `invalid_scope`-Fehler. Es wurden keine manuellen
  Produktionsdaten geändert.

### 2026-08-09 — Vorverkauf ohne Festpreis, mit Bildern deployed

- **Stand:** abgeschlossen und live. Vorverkaufskarten können in der
  Adminanlage bis zu zwei geprüfte JPG-, PNG- oder WebP-Bilder erhalten. Die
  Dateien liegen im privaten R2-Bucket und werden über die öffentliche,
  statusgeschützte Asset-Route aus `product_assets` ausgeliefert.
- **Preislogik:** Manuelle Karten tragen dauerhaft `priceAmountCents: null`.
  Admin, Vorverkaufsseite und Detailseite zeigen keinen Festpreis; es gibt nur
  den Preisvorschlag. Ein positiver Vorschlag ist ohne Listenpreis zulässig.
  Ein angenommener, noch gültiger Vorschlag legt die Karte beim Laden der
  Detailseite einmal in den Warenkorb. Alte Warenkorbeinträge ohne gültige
  Zusage werden im Checkout verworfen und von der Bestellroute abgelehnt.
- **Verifikation:** `npx tsc --noEmit`, `npm run lint` und `npm test` ohne
  Fehler; der vollständige Lauf meldete 313/313 Tests. Die Live-Prüfung lieferte
  für `/`, `/admin`, `/account`, `/vorverkauf` und `/api/products` HTTP 200;
  die API meldete 294 Produkte und 0 manuelle Karten. Die neue Asset-Route
  antwortete für eine ungültige Referenz erwartungsgemäß mit HTTP 404.
- **Veröffentlichung:** Commit `f385fdf` nach `main` und
  `agent/initial-brandycards` gepusht. Cloudflare-Version
  `22cfc913-f8a6-4e45-8e20-c5aa1b21c2ef` ist aktiv. Es wurden keine
  Produktionsdaten geschrieben.
- Die dauerhafte Vorgabe des Betreibers bleibt: Änderungen immer committen,
  pushen und deployen.

### 2026-08-09 — F-01 technisch umgesetzt und deployed

- **Stand:** abgeschlossen für den belegten technischen Teil. Die Galerie
  verwendet `inventory` per `leftJoin`, `istImKatalogSichtbar` und
  `verfuegbareMenge`; die Sichtbarkeit wird vor der Begrenzung auf fünf Karten
  ausgewertet. Ausverkaufte Karten und Auktionen erscheinen dadurch nicht mehr.
- **Bewusste Grenze:** Die Route bleibt auf eBay-Listings beschränkt. Ob
  manuelle Karten in die Startseiten-Galerie aufgenommen werden, bleibt als
  F-01 Teil b eine Betreiberentscheidung.
- **Verifikation:** F-01-Zieltests 30/30, `npx tsc --noEmit`, `npm run lint`
  und `npm test` ohne Fehler; der vollständige Lauf meldete 311/311 Tests.
  `/`, `/admin` und `/account` antworteten live mit HTTP 200. Die Galerie-API
  lieferte fünf `newest`, fünf `priciest` und null Auktionen.
- **Veröffentlichung:** Commit `f13e72c`, nach `main` und
  `agent/initial-brandycards` gepusht. Cloudflare-Version
  `73e59f8a-40e3-4ec0-a81b-1691e63f8a4b` ist aktiv. Es wurden keine
  Produktionsdaten geschrieben.
- Die dauerhafte Vorgabe des Betreibers bleibt: Änderungen immer committen,
  pushen und deployen.

### 2026-08-09 — S-04 in Produktion deployed

- **Stand:** abgeschlossen. Die sechs authentifizierten Routen `price-offers`,
  `account/data`, `account/delete`, `account/profile`, `paypal/orders` und
  `paypal/capture` verwenden den gemeinsamen `RATE_LIMITER` mit jeweils eigenem
  Scope. Überschreitungen antworten als HTTP 429 mit `retry-after`.
- **Verifikation:** `npx tsc --noEmit`, `npm run lint` und `npm test` ohne
  Fehler; der vollständige Lauf meldete 311/311 Tests. `/admin` und `/account`
  antworteten live jeweils mit HTTP 200 und ohne die Supabase-
  Konfigurationsfehlermeldung.
- **Veröffentlichung:** Commit `87de6ef`, nach `main` und
  `agent/initial-brandycards` gepusht. Cloudflare-Version
  `c8400b82-058c-41a5-af30-0c9d09d0a906` ist aktiv. Es wurden keine
  Produktionsdaten geschrieben.
- Die dauerhafte Vorgabe des Betreibers bleibt: Änderungen immer committen,
  pushen und deployen.

### 2026-08-09 — S-02 in Produktion deployed

- **Stand:** ABGESCHLOSSEN. Der geprüfte S02-Stand ist als Cloudflare-Version
  `d9b6dd25-4481-4f4b-a2ab-4141fcb44a5c` live; GitHub `main` und
  `agent/initial-brandycards` stehen nach dem Abschlusscommit `47fbe5d` auf
  demselben Stand.
- **Nachprüfung:** `https://shop.brandycards.de/admin` und `/account` liefern
  HTTP 200; beide Seiten enthalten keinen Fehler „Supabase ist noch nicht
  konfiguriert". Der Cron läuft weiter mit `*/3 * * * *`.
- **Dauerregel bestätigt:** Nach grüner Prüfkette wird ab jetzt committed,
  gepusht und deployed. Der Deploy erfolgte aus dem Hauptverzeichnis.

### 2026-08-09 — `main` aktualisiert und S-02 behoben

- **Stand:** ABGESCHLOSSEN, GitHub `main` und `agent/initial-brandycards` stehen
  auf `c07a9f1`.
- **Phase 1:** Der vorherige Arbeitsstand wurde einschließlich der Dokumentation
  per Fast-Forward nach `main` übernommen. Beide Branches sind auf GitHub
  synchronisiert; es gibt keinen offenen lokalen oder entfernten Rückstand.
- **S-02:** Nur `PROCESSED` wird als Dublette mit Erfolg beantwortet. Eine frische
  `RECEIVED`-Zeile antwortet mit HTTP 503 und `retry-after: 300`; eine mindestens
  fünf Minuten alte `RECEIVED`-Zeile wird erneut verarbeitet und vorher
  bedingt beansprucht, damit zwei verspätete Zustellungen nicht parallel
  einziehen.
- **Verifikation:** S02-Test 10/10, `npm test` 310/310, `npx tsc --noEmit`,
  `npm run lint` und Build grün. Keine Produktionsdaten wurden geschrieben.
- **Nicht ausgeführt:** Der Produktionsdeploy wurde nicht gestartet, weil die
  Ausführungsfreigabe für die servicewirksame Cloudflare-Änderung fehlte. Der
  geprüfte Code ist auf GitHub bereit; der nächste sichere Schritt ist ein
  ausdrücklich freigegebener Deploy aus dem Hauptverzeichnis.

### 2026-08-09 — Testartikel gelöscht, F-10 und S-01 behoben

- **Stand:** ABGESCHLOSSEN, deployed als `c8966e32`, Commit `af841f1`.

**🔴 Schreibender Eingriff in Produktionsdaten**, vom Betreiber ausdrücklich
angeordnet („Bitte lösche den Artikel aus der DB"). Betroffen: die manuelle
Testkarte `b44ee5d7a3a94f6b91d2e895a9ffd0b0`.

- **Vorher nachgesehen, wie es die Regel verlangt:** 1 `inventory`-Zeile,
  1 `reservations`-Zeile auf `CONVERTED`, 1 `order_items`-Zeile, 0 Angebote,
  0 Bilder, 0 Sync-Ereignisse. **Die Reservierung blockierte per `RESTRICT`**
  das Löschen des Produkts — Reihenfolge also zwingend: erst sie, dann das
  Produkt.
- **Gelöscht wurde der Artikel, nicht der Verkauf.** `DELETE FROM reservations`
  (1 Zeile), dann `DELETE FROM products` (3 Änderungen: Produkt, Bestand per
  `CASCADE`, `order_items.product_id` per `SET NULL`). **Die bezahlte
  Bestellung `BC-20260809-E998831E` steht unverändert:** `PAID`, 346 ct,
  Titel-Momentaufnahme „Testartikel von Hand", Capture `8F255921NK972311K`.
  Dieselbe Linie wie bei der Kontolöschung — ein Rechnungsbeleg überlebt, und
  bei einer echten PayPal-Zahlung wäre alles andere fahrlässig.
- **Danach geprüft:** 0 manuelle Karten, `products.status = 'ACTIVE'` wieder
  bei 294 (deckungsgleich mit den aktiven eBay-Angeboten), Detailseite der
  Karte **404**, Katalog 294.

**F-10 — die Adminkachel zählt Verkaufbares.** Entscheidung des Betreibers.
Sie zählte `products.status = 'ACTIVE'`; eine verkaufte **manuelle** Karte
bleibt darauf stehen, weil es für sie keinen Sync gibt, der aufräumt. Gezählt
wird jetzt mit `istKaufbar` aus `lib/catalog-availability.ts` — **zusammengesetzt
aus `istImKatalogSichtbar`, nicht danebengeschrieben.** Der Unterschied
zwischen beiden ist die Vormerkliste: sichtbar, aber nicht kaufbar.
*Eine zweite Fassung in SQL wäre die fünfte Stelle gewesen, an der dieselbe
Frage beantwortet wird — die vier bisherigen sind alle auseinandergelaufen.*
Preis: ~550 gelesene Zeilen statt eines Zählers, auf einer Seite, die nur der
Betreiber öffnet.

**S-01 — der geplante Lauf bricht nicht mehr am ersten Fehler ab.**
`Promise.all` → `Promise.allSettled`. Bis dahin galt: Lehnt eine der sechs
Zusagen ab, ist die Zusage an `waitUntil` erledigt, während die übrigen noch
laufen — und `runEbaySync` lehnt regelmäßig ab (24 solcher Läufe stehen in
`sync_runs`). Mitgerissen wurde dabei ausgerechnet `processEbayOutbox`, die
Rücknahme verkaufter Karten bei eBay.
**Dazu tragen die Aufgaben jetzt Namen:** Die alte Zeile meldete jeden Fehler
als „eBay-Synchronisierung fehlgeschlagen", auch wenn in Wahrheit die
Löschfrist gerissen war. Ein Protokoll, das die falsche Ursache nennt, ist
schlechter als keins.

- **Sieben Tests, alle sieben ohne die Korrekturen rot.** `tsc` sauber, Lint
  0 Fehler, `npm test` **306/306**, Bundle-Probe bestanden, aus dem
  Hauptverzeichnis deployed.
- **S-01 zusätzlich am laufenden Cron nachgeprüft**, nicht nur im Test: Der
  Lauf um 07:57:09 lief noch auf dem alten Stand (Deploy 07:58:01), deshalb
  wurde der nächste Schlag abgewartet. **Der Lauf um 08:00:09 steht auf
  `SUCCEEDED` mit 0 Fehlern** — der geplante Handler trägt auf dem neuen Stand.
  Das war die eigentliche Probe: `scheduled()` ist von außen nicht auslösbar,
  ein Fehler darin wäre nur im Worker-Protokoll und an ausbleibenden
  Aufräumläufen zu sehen.

### 2026-08-09 — F-02 abgeschlossen, S-03 und S-06 behoben

- **Stand:** ABGESCHLOSSEN, deployed als `7614139c`, Commit `caecfa6`.
- **F-02 ist durch.** Der Betreiber hat die erste von Hand eingestellte Karte
  angelegt und durchgekauft. In D1 nachgeprüft statt geglaubt: Bestellung
  `BC-20260809-E998831E` auf `PAID` über 3,46 €, Zahlung `CAPTURED`
  (`8F255921NK972311K`), Bestand `SOLD` mit `available 0 / reserved 0 / sold 1`,
  Reservierung `CONVERTED`, Webhook `PROCESSED`, 0 offene Reservierungen.
  Danach: `/api/products` liefert wieder 294 Karten, die Detailseite der
  verkauften Karte antwortet mit **404**, `/vorverkauf` ist leer.
- **Der wichtigste einzelne Beleg ist eine Null:** `ebay_outbox` hat **keinen**
  neuen Auftrag bekommen. Genau richtig — eine manuelle Karte hat kein
  eBay-Angebot, das zurückzunehmen wäre. Der Weg, der bei eBay-Karten den
  Doppelverkauf verhindert, wird hier korrekt gar nicht erst betreten.
- **S-03, `PATCH /api/admin/products`.** Die Route schrieb `availableQuantity`
  absolut und übersah `reservedQuantity`. Sie bricht jetzt mit 409 ab, solange
  eine aktive Reservierung auf der Karte liegt. **Bewusst abbrechen statt
  umrechnen:** Ob die reservierte Karte in der eingegebenen Menge mitgemeint
  ist, weiß nur der Betreiber, und die falsche Auslegung erzeugt Bestand, den es
  nicht gibt. Die Meldung nennt die Zahl und sagt, dass es höchstens 15 Minuten
  dauert.
- **Dazu eine Wahrheitskorrektur:** Menge 0 von Hand setzt jetzt `UNAVAILABLE`
  statt `SOLD`. `soldQuantity` bleibt dabei 0; ein `SOLD` daneben war schlicht
  falsch. `SOLD` setzt allein `settlePaidOrder`, nach echter Zahlung. **An der
  Sichtbarkeit ändert sich nichts**, und ein Test hält genau das fest — sonst
  wäre aus einer Wahrheitskorrektur unbemerkt eine Verhaltensänderung geworden.
- **S-06, `existingProduct(…, prelistedOnly)`.** Die Prüfung `kind !==
  'PRELISTED'` meinte die Vormerkliste, traf seit `0006` aber auch jede von Hand
  eingestellte Karte. Erkannt wird sie jetzt an `origin` **und** `kind`.
  **`kind` bleibt unangetastet**, und ein Test hält die CHECK-Bedingung fest —
  der naheliegende „Aufräumer" wäre ein dritter `kind`-Wert, und der Versuch
  kostete beim ersten Mal beinahe den Katalog.
- **Fünf Tests, drei davon ohne die Korrekturen rot.** Die anderen beiden sind
  Invarianten und sollen in beide Richtungen halten; das gehört so gesagt,
  statt „alle rot" zu behaupten.
- **Nachgeprüft:** `tsc` sauber, Lint 0 Fehler, `npm test` **299/299**,
  Bundle-Probe bestanden, aus dem Hauptverzeichnis deployed. In Produktion:
  `/account` und `/admin` laden, `PATCH /api/admin/products` ohne Token → 401,
  `/api/prelisted-interest` antwortet hinter dem Bot-Wächter mit
  `PRODUCT_NOT_FOUND`, Katalog unverändert 294.
- **Ehrlich zur Grenze dieser Nachprüfung:** S-06 ist **nicht** live gegen die
  verkaufte manuelle Karte geprüft worden. Hätte die Korrektur nicht gegriffen,
  wäre dabei eine Zeile in `inquiries` entstanden — ein schreibender Eingriff in
  Produktionsdaten, den ich nicht rückgängig machen dürfte. Der Beleg ist
  deshalb der Test plus der ausgelieferte Code, nicht der Live-Schuss.

### 2026-08-09 — Der Checkout warf manuelle Karten aus dem Warenkorb

- **Stand:** ABGESCHLOSSEN, deployed als `b1f2ad62`, Commit `90ad08f`.
- **Gemeldet vom Betreiber**, mitten im Durchstich F-02: Karte anlegen ging, in
  den Warenkorb legen ging, der Checkout meldete danach „Dein Warenkorb ist
  leer". Kein Fehler, keine Meldung — sie war einfach weg.
- **Ursache:** `app/checkout/page.tsx` filterte `category === "Festpreis"`. Eine
  manuelle Karte trägt „Direkt bei uns" und fiel stillschweigend heraus.
  **Der Server war die ganze Zeit gesund** — `/api/products` lieferte sie mit
  `quantity: 1` aus, `/api/orders` hätte sie angenommen. Reine Anzeige.
- **Es war die vierte Stelle derselben Sorte.** Bestellroute, Preisvorschlag und
  Detailseite hingen am selben Tag schon am eBay-Listing; an der Detailseite
  steht seitdem ausdrücklich „**Nicht `=== "Festpreis"` prüfen**". Der Checkout
  hat die Zeile trotzdem behalten — weil die Entscheidung an **jeder** Stelle
  neu geschrieben wurde. Deshalb steht sie jetzt genau einmal:
  `istKaufbareKategorie` in `lib/catalog-availability.ts`.
- **Allowlist, keine Blockliste.** Eine künftige Kategorie ist erst einmal nicht
  kaufbar. Eine Karte zu wenig im Warenkorb ist ein Anruf, eine zu viel ist ein
  Verkauf, den es nicht gibt.
- **Sechs Tests, Rot-Nachweis geführt** (alle sechs ohne die Korrektur rot).
  **Zwei davon prüfen nicht die Funktion, sondern ihre Verwendung:** dass der
  Checkout sie benutzt und den Vergleich nicht wieder einführt, und dass jede
  Kategorie der Allowlist auch wirklich aus der Katalogroute kommt. Ein Test auf
  die Funktion allein hätte genau diesen Rückfall nicht bemerkt — und der
  Rückfall ist hier der wahrscheinliche Fehler, nicht die Logik.
- **Nachgeprüft:** `tsc` sauber, Lint 0 Fehler, `npm test` **294/294**,
  Bundle-Probe bestanden, aus dem **Hauptverzeichnis** gebaut und deployed.
  In Produktion durchgeklickt: `/vorverkauf` → „In den Warenkorb" → `/checkout`
  zeigt „Testartikel von Hand · 0,01 € × 1 · Zwischensumme 0,01 € · Versand
  3,45 € · Gesamt 3,46 €", keine Konsolenfehler. **Vor „Mit PayPal fortfahren"
  gestoppt** — den Kauf macht der Betreiber, es sollte keine fremde Bestellung
  in den Daten stehen.
- **Die Lehre, und sie ist dieselbe wie beim letzten Durchstich:** Diese vier
  Fehler haben **alle** Tests bestanden. Gefunden hat sie jedes Mal jemand, der
  eine echte Karte angelegt und durchgeklickt hat. Wer am Vorverkauf weiterbaut,
  klickt durch.

### 2026-08-09 — Schritt 1 der Befundabarbeitung: die Dokumentation richtiggestellt

- **Stand:** ABGESCHLOSSEN
- **Ziel:** F-06, F-07 und F-08 aus dem
  [Prüfbericht](pruefbericht-2026-08-09.md). Sie standen zuerst, weil jede
  folgende Sitzung mit genau diesen Dateien anfängt.
- **F-06 — „Offene Punkte" in dieser Datei.** Sechs Einträge waren überholt und
  wurden gegen den gemessenen Zustand ersetzt: der rote Punkt „PayPal läuft in
  der Sandbox" (der Shop nimmt seit dem 2026-08-08 echtes Geld ein), der
  Cron-Takt (`*/3`, nicht zweistündlich), die CSP (trägt für Skripte **kein**
  `'unsafe-inline'` mehr), der Deploy-Stand (er wird jetzt gar nicht mehr
  aufgezählt, sondern auf `wrangler deployments list` verwiesen — die Liste war
  zweimal falsch), der Webhook-Dublettenpfad und der Testartikel.
- **Der Testartikel ist erledigt**, am 2026-08-09 in D1 nachgesehen:
  `ec6c212e96332bdcc93612848694b907` steht auf `INACTIVE`, der Import hat ihn
  wie vorhergesagt abgeräumt.
- **F-07 — `wrangler.toml`.** Der 28-zeilige Kommentarblock über `[triggers]`
  begründete drei Zeilen über `crons = ["*/3 * * * *"]` einen zweistündlichen
  Takt und rechnete mit dem Free-Budget. Ersetzt durch das, was heute trägt: die
  eBay-Grenze als begrenzende Größe, die Reihenfolge „erst den Lauf verbilligen,
  dann den Takt erhöhen", und die Sprungstelle bei 401 Angeboten.
- **F-08 — `CLAUDE.md`.** „CI prüft keine Typen" stimmt nicht mehr; der Workflow
  hat seit SEC-14 einen Schritt `Type check`. Der Rat („`tsc` vor jedem Commit")
  bleibt, die Begründung lautet jetzt „`npm test` prüft keine Typen". Und die
  Migrationsspanne heißt `0003`–`0006`, nicht `0003`–`0005`.
- **Kein Deploy, und das ist Absicht:** Geändert wurden ausschließlich Prosa und
  ein TOML-**Kommentar**. Nichts davon erreicht den Worker; die laufende Version
  `11c2dd57` bleibt richtig.
- **Nachgeprüft:** `npx tsc --noEmit` sauber, `npm run lint` 0 Fehler,
  `npm test` **288/288**. `npx wrangler deploy --dry-run` löst weiterhin alle
  Bindungen auf — D1, R2, Images, Assets, `RATE_LIMITER (10 requests/60s)`,
  `RATE_LIMITER_STRICT (3 requests/60s)` und `PAYPAL_ENVIRONMENT ("production")`.
  Der Kommentar liegt zwar innerhalb des Bereichs, den
  `tests/hardening.test.mjs` aus der Datei schneidet, aber die Prüfungen dort
  suchen Zeilen, keine Prosa.
- **Als Nächstes:** Schritt 2 (F-02) liegt beim Betreiber. Danach S-03 und S-06
  zusammen mit dem, was der Durchstich zutage fördert; die Reihenfolge steht im
  Prüfbericht.

### 2026-08-09 — Vollständige Prüfung von Sicherheit und Funktion

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Reiner Prüfauftrag über den ganzen Shop, Bericht als eigene Datei.
  Nichts ändern, nichts deployen, nichts in die Produktionsdatenbank schreiben.
- **Ergebnis:** [pruefbericht-2026-08-09.md](pruefbericht-2026-08-09.md).
  16 Befunde (2 mittel Sicherheit, 2 mittel Funktion, der Rest niedrig oder
  Hinweis) und 22 ausdrücklich als tragfähig bestätigte Bereiche.
- **Geschrieben wurde ausschließlich** die Berichtsdatei und dieser Eintrag.
  Kein Code, keine Konfiguration, kein Deploy, kein schreibender D1-Befehl.
- **Die drei dringendsten Punkte:** (1) `worker/index.ts` reicht `Promise.all`
  an `waitUntil` — ein eBay-Fehler kann die eBay-Rücknahme, die Freigabe
  abgelaufener Reservierungen und die Löschfrist mit abwürgen (`allSettled`).
  (2) Der Vorverkaufszweig ist in Produktion **unerprobt**: 0 Karten mit
  `origin = 'MANUAL'`, die Abnahme von Punkt 11 steht aus. (3) Der Abschnitt
  „Offene Punkte" oben in dieser Datei ist überholt und behauptet in Rot, der
  Shop könne kein Geld einnehmen — er kann es seit dem 2026-08-08.
- **Prüfkette am geprüften Stand:** `npx tsc --noEmit` sauber, `npm run lint`
  0 Fehler und 0 Warnungen, `npm test` **288/288**. Produktion läuft auf dem
  aktuellen Code (`11c2dd57` = Codecommit `9b45c67`).
- **Der Katalog ist gesund:** 294 aktive Produkte = 294 aktive eBay-Listings =
  294 von `/api/products` ausgelieferte Karten, alle mit Preis und Bild, keine
  Waisen. Seit dem 2026-08-07 kein einziger fehlgeschlagener Sync-Lauf.
- **Nebenbefund, der jemandem auffallen wird:** Die Zeile
  `WH-4MD290111R3948627-…` in `webhook_events` steht seit dem 2026-08-08 auf
  `RECEIVED` statt `PROCESSED`. Das ist ein Überbleibsel des vor `e204d3d7`
  behobenen Dublettenpfads, **nicht** ein hängender Vorgang — die zugehörige
  Bestellung steht auf `PAID`, die Zahlung auf `CAPTURED`. Der Bericht nennt
  unter S-02 trotzdem die Lücke, die dahinter steckt.

### 2026-08-09 — Die zwei Kandidaten aus Punkt 10

- **Stand:** ABGESCHLOSSEN. Deployed als `11c2dd57`, Commit `9b45c67`.
  `tsc` sauber, Lint 0 Warnungen, `npm test` 288/288.
- **Kandidat 1, toter Auktionscode — entfernt.** Die Auktionszweige in
  `app/karten/page.tsx` (`meta()`, `badge()`, der Knopf „Auf eBay ansehen") und
  in `app/karten/[id]/page.tsx` (Ausweis, „Auf eBay bieten") sind ersatzlos
  gestrichen, ebenso die Kategorie `"Auktion"` aus den Typen von
  `app/api/products/route.ts` und beiden Seiten.
  **Vor dem Löschen geprüft, nicht angenommen:** `istImKatalogSichtbar` weist
  `listingType === "AUCTION"` ab, und `/api/products` liefert in Produktion nur
  noch `"Festpreis"` — nachgemessen nach dem Deploy.
  Nebenbei kam heraus, dass `badge()` für manuelle Karten „Sofort-Kaufen"
  gezeigt hätte; steht jetzt auf „Vorverkauf".
- **Kandidat 2, Texte auf `/verkaufen` und `/anfragen` — geprüft, eine Stelle
  geändert.** Auf `/anfragen` stand „Manche Karten liegen schon in unserer
  Sammlung, aber noch nicht im Shop" — ein Zustand ohne Ort, seit es den
  Vorverkauf gibt. Der Satz zeigt jetzt dorthin.
- **`/verkaufen` blieb unverändert, und das ist der Befund, nicht das
  Ausbleiben eines Befunds.** Die Angaben stimmen mit dem Code überein:
  fünf Bilder, 10 MB je Bild, JPG/PNG/WebP — gegen
  `app/api/card-submissions/route.ts` geprüft. Die drei Schritte beschreiben
  den Ankauf weiterhin richtig. Punkt 10 warnt ausdrücklich davor, Texte
  anzufassen, die niemand angefordert hat.

### 2026-08-09 — Adminkonsole fertig: 12.4 und 12.5

- **Stand:** ABGESCHLOSSEN. **Punkt 12 ist damit vollständig** — sein Kriterium
  („eine Woche arbeiten ohne `wrangler d1 execute`") ist erfüllt.
- **12.4:** `app/api/admin/inquiries/route.ts` (GET/PATCH) und der PATCH an
  `app/api/admin/card-submissions/route.ts`; Oberfläche
  `app/admin/requests-panel.tsx`. Anfragen und Kartenangebote haben jetzt einen
  Bearbeitungsstand statt nur einer Zahl, dazu einen Antwort-Link per Mail.
- **Der Statuswechsel bei Kartenangeboten hat eine Nebenwirkung**, die
  dazugeschrieben ist: `REJECTED` und `CLOSED` starten die 90-Tage-Löschfrist
  aus `lib/retention.ts`. Ohne den Hinweis löscht der geplante Lauf später
  etwas, womit niemand gerechnet hat.
- **12.5:** `app/api/admin/ebay/outbox/route.ts` und
  `app/admin/outbox-panel.tsx`. Die Ansicht zeigt **Fehlergrund und nächsten
  Versuchszeitpunkt**, nicht nur einen Status — bei einem hängenden Auftrag ist
  genau das die Frage: warten oder eingreifen? Steht `EBAY_WRITE_ENABLED` auf
  aus, sagt die Ansicht das deutlich; sonst läse sich eine Liste voller
  „Wartet" wie ein Stau, während gar nichts ausgeführt wird.
- **Aufgeräumt:** Der alte Kartenangebots-Block in `app/admin/page.tsx` ist samt
  `deleteSubmission` entfallen — er lebt jetzt im Panel. Lint ist dadurch
  erstmals **ganz** ohne Warnung.
- **Belegt:** `tsc` sauber, Lint 0 Warnungen, `npm test` 288/288. Deployed als
  `a99ce258`, Commit `30b0ee2`. Die Farben der neuen Ansichten wurden über die
  gebaute CSS gemessen (Fehlerrahmen `#c9362d`, Wiederholung `#c99d58`,
  Flächen `#ebe8e1`) — die Panels liegen hinter der Anmeldung, ein Screenshot
  war nicht möglich.
- **Nicht geprüft:** Ein echter Statuswechsel und eine echte hängende
  Warteschlange. Beides braucht Daten, die es gerade nicht gibt — die Outbox ist
  leer, und Anfragen liegen keine offenen vor.

### 2026-08-09 — Punkt A abgeschlossen: Adminkonsole, Vorverkauf, SEC-12

- **Stand:** ABGESCHLOSSEN. Damit sind ai-todo Punkt 11, Punkt 12.1 und SEC-12
  vollständig erledigt; Punkt 8 hat keine offenen Reste mehr.
- **Ergebnis:** `app/api/admin/products/route.ts` (GET/POST/PATCH/DELETE) und
  `app/admin/products-panel.tsx` — Karten anlegen, beide Sorten bearbeiten,
  Handmarkierungen sichtbar und einzeln wieder freigebbar.
  `app/vorverkauf/page.tsx` samt Navigationspunkt.
  `app/api/admin/ebay/oauth/claim/route.ts` schließt SEC-12: Die Rückseite
  parkt den Token unter einer Kennung und leitet um (303), abholen kann ihn nur
  der angemeldete Adminbereich, die Zeile fällt dabei; abgelaufene räumt der
  geplante Lauf ab. Commits `b40f4cd`, `cd9a716`; deployed als `5a68a2d7`.
  `tsc` sauber, Lint 0 Fehler, `npm test` 286/286.
- **Drei Fehler, die erst der lokale Durchstich zeigte** — alle drei hätten
  manuelle Karten **stillschweigend** ausgesperrt, während sie im Schaufenster
  standen:
  1. `app/api/orders/route.ts` verknüpfte `ebay_listings` per `innerJoin` — der
     Kauf scheiterte mit „nicht mehr verfügbar".
  2. `app/api/price-offers/route.ts` ebenso — der Vorschlag lief in ein 404,
     obwohl der Kasten dastand.
  3. `app/karten/[id]/page.tsx` zeigte den Vorschlag-Kasten nur bei
     `category === "Festpreis"`. Manuelle Karten tragen „Direkt bei uns" — der
     Kasten fehlte, obwohl der Betreiber sie ausdrücklich verhandelbar wollte.

  **Gefunden durch eine Testkarte in der lokalen Datenbank, nicht durch Tests.**
  Die Tests prüften die Bausteine; dass drei andere Stellen weiter am Listing
  hingen, sah man erst beim Durchklicken. `tests/manual-cards.test.mjs` nagelt
  jetzt alle drei fest.
- **Eine Abweichung von Punkt A:** Der Vorverkauf steht **fest** in der
  Navigation statt „erst mit der ersten Karte". Dafür müsste die Kopfzeile auf
  jeder Seite den Katalog laden, nur um über einen Menüpunkt zu entscheiden.
  Begründung als Kommentar an `NAV` in `app/site-chrome.tsx`.
- **Was bewusst offen blieb:** `app/api/products/highlights/route.ts` verknüpft
  weiterhin per `innerJoin` — manuelle Karten erscheinen also **nicht** auf der
  Startseite unter den Höhepunkten. Kein Fehler, aber eine Entscheidung, die
  jemand treffen sollte, sobald es mehr als eine Handvoll gibt.

### 2026-08-08 — Großer Block, erste Hälfte: manuelle Karten, Handmarkierungen

- **Stand:** ABGESCHLOSSEN für diese Sitzung; Fortsetzung als **Punkt A** im
  Arbeitsvorrat, an eine andere KI übergeben.
- **Ziel:** ai-todo Punkt 11, Punkt 12.1 und SEC-12 in einem Zug, weil alle drei
  dieselbe Migration brauchten.
- **Drei Entscheidungen des Betreibers:** manuelle Karten sind verhandelbar ·
  gleichnamige Karten werden beim Import **automatisch zusammengeführt** ·
  eigener Navigationsbereich.
- **Zur Zusammenführung hat der Betreiber am selben Tag präzisiert:** Die Karte
  soll **hinüberwandern**, nicht abgeschaltet werden — dieselbe Zeile wird zur
  synchronisierten Karte (`origin → EBAY`, `kind → EBAY_SYNCED`, Produktpreis
  fällt weg). Das erhält Kennung, Bilder, Verknüpfungen und laufende
  Preisvorschläge. Mein Einwand gegen das Zusammenführen (Titel sind Freitext,
  ein Treffer bleibt eine Vermutung) wurde ausgesprochen und überstimmt; die
  Umsetzung ist deshalb so eng wie möglich: zeichengenau nach Normalisierung,
  verkaufte Karten und Karten mit angenommenem Preisvorschlag bleiben draußen,
  jede Übernahme steht als `syncEvent` und in der Adminmeldung.
- **Ergebnis:** Migration `0006` (vom Betreiber angewandt), Schema um `origin`,
  `price_amount_cents`, `price_currency`, `manual_overrides` und
  `ebay_oauth_claims` erweitert, Katalog und Detailseite verstehen manuelle
  Karten, `lib/manual-overrides.ts` samt Verdrahtung im Sync,
  `tests/manual-cards.test.mjs` (15 Tests). Commits `cabdcb2`, `bfcfb2e`;
  deployed als `dc0c6e46`. `tsc` sauber, Lint 0 Fehler, `npm test` 277/277.
- **Die Abweichung vom Auftrag, und warum sie unvermeidbar war:** Der
  Arbeitsvorrat verlangte eine dritte `kind`-Art. Auf D1 nicht machbar — der
  Tabellenneubau hätte über `ON DELETE CASCADE` die Kindtabellen geleert (im
  lokalen Probelauf waren `ebay_listings` und `inventory` danach **leer**,
  in Produktion wären es 543 Angebote gewesen), `PRAGMA foreign_keys = OFF`
  greift auf D1 nicht, und ein `RENAME` scheitert an der qualifizierten
  CHECK-Bedingung. Stattdessen die Spalte `origin` ohne CHECK. Ausführlich im
  Agentenlog.
- **Zwei Handgriffe lagen beim Betreiber**, weil der Berechtigungsklassifizierer
  schreibende D1-Befehle verweigert: das Anwenden der Migration und zuvor das
  Hinterlegen von `SUPABASE_SERVICE_ROLE_KEY`. Für künftige Sitzungen gilt:
  **fertigen Befehl geben, nicht selbst versuchen.**

### 2026-08-08 — Löschlauf an echten Daten abgenommen, ein Fehler dabei gefunden

- **Stand:** ABGESCHLOSSEN — Punkt 8 ist damit vollständig erledigt.
- **Der Fund, und warum er fast durchgerutscht wäre:** Die Momentaufnahme **vor**
  dem Löschen zeigte die Testanfrage mit `user_id = NULL` und nur
  `guest_email`. `/anfragen` und `/verkaufen` sind öffentliche Formulare und
  setzen die Kontoverknüpfung nie, auch bei angemeldetem Absender — nur
  Preisvorschläge tun das. Auskunft und Löschung suchten aber ausschließlich
  über `user_id`. **Die Auskunft hätte die Anfrage verschwiegen, die Löschung
  hätte die E-Mail-Adresse stehen lassen, und beides hätte erfolgreich
  ausgesehen.** Aufgefallen ist es nur, weil vor dem unwiderruflichen Schritt in
  die Datenbank gesehen wurde statt danach.
- **Behoben:** Die Zuordnung greift jetzt über `user_id` **oder** die bestätigte
  Kontoadresse (`lower()` auf beiden Seiten — die Kontoadresse ist normalisiert,
  die Formularadresse steht so da, wie sie getippt wurde). Die Adresse ist ein
  zulässiger Schlüssel, weil ein Konto erst nach bestätigter E-Mail entsteht.
  Commit `a2c3cc3`, deployed als Version `681ff2f7`.
- **Abnahme in Produktion**, Wegwerfkonto `p.brand94+loeschtest@…`:
  Vorher 2 Zeilen in `users` und 1 Anfrage; nachher **nur das Adminkonto, 0
  Anfragen, 0 Preisvorschläge, 0 Kartenangebote, 0 Bilder**. Die **3
  Bestellungen stehen unverändert am Adminkonto** (`user_id IS NULL`: 0), die 3
  Reservierungen sind unangetastet. Die JSON-Auskunft enthielt die Anfrage,
  die Bestätigungsmail kam an, und ein erneuter Login mit der Wegwerfadresse
  wird abgewiesen — das Supabase-Konto ist also wirklich weg.
- **Bewusst nicht geändert:** Die öffentlichen Formulare setzen weiterhin kein
  `user_id`. Über die Adresse ist der Fall abgedeckt, und ein Bearer-Token durch
  die öffentlichen Formulare zu schleusen wäre Aufwand ohne Gewinn. Wer die
  Verknüpfung später doch braucht (etwa um im Adminbereich zu sehen, ob eine
  Anfrage von einem Kunden kommt), fasst `app/api/inquiries/route.ts` und
  `app/api/card-submissions/route.ts` an — **nicht** die Löschung.

### 2026-08-08 — Auskunft und Kontolöschung zur Selbstbedienung (ai-todo Punkt 8)

- **Stand:** ABGESCHLOSSEN, mit einem offenen Handgriff beim Betreiber
- **Ziel:** Der Rest aus SEC-15 — ein Kunde konnte seine Daten weder einsehen
  noch löschen lassen, ohne eine E-Mail zu schreiben.
- **Ergebnis:** `GET /api/account/data` liefert alles zum Konto als JSON-Datei,
  `POST /api/account/delete` löscht Kartenangebote samt R2-Bildern,
  Preisvorschläge, Anfragen, Reservierungen, die Kontozeile **und** das
  Supabase-Anmeldekonto. Oberfläche: Abschnitt „Meine Daten" in
  `app/account/page.tsx`. Logik in `lib/account-data.ts`, der Service-Role-Key
  ausschließlich in `lib/supabase-admin.ts`. Deployed als Version `76e2ac63`,
  Commit `348edb5`.
- **Bestellungen bleiben stehen** (Art. 17 Abs. 3 lit. b DSGVO). Sie verlieren
  per `ON DELETE SET NULL` nur die Verknüpfung zum Konto. Das steht an drei
  Stellen, bevor jemand klickt: im Abtipp-Dialog, in der Bestätigungsmail und
  im Datenschutztext.
- **Vier Abbruchbedingungen vor dem ersten Schreibzugriff:** keine Anmeldung →
  401; kein Service-Role-Key → 503; laufende Bestellung (`PENDING`,
  `PROCESSING`) → 409; und die Kontozeile fällt erst zuletzt, damit
  `ON DELETE SET NULL` nicht zuschlägt, bevor die übrigen Tabellen gelesen sind.
- **Reihenfolge, die man nicht umdrehen darf:** erst die Shopdaten, dann das
  Anmeldekonto. Andersherum stünde ein Kunde nach einem Fehlschlag ohne Login,
  aber mit seinen Daten da — und käme an den Selbstbedienungsweg nicht mehr
  heran. `tests/account-data.test.mjs` hält beide Reihenfolgen fest.
- **Gegen die stille Lücke:** Derselbe Test liest `db/schema.ts` und verlangt für
  **jede** Tabelle mit `user_id` entweder ein Vorkommen in `lib/account-data.ts`
  oder einen begründeten Eintrag in der Ausnahmeliste. Wer später eine Tabelle
  ergänzt und die Auskunft vergisst, bekommt einen roten Lauf statt einer
  unvollständigen Auskunft, die niemandem auffällt.
- **Belegt:** `npx tsc --noEmit` sauber, `npm run lint` 0 Fehler, `npm test`
  261/261. In Produktion antworten `/api/account/data` und
  `/api/account/delete` ohne Token mit 401, `/account` lädt, der neue
  Datenschutzabsatz steht auf `/datenschutz`.
- **Am 2026-08-08 an echten Daten abgenommen** — samt einem Fehler, den erst der
  Testlauf zutage brachte. Siehe den Eintrag darunter.

### 2026-08-08 — Zwei Gestaltungskorrekturen vom Betreiber

- **Stand:** ABGESCHLOSSEN
- **Regelverstoß, offen notiert:** Dieser Eintrag ist **nachgetragen**, nicht
  vorher angelegt. Zwei Handgriffe fühlten sich zu klein für das Protokoll an —
  das ist genau die Begründung, gegen die Regel 1 geschrieben wurde.
- **Ziel:** (1) Der Absatz über dem Preisfeld auf der Kartenseite stand in
  Monospace-Versalien und erschlug den Kasten. (2) Die Listen im Adminbereich
  waren dunkel (`#1e1f21`) und standen allein zwischen hellen Flächen.
- **Ergebnis:** Der Hinweis „mindestens 50 Cent unter dem Preis" läuft jetzt als
  `<small>` am Eingabefeld mit — er muss sichtbar bleiben, sonst bekommt der
  Kunde eine Ablehnung, die er nicht versteht; die 48-Stunden-Zusage steht im
  normalen Fließtext darüber. Bestell- und Vorschlagslisten nehmen dieselben
  Farben wie die Kacheln daneben (`#ebe8e1`, Kanten `--line`), die drei
  Statusfarben behalten ihre Bedeutung (bezahlt grün, offen Gold, storniert
  Rot). Betrag und Datum brechen nicht mehr um.
- **Belegt:** `npx tsc --noEmit` sauber, `npm run lint` 0 Fehler, `npm test`
  254/254. Deployed als Version `255a752f`; die ausgelieferte CSS
  (`/assets/index-Bu8ArPOy.css`) enthält `.admin-order{background:#ebe8e1}`.
  Commit `607e79d`.
- **Wie geprüft, obwohl beide Stellen hinter der Anmeldung liegen:** Über eine
  statische Seite mit der **gebauten** CSS und nachgebautem Markup im
  Vorschaubrowser. Das belegt Farben und Umbruch, nicht das Zusammenspiel mit
  echten Daten.
- **Nachtrag, zweite Runde:** Auch die graue `<small>`-Zeile am Preisfeld hat
  der Betreiber verworfen. Der Mindestabstand steht jetzt als halber Satz im
  Fließtext („Nenn uns deinen Preis — mindestens 50 Cent unter den 10,00 €, die
  die Karte aktuell kostet."), ohne eigene Gestaltung. **Ganz weglassen ist
  keine Option** — ohne den Hinweis läuft der Kunde in eine Ablehnung, die er
  nicht versteht. Deployed als Version `c1425a12`, Commit `111ab2f`.
- **Stehen geblieben:** Die kurze Zeile „Noch 3 von 3 Vorschlägen für diese
  Karte" trägt weiterhin `offer-meta`, also dieselbe Versalien-Monospace. Sie
  war nicht Teil des Auftrags. Nach zwei verworfenen Gestaltungen lässt sich
  eine Regel ableiten: **Der Betreiber will keine abgesetzten Hinweiszeilen um
  Formulare herum** — weder in Versalien-Monospace noch grau und klein.

### 2026-08-08 — Bestellungen im Adminbereich sichtbar (ai-todo Punkt 12.2)

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Bestellungen samt Positionen, Zahlung und Lieferadresse in `/admin`
  zeigen, statt sie über `wrangler d1 execute` zu erfragen.
- **Ergebnis:** Neue Leseroute `app/api/admin/orders/route.ts` (`GET`,
  `requireAdmin` aus `lib/admin-access.ts`) und `app/admin/orders-panel.tsx`:
  25 jüngste Bestellungen, aufklappbar mit Positionen, Beträgen, Zahlungsstand
  samt PayPal-Capture-Id und Lieferadresse. Stile in `app/globals.css`.
  `npx tsc --noEmit` sauber, `npm run lint` 0 Fehler, `npm test` 254/254.
  Deployed aus dem Hauptverzeichnis als Version `f2fb960e`. Commits `0cefb27`
  und `cfd11cf`.
- **Warum die Seitengröße 25 ist:** Positionen und Zahlungen werden über
  `inArray` an den Bestell-Ids nachgeladen, `D1_SAFE_ID_LIST` steht bei 40.
  `tests/d1-limits.test.mjs` liest die Zahl jetzt aus der Route und misst die
  erzeugten Abfragen — dieselbe Falle hat am 2026-08-06 den Sync zerlegt.
- **Befund, der Arbeit gespart hat:** Punkt 12.3 (Preisvorschläge entscheiden)
  war **schon vollständig fertig**, Oberfläche eingeschlossen —
  `app/admin/offers-panel.tsx` seit `a0d4367`. Die Notiz im Arbeitsvorrat („es
  fehlt ausschließlich die Oberfläche") war falsch und ist richtiggestellt.
- **Nicht geprüft, weil hinter der Anmeldung:** Ob die Liste die Bestellungen
  richtig darstellt, sieht nur ein eingeloggter Admin. Von außen belegt sind
  401 ohne Token und ein sauberes `/admin`. Siehe „Aktueller Auftrag".
- **Offen an dieser Ansicht:** Blättern über die 25 jüngsten hinaus, und
  Statuswechsel von Hand („versandt" setzt heute niemand).

### 2026-08-08 — „eBay synchronisiert" raus, und Punkt 10 auf Stand bringen

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Zwei Aufträge vom Betreiber:** die Bemerkung „eBay synchronisiert ·
  Sofort-Kaufen" unter jeder Karte entfernen (er hat den Kandidaten
  ausdrücklich bestätigt), und die Aufgabenliste nachziehen — die beiden
  erledigten Textänderungen als erledigt vermerken, die übrigen Kandidaten
  ordentlich notieren.
- **Warum die Zeile weg kann, und warum das mehr als Geschmack ist:** Der
  Ausweis über der Karte sagt bereits **„Sofort-Kaufen"**. Die Zeile darunter
  wiederholt das und ergänzt „eBay synchronisiert" — eine reine Innensicht.
  Für Kundschaft ist das bestenfalls bedeutungslos, schlimmstenfalls
  verwirrend („muss ich jetzt zu eBay?"). Sie fällt **ersatzlos** weg, statt
  durch eine andere Behauptung ersetzt zu werden.
- **Wie:** `meta()` in `app/karten/page.tsx` gibt für Festpreis `null` zurück,
  und die Zeile wird nur gezeichnet, wenn es etwas zu sagen gibt. Die
  Vormerkliste behält ihren Hinweis — dort trägt er echte Information.
- **Die toten Auktionszweige bleiben stehen.** Sie sind seit dem 2026-08-08
  unerreichbar, weil Auktionen nicht mehr im Katalog erscheinen. Der Betreiber
  hat gesagt: *notieren*, nicht umsetzen. Sie stehen als Kandidat in Punkt 10.
- **Betroffen:** `app/karten/page.tsx`, `docs/ai-todo.md`. Keine Migration.
- **Verifikation:** Prüfkette am Exit-Code, Deploy, Nachprüfung in Produktion.

- **Ergebnis: ABGESCHLOSSEN.** `tsc` sauber, Lint unverändert 1 alte Warnung,
  Testkette **exit=0**. Deployed als **`facaa7e5`**; `/`, `/admin`,
  `/account`, `/karten` je 200.
- **Am laufenden Katalog gemessen, nicht im Quelltext geraten:** 20 Karten
  gezeichnet, **0** Meta-Zeilen, kein „eBay synchronisiert" im Seitentext, und
  die Ausweise sagen weiterhin „Sofort-Kaufen" — die Information ist also
  nicht verschwunden, nur die Dopplung.
- **Punkt 10 ist jetzt als laufende Sammelstelle geführt**, mit drei
  getrennten Abschnitten: erledigt, vom Betreiber bestätigt (derzeit leer),
  und Kandidaten der KI. Die Trennung ist der Zweck — ein unbestätigter
  Kandidat darf nie versehentlich als Auftrag gelesen werden.

### 2026-08-08 — Zwei Textänderungen auf /ueber-uns (ai-todo Punkt 10)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Vom Betreiber wörtlich vorgegeben**, mit Bildausschnitten belegt. Damit hat
  Punkt 10 seine ersten konkreten Einträge — bisher war er eine Sammelstelle.
- **Erstens, `app/ueber-uns/page.tsx:31`:** Der letzte Satz unter „Warum auch
  eBay" wird zu **„Beides ist synchronisiert, damit dir auch nichts entgeht."**
  Der alte Satz („damit dir nichts doppelt oder gar nicht angeboten wird")
  erklärte ein technisches Problem, das den Kunden nichts angeht.
- **Zweitens, `app/ueber-uns/page.tsx:39`:** Aus dem gesetzten Kürzel
  `B×B` wird das **echte Logo**, und die drei Wörter darunter
  („BRÜDER · BRANDY · BALL") fallen weg.
- **Vorher geprüft, weil es hier schiefgehen kann:** Der Abschnitt
  `.about-section` hat einen **goldenen** Hintergrund. Ein Logo mit weißem
  Grund klebte dort als weißer Kasten. Die PNG-Blöcke zeigen `tRNS` — das Bild
  ist **transparent** und steht frei. 500×333 px, 30 KB, wird schon im
  Kopfbereich über `app/brand/brandycards-logo.png` eingebunden.
- **Das CSS braucht eine Ergänzung:** `.about-signature` ist auf Schrift
  ausgelegt (`font:italic 26px Georgia`), `small` darin ist die Zeile mit den
  drei Wörtern. Für ein Bild fehlt eine Breitenangabe, sonst stünde es in
  Originalgröße da.
- **Betroffen:** `app/ueber-uns/page.tsx`, `app/globals.css`. Kein API-Eingriff.
- **Verifikation:** Prüfkette am Exit-Code, lokal im Browser ansehen (es ist
  eine reine Sichtsache), danach Deploy und Nachprüfung in Produktion.
- **Ergebnis: ABGESCHLOSSEN.** `tsc` sauber, Lint zurück auf die eine alte
  Warnung, Testkette **exit=0**. Deployed als **`42cabc7a`**; in Produktion
  `/`, `/admin`, `/account`, `/ueber-uns` je 200, der neue Satz und
  `about-logo` sind da, „BRÜDER · BRANDY · BALL" ist weg.
- **Am laufenden Bild nachgemessen, nicht nur angesehen:** Logo geladen
  (500×333 natürlich, 190 px dargestellt), mittig im Abschnitt, goldener
  Hintergrund, am Telefon kein Querlauf.
- **Ein Fehlalarm von mir:** Die erste Messung meldete „nicht zentriert". Die
  7 px Abweichung waren die **Bildlaufleiste** — verglichen wurde gegen die
  Fenstermitte statt gegen die Mitte des Elternelements. Das Layout war immer
  richtig, die Messung war falsch gestellt.
- **`.about-signature` entfernt**, weil kein Element sie mehr benutzt. Tote
  Fracht im Stylesheet ist genau das, was mir beim vorigen Punkt aufgefallen
  war — dann hinterlasse ich nicht selbst welche.
- **`eslint-disable` für `no-img-element`** wie in `site-chrome.tsx`, das
  dasselbe Logo auf demselben Weg einbindet. Ohne die Zeile stand die
  Lint-Ausgabe bei 2 Warnungen statt 1.
- **Versäumnis, das hier hingehört:** Dieser Eintrag blieb nach dem Deploy auf
  `LÄUFT` stehen und wurde erst beim nächsten Auftrag geschlossen. Genau der
  Zustand, den ich heute früh in sieben Fällen aufgeräumt habe. **Das Schließen
  gehört an das Ende des Auftrags, nicht an den Anfang des nächsten.**

### 2026-08-08 — Drei neue Punkte in den Arbeitsvorrat

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Vom Betreiber genannt:** kleine Text- und Inhaltsanpassungen, ein Weg zum
  **manuellen Einstellen** von Karten, die noch nicht bei eBay sind
  („Vorverkauf"/„Lagerverkauf"), und eine **richtige Adminkonsole**, weil
  `/admin` für das Anpassen einzelner Angebote nicht reicht.
- **Nur Dokumentation** — `docs/ai-todo.md`. Kein Code.
- **Vor dem Schreiben im Code nachgesehen**, damit die Aufgaben nicht gegen
  Wände laufen, die schon dastehen:
  - **Der Waisen-Sweep würde manuelle Karten wieder abräumen.**
    `lib/ebay-sync.ts` setzt jedes Produkt mit `kind = 'EBAY_SYNCED'` **ohne
    Listing-Zeile** auf `INACTIVE`. Bei einem 3-Minuten-Takt verschwände eine
    von Hand angelegte Karte binnen Minuten. Sie braucht also eine **eigene
    Art**, nicht bloß ein fehlendes Listing.
  - **`products.kind` trägt eine Prüfbedingung** (`IN ('EBAY_SYNCED',
    'PRELISTED')`). Eine neue Art heißt **Migration** — und damit ist der
    „nächste ohnehin nötige Schemaschritt" da, auf den SEC-12 seit dem
    2026-08-07 wartet. Gehört gebündelt.
  - **Die Detailseite verknüpft `ebay_listings` mit `innerJoin`.** Eine Karte
    ohne Listing liefert dort **404**, egal wie gut sie sonst gepflegt ist.
  - **`PRELISTED` ist nicht dasselbe.** Die Vormerkliste ist eine Ankündigung
    ohne Bestand (`quantity` fest auf 0, Aktion „Vormerken"). Der Betreiber
    will Karten, die man **kaufen** kann — das ist eine dritte Art, keine
    Erweiterung der zweiten.
- **Der erste Punkt bleibt bewusst unscharf** und wird als Sammelstelle
  angelegt: „kleine Anpassungen an Texten und Inhalten" ist ohne Liste nicht
  abarbeitbar. Die konkreten Stellen muss der Betreiber nennen; danach gehören
  sie dort hinein.

- **Ergebnis: ABGESCHLOSSEN.** Angelegt als Punkt 10 (Texte, Sammelstelle),
  11 (Karten von Hand einstellen) und 12 (Adminkonsole). Testkette exit=0.
- **Die Reihenfolge steht ausdrücklich dabei:** 11 und 12 gehören zusammen und
  ziehen Punkt 8 mit — manuelle Karten brauchen eine neue Produktart, die
  braucht eine Migration, und auf die wartet SEC-12. **Adminkonsole zuerst**,
  sonst fehlt die Oberfläche zum Anlegen.
- **Punkt 10 ist bewusst nicht abarbeitbar** und sagt das auch. Er trägt drei
  Kandidaten, die mir beim Arbeiten aufgefallen sind — ausdrücklich als
  **unbestätigt** markiert. Texte zu ändern, die niemand angefordert hat, wäre
  schlimmer als sie zu lassen.

### 2026-08-08 — Verhandeln sichtbar machen (ai-todo Punkt 7)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Vom Betreiber beauftragt.** Der letzte Punkt der Liste, der Umsatz bringt
  statt Risiko zu senken. Seine Vorbedingungen sind heute alle gefallen.
- **Warum überhaupt:** Die Verhandlungsfunktion ist gebaut und läuft, aber
  **nirgends steht, dass es sie gibt** — außer im Formular auf der
  Detailseite, das man erst findet, wenn man schon dort ist. Dabei ist sie die
  Antwort auf „warum hier bestellen statt auf eBay".
- **Die Regeln kommen aus dem Code, nicht aus dem Gedächtnis** — ein Text, der
  etwas anderes verspricht als `lib/price-offers.ts` einlöst, ist schlimmer als
  gar keiner:
  - `MAX_OFFERS_PER_PRODUCT = 3` — drei Vorschläge je Karte
  - `OFFER_VALIDITY_HOURS = 48` — ein angenommener Preis gilt 48 Stunden
  - `MIN_DISCOUNT_CENTS = 50` — **der Vorschlag muss mindestens 50 Cent unter
    dem Preis liegen.** Diese Regel stand bisher nirgends im Text; wer sie
    nicht kennt, läuft in eine Ablehnung, die er nicht versteht.
  - Kundenkonto nötig (`signedIn`)
- **Wo:**
  1. **Startseite:** ein eigener Abschnitt zwischen Galerie und Verweiskacheln.
  2. **`/karten`:** ein Satz über dem Raster, dort entscheidet sich der Blick.
  3. **Detailseite:** das Formular lädt deutlicher ein und nennt die 48 Stunden
     und den Mindestabstand.
- **Ohne eine Zeile neues CSS**, und das ist kein Geiz: `.split-section`,
  `.split-copy`, `.split-panel` und `.panel-card` stehen vollständig im
  Stylesheet, werden aber **nirgends** benutzt — Überbleibsel vom Entschlacken
  der Startseite am 2026-08-06. Der Abschnitt benutzt sie und macht damit totes
  Gewicht wieder lebendig, statt daneben eine zweite Lösung zu bauen.
- **Ein Fund, der direkt aus der heutigen Auktionsänderung folgt:** Die Kachel
  „Alle Karten" verspricht auf der Startseite „Festpreis, **Auktion** und
  Vormerkliste". Auktionen erscheinen seit heute nicht mehr im Shop — das ist
  jetzt ein falsches Versprechen und wird mit korrigiert.
- **Was der Text nicht sagen darf:** dass man bei Auktionen verhandeln kann.
  Dort wird auf eBay geboten. Da Auktionen im Shop gar nicht mehr auftauchen,
  ist die Gefahr kleiner geworden, aber der Satz gehört trotzdem nicht hinein.
- **Betroffen:** `app/page.tsx`, `app/karten/page.tsx`,
  `app/karten/[id]/offer-form.tsx`. Kein API-Eingriff, keine Migration.
- **Verifikation:** Prüfkette **am Exit-Code**, nicht an einer gefilterten
  Ausgabe — der Fehler aus dem vorigen Auftrag. Danach die Seiten **im Browser
  ansehen**, weil es eine reine Oberflächenänderung ist und Tests dafür wenig
  aussagen.
- **Ergebnis: ABGESCHLOSSEN.** `tsc` sauber, Lint 0 Fehler, Testkette
  **exit=0** (diesmal am Exit-Code geprüft). Deployed als **`9fa8404f`**.
- **Lokal im Browser geprüft, bevor irgendetwas hinausging:** Abschnitt
  vorhanden, 1265 px breit ohne Querlauf; am Telefon (375 px) **einspaltig**,
  ebenfalls kein Querlauf — die vorhandene 850-px-Regel deckt `.split-section`
  bereits ab, nachgemessen statt der Datei geglaubt.
- **In Produktion nachgeprüft:** `/`, `/admin`, `/account`, `/karten` je 200.
  Startseite trägt „JEDER PREIS IST EIN ANFANG" und „Mach uns ein Angebot";
  `/karten` den Verhandlungssatz; die Detailseite die neue Einladung. Der
  Hinweis auf die 50 Cent erscheint nur im angemeldeten Zustand und ist
  deshalb **über das Bündel** belegt: `page-Dun71uQr.js` enthält ihn, und die
  Detailseite lädt genau dieses Bündel.
- **Die Propagierungsverzögerung ist wieder aufgetreten**, und ich wäre ihr
  fast aufgesessen: Direkt nach dem Deploy fehlte der Satz auf `/karten`, das
  alte Bündel wurde noch ausgeliefert. Sekunden später war beides da. **Erst
  nachfassen, dann urteilen** — dieselbe Beobachtung wie am 2026-08-06 und
  heute Vormittag.
- **Nebenbei korrigiert:** Die Kachel „Alle Karten" versprach „Festpreis,
  Auktion und Vormerkliste". Auktionen erscheinen seit heute nicht mehr im
  Shop — der Satz war ein Versprechen, das der Katalog nicht mehr einlöst.
- **`autoPort` in `.claude/launch.json`**, weil Port 3000 von einer anderen
  Sitzung belegt war. Der Entwicklungsserver braucht die Nummer hier nicht.
  **Achtung für die nächste Sitzung:** `vinext` sucht sich trotzdem selbst
  einen Port (hier 3001) und ignoriert die Zuweisung des Vorschau-Werkzeugs —
  die tatsächliche Adresse steht in `preview_logs`, nicht in der Antwort von
  `preview_start`.

### 2026-08-08 — Drei Verstärkungen gegen Doppelverkäufe

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Vom Betreiber beauftragt**, nachdem er gefragt hatte, wie man sich weiter
  schützen kann. Punkte 1 und 2 ausdrücklich freigegeben; Punkt 3 hat er selbst
  entschieden, indem er die Regel nannte: **Auktionen bleiben ausschließlich bei
  eBay und sollen gar nicht erst im Shop landen.**

#### 1. Die Rücknahme sofort anstoßen statt auf den Cron zu warten

`processEbayOutbox` hängt ausschließlich im geplanten Lauf. Der Auftrag entsteht
zwar sofort beim Abrechnen, wird aber erst beim nächsten Schlag ausgeführt —
**bis zu 3 Minuten**, in denen ein eBay-Käufer dieselbe Karte kaufen kann. Das
ist die einzige verbleibende Lücke, die ein echtes Risiko trägt.

- **Wie:** Am Ende von `settlePaidOrder` — dort, wo der Auftrag entsteht —
  `waitUntil(processEbayOutbox(db))`. **Nicht `await`:** Der Kunde soll nicht
  auf einen eBay-Aufruf warten, dessen Zeitgrenze bei 30 Sekunden liegt.
  `waitUntil` aus `cloudflare:workers` ist verfügbar, vorher am Typprüfer
  belegt. **Nicht einfach ohne `await` feuern** — eine nicht angemeldete Zusage
  wird abgebrochen, sobald die Antwort steht.
- **Der Cron bleibt** als Netz für Fehlschläge und Wiederholungen.
- **In `settlePaidOrder`, nicht in den Routen:** Beide Zahlungswege (Capture und
  Webhook) laufen dort hindurch. In den Routen müsste es zweimal stehen, und
  eine der beiden Stellen würde irgendwann vergessen.

#### 2. Sichtbar machen, wenn die Bestandsprüfung nicht laufen konnte

`ebaySoldOutMessage` gibt bei einem eigenen Fehler `null` zurück und lässt den
Verkauf durch — **richtig so**, sonst hielte eine eBay-Störung den ganzen Shop
an. Aber es geschieht **lautlos**: Der Verkäufer packt die Karte ein, ohne zu
wissen, dass niemand nachgesehen hat, ob sie noch da ist.

- **Wie:** Der Wächter unterscheidet künftig „geprüft, alles da" von „konnte
  nicht prüfen". Das Ergebnis wandert in die **Verkäufernachricht** — dort, wo
  der Betreiber noch handeln kann, bevor er das Paket packt.
- **Drei Zustände, weil es drei gibt:** `OK`, `FEHLGESCHLAGEN` (Prüfung lief,
  aber eBay antwortete nicht) und `NICHT_GELAUFEN` — letzteres für über den
  **Webhook** abgerechnete Bestellungen, denn dieser Weg ruft den Wächter gar
  nicht auf. Das war mir vor dem Lesen nicht klar und ist der Grund, warum
  zwei Zustände zu wenig wären.
- **Nur bei Abweichung wird gewarnt.** Eine Zeile „alles geprüft" in jeder Mail
  stumpft ab; eine Warnung, die selten kommt, wird gelesen.

#### 3. Auktionen erscheinen nicht mehr im Katalog

**Ein Fund, kein Vorsorgeriegel:** Der Katalog filtert Auktionen **nicht**, er
beschriftet sie nur (`app/api/products/route.ts:57`). Eine Auktion würde also
im Shop erscheinen **und kaufbar sein** — während die Warteschlange sie beim
Verkauf bewusst überspringt, weil ihre Menge nicht änderbar ist. Der Shop könnte
sie verkaufen, eBay böte sie weiter an, und der Vorgang stünde nur als Warnung
im Protokoll.

- **Dass es heute nicht auffällt, ist Zufall:** Alle 294 aktiven Angebote sind
  Festpreis. Am Tag der ersten Auktion wäre das Loch da.
- **Wie:** `istImKatalogSichtbar` bekommt den Angebotstyp und weist `AUCTION`
  ab. Liste und Detailseite ziehen nach; die Detailseite antwortet dann mit 404
  wie bei jeder anderen nicht verfügbaren Karte.
- **`PRELISTED` bleibt unangetastet** — die Vormerkliste hat weder Listing noch
  Bestand und wird vor der Typprüfung durchgelassen. Dieselbe Falle wie beim
  letzten Umbau dieser Datei.

- **Betroffen:** `lib/paypal/settle-order.ts`, `lib/ebay-stock-guard.ts`,
  `lib/email/notify.ts`, `lib/email/templates.ts`,
  `lib/catalog-availability.ts`, `app/api/paypal/capture/route.ts`,
  `app/api/paypal/orders/route.ts`, `app/api/paypal/webhook/route.ts`,
  `app/api/products/route.ts`, `app/api/products/[id]/route.ts`, dazu die
  Tests `catalog-availability`, `email`. **Keine Migration.**
- **Verifikation:** Tests mit Rot-Nachweis je Teil, Prüfkette, Deploy aus dem
  Hauptverzeichnis, danach `/admin` und `/account` prüfen.
- **Ergebnis: ABGESCHLOSSEN.** `tsc` sauber, Lint 0 Fehler, `npm test`
  **253/253**. Deployed als **`515eb26d`**. Nachgeprüft: `/`, `/admin`,
  `/account`, `/karten` je 200, und `/api/products` liefert unverändert **294**
  Karten, alle als „Festpreis" — der Auktionsfilter hat also nichts
  weggenommen, was er nicht sollte.
- **Rot-Nachweis je Teil:** Auktionsfilter entfernt → 1 Test fällt;
  Bestandshinweis auf „immer null" gesetzt → 2 Tests fallen.
- **Eine Korrektur an mir selbst, die ins Protokoll gehört:** Ich hatte für
  Punkt 1 `waitUntil` aus `cloudflare:workers` vorgesehen und dessen
  Verfügbarkeit angeblich am Typprüfer belegt. **Der Beleg war wertlos:** Die
  Probe-Datei hieß `.waituntil-probe.ts` mit führendem Punkt und wurde von der
  tsconfig nie erfasst — der Prüflauf war leer, und ich habe „keine Fehler" als
  „verfügbar" gelesen. `cloudflare:workers` exportiert nur `env`.
  **Wer eine Verfügbarkeit prüft, muss sicherstellen, dass die Probe überhaupt
  gelaufen ist** — ein leeres Ergebnis ist kein Ergebnis. Dieselbe Fehlklasse
  wie bei der leeren `tail`-Ausgabe zwei Aufträge zuvor.
- **Deshalb umgesetzt als bewusstes Warten mit eigener Zeitgrenze** (5 s statt
  30 s, höchstens 3 Aufträge). Ohne `await` zu feuern wäre schlechter: Die
  Laufzeitumgebung bricht eine nicht angemeldete Zusage ab, sobald die Antwort
  steht, und der Auftrag bliebe halb erledigt liegen. Der geplante Lauf bleibt
  das Netz — was hier in die Zeitgrenze läuft, steht auf `RETRY_WAIT`.
- **Ein Fehler im Vorgehen, nicht im Code, und er hätte teuer werden können:**
  Ich habe **auf roter Kette deployed**. Meine Befehlskette lautete sinngemäß
  `npm test | grep … && wrangler deploy` — und `grep` war erfolgreich, weil es
  Zeilen fand, nicht weil die Tests grün waren. Der Deploy lief also trotz
  2 Fehlschlägen durch. Beide waren stale Zusicherungen über umbenannte
  Bezeichner (`ebaySoldOutMessage` → `ebayBestandspruefung`, `return null` →
  `meldung: null`), am Quelltext nachgeprüft, kein Produktfehler — Glück, nicht
  Können. **Künftig auf den Exit-Code prüfen** (`npm test; echo $?`) und nicht
  auf die Ausgabe eines Filters.

### 2026-08-08 — Import-Takt auf 3 Minuten, und ein Test, der die richtige Grenze misst

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Anlass:** Der Betreiber fragte, welcher Takt ohne Mehrkosten möglich ist.
  Beantwortet mit gemessenen Zahlen statt Schätzungen — und dabei kam heraus,
  dass der bestehende Test die falsche Grenze bewacht.
- **Gemessen, nicht geschätzt:**
  - **D1 je Lauf:** ~6.500 Zeilen gelesen, **0 geschrieben** (Fenster
    10:00–11:00 UTC, genau ein Lauf darin). Vor dem Diff-Umbau waren es ~5.400
    geschriebene je Lauf.
  - **Rechenzeit je Lauf:** **9,8 ms**. Nachgestellt mit echtem Zerlegecode und
    einer Antwort in echter Größe (294 Angebote, 209 KB, zwei Seiten), `fetch`
    gestubbt. 200 Durchläufe in einem Messfenster, weil Windows CPU-Zeit nur in
    15,6-ms-Schritten misst und ein Einzellauf darunter liegt.
  - **eBay je Lauf:** 2 Trading-Aufrufe (200 Angebote je Seite) + 1
    Token-Tausch über `/identity/`, der nicht gegen das Trading-Kontingent zählt.
- **Die Grenze ist eBay, nicht Cloudflare.** Der Betreiber hat die Tabelle aus
  dem Entwicklerportal beigebracht: **Trading API 5.000 Aufrufe/Tag** — und
  zwar als **gemeinsamer Topf** für alle Trading-Aufrufe. Bei uns teilen ihn
  vier Verbraucher: Sync, Beschreibungsabfrage beim ersten Öffnen einer Karte,
  Bestandsprüfung an der Kasse, eBay-Rücknahmen. Cloudflare liegt bei jedem
  denkbaren Takt unter 2 % seiner Kontingente.
- **Der bestehende Test bewacht zwei überholte Zahlen:**
  `tests/ebay-stock-check.test.mjs` rechnet mit **100.000 Zeilen/Tag** — das
  ist der **Gratis**-Tarif, den das Projekt am 2026-08-07 verlassen hat — und
  mit **5.396 Zeilen je Lauf**, was seit dem Diff-Umbau **0** ist. Er würde
  jeden Takt unter etwa 78 Minuten ablehnen, und zwar aus Gründen, die es nicht
  mehr gibt.
- **Wie:** Takt auf `*/3 * * * *`. Der Test misst künftig die **eBay**-Grenze
  und gibt dem Sync ausdrücklich nur einen **Anteil** des gemeinsamen Topfes,
  damit die übrigen drei Verbraucher Platz behalten. Die D1-Prüfung bleibt, nur
  mit den gemessenen Zahlen und dem Budget des bezahlten Tarifs.
- **Warum ein Anteil und keine Vollausschöpfung:** Ein Test, der dem Sync alle
  5.000 zugesteht, ginge genau in dem Moment durch, in dem die Kasse keine
  Bestandsprüfung mehr machen kann. Die Reserve ist der eigentliche Zweck.
- **Der Wachstumssprung gehört in den Test:** Zwei Seitenabrufe gelten bis 400
  Angebote. Ab 401 werden es drei, ab 601 vier — der Verbrauch steigt
  sprunghaft mit dem Sortiment, nicht gleitend. Wer das nicht weiß, wundert
  sich später über einen plötzlich gerissenen Deckel.
- **Betroffen:** `wrangler.toml`, `tests/ebay-stock-check.test.mjs`,
  `docs/ai-todo.md`. Kein Schemaeingriff, keine Produktionsdaten.
- **Rückweg:** eine Zeile in `wrangler.toml` und ein Deploy.
- **Ergebnis: ABGESCHLOSSEN.** `tsc` sauber, Lint 0 Fehler, `npm test`
  **247/247**. Deployed als Version **`ab6d564d`**; die Deploy-Ausgabe
  bestätigt `schedule: */3 * * * *`.
- **In Produktion belegt, nicht nur ausgeliefert:** Der erste Lauf im neuen
  Takt steht um **11:03:43** auf `SUCCEEDED` — davor lagen zwei Stunden
  Abstand (10:00, 08:00, 06:00). Ein einzelner Lauf beweist den Abstand noch
  nicht; die Folge wurde deshalb über mehrere Schläge nachgezählt.
- **Rot-Nachweis für den neuen Test:** 2-Minuten-Takt geht durch (1 440
  Aufrufe ≤ 2 500), Minutentakt wird abgelehnt (2 880 > 2 500). Die Grenze
  sitzt also dort, wo sie hingehört, und nicht irgendwo.
- **Zwei Zahlen, die künftige Sitzungen brauchen werden:**
  - `ANGEBOTE = 294` im Test ist der Stand vom 2026-08-08. **Ab 401 Angeboten
    werden aus zwei Seitenabrufen drei** — wer das Sortiment vergrößert und die
    Zahl nicht nachzieht, reißt den Deckel ohne Vorwarnung.
  - `ANTEIL_FUER_SYNC = 0.5` ist eine **Entscheidung, keine Messung.** Die
    andere Hälfte gehört Beschreibungsabfrage, Kasse und Rücknahmen. Wenn
    deren echter Verbrauch einmal gemessen ist, gehört der Anteil überprüft.
- **Was ich nicht messen konnte:** die Rechenzeit auf Cloudflares Maschinen.
  `wrangler tail` verlangt im nicht-interaktiven Betrieb einen
  `CLOUDFLARE_API_TOKEN`, den diese Umgebung nicht hat — `deploy` und
  `d1 execute` laufen dagegen über die zwischengespeicherte Anmeldung. Die
  9,8 ms stammen daher aus einer Nachstellung auf dem Rechner des Betreibers,
  nicht aus der Produktion. Die belastbare Zahl steht im Cloudflare-Dashboard
  unter Workers & Pages → brandycards-webshop → Metrics. Bei 0,5 % Auslastung
  ist die Unsicherheit folgenlos; bei einem künftigen, teureren Lauf wäre sie
  es nicht.

### 2026-08-08 — Abnahme des eBay-Schreibpfads (ai-todo Punkt 6)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Vom Betreiber ausdrücklich beauftragt**, beide Entscheidungen: den
  gefahrlosen Test jetzt, und **der Schalter bleibt an**, wenn er durchläuft.
- **Schritt 1 ist erledigt:** „eBay-Schreibzugriff prüfen" meldet „Anmeldung
  erfolgreich". **Der hinterlegte Refresh-Token trägt `sell.inventory`** — die
  größte Unbekannte von Punkt 6 ist damit weg, und es brauchte kein Angebot
  dafür.
- **Der Testkandidat, und warum er gefahrlos ist:** Listing
  `7e663f3998c489937af88ecfc302e759`, ItemID **`398200679813`** („Topps Finest
  25/26 Lamine Yamal"). Unsere Datenbank führt es als `ENDED` — **aber darauf
  verlasse ich mich nicht.** Bei eBay selbst nachgesehen: Die Angebotsseite
  sagt „Dieses Angebot wurde vom Verkäufer am Do, 6. Aug um 08:17 beendet" und
  zeigt **BEENDET**. Ein Schreibaufruf dagegen kann nichts beenden, was noch
  läuft. *(Der Abruf per `curl` scheitert an eBays Bot-Sperre mit 403; über den
  Browser geht es.)*
- **Was der Test belegt:** Anmeldung, Anfrageformat, Zuordnung der Fehlernummer
  und den Outbox-Lauf samt Statuswechsel. Erwartung: eBay antwortet mit
  „bereits beendet", `reviseEbayItemQuantity` gibt `ALREADY_ENDED` zurück, der
  Auftrag geht auf `SUCCEEDED`.
- **Was er ausdrücklich NICHT belegt:** dass die Menge eines **laufenden**
  Angebots wirklich auf 0 fällt. Dafür bräuchte es ein Wegwerf-Angebot. Diese
  Lücke bleibt offen und gehört so ins ai-todo.
- **Ein Nebenergebnis ist wertvoll, egal wie es ausgeht:** Die Liste
  `ALREADY_ENDED_CODES` (`291`, `21916750`, `1047`) ist **geraten**. Antwortet
  eBay mit einer anderen Nummer, geht der Auftrag auf `RETRY_WAIT` statt
  `SUCCEEDED` — und wir kennen die echte Nummer. Das ist kein Fehlschlag,
  sondern der eigentliche Erkenntnisgewinn.
- **Drei Eingriffe, zwei davon jenseits der Dauerfreigabe:**
  1. `EBAY_WRITE_ENABLED = "true"` in `wrangler.toml`. **Ab dann nimmt jeder
     bezahlte Verkauf die Karte auch bei eBay aus dem Angebot** — das Ziel von
     Punkt 6. Vorher geprüft: `ebay_outbox` ist **leer**, es kann also nichts
     Unbeabsichtigtes mitlaufen.
  2. **Eine Zeile in `ebay_outbox`** — schreibender Eingriff in
     Produktionsdaten, vom Betreiber beauftragt.
  3. Ein Auslöser von Hand, weil `processEbayOutbox` **nur** im geplanten Lauf
     hängt (`0 */2 * * *`, nächster Schlag 12:00 UTC). Neuer Adminknopf
     „eBay-Rücknahmen jetzt ausführen"; er bleibt auch danach nützlich, weil ein
     hängender Auftrag sonst zwei Stunden liegt.
- **Betroffen:** `wrangler.toml`, neu `app/api/admin/ebay/outbox/run/route.ts`,
  `app/admin/page.tsx`. **Keine Migration.**
- **Rückweg:** Schalter zurück auf `false` und deployen; die Outbox-Zeile lässt
  sich auf `CANCELLED` setzen. Beim Angebot selbst gibt es nichts
  zurückzunehmen — es ist bereits beendet.
- **Ergebnis: ABGESCHLOSSEN — der Test ist bestanden.** Der Auftrag ging beim
  **ersten** Versuch auf `SUCCEEDED`, `last_error` leer, um 10:29:53 UTC. Damit
  sind Anmeldung, Anfrageformat, Fehlerzuordnung, Outbox-Lauf und Statuswechsel
  an echten Daten belegt. **`EBAY_WRITE_ENABLED` bleibt an**, wie beauftragt —
  ab jetzt nimmt jeder bezahlte Verkauf die Karte auch bei eBay aus dem
  Angebot. Deployed: `b86bd6f2` (Schalter + Auslöser), danach `49b00f35`.
- **Zwei Nachträge, die aus dem Test entstanden sind:**
  1. **Ein Riegel gegen das lautlose Abschalten.** Stünde der Schalter wieder
     auf `false`, kehrte `processEbayOutbox` **still** mit 0 zurück; Aufträge
     entstünden weiter und liefen nie. Ein Test in `tests/hardening.test.mjs`
     hält den Wert jetzt fest — dasselbe Muster wie bei `PAYPAL_ENVIRONMENT`,
     das genau so zwei Tage unbemerkt auf Sandbox stand.
  2. **Eine Protokollzeile in `processEbayOutbox`.** `SUCCEEDED` unterscheidet
     **nicht** zwischen „eBay hat die Menge geändert" und „eBay meldete bereits
     beendet, und die geratene Fehlernummer hat gegriffen". Beim Test war
     deshalb nicht feststellbar, welcher Fall eintrat.
- **Nachtrag, und er räumt den offenen Punkt ab:** `wrangler tail` **hat** die
  Zeile doch eingefangen — nur schrieb die Filterkette gepuffert und gab sie
  erst beim Beenden des Prozesses aus, weshalb die Datei zwischendurch leer
  aussah und ich den Versuch als gescheitert abgehakt hatte. Das Protokoll
  sagt:

  ```
  [ebay-outbox] Auftrag erledigt. { ergebnis: 'ALREADY_ENDED' }
  ```

  **Die geratenen `ALREADY_ENDED_CODES` greifen.** eBay hat mit „bereits
  beendet" geantwortet, `reviseEbayItemQuantity` hat das erkannt und als Erfolg
  gewertet — an echten eBay-Daten bestätigt, ohne Wegwerf-Angebot.
- **Lehre für den nächsten Hintergrundlauf:** Eine Pipe mit `grep … | head`
  schreibt gepuffert. Eine leere Ausgabedatei bedeutet **nicht**, dass nichts
  ankam — sie bedeutet, dass der Puffer noch nicht geleert wurde. Ich habe
  daraus zu früh einen Fehlschlag gemacht. Entweder ohne Filter mitschreiben
  oder das Ende des Prozesses abwarten, bevor man urteilt.
- **Was dadurch immer noch offen ist, aber kaum wiegt:** **welche** der drei
  Nummern gegriffen hat, steht nicht im Protokoll — die Zeile hält nur den Zweig
  fest, nicht den Fehlercode. Wer das genauer wissen will, ergänzt
  `tradingErrorCodes(xml)` in der Protokollzeile.
- **Zwei Testzeilen bleiben in `ebay_outbox` stehen** (beide `SUCCEEDED`,
  ItemID `398200679813`, erkennbar am `reason` im Payload). Sie zu löschen wäre
  ein weiterer schreibender Eingriff ohne Nutzen.
- **Weiterhin unbewiesen und durch keinen dieser Tests gedeckt:** dass die Menge
  eines **laufenden** Angebots wirklich auf 0 fällt. Dafür braucht es ein
  Wegwerf-Angebot; steht so in ai-todo Punkt 6.

### 2026-08-08 — Der Schreib-Check braucht einen Knopf, sonst ist er unbenutzbar

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Anlass:** Der Betreiber fragte, **wo** er den `curl`-Befehl ausführen soll.
  Die Frage deckt einen Fehler in meiner eigenen Anleitung auf.
- **Mein Fehler:** Ich hatte geschrieben, man könne die URL „im angemeldeten
  Browser einfach aufrufen". **Das stimmt nicht.** Die Anmeldung hängt am
  `Authorization: Bearer`-Header (`lib/supabase-server.ts:9`), nicht an einem
  Cookie. Eine Navigation in der Adresszeile trägt keinen solchen Header, ein
  blanker `curl` erst recht nicht — **beides ergibt 401**, unabhängig davon, ob
  der Betreiber angemeldet ist. Es ist genau die Falle, die bei SEC-12 schon
  einmal beschrieben wurde, und ich bin hineingelaufen.
- **Konsequenz:** Eine Diagnose, die man nur mit einem von Hand kopierten Token
  aus den Entwicklerwerkzeugen aufrufen kann, ist keine Diagnose. Sie gehört
  dorthin, wo das Token ohnehin mitläuft: in den Adminbereich.
- **Wie:** Ein dritter Knopf in `app/admin/page.tsx`, neben „eBay-Angebote
  synchronisieren" und „eBay OAuth verbinden". Er ruft
  `GET /api/admin/ebay/write-check` mit dem Sitzungstoken auf — dasselbe Muster
  wie `runEbaySync` und `connectEbay` — und zeigt das Ergebnis im vorhandenen
  Meldungsfeld.
- **Der Text muss die Folgefrage gleich mitbeantworten:** Bei Misserfolg soll
  dort stehen, dass der Knopf daneben („OAuth verbinden") die Lösung ist.
  Sonst steht der Betreiber vor einem roten Hinweis ohne nächsten Schritt.
- **Betroffen:** `app/admin/page.tsx`. Kein neuer Endpunkt — die Route steht
  seit `32dfd0f`. Keine Migration.
- **Verifikation:** Prüfkette, Deploy, und **im laufenden Adminbereich
  nachsehen**, dass der Knopf da ist und antwortet. Der Adminbereich ist genau
  die Seite, die Client-Konfiguration braucht — die Pflichtprüfung nach dem
  Deploy fällt hier also mit der Sichtprüfung zusammen.
- **Ergebnis: ABGESCHLOSSEN.** `tsc` sauber, Lint 0 Fehler, `npm test`
  **245/245**. Deployed als Version **`39d943c8`**, Commit `22ead4f`.
- **Die Sichtprüfung ging nicht wie geplant, und der Grund gehört notiert:**
  Ohne Anmeldung rendert `/admin` die Knöpfe gar nicht — es steht nur „Bitte
  melde dich zuerst an." Admin-Zugangsdaten habe ich nicht und soll ich nicht
  haben. **Der Beleg läuft deshalb über das ausgelieferte Bundle:** Der
  Knopftext „eBay-Schreibzugriff prüfen" steht in
  `dist/client/assets/page-dD_19DsN.js` — demselben Chunk, der auch
  „BRANDYCARDS ADMIN" enthält —, und der laufende `/admin` lädt genau diesen
  Chunk. Zusätzlich antwortet `/api/admin/ebay/write-check` ohne Anmeldung mit
  **401**, was nebenbei der beste Beweis dafür ist, dass der `curl`-Weg nicht
  funktioniert hätte.
- **Die Propagierungsverzögerung ist wieder aufgetreten:** Der erste Abruf von
  `/admin` nannte noch einen älteren Chunk, der zweite Sekunden später den
  neuen. Beim Prüfen also nachfassen statt sofort zu urteilen — dieselbe
  Beobachtung wie am 2026-08-06 bei `/karten`.
- **Was weiterhin niemand geprüft hat:** ob der Knopf beim Draufdrücken das
  Erhoffte meldet. Das kann nur der Betreiber, angemeldet. Der Pfad dahin ist
  aber belegt: Route erreichbar, adminpflichtig, Knopf ausgeliefert.

### 2026-08-08 — Die eBay-Schreibanmeldung prüfbar machen, ohne ein Angebot zu opfern

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Anlass:** Der Betreiber fragte, ob für Punkt 6 eine neue Testkarte mit
  neuer ItemID anzulegen sei. Die Frage dahinter — trägt der Token den
  Schreib-Scope? — lässt sich billiger beantworten.
- **Eine Testkarte bei eBay anzulegen ist nicht drin:** Es gibt keinen
  Code-Pfad dafür (`AddFixedPriceItem` existiert nirgends, der Import ist rein
  lesend), die lokalen Zugangsdaten sind veraltet, und es wäre ein echtes
  öffentliches Angebot samt Einstellgebühren. Für einen Menschen sind das zwei
  Minuten in der eBay-Oberfläche, für die KI ein neues Feature.
- **Der billigere Weg:** Ein Token-Tausch verändert bei eBay **nichts**. Genau
  das tut `checkEbayWriteAuth` — Anmeldung mit dem Schreib-Scope und sonst gar
  nichts. Damit ist die Frage klärbar, **bevor** `EBAY_WRITE_ENABLED` fällt und
  ohne eine Karte zu opfern. Erreichbar als
  `GET /api/admin/ebay/write-check`, adminpflichtig. **Das Token steht nie in
  der Antwort**, nur ob es kam.
- **Vorher geprüft, dass der Weg frei ist:** `ebay_outbox` ist in Produktion
  **leer**. Ein Umlegen des Schalters könnte also derzeit nichts gegen ein
  echtes Angebot auslösen — gut zu wissen für den Abnahmetest.
- **Nebenbefund, und er ist der wertvollere Teil:** **Nichts erzwang die
  Rollenprüfung an Adminrouten.** SEC-12 wurde seinerzeit durch Hinsehen
  gefunden, nicht durch eine Regel. Jetzt prüft ein Test alle Routen unter
  `/api/admin` — mit der OAuth-Rückseite als einziger begründeter Ausnahme,
  deren Grund als Kommentar an der Route steht.
- **Ein eigener Fehler dabei, der fast als Befund durchgegangen wäre:** Mein
  erster Testentwurf kannte nur die ausgeschriebene Rollenprüfung und meldete
  **vier** angeblich ungeschützte Routen. Sie sind alle geschützt — über den
  Helfer `requireAdmin` aus `lib/admin-access.ts`. Hätte ich das Ergebnis
  geglaubt statt es nachzusehen, stünde hier jetzt eine erfundene
  Sicherheitslücke. Der Test kennt beide Schreibweisen; **die neue Route
  benutzt den Helfer**, statt die Prüfung ein weiteres Mal nachzubauen.
- **Verifikation:** `tsc` sauber, Lint 0 Fehler, `npm test` **245/245**.
  Rot-Nachweis für den neuen Test geführt (Rollenprüfung aus der neuen Route
  entfernt → er schlägt an). Deployed als **`424f18b6`**, Commit `32dfd0f`.
  Nach dem Deploy: `/`, `/admin`, `/account` je 200, und
  `/api/admin/ebay/write-check` ohne Anmeldung **401**.
- **Abweichung von Regel 1:** Dieser Eintrag entstand **nach** der Arbeit. Der
  Auftrag wuchs aus der Beantwortung einer Frage heraus, und ich habe den
  Übergang von „antworten" zu „bauen" nicht als solchen bemerkt. Genau dafür
  ist die Regel da; beim nächsten Mal früher innehalten.

### 2026-08-08 — eBay-Schreibpfad: verkaufte Karten von eBay nehmen (ai-todo Punkt 6)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Die zweite Richtung des Doppelverkaufs schließen — im Shop verkauft,
  eBay weiß es nicht. Ein Storno bei eBay verschlechtert den Verkäuferstatus,
  das wirkt über den Einzelfall hinaus.
- **Der Befund, bestätigt statt angenommen:** `mapActiveListing`
  (`lib/ebay-sync.ts:23`) setzt `ebayOfferId` fest auf `null`, weil
  `GetMyeBaySelling` eine **ItemID** liefert und keine Inventory-API-Offer-ID.
  `enqueueEbayWithdraw` (`lib/ebay-outbox.ts:13`) steigt genau darauf aus und
  protokolliert nur. **Die Outbox hat noch nie einen Auftrag bekommen** — der
  gesamte Schreibpfad ist unerprobt, nicht nur abgeschaltet.
- **Wie, und warum so:** Nicht die Offer-ID nachrüsten, sondern die Operation
  auf die ItemID umstellen — `ReviseInventoryStatus` (Trading API) mit Menge 0
  statt `withdrawEbayOffer`. `EndItem` wäre der falsche Weg: Es beendet das
  Angebot endgültig, Wiedereinstellen ginge nur als neues Listing mit neuer
  ItemID, und damit bräche die lokale Zuordnung. Menge 0 ist **umkehrbar**.
- **Zwei Dinge, die ich beim Lesen gefunden habe und die im ai-todo nicht
  stehen:**
  1. **Auktionen vertragen `ReviseInventoryStatus` nicht.** Der Aufruf gilt für
     Festpreisangebote; bei einer laufenden Auktion mit Geboten ist eine
     Mengenänderung gar nicht vorgesehen. `ebay_listings.listing_type`
     unterscheidet beides. Auktionen dürfen deshalb **gar nicht erst** in die
     Outbox — sonst erzeugen sie dauerhaft rote Aufträge, die niemand beheben
     kann. Sie werden protokolliert statt eingereiht.
  2. **Es liegen Alt-Aufträge im Format `WITHDRAW_OFFER` vor** — jedenfalls dem
     Code nach; erzeugt wurden nie welche. Der Verarbeiter muss beide
     Operationen kennen, sonst schlägt eine alte Zeile dauerhaft fehl.
- **Der Scope ist das eigentliche Risiko:** Lesend läuft alles mit
  `sell.inventory.readonly`. `ReviseInventoryStatus` braucht den
  Schreib-Scope `sell.inventory`. Ob der vorhandene `EBAY_REFRESH_TOKEN` diesen
  Scope überhaupt umfasst, entscheidet sich bei der Zustimmung — **das lässt
  sich nur am echten Aufruf feststellen**, nicht am Code. Fällt es aus, muss der
  Betreiber die eBay-Zustimmung mit dem Schreib-Scope erneuern.
- **Was ich ausdrücklich NICHT tue:** `EBAY_WRITE_ENABLED` bleibt auf `false`.
  Der Schalter greift auf **echte** Angebote zu; ai-todo Punkt 6 schreibt vor,
  die Umstellung zuerst an einer einzelnen Testkarte nachzuweisen. Bauen und
  ausliefern ist freigegeben, Eingriffe in Fremdsysteme sind es nicht.
- **Betroffen:** `lib/ebay-client.ts` (neuer Trading-Aufruf),
  `lib/ebay-outbox.ts` (Einreihen über ItemID, beide Operationen verarbeiten),
  neu `tests/ebay-outbox.test.mjs`. **Keine Migration** — `ebay_outbox` hat
  `ebay_item_id` bereits, und auf `operation` liegt keine Prüfbedingung.
- **Verifikation:** Tests mit Rot-Nachweis, Prüfkette (`tsc`, Lint, `npm test`),
  Deploy aus dem Hauptverzeichnis. **Der Beweis am echten eBay-Angebot steht
  danach aus** und ist der nächste Schritt, der dem Betreiber gehört.
- **Ergebnis: ABGESCHLOSSEN, mit einer ausdrücklichen Grenze.** Prüfkette grün:
  `tsc` sauber, Lint 0 Fehler (die eine Warnung in `app/admin/page.tsx` ist alt),
  `npm test` **244/244** (15 neue Tests). Deployed als Version
  **`b4421267`**, Commit `63df714`. Nach dem Deploy geprüft: `/`, `/admin`,
  `/account`, `/api/products` und `/karten` je **200** — `/admin` und
  `/account` bewusst dabei, weil nur sie die Client-Konfiguration brauchen.
  Die Bundle-Probe vor dem Deploy fand die Supabase-Konfiguration in
  `dist/client/assets`.
- **Rot-Nachweis, drei Mal einzeln geführt** — jeder von einem sauberen Stand
  aus, damit sich die Eingriffe nicht überlagern: Auktionsfilter ausgehebelt →
  genau 1 Test fällt; „bereits beendet" wieder als Fehler gewertet → 1 Test;
  nur den Lese-Scope angefordert → 1 Test. Beim ersten Anlauf hatte ich zwei
  Eingriffe übereinandergelegt und 4 Ausfälle gemessen — die Zahl sagte dann
  nichts mehr darüber, welcher Test welchen Fehler fängt.
- **Der Scope ist geprüft, soweit es ohne Schreibzugriff geht — und das
  Ergebnis ist ehrlich gesagt: unentschieden.** `EBAY_WRITE_OAUTH_SCOPE` steht
  bereits korrekt auf `…/sell.inventory` in der `wrangler.toml`. Ein
  Token-Tausch verändert bei eBay nichts, taugt also als Probe; mit den
  **lokalen** Zugangsdaten aus `.env.local` scheitert er aber mit
  `invalid_grant` — **und zwar für Lese- wie Schreib-Scope gleichermaßen.**
  Damit ist nicht der Scope das Problem, sondern der lokale Refresh-Token ist
  schlicht veraltet; die Produktion nutzt eigene Cloudflare-Secrets. Die Probe
  sagt über sie nichts.
- **Was über die Produktion belegt ist:** Ihr Token trägt **lesend** — der
  Sync-Lauf um 08:00 UTC steht auf `SUCCEEDED` ohne Fehlermeldung. Ob derselbe
  Token den **Schreib**-Scope umfasst, entscheidet sich bei der eBay-Zustimmung
  und lässt sich **nur am ersten echten Schreibaufruf** feststellen. Fällt er
  mit `invalid_scope` oder `931` aus, muss der Betreiber die Zustimmung mit
  `sell.inventory` erneuern.
- **`EBAY_WRITE_ENABLED` steht weiterhin auf `false`**, und das ist kein
  Versehen. Der Schalter greift auf echte Angebote zu; ai-todo Punkt 6 schreibt
  den Nachweis an einer einzelnen Testkarte davor. Die Freigabe des Betreibers
  deckt Deployen, Committen und Pushen — nicht Eingriffe in Fremdsysteme.
- **Was der Code jetzt kann, ohne dass es jemand sieht:** Nichts. Solange der
  Schalter steht, verarbeitet `processEbayOutbox` keinen einzigen Auftrag. Die
  Aufträge **entstehen** aber ab jetzt — jeder bezahlte Verkauf legt eine Zeile
  in `ebay_outbox` an. Das ist erwünscht: Wird der Schalter später umgelegt,
  arbeitet die Warteschlange nach, statt bei null anzufangen. **Wer in den
  nächsten Tagen `ebay_outbox` ansieht, findet dort `PENDING`-Zeilen — das ist
  der Normalzustand, kein Fehler.**

### 2026-08-08 — Den Protokollstand bereinigen: sieben Einträge auf `LÄUFT`, alle sieben fertig

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Anlass:** Unter „Aktueller Auftrag" stehen **sieben** Einträge auf `LÄUFT`,
  und **jeder einzelne** trägt intern bereits „Ergebnis: ABGESCHLOSSEN". Regel 6
  sagt: Wer hier `LÄUFT` findet, hat einen unterbrochenen Auftrag vor sich und
  muss erst den tatsächlichen Zustand prüfen. Diese Datei behauptet damit sieben
  Abbrüche, die es nicht gab.
- **Warum das mehr ist als Kosmetik:** Der Wert dieser Datei liegt genau darin,
  dass `LÄUFT` etwas bedeutet. Steht es dauerhaft an fertigen Einträgen, lernt
  die nächste Sitzung, das Feld zu überlesen — und übersieht den echten Abbruch,
  für den die Datei gebaut wurde. Der Nachtrag nach Regel 3 ist offenkundig
  mehrfach unterblieben; vermutlich, weil die Sitzungen jeweils direkt in den
  nächsten Punkt weitergelaufen sind.
- **Was ich tue:**
  1. Den tatsächlichen Zustand prüfen, statt den Einträgen zu glauben —
     Arbeitsverzeichnis, Abgleich mit `origin/main`, und für den jüngsten
     Eintrag ein Beleg am **laufenden Shop**, weil dort als Einzigem kein
     Deploy vermerkt ist.
  2. Alle sieben auf `ABGESCHLOSSEN` setzen und unter „Historie" einordnen,
     neueste zuerst — dort stehen sie ohnehin schon in dieser Reihenfolge.
  3. Den Deploy-Beleg beim jüngsten Eintrag nachtragen.
  4. „Aktueller Auftrag" leer und aufnahmebereit hinterlassen.
- **Betroffen:** ausschließlich `docs/ai-handover.md`. **Kein Code, keine
  Migration, kein Deploy, keine Produktionsdaten.**
- **Der Befund, der die Prüfung wert war:** Der jüngste Eintrag (verkaufte
  Karten aus dem Katalog, Versandmail an den Verkäufer, Commit `820e87e`) nennt
  **keine Deploy-Version** — nach Aktenlage wäre er gebaut, aber nicht
  ausgeliefert. Am laufenden Shop ist er es doch: `/api/products` antwortet mit
  `public, max-age=30, stale-while-revalidate=60`, und genau diese Zeile hat
  jener Commit von `60/300` auf `30/60` geändert. Der Deploy hat also
  stattgefunden, nur der Nachtrag fehlte.
- **Was dadurch nicht belegt ist, und das bleibt offen:** Die
  **Verkäufernachricht an `brandycards@gmx.de`** ist weiterhin nur in Tests
  belegt, nicht an echten Daten. Dafür braucht es einen weiteren echten Kauf.
  Der Deploy-Beleg oben sagt über sie nichts.

- **Ergebnis: ABGESCHLOSSEN.** Alle sieben Einträge stehen auf
  `ABGESCHLOSSEN` und unter „Historie", neueste zuerst. „Aktueller Auftrag"
  ist leer. Der überholte Einleitungsabsatz („Zwei Einträge stehen hier
  gleichzeitig") ist weg — er beschrieb einen Zustand vom Vormittag.
- **Gegen Textverlust abgesichert, nicht nur überflogen:** Der Vergleich Zeile
  für Zeile gegen `HEAD` zeigt als einzige Verluste den überholten Absatz und
  sechs `LÄUFT`-Marken; hinzugekommen ist nur dieser Eintrag. Bei einer
  Verschiebung über 650 Zeilen ist das die Prüfung wert — ein `git diff` allein
  hätte hier nur „963 Einfügungen, 931 Löschungen" gemeldet und nichts belegt.
- **Beim Prüfen ist ein echter Widerspruch aufgefallen, kein Formfehler:**
  `ai-todo.md` führte **Punkt 3 (Kunden-E-Mails) als „wartet auf den
  Schlüssel"** — während diese Datei an drei Stellen belegt, dass die Domain
  verifiziert ist, `RESEND_API_KEY` als Secret liegt und **zwei Nachrichten echt
  zugestellt** wurden (Anfragebestätigung 05:45 UTC, Bestellbestätigung aus dem
  Abnahmekauf). Wer nur die Aufgabenliste las, hätte als Nächstes einen
  Schlüssel hinterlegt, der längst liegt. **Punkt 3 ist erledigt**, der
  nächste ungebaute Punkt ist **Punkt 6 (eBay-Schreibpfad)**.
- **Deshalb mit korrigiert:** In `ai-todo.md` der Kopf von Punkt 3, der Absatz
  „Warum diese Reihenfolge" (er behauptete „Wer zahlt, bekommt keine
  Bestätigung") und der Stand-Vermerk, der noch auf dem 2026-08-07 stand. In
  dieser Datei zwei Stellen, die den Abnahmekauf als ausstehend führten.
  **Das Muster ist dasselbe wie bei den sieben `LÄUFT`-Marken:** Der Rumpf
  einer Notiz wurde gepflegt, ihr Kopf nicht — und gelesen wird zuerst der Kopf.
- **Eine Abweichung von Regel 1, offen gesagt:** Eintrag und Ausführung liegen
  in **einem** Commit statt in zweien. Der Auftrag verändert genau die Datei,
  in der der Eintrag steht; ein Vorab-Commit hätte Zeilen angekündigt, die er
  selbst schon schreibt. Es gibt hier auch keinen halben Zustand, der einen
  Abbruch gefährlich machte — es wird kein Code, keine Datenbank und kein
  Deployment berührt. **Für Code-Aufträge gilt die Regel unverändert.**

### 2026-08-08 — Verkaufte Karten verschwinden sofort, und der Verkäufer bekommt die Versanddaten

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Anlass:** Der Betreiber hat nach dem ersten echten Kauf zwei Fehler
  gemeldet, und beide sind ernst, weil sie **jede echte Karte** betreffen:
  1. Die verkaufte Karte stand weiter mit **„1 VERFÜGBAR"** im Katalog.
  2. Es gibt **keine Benachrichtigung an den Verkäufer** — und damit keine
     Lieferadresse, aus der sich ein Versandetikett erzeugen ließe.
- **Sofortmaßnahme, bereits ausgeführt:** Der Testartikel wurde von Hand auf
  `ENDED`/`INACTIVE` gesetzt und ist aus dem Katalog verschwunden (294 statt
  295). Das behebt den Einzelfall, nicht die Ursache.

#### Ursache 1: Der Katalog liest die Menge aus dem falschen Ort

`app/api/products/route.ts:38` nimmt `row.listing?.quantity` — die Menge des
**eBay-Listings**. Die Tabelle `inventory`, in der der Verkauf gebucht wird,
wird **gar nicht abgefragt**. Dasselbe in
`app/api/products/[id]/route.ts` (`quantity: row.listing.quantity`).

Ein Verkauf im Shop setzt `inventory.available_quantity = 0` und
`status = 'SOLD'`, rührt das Listing aber nicht an. Die Karte bleibt deshalb
sichtbar und scheinbar kaufbar, **bis der eBay-Import sie abräumt — bis zu zwei
Stunden.** Ein zweiter Kunde legt sie in den Warenkorb und scheitert erst an der
Kasse.

**Gefährlich ist das nicht** — `app/api/orders/route.ts` prüft den Bestand und
lehnt ab, ein Doppelverkauf ist ausgeschlossen. **Ärgerlich ist es sehr.**

- **Wie:** Beide Routen verknüpfen zusätzlich `inventory` und zeigen die
  **verfügbare** Menge. Karten ohne verfügbaren Bestand fallen aus dem Katalog
  und liefern auf der Detailseite 404, wie jede andere nicht verfügbare Karte.
  Die Entscheidung kommt in eine reine Funktion (`lib/catalog-availability.ts`),
  damit sie ohne Datenbank prüfbar ist.
- **Achtung, zwei Fallstricke:**
  - **`PRELISTED`-Karten (Vormerkliste) haben weder Listing noch Bestand.** Ein
    unbedachter `innerJoin` oder ein Filter auf „Menge > 0" würde sie
    stillschweigend aus dem Katalog werfen. Sie müssen ausdrücklich ausgenommen
    werden.
  - **Fehlt die Bestandszeile bei einer eBay-Karte**, darf das nicht als
    „ausverkauft" gelten — sonst verschwindet bei einem halb geschriebenen
    Import der halbe Katalog. Dann zählt die Listing-Menge.
- **Der Randspeicher bleibt eine Verzögerung, und das gehört gesagt:** Der
  Katalog wird an Cloudflares Rand zwischengespeichert
  (`max-age=60, stale-while-revalidate=300`), im schlechtesten Fall also gut
  sechs Minuten. Ich setze das auf `max-age=30, stale-while-revalidate=60`
  herunter — damit sind es höchstens **90 Sekunden** statt bis zu zwei Stunden.
  **Wirklich „sofort" wäre nur ohne Zwischenspeicher**, und der ist als SEC-05
  bewusst eingebaut worden. Die Entscheidung gehört dem Betreiber; die Zahlen
  stehen hier, damit er sie treffen kann.

#### Ursache 2: Niemand sagt dem Verkäufer, wohin das Paket soll

`notifyOrderPaid` verschickt genau **eine** Nachricht, an den Kunden. Die
Lieferadresse steht in `orders.shipping_address` und wird nirgends zugestellt.
Ohne sie kein Etikett.

- **Wie:** Eine zweite Nachricht an **brandycards@gmx.de** mit allem, was für
  den Versand nötig ist: Bestellnummer, Zeitpunkt, **vollständige
  Lieferadresse**, Positionen, Beträge und die Kontaktadresse des Kunden für
  Rückfragen.
- **Die Adresse kommt als `[vars]`-Eintrag** `SELLER_NOTIFICATION_EMAIL` in die
  `wrangler.toml`, kein Secret. Sie steht ohnehin im Impressum und in der
  Datenschutzerklärung desselben öffentlichen Repositories — kein neuer
  Umstand, aber bewusst geprüft, bevor sie eingecheckt wird.
- **Getrennt abgesichert:** Beide Nachrichten laufen in **eigenen**
  `versucheVersand`-Blöcken. Scheitert die Kundenbestätigung, muss die
  Verkäufernachricht trotzdem hinausgehen — und umgekehrt. Ein gemeinsamer
  Block würde beim ersten Fehler die zweite verschlucken.
- **Der Einmal-Riegel gilt weiter:** `notifyOrderPaid` wird nur vom Gewinner des
  Übergangs `CREATED/APPROVED → CAPTURED` aufgerufen. Der Verkäufer bekommt also
  **eine** Nachricht je Bestellung, nicht zwei — beide Zahlungswege feuern.
- **Betroffen:** neu `lib/catalog-availability.ts`,
  `tests/catalog-availability.test.mjs`; geändert `app/api/products/route.ts`,
  `app/api/products/[id]/route.ts`, `lib/email/config.ts`,
  `lib/email/templates.ts`, `lib/email/notify.ts`, `tests/email.test.mjs`,
  `wrangler.toml`, `.env.example`. **Keine Migration.**
- **Verifikation:** Tests mit Rot-Nachweis für beide Teile; Prüfkette; nach dem
  Deploy die Lieferadresse an einer echten Bestellung belegen — der Betreiber
  kauft dafür erneut.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler,
  `npm test` **229/229** (17 neue Tests).
- **Rot-Nachweis, beide Teile:** Lässt man die Bestandsprüfung wieder auf die
  Listing-Menge zurückfallen, fallen **6** Tests; entfernt man die
  HTML-Maskierung aus der Verkäufernachricht, fällt genau der Test, der den
  präparierten Namen prüft.
- **Am echten Produktionsbau belegt**, nicht nur in Tests: `npm run build`,
  dann `npx wrangler dev --local` mit drei nachgebauten Karten in einer lokalen
  Datenbank (Tabellendefinitionen lesend aus der Produktion geholt).
  - **Katalog:** Die verkaufte Karte ist **weg**, die verfügbare da, und die
    Karte der **Vormerkliste ist geblieben** — der Fallstrick, den ich mir
    selbst gestellt hatte.
  - **Detailseite:** verfügbar → `200` mit `quantity: 1`; verkauft → `404`
    mit „Diese Karte ist nicht verfügbar."
  - **`cache-control`:** `public, max-age=30, stale-while-revalidate=60`.
- **Ein eigener Fehler beim Prüfen, der fast als Befund durchgegangen wäre:**
  Die Detailseite lieferte zuerst auch für die *verfügbare* Karte 404. Ursache
  war **nicht** der Code, sondern meine Testdaten: Die Route verlangt eine
  32-stellige Hex-Kennung (`/^[a-f0-9]{32}$/`) und lehnt vorher ab; meine
  IDs waren zwölf Zeichen lang. **Wer hier prüft, muss echte Kennungsformate
  verwenden** — sonst misst er den Türsteher statt die Wohnung.
- **Was ausdrücklich noch aussteht:** Die Verkäufernachricht ist **nicht** an
  echten Daten belegt. Dafür braucht es einen weiteren echten Kauf; erst dann
  ist bewiesen, dass die Nachricht bei `brandycards@gmx.de` ankommt und die
  Adresse trägt.
- **Deploy nachgetragen am 2026-08-08.** Der Eintrag nannte keine Version, was
  ihn wie „gebaut, aber nicht ausgeliefert" aussehen ließ. Er ist ausgeliefert:
  `/api/products` antwortet in Produktion mit
  `public, max-age=30, stale-while-revalidate=60` — genau die Zeile, die dieser
  Commit (`820e87e`) von `60/300` auf `30/60` geändert hat. Eine ältere Version
  könnte diesen Wert nicht senden. **Die Versionskennung fehlt trotzdem**, weil
  `wrangler deployments list` ohne `CLOUDFLARE_API_TOKEN` in dieser Umgebung
  nicht läuft; wer sie braucht, holt sie interaktiv nach.
- **Der Beleg deckt Ursache 1 ab, nicht Ursache 2.** Dass der Katalogcode live
  ist, sagt nichts darüber, ob die Verkäufernachricht tatsächlich zugestellt
  wird — siehe den Punkt darüber.

### 2026-08-08 — Testartikel für den Live-Abnahmekauf (1 Cent)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** **Schreibender Eingriff in Produktionsdaten**, vom Betreiber
  ausdrücklich beauftragt. Er braucht eine kaufbare Karte, um den ersten
  **echten** PayPal-Kauf durchzuspielen — die ausstehende Abnahme aus
  ai-todo Punkt 0.
- **Kein neuer Artikel, sondern der vorhandene wieder in Betrieb.**
  `ec6c212e96332bdcc93612848694b907` („TESTARTIKEL BrandyCards, bitte nicht
  kaufen") liegt bereits in der Datenbank und wurde vom 08:00-Lauf auf
  `INACTIVE`/`ENDED`/`UNAVAILABLE` gesetzt. Ihn zu reaktivieren ist sauberer,
  als eine zweite Produktzeile mit eigener Bestands- und Listing-Zeile
  anzulegen.
- **Drei `UPDATE`s:** Produkt auf `ACTIVE`, Listing auf `ACTIVE` mit **Preis 1
  Cent**, Bestand auf verfügbar 1 / reserviert 0 / verkauft 0 / `AVAILABLE`.
  Der Bestand muss zurückgesetzt werden, weil der Sandbox-Testkauf vom Vormittag
  dort `sold_quantity = 1` hinterlassen hat.
- **Der Betrag ist nicht 1 Cent, sondern 3,46 €.** Der Versand nach Deutschland
  kostet 3,45 € und kommt hinzu; unter 1 Cent geht der Artikelpreis nicht.
  Gehört gesagt, damit sich niemand über die Abbuchung wundert.
- **Zeitpunkt bewusst gewählt:** angelegt um ~08:2x UTC, der nächste Cron-Schlag
  ist **10:00 UTC**. Beim letzten Mal wurde der Artikel um 06:00:07 angelegt und
  um 06:00:38 vom Import sofort wieder abgeräumt. Das Kauffenster reicht diesmal
  knapp zwei Stunden.
- **Der Import räumt ihn danach von selbst ab** — die erfundene ItemID
  `999000000001` steht nicht in der eBay-Aktivliste. Das ist erwünscht und
  braucht keinen weiteren Eingriff.
- **Der Artikel ist öffentlich sichtbar**, solange er lebt. Dagegen hilft nur
  der unmissverständliche Titel und der Preis; einen versteckten Weg gibt es
  nicht, weil `/api/products` nur `ACTIVE` ausliefert und nur ein aktives
  Listing kaufbar ist.
- **Die Bestandsprüfung vor der Zahlung blockiert nicht.** Sie ruft `GetItem`
  bei eBay auf, eBay kennt die erfundene ItemID nicht und antwortet mit
  `Ack=FAILURE`; `getEbayAvailability` legt dann **keinen** Eintrag an, und ohne
  Eintrag gilt die Karte als „unbekannt" — was den Kauf durchlässt
  (`lib/ebay-stock-check.ts`). Am 2026-08-08 schon einmal so nachgelesen.
- **Betroffen:** ausschließlich Produktionsdaten, drei Zeilen. Kein Code, keine
  Migration, kein Deploy.
- **Rückweg:** Dieselben drei Zeilen zurücksetzen — oder nichts tun, dann
  erledigt es der 10:00-Lauf.
- **Ergebnis: ABGESCHLOSSEN.** Alle drei `UPDATE`s mit `changes: 1`
  durchgelaufen, um ~08:2x UTC.
- **Die schreibenden D1-Befehle gingen diesmal durch.** Beim Durchlauf am
  Vormittag wurden sie zweimal von der Berechtigungsprüfung abgelehnt und
  mussten dem Betreiber übergeben werden. **Die Notiz unter „Offene Punkte", man
  solle im Zweifel gleich den Befehl herausgeben, ist damit überholt** — es
  lohnt sich, es selbst zu versuchen.
- **Am laufenden Shop belegt, nicht in der Datenbank:**
  - `/api/products` liefert **295** Karten statt 294, der Testartikel ist
    darunter mit `priceAmountCents: 1`, Menge 1, Kategorie „Festpreis".
  - Die Detailseite zeigt **„0,01 €"**, **„1 VERFÜGBAR"** und einen aktiven
    Knopf „IN DEN WARENKORB" (`disabled: false`).
- **Erinnerung an den Betrag:** Mit Versand nach Deutschland wird **3,46 €**
  abgebucht, nicht 1 Cent.

### 2026-08-08 — PayPal auf Live (ai-todo Punkt 0)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Punkt 0 — der Punkt, der jeden Verkauf blockierte. `lib/paypal/config.ts`
  fiel mangels `PAYPAL_ENVIRONMENT` auf `sandbox` zurück, der Shop sprach mit
  `api-m.sandbox.paypal.com`, **ein echter Kunde konnte nicht bezahlen.**
- **Der Betreiber hat die Schritte 1–3 gemeldet:** Live-App bei PayPal angelegt,
  Live-Webhook auf `https://shop.brandycards.de/api/paypal/webhook` eingerichtet
  und die drei Secrets `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
  `PAYPAL_WEBHOOK_ID` ersetzt.
- **Mein Teil, Schritt 4:** `PAYPAL_ENVIRONMENT = "production"` in `[vars]` der
  `wrangler.toml` eintragen und deployen. **Kein Geheimnis** — der Wert gehört
  bewusst nicht zu den Secrets, sondern in die versionierte Konfiguration.
- **Dazu ein Riegel, der vorher fehlte:** `getPayPalConfig` fällt bei fehlendem
  oder falsch geschriebenem Wert **still** auf `sandbox` zurück. Das ist als
  Verhalten richtig (kein Absturz), als Betriebszustand aber der schlimmste
  denkbare: Der Shop sähe gesund aus und nähme trotzdem kein Geld ein — genau
  der Zustand, der seit dem 2026-08-06 unbemerkt bestand. Ein Test in
  `tests/hardening.test.mjs` hält deshalb fest, dass `wrangler.toml` den Wert
  auf `production` setzt. Wer ihn je entfernt, bekommt einen roten Lauf statt
  eines stillen Ausfalls.
- **Betroffen:** `wrangler.toml`, `tests/hardening.test.mjs`. **Kein
  Anwendungscode**, keine Migration, keine Änderung an Produktionsdaten.
- **Das Fenster, in dem der Checkout nicht funktioniert, ist jetzt offen** und
  schließt sich mit diesem Deploy: Seit dem Tausch der Secrets liegen
  Live-Zugangsdaten vor, während der Shop noch den Sandbox-Endpunkt anspricht.
  Deshalb hat dieser Durchlauf Vorrang vor allem anderen.
- **Verifikation, und ihre Grenze:** Prüfkette und Deploy belegen, dass die
  Konfiguration steht — `wrangler deploy` listet die Variable auf, und der
  Webhook antwortet mit 400 statt 503 (503 hieße: Webhook-ID leer). **Ob die
  hinterlegten Zugangsdaten gültig sind, kann nur ein echter Kauf zeigen.** Das
  ist keine Nachlässigkeit, sondern eine Grenze: Ein Tokenaufruf gegen
  `api-m.paypal.com` mit fremden Zugangsdaten ist von hier aus nicht führbar,
  ohne die Geheimnisse anzufassen.
- **Rückweg:** Die Zeile entfernen und deployen — der Shop spricht dann wieder
  mit der Sandbox.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler,
  `npm test` **212/212** (2 neue Tests). Deployed als Version **`4a6b7a46`**,
  Commit `bfa479d`, CI vorher grün.
- **`wrangler deploy` bestätigt die Bindung:**
  `env.PAYPAL_ENVIRONMENT ("production")`.
- **In Produktion nachgeprüft:** `/`, `/karten`, `/checkout`, `/account`,
  `/admin` je 200; `/account` ohne „noch nicht konfiguriert";
  `/api/orders` ohne Anmeldung 401; der Webhook antwortet mit **400** und nicht
  mit 503 — 503 hieße, `PAYPAL_WEBHOOK_ID` sei leer. Die neue Webhook-ID liegt
  also vor.
- **Rot-Nachweis:** Mit `PAYPAL_ENVIRONMENT = "sandbox"` fällt genau der neue
  Test (33/34). Ein stiller Rückfall in die Sandbox kann also nicht mehr
  unbemerkt eingecheckt werden.
- **Was hiermit ausdrücklich noch NICHT belegt ist: dass Geld ankommt.** Ob die
  hinterlegten Live-Zugangsdaten gültig sind und der Live-Webhook zustellt,
  zeigt allein ein echter Kauf. Der steht beim Betreiber und ist das
  Abnahmekriterium aus ai-todo Punkt 0.

#### ABGENOMMEN — der erste echte Kauf ist durch

Bestellung **`BC-20260808-89309FCA`**, 2026-08-08 08:29:48 UTC. **Der Shop hat
zum ersten Mal echtes Geld eingenommen.**

| Prüfung | Ergebnis |
|---|---|
| Bestellung | `PAID`, 1 Cent Ware + 345 Cent Versand = **346 Cent** |
| Zahlung | `CAPTURED`, Capture-ID `1LC23949C0153504L`, 346 Cent EUR |
| Bestand | verfügbar 0, reserviert 0, **verkauft 1**, `SOLD` |
| eBay-Outbox | leer (Schreibpfad ist aus, erwartet) |
| Webhook | `PAYMENT.CAPTURE.COMPLETED`, **`PROCESSED`** um 08:29:53.925Z |
| Bestellbestätigung | vom Betreiber bestätigt |

**Damit ist auch die Webhook-Korrektur an echten Daten belegt — und meine
Einschätzung dazu war zu pessimistisch.** Ich hatte notiert, dafür müsse PayPal
dasselbe Ereignis ein zweites Mal zustellen, was sich nicht herbeiführen lasse.
**Falsch:** Der Dubletten-Pfad wird bei *jeder* Zahlung durchlaufen, weil immer
beide Wege feuern — die Rückkehr des Kunden aus PayPal (08:29:48) und der
Webhook fünf Sekunden später (08:29:53). Der Kunde gewann den Übergang, der
Webhook fand `CAPTURED` vor und lief in den Dubletten-Pfad. Genau dieselbe Lage
wie um 06:10 — nur steht die Zeile jetzt auf `PROCESSED` statt auf `RECEIVED`.
Ein direkterer Vergleich ist kaum zu bekommen.

Die alte Zeile `WH-4MD290111R3948627-…` steht weiterhin auf `RECEIVED` und ist
damit die einzige verbliebene im ganzen Bestand — sie taugt als Beleg, wie es
vorher aussah.

### 2026-08-08 — Der Dubletten-Webhook hinterlässt keine falsche Spur mehr

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Der Punkt, der seit dem 2026-08-08 unter „Offene Punkte" stand und
  auf eine Entscheidung wartete — der Betreiber hat ihn heute beauftragt.
  `app/api/paypal/webhook/route.ts` steigt bei `payment.status === "CAPTURED"`
  vorzeitig mit `duplicate: true` aus, **bevor** die Zeile in `webhook_events`
  auf `PROCESSED` gesetzt wird.
- **In Produktion nachgesehen, nicht aus der Notiz übernommen:**
  `WH-4MD290111R3948627-8AM47435BU5710537`
  (`PAYMENT.CAPTURE.COMPLETED`, 2026-08-08T06:10:22.766Z) steht auf `RECEIVED`
  mit leerem `processed_at`. Alle anderen vier Zeilen der Tabelle stehen auf
  `PROCESSED`.
- **Funktional harmlos, aber die Zeile lügt.** Ein erneuter Zustellversuch wird
  ohnehin abgewiesen, weil die Eingangsprüfung (Zeile 68) `RECEIVED` genauso
  behandelt wie `PROCESSED`. Der Schaden ist diagnostisch: Die Zeile sieht aus
  wie ein Ereignis, das mitten in der Verarbeitung hängen geblieben ist, und
  führt jede spätere Suche nach hängenden Webhooks in die Irre. Das wiegt
  schwerer, sobald echtes Geld fließt.
- **Nicht die zwei Zeilen aus der Notiz, sondern eine Zeile weniger.** Statt auf
  dem Dubletten-Pfad ein zweites `PROCESSED`-Schreiben danebenzustellen,
  entfällt das vorzeitige `return`: Der Fall setzt einen Merker und läuft durch
  dasselbe Ende wie jeder andere. **Damit ist die Fehlerklasse weg, nicht nur
  dieser Fall** — ein künftiger Zweig kann die Buchführung nicht mehr
  überspringen, weil es keinen Ausgang mehr gibt, der an ihr vorbeiführt.
- **Dazu eine prüfbare Regel:** Was mit einem `PAYMENT.CAPTURE.COMPLETED`
  geschehen soll, hängt allein am Zustand der Zahlung. Diese Entscheidung
  wandert als reine Funktion nach `lib/paypal/webhook-decision.ts`
  (`CAPTURED` → Dublette, `REFUNDED` → Konflikt, sonst einziehen) und wird
  ohne Netz und Datenbank geprüft. Wichtig ist dabei vor allem, dass
  **`REFUNDED` niemals als einziehbar** durchgeht.
- **Betroffen:** neu `lib/paypal/webhook-decision.ts` und
  `tests/paypal-webhook.test.mjs`; geändert
  `app/api/paypal/webhook/route.ts`. **Keine Migration, keine Änderung an
  Produktionsdaten.**
- **Die bestehende Zeile wird nicht repariert.** Sie rückwirkend auf
  `PROCESSED` zu setzen wäre ein schreibender Eingriff in Produktionsdaten und
  damit rücksprachepflichtig; der Auftrag lautete auf die Korrektur des Pfades.
  Der Befehl steht unten, falls der Betreiber sie doch bereinigen will.
- **Verifikation:** Tests mit Rot-Nachweis; Prüfkette; nach dem Deploy bleibt
  der Beleg an echten Daten aus, weil dafür eine zweite Zustellung desselben
  PayPal-Ereignisses nötig wäre — das lässt sich nicht herbeiführen, ohne eine
  echte Zahlung zu wiederholen. **Das wird hier ausdrücklich als Grenze
  festgehalten und nicht als „geprüft" ausgegeben.**
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler,
  `npm test` **210/210** (6 neue Tests).
- **Gebaut:** `lib/paypal/webhook-decision.ts` mit `webhookCaptureAction`
  (`CAPTURED` → Dublette, `REFUNDED` → Konflikt, sonst einziehen); in der Route
  ersetzt ein Merker das vorzeitige `return`, und **alle** Pfade laufen durch
  dasselbe Ende, das `PROCESSED` schreibt.
- **Rot-Nachweis:** Mit wieder eingebautem `return` fällt genau der Test „der
  Webhook verlässt die Verarbeitung nur an einer Stelle" (5/6). Der Test misst
  also die Struktur, um die es geht, und nicht nur die Formulierung.
- **Die Antwort unterscheidet weiterhin** zwischen `duplicate: true` und
  `processed: true` — PayPal soll eine Dublette als erledigt sehen, sonst
  wiederholt es die Zustellung.
- **Die bestehende Zeile `WH-4MD290111R3948627-…` steht weiterhin auf
  `RECEIVED`.** Sie zu ändern wäre ein schreibender Eingriff in
  Produktionsdaten. Wer sie bereinigen will:
  ```sql
  UPDATE webhook_events SET status='PROCESSED', processed_at='2026-08-08T06:10:22.766Z'
  WHERE external_event_id='WH-4MD290111R3948627-8AM47435BU5710537';
  ```
- **Grenze der Prüfung, ausdrücklich:** An echten Daten ist die Korrektur
  **nicht** belegt. Dafür müsste PayPal dasselbe Ereignis ein zweites Mal
  zustellen, und das ließe sich nur durch eine wiederholte echte Zahlung
  herbeiführen. Belegt sind die Entscheidung und die Struktur.

### 2026-08-08 — CSP ohne `'unsafe-inline'`: Nonces für die Inline-Skripte (ai-todo Punkt 4a)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Punkt 4a aus [ai-todo.md](ai-todo.md). `script-src` trägt
  `'unsafe-inline'`, weil vinext Inline-`<script>`-Blöcke je Seite ausliefert.
  Damit sind **Inline-Eventhandler erlaubt**: Ein künftig eingeschleustes
  `<img onerror=…>` würde laufen — genau die Form, die SEC-01 hatte.
- **Vorher an der Produktion gemessen, statt der Aufgabenbeschreibung zu
  glauben.** Zwei Befunde, die den Entwurf bestimmen:
  1. **Alle Skripte sind inline, keines hat `src`** (7 Blöcke auf der
     Startseite: RSC-Parameter, Navigationszustand, drei RSC-Blöcke, ein
     Fertig-Schalter und `import("/assets/index-….js")`). Die Chunks kommen
     über `<link rel="modulepreload">` und den dynamischen `import()`.
  2. **HTML wird nicht zwischengespeichert** — die Antwort auf `/` und
     `/karten` trägt **kein** `cache-control` und **kein** `etag`, es gibt also
     keine 304-Antwort auf HTML. Das ist die Voraussetzung dafür, dass ein
     Zufallswert je Antwort überhaupt tragen kann: Käme der Rumpf aus einem
     Zwischenspeicher und die Kopfzeile frisch, passte der Wert nicht mehr zum
     Markup und **jede** Seite bliebe leer. Die Assets tragen zwar `etag`, sind
     aber JS und CSS ohne Inline-Skripte.
- **Abweichung von der Aufgabenbeschreibung, bewusst und begründet: kein
  `'strict-dynamic'`.** Die Aufgabe nennt es, mit der Begründung, vinext lade
  weitere Skripte nach. Das stimmt — aber sie kommen alle **von dieser
  Herkunft**, und dafür genügt `'self'`. `'strict-dynamic'` hätte einen Preis:
  Es lässt Browser die Angabe `'self'` **ignorieren**, womit jedes
  `<script src>` ohne Zufallswert stillgelegt würde und der dynamische
  `import()` von einer Spezifikationsfeinheit abhinge. `script-src 'self'
  'nonce-…'` erreicht dasselbe Ziel — Inline-Eventhandler können **nie** einen
  Zufallswert tragen und sind damit tot — ohne diese Abhängigkeit. Sollte je
  ein fremdes Skript nötig werden, ist `'strict-dynamic'` der nächste Schritt.
- **Wie:** Zufallswert je Antwort in `worker/index.ts`; `HTMLRewriter` hängt
  ihn **jedem** `<script>` an; `lib/security-headers.ts` setzt ihn in die
  Regel. Antworten, die kein HTML sind, bekommen `script-src 'self'` ganz ohne
  Zufallswert — dort führt niemand Skripte aus, und `'unsafe-inline'`
  verschwindet damit aus **allen** Antworten.
- **Drei Fallen, auf die zu achten ist:**
  - Der Zufallswert muss **je Antwort** neu sein, sonst ist er wertlos.
  - `HTMLRewriter` darf nur auf `text/html` laufen, nicht auf JSON, Bilder oder
    Assets.
  - Antworten ohne Rumpf (101, 204, 304) dürfen nicht umgeschrieben werden.
- **`style-src` behält `'unsafe-inline'`** und bleibt außen vor: React und
  vinext setzen Inline-Stile. Das ist eine eigene Aufgabe, kein Nebenbei.
- **Betroffen:** `lib/security-headers.ts`, `worker/index.ts`,
  `tests/hardening.test.mjs`. **Keine Migration, keine Datenänderung.**
- **Verifikation:** Tests für Regel und Zufallswert samt Rot-Nachweis; dann
  **lokal im Browser**, bevor irgendetwas deployed wird: Startseite, `/karten`,
  Kartendetail, `/checkout`, `/account` und `/admin` ohne Konsolenfehler
  bedienbar, und in der ausgelieferten Seite trägt jedes `<script>` den Wert.
  **Ein Fehler hier legt den ganzen Shop lahm** — eine blockierte
  Hydrierung heißt: keine Seite funktioniert mehr. Deshalb wird hier nicht auf
  eine Stichprobe vertraut.
- **Rückweg:** Eine Zeile — `'unsafe-inline'` zurück in `script-src`, deployen.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler,
  `npm test` **204/204** (9 neue Tests).
- **Der Gewinn ist an beiden Enden gemessen, nicht behauptet.** Derselbe
  Angriff, genau in der Form von SEC-01
  (`<img src="…" onerror="window.__angriffLief = true">`, über `innerHTML`
  eingeschleust):
  - **Gegen die laufende Produktion mit `'unsafe-inline'`: er läuft**
    (`angriffLief: true`).
  - **Gegen den neuen Produktionsbau: er läuft nicht** (`angriffLief: false`),
    der Browser meldet einen Verstoß gegen `script-src-attr`.
  Das ist der ganze Zweck dieser Aufgabe, und er ist damit belegt statt
  angenommen.
- **Geprüft wurde am echten Produktionsbau**, nicht nur am
  Entwicklungsserver: `npm run build`, dann `npx wrangler dev --local` auf Port
  8788. Dort tragen alle **7** Skripte den Zufallswert, die Kopfzeile nennt
  denselben, und ein Durchgang über Startseite, `/karten`, `/anfragen`,
  `/verkaufen`, `/ueber-uns`, `/account`, `/checkout` und `/admin` ergab
  **null** Verstöße bei funktionierender Hydrierung und funktionierender
  Client-Navigation.
- **Ein Zwischenbefund, der beinahe falsch gedeutet worden wäre:** Am
  Entwicklungsserver meldete der Browser 33 Verstöße gegen `script-src` mit
  `blockedURI: "eval"`. Das ist **die HMR von Vite**, nicht der ausgelieferte
  Code. Belegt durch zwei Messungen: der Produktionsbau erzeugt **null**
  Verstöße, und die **laufende Produktion** — deren Regel `eval` schon vorher
  verbot — ebenfalls null. Wer diese Zeilen künftig wieder sieht: erst den
  Produktionsbau messen, bevor `'unsafe-eval'` auch nur erwogen wird.
- **Nachgemessen statt angenommen:** Der Zufallswert ist bei jeder Antwort ein
  anderer (drei Abrufe, drei Werte), und Antworten, die kein HTML sind, tragen
  `script-src 'self'` **ohne** Zufallswert — `'unsafe-inline'` steht damit in
  **keiner** Antwort mehr.
- **Ein zweiter Stolperstein, der Zeit gekostet hat:** Im Browser schienen auf
  `/karten` acht Skripte **ohne** Zufallswert zu stehen. Das war eine
  Client-Navigation — die Skript-Tags im DOM stammten aus dem Seitenwechsel,
  nicht aus der Auslieferung. Ein direkter Abruf jeder einzelnen Route zeigte:
  8 von 8 Tags mit Wert, auf allen fünf geprüften Seiten. **Der DOM nach einer
  Client-Navigation ist kein Beleg dafür, was der Server ausgeliefert hat.**
- **Typen:** `HTMLRewriter` war dem Typprüfer unbekannt. Eine knappe Erklärung
  steht jetzt in `cloudflare-env.d.ts`, im selben Stil wie die übrigen
  Bindings — keine neue Abhängigkeit.
- **`npx wrangler dev` ist am Ende abgestürzt** („No such module
  `__vite_rsc_assets_manifest.js`"). Ursache ist harmlos und gehört nicht zur
  Änderung: `npm test` baut `dist/` neu, und der laufende Server versuchte
  mitten im Neubau nachzuladen. **Die Prüfungen liefen davor**, gegen einen
  antwortenden Server. Wer beides zugleich braucht: erst prüfen, dann testen.

#### In Produktion nachgeprüft — deployed als `d230f425`

- **Der Angriff ist tot, wo er vor Minuten noch lief.** Auf
  `https://shop.brandycards.de` ergibt derselbe eingeschleuste `<img onerror=…>`
  jetzt `angriffLief: false` und einen `script-src-attr`-Verstoß. Vor dem Deploy
  war die Antwort an derselben Stelle `true`.
- **Der Shop läuft:** Startseite, `/karten`, `/anfragen`, `/ueber-uns`,
  `/checkout` und `/admin` hydrieren und navigieren; der **einzige** gemeldete
  Verstoß ist der absichtlich ausgelöste. `/admin` zeigt nicht „noch nicht
  konfiguriert".
- **Die gefährliche Mischung wurde ausdrücklich gesucht und nicht gefunden.**
  Beim Ausrollen liefern die Ränder minutenlang alte und neue Fassung
  nebeneinander. Tödlich wäre **neue Kopfzeile mit Zufallswert auf altem Rumpf
  ohne** — die Seite bliebe leer. 12 Abrufe, bei jedem Kopfzeile **und** Rumpf
  derselben Antwort verglichen: 8× neu und stimmig, 4× durchgehend alt,
  **kein einziger gemischter Fall**. Kopfzeile und Rumpf kommen immer aus
  derselben Fassung, weil beide im selben Worker entstehen. 45 Sekunden später
  15 von 15 Abrufen auf der neuen Fassung.
- **Eine Falle beim Nachprüfen, in die ich zuerst getappt bin:** Getrennte
  Abrufe für Kopfzeile und Rumpf zu vergleichen ist während eines Ausrollens
  **wertlos** — die erste Messung meldete „Kopfzeile passt NEIN" für drei
  Seiten, und es war nur eine alte Antwort gegen eine neue Kopfzeile aus einem
  anderen Abruf. Wer das prüft, muss Kopfzeile und Rumpf **derselben** Antwort
  vergleichen (`curl -D kopf.txt … -o rumpf.html`).

### 2026-08-08 — Der Checkout zeigt den ausgehandelten Preis (ai-todo Punkt 5)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Punkt 5 aus [ai-todo.md](ai-todo.md). Nach einer angenommenen
  Verhandlung zeigt der Checkout weiterhin den **Listenpreis**. Der Rabatt
  erscheint erst in der Serverantwort und bei PayPal. Kunden zahlen nie zu
  viel — sie sehen den Vorteil nur zu spät, und eine transparente Preisangabe
  vor dem Bestellabschluss ist in Deutschland auch rechtlich das saubere
  Vorgehen.
- **Folgenlos, bis es das nicht mehr ist:** Solange niemand ein angenommenes
  Angebot hat, fällt nichts auf. Mit dem ersten angenommenen Vorschlag wird es
  sofort sichtbar.
- **Die Entwurfsentscheidung, auf die es ankommt:** Die Anzeige darf **nicht**
  ihre eigene Preisregel bekommen. Sonst driften Anzeige und Abrechnung
  auseinander, und der Kunde sieht am Ende einen anderen Betrag als den, der
  abgebucht wird — schlimmer als gar keine Anzeige. Deshalb wird die
  Entscheidung in `lib/price-offers.ts` **einmal** getroffen und von beiden
  benutzt: `pickAcceptedOffers` wird die eine Quelle, `pickAcceptedPrices`
  (heute von `app/api/orders/route.ts` benutzt) leitet sich daraus ab. Auch die
  zweite Regel wird gespiegelt statt nachgebaut: **Ein angenommenes Angebot
  senkt nur** — ist der Listenpreis inzwischen darunter, gilt der niedrigere
  (`app/api/orders/route.ts:79`).
- **Wie:**
  - Neue Route `GET /api/account/offers`, die für den **angemeldeten** Nutzer
    alle angenommenen, unverfallenen Angebote als `productId → Betrag` samt
    Gültigkeit liefert. Anmeldung über `getAuthenticatedAppUser` wie in
    `app/api/orders/route.ts`, dazu das übliche Rate-Limit.
  - `app/checkout/page.tsx` holt sie und zeigt je Position den ausgehandelten
    Preis, den durchgestrichenen Listenpreis und die Ersparnis; die
    Zwischensumme rechnet mit dem ausgehandelten Preis.
- **Achtung, und das bleibt unangetastet:** Reine Darstellung. Der verbindliche
  Preis wird weiterhin **ausschließlich** serverseitig bestimmt; aus dem Browser
  wird niemals ein Betrag übernommen. Der Checkout schickt nach wie vor nur
  Produkt-Kennungen.
- **Wer nicht angemeldet ist, sieht keinen Fehler.** Die Abfrage antwortet dann
  mit 401, und der Checkout zeigt schlicht die Listenpreise — Anmelden verlangt
  er ohnehin erst beim Absenden.
- **Betroffen:** neu `app/api/account/offers/route.ts`; geändert
  `lib/price-offers.ts`, `app/checkout/page.tsx`, `app/globals.css`,
  `tests/price-offers.test.mjs`. **Keine Migration, keine Änderung an
  Produktionsdaten.**
- **Verifikation:** Tests für die neue gemeinsame Entscheidung samt
  Rot-Nachweis, darunter ausdrücklich der Fall „Listenpreis ist unter das
  Angebot gefallen"; Prüfkette; im Browser gegen den lokalen Server prüfen,
  dass der Checkout ohne Angebot unverändert aussieht.
- **Ehrlich zur Grenze der Prüfung:** Ein Konto mit einem **echten**
  angenommenen Angebot gibt es nicht, und eines anzulegen wäre ein schreibender
  Eingriff in Produktionsdaten. Der Fall wird deshalb über die Tests und über
  eine untergeschobene Antwort im Browser belegt, nicht an echten Daten.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler,
  `npm test` **195/195** (6 neue Tests).
- **Gebaut:** neu `lib/offer-price.ts` (`effectiveUnitPrice`) und
  `app/api/account/offers/route.ts`; in `lib/price-offers.ts` wurde
  `pickAcceptedOffers` die eine Quelle, aus der sich `pickAcceptedPrices`
  ableitet.
- **Eine eigene Datei für eine einzige Zeile, und der Grund gehört behalten:**
  `effectiveUnitPrice` konnte **nicht** in `lib/price-offers.ts` bleiben. Der
  Checkout ist eine `"use client"`-Komponente, und diese Datei zieht Drizzle
  samt Datenbankschema mit — der Import hätte beides ins Client-Bundle gepackt.
  Wer die Regel später „aufräumt" und zurückschiebt, baut sich das ein.
- **`app/api/orders/route.ts` benutzt jetzt dieselbe Funktion**, statt die Regel
  ein zweites Mal zu schreiben. Das war der eigentliche Zweck: Anzeige und
  Abrechnung können nicht mehr auseinanderdriften.
- **Rot-Nachweis:** Mit `Math.min` ausgebaut fällt genau der Test „ein unter das
  Angebot gefallener Listenpreis gewinnt" (14/15). Der Test misst also etwas.
- **Im Browser an drei Fällen belegt** (lokaler Server, Produkte und Angebote
  untergeschoben, weil die lokale Datenbank leer ist):
  1. **Ohne Angebot unverändert:** 45,00 € und 29,00 €, Zwischensumme 74,00 €,
     keine Ersparnis-Zeile, kein Durchgestrichenes.
  2. **Mit Angebot:** „45,00 € 32,00 €" mit `line-through` auf dem Listenpreis
     und Gold auf dem ausgehandelten, dazu „DEIN AUSGEHANDELTER PREIS",
     Zwischensumme 61,00 €, „Deine Ersparnis −13,00 €", Gesamt 64,45 €. Die
     zweite Karte ohne Angebot blieb bei 29,00 €.
  3. **Angebot über dem Listenpreis** (50,00 € gegen 45,00 €): **nichts**
     angezeigt, keine Ersparnis, 45,00 € bleibt stehen — die Regel „senkt nur"
     greift auch in der Anzeige.
- **Nachgemessen statt angenommen:** `display` beider Preise ist `inline`.
  `.checkout-item span` steht auf `block` und trifft auch verschachtelte
  Spannen; ohne die Rücknahme in der CSS stünden die beiden Preise
  untereinander.
- **Die echte Route wurde gegen den laufenden Server geprüft:** ohne Anmeldung
  `401 {"error":"Nicht authentifiziert."}`.
- **Vorbestehend und nicht von diesem Auftrag:** Lokal antwortet
  `/api/products` mit 503, weil die lokale D1 leer ist. Auf der Produktion
  liefert dieselbe Route 200.

### 2026-08-08 — Der Sync schreibt nur noch, was sich geändert hat (ai-todo Punkt 2)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Punkt 2 aus [ai-todo.md](ai-todo.md). Ein Sync-Lauf schreibt heute
  ~5 396 Zeilen, obwohl sich zwischen zwei Läufen fast nie etwas ändert. Die
  Läufe der letzten 24 Stunden belegen es: **294 „aktualisiert", 0 importiert,
  0 deaktiviert** — bei jedem einzelnen Lauf. Alle 294 Schreibvorgänge
  bewirken nichts.
- **Leitgedanke, der die Sicherheit trägt:** Es wird **nicht** entschieden, was
  sich geändert haben *könnte*, sondern verglichen, was geschrieben würde, mit
  dem, was schon dasteht. Sind sie gleich, entfällt die Anweisung. Damit ist
  die Änderung verhaltenserhaltend per Konstruktion — ein übersprungener
  Schreibvorgang hätte nichts bewirkt.
- **Wie, im Einzelnen:**
  - Neues Modul `lib/ebay-sync-diff.ts` mit reinen Vergleichsfunktionen
    (Listing, Produkt, Bilder, Bestand). Ohne Netz und ohne Datenbank prüfbar —
    dieselbe Trennung wie `lib/ebay-stock-check.ts` gegen
    `lib/ebay-stock-guard.ts`.
  - `lib/ebay-sync.ts` lädt die Vergleichswerte gebündelt vorab (heute holt es
    von `ebay_listings` nur drei Spalten) und stellt je Listing nur noch die
    Anweisungen zusammen, die etwas bewirken. Kein Batch heißt: gar kein
    Schreibvorgang.
  - **`product_assets` nicht mehr blind löschen und neu einfügen.** Gleiche
    `sourceUrl`-Liste in gleicher Reihenfolge → nichts anfassen. Allein ~18 000
    der gemessenen Zeilen.
  - **`sync_events`** nur noch bei einem echten Ereignis. `UPDATED` entfällt
    für unveränderte Listings.
  - **`lastSyncedAt`/`updatedAt` sind kein Grund zu schreiben.** Sie ändern
    sich zwangsläufig bei jedem Lauf; nähme man sie in den Vergleich, wäre er
    wertlos. Sie werden mitgeschrieben, wenn ohnehin geschrieben wird.
- **Zwei Fallen, vorher geprüft, nicht vermutet:**
  1. **`rawData` ist unbedenklich.** `lib/ebay-client.ts:174` baut es als
     `{source, marketplaceId, itemId}` — rein deterministisch, kein
     Zeitstempel, kein Zähler. Ein wechselndes JSON-Feld hätte die Ersparnis
     still aufgefressen. `shippingData` schreibt der Sync gar nicht.
  2. **`descriptionHtml` darf der Vergleich nicht anfassen.** Der Sync setzt es
     auf `undefined`, Drizzle lässt die Spalte damit beim `UPDATE` weg — dort
     liegt der Beschreibungs-Zwischenspeicher aus
     `app/api/products/[id]/route.ts:60`. Der Vergleich muss dieselbe
     Auslassung abbilden, sonst würde er einen Unterschied sehen, den es nicht
     gibt, und den Zwischenspeicher überschreiben.
- **Sichtbare Nebenwirkung, bewusst in Kauf genommen:** `updated_count` in
  `sync_runs` zählt künftig **tatsächliche** Änderungen. Ein ruhiger Lauf meldet
  damit 0 statt 294. Das ist der Zweck, sieht in der Laufübersicht aber nach
  „nichts passiert" aus. Eine eigene Spalte für „unverändert" wäre eine
  Migration und damit rücksprachepflichtig — die Zahl geht deshalb nur in den
  Rückgabewert, nicht in die Datenbank.
- **Betroffen:** neu `lib/ebay-sync-diff.ts` und `tests/ebay-sync-diff.test.mjs`;
  geändert `lib/ebay-sync.ts`, `app/admin/page.tsx` (Meldung um „unverändert"
  ergänzt), `package.json` (Testliste). **Keine Migration, kein Schemaschritt,
  kein Eingriff in Produktionsdaten.**
  **`ZEILEN_JE_LAUF` in `tests/ebay-stock-check.test.mjs` bleibt vorerst bei
  5 396** — der Wert wird erst gesenkt, wenn die Ersparnis an der Produktion
  gemessen ist. Eine Schätzung dort einzutragen hieße, die Kopplung
  auszuhebeln, die dieser Test herstellt.
- **Der Cron-Takt bleibt bei `0 */2 * * *`.** Beschleunigt wird erst, wenn die
  Ersparnis **an der Produktion gemessen** ist, nicht auf Grundlage einer
  Schätzung. Genau diese Reihenfolge erzwingt der Test in
  `tests/ebay-stock-check.test.mjs`.
- **Verifikation:** Rot-Nachweis für jede Vergleichsfunktion (ohne sie fallen
  die Tests); Prüfkette `tsc`, Lint, `npm test`; nach dem Deploy ein Lauf
  abwarten und `wrangler d1 insights --timePeriod 1d --sort-by writes`
  gegenprüfen.
- **Rückweg:** Eine Datei und ein Commit. Der Lauf schreibt danach wieder alles.

#### Zwischenstand — gebaut und deployed, die Messung fehlt noch

- **Gebaut und in Produktion**, deployed als Version **`6f33f7f1`** um
  ~07:00 UTC. Commit `500054a` auf `main` und `agent/initial-brandycards`.
- **Prüfkette grün:** `tsc` sauber, Lint 0 Fehler (nur die vorbestehende
  `<img>`-Warnung), `npm test` **189/189** (17 neue Tests). **CI grün
  abgewartet, erst dann deployed** — die Lehre aus zwei Sitzungen, in denen ein
  Deploy auf grüner *lokaler* Kette rausging, während CI rot war.
- **Rot-Nachweis in beide Richtungen geführt**, weil ein zu großzügiger
  Vergleich der gefährlichere Fehler wäre:
  - Ohne die `undefined`-Ausnahme fallen 4 Tests (der Zwischenspeicher der
    Beschreibung würde überschrieben).
  - Ohne die Zeitstempel-Ausnahme fallen 5 Tests (der Vergleich wäre wirkungslos).
  - Mit abgeschaltetem Vergleich fallen **8** Tests — die Richtung „Geändertes
    **muss** geschrieben werden" ist damit ebenso belegt wie die Ersparnis.
- **Deploy nachgeprüft:** `/`, `/account`, `/admin` und `/api/products` je 200,
  und `/account` enthält **nicht** „noch nicht konfiguriert" — die
  Bundle-Probe vor dem Deploy fand die Supabase-Konfiguration im Client-Bundle.
- **Offen: die Messung an der Produktion.** Der nächste Cron-Lauf ist
  **08:00 UTC**. Erst danach lässt sich sagen, ob die Ersparnis eintritt.
  Zu prüfen: `updated_count` des Laufs (erwartet: **0** statt 294) und
  `npx wrangler d1 insights brandycards-production --timePeriod 1d --sort-by writes`
  (**mit `--limit 100`**, sonst kommen nur die Top 5). **Bleibt die Zahl hoch,
  ist die Aufgabe nicht erledigt** — dann schreibt ein Feld weiter jedes Mal,
  und der nächste Schritt ist, herauszufinden welches, nicht die Zahl schön zu
  reden.
- **Der Cron-Takt bleibt unangetastet**, bis diese Messung vorliegt.

#### Ergebnis: ABGESCHLOSSEN — an der Produktion gemessen

Der Lauf vom **2026-08-08 08:00:38 UTC** ist der erste unter der neuen Fassung.
Gegenübergestellt den vier Läufen davor:

| Lauf (UTC) | aktualisiert | deaktiviert | `sync_events` |
|---|---|---|---|
| **08:00:38** *(neu)* | **0** | 1 | **1** |
| 06:00:38 | 294 | 1 | 295 |
| 04:00:46 | 294 | 0 | 294 |
| 02:00:46 | 294 | 0 | 294 |
| 00:00:46 | 294 | 0 | 294 |

**294 wirkungslose Schreibvorgänge je Lauf sind auf 0 gefallen.** Der eine
verbliebene `sync_events`-Eintrag ist die Deaktivierung des Testartikels — also
genau ein Ereignis, das etwas aussagt. Das ist die Absicht der Änderung, an
echten Daten belegt.

**Der Katalog ist unversehrt:** 294 aktive Produkte, 294 aktive Listings,
**302 Bilder**. Letzteres ist der wichtigere Wert — er belegt, dass das
Überspringen des Löschen-und-Einfügens keine Bilder verloren hat.

**Nebenbei erledigt:** Derselbe Lauf hat den **Testartikel** abgeräumt
(`ec6c212e…` steht jetzt auf `INACTIVE` / `ENDED` / `UNAVAILABLE`). Der Punkt
aus der Übergabe ist damit ohne Eingriff von Hand geschlossen.

**`wrangler d1 insights --timePeriod 1d` taugt hier noch nicht als Beleg** und
wird es erst am 2026-08-09: Das Fenster enthält die vier Läufe von vor dem
Deploy und meldet deshalb weiterhin ~31 000 Zeilen für das `ebay_listings`-
Update. Wer die Zahl sehen will, muss einen vollen Tag abwarten — die
Gegenüberstellung oben ist die belastbarere Messung, weil sie einzelne Läufe
vergleicht.

**Noch offen und bewusst nicht mit erledigt:** `ZEILEN_JE_LAUF` in
`tests/ebay-stock-check.test.mjs` steht weiter auf 5 396, und der Cron bleibt
bei `0 */2 * * *`. Beides gehört zusammen und sollte auf Grundlage der
Tageszahlen vom 2026-08-09 angepasst werden, nicht auf Grundlage eines einzigen
Laufs. **Erst dann** darf der Takt beschleunigt werden.

### 2026-08-08 — Testkauf: die Bestellbestätigung ist belegt

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Zwei **schreibende Eingriffe in Produktionsdaten**, beide vom
  Betreiber ausdrücklich beauftragt.
  1. Die zwei Zeilen der Zustellproben aus `inquiries` löschen.
  2. Einen kaufbaren **Testartikel** anlegen, damit sich der Bestellpfad samt
     Bestellbestätigung einmal echt durchspielen lässt.
- **Kein Code, keine Migration, kein Deploy.** Nur Daten.

### Was vorher geprüft wurde, damit der Testkauf nicht am Bezahlen scheitert

- **Die Bestandsprüfung vor der Zahlung blockiert nicht.** Sie ruft für jede
  Karte `GetItem` bei eBay auf. Unsere erfundene ItemID kennt eBay nicht, eBay
  antwortet mit `Ack=FAILURE`, `getEbayAvailability` verschluckt das und legt
  **keinen** Eintrag an — und ohne Eintrag gilt die Karte als „unbekannt", was
  den Kauf durchlässt (`lib/ebay-stock-check.ts`). Nachgelesen, nicht gehofft.
- **Der Import räumt den Testartikel von selbst wieder ab.** `runEbaySync`
  setzt jedes `ACTIVE`-Listing, dessen ItemID nicht in der eBay-Aktivliste
  steht, auf `ENDED`, das Produkt auf `INACTIVE` und den Bestand auf
  `UNAVAILABLE`. Der Cron läuft `0 */2 * * *`. **Das ist erwünscht** — der
  Artikel verschwindet ohne Zutun. Es begrenzt aber das Zeitfenster für den
  Kauf auf die Zeit bis zum nächsten geraden UTC-Stundenschlag.
- **Der Artikel ist öffentlich sichtbar**, solange er lebt. Einen versteckten
  Weg gibt es nicht: `/api/products` liefert nur, was `ACTIVE` ist, und nur
  ein aktives Listing ist kaufbar. Gegenmaßnahmen: unmissverständlicher Titel
  und ein niedriger Preis.

### Anzulegen

- `products`: `kind = EBAY_SYNCED`, `status = ACTIVE`, Titel unmissverständlich
  als Testartikel.
- `ebay_listings`: `status = ACTIVE`, `listing_type = FIXED_PRICE`,
  `quantity = 1`, Preis **1,00 €**, erfundene `ebay_item_id`.
- `inventory`: `available_quantity = 1`, `status = AVAILABLE` — ohne diese
  Zeile lehnt `app/api/orders/route.ts` die Bestellung ab (`innerJoin`).

- **Verifikation:** Der Artikel taucht in `/api/products` und auf `/karten`
  auf; die zwei `inquiries`-Zeilen sind weg; die Zählung vorher/nachher wird
  festgehalten.
- **Rückweg:** Der Testartikel lässt sich jederzeit löschen; die gelöschten
  Anfragen **nicht** — sie sind weg. Ihr Inhalt ist in dieser Datei
  dokumentiert (Titel „ZUSTELLPROBE …", Empfänger der Betreiber selbst), es
  geht also nichts Unwiederbringliches verloren.
- **Ergebnis: ABGESCHLOSSEN.**
  - **Die zwei Zustellproben sind gelöscht** (`changes: 2`); `inquiries` ist
    danach leer.
  - **Testartikel angelegt** (`ec6c212e96332bdcc93612848694b907`,
    „TESTARTIKEL BrandyCards, bitte nicht kaufen", 1,00 €). Vor der ersten
    Deaktivierung nachgeprüft: im Katalog (295 statt 294), Detailseite mit
    „1 verfügbar" und aktivem Kaufknopf.
- **Fehler beim Timing, den die nächste Sitzung nicht wiederholen muss:** Ich
  habe den Artikel um **06:00:07 UTC** angelegt — der Cron-Lauf startete um
  **06:00:38** und hat ihn erwartungsgemäß sofort auf `ENDED`/`INACTIVE`
  gesetzt. Dass das passieren *würde*, stand vorher in diesem Eintrag; ich habe
  nur den schlechtesten Zeitpunkt erwischt. **Wer einen Testartikel anlegt,
  macht das kurz *nach* einer geraden UTC-Stunde, nicht davor.**
- **Reaktiviert hat der Betreiber selbst.** Meine schreibenden D1-Befehle
  wurden zweimal von der Berechtigungsprüfung abgelehnt (einmal als Befehl,
  einmal als SQL-Datei). Statt Umwege zu suchen, habe ich ihm die drei
  `UPDATE`-Befehle gegeben. **Überholt:** Am selben Tag gegen 08:2x liefen
  dieselben Befehle von hier aus anstandslos durch. Im Zweifel also selbst
  versuchen, statt gleich abzugeben.

### Der Testkauf: der Beleg, der bisher fehlte

Bestellung `BC-20260808-55246326`, 4,45 €, `PAID` um 06:10:12 UTC.

| Prüfung | Ergebnis |
|---|---|
| Zahlung | `CAPTURED` mit Capture-ID |
| Position | „TESTARTIKEL…", 1 Stück, 1,00 € |
| Bestand nach dem Kauf | verfügbar 0, reserviert 0, **verkauft 1**, `SOLD` |
| eBay-Outbox | leer (Schreibpfad ist aus, erwartet) |
| **Bestellbestätigung** | **genau eine**, vom Betreiber im Postfach belegt |

**Der Einmal-Riegel ist damit an echten Daten bewiesen, nicht nur im Test:**
Beide Zahlungspfade haben gefeuert — die Rückkehr aus PayPal um 06:10:12, der
Webhook `PAYMENT.CAPTURE.COMPLETED` um 06:10:22 — und es kam **eine**
Bestätigung an.

**Bezahlt wurde in der PayPal-Sandbox**, siehe den offenen Punkt dazu. Der
Code-Pfad ist derselbe, nur der Endpunkt unterscheidet sich.


### 2026-08-08 — Erfolgreicher Versand hinterlässt eine Spur

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Ein erfolgreicher Versand soll eine Protokollzeile hinterlassen.
  Bisher meldet sich nur der Fehlerfall; ein geglückter Versand ist unsichtbar,
  und damit lässt sich im Nachhinein nicht belegen, ob ein Kunde seine
  Bestätigung bekommen hat.
- **Wie:** Eine gemeinsame Funktion `protokolliereVersand(anlass, ergebnis,
  kennung)` in `lib/email/send.ts`, die beide Ausgänge schreibt und die vier
  wiederholten `if (!ergebnis.ok) console.error(...)` in `notify.ts` ersetzt.
- **Bei Erfolg wird die Resend-Kennung protokolliert**, nicht die
  Empfängeradresse. Damit lässt sich ein Einzelfall in der Oberfläche von
  Resend nachschlagen, ohne dass personenbezogene Daten in den
  Cloudflare-Protokollen liegen — die stünden dort sonst dauerhaft und ohne
  Zweck. Dazu die fachliche Kennung (`orderId`, `offerId`), die intern ist.
- **Betroffen:** `lib/email/send.ts`, `lib/email/notify.ts`,
  `tests/email.test.mjs`. Kein Datenmodell, keine API, keine Datenbank.
- **Verifikation:** Ein Test fängt die Protokollausgabe ab und belegt beides:
  dass eine Erfolgszeile mit Kennung entsteht **und** dass die
  Empfängeradresse nicht darin vorkommt.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler,
  `npm test` **172/172** (3 neue Tests).
- **Die Zeilen sehen jetzt so aus:**
  - Erfolg: `[email] Bestellbestätigung zugestellt. { resendId: 'msg_…',
    orderId: '…' }`
  - Fehlschlag: `[email] Ankaufbestätigung nicht zugestellt. { grund:
    'unerreichbar', … }`
- **Belegt durch Tests, die die Konsolenausgabe abfangen:** Der Erfolgsfall
  erzeugt genau eine Zeile mit Kennung; der Fehlerfall bleibt ein `console.error`.
  Und ein eigener Test prüft, dass die **Empfängeradresse in keiner Zeile
  vorkommt** — dafür wird ein echter Versand mit gestubbtem `fetch` gefahren und
  die gesamte Protokollausgabe nach der Adresse durchsucht.
- **Nebenbei aufgeräumt:** Die vier wiederholten `if (!ergebnis.ok)
  console.error(...)` in `notify.ts` sind weg; alle vier Anlässe gehen durch
  dieselbe Funktion. Die Angebotsnachricht nennt dabei jetzt auch, welche
  Entscheidung verschickt wurde („Preisvorschlag angenommen" statt nur
  „Angebotsnachricht").

- **In Produktion belegt, nicht nur im Test.** Deployed als `9a2d28f2`, danach
  eine zweite Zustellprobe über `/anfragen` mit mitlaufendem `wrangler tail`:

  ```
  POST https://shop.brandycards.de/api/inquiries - Ok
    (log) [email] Anfragebestätigung zugestellt. { resendId: '45cea890-…' }
  ```

  Die Erfolgszeile erscheint, trägt die Resend-Kennung und **nicht** die
  Empfängeradresse. Damit ist rückwirkend auch belegt, dass die erste
  Zustellung denselben Weg genommen hat.
- **Zweite Zeile in `inquiries`** mit dem Titel „ZUSTELLPROBE 2 Protokollzeile
  2026-08-08". Bleibt ebenfalls stehen; Löschen wäre ein schreibender Eingriff
  in Produktionsdaten.
- **Reihenfolge diesmal richtig herum:** erst CI abwarten, dann deployen. Der
  Durchlauf davor ging auf grüner lokaler Kette raus und war in CI rot.

### 2026-08-08 — Erste echt zugestellte E-Mail

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Den E-Mail-Versand **einmal echt zustellen**. Bisher ist er nur
  durch Tests belegt; eine tatsächlich angekommene Nachricht gab es nie.
- **Voraussetzungen erfüllt:** Domain `brandycards.de` bei Resend verifiziert
  (06.08.), TLS auf `Enforced` gestellt, `RESEND_API_KEY` als Cloudflare-Secret
  hinterlegt und in `wrangler secret list` bestätigt.
- **Vorgehen:** Eine Kartenanfrage über `/anfragen` **in Produktion**
  abschicken, Empfänger `p.brand94@googlemail.com` — vom Betreiber ausdrücklich
  benannt. Parallel `wrangler tail` mitlesen.
- **Berührt Produktionsdaten:** Es entsteht eine echte Zeile in `inquiries`
  mit Status `NEW`, erkennbar am Testtitel. **Sie wird nicht gelöscht** —
  schreibende Eingriffe in Produktionsdaten sind rücksprachepflichtig, und der
  Betreiber ist darüber informiert.
- **Nicht prüfbar auf diesem Weg:** die Bestellbestätigung. Sie hängt an einer
  echten PayPal-Zahlung.
- **Fertig, wenn:** Das Protokoll den Versand als angenommen meldet und der
  Betreiber die Nachricht im Postfach bestätigt.
- **Ergebnis: ABGESCHLOSSEN — die Nachricht ist angekommen.** Der Betreiber hat
  den Eingang im Postfach bestätigt. Damit ist der Versandpfad zum ersten Mal
  **durch eine echte Zustellung** belegt und nicht nur durch Tests.
- **Ablauf:** Formular meldete „Danke! Deine Anfrage ist bei uns eingegangen.",
  die Zeile steht in der Produktionsdatenbank
  (`p.brand94@googlemail.com`, Status `NEW`, 2026-08-08 05:45:48 UTC), und
  `wrangler tail` zeigte `POST /api/inquiries - Ok` ohne Fehlerzeile.
- **Die Zeile in `inquiries` bleibt bewusst stehen** (Titel „ZUSTELLPROBE
  E-Mail-Versand 2026-08-08"). Sie zu löschen wäre ein schreibender Eingriff in
  Produktionsdaten und damit rücksprachepflichtig.
- **Was dieser Durchlauf sichtbar gemacht hat:** Ein **erfolgreicher** Versand
  hinterließ keine Spur. Aus dem Protokoll ließ sich nur ablesen, dass nichts
  schiefging — nicht, dass etwas hinausging. Für den Betrieb zu wenig: Wer in
  vier Wochen wissen will, ob ein Kunde seine Bestätigung bekam, fand nichts.
  Wird als eigener Punkt nachgezogen.
- **Weiterhin ungeprüft:** die Bestellbestätigung. Sie hängt an einer echten
  PayPal-Zahlung und lässt sich ohne eine solche nicht belegen.


### 2026-08-08 — Kunden-E-Mails gebaut (ai-todo Punkt 3)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Punkt 3 aus [ai-todo.md](ai-todo.md) — **Kunden-E-Mails**. Heute gibt
  es **keinen** eigenen Versand; nur Supabase verschickt seine Anmeldemails.
  Wer im Shop zahlt, bekommt keine Bestellbestätigung.
- **Anbieter: Resend.** Steht bereits in Abschnitt 5 der Datenschutzerklärung,
  ist also keine neue Offenlegung. Der Schlüssel gehört als
  Cloudflare-Secret `RESEND_API_KEY` hinterlegt, **niemals** ins Repository.
- **Fünf Anlässe, nach Wichtigkeit:**
  1. Bestellbestätigung nach erfolgreichem Zahlungseinzug
  2. Preisvorschlag angenommen (Betrag, Gültigkeit, Link zur Karte)
  3. Preisvorschlag abgelehnt
  4. Eingangsbestätigung für eine Kartenanfrage
  5. Eingangsbestätigung für ein Ankaufsangebot

### Nachtrag: CI war rot, lokal gruen -- dieselbe Falle wie am Vortag

Der Deploy ging auf gruener **lokaler** Kette raus, der CI-Lauf danach war
**rot**: vier Tests mit `cancelledByParent` und
`Promise resolution is still pending but the event loop has already resolved`.

**Ursache, wortwoertlich die vom 2026-08-07:** `AbortSignal.timeout()` benutzt
einen unref'd Timer und haelt Node nicht am Leben. Ist die stumme Zusage des
`fetch`-Stubs das einzige offene Handle, raeumt Node den Test ab, **bevor** die
Zeitgrenze greift. Node 24 gewinnt dieses Rennen meist, Node 22 verliert es --
und die CI laeuft auf 22. Ich hatte den haltenden Timer nur in den eigenen
Zeitgrenzen-Test gesetzt, nicht in den „haengt“-Fall des Sammeltests.

**Behoben** mit einer gemeinsamen Hilfsfunktion `stummeGegenstelle()`, die den
ref'd Timer traegt, samt Begruendung im Code. **Nachgewiesen durch den gruenen
CI-Lauf** (169/169, 0 abgebrochen) -- lokal ist der Nachweis nicht fuehrbar, ein
echtes Node 22 steht hier nicht zur Verfuegung.

**Kein zweiter Deploy noetig:** Geaendert wurde nur `tests/email.test.mjs`, und
Tests werden nicht ausgeliefert. Produktion steht auf `e0b191bd` und enthaelt
denselben Anwendungscode wie `main`.

**Die Lehre steht seit gestern in dieser Datei und hat trotzdem nicht
gegriffen:** „Vor dem Push in die CI sehen.“ Diesmal habe ich sie zumindest
sofort nach dem Push gelesen.

### Die drei Entwurfsentscheidungen, die zählen

- **Ein fehlgeschlagener Versand darf nie die auslösende Aktion scheitern
  lassen.** `sendEmail` wirft grundsätzlich nicht, sondern meldet `false` und
  protokolliert. Zusätzlich liegt jeder Aufruf in einem eigenen `try/catch`,
  weil auch das *Zusammenbauen* der Nachricht fehlschlagen kann (fehlende
  Verknüpfung, unerwartete Daten). Muster wie bei der Beschreibungsabfrage in
  `app/api/products/[id]/route.ts`.
- **Genau einmal senden, ohne neue Datenbankspalte.** Eine Bestellung wird auf
  **zwei** Wegen bezahlt: über `app/api/paypal/capture/route.ts` (Kunde wartet
  im Browser) und über `app/api/paypal/webhook/route.ts` (PayPal meldet
  nach). Laufen beide, gäbe es zwei Bestätigungen. Eine Migration wäre
  rücksprachepflichtig und ist unnötig: **Der Übergang der Zahlung auf
  `CAPTURED` ist der Einmal-Moment.** Beide Stellen schreiben ihn künftig mit
  `WHERE status IN ('CREATED','APPROVED')` und prüfen `meta.changes === 1` —
  wer den Übergang gewinnt, verschickt. Das ist zugleich eine echte Korrektur:
  Heute schreiben **beide** Stellen ungeschützt, ein Wettlauf überschreibt
  stillschweigend. Bei den Preisvorschlägen existiert dieser Riegel schon
  (`app/api/admin/offers/route.ts`, `meta.changes !== 1`).
- **Der Versand wird abgewartet, nicht nebenher gestartet.** `waitUntil` gibt
  es nur im Worker-Einstieg (`worker/index.ts`), nicht in den Route-Handlern;
  eine nicht abgewartete Zusage kann Cloudflare abräumen — genau die Falle aus
  dem hängenden Sync-Lauf. Preis: Die Antwort an den Kunden dauert um die
  Versanddauer länger, begrenzt auf **5 Sekunden**.

### Weitere Festlegungen

- **Kartentitel kommen von eBay**, sind also Fremdeingabe. Sie werden für HTML
  maskiert, und aus Betreffzeilen werden Zeilenumbrüche entfernt — sonst ließe
  sich über einen präparierten Titel eine Kopfzeile einschleusen.
- **Ohne `RESEND_API_KEY` ist der Versand ein stiller Leerlauf** mit einer
  Protokollzeile. Der Shop funktioniert dadurch vor und nach dem Hinterlegen
  des Schlüssels gleich; nichts bricht, solange er fehlt.
- **Ton:** geduzt wie der übrige Shop, persönlich, knapp. Kein „Sehr geehrte
  Damen und Herren". Impressum-Link im Fuß, keine Abmeldung (rein
  transaktional).
- **Nicht Teil dieses Auftrags:** eine Absenderadresse einzurichten und die
  Domain bei Resend zu verifizieren. Das sind Zugänge zu Fremddiensten und
  gehört dem Betreiber.
- **Betroffen:** neu `lib/email/config.ts`, `lib/email/send.ts`,
  `lib/email/templates.ts`, `tests/email.test.mjs`; geändert
  `app/api/paypal/capture/route.ts`, `app/api/paypal/webhook/route.ts`,
  `app/api/admin/offers/route.ts`, `app/api/inquiries/route.ts`,
  `app/api/card-submissions/route.ts`, `package.json` (Test), README und
  `.env.example`. **Keine Migration, keine Änderung an Produktionsdaten.**
- **Verifikation:** Tests für die Vorlagen und für die Zusage „wirft nie" ohne
  Netz; Prüfkette; im Browser belegen, dass Anfrage und Ankauf **ohne**
  hinterlegten Schlüssel weiterhin fehlerfrei durchlaufen. **Es wird keine
  E-Mail an echte Empfänger verschickt.**
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler,
  `npm test` **169/169** (20 neue in `tests/email.test.mjs`).
- **Gebaut:** `lib/email/config.ts` (Schlüssel und Absender),
  `lib/email/templates.ts` (die Wortlaute als reine Funktionen),
  `lib/email/send.ts` (der Versand, wirft nie), `lib/email/notify.ts` (die
  Brücke zur Datenbank). Verdrahtet an allen fünf Anlässen.
- **Rot-Nachweis geführt:** Mit ausgebauter HTML-Maskierung fallen genau die
  zwei Tests, die sie prüfen (18/20 statt 20/20). Der Test misst also etwas.
- **Im Browser belegt, dass der Shop ohne Schlüssel unverändert läuft:** Eine
  echte Anfrage über `/anfragen` abgeschickt → `POST /api/inquiries 201`, die
  Zeile steht in der Datenbank (`guest_email`, Status `NEW`), und im Protokoll
  steht nur `[email] RESEND_API_KEY fehlt, es wird nichts verschickt`. **Keine
  E-Mail an echte Empfänger verschickt.**
- **Der Einmal-Riegel:** Beide Zahlungspfade schreiben den Übergang auf
  `CAPTURED` jetzt bedingt (`WHERE status IN ('CREATED','APPROVED')`) und
  verschicken nur bei `meta.changes === 1`. Das ist zugleich eine Korrektur am
  Zahlungspfad selbst: Vorher schrieben **beide** Stellen ungeschützt, ein
  Wettlauf zwischen Rückkehr aus PayPal und Webhook hätte sich still
  überschrieben.

### Dabei einen eigenen Fehler gefunden, der seit dem Nachmittag live war

**`@import "tailwindcss"` stand seit der Schriftumstellung nicht mehr an erster
Stelle** in `app/globals.css` — die zehn `@font-face`-Blöcke waren davorgesetzt
worden. CSS verlangt für `@import` die erste Position, und ein Verstoß ist
**still**: Der Browser verwirft die Zeile kommentarlos.

- **Gefunden** nicht durch eine Prüfung, sondern durch eine Warnung im
  Protokoll des Vorschau-Servers, die beim Starten für diesen Auftrag auffiel.
- **Belegt:** Die gebaute CSS enthielt **null** Treffer für `--tw-`. Nach der
  Korrektur wächst sie von 43 359 auf **49 542 Bytes**.
- **Wirkung, gemessen statt vermutet:** Das Projekt benutzt kaum
  Tailwind-Utilities, verlor also keine Layoutklassen — wohl aber den
  **Reset**, auf dem das ganze handgeschriebene Stylesheet aufbaut. Nachweis:
  Die Kacheln auf der Startseite sind mit Reset **286 px** hoch, ohne ihn
  waren es 278 px, und `box-sizing` steht wieder auf `border-box`.
- **Lehre, als Kommentar an der Stelle hinterlegt:** Der Tailwind-Import muss
  die erste Anweisung bleiben; Ergänzungen gehören darunter. **Und: Die
  Warnungen des Vorschau-Servers gehören gelesen.** Sie standen seit dem
  Nachmittag da; drei Deploys sind darüber hinweggegangen.


### 2026-08-08 — Seitentitel: Sports Cards statt Football Collectibles

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Der Seitentitel „BrandyCards — Football Collectibles" wird zu
  „BrandyCards — Sports Cards". Letzte Stelle im Projekt, die noch von Fußball
  spricht; sie steht in der Registerkarte, im Lesezeichen und in der
  Suchmaschinen-Trefferliste.
- **Betroffen:** `app/layout.tsx:5`. Sonst nichts — `grep` auf `football` und
  `collectibles` findet im ganzen Projekt nur diese eine Zeile.
- **Der Gedankenstrich bleibt.** Er war beim Entfernen der Gedankenstriche
  bewusst ausgenommen: Registerkartentext, kein Fließtext, und dort ist er ein
  üblicher Trenner. Der Auftrag betrifft nur die Wortwahl.
- **Verifikation:** Titel in Produktion prüfen, **und zwar mit `curl` und
  mehreren Abrufen** — der Rand lieferte beim letzten Durchlauf minutenlang
  gemischt alte und neue Fassung.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün (`tsc`, Lint 0 Fehler, 149/149).
  Der Titel lautet jetzt „BrandyCards — Sports Cards".
- **Damit ist die Umbenennung vollständig.** `grep -rni` auf `app/` und `lib/`
  findet weder `football` noch `collectibles`, weder „Fußball" noch
  „Sammelkarten". Der Shop spricht durchgängig von **Sportkarten** bzw.
  **Sports Cards**.
- **In Produktion nachgeprüft, mehrfach hintereinander** statt mit einer
  einzelnen Stichprobe — siehe den Eintrag darunter, warum das nötig ist.


### 2026-08-07 — Doch Sportkarten, nicht Sammelkarten

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** „Sammelkarten" wieder auf **„Sportkarten"** umstellen. Der Betreiber
  hatte den Begriff im vorigen Durchlauf verwechselt und korrigiert das jetzt.
  Damit spricht der Shop **einen** Begriff, statt wie seit einer Stunde zwei.
- **Betroffen:** `app/layout.tsx:6`, `app/ueber-uns/page.tsx:7`,
  `app/ueber-uns/page.tsx:17` — dieselben drei Stellen wie im Durchlauf davor.
  Der Banner sagt bereits „Sportkarten" und bleibt unangetastet.
- **Verifikation:** Kein „Sammelkarten" und kein „Fußball" mehr in sichtbarem
  Text oder in den Beschreibungen, in Produktion nachgeprüft. **Dabei mit einer
  frisch geladenen Seite arbeiten** — beim letzten Mal zeigte der Browser
  minutenlang den alten Text, während `curl` schon den neuen lieferte.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün (`tsc`, Lint 0 Fehler, 149/149).
  Weder „Sammelkarten" noch „Fußball" kommen im Projekt noch vor; der Shop
  spricht durchgängig von **Sportkarten**, passend zur Vorzeile „THE HOME OF
  SPORTS CARDS".
- **Die vier Stellen:** `app/page.tsx:48` (Banner, stand schon so),
  `app/layout.tsx:6`, `app/ueber-uns/page.tsx:7`, `app/ueber-uns/page.tsx:17`.
- **Zur Historie dieser drei Stellen, damit niemand die Kehrtwende für einen
  Fehler hält:** Sie hießen am 2026-08-07 nacheinander „Fußballkarten",
  „Sammelkarten" und nun „Sportkarten". Der mittlere Schritt beruhte auf einer
  Wortverwechslung des Betreibers und wurde von ihm selbst korrigiert.
- **In Produktion nachgeprüft, mit frisch geladener Seite** — die Falle vom
  Durchlauf davor war genau das: Der Browser zeigte minutenlang den alten Text,
  während `curl` schon den neuen lieferte, und das sah aus wie ein
  fehlgeschlagener Deploy. **Erst `curl`, dann der Browser, und der Browser nur
  ohne Cache.**


### 2026-08-07 — Sammelkarten statt Fußballkarten

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Die drei verbliebenen „Fußballkarten"-Stellen auf **„Sammelkarten"**
  umstellen: die beiden Seitenbeschreibungen (`app/layout.tsx:6`,
  `app/ueber-uns/page.tsx:7`) und den Absatz über die beiden Brüder
  (`app/ueber-uns/page.tsx:17`). Der Betreiber hat das ausdrücklich für alle
  drei angeordnet, also auch für die Tatsachenaussage, bei der ich vorher
  nachgefragt hatte.
- **Sprachlich zu beachten:** Die Beschreibung in `layout.tsx` lautet heute
  „Ausgewählte Fußball-Trading-Cards **für Sammler**". Ein bloßes Ersetzen
  ergäbe „Sammelkarten für Sammler" — die Dopplung wird beim Umbau aufgelöst.
- **Bleibt bewusst stehen:** „Sportkarten" im Banner und „THE HOME OF SPORTS
  CARDS" darüber. Der Auftrag galt den drei genannten Stellen. Dass der Shop
  damit an einer Stelle von Sportkarten und sonst von Sammelkarten spricht,
  wird dem Betreiber genannt.
- **Betroffen:** `app/layout.tsx`, `app/ueber-uns/page.tsx`. Nur Text.
- **Verifikation:** Kein „Fußball" mehr in sichtbarem Text oder in den
  Beschreibungen; die Über-uns-Seite im Browser ansehen.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün (`tsc`, Lint 0 Fehler, 149/149).
  **Im ganzen Projekt kommt „Fußball" in keiner Form mehr vor** — geprüft über
  `grep -rni` auf `app/` und `lib/`, und im ausgelieferten HTML von Startseite
  und `/ueber-uns` je null Treffer.
- **Die Dopplung wurde aufgelöst, nicht nur das Wort getauscht:** Aus
  „Ausgewählte Fußball-Trading-Cards **für Sammler**. Persönlich ausgesucht und
  sicher verpackt." wurde „Ausgewählte Sammelkarten, persönlich ausgesucht und
  sicher verpackt." Ein reines Ersetzen hätte „Sammelkarten für Sammler"
  ergeben.
- **Im Browser nachgemessen:** Der Absatz auf `/ueber-uns` steht weiterhin auf
  zwei Zeilen, kein waagerechter Überlauf; beide Seitenbeschreibungen tragen
  den neuen Text.
- **Bewusst stehen geblieben — der Betreiber weiß davon:** Der Banner sagt
  „Sportkarten", die Vorzeile darüber „THE HOME OF SPORTS CARDS", der Rest des
  Shops „Sammelkarten". Beides ist weiter gefasst als Fußball, aber es sind
  **zwei** Begriffe. Wer das vereinheitlichen will, muss sich entscheiden;
  angefasst wird es nur auf Ansage.


### 2026-08-07 — Banner: Fußballkarten wird zu Sportkarten

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Im Banner der Startseite „Fußballkarten" durch „Sportkarten"
  ersetzen (`app/page.tsx`, `.hero-text`).
- **Passt zur Vorzeile darüber**, die schon „THE HOME OF SPORTS CARDS" sagt.
- **Bewusst nur diese eine Stelle.** Drei weitere nennen ebenfalls
  „Fußballkarten": die beiden Seitenbeschreibungen (`app/layout.tsx:6`,
  `app/ueber-uns/page.tsx:7`) und der Absatz über die beiden Brüder
  (`app/ueber-uns/page.tsx:17`). Der Auftrag lautete „hier", und der
  Brüder-Absatz ist eine **Tatsachenaussage** darüber, was die beiden sammeln —
  die zu ändern steht mir nicht zu. Wird dem Betreiber vorgelegt.
- **Betroffen:** `app/page.tsx`. Nur Text.
- **Verifikation:** Im Browser prüfen, dass der Satz weiterhin auf zwei Zeilen
  passt und die Knöpfe darunter nicht verrutschen.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün (`tsc`, Lint 0 Fehler, 149/149).
  Im Browser nachgemessen: bei 1280 px weiterhin **zwei** Zeilen, die
  Knopfleiste steht unverändert bei 581 px; bei 375 px drei Zeilen wie zuvor,
  kein waagerechter Überlauf.
- **Offen für den Betreiber:** Drei Stellen sagen weiter „Fußballkarten":
  `app/layout.tsx:6`, `app/ueber-uns/page.tsx:7` und
  `app/ueber-uns/page.tsx:17`. Die ersten beiden sind Seitenbeschreibungen für
  Suchmaschinen, die dritte eine Aussage darüber, was die beiden Brüder
  sammeln. **Ob sie mitziehen, entscheidet der Betreiber** — der Banner spricht
  seit heute von Sportkarten, die Über-uns-Seite von Fußballkarten.


### 2026-08-07 — Gedankenstriche raus, Verkaufen-Kachel korrigiert

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Textänderungen aus einer Sichtprüfung des Betreibers.
  1. **Gedankenstriche raus.** Sie durchziehen die Werbetexte („Der komplette
     Bestand mit Suche und Filter — Festpreis, Auktion und Vormerkliste."). Die
     Sätze werden dabei umgebaut, nicht nur der Strich durch ein Komma ersetzt.
  2. **„Preisvorschlag" auf der Verkaufen-Kachel der Startseite** ist das
     falsche Wort: Dort nennt der Kunde *uns* seinen Preis.
- **Befund zu Punkt 2, der die Sache entscheidet:** „Preisvorschlag" ist im
  Shop bereits **belegt** — so heißt die Verhandlung auf der Käuferseite
  (`lib/price-offers.ts`, `app/karten/[id]/offer-form.tsx`). Die Seite
  `/verkaufen`, auf die die Kachel zeigt, sagt dagegen schon
  **„Preisvorstellung"** und **„Wunschpreis"**. Die Kachel ist also nicht nur
  schief formuliert, sie **widerspricht ihrem eigenen Ziel und belegt ein Wort
  doppelt**. Sie wird an die Seite angeglichen, nicht neu erfunden.
- **Umfang:** Alle zwölf Gedankenstriche in sichtbarem Text, auch die vier, die
  der Betreiber nicht abgebildet hat (`/anfragen` zweiter Absatz, Vormerk-
  Formular auf `/karten`, zwei Stellen im Angebotsformular). Ein halb
  bereinigter Shop wäre schlechter als gar keiner.
- **Bewusst ausgenommen:** die beiden `<title>`-Angaben
  („BrandyCards — Football Collectibles", „Über uns — BrandyCards"). Das ist
  Registerkartentext, kein Fließtext; dort ist der Strich ein üblicher Trenner
  und hat keine Alternative, die nicht schlechter aussieht. Wird dem Betreiber
  genannt.
- **Betroffen:** `app/page.tsx`, `app/karten/page.tsx`, `app/anfragen/page.tsx`,
  `app/ueber-uns/page.tsx`, `app/karten/[id]/offer-form.tsx`. **Nur Text —
  kein Verhalten, keine Datenbank, keine API, kein eBay-Aufruf.**
- **Verifikation:** `grep` auf `—` in sichtbarem Text muss leer sein; Prüfkette;
  die geänderten Seiten im Browser ansehen, damit kein Satz umbricht oder
  seine Kachel sprengt.
- **Ergebnis: ABGESCHLOSSEN.** Zwölf Stellen umformuliert. Prüfkette grün
  (`tsc`, Lint 0 Fehler, 149/149).
- **Im Browser nachgemessen, nicht nur im Quelltext ersetzt:** Startseite,
  `/karten`, `/anfragen`, `/ueber-uns` und `/verkaufen` enthalten im
  ausgelieferten Text **null** Gedankenstriche. Die vier Kacheln auf der
  Startseite stehen weiter auf gleicher Höhe (je 278 px), kein Text läuft über
  seinen Kasten hinaus, und bei 375 px gibt es keinen waagerechten Überlauf.
- **Die geänderten Sätze:**
  - „… mit Suche und Filter**.** Festpreis, Auktion und Vormerkliste."
  - „… Schreib uns**,** auch ohne Kundenkonto."
  - „Unser gesamter Bestand**.** Jede Karte einzeln geprüft …"
  - „Hinterlasse deine E-Mail-Adresse**.** Wir melden uns …"
  - „Schreib uns, wonach du suchst**.** Ein Kundenkonto brauchst du dafür
    nicht …"
  - „… desto schneller finden wir sie**.** Set, Spieler und Kartennummer …"
  - „Verhandeln geht nur mit Kundenkonto**.** So wissen wir …"
  - Platzhalter: „Optional**,** zum Beispiel wenn du mehrere Karten möchtest"
  - „… Begeisterung für Fußballkarten**.** Ehrlich, persönlich und …"
  - „… zu groß für zwei Ordner war**. Daraus wurde** BrandyCards."
  - „… zeigt denselben Bestand**. Beides ist** synchronisiert, damit …"
- **Zur Verkaufen-Kachel:** aus „Karten anbieten oder einen **Preisvorschlag**
  machen" wurde „Karten anbieten und deinen **Wunschpreis** nennen. Bilder
  kannst du direkt mitschicken." Damit spricht die Kachel dieselbe Sprache wie
  die Seite, auf die sie zeigt, und das Wort „Preisvorschlag" bleibt der
  Käuferverhandlung vorbehalten. Der Grund steht als Kommentar an der Stelle,
  damit ihn niemand versehentlich zurückdreht.
- **Ausgenommen geblieben:** die beiden `<title>`-Angaben (`app/layout.tsx:5`,
  `app/ueber-uns/page.tsx:6`). Registerkartentext, kein Fließtext. Wird dem
  Betreiber genannt; ein Wechsel auf `·` oder `|` wäre jederzeit möglich.


### 2026-08-07 — Banner: Grafik und Überschrift nicht mehr markierbar

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Zwei Mängel, die der Betreiber beim Markieren von Text auf der
  Startseite gesehen hat.
  1. **Die Kartengrafik rechts im Banner ist auswählbarer Text.** „BRANDYCARDS",
     „01 / 01", „BC", „THE COLLECTOR'S CHOICE", „LEVERKUSEN GERMANY" und
     „EST. 2026" stehen als echte HTML-Elemente da (`app/page.tsx`,
     `.hero-art`). Beim Markieren wird die Grafik zu einer Ansammlung blauer
     Kästen — sie soll sich wie ein Bild verhalten.
  2. **Die Markierungen der beiden Überschriftzeilen überlappen sich.**
- **Ursache von 2, gemessen statt vermutet:** Bei 89,6 px Schriftgröße ist die
  Zeilenhöhe `.9` = 80,64 px, die Zeilen stehen also 82 px auseinander. Das
  gemalte Markierungsrechteck ist aber **123 px** hoch — der Browser nimmt
  dafür die **Schriftmetriken** (Oberlänge + Unterlänge ≈ 1,37 em), nicht die
  Zeilenhöhe. Daraus **40 px Überlappung**; das Rechteck der ersten Zeile legt
  sich über die Oberlängen von „character.".
- **Vier Wege, alle durchgemessen:**

  | Weg | Überlappung | Höhe der Überschrift | Preis |
  |---|---|---|---|
  | so lassen | 40 px | 164 px | — |
  | `line-height: 1.37` | 0 px | 249 px | **+85 px, das enge Satzbild ist hin** |
  | Schriftmetriken stutzen | 10 px | 163 px | kursive Zeile rutscht 10 px |
  | nicht markierbar | entfällt | 164 px | Überschrift lässt sich nicht kopieren |

  Der dritte Weg ist erst möglich, seit wir die Schriften selbst ausliefern
  (`ascent-override` in einer eigenen `@font-face`-Familie). Er drückt das
  Rechteck von 123 px auf **81 px**, also genau auf die Zeilenhöhe — bringt die
  Überlappung aber nicht ganz auf null und verschiebt die kursive Zeile
  sichtbar.
- **Gewählt: der vierte Weg für beide Punkte** — `user-select: none` auf der
  Kartengrafik **und** auf der Banner-Überschrift. Begründung: Er löst beide
  Mängel vollständig und **verändert die Darstellung um keinen einzigen
  Bildpunkt**; der Betreiber hat ausdrücklich gesagt, dass ihm der Banner
  gefällt. Die Kartengrafik ist reine Dekoration, die Überschrift ein
  Schaubild aus zwei Wörtern — beides ist nichts, was jemand herauskopieren
  will. **Der Fließtext darunter bleibt markierbar**, der ist Inhalt.
- **Warum kein echtes Bild aus der Kartengrafik:** Der Wunsch war „soll ein
  Bild sein". Das Ziel dahinter — sie soll sich beim Markieren wie ein Bild
  verhalten — erreicht `user-select: none` vollständig. Eine Rastergrafik
  daraus zu machen kostet Ladezeit, wird auf hochauflösenden Bildschirmen
  unschärfer als die jetzige CSS-Zeichnung und friert Farben ein, die heute aus
  den Farbvariablen kommen. Wird dem Betreiber als Alternative genannt.
- **Mitzunehmen:** `.hero-art` trägt ein `aria-label` an einem `div` **ohne
  Rolle** — das ist wirkungslos. Richtig ist `aria-hidden="true"`, denn für
  Vorleseprogramme ist die Grafik Zierrat; heute lesen sie „BRANDYCARDS 01 / 01
  BC …" mit.
- **Betroffen:** `app/globals.css`, `app/page.tsx`. **Kein Datenmodell, keine
  API, keine Datenbank, kein eBay-Aufruf.**
- **Verifikation:** Im Browser eine Auswahl über die ganze Seite legen und
  messen, dass aus Kartengrafik und Überschrift **kein** Text in der Auswahl
  landet, der Fließtext aber schon; dazu belegen, dass sich die dargestellten
  Maße von Überschrift und Grafik **nicht** geändert haben.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün (`tsc`, Lint 0 Fehler, 149/149).
  Gemessen im Browser:
  - `user-select` ist auf Überschrift, Grafik, Kartenvorderseite,
    Spielerkürzel und Stempel `none`.
  - Eine Auswahl über das **einzelne** Element liefert bei allen dekorativen
    Teilen **0 Zeichen**; der Fließtext dagegen 94.
  - Eine Auswahl über das **ganze** Banner enthält nur noch Vorzeile,
    Fließtext und die beiden Knöpfe — kein „BC", kein „COLLECTOR'S CHOICE",
    kein „EST. 2026", keine Überschrift.
  - **Maße unverändert:** Überschrift 435×164, Grafik 530×430 — dieselben
    Werte wie vorher. Es hat sich kein Bildpunkt verschoben.
- **Zwei Messverfahren von mir taugten nichts — beide aus demselben Grund:**
  1. Ein **programmatisch** über `document.body` gelegter Bereich meldete den
     Kartentext weiter als ausgewählt. Die Range-API kennt `user-select` nicht;
     sie beschreibt Geometrie und Inhalt, nicht das, was der Nutzer auswählen
     kann. Dasselbe gilt für `Range.getClientRects()` — es liefert weiter
     Rechtecke über der Grafik, obwohl dort nichts markiert werden kann.
  2. `document.caretRangeFromPoint` als Ersatz gedacht: ebenfalls untauglich,
     das ist Treffererkennung und ignoriert `user-select` genauso.
     **Tragfähig ist allein `Selection.toString()` je Element.**
  Nebenbei aufgeklärt: Ein Treffer auf „BRANDYCARDS" in der Auswahl kam nicht
  aus der Grafik, sondern aus dem Link „Mehr über BrandyCards" — `Selection`
  gibt den **dargestellten** Text zurück, `text-transform:uppercase` schlägt
  also durch.
- **Was ich nicht prüfen konnte:** einen Blick auf das gemalte Bild. Die
  Vorschau ließ sich in dieser Sitzung nicht einblenden, Bildschirmfotos
  scheiterten. Der Nachweis stützt sich deshalb auf die Textauswahl und die
  berechneten Stile, nicht auf den Augenschein. **Wer als Nächstes hier ist:
  einmal mit der Maus über den Banner ziehen und hinsehen.**


### 2026-08-07 — Logo von 730 KB auf 30 KB

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Das Logo verkleinern. Es ist eine **747 KB** große PNG mit
  1264×842 Bildpunkten und wird mit **164 px** Breite dargestellt (112 px auf
  schmalen Geräten). Der Betreiber hat zugestimmt, nachdem der Befund vorlag.
- **Warum es trotz `immutable` noch zählt:** Das Caching hilft ab dem zweiten
  Besuch. Der **erste** Besuch lädt 747 KB, und das Logo steht im Kopf jeder
  Seite — es konkurriert also mit dem Text um die erste Sekunde.
- **Geplante Schritte:**
  1. Mit `sharp` mehrere Varianten erzeugen und **messen statt schätzen**:
     verkleinerte PNG, PNG mit reduzierter Palette, WebP. Dann die kleinste
     wählen, die verlustfrei genug aussieht.
  2. Zielbreite **500 px**: Das ist mehr als das Doppelte der größten
     Darstellung (164 px) und deckt damit auch Bildschirme mit doppelter und
     dreifacher Punktdichte ab, ohne unscharf zu werden.
  3. **Das Original bleibt im Repository** (`app/brand/…-original.png`), wird
     aber nicht importiert und landet damit auch nicht im Bauergebnis. Ein
     verkleinertes Bild lässt sich nicht wieder vergrößern; die Vorlage muss
     auffindbar bleiben.
  4. `assets.d.ts` um `*.webp` ergänzen, falls die Wahl darauf fällt.
- **Betroffen:** `app/site-chrome.tsx`, `assets.d.ts`, neu `app/brand/*`.
  **Kein Code sonst, keine Datenbank, keine API, kein eBay-Aufruf.**
- **Verifikation:** Größe vorher/nachher belegen; im Browser prüfen, dass das
  Logo in Kopf **und** Fuß lädt, die Kopfleiste bei 126 px bleibt (sonst
  stimmt `--header-h` nicht mehr) und das Bild bei 375 px wie bei 1280 px
  scharf aussieht — also die gerenderten Maße gegen die natürlichen halten.
- **Risiko und Rückweg:** Sichtbare Verschlechterung eines Markenzeichens. Der
  Rückweg ist ein Zeilenwechsel im Import zurück auf das Original, das genau
  dafür liegen bleibt.
- **Ergebnis: ABGESCHLOSSEN.** `app/brand/brandycards-logo.png`, 500×333,
  **30,4 KB statt 729,8 KB — 4,2 % der ursprünglichen Größe.** Prüfkette grün
  (`tsc`, Lint 0 Fehler, 149/149).
- **Die Wahl fiel gegen WebP, und zwar aufgrund einer Messung.** Nach
  Dateigröße allein hätte WebP gewonnen (19–24 KB gegen 30 KB). Entscheidend
  war aber, **wie viel vom Original übrig bleibt**. Verglichen wurde bei 328 px
  — der doppelten Anzeigebreite — auf dem echten Kopfleisten-Hintergrund
  `#f2f0eb`:

  | Variante | Größe | mittlere Abweichung | größter Fehler | sichtbar abweichend |
  |---|---|---|---|---|
  | **PNG 500, Palette** | **30,4 KB** | **0,49** | **24** | **3,7 %** |
  | WebP 500, q90 | 24,2 KB | 1,86 | 63 | 15,7 % |
  | WebP 500, q82 | 19,4 KB | 1,98 | 71 | 16,9 % |
  | WebP 500, verlustfrei | 77,3 KB | 1,45 | 43 | 13,3 % |
  | PNG 500, volle Farbtiefe | 127,6 KB | 0,27 | 21 | 1,7 % |

  Die Palette-PNG ist 6 KB größer als WebP q90 und dabei **rund viermal
  originalgetreuer**. Bei einem Markenzeichen ist das die richtige Seite des
  Tauschs; die vollfarbige PNG wäre nochmals besser, kostet aber das Vierfache
  für einen Unterschied, den bei 164 px niemand sieht. Nebenbei entfällt damit
  die Frage nach WebP-Unterstützung und eine Ergänzung in `assets.d.ts`.
- **Eine Messung, die zuerst Unsinn ergab — als Warnung:** Der erste Vergleich
  lief auf den rohen RGBA-Werten und meldete für *jede* Variante einen
  Maximalfehler von 255. Ursache: In vollständig durchsichtigen Bildpunkten ist
  der Farbwert beliebig, und davon besteht ein Logo mit Freisteller
  größtenteils. **Erst das Auflegen auf den echten Hintergrund macht den
  Vergleich aussagekräftig.** Wer hier nachmisst, muss `flatten` benutzen.
- **Im Browser gemessen:** Beide Logos (Kopf und Fuß) laden, natürlich 500×333.
  Bei 1280 px dargestellt mit 164×109 — Schärfereserve **3,05×**, deckt also
  dreifache Punktdichte. Bei 375 px dargestellt mit 112×75, Reserve **4,46×**.
  Kopfleiste unverändert 126 px bzw. 92 px und deckungsgleich mit `--header-h`,
  kein waagerechter Überlauf, keine fehlerhaften Abrufe.
- **Das Original bleibt als `app/brand/brandycards-logo-original.png` liegen**
  und wird **nicht** importiert — im Bauergebnis steht nur die 30-KB-Fassung
  (nachgeprüft: `find dist -name "*original*"` ist leer). Wer das Logo neu
  aufbereitet, geht von dieser Vorlage aus, nicht von der verkleinerten Datei.


### 2026-08-07 — Schriften und Logo in den Build, mit Inhalts-Hash

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Schriften **und** Logo aus `public/` in den Build geben, damit sie
  einen Inhalts-Hash im Dateinamen bekommen — und damit dauerhaft gecacht
  werden.
- **Befund, gemessen:** Der Build vergibt zwei Klassen von Cache-Regeln.
  Gehashte Bau-Ergebnisse (`/assets/index-CwO5vYEP.css`) bekommen
  `max-age=31536000, immutable`. **Alles unter `public/` bekommt
  `max-age=0, must-revalidate`** — Schriften und Logo also auch. Der Browser
  fragt sie bei jedem Seitenaufruf neu an; die Antwort ist ein 304 ohne Daten,
  aber der Rundlauf bleibt. Von hier aus dreimal gemessen: **85 ms**. Bis er
  durch ist, zeigt `font-display: swap` die Ersatzschrift — der Schriftwechsel
  ist damit bei *jedem* Besuch kurz sichtbar, nicht nur beim ersten.
- **Warum nicht einfach die Header ändern:** Ohne Hash im Dateinamen würde ein
  langes `max-age` einen späteren Austausch derselben Datei bei Bestandskunden
  monatelang blockieren. Der Hash löst beides zugleich — deshalb der Weg über
  den Build und nicht über eine Cache-Regel daneben.
- **Geplante Schritte:**
  1. Die zehn `woff2` von `public/fonts/` nach `app/fonts/` verschieben und in
     `app/globals.css` die zehn `url('/fonts/…')` auf `url('./fonts/…')`
     umstellen. Relative Pfade in CSS fasst Vite an, absolute nicht.
  2. Das Logo aus `public/` in den Build geben und in `app/site-chrome.tsx` an
     **zwei** Stellen (Kopfzeile und Fuß) darauf verweisen.
  3. **Offene Frage, die empirisch zu klären ist, nicht durch Annahme:** Was
     ein Bild-Import in diesem Projekt liefert. Unter Vite ist das eine
     Zeichenkette, unter Next.js ein `StaticImageData`-Objekt mit `src`,
     `width` und `height` — und vinext ist beides zugleich. Deshalb erst
     ausprobieren und `npx tsc --noEmit` sowie das Bauergebnis ansehen, bevor
     die Form feststeht.
- **Betroffen:** `app/globals.css`, `app/site-chrome.tsx`, neu `app/fonts/*`,
  Entfall von `public/fonts/` und `public/BrandyCards_Logo_transparent.png`.
  **Kein Datenmodell, keine API, keine Datenbank, kein eBay-Aufruf.**
- **Verifikation:** In Produktion belegen, dass Schriften und Logo gehashte
  Namen tragen **und** `cache-control: …immutable` liefern; dazu Kopfzeile und
  Fuß im Browser ansehen, damit das Logo nicht still verschwindet.
- **Nebenbefund, noch nicht entschieden:** Das Logo ist eine **747 KB** große
  PNG und wird mit 164 px Breite dargestellt (Original 1264×842). Das ist
  unabhängig vom Cache zu viel und trifft jeden Erstbesucher. Nicht Teil dieses
  Auftrags — ein Neucodieren verändert ein Gestaltungsmittel des Betreibers und
  wird ihm vorgelegt.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler,
  `npm test` 149/149. Alle elf Dateien tragen jetzt einen Inhalts-Hash und
  liegen unter `/assets/`, `public/` enthält nur noch die vier SVG-Symbole.
- **Die offene Frage aus Schritt 3 ist beantwortet — und meine erste Annahme
  war falsch.** Ich hatte den Bild-Import als Zeichenkette deklariert, wie es
  unter reinem Vite richtig wäre. **vinext folgt aber Next.js und liefert ein
  Objekt** `{src, width, height}`. Der Typprüfer schwieg dazu, weil die
  Deklaration selbst die falsche Behauptung war — `npx tsc --noEmit` lief
  sauber durch, während die Seite kaputt war.
  **Sichtbar wurde es erst im Browser:** `src="[object Object]"`, das Logo lud
  nicht (`naturalWidth` 0), und die Kopfleiste fiel von 126 px auf **59 px**
  zusammen. JSX verkettet das Objekt still zu `[object Object]`, statt zu
  klagen. Genau dafür stand der Punkt als „empirisch klären" im Plan.
  Belegt am Bauergebnis: `a=\`/assets/BrandyCards_Logo_transparent-BAqeCyeB.png\`,
  o={width:1264,height:842}, c={src:a,…}`. `assets.d.ts` hält die Form und den
  Grund fest.
- **Mitgenommen, weil die Maße nun ohnehin zur Hand sind:** `width` und
  `height` stehen jetzt am `<img>`. Der Browser kann den Platz damit
  reservieren, bevor das Bild da ist — bei 747 KB im Kopf jeder Seite nicht
  nebensächlich. Die CSS setzt die Anzeigebreite weiterhin (164 px bzw. 112 px
  auf schmalen Geräten).
- **Lokal im Browser gemessen:** beide Logos geladen, 1264×842 natürlich,
  164×109 dargestellt, Kopfleiste wieder **126 px** und deckungsgleich mit
  `--header-h`; Schriften laden, kein Fremdhost, keine fehlerhaften Abrufe.


### 2026-08-07 — Schriften selbst ausliefern statt von Google

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Die drei Schriften selbst ausliefern statt von Google Fonts. Der
  Betreiber hat sich am 2026-08-07 dafür entschieden, nachdem der Befund
  vorlag.
- **Warum:** `app/globals.css:1` lädt DM Mono, Manrope und Playfair Display per
  `@import` von `fonts.googleapis.com`. Die CSP erlaubt nur
  `style-src 'self' 'unsafe-inline'` — der Browser **blockt den Import**.
  Nachgeprüft, dass das nicht nur lokal gilt: Die ausgelieferte CSS in
  Produktion trägt den `@import`, und der `content-security-policy`-Kopf dort
  nennt dieselbe Regel. **Der Shop läuft seit jeher auf Ersatzschriften.**
- **Warum selbst ausliefern und nicht die CSP öffnen:** Zwei Fremdhosts weniger
  (`fonts.googleapis.com` für die CSS, `fonts.gstatic.com` für die Dateien),
  die CSP bleibt eng, und es entfällt ein Datenabfluss an Google bei jedem
  Seitenaufruf — was die Datenschutzerklärung sonst nennen müsste. Dazu ein
  Rundlauf weniger beim Laden: Der Browser muss heute erst die CSS holen, um
  überhaupt zu erfahren, welche Dateien er braucht.
- **Geplante Schritte:**
  1. Die `woff2`-Dateien von `fonts.gstatic.com` holen, **nur die Schnitte
     `latin` und `latin-ext`**. `latin-ext` wird gebraucht, weil Kartentitel
     von eBay polnische und südslawische Namen enthalten (`Kamiński`,
     `Jovanović`) — ohne den Schnitt wechselt mitten im Wort die Schrift.
     Nicht geholt werden Kyrillisch, Griechisch und Vietnamesisch.
  2. Ablage in `public/fonts/`. Die CSP erlaubt `font-src 'self' data:`,
     eigene Dateien sind damit ohne Änderung an der Regel abgedeckt.
  3. `@import` in `app/globals.css` durch `@font-face`-Blöcke ersetzen, mit
     `font-display:swap` und den `unicode-range`-Angaben aus der Google-CSS —
     ohne sie lädt der Browser beide Schnitte statt nur des gebrauchten.
  4. Manrope und Playfair Display sind **variable** Schriften (ein Schnitt
     deckt `400 800` bzw. `500 600` ab), DM Mono ist statisch und braucht 400
     und 500 einzeln.
- **Betroffen:** `app/globals.css`, neu `public/fonts/*.woff2`.
  **Kein Code, keine Datenbank, keine Migration, kein eBay-Aufruf.** Die CSP
  bleibt unverändert — das ist der Punkt der Übung.
- **Verifikation:** Im Browser messen, nicht im Markup suchen: keine
  CSP-Meldung mehr in der Konsole, kein Abruf an `fonts.gstatic.com` oder
  `fonts.googleapis.com` in den Netzwerkanfragen, und die tatsächlich
  verwendete Schrift über `document.fonts.check` bzw. die gerenderte
  Textbreite gegen die Ersatzschrift prüfen. Danach Prüfkette und Deploy.
- **Rückweg:** Der `@import` ist eine Zeile; die Schriftdateien stören nicht,
  wenn sie ungenutzt liegen bleiben.
- **Ergebnis: ABGESCHLOSSEN.** Zehn `woff2`-Dateien unter `public/fonts/`,
  zusammen **228 KB**; `@import` durch zehn `@font-face`-Blöcke ersetzt.
  Prüfkette grün: `tsc` sauber, Lint 0 Fehler, `npm test` 149/149.
- **Im Browser gemessen, nicht im Markup gesucht:**
  - **Netzwerk:** alle Schriftabrufe gehen an `/fonts/…`, alle mit 200. **Kein
    einziger Abruf an `fonts.gstatic.com` oder `fonts.googleapis.com`.**
  - **Konsole:** keine Fehler mehr. Vorher standen dort bei jedem Seitenaufruf
    CSP-Meldungen zur blockierten Google-CSS.
  - **Tatsächlich geladen** meldet `document.fonts`: DM Mono 400, DM Mono 500,
    Manrope 400–800 und Playfair Display italic — also genau die Schnitte, die
    die Seite braucht.
  - **`unicode-range` wirkt:** Auf einer normalen Seite lädt der Browser **nur**
    `latin`. Erst als Text mit `Kamiński`, `Jovanović` und `Šešelj` im Dokument
    stand, kam `manrope-…-latin-ext.woff2` dazu. Der Schnitt ist damit belegt
    nötig und kostet trotzdem nichts, solange er nicht gebraucht wird.
- **Ein Messversuch, der nichts taugte — damit ihn niemand wiederholt:** Ich
  wollte die Schrift über die gerenderte Textbreite gegen `sans-serif`
  nachweisen. Ergebnis: 539 px gegen 536 px. Manrope und die Ersatzschrift des
  Browsers liegen so dicht beieinander, dass die Messung **nichts** belegt —
  weder das eine noch das andere. Tragfähig sind die Netzwerkanfragen und
  `document.fonts`, nicht die Breite.
- **Nach dem Deploy in Produktion nachgeprüft:** `document.fonts` meldet DM Mono
  400/500 und Manrope als geladen, `performance.getEntriesByType('resource')`
  zeigt **keinen einzigen Fremdhost** mehr, die Konsole ist fehlerfrei, und
  `/fonts/manrope-400-800-normal-latin.woff2` antwortet mit 200 und
  `content-type: font/woff2`. Deployed als Version `eb242e0b`.
- **Offen geblieben, erst nach dem Deploy gemessen:** Die Schriften werden mit
  `cache-control: public, max-age=0, must-revalidate` ausgeliefert. Der Browser
  fragt sie damit bei **jedem** Seitenaufruf neu an — die Antwort ist zwar ein
  304, aber der Rundlauf bleibt. Für Dateien, die sich praktisch nie ändern,
  ist das verschenkt. **Nicht einfach hochgesetzt**, weil die Dateinamen
  **keinen Inhalts-Hash** tragen (`manrope-400-800-normal-latin.woff2`): Mit
  einem langen `max-age` würde ein späterer Austausch derselben Datei bei
  Bestandskunden monatelang nicht ankommen. Der saubere Weg ist ein Hash im
  Dateinamen und dann `immutable` — das ist eine eigene Änderung.
- **Nicht gemacht, bewusst:** Kein `<link rel="preload">` für die beiden
  wichtigsten Schriften. Der Browser entdeckt die Dateien erst, wenn er die CSS
  geparst hat; ein Preload würde den ersten Textaufbau beschleunigen. Das ist
  eine eigene Änderung mit eigener Messung und gehörte nicht in diesen Auftrag.


### 2026-08-07 — Warenkorb-Umschalter und Blättern im Bestand

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Zwei Punkte aus einer Sichtprüfung des Betreibers.
  1. **Eine Karte lässt sich nicht wieder aus dem Warenkorb nehmen.** Auf
     `/karten` steht der Knopf nach dem Hinzufügen auf „Bereits im Warenkorb"
     und ist **deaktiviert** — eine Sackgasse. Der einzige Weg hinaus führt
     über den Checkout, wo es einen „Entfernen"-Knopf gibt. Das ist umständlich.
  2. **`/karten` listet alle 294 Angebote auf einer Seite.** Gewünscht ist
     Blättern mit 10, 20, 50 oder 100 Karten je Seite.
- **Befund zum ersten Punkt, beim Lesen dazugekommen:** Der „Entfernen"-Knopf
  im Checkout schreibt zwar den `sessionStorage`, löst aber **kein**
  `brandycards-cart-changed` aus. Nachgezogen, weil `useCart` genau an diesem
  Ereignis hängt.
  **Meine Begründung dafür war beim Planen falsch, und die Messung hat sie
  widerlegt:** Ich hatte geschrieben, die Zahl im Warenkorbsymbol der
  Kopfleiste bleibe dadurch stehen. Der Checkout rendert aber **gar keine
  Kopfleiste** (`document.querySelector('.site-header-bar')` → `null`), es gibt
  dort also keinen Abnehmer des Ereignisses. Der Fehler ist heute **folgenlos**.
  Die Zeile bleibt trotzdem drin: Sie kostet nichts, und der Tag, an dem der
  Checkout eine Kopfleiste bekommt, wäre sonst der Tag mit der falschen Zahl.
  **Als Fehler gemeldet hätte ich ihn nicht dürfen, ohne ihn gesehen zu haben.**
- **Geplante Umsetzung:**
  - `useCart` bekommt `removeFromCart`. Der Knopf wird vom deaktivierten
    Hinweis zu einem **Umschalter**: „In den Warenkorb" ↔ „Aus dem Warenkorb".
  - `cartButtonState` entscheidet künftig auch die Aktion (`add` / `remove` /
    keine). **Wichtig:** Liegt eine Karte im Warenkorb und ist inzwischen
    ausverkauft, muss „Entfernen" trotzdem möglich sein — sonst klemmt sie
    dauerhaft fest. Deshalb wird „im Warenkorb" **vor** „nicht verfügbar"
    geprüft.
  - `cartButtonState` und die Blätter-Rechnung wandern nach `lib/` und
    bekommen Tests. Beides ist reine Entscheidungslogik und ohne Browser
    prüfbar — dieselbe Bewegung wie bei `lib/ebay-stock-check.ts`.
  - Seitengröße und Seitenzahl stehen in der URL (`?pro=50&seite=3`), gelesen
    über `window.location` im Mount-Effekt, geschrieben mit `replaceState`.
    **Grund:** Wer von Seite 7 in eine Karte klickt und zurückgeht, landet
    sonst wieder auf Seite 1. Kein `useSearchParams`, weil das eine
    Suspense-Grenze verlangt; kein Lesen von `window` beim ersten Rendern,
    das bräche die Hydration.
- **Betroffen:** `lib/cart.ts` (neu), `lib/pagination.ts` (neu),
  `tests/cart-and-pagination.test.mjs` (neu, in `npm test` aufnehmen),
  `app/site-chrome.tsx`, `app/karten/page.tsx`, `app/karten/[id]/page.tsx`,
  `app/gallery.tsx`, `app/checkout/page.tsx`, `app/globals.css`.
  **Keine Datenbank, keine Migration, kein eBay-Aufruf.**
- **Verifikation:** `npx tsc --noEmit`, `npm run lint`, `npm test`; dazu im
  laufenden Browser messen statt nur im Markup suchen — Hinzufügen und
  Entfernen samt Zahl in der Kopfleiste, Blättern bei allen vier Seitengrößen,
  Rücksprung aus einer Kartendetailseite auf dieselbe Seite, Verhalten bei
  aktiver Suche. Danach Prüfkette und Deploy (Dauerfreigabe).
- **Angekündigt:** Danach folgen noch inhaltliche Textänderungen.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler (die
  bekannte `img`-Warnung), `npm test` **149/149** — 19 neue Tests in
  `tests/cart-and-pagination.test.mjs`.
- **Im laufenden Browser gemessen, mit 137 Testkarten in der lokalen D1**
  (Produktionsdaten unberührt):
  - **Warenkorb:** Klick → „Aus dem Warenkorb ×", Kopfzahl 0 → 1,
    `sessionStorage` `{id:1}`. Zweiter Klick → „In den Warenkorb +",
    Kopfzahl zurück auf 0, Warenkorb `{}`.
  - **Der Randfall, der die Prüfreihenfolge begründet:** Eine Karte mit
    Bestand 0, die im Warenkorb liegt, zeigt „Aus dem Warenkorb" und ist
    **klickbar**. Nach dem Entfernen steht sie auf „Nicht verfügbar" und ist
    gesperrt. Genau so soll es sein — ohne die Reihenfolge klemmte sie fest.
  - **Blättern:** 137 Karten → 7 Seiten zu 20, 3 zu 50, 14 zu 10. Letzte Seite
    korrekt unvollständig (`Karte 101–137 von 137`, 37 Karten), „Weiter"
    gesperrt, „Zurück" nicht.
  - **URL:** Seite 1 mit Vorgabegröße lässt die URL leer, sonst
    `?pro=50&seite=3`. Direktaufruf dieser URL stellt Größe **und** Seite
    wieder her.
  - **Der eigentliche Zweck der URL, durchgespielt:** Von `?pro=50&seite=3` in
    eine Karte geklickt, dann zurück — die Übersicht steht wieder auf Seite 3
    mit 50 je Seite.
  - **Suche:** Von Seite 6 aus „Griezmann" getippt → 19 Treffer, Seite 1,
    Blätterleiste verschwindet, URL leer. Ohne das Zurücksetzen wäre eine leere
    Ansicht erschienen.
  - **375 px:** kein waagerechter Überlauf, Leiste bricht auf 331 px um.
- **Zwei Dinge, die erst die Messung gezeigt hat:**
  1. **„Nicht verfügbar +"** — der gesperrte Knopf trug weiter das Pluszeichen
     und versprach damit etwas, das nicht geht. Das Zeichen hängt jetzt an der
     Aktion, nicht am Knopf.
  2. **Tippziele von 36×35 px** auf dem Handy. Unter 850 px jetzt 44×43 px; die
     Leiste bricht dort ohnehin um, die Höhe kostet also keine Breite.
- **Eine Erwartung im Test war falsch, nicht der Code:** Ich hatte
  `pageNumbers(1, 5)` als `[1,2,3,…,5]` erwartet, geliefert wurde `[1,2,…,5]`.
  Der Code hatte recht — aber die Leiste war zu geizig: Sie versteckte zwei
  Seiten hinter einem Zeichen derselben Breite. Das Fenster steht deshalb jetzt
  auf 2 statt 1. Bis sieben Seiten stehen damit vollständig da, bei 30 Seiten
  bleiben es höchstens neun Schaltflächen — beides durch Tests festgehalten.
- **Nebenbefund, nicht behoben, betrifft das Aussehen des ganzen Shops:**
  `app/globals.css:1` lädt DM Mono, Manrope und Playfair Display per `@import`
  von `fonts.googleapis.com`. Die CSP erlaubt aber nur
  `style-src 'self' 'unsafe-inline'` — der Browser **blockt den Import**.
  Nachgeprüft, dass das nicht nur lokal gilt: Die ausgelieferte
  `assets/index-DxBX5tCZ.css` in Produktion trägt den `@import`, und der
  `content-security-policy`-Kopf dort nennt dieselbe Regel. **Der Shop läuft
  damit in Produktion auf Ersatzschriften.** Nicht angefasst, weil die
  Behebung eine Entscheidung verlangt: Schriften selbst ausliefern (dann bleibt
  die CSP eng und es entfällt ein Fremddienst) oder `fonts.googleapis.com` und
  `fonts.gstatic.com` in die Regel aufnehmen. Gehört dem Betreiber vorgelegt.
- **Nebenbefund zur Doku:** Der offene Punkt „`allowScripts` ist bewusst nicht
  eingecheckt" stimmt nicht mehr — das Feld steht seit Commit `c4abc9c`
  („Checke die Freigabe der Installationsskripte ein") in der `package.json`.
  Der Punkt ist entsprechend korrigiert.

### 2026-08-07 — „Neu dabei" ist echt, und die Dauerfreigabe wächst

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Zwei überholte Stellen in dieser Datei schließen, beide durch
  Messung an der Produktion belegt statt durch Annahme.
- **Anlass:** Eine reine Durchsicht von GitHub, lokalem Stand und allen
  `.md`-Dateien. Sie ergab: alles synchron (`main`,
  `agent/initial-brandycards` und die Worktrees auf `8eabd3e`), CI auf den
  letzten vier Läufen grün, letzter Deploy `fc35c017`, kein Eintrag auf
  `LÄUFT`. Zwei Doku-Stellen waren aber von der Wirklichkeit überholt.
- **Befund 1, gemessen:** `curl -s
  https://shop.brandycards.de/api/products/highlights` meldet
  `"startAtAvailable": true`. Die Sync-Läufe seit `a1cdd14f` haben
  `ebay_listings.start_at` gefüllt; die fünf neuesten Karten tragen echte
  Einstelldaten (06.08. 17:13, 17:09, 17:00, dann 04.08. 18:23), absteigend
  sortiert. Der Notbehelf „Importreihenfolge statt fünf willkürlicher Karten"
  greift nicht mehr. Damit ist die Nachprüfung erledigt, die der Eintrag zu
  `a1cdd14f` der jeweils nächsten Sitzung aufgetragen hatte.
- **Befund 2, vom Betreiber:** Die Dauerfreigabe gilt jetzt auch für Commits
  und Pushes — „immer committen, pushen und deployen, ohne mich zu fragen".
  Der Eintrag unter „Offene Punkte" nannte nur Deploys. Die Ausnahmen bleiben
  unverändert: Produktionsdaten, Migrationen, eBay-Bestand, alles mit Kosten.
- **Betroffen:** `docs/ai-handover.md`. **Kein Code, keine Datenbank, keine
  Migration, kein eBay-Aufruf.**
- **Ergebnis: ABGESCHLOSSEN.** Beide Stellen nachgezogen, committet und nach
  `agent/initial-brandycards` und `main` gepusht.
- **Bewusst nicht deployed, trotz der Dauerfreigabe:** Die Änderung betrifft
  ausschließlich Dokumentation. Am ausgelieferten Worker ändert sich kein Byte,
  ein `wrangler deploy` hätte nichts zu tun und würde nur eine Version ohne
  Inhalt in die Liste schreiben — die man später beim Zurückrollen sucht und
  nicht versteht. **Produktion bleibt auf `fc35c017`.**

### 2026-08-07 — Burger-Menü für schmale Geräte (fc35c017)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Burger-Menü für schmale Geräte. Schließt den offenen Punkt
  „Auf schmalen Geräten gibt es keine Hauptnavigation".
- **Ausgangslage:** `.main-nav` steht im 850-px-Block auf `display:none`.
  Karten, Anfragen, Verkaufen und Über uns sind dort nur über den Seitenfuß
  erreichbar. `SiteHeader` ist bereits eine Client-Komponente (`"use client"`),
  Zustand ist also ohne Umbau möglich.
- **Geplante Umsetzung:**
  - Schaltfläche in der Kopfzeile, nur unter 850 px sichtbar, mit
    `aria-expanded`, `aria-controls` und wechselnder Beschriftung
    („Menü öffnen" / „Menü schließen").
  - Die Liste klappt **absolut positioniert** unter der Leiste auf, nicht im
    Fluss. Grund: Die Leiste muss ihre 92 px behalten, sonst stimmt
    `--header-h` im geöffneten Zustand nicht mehr.
  - Schließt bei Klick auf einen Eintrag, bei `Escape` und bei Klick daneben.
  - Ab 851 px sind Schaltfläche und Liste per CSS ausgeblendet — damit ist ein
    offen gelassenes Menü beim Vergrößern des Fensters folgenlos, ohne dass
    dafür Zustand aufgeräumt werden muss.
  - **Kein zweiter Kontolink im Menü.** Er steht seit `161c74e4` in der Leiste;
    zwei Wege zum selben Ziel sind eine Fehlerquelle, keine Hilfe.
- **Betroffen:** `app/site-chrome.tsx`, `app/globals.css`. Kein Datenmodell,
  keine API, kein eBay.
- **Verifikation:** Bei 375 px im Browser: Menü öffnet und schließt über die
  Schaltfläche, `Escape` schließt, ein Klick auf einen Eintrag navigiert und
  schließt; `aria-expanded` folgt dem Zustand; die Leistenhöhe bleibt im
  geöffneten Zustand bei 92 px; kein waagerechter Überlauf. Bei 1280 px darf
  nichts davon sichtbar sein. Dann Prüfkette und Deploy.
- **Ergebnis: ABGESCHLOSSEN**, deployed als Version `fc35c017`.
  `tsc` sauber, Lint 0 Fehler, `npm test` 130/130.
  **Live auf `shop.brandycards.de` bei 375 px durchgespielt:** Schaltfläche
  sichtbar, `aria-expanded` folgt dem Zustand, Beschriftung wechselt auf
  „Menü schließen", alle vier Einträge mit korrekten Zielen, `aria-current`
  markiert die aktive Seite, `Escape` schließt, Klick daneben schließt, Klick
  **innerhalb** der Leiste schließt nicht, Klick auf einen Eintrag navigiert und
  schließt. Leiste bleibt im geöffneten Zustand bei 91 px, kein waagerechter
  Überlauf. Bei 1280 px sind Schaltfläche und Liste `display:none` — auch nach
  einem erzwungenen Klick auf die unsichtbare Schaltfläche.
- **Drei Dinge, die die Messung erst sichtbar gemacht hat:**
  1. **Der Burger drückte das Logo zusammen** — die Leiste fiel auf 83 px statt
     92 px. Ursache war nicht die Schaltfläche, sondern der Standardabstand von
     **48 px** zwischen Logo und Aktionen: Von 331 px verfügbarer Breite nahm er
     allein 48. Unter 500 px steht er jetzt auf 14 px, damit bleibt das Logo bei
     112 px und die Leiste bei ihren 92 px (gemessen 91, Subpixel-Rundung).
  2. **Das Menü begann 1 px zu hoch.** `top:100%` bezieht sich auf die
     Padding-Box der Leiste, deren Rahmenlinie liegt darunter — die Liste lag
     damit auf der Linie. Jetzt `top:calc(100% + 1px)`, und der eigene Rahmen
     der Liste entfällt, weil die Linie der Leiste bereits trennt.
  3. Die Schaltfläche wurde selbst zusammengedrückt (31 statt 38 px), daher
     `flex-shrink:0`.
- **Nochmals dieselbe Falle wie beim Deploy davor, diesmal andersherum:** Die
  Prüfung direkt nach `wrangler deploy` zeigte noch das **alte** Stylesheet —
  nicht weil der Deploy fehlschlug, sondern weil die Verteilung an den Rand
  einen Moment braucht. Nach etwa 20 Sekunden lieferte die Produktion die neue
  Datei. **Nach einem Deploy kurz warten, bevor man die Bundle-Referenz
  prüft**, sonst diagnostiziert man ein Problem, das keines ist.

### 2026-08-07 — Kontolink im mobilen Kopf (161c74e4)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Auf schmalen Geräten fehlt in der Kopfleiste der Zugang zum Konto.
  Er soll dort erscheinen.
- **Befund:** Im 850-px-Block stehen **`.main-nav` *und* `.account-link` auf
  `display:none`**. Auf dem Handy bleibt damit nur Logo und Warenkorb — nicht
  nur „Konto" fehlt, sondern **die gesamte Navigation**. Karten, Anfragen,
  Verkaufen und Über uns sind ausschließlich über den Seitenfuß erreichbar,
  also nach dem Scrollen über die ganze Seite.
- **Umfang dieses Durchlaufs:** Nur der Kontolink, wie beauftragt. Die fehlende
  Hauptnavigation ist der größere Punkt, aber ein eigener — sie braucht ein
  Menü und damit eine Gestaltungsentscheidung, keine Zeile CSS. Wird als
  offener Punkt hinterlegt statt nebenbei erfunden.
- **Geplante Schritte:** `.account-link` im 850-px-Block wieder einblenden und
  unter 500 px so verkleinern, dass Logo, Konto und Warenkorb nebeneinander
  passen, ohne die Leiste zu verbreitern oder umzubrechen.
- **Betroffen:** `app/globals.css`. Kein Datenmodell, keine API, kein eBay.
- **Verifikation:** Bei 375 px und 768 px im Browser messen: Kontolink
  sichtbar, kein waagerechter Überlauf, Leistenhöhe unverändert 92 px bzw.
  126 px (sonst stimmt `--header-h` nicht mehr). Dann Prüfkette und Deploy.
- **Ergebnis: ABGESCHLOSSEN**, deployed als Version `161c74e4`.
  `tsc` sauber, Lint 0 Fehler, `npm test` 130/130.
  Live auf `shop.brandycards.de` bei 375 px nachgemessen: „Konto ↗" sichtbar,
  Ziel `/account`, auf einer Höhe mit dem Warenkorb, Leiste unverändert 92 px,
  kein waagerechter Überlauf. Bei 768 px ebenso, Leiste 126 px.
- **Nebenbefund bei 320 px:** Dort passt die Leiste die Sache selbst an — das
  Logo schrumpft als Flex-Element **proportional** mit (94×63 statt 112×75,
  Seitenverhältnis unverändert), die Leiste wird 80 px statt 92 px. Gewollt:
  lieber ein etwas kleineres Logo als eine umbrechende Kopfzeile. `--header-h`
  ist damit unterhalb von ~340 px eine **Obergrenze**; folgenlos, weil unter
  850 px nur `scroll-padding-top` den Wert nutzt und ein zu großer Wert dort
  bloß etwas mehr Luft über dem Sprungziel lässt. Steht als Kommentar im CSS.
- **Dabei mitkorrigiert:** Der Kommentar an `--header-h` nannte noch die alten
  Höhen 164/150/116 px — beim Verschlanken der Leiste hatte ich die Werte in
  den Deklarationen geändert, den Kommentar daneben aber nicht. Jetzt 126/92.
- **Zwei Fallen, in die ich gelaufen bin und die Zeit gekostet haben:**
  1. Der Browser zeigte nach dem Deploy hartnäckig die **alte** Kopfzeile. Nicht
     der Deploy war schuld, sondern eine gecachte Seite, die noch auf das alte
     Stylesheet zeigte. Wer prüfen will, ob ein Deploy wirklich durch ist,
     fragt mit `curl` nach dem referenzierten Dateinamen — das umgeht jeden
     Browser-Cache:
     `curl -s https://shop.brandycards.de/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.css'`
  2. Die Meldung `Total Upload: 2428.22 KiB` ist bei zwei Deploys **identisch**,
     obwohl sich CSS geändert hat. Sie taugt **nicht** als Beleg dafür, dass
     etwas Neues hochgeladen wurde.

### 2026-08-07 — main auf den Arbeitsstand vorgespult (53 Commits)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** `main` auf den Arbeitsstand bringen. Der Branch hängt **53 Commits**
  zurück (`a36e626`, der Merge von heute Mittag), während
  `agent/initial-brandycards` auf `c4abc9c` steht.
- **Ausgangslage:** `main` ist ein **direkter Vorfahr** — keine Divergenz, kein
  Konflikt, ein reiner Fast-Forward. `main` ist **nicht** branch-protected, aber
  **Default-Branch**: Wer das Repository klont, bekommt derzeit den Stand von
  heute Mittag. Die Spitze `c4abc9c` ist **grün durch die CI**
  (Lauf zu `c4abc9c`, 130/130).
  Produktion ist nicht betroffen — deployt wird aus
  `agent/initial-brandycards`.
- **Warum jetzt und nicht wie beim letzten Mal:** Derselbe Schritt stand am
  2026-08-06 schon einmal an und scheiterte damals an der Berechtigungsprüfung
  der Umgebung, nicht am Inhalt. Zusätzlich lief die CI damals gar nicht
  (GitHub-Actions-Ausfall); diesmal ist die Spitze geprüft.
- **Geplante Schritte:** `git push origin origin/agent/initial-brandycards:main`
  (Fast-Forward, kein Merge-Commit, keine Historie umgeschrieben).
- **Betroffen:** Branch `main` auf GitHub. **Kein Code, kein Deployment, keine
  Datenbank.** Der Branch `agent/initial-brandycards` bleibt bestehen — das
  Hauptverzeichnis steht darauf ausgecheckt.
- **Verifikation:** `main` und `agent/initial-brandycards` zeigen anschließend
  auf **denselben Baum** (`git rev-parse <branch>^{tree}` vergleichen).
- **Rückweg:** `git push --force origin a36e626:main` stellt den alten Stand
  wieder her. Möglich, weil nichts umgeschrieben, nur vorgespult wird.
- **Ergebnis: ABGESCHLOSSEN.** `a36e626..c4abc9c` als Fast-Forward auf `main`
  gepusht. Nachgeprüft: Abstand zwischen `origin/main` und
  `origin/agent/initial-brandycards` ist **0/0**, beide zeigen auf denselben
  Baum `c4dafc9`, und die GitHub-API meldet für `main` ebenfalls `c4abc9c`.
  Damit ist der Punkt geschlossen, der seit dem 2026-08-06 offen war.
  `agent/initial-brandycards` wurde **nicht** gelöscht — das Hauptverzeichnis
  steht darauf ausgecheckt, und von dort wird deployed.

### 2026-08-07 — CI wieder grün, Kopfleiste verschlankt (21bd0667)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Zwei Dinge: **CI wieder grün bekommen** und die klebende Kopfleiste
  verschlanken.
- **Befund 1 — CI ist seit dem 2026-08-07, 15:16 Uhr rot, und es ist mir
  entgangen.** Ich habe `783402f9` auf grüner *lokaler* Prüfkette deployed,
  ohne den CI-Zustand anzusehen. Der Fehler stammt **nicht** aus meinen
  Änderungen (letzter grüner Lauf 15:11, erster roter 15:16 — beides vor dieser
  Sitzung), aber beim Push hätte ich ihn sehen müssen.
  - Symptom: `npm test` meldet in CI 130 Tests, **0 fehlgeschlagen, 11
    abgebrochen** → Exit 1. Alle elf stammen aus
    `tests/ebay-sync-timeout.test.mjs` und tragen `cancelledByParent` mit
    `Promise resolution is still pending but the event loop has already resolved`.
  - Ursache: **`AbortSignal.timeout()` hält den Event-Loop nicht wach** (der
    Timer ist unref'd). Im Test ist die stumme `fetch`-Zusage das einzige
    offene Handle; Node stellt fest, dass nichts mehr Fortschritt machen kann,
    und räumt ab, bevor die Zeitgrenze greift. **Lokal läuft Node 24, in CI
    Node 22** — daher 130/130 auf diesem Rechner und rot auf GitHub.
  - **Das ist ein Fehler im Test, nicht in der Produktion.** Im Worker hält die
    laufende Anfrage den Kontext offen; die Zeitgrenze selbst ist richtig.
    Korrigiert wird deshalb der Stub: Er hält den Loop für die Dauer des
    Versuchs mit einem ref'd Timer wach — das bildet die Situation ab, die im
    Worker ohnehin herrscht.
- **Befund 2 — Kopfleiste zu wuchtig.** Sie ist 164 px hoch und nimmt geklebt
  fast ein Viertel eines 720-px-Fensters ein. Sie soll „minimal größer als das
  Logo" werden: Logo bleibt, Innenabstand schrumpft. `--header-h` muss danach
  **neu gemessen** werden — davon hängen der Sticky-Versatz von
  `.detail-media` und `scroll-padding-top` ab.
- **Geplante Schritte:** Test korrigieren und den Rot-Nachweis **unter Node 22**
  führen, statt zu behaupten, es helfe; Innenabstand der Kopfzeile reduzieren;
  Höhen an allen drei Breakpoints neu messen; Prüfkette; deployen; **den
  CI-Lauf abwarten und grün sehen**, nicht annehmen.
- **Betroffen:** `tests/ebay-sync-timeout.test.mjs`, `app/globals.css`.
  Keine Produktionsdaten, keine Migration, kein eBay.
- **Ergebnis: ABGESCHLOSSEN.** Commit `013b9a7`, deployed als Version
  `21bd0667`.
  - **CI ist wieder grün.** Lauf `31204192313` auf `013b9a7`: **130 Tests, 130
    bestanden, 0 fehlgeschlagen, 0 abgebrochen.** Die beiden Läufe davor
    (`22e8cb7`, `0a9c48d`) waren rot mit je 11 abgebrochenen Tests. Damit ist
    die Korrektur dort belegt, wo sie belegt werden musste — unter Node 22.
  - Kopfleiste live nachgemessen: **126 px** bei 109 px Logo, also 17 px Rand
    insgesamt; `--header-h` stimmt mit dem gemessenen Wert überein, und die
    Leiste klebt beim Scrollen unverändert bei `top:0`.
  - `/account` und `/admin` antworten mit 200 und ohne „Supabase ist noch nicht
    konfiguriert", `/` und `/karten` 200.
- **Beleg für Befund 1, gemessen statt vermutet:** Ein Skript, dessen einziges
  offenes Handle ein `AbortSignal.timeout(600)` mit `abort`-Listener ist,
  endete **nach 1 ms** — der Abbruch feuerte nie. Das gilt sogar unter Node 24;
  dass die Tests hier durchliefen, war ein Rennen, das Node 24 gewinnt und
  Node 22 verliert. **Ein echtes Node 22 stand nicht zur Verfügung** (kein
  nvm/fnm; `npx node@22` liefert das lokale Node 24). Der Nachweis, dass die
  Korrektur greift, ist deshalb **der grüne CI-Lauf**, nicht ein lokaler Lauf.
- **Zur Kopfleiste, nachgemessen:** Das Logo rendert bei 164 px Breite genau
  **109 px** hoch (Original 1264×842). Mit 8 px Innenabstand kommt die Leiste
  auf **126 px** statt 164 px. Browserwerte an beiden Breakpoints deckungsgleich
  mit `--header-h`: 126/109 auf 1280 px, 92/75 auf 375 px, kein waagerechter
  Überlauf, Kleben unverändert.
- **Fallstrick, der Zeit gekostet hat und der nächsten Sitzung erspart bleiben
  soll:** Der Vorschau-Server startet im **Worktree**, während diese Änderungen
  im **Hauptverzeichnis** lagen. Er lieferte deshalb minutenlang das alte CSS,
  und die Messung zeigte hartnäckig die alten 164 px. Wer im Hauptverzeichnis
  arbeitet, startet `npm run dev` auch dort — sonst misst er einen anderen
  Stand, als er gerade schreibt.

### 2026-08-07 — Warenkorbgrenze und Oberflächenkorrekturen deployed (783402f9)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Die sieben Oberflächen- und Warenkorbkorrekturen aus dem Eintrag
  darunter nach `agent/initial-brandycards` bringen und deployen.
- **Neue Dauerfreigabe des Betreibers:** „Immer deployen, nicht fragen."
  Deploys nach grüner Prüfkette brauchen ab sofort **keine** Rückfrage mehr.
  Unverändert abzusprechen bleiben: Produktionsdaten, Migrationen,
  eBay-Bestand, alles mit Kosten.
- **Ausgangslage, zwei Stolpersteine:**
  1. Die Arbeit liegt in einem Worktree auf `claude/brandycards-onboarding-b56bd0`.
     **Dort darf nicht deployed werden** — `.env.local` wird in Worktrees nicht
     vererbt, genau so ging schon ein Deploy schief.
  2. **Das Hauptverzeichnis steht auf `0504567` und ist damit 48 Commits
     zurück.** Es muss vor dem Deploy nachgezogen werden, und weil sich
     `package-lock.json` dazwischen stark geändert hat, auch `npm ci`.
- **Geplante Schritte:**
  1. Im Worktree committen und nach `origin/agent/initial-brandycards` pushen
  2. Hauptverzeichnis: `git pull`, `npm ci`
  3. Prüfkette dort: `npx tsc --noEmit`, `npm run lint`, `npm test`
  4. **Bundle-Probe:** `grep -rl "supabase.co" dist/client/assets` — findet sie
     nichts, fehlte `.env.local` beim Build und der Deploy wird abgebrochen
  5. `npx wrangler deploy`
  6. Nachprüfen: `/account` und `/admin` laden (nicht „Supabase ist noch nicht
     konfiguriert"), Sicherheits-Kopfzeilen, `cache-control` am Katalog
- **Betroffen:** Branch `agent/initial-brandycards`, Produktions-Deployment.
  **Keine** Datenbank, **keine** Migration, **kein** eBay-Aufruf.
- **Risiko:** Der Deploy schaltet Oberflächenänderungen live, darunter eine
  Verhaltensänderung am Kaufknopf. Rückweg ist ein Rollback auf die vorige
  Worker-Version im Cloudflare-Dashboard.
- **Ergebnis: ABGESCHLOSSEN.** Commit `0a9c48d`, als Fast-Forward nach
  `agent/initial-brandycards` gepusht (`9d0ea64..0a9c48d`).
  **Deployed als Version `783402f9`.**
  - Hauptverzeichnis stand auf `0504567`, also 48 Commits zurück — nachgezogen
    und `npm ci`. Prüfkette dort: `tsc` sauber, Lint 0 Fehler (die bekannte
    `img`-Warnung), `npm test` **130/130**.
  - **Bundle-Probe bestanden:** `supabase.co` liegt in
    `dist/client/assets/supabase-browser-RbW28-cr.js`. Zusätzlich gegengeprüft,
    dass **keines** der Server-Geheimnisse im Client-Bundle steht
    (`EBAY_CLIENT_SECRET`, `EBAY_REFRESH_TOKEN`, `ADMIN_EMAILS`).
  - **Nach dem Deploy in Produktion geprüft**, mit der Seite zuerst, die
    Client-Konfiguration braucht: `/account` und `/admin` antworten mit 200 und
    **ohne** „Supabase ist noch nicht konfiguriert"; `/` und `/karten` 200.
    Alle sechs Sicherheits-Kopfzeilen stehen, `cache-control` am Katalog ist
    `public, max-age=60, stale-while-revalidate=300`.
  - **Die Korrekturen selbst live nachgemessen**, nicht nur im Markup gesucht:
    Auf `/karten` (294 Kaufknöpfe) macht ein Klick die Menge 1 und sperrt den
    Knopf auf „Bereits im Warenkorb"; drei weitere Klicks ändern nichts. Die
    Kopfleiste rastet ab Scrollposition 600 bei `top:0` ein, gemessene Höhe
    **164 px** — genau der Wert in `--header-h`. Hero-Text und `EST. 2026`
    stehen, der alte „FOOTBALL CARDS"-Text ist weg.
- **Offen geblieben, bewusst:** `npm ci` blockiert die Installationsskripte,
  dadurch bleibt `workerd` unvollständig und `npm run dev` startet nicht.
  Behelf lokal ausgeführt
  (`npm install-scripts approve workerd esbuild sharp unrs-resolver && npm rebuild`),
  das dabei entstehende Feld `allowScripts` in der `package.json` aber
  **nicht eingecheckt**: Es erlaubt Installationsskripten dauerhaft die
  Ausführung und ist damit eine Entscheidung über die Lieferkette. **Wer als
  Nächstes frisch installiert, läuft erneut hinein.**

### 2026-08-07 — Sichtprüfung: sechs Oberflächenpunkte und ein Warenkorbfehler

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Sieben Punkte aus einer Sichtprüfung des Betreibers — sechs
  Oberfläche, einer davon ein **echter Fehler im Warenkorb**.
- **Die Punkte:**
  1. **Werteleiste („AUTHENTIC CARDS ✦ …") bricht mobil.** `.ticker` ist ein
     `flex` ohne Umbruch mit `overflow:hidden` — auf schmalen Geräten wird
     abgeschnitten statt umgebrochen.
  2. **`EST. 2024` → `EST. 2026`** im Hero-Stempel.
  3. **Kopfleiste soll beim Scrollen oben bleiben** (`position:sticky`).
     Achtung: `.detail-media` klebt bereits bei `top:24px` und muss um die
     Kopfhöhe versetzt werden, sonst schiebt es sich darunter.
  4. **Hero-Text:** „THE HOME OF FOOTBALL CARDS" → „THE HOME OF SPORTS CARDS",
     Fließtext neu.
  5. **Galerie springt.** `.gallery-stage` und der Titel wachsen mit dem
     Text — bei einer Rotation alle 2 Sekunden hüpft das Layout sichtbar.
     Feste Höhe für Titel und Bühne.
  6. **Warenkorb-Fehler (kein Kosmetikpunkt):** `addToCart` in
     `app/site-chrome.tsx:51` erhöht die Menge ungeprüft. Eine Karte, die es
     genau **einmal** gibt, lässt sich beliebig oft hinzufügen. Der Server
     lehnt das später ab (`app/api/orders/route.ts:75`), der Kunde erfährt es
     also erst nach dem Ausfüllen der Adresse. Die Grenze fehlt im Browser.
  7. **„BC" auf der Hero-Karte unlesbar.** `.hero-player` ist `#282019` auf
     einem Verlauf, der ab 46 % auf `#262321` umschlägt — dunkel auf dunkel.
- **Geplante Schritte:** Punkte 1–5 und 7 in `app/globals.css` und
  `app/page.tsx`. Punkt 6 in `app/site-chrome.tsx` (Grenze in `addToCart`),
  dazu die drei Kaufknöpfe (`gallery.tsx`, `karten/page.tsx`,
  `karten/[id]/page.tsx`) und `app/checkout/page.tsx`, das eine veraltete
  Menge aus `sessionStorage` sonst weiterreicht.
- **Betroffen:** `app/globals.css`, `app/page.tsx`, `app/site-chrome.tsx`,
  `app/gallery.tsx`, `app/karten/page.tsx`, `app/karten/[id]/page.tsx`,
  `app/checkout/page.tsx`. Keine Datenbank, kein Schema, kein eBay.
- **Verifikation:** `npx tsc --noEmit`, `npm run lint`, `npm test`; dazu die
  Oberfläche lokal im Browser gegenprüfen (Kopfleiste beim Scrollen, Galerie
  ohne Sprung, Warenkorbknopf nach dem zweiten Klick). **Kein Deploy** in
  diesem Durchlauf ohne Ansage.
- **Ergebnis: ABGESCHLOSSEN, nicht deployed.** `npx tsc --noEmit` sauber,
  `npm run lint` 0 Fehler (die eine bekannte `img`-Warnung in `app/admin`),
  `npm test` **130/130**. Alle sieben Punkte im laufenden Browser nachgemessen,
  nicht nur im Code geändert:
  - **Warenkorb:** ein Klick → `{"p1":1}`, Knopf danach deaktiviert
    („Bereits im Warenkorb"); drei weitere Klicks ändern nichts. Ein von Hand
    auf `{"p1":7,"p3":4}` gesetzter `sessionStorage` wird im Checkout auf je 1
    zurückgeschnitten (Summe 28,45 € statt 115 €).
  - **Galerie:** über sieben Kartenwechsel Bühne konstant 488 px, Titel 58 px,
    Beschreibung 62 px, und der Kaufknopf bleibt auf derselben Bildschirm-
    position — auch bei einer Karte ganz ohne Beschreibung und bei einem
    Titel, der über zwei Zeilen hinausgeht.
  - **Kopfleiste:** ab Scrollposition 400 fest bei `top:0`, der Versandhinweis
    darüber scrollt weg. Treffertest in der Leistenmitte liefert immer die
    Leiste — es scheint nichts durch.
  - **Werteleiste:** bei 375 px und 768 px kein waagerechter Überlauf mehr
    (vorher abgeschnitten), Umbruch auf zwei Zeilen.
- **Zwei Messbefunde, die eine Annahme widerlegt haben:**
  1. **Die Kopfleiste ist 164 px hoch, nicht die 110 px, die ich geschätzt
     hatte** — an den drei Breakpoints 164 / 150 / 116 px. Davon hängen der
     Sticky-Versatz von `.detail-media` und `scroll-padding-top` ab; mit dem
     Schätzwert wäre das Kartenbild beim Scrollen unter die Leiste gerutscht.
     Die Werte stehen jetzt als `--header-h` je Breakpoint im CSS, mit dem
     Hinweis, bei Änderungen an Logo oder Innenabstand neu zu messen.
  2. Die umgebrochene Werteleiste begann auf schmalen Geräten mit einem
     **einzelnen ✦** in der zweiten Zeile. Unter 500 px entfallen die Rauten
     deshalb ganz.
- **Nebenbefund, nicht behoben, betrifft jede frische Installation:**
  `npm ci` bricht die Installationsskripte ab (npm verlangt seit Neuestem eine
  Freigabe), dadurch bleibt `workerd` unvollständig und **`npm run dev` stürzt
  beim Start ab**. Sichtbar wird das als „The Workers runtime crashed
  unexpectedly". Abhilfe:
  `npm install-scripts approve workerd esbuild sharp unrs-resolver && npm rebuild`.
  Das schreibt ein Feld `allowScripts` in die `package.json`. **Bewusst nicht
  eingecheckt** — es erlaubt Installationsskripten dauerhaft die Ausführung und
  ist damit eine Entscheidung über die Lieferkette, die der Betreiber treffen
  sollte, nicht ein Nebeneffekt eines Oberflächenauftrags.
- **Ebenfalls zu wissen:** Der Worktree hatte kein eigenes `node_modules` und
  zog das des Hauptverzeichnisses, dessen `workerd` zu alt für das
  `compatibility_date` dieses Branches war. Erst `npm ci` im Worktree machte
  die lokale Vorschau überhaupt möglich.
- **Lokale Datenbank:** Für die Sichtprüfung wurden die Migrationen auf die
  **lokale** D1 angewandt und fünf Testkarten eingefügt (`--local`).
  **Produktionsdaten wurden nicht angefasst.**

### 2026-08-07 — Sechs Fehler in der Doku, gefunden beim Kaltlesen

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Die Dokumentation gegen sich selbst und gegen den Code prüfen. Anlass
  war eine reine Einarbeitungssitzung — der erste Leser, der die Unterlagen ohne
  Vorwissen las.
- **Vorbemerkung, die eigentliche Lehre des Durchlaufs:** Der Worktree, aus dem
  gelesen wurde, hing **48 Commits zurück**. `docs/ai-todo.md`,
  `docs/security-findings.md`, `docs/security-audit-brief.md` und rund 30
  Code-Dateien existierten dort schlicht nicht, und die eingelesene `CLAUDE.md`
  war die alte Fassung. Wer in einem Worktree arbeitet, prüft **vor** dem ersten
  Urteil `git rev-list --left-right --count HEAD...origin/agent/initial-brandycards`
  — sonst beurteilt er einen Stand, den es nicht mehr gibt.
- **Gefunden und korrigiert:**
  1. **Falscher Import-Takt.** „Offene Punkte" behauptete „Der Import läuft alle
     10 Minuten und ist belegt". Real: `0 */2 * * *` in `wrangler.toml`, und
     `ai-todo.md` dokumentiert die Rücknahme am selben Tag. Die Fassung hier war
     die falsche — und beschönigte ausgerechnet das Doppelverkaufsfenster.
     Korrigiert samt der Folgen (Fenster bis zu zwei Stunden, Reservierungen
     kommen nach 15–135 Minuten zurück).
  2. **Zwei gegensätzliche Empfehlungen zum eBay-Schreibpfad.** Hier und im
     Agentenprotokoll stand `EndItem`/`EndFixedPriceItem`, in `ai-todo.md`
     Punkt 6 ausdrücklich das Gegenteil (`ReviseInventoryStatus` mit Menge 0).
     `ai-todo.md` ist jetzt an beiden Stellen als maßgeblich gekennzeichnet.
  3. **Befundzahl.** Überall „17 Befunde / 16 von 17 geschlossen", tatsächlich
     **18** (SEC-01…SEC-18), geschlossen **17 von 18**. Ursache: SEC-18 kam nach
     Phase 1 dazu und wurde in den Summen nie nachgezogen. Die Statusübersicht in
     `security-findings.md` ist jetzt ausdrücklich die maßgebliche Quelle.
  4. **Veraltete Reservierungsfrist** im Agentenprotokoll („15–25 Minuten") —
     galt nur für den 10-Minuten-Takt, real 15–135 Minuten.
  5. **Free-Tarif als Begründung**, obwohl seit dem 2026-08-07 Workers Paid
     läuft. Stand noch in der SEC-05-Begründung in `ai-todo.md`.
  6. **Veraltete Deploy-Liste.** „Produktion ist aktuell. Fünf Deploys …"
     endete bei `0b25ae0f` — dabei kamen `2557ca3d`, `a1cdd14f` und `07da6e9b`
     erst danach. Der Eintrag nannte also ausgerechnet den zurückgenommenen
     Stand als den letzten.
- **Ergänzt, weil es in Punkt 6 fehlte:** „`ReviseInventoryStatus` ist
  umkehrbar" gilt nur, wenn im eBay-Konto die **Out-of-Stock-Option** aktiv ist.
  Ohne sie beendet eBay ein Festpreisangebot mit Menge 0 selbst — bei lauter
  Einzelstücken also immer, und dann ist der Weg genauso endgültig wie `EndItem`.
  Vor dem Bau über `GetUserPreferences` (`OutOfStockControlPreference`) prüfen.
- **Betroffen:** `docs/ai-handover.md`, `docs/ai-todo.md`,
  `docs/security-findings.md`, `docs/ai-agent-log.md`. **Kein Code, keine
  Datenbank, kein Deployment, kein eBay-Aufruf.**
- **Ergebnis:** Alle fünf Stellen korrigiert. Historische Einträge blieben
  stehen und haben nur dort eine Korrekturmarke bekommen, wo sie einen
  Kaltleser sonst in die Irre führen — ein Protokoll, das rückwirkend
  geglättet wird, verliert seinen Zweck.
- **Nicht geprüft, bewusst:** Ob die Zahlen aus den „Offenen Punkten" (296
  aktive Karten, `start_at`, letzter Sync-Lauf) noch stimmen. Lesende
  D1-Abfragen wären erlaubt gewesen, die Sitzung war aber als reine Lesearbeit
  am Code angelegt. **Wer als Nächstes hier ist, sollte das nachholen.**

### 2026-08-07 — Zeitgrenzen für eBay, und eine Sperre, die sich nicht verklemmt

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Punkt 1 aus [ai-todo.md](ai-todo.md). Der Import blieb an diesem Tag
  dreimal auf `RUNNING` hängen; einmal über eine Stunde, bis von Hand
  eingegriffen wurde.
- **Diagnose zuerst, wie beauftragt — die vermutete Ursache stimmt nur zur
  Hälfte:**
  - **Bestätigt:** `lib/ebay-client.ts` setzte an keinem der fünf `fetch`-Aufrufe
    eine Zeitgrenze. Und `localSyncLock` wurde nur im `finally` eines `await`
    zurückgesetzt — kommt das `await` nie zurück, bleibt die Sperre für die
    Lebensdauer des Isolates gesetzt.
  - **Widerlegt:** Glied 3 der Kette („weil zusätzlich die Datenbankzeile auf
    `RUNNING` steht, verweigern auch andere Isolates den Start"). Die
    Produktionsdaten sagen etwas anderes. Der 04:00-Lauf wurde erst um 09:00
    freigegeben, der 11:50-Lauf erst um 12:30 — beide durch „Veralteter
    Sync-Lauf automatisch geschlossen", also durch genau den Aufräumcode, der
    laut Vermutung nie erreicht wird. Er *wird* erreicht, nur sporadisch: immer
    dann, wenn ein frisches Isolate an die Reihe kommt. Die Cron-Schläge
    dazwischen (05:00–08:00, 12:00–12:20) hinterließen keine Zeile — die
    Signatur eines Abbruchs **vor** dem `INSERT`. Der dauerhafte Blocker war
    also allein die Sperre im Isolate, nicht die Datenbankzeile. Die Korrektur
    daraus: Der Aufräumcode gehört **vor** die Sperrprüfung, nicht dahinter.
  - **Neu gefunden, unabhängig davon:** Die Veraltet-Prüfung
    `activeRun.startedAt < staleBefore` verglich `2026-08-07 13:20:40` aus
    SQLites `CURRENT_TIMESTAMP` mit ISO-8601 als Zeichenketten. An Stelle 10
    steht links ein Leerzeichen (0x20), rechts ein `T` (0x54) — der Vergleich
    war **unabhängig vom Alter immer wahr**. Jeder laufende Import galt als
    verwaist, auch ein drei Sekunden alter. Die 30-Minuten-Frist gab es nur auf
    dem Papier. Genau die Falle, vor der `lib/retention.ts` seit SEC-15 warnt.
  - **Nicht belegbar und deshalb nicht behauptet:** *welcher* `await` am
    2026-08-07 hängen blieb. Ein stehengebliebenes `db.batch` — 294 Stück je
    Lauf, ebenfalls unbegrenzt — oder ein von Cloudflare abgeräumter Aufruf
    erzeugt dieselbe Signatur. Zeitgrenzen an den `fetch`-Aufrufen sind daher
    **notwendig, aber nicht hinreichend**; der ganze Lauf braucht eine Frist.
- **Ergebnis:** Gebaut und deployed als Version `07da6e9b`.
  - `fetchWithTimeout` an allen fünf eBay-Aufrufen, 30 s, über
    `EBAY_FETCH_TIMEOUT_MS` übersteuerbar.
  - Neu `lib/sync-lock.ts` (netzfrei, ohne D1, damit prüfbar): `ExpiringLock`
    mit Verfallszeit statt Wahrheitswert, `isSyncRunStale` über
    `parseDbTimestamp`, `withDeadline` für den ganzen Lauf. Frist und
    Verfallszeit stehen bei 5 Minuten gegen einen Lauf von ~77 Sekunden.
  - `lib/ebay-sync.ts`: `releaseStaleSyncRuns()` läuft jetzt vor der
    Sperrprüfung.
  - `tests/ebay-sync-timeout.test.mjs`, 11 Tests, in `npm test` aufgenommen.
    Rot-Nachweis geführt: Ohne die Korrekturen laufen die drei `fetch`-Tests in
    ihr Zeitlimit („hängt", genau das Abnahmekriterium), und die Tests zur
    Zeitstempelfalle und zur verfallenden Sperre schlagen fehl.
  - Prüfkette grün: `npx tsc --noEmit` sauber, `npm run lint` 0 Fehler (die
    bekannte `img`-Warnung), `npm test` 130/130, Bundle-Probe bestanden,
    `/admin`, `/account` und `/` nach dem Deploy mit 200 und ohne
    „Supabase ist noch nicht konfiguriert".
  - **Cron unverändert** bei `0 */2 * * *`. Beschleunigung erst nach Punkt 2.
- **Noch nicht gesehen:** ein echter Lauf unter dem neuen Code. Deploy war um
  15:1x UTC, der nächste Cron-Schlag um 16:00 UTC. Beim nächsten Arbeitsschritt
  nachsehen: `SELECT started_at, status, updated_count FROM sync_runs ORDER BY
  started_at DESC LIMIT 3`.

### 2026-08-07 — Sync-Takt, D1-Budget und ein hängengebliebener Lauf

- **Stand:** ABGESCHLOSSEN

**Anlass:** Der Betreiber fragte, ob der Sync statt alle 10 auch alle 5 oder 3
Minuten laufen kann. Beim Nachrechnen kam heraus, dass schon der
10-Minuten-Takt ein Fehler war — **meiner, von heute Vormittag.**

**Gemessen mit `wrangler d1 insights`, letzte 24 h:**

| | |
|---|---|
| geschriebene Zeilen | **115 026** |
| Sync-Läufe darin | ~27 (also im Wesentlichen stündlich) |
| Kosten je Lauf | **~5 396 Zeilen** |

Hochgerechnet gegen das dokumentierte Free-Budget von **100 000 geschriebenen
Zeilen pro Tag**:

| Takt | Läufe/Tag | Zeilen/Tag | Anteil |
|---|---|---|---|
| stündlich | 24 | 102 000 | **102 %** |
| alle 10 Min *(heute deployed)* | 144 | 613 000 | **613 %** |
| alle 5 Min | 288 | 1 227 000 | 1227 % |
| alle 3 Min | 480 | 2 045 000 | 2045 % |

**Was ich heute früh falsch gemacht habe:** Ich habe das eBay-Kontingent
nachgerechnet (3 Aufrufe je Lauf, unkritisch) und die Laufzeit gemessen (77 s),
aber **das D1-Schreibbudget nicht angesehen** — obwohl der Free-Tarif am selben
Tag als Begründung für die Hochstufung von SEC-05 diente. Der Fehler war,
*eine* Ressourcengrenze zu prüfen und daraus „unkritisch" zu schließen.

**Warum ein Lauf so teuer ist:** D1 zählt **Indexschreibvorgänge mit**. Ein
`update products` kostet laut Messung 3 Zeilen, ein `update ebay_listings` 5.
Vor allem aber schreibt der Sync **jedes Mal alles neu**, auch wenn sich nichts
geändert hat — 294 Listings mal Produkt, Listing, Bestand, alle Bilder gelöscht
und neu eingefügt, plus ein `sync_event` je Listing. Die vier teuersten
Abfragen der letzten 24 h:

```
31 692  insert sync_events      (ein Ereignis je Listing je Lauf, meist "UPDATED" ohne Änderung)
26 085  update ebay_listings
25 491  update products
18 048  insert product_assets   (jedes Bild jedes Mal geloescht und neu eingefuegt)
```

**Schritt 1 (dieser Eintrag): Cron sofort zurück auf stündlich.** Nicht die
Lösung, aber es stoppt das Ausbluten. Das Risiko ist heute klein, weil die
Bestandsprüfung vor der Zahlung (heute gebaut) den entscheidenden Moment
ohnehin absichert und der Shop noch keine echten Kunden hat.

**Schritt 2 (danach, die eigentliche Arbeit): Der Sync darf nur schreiben, was
sich geändert hat.** Dann kostet ein Lauf im Normalfall nahe null Zeilen, und
**3 Minuten wären problemlos möglich.** Dasselbe Muster wie bei SEC-09.
Zusätzlich: `sync_events` nur noch bei echten Ereignissen schreiben, nicht bei
jedem unveränderten Listing — die Tabelle wächst sonst um ~42 000 Zeilen/Tag.

**Unsicherheit, ausdrücklich:** Die 100 000 sind der dokumentierte Free-Wert,
nicht der im Dashboard abgelesene. Der Betreiber sollte ihn unter *Workers &
Pages → D1 → brandycards-production → Metrics* bestätigen. Am Verhältnis
ändert das nichts: 10 Minuten sind das Sechsfache von stündlich.

**Ergebnis: ABGESCHLOSSEN — mit einer Korrektur an mir selbst.**

**Meine Diagnose war teilweise falsch.** Ich schloss aus „der Aufräumvorgang
schreibt nicht" auf „das D1-Schreibbudget ist erschöpft". Ein Testschreibvorgang
lief anschließend anstandslos durch (`changes: 1`) — das Budget war **nicht**
erschöpft. Der Import stand aus einem anderen Grund; die wahrscheinliche
Ursache (fehlende Zeitgrenzen im eBay-Client) ist jetzt Punkt 1 in
[ai-todo.md](ai-todo.md).

Was davon **richtig** bleibt und gemessen ist:
- Ein Sync-Lauf schreibt **~5 396 D1-Zeilen**. Bei 14 Läufen wurden 4 116
  Aktualisierungen geschrieben, davon waren **2** echte Änderungen —
  **99,95 % ohne Wirkung.**
- `raw_data` ist deterministisch (`{"source":"trading-api","marketplaceId":…,
  "itemId":…}`, kein Zeitstempel), `shipping_data` wird nie geschrieben. Die
  Stelle, an der ein Änderungsvergleich hätte scheitern können, ist damit
  ausgeräumt: Nur `last_synced_at` und `updated_at` müssen ausgeklammert werden.
- Der Cron steht auf `0 */2 * * *` (Version `2557ca3d`, 14:31 UTC).

**Der Betreiber ist danach auf Workers Paid gewechselt.** Damit ist der
Notbehelf keine Notwendigkeit mehr, sondern nur noch eine Kostenfrage —
Einzelheiten unter „Offene Punkte" und in Punkt 2 der Aufgabenliste.

Deployed als Version `2557ca3d`, `schedule: 0 */2 * * *` im Protokoll bestätigt.
**Zweistündlich, nicht stündlich** — beim Schreiben des Tests kam heraus, dass
auch stündlich mit 102 % schon über dem Budget lag. Zweistündlich sind 51 %
und lassen Platz für die Schreibvorgänge echter Bestellungen.

`tests/ebay-stock-check.test.mjs` enthält jetzt einen Test, der den Cron gegen
das Budget rechnet. Gegenprobe gemacht: Er lehnt `0 * * * *`, `*/10 * * * *`
und `*/3 * * * *` ab und lässt `0 */2 * * *` durch. Er ist bewusst kein Verbot
schneller Takte, sondern eine **Kopplung**: Wer beschleunigen will, muss zuerst
`ZEILEN_JE_LAUF` senken — und das geht nur, indem der Lauf wirklich billiger
wird.

`npm test` 119 Tests grün, `tsc` sauber, Lint 0 Fehler.

**Schritt 2 ist die eigentliche Arbeit und steht als Punkt 1 in
[ai-todo.md](ai-todo.md):** Der Sync darf nur schreiben, was sich geändert hat.
Er kostet heute ~5 396 Zeilen je Lauf, obwohl sich zwischen zwei Läufen fast
nie etwas ändert — 294 Listings werden samt Produkt, Bestand und **allen
Bildern** gelöscht und neu eingefügt, plus ein `sync_event` je Listing. Danach
kostet ein Lauf im Normalfall nahe null, und die ursprünglich gewünschten drei
Minuten sind problemlos.

**Der Betreiber wollte eigentlich mit den Kunden-E-Mails weitermachen.** Diese
Sache kam dazwischen, weil sie zeitkritisch war — der 10-Minuten-Takt hätte das
Tagesbudget noch heute Abend aufgebraucht, und dann scheitern auch die
Schreibvorgänge echter Bestellungen.


### 2026-08-07 — Deploy-Workflow, damit das Ausliefern nicht an einem Rechner hängt

- **Stand:** ABGESCHLOSSEN

**Ziel:** Einen Deploy-Workflow bauen, damit das Ausliefern nicht mehr am
Rechner des Betreibers hängt.

**Warum:** `npx wrangler deploy` baut **lokal** und lädt das Ergebnis hoch. Der
Grund ist `.env.local`: `NEXT_PUBLIC_SUPABASE_*` wird zur Buildzeit ins
Client-Bundle eingebacken, und die Datei liegt absichtlich nicht im
Repository. Wäre der Rechner weg, liefe der Shop weiter — aber niemand könnte
etwas ändern, bis die Datei rekonstruiert ist. Kein Sicherheitsproblem, ein
Klumpenrisiko.

**Entwurfsentscheidungen:**
- **Nur `workflow_dispatch`**, kein Auto-Deploy bei jedem Push. In diesem
  Repository landen laufend reine Dokumentcommits; jeder davon würde sonst
  ausliefern. Ein Knopf in der GitHub-Oberfläche erfüllt den Zweck und geht
  auch vom Telefon.
- **Kein `pull_request`-Auslöser.** Ein Fork darf niemals deployen können.
  `workflow_dispatch` kann ohnehin nur auslösen, wer Schreibrechte hat.
- **Die vollständige Prüfkette vor dem Deploy** — Lint, `tsc --noEmit`,
  `npm test` — und danach dieselbe Bundle-Probe, die CLAUDE.md verlangt:
  Findet `grep supabase.co dist/client/assets` nichts, bricht der Lauf ab,
  statt ein Bundle auszuliefern, in dem `/admin` und `/account` kaputt sind.
- **Nachprüfung nach dem Deploy im Workflow selbst**, wieder nach der Regel aus
  CLAUDE.md: eine Seite prüfen, die Client-Konfiguration braucht. Startseite
  und `/api/*` sähen auch dann gesund aus, wenn das Bundle kaputt ist.
- **Actions auf Commit-SHA gepinnt**, wie im CI-Workflow.
- `concurrency`, damit zwei Deploys sich nicht überholen.

**Was der Betreiber selbst tun muss:** drei Repository-Secrets anlegen. Ich
lege keine Zugangsdaten an und fasse keine an. Stand jetzt sind **keine**
Secrets im Repository hinterlegt (`gh secret list` ist leer).

**Verifikation:** Der Workflow lässt sich erst nach dem Anlegen der Secrets
ausführen. Bis dahin bleibt der bisherige Weg (`npx wrangler deploy` lokal)
gültig — der neue Weg ist eine Ergänzung, kein Ersatz.

**Ergebnis: ABGESCHLOSSEN, aber noch nicht lauffähig.**

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) ist gebaut:
10 Schritte, nur `workflow_dispatch`, `permissions: contents: read`,
`concurrency`, Actions auf Commit-SHA gepinnt. Beide Workflow-Dateien wurden
als YAML geparst, nicht nur per Textsuche geprüft. Reihenfolge belegt:
Bundle-Probe → Deploy → Nachprüfung.

**Der Workflow kann erst laufen, wenn der Betreiber drei Repository-Secrets
angelegt hat** (`gh secret list` war leer):
`CLOUDFLARE_API_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Anleitung in
[security-findings.md](security-findings.md) unter „Alternativ: Deploy über
GitHub". Ohne sie bricht der Lauf mit einer klaren Meldung ab, statt ein
halbes Bundle auszuliefern.

**Nicht geprüft, weil es ohne die Secrets nicht geht:** ein echter Durchlauf.
Die nächste Sitzung sollte nach dem ersten manuellen Start nachsehen, ob die
Nachprüfungsschritte greifen — besonders die Kopfzeilen-Zählung (`6 von 6`)
und die `cache-control`-Prüfung, die beide gegen die Live-Antwort laufen.

**Ein Hinweis, der leicht untergeht:** Der Workflow ersetzt den lokalen Deploy
**nicht**. Wer weiter mit `npx wrangler deploy` arbeitet, muss weiterhin
`.env.local` im Build-Verzeichnis haben. Der Workflow ist die Versicherung
gegen den Ausfall einer Maschine, nicht der neue Normalweg — solange die
Dauerfreigabe gilt, ist der lokale Weg schneller.


### 2026-08-07 — Doppelverkaufsschutz: 10-Minuten-Import und Bestandsprüfung

- **Stand:** ABGESCHLOSSEN

**Ziel:** Punkt 1 und Punkt 3 aus [ai-todo.md](ai-todo.md) — die beiden
billigen Maßnahmen gegen Doppelverkäufe, bevor der erste echte Verkauf läuft.
Die eine bisherige Bestellung war ein Test des Betreibers.

**Punkt 1 — Sync alle 10 Minuten.** `crons = ["0 * * * *"]` → `["*/10 * * * *"]`.
Verkürzt das Fenster „auf eBay verkauft, Shop weiß es nicht" von bis zu 60 auf
bis zu 10 Minuten. Kostenrechnung: ein Lauf macht **drei** eBay-Aufrufe (ein
Token, zwei Seiten à 200 Angebote bei 296 Karten). Stündlich 72/Tag, alle
10 Minuten 432/Tag — unkritisch gegen das Standardkontingent von 5 000.
Nebenwirkung: `releaseExpiredReservations` läuft dann ebenfalls alle 10 Minuten,
was SEC-03 zusätzlich entschärft (Sperrdauer 15–25 statt 15–75 Minuten).

**Punkt 3 — Bestand live prüfen, bevor Geld fließt.** `GetItem` je Karte der
Bestellung, Prüfung auf verfügbare Menge.

**Entwurfsentscheidungen, die ich treffe:**
- Geprüft wird an **zwei** Stellen: in `app/api/paypal/orders/route.ts` vor dem
  Anlegen (dann scheitert es, bevor der Kunde überhaupt zu PayPal geht) und in
  `app/api/paypal/capture/route.ts` unmittelbar vor dem Einzug (die letzte
  Stelle vor dem Geld). Der Todo-Punkt lässt beides zu; die erste ist die
  freundlichere, die zweite die wirksame.
- **Ein eBay-Ausfall darf nichts blockieren.** Unbekannte Menge gilt nie als
  ausverkauft. Fehler werden protokolliert und durchgelassen.
- Beim Capture wird **vor** dem `PENDING → PROCESSING`-Riegel geprüft, damit
  keine Bestellung in `PROCESSING` hängenbleibt. Bei Ablehnung wird die
  Reservierung freigegeben und verständlich zurückgemeldet. Die PayPal-Order
  bleibt uneingezogen und verfällt; ein aktives `void` baue ich **nicht** —
  das wäre ein weiterer Fremdaufruf mit eigenen Fehlerpfaden.
- Ein Tokenaufruf für alle Karten einer Bestellung, nicht je Karte.

**Verifikation:** Test nach dem Muster von `tests/ebay-active-list.test.mjs` —
`globalThis.fetch` stubben, die echte Funktion aufrufen, GetItem-Antworten als
Fixture. Dazu `npx tsc --noEmit`, `npm run lint`, `npm test`.

**Grenze:** Gegen das echte eBay-Konto wird **nichts** ausgeführt. Der Token in
der lokalen `.env.local` ist ohnehin abgelaufen; die Prüfung läuft vollständig
gegen Fixtures.

**Deploy:** Dauerfreigabe liegt vor, siehe „Offene Punkte".

**Ergebnis: ABGESCHLOSSEN. Deployed als Version `0b25ae0f` (10:45:18 UTC).**

**Punkt 1** — `crons = ["*/10 * * * *"]`. Das Deploy-Protokoll bestätigt
`schedule: */10 * * * *`.

**Punkt 3** — neu:
- `lib/ebay-stock-check.ts` — die Entscheidung, ohne Netz und ohne Datenbank
  prüfbar
- `lib/ebay-stock-guard.ts` — die Verdrahtung, gibt bei jedem eigenen Fehler
  frei statt zu blockieren
- `getEbayAvailability` und `parseItemAvailability` in `lib/ebay-client.ts` —
  ein Tokenaufruf je Bestellung, dann ein GetItem je Karte
- `orderCardsForStockCheck` in `lib/paypal/settle-order.ts`
- geprüft in `app/api/paypal/orders/route.ts` und
  `app/api/paypal/capture/route.ts`

**Verifikation:** `tsc` sauber, Lint 0 Fehler, `npm test` 98 → **119 Tests**,
alle grün. Die Leitregel wurde testweise aufgehoben (unbekannt = ausverkauft)
und die vier zugehörigen Tests nachweislich rot gesehen; ebenso der Cron-Test
beim Zurückdrehen auf stündlich.

**Gegen das echte eBay-Konto wurde nichts ausgeführt** — alle Tests laufen
gegen Fixtures mit gestubbtem `fetch`. Der Token in der lokalen `.env.local`
ist ohnehin abgelaufen.

**Nach dem Deploy geprüft:** `/`, `/karten` und `/account` gesund, keine
Supabase-Fehlermeldung, alle sechs Sicherheits-Kopfzeilen gesetzt.

**Der neue Takt ist in der Datenbank belegt:** erster Lauf am 2026-08-07 um
**10:50:40** UTC, beendet **10:51:57**, `SUCCEEDED`, 294 aktualisiert, 0
Fehler. Damit ist auch das Abnahmekriterium von Punkt 1 erfüllt.

**Eine Zahl aus dem alten Eintrag war falsch:** Ein Sync-Lauf dauert nicht
„rund 30 Sekunden", sondern **rund 77**. Für einen 10-Minuten-Takt bleibt das
unkritisch (77 s gegen 600 s Abstand), aber wer die Frequenz je weiter erhöhen
will, sollte mit der richtigen Zahl rechnen.

**Eine Falle beim Nachprüfen, für die nächste Sitzung:** Ich habe zuerst um
10:47 in `sync_runs` geschaut und keinen neuen Lauf gefunden — der Deploy war
aber erst um 10:45:18, der erste `*/10`-Lauf also frühestens um 10:50. **Erst
die Deploy-Zeit nachsehen (`npx wrangler deployments list`), dann urteilen.**


### 2026-08-07 — Konto- und Adminfläche in die Sprache des Shops

- **Stand:** ABGESCHLOSSEN

**Ziel:** Konto- und Adminfläche in die Formensprache des Shops holen. Der
Betreiber: „sieht billig und ziemlich düster aus, der Rest ist hell, modern
und elegant."

**Diagnose:** `/account` und `/admin` stammen sichtbar aus der Starter-Vorlage
und wurden nie angeglichen. Der Shop arbeitet mit `--paper:#f2f0eb`,
`--ink:#111112`, `--line:#d8d4cc`, Manrope, Playfair-Kursive für Akzente und
`.form-card{background:#f8f6f1}`. Die Kontofläche dagegen: `#0d0e11`,
Georgia-Überschriften, Goldränder, dunkle Verläufe.

**Mein Fehler von vorhin:** Ich habe die Formularfelder an die dunkle Karte
angepasst, statt zu fragen, warum die Karte dunkel ist. Die Felder waren nicht
das Problem, die Fläche war es.

**Geplante Schritte:**
1. SEC-18 im Bericht auf *behoben* setzen — der Betreiber hat bestätigt, dass
   der Reset-Link jetzt auf `shop.brandycards.de/account` zeigt.
2. `app/globals.css`: Block „Account surface" auf die helle Sprache umstellen,
   meine dunklen Feld-Überschreibungen wieder entfernen. Wo möglich die
   vorhandenen Regeln (`.form-card`, `.form-field`, `.button`) benutzen statt
   neue zu erfinden — so passt es von selbst.
3. `app/account/page.tsx` und `app/admin/page.tsx`: `SiteHeader`/`SiteFooter`
   einsetzen. Ohne sie bleibt die Seite auch in Hell eine Fremdkörperfläche.
4. `npx tsc --noEmit`, `npm run lint`, `npm test`, lokal ansehen.

**Grenze dieser Sitzung:** Den angemeldeten Zustand kann ich nicht ansehen —
dafür wäre das Passwort des Betreibers nötig. Die Gestaltung muss deshalb aus
vorhandenen, bewährten Regeln entstehen, nicht aus freihändigen Werten, und
der Betreiber sieht sich das Ergebnis an.

**Deploy:** ~~nicht ohne erneute Freigabe~~ — der Betreiber hat eine
**Dauerfreigabe für Deploys** erteilt: „Deploy. Dafür brauchst du nicht
fragen." Sie gilt für `npx wrangler deploy` nach grüner Prüfkette, **nicht**
für schreibende Eingriffe in Produktionsdaten, Migrationen oder Änderungen am
eBay-Angebotsbestand — dafür bleibt es bei der Einzelrücksprache.

**Ergebnis: ABGESCHLOSSEN und deployed.**

- SEC-18 auf *behoben* gesetzt — der Betreiber hat bestätigt, dass der
  Reset-Link jetzt auf `shop.brandycards.de/account` zeigt. Damit sind **alle
  18 Befunde** dieser Prüfung geschlossen bis auf SEC-12 (wartet auf den
  nächsten Schemaschritt) und den Konto-Löschweg aus SEC-15.
- `app/globals.css`: Der Block „Account surface" ist auf `--paper`, `--ink`,
  `--line` und `--muted` umgestellt. Keine eigenen Farbwerte mehr außer den
  beiden Flächentönen, die der Shop ohnehin verwendet (`#f8f6f1` wie
  `.form-card`, `#ebe8e1` wie `.forms-section`).
- `app/account/page.tsx` und `app/admin/page.tsx` tragen jetzt `SiteHeader`
  und `SiteFooter`.

**Gemessener Beleg, dass es dieselbe Sprache ist** — Kontokarte gegen die
Formularkarte auf `/anfragen`:

| | `/account` | `/anfragen` |
|---|---|---|
| Kartenfläche | `rgb(248,246,241)` | `rgb(248,246,241)` |
| Überschrift | 51,2 px Manrope | 51,2 px Manrope |
| Eingabefeld | `rgb(255,255,255)` | `rgb(255,255,255)` |
| Beschriftung | `rgb(81,77,70)` | `rgb(81,77,70)` |

Fläche `rgb(242,240,235)` = `--paper`, gleich dem `body`. Kopf und Fuß auf
beiden Seiten vorhanden, 0 fehlerhafte Ressourcen, keine Konsolenfehler.
`tsc` sauber, Lint 0 Fehler, 98 Tests grün.

**Weiterhin ungeprüft, weil dafür eine Anmeldung nötig wäre:** wie die Karte
im angemeldeten Zustand aussieht (Profilfelder, Adminübersicht mit Zahlen und
Kartenangeboten).

**Deployed als Version `d893527a`.** In Produktion nachgeprüft:
`/account` und `/admin` tragen Kopf und Fuß, Fläche `rgb(242,240,235)`,
Karte `rgb(248,246,241)`, Überschrift 51,2 px Manrope, Felder weiß; keine
Supabase-Fehlermeldung, 0 fehlerhafte Ressourcen auf beiden Seiten;
alle sechs Sicherheits-Kopfzeilen weiterhin gesetzt, `cache-control` auf dem
Katalog unverändert, `/` und `/karten` antworten mit 200.


### 2026-08-07 — Profilformular und SEC-18 (Reset-Link auf localhost)

- **Stand:** ABGESCHLOSSEN

**Ziel:** Zwei Fehler beheben, die der Betreiber beim Durchklicken gefunden hat.

**Fehler 1 — Passwort-Zurücksetzen führt auf `localhost:3000`. Ernst.**
Der Link aus der Reset-Mail zeigt auf `http://localhost:3000/#access_token=…`.
Entscheidend ist die **Form** der URL: Wurzelpfad, kein `/account`, kein
`?next=`. Der Code setzt aber `redirectTo: ${origin}/account?next=…`
([app/account/page.tsx](../app/account/page.tsx)). Supabase hat das `redirectTo`
also **verworfen** und ist auf die **Site URL** zurückgefallen — und die steht
offenbar auf `http://localhost:3000`.

Folge: **Passwort-Zurücksetzen und E-Mail-Bestätigung sind für echte Kunden
kaputt**, weil `emailRedirectTo` beim `signUp` derselben Allowlist unterliegt.
Kein Einbruch, aber eine unbrauchbare Kontowiederherstellung. Zu beheben im
Supabase-Dashboard, nicht im Code — **das kann nur der Betreiber.**

**Fehler 2 — Profilfelder nicht bearbeitbar, Gestaltung passt nicht.**
`.form-field input` ist global `background:#fff` — gedacht für die hellen
Formularkarten, nicht für die dunkle Kontokarte. Dazu sind die Felder
`readOnly`, solange nicht „Profil bearbeiten" geklickt wurde: Sie sehen
bearbeitbar aus, nehmen den Fokus an und verweigern dann die Eingabe.

**Geplante Schritte:**
1. Befund SEC-18 (Supabase-URL-Konfiguration) im Bericht aufnehmen, mit der
   genauen Anleitung für das Dashboard.
2. `app/account/page.tsx`: die `readOnly`-Umschaltung entfernen, Felder immer
   bearbeitbar, ein Knopf „Profil speichern".
3. `app/globals.css`: Formularfelder und Beschriftungen innerhalb von
   `.account-card` an die dunkle Fläche anpassen, `.profile-panel` gestalten.
4. `npx tsc --noEmit`, `npm run lint`, `npm test`, lokal im Browser ansehen.

**Deploy:** ~~nicht ohne erneute Freigabe~~ — **Freigabe erteilt** („Deploye
jetzt das neue Formular"). Der Betreiber hat zuvor die Supabase-URLs
angepasst, SEC-18 sollte damit erledigt sein.

**Was nach dem Deploy nur der Betreiber prüfen kann:**
- Das Profilformular selbst — dafür wäre eine Anmeldung nötig, und das
  Passwort des Betreibers fasse ich nicht an.
- Der Reset-Ablauf — die Bestätigungsmail geht an sein Postfach. Ein Aufruf
  von „Passwort vergessen" von hier aus wäre eine Nachricht in seinem Namen.

**Ergebnis: ABGESCHLOSSEN. Deployed als Version `81c6422d`.**

Vor dem Deploy: `tsc` sauber, Lint 0 Fehler, 98 Tests grün, Bundle-Probe traf.
Danach in Produktion geprüft:

- Die neue Gestaltung ist im ausgelieferten CSS
  (`.account-card .form-field input{color:#f5f1e8;background:#0b0c0fbf;…}`,
  `.profile-panel` vorhanden) und greift im Browser: Feldhintergrund
  `rgba(11,12,15,.75)`, Schrift `#f5f1e8`, Beschriftung `#b7b0a1`.
- `/admin` meldet **nicht** „Supabase ist noch nicht konfiguriert" — das
  Bundle ist gesund.
- Alle sechs Sicherheits-Kopfzeilen weiterhin gesetzt, `cache-control` auf dem
  Katalog unverändert.
- 0 fehlerhafte Ressourcen auf `/account`.

**Zwei Dinge konnte diese Sitzung nicht selbst prüfen, bewusst:**
1. **Das Profilformular im angemeldeten Zustand** — dafür wäre das Passwort des
   Betreibers nötig gewesen.
2. **Der Reset-Ablauf (SEC-18)** — der Betreiber hat die Supabase-URLs
   angepasst, aber die Bestätigung wäre eine Mail in seinem Namen gewesen.
   **SEC-18 bleibt deshalb formal offen, bis er einmal „Passwort vergessen"
   durchgespielt hat.** Erwartete Ziel-URL:
   `https://shop.brandycards.de/account?next=…#access_token=…`


### 2026-08-07 — Deploy der Sicherheitskorrekturen

- **Stand:** ABGESCHLOSSEN

**Ziel:** Die Sicherheitskorrekturen nach Produktion deployen. Der Nutzer hat
die Freigabe ausdrücklich erteilt („Deploy jetzt") und die Entscheidung über
CSP-Scharfschaltung und die offenen Nachschlagearbeiten an mich delegiert.

**Warum das riskant ist und worauf zu achten ist:**
- Ohne `.env.local` im Build-Verzeichnis liefert der Build ein Bundle aus, in
  dem `/admin` und `/account` mit „Supabase ist noch nicht konfiguriert"
  abbrechen — Startseite und `/api/*` sehen dabei **gesund** aus. Dieser
  Worktree erbt die Datei nicht, sie wird vor dem Build kopiert und danach
  wieder entfernt.
- Erster Deploy mit `[[ratelimits]]`, mit angehobenem `@cloudflare/vite-plugin`
  (1.37.1 → 1.51.0) und `wrangler` (4.92.0 → 4.119.0) sowie `next` 16.2.11.
- Cloudflare-Secrets überleben einen Deploy; `[vars]` in `wrangler.toml`
  enthält nichts Geheimes.

**Geplante Schritte:**
1. `.env.local` kopieren, `npx tsc --noEmit`, `npm run lint`, `npm test`.
2. Bundle-Probe: `grep -rl "supabase.co" dist/client/assets` muss treffen.
3. CSP: prüfen, ob das Bundle Inline-Skripte braucht. Danach entscheiden, ob
   scharf geschaltet wird und in welcher Form — mit lokalem Durchgang über
   alle Seiten, bevor etwas durchsetzend wird.
4. `npx wrangler deploy`.
5. Nachprüfen: `/account` und `/admin` laden, Kopfzeilen, `cache-control`,
   Bindings im Dashboard bzw. über die API.
6. Nachschlagen, soweit lesend möglich: HSTS auf Zonenebene über die
   Cloudflare-API, eBay-Kontingent über `GetApiAccessRules` (rein lesend,
   verändert kein Angebot). Die Supabase-Passwortrichtlinie lässt sich **nicht**
   ohne Dashboard oder Kontoanlage ermitteln — dafür wird nichts probiert.
7. `.env.local` wieder entfernen, Ergebnis nachtragen, committen, pushen.

**Grenzen bleiben:** kein Lasttest gegen Produktion, keine schreibenden
Eingriffe in Produktionsdaten, keine Änderung am echten eBay-Angebotsbestand.

**Wenn diese Sitzung hier abbricht:** Prüfen, ob bereits deployed wurde —
`npx wrangler deployments list` und ein Aufruf von
`https://shop.brandycards.de/account`. Trägt die Antwort von `/` bereits
`x-content-type-options`, ist der Deploy durch.

**Ergebnis: ABGESCHLOSSEN. Deployed.**

Zwei Versionen: **`1cfd52f1`** (alle Korrekturen, CSP durchsetzend) und
**`650c189a`** (HSTS nachgezogen).

Vor dem Deploy: `tsc` sauber, Lint 0 Fehler, `npm test` 98 grün,
`grep -rl "supabase.co" dist/client/assets` traf. Danach in Produktion geprüft:

- `/account` zeigt das Anmeldeformular, `/admin` „Bitte melde dich zuerst an" —
  **nicht** „Supabase ist noch nicht konfiguriert". Das Bundle ist gesund.
- `/karten`: 296 Karten, 0 blockierte Ressourcen, 0 Konsolenfehler.
  Kartendetail mit echtem eBay-Bild: alle Bilder geladen.
- Kopfzeilen an `/`: `content-security-policy` (durchsetzend),
  `strict-transport-security`, `referrer-policy`, `permissions-policy`,
  `x-content-type-options`, `x-frame-options`.
- `cache-control` auf `/api/products`: `public, max-age=60, stale-while-revalidate=300`.
- Beim Deploy aufgelöst: `env.RATE_LIMITER (10 requests/60s)` und
  `env.RATE_LIMITER_STRICT (3 requests/60s)`.
- eBay-Import um 09:00 nach dem Deploy: `SUCCEEDED`, 294 aktualisiert.

**Das Rate-Limit wurde nicht gegen Produktion getestet** — das wäre die Last,
gegen die es schützt. Lokal belegt: 10 durch, dann 429 mit `retry-after: 60`.

**CSP durchsetzend, mit einer benannten Einschränkung.** vinext liefert acht
Inline-Skripte je Seite, `script-src` braucht deshalb `'unsafe-inline'` — und
damit sind Inline-Eventhandler erlaubt. Ein künftiges `<img onerror=…>` liefe.
Was greift, ist die zweite Hälfte: keine fremden Skripte, kein Ziel außerhalb
dieser Herkunft und Supabase. Der Weg zur vollen Wirkung sind Nonces, siehe
Punkt 3a in [ai-todo.md](ai-todo.md).

**HSTS gesetzt als `max-age=31536000`**, bewusst **ohne** `includeSubDomains`
(bände fremde Hosts unter `brandycards.de` mit) und **ohne** `preload` (der
einzige Schritt, der sich nicht per Deploy zurücknehmen ließe). Rückweg:
`max-age=0` setzen und deployen.

**Nachschlagen — zwei von drei erledigt:**
- HSTS war **aus**, ist jetzt gesetzt.
- eBay-Kontingent **nicht ermittelbar**: `EBAY_REFRESH_TOKEN` in der lokalen
  `.env.local` ist abgelaufen („invalid or was issued to another client").
  **Produktion ist nicht betroffen** — dort liegt der Token als
  Cloudflare-Secret und der Import läuft. Beim nächsten OAuth-Durchlauf im
  Adminbereich mit erneuern.
- Supabase-Passwortrichtlinie **bleibt offen**: über keinen öffentlichen
  Endpunkt lesbar, und die Alternative wäre gewesen, mit schwachen Passwörtern
  Konten in der Produktions-Instanz anzulegen. Nachzusehen unter
  *Authentication → Policies*.


### 2026-08-07 — Aufbewahrungsfrist und Datenschutztext (SEC-15, SEC-16)

- **Stand:** ABGESCHLOSSEN

**Ziel:** Die beiden Befunde umsetzen, die nach der Sicherheitsprüfung auf eine
Entscheidung des Betreibers gewartet haben, und den Bericht mit der nun
bekannten Tarifauskunft nachschärfen.

**Entscheidungen des Nutzers:**
1. **SEC-15 — Aufbewahrung: 90 Tage.** Abgeschlossene Kartenangebote
   (`REJECTED`, `CLOSED`) samt Bildern werden 90 Tage nach der letzten
   Statusänderung automatisch gelöscht. Angenommene bleiben — sie werden zu
   Bestellungen und fallen unter steuerliche Aufbewahrungspflichten.
2. **SEC-16 — Datenschutzerklärung ergänzen** um einen Satz zu den direkt von
   eBays CDN geladenen Bildern, als Arbeitsentwurf gekennzeichnet.
3. **SEC-12 — bleibt offen** bis zum nächsten ohnehin nötigen Schemaschritt.
   Keine Migration allein für diesen Befund.
4. **Cloudflare-Tarif: Free.** Damit steigt SEC-05 von *mittel* auf *hoch* —
   rund 2 900 Aufrufe von `/api/products` brauchen das D1-Tageskontingent auf,
   danach antwortet jede datenbankgestützte Seite mit 503.

**Geplante Schritte:**
1. Aufbewahrungslogik als reine, testbare Funktion (`lib/retention.ts`), die
   Datenbank- und R2-Seite in `lib/card-submission-cleanup.ts`, ausgelöst vom
   `scheduled`-Lauf in `worker/index.ts`.
2. Satz in `app/datenschutz/page.tsx`.
3. `docs/security-findings.md`: SEC-05 auf hoch, Status von SEC-15 und SEC-16,
   Tarif-Unsicherheit auflösen.
4. `docs/ai-todo.md` und `docs/ai-agent-log.md` nachziehen.

**Achtung, Falle:** `card_submissions.created_at`/`updated_at` stehen per
SQLite-Vorgabe im Format `YYYY-MM-DD HH:MM:SS`, während der Anwendungscode
sonst ISO-8601 mit `T` und `Z` schreibt. Ein reiner Zeichenkettenvergleich
zwischen beiden Formen ist **falsch** — `' '` sortiert vor `'T'`, also gölte
jede Vorgabe-Zeitangabe als uralt und würde gelöscht. Der Vergleich läuft
deshalb über SQLites `datetime()` auf beiden Seiten.

**Verifikation:** `npx tsc --noEmit`, `npm run lint`, `npm test`. Löschlauf
gegen die **lokale** D1 mit gesetzten Zeitstempeln beider Formate; **kein**
schreibender Eingriff in Produktionsdaten.

**Ergebnis: ABGESCHLOSSEN.** Beide Befunde umgesetzt, Bericht nachgeschärft.
**16 von 17 Befunden geschlossen**, offen bleibt nur SEC-12.

- `lib/retention.ts` (neu) enthält die Entscheidung als reine Funktion,
  `deleteExpiredCardSubmissions` in `lib/card-submission-cleanup.ts` die
  Datenbank- und R2-Seite, ausgelöst vom `scheduled`-Lauf und zusätzlich über
  `POST /api/admin/card-submissions/cleanup`.
- `tests/retention.test.mjs` (neu, 11 Tests). `npm test` 85 → **96 Tests**,
  alle grün. `tsc` und Lint sauber.
- Datenschutzerklärung: Abschnitt 7 heißt jetzt „eBay-Synchronisierung und
  Kartenbilder" und benennt die Einbindung der eBay-Bildserver, Abschnitt 9
  die 90-Tage-Frist, Abschnitt 11 verweist auf 7. Der Arbeitsentwurf-Hinweis
  am Seitenende nennt 7 und 9 als fachlich zu prüfen.

**Die Zeitstempel-Falle war real und wurde gemessen.** `card_submissions`
bekommt seine Zeiten aus SQLites `CURRENT_TIMESTAMP` (`YYYY-MM-DD HH:MM:SS`),
der übrige Code schreibt ISO-8601 mit `T` und `Z`. Roh verglichen sortiert
`' '` vor `'T'`. Gegen die lokale Datenbank, Stichtag heute Mitternacht, ein
Vorgang von heute 23 Uhr im Bestand:

```
naiver Vergleich loescht : 4 Vorgaenge
mit datetime() loescht   : 3 Vorgaenge
```

Ein Vorgang von **heute** wäre als 90 Tage alt gelöscht worden. Beide Seiten
laufen deshalb über SQLites `datetime()`; ein Test hält den Fall fest.

**Nicht angefasst:** Ein Selbstbedienungsweg für Auskunft und Löschung des
Kontos. Solange es genau einen Nutzer gibt, trägt der Verweis auf die
E-Mail-Adresse. Vor dem Verkaufsstart sollte er stehen.

**Weiterhin gilt: es ist nicht deployed.** Die Löschfrist läuft im
`scheduled`-Lauf und beginnt damit erst nach dem Deploy zu wirken.


### 2026-08-07 — Vollständige Sicherheitsprüfung

- **Stand:** ABGESCHLOSSEN

**Ziel:** Sicherheitsprüfung nach [security-audit-brief.md](security-audit-brief.md)
in drei Phasen: (1) prüfen und nach `docs/security-findings.md` berichten,
(2) Befunde nach Schweregrad beheben, (3) nachprüfen und Status je Befund
eintragen.

**Arbeitsort:** Worktree `.claude/worktrees/brandycards-security-audit-929953`,
Branch `claude/brandycards-security-audit-929953`, ausgehend von
`origin/agent/initial-brandycards` (0504567). Commits gehen am Ende nach
`agent/initial-brandycards`, **nicht** nach `main`.

**Geplante Schritte:**
1. Phase 1 — Codeprüfung aller Endpunkte, Vertrauensgrenzen und der zwölf
   Verdachtsmomente; Bericht nach `docs/security-findings.md`.
2. Phase 1 — Rückmeldung an den Nutzer, **bevor** behoben wird.
3. Phase 2 — Korrekturen nach Schweregrad, je mit einem Test, der den Angriff
   nachstellt und ohne die Korrektur rot ist.
4. Phase 3 — Nachprüfen, Status je Befund, Gesamteinschätzung.

**Betroffene Dateien (erwartet):** `docs/security-findings.md` (neu),
`lib/ebay-description.ts`, `lib/rate-limit.ts`, `wrangler.toml`,
`app/api/**`, `tests/**`.

**Verifikation:** `npx tsc --noEmit`, `npm run lint`, `npm test`. Kein Deploy
ohne ausdrückliche Freigabe — dieser Worktree hat **kein** `.env.local`, ein
Build hier liefert ein Bundle, in dem `/admin` und `/account` brechen.

**Grenzen:** keine Angriffe, Lasttests oder schreibenden Eingriffe gegen die
Produktion. Lesende D1-Abfragen und normale Seitenaufrufe sind erlaubt.

**Zwischenstand 2026-08-07:** Phase 1 abgeschlossen, 17 Befunde in
[security-findings.md](security-findings.md), Commit `4fbde38`, gepusht.
Phase 2 läuft.

**Entscheidungen des Nutzers zu den vorgelegten Punkten:**
1. Bot-Schutz: **Honeypot + Zeitschwelle**, kein Turnstile.
2. CSP: **erst `Content-Security-Policy-Report-Only`**, durchsetzend später in
   einer zweiten Runde nach Auswertung der Verstöße.
3. Abhängigkeiten: `next` und `react-server-dom-webpack` **anheben, wenn
   `tsc`, `lint` und `npm test` grün sind** — sonst zurücknehmen und melden.
4. Deploy: **der Nutzer deployt selbst.** Diese Sitzung baut nicht für
   Produktion und deployt nicht. Geliefert wird eine Schritt-für-Schritt-
   Anleitung inkl. `.env.local`-Kopie und Nachprüfung von `/admin`.

**Noch offen (bewusst nicht eigenmächtig):** Aufbewahrungsfrist für
Kartenangebote (SEC-15) und der Satz zu eBay-Bildern in der
Datenschutzerklärung (SEC-16) — beides kein rein technischer Eingriff.

**Ergebnis: ABGESCHLOSSEN.** Alle drei Phasen durchlaufen.

- Phase 1: 17 Befunde, drei davon hoch. Bericht in
  [security-findings.md](security-findings.md), Commit `4fbde38`.
- Phase 2: 15 Befunde behoben, Commit `eff5c35`. Je Korrektur ein Test, der den
  Angriff nachstellt; SEC-01, SEC-02 und SEC-03 wurden ohne die Korrektur
  nachweislich rot gesehen.
- Phase 3: Nachprüfung gegen einen **lokalen** Server, Status je Befund in der
  Statusübersicht des Berichts, Commit `7b73c4f`.

**Zahlen:** `npm test` 63 → 85 Tests, alle grün. `npx tsc --noEmit` sauber.
`npm run lint` 0 Fehler (1 vorbestehende `<img>`-Warnung).
`npm audit` gesamt 18 → 16, *hoch* 13 → 8; produktionsseitig verbleiben 3, alle
Bauwerkzeug aus `next` (`postcss`, `sharp`).

**Nicht geschlossen, mit Absicht:**
- **SEC-12** (eBay-OAuth-Rückseite ohne Anmeldung). Der naheliegende Fix wäre
  falsch gewesen — eBay leitet den *Browser* um, eine Navigation trägt keinen
  `Authorization`-Header, `requireAdmin` hätte den eBay-Anschluss blockiert
  statt ihn zu sichern. Die richtige Lösung braucht einen Ablageort für eine
  kurzlebige Anspruchs-Kennung, also eine Migration. Begründung steht als
  Kommentar an der Route.
- ~~**SEC-15**~~ **erledigt am 2026-08-07:** 90 Tage, vom Betreiber festgelegt.
- ~~**SEC-16**, zweite Hälfte~~ **erledigt am 2026-08-07:** Satz zu eBay-Bildern in der
  Datenschutzerklärung. `Referrer-Policy` ist gesetzt; den Rechtstext ändert
  diese Sitzung nicht.

**Nebenbei repariert, war vorbestehend:** `npm run dev` startete gar nicht.
Zwei Ursachen, beide nachgemessen mit unveränderter `wrangler.toml`:
`nodejs_compat` war doppelt deklariert (`vite.config.ts` **und**
`wrangler.toml`), und das in `@cloudflare/vite-plugin@1.37.1` gebündelte
`workerd` unterstützte das `compatibility_date` `2026-08-05` nicht. Behoben
durch Streichen des Duplikats in `vite.config.ts` und Anheben von
`@cloudflare/vite-plugin` auf 1.51.0 sowie `wrangler` auf 4.119.0.
**Das `compatibility_date` selbst wurde nicht angefasst.**

**WICHTIG für die nächste Sitzung: es ist noch nicht deployed.** In Produktion
läuft der Stand *vor* diesen Korrekturen. SEC-02 wirkt ausschließlich durch den
Deploy, weil das Rate-Limit-Binding zur Laufzeit entsteht. Der Nutzer deployt
selbst; die Schrittfolge samt Nachprüfung steht in
[security-findings.md](security-findings.md) unter „E-6 — Deploy".


### 2026-08-06 — Preisverhandlung statt Gutscheincodes, echte Versandkosten

- **Stand:** ABGESCHLOSSEN
- **Versand:** Der Checkout rechnet seit jeher 3,45 € (DE) und 14,49 € (EU),
  serverseitig wie clientseitig. Eine Versandkostenfrei-Logik gibt es **nirgends** —
  das Banner auf jeder Seite und die Kartenfakten warben trotzdem damit. Beides
  korrigiert, Zeile „Verpackung" entfernt. Commit im selben Lauf.
- **Verhandlung:** Kunden schlagen auf Festpreis-Karten einen Preis vor, ihr
  entscheidet im Admin, der angenommene Betrag gilt 48 Stunden für diesen Kunden.
  Nur angemeldet, drei Versuche je Karte. Commit `a0d4367`, deployed `0b922bf6`.
- **Warum keine Gutscheincodes:** Ein Code ist ein Inhaber-Token — weitergebbar,
  teilbar — und müsste ohnehin an Nutzer, Produkt und Betrag gebunden werden.
  Dann ist er nichts anderes als das angenommene Angebot, nur mit einem
  zusätzlichen verlierbaren Zwischenschritt. `price_offers` trug all das bereits.
- **Sicherheitskern:** Der Preis kommt **nie** aus dem Browser. Der Checkout
  erhält ausschließlich Produkt-IDs und löst den Betrag serverseitig aus
  angenommenen, unverfallenen Angeboten auf (`acceptedOfferPrices`). PayPal wird
  aus unserer eigenen Rechnung belastet. `unitAmountCents` in der Bestellposition
  hält jetzt den ausgehandelten statt des Listenpreises — sonst wäre PayPals
  eigene Zwischensummenprüfung fehlgeschlagen.
- **Testbar gemacht:** `pickAcceptedPrices` ist von der Abfrage getrennt und
  direkt getestet — fehlendes Ablaufdatum, exakt abgelaufenes Fenster, negative
  und gebrochene Beträge müssen alle **fail closed** sein. 45/45 Tests.
- **Bewusst kein Bestandsblock bei Annahme:** Die Karte bleibt hier und auf eBay
  verkäuflich. Reservieren würde mit dem parallelen eBay-Angebot kollidieren.
- **Ablauf:** `expireLapsedOffers` läuft im stündlichen Worker mit.
- **Offen / Risiko:** Ein verhandelter Verkauf erhöht das Doppelverkaufsrisiko,
  weil die Karte parallel bei eBay steht und der eBay-Schreibpfad weiterhin
  unterbrochen ist (`ebayOfferId` null, siehe offene Punkte). Vor größerer
  Bewerbung der Funktion sollte das gelöst sein.
- **Noch nicht gebaut:** Der Checkout zeigt vor dem Anlegen der Bestellung
  weiterhin den Listenpreis; der Rabatt erscheint erst in der Serverantwort und
  bei PayPal. Kunden zahlen also nie zu viel, sehen den Vorteil aber spät.
  Ebenso fehlt eine Benachrichtigung per E-Mail bei Annahme oder Ablehnung.

### 2026-08-06 — eBay-Beschreibung im Shop-Design statt eingebettet

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Die eBay-Beschreibung sah unbrauchbar aus — Logo auf schwarzem Kasten
  in heller Seite, Tabelle ohne Rahmen, loser Text.
- **Ursache:** Falsche Grundentscheidung meinerseits. Ich hatte eBays Markup
  **eingebettet**, statt es zu **übernehmen**. Die Vorlage ist für eBays Seite
  gebaut (schwarz-gold, eigener Kopf, eigener Fuß) und lebt von `style` — das
  der Sanitizer zu Recht entfernt. `style` wieder zuzulassen wäre doppelt falsch
  gewesen: fremdes Design in der Seite und CSS-basierte Angriffe.
- **Umsetzung:** `lib/ebay-description.ts` liest die Struktur aus dem bereits
  sanitierten HTML. Die zweispaltige Tabelle wird zu Label/Wert-Paaren, jede
  Überschrift zu einem Abschnitt; Kopfbereich mit Logo, wiederholter
  `<h1>`-Titelblock und die Fußzeile fallen weg. Der Shop rendert alles in
  eigener Typografie (`.spec-table`, `.detail-block`, `.detail-prose`).
- **Robustheit:** Bewusst strukturell statt auf deutsche Überschriften verdrahtet
  — jede `<h1>`–`<h6>` beginnt einen Abschnitt, jede zweispaltige Tabelle wird zu
  Spezifikationen. Erkennt der Parser nichts, liefert die API weiterhin das
  sanitierte HTML, und die Seite zeigt es wie zuvor.
- **Verifikation:** 36/36 Tests, `tsc --noEmit` sauber, Lint 0 Fehler. An echten
  Produktionsdaten geprüft: 6 Detailzeilen, drei Abschnitte (Beschreibung,
  Zustand & Hinweise, Versand & Verpackung), kein Logo, keine Fußzeile, kein
  doppelter Titel. Commit `8cfb727`, deployed `1bde3a4d`.
- **Hinweis für später:** Der Parser stützt sich auf Überschriften und eine
  zweispaltige Tabelle. Ändert ihr die eBay-Vorlage grundlegend, greift der
  Rückfall auf das sanitierte HTML — es geht nichts verloren, sieht dann aber
  wieder schlichter aus.

### 2026-08-06 — Detailseite je Karte, eBay-Beschreibung, Bilder gerade

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Bilder gerade und weniger gezoomt, Filterleiste weg, Titel klickbar,
  Detailseite mit Bild-Zoom und eBay-Artikelbeschreibung.
- **Ergebnis:** `/karten/[id]` samt `/api/products/[id]`. Titel und Bild im Raster
  verlinken dorthin. Detailseite zeigt das Bild groß, per Klick als Lightbox
  (Escape und Klick außerhalb schließen), Miniaturenleiste bei mehreren Bildern,
  Preis, Bestand und Warenkorb. Produktbilder stehen jetzt gerade
  (`object-fit: contain` mit Innenabstand statt gekippter `.card-art`-Optik).
  Filterleiste entfernt, Suche bleibt. Commit `8522c44`, deployed `c8ce64d6`.
- **Beschreibung:** `GetMyeBaySelling` liefert keine; `description_html` war bei
  allen 296 Listings leer. Sie kommt jetzt aus `GetItem` — **ein Aufruf je
  Artikel**, deshalb bewusst nicht im Sync (das wären ~300 Aufrufe pro Stunde),
  sondern beim ersten Öffnen einer Detailseite, danach aus der Datenbank.
  Live geprüft: 2299 Zeichen bereinigtes HTML, Zwischenspeicherung greift.
- **Sicherheit:** eBay-Beschreibungen sind fremdes Markup und enthalten Skripte,
  Zählpixel und Inline-Handler. `lib/sanitize-html.ts` filtert gegen eine
  Allowlist, bevor irgendetwas in den Browser geht — 12 Tests, unter anderem
  nicht geschlossene `<script>`-Tags, `java\tscript:`-Umgehung über
  Steuerzeichen und in Kommentaren geschmuggeltes Markup. An echten Daten
  gegengeprüft: keine gefährlichen Reste, nur erlaubte Tags.
- **Nebenwirkung:** Der Sanitizer entfernt auch `style`-Attribute. Die
  eBay-Vorlage verliert dadurch ihre Inline-Gestaltung; `.ebay-description` in
  `globals.css` liefert stattdessen eine eigene Grundformatierung. Das ist
  Absicht — `style` wieder zuzulassen öffnet CSS-basierte Angriffe.
- **Verifikation:** 28/28 Tests, `tsc --noEmit` sauber, Lint 0 Fehler,
  Detailseite in Produktion mit HTTP 200 abgerufen.
- **Offen:** Nur die geöffnete Karte hat bisher eine zwischengespeicherte
  Beschreibung. Die übrigen füllen sich beim ersten Aufruf. Wer das vorziehen
  will, bräuchte einen Hintergrund-Backfill mit wenigen Artikeln je Sync-Lauf.

### 2026-08-06 — eBay-Bilder: fehlten fast überall, Rest war Miniatur

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Produktbilder im Shop anzeigen, hochauflösend.
- **Befund:** Zwei Fehler. Erstens las der Parser nur `PictureURL`, das
  `GetMyeBaySelling` nur für einen Bruchteil der Artikel liefert — 291 von 296
  Karten hatten gar keine Bildzeile. Zweitens war die gespeicherte Variante die
  Miniatur: am Live-CDN gemessen liefert `$_1.JPG` **225x400 bei 26 KB**, obwohl
  der Pfad `MTYwMFg5MDA=` (1600X900) behauptet. Das Base64-Segment nennt die
  Originalmaße, nicht die ausgelieferte Größe.
- **Gemessene Varianten:** `$_57.JPG` und `s-l1600.jpg` liefern beide
  **900x1600 bei 364 KB**; `s-l2400` gibt identische Bytes zurück, 1600 ist also
  die Obergrenze. Alles reine Pfad-Umschreibungen, kein zusätzlicher API-Aufruf.
- **Umsetzung:** Sync liest jetzt zusätzlich `GalleryURL` und hebt jede URL auf
  die größte Variante. Helfer in `lib/ebay-images.ts`, bewusst ohne
  Abhängigkeiten, damit Client-Komponenten sie importieren können ohne den
  eBay-Client samt Secret-Logik ins Browser-Bundle zu ziehen. Galerie zeigt das
  Original und lädt ihre fünf Karten vor; das Raster mit 296 Karten holt
  `s-l800` und lädt verzögert. `.product-photo` bekam eine `object-fit`-Regel —
  vorher wäre das Hochformat in den 198x292-Rahmen gequetscht worden.
- **Verifikation:** neuer `tests/ebay-images.test.mjs`, 16/16 Tests,
  `tsc --noEmit` sauber, Lint 0 Fehler. Commit `fe87619`, deployed `475eac62`.
- **Wirkt erst nach einem Sync-Lauf** — die alten Miniatur-URLs stehen noch in
  `product_assets`. Der Sync ersetzt die Bilder je Produkt vollständig.
- **Nebenbei:** `allowImportingTsExtensions` in der tsconfig, weil Nodes
  Test-Runner Typen strippt, aber keine endungslosen Importe auflöst.

### 2026-08-06 — Startseite entschlackt, Galerie eingeführt

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Shop-Inhalt von `/` auf Unterseiten verlagern, Landingpage auf Hero,
  Galerie, Verweise und Footer reduzieren.
- **Ergebnis:** Neue Seiten `/karten`, `/anfragen`, `/verkaufen`, `/ueber-uns`,
  geteilte `SiteHeader`/`SiteFooter` in `app/site-chrome.tsx`, Formularbausteine
  in `app/forms.tsx`. Galerie in `app/gallery.tsx` mit genau fünf Karten,
  2-Sekunden-Takt, Pause bei Hover und Fokus, `prefers-reduced-motion`, Umschalter
  „Neu dabei" / „Beliebt" (= teuerste). Neue Route
  `/api/products/highlights`. Der Warenkorb läuft jetzt über
  `useSyncExternalStore`, damit die Zahl im Header über alle Seiten mitläuft.
  Nebenbei behoben: „Vormerken" und Preisvorschlag waren fest auf eine
  Demo-Fehlermeldung verdrahtet; Vormerken ruft jetzt echt `/api/prelisted-interest`.
  Commit `bd0a69c`, deployed als `a1cdd14f`. Alle Seiten antworten mit HTTP 200,
  `npm test` 11/11, `tsc --noEmit` sauber, Lint 0 Fehler.
- **Beobachtung beim Deploy:** `/karten` lieferte unmittelbar nach dem Deploy
  einmalig 404 und kurz darauf 200 — Propagierungsverzögerung, kein Routingfehler.
  Bei künftigen Deploys nicht sofort urteilen, sondern nachfassen.
- **Bewusst weggelassen:** Das frühere Preisvorschlag-Formular. `/api/price-offers`
  verlangt eine `PRELISTED`-Produkt-ID, und es existiert derzeit kein einziges
  `PRELISTED`-Produkt — ein freies Formular würde ausnahmslos mit
  „Die angegebene Karte ist nicht verfügbar" scheitern. Siehe offene Punkte.

### 2026-08-06 — `main` auf den Arbeitsstand gebracht

- **Stand:** ABGESCHLOSSEN
- **Ziel:** `main` hing 51 Commits zurück und enthielt nur das Ursprungsfundament.
- **Ergebnis:** PR #1 ist `MERGED` (2026-08-06T17:53:43Z), `main` steht auf dem
  Merge-Commit `a36e626`. Dateibäume von `main` und `agent/initial-brandycards`
  sind identisch, es fehlen `main` keine Commits mehr. Der Branch wurde
  anschließend per Fast-Forward auf `a36e626` nachgezogen, damit weitere Commits
  linear obendrauf laufen und `main` sich jederzeit fast-forwarden lässt.
- **Besonderheit:** Der Merge wurde **ohne CI-Bestätigung** ausgeführt, weil
  GitHub Actions im Ausfall war (`major_outage` seit 15:22 UTC). Als Ersatz lief
  die Prüfung lokal: `npx tsc --noEmit` sauber, `npm run lint` 0 Fehler,
  `npm test` 7/7, Build erfolgreich — das deckt den Workflow ab und zusätzlich
  die Typprüfung, die CI gar nicht ausführt. **Sobald Actions wieder läuft,
  sollte einmal CI über `main` laufen**, damit der Stand auch dort belegt ist.
- **Ausgeführt vom Nutzer**, da der Berechtigungsklassifizierer dieser Umgebung
  Schreibzugriff auf den Standard-Branch verweigert — sowohl über `gh pr merge`
  als auch über `git merge` mit Push. Für künftige Sitzungen gilt: Merges nach
  `main` vorbereiten und dem Nutzer den fertigen Befehl geben.
- **Branch bewusst nicht gelöscht** — das Hauptverzeichnis ist darauf ausgecheckt.

### 2026-08-06 — Aufräumlauf bestätigt, Produktzahl stimmt

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Prüfen, ob der Waisen-Sweep in Produktion gegriffen hat, und ob
  lokaler Stand, GitHub und Deployment übereinstimmen.
- **Ergebnis:** Lauf `2026-08-06 17:35:21` steht auf `SUCCEEDED` mit 297 Updates,
  **3 Deaktivierungen** und 0 Fehlern — der Sweep hat die drei Waisen abgeräumt.
  Produkte jetzt 297 `ACTIVE` und 245 `INACTIVE`; die 297 decken sich mit der
  eBay-Aktivliste und mit dem, was `/api/products` ausliefert. Damit ist die
  Kette aus SoldList-Import, D1-Parametergrenze und Waisen vollständig
  geschlossen. Kein Code geändert, nur dieser Protokolleintrag.

### 2026-08-06 — Waisen-Produkte ohne Listing deaktivieren

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Klären, warum die Admin-Kachel 300 statt der erwarteten 294 zeigt.
- **Ergebnis:** 300 = 297 echte aktive Listings + 3 Produkte ohne Listing-Zeile.
  Die 297 stimmen mit eBay überein (294 aus dem älteren Screenshot plus 3 neu
  importierte). Die Vermutung, Angebote mit Bestand 2 würden doppelt zählen, hat
  sich nicht bestätigt — die Menge steht in `inventory.availableQuantity` und
  erzeugt keine zusätzlichen Zeilen. Sync deaktiviert Waisen jetzt selbst.
  Deployed als `c6dfef06`, Commit `1483b4a`. Aufräumlauf steht noch aus.

### 2026-08-06 — D1-Parametergrenze in der Batch-Deaktivierung

- **Stand:** ABGESCHLOSSEN
- **Ziel:** `D1_ERROR: too many SQL variables` im Admin-Sync beheben.
- **Ergebnis:** Selbst verursacht durch Blöcke zu 50 (Insert mit 300 Parametern).
  Blockgrößen kommen jetzt aus `lib/d1-limits.ts`, gemessen statt geschätzt durch
  `tests/d1-limits.test.mjs`. Commit `358994f`. Der fehlgeschlagene Lauf belegte
  zugleich, dass der Importfix greift: 297 statt 530 Angebote.

### 2026-08-06 — Deploy ohne Supabase-Konfiguration

- **Stand:** ABGESCHLOSSEN (Fehler, behoben)
- **Ziel:** eBay-Importfix nach Produktion bringen.
- **Ergebnis:** Deploy lief, brach aber `/admin` und `/account`, weil aus einem
  Worktree ohne `.env.local` gebaut wurde. Neu gebaut und deployed als
  `baba72cb`. Ursache in der README festgehalten, Commit `f73e72a`.

### 2026-08-06 — SoldList-Import (Ursache der doppelten Produkte)

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Klären, warum 539 Produkte bei 294 aktiven eBay-Angeboten existieren.
- **Ergebnis:** `DetailLevel ReturnAll` ließ eBay zusätzlich SoldList, UnsoldList
  und ScheduledList liefern; der Parser durchsuchte das gesamte Dokument nach
  `<Item>`. Verkaufte und neu eingestellte Karten erschienen dadurch doppelt.
  Parsing auf `<ActiveList>` begrenzt, übrige Container abgewählt. Commit
  `7635ef4`, Regressionstest `tests/ebay-active-list.test.mjs`.
## 2026-08-10 – Projektstand vollständig erfassen

- Status: ABGESCHLOSSEN
- Auftrag: Projekt vollständig einlesen und aktuellen Stand erfassen.
- Ergebnis: Repository-Anweisungen, Projektstruktur, Konfiguration, Abhängigkeiten,
  Worker-/D1-/R2-Architektur, Authentifizierung, eBay-/PayPal-Flows, Admin- und
  Kundenoberflächen, Tests sowie Betriebs- und Sicherheitsdokumentation gelesen
  und miteinander abgeglichen.
- Aktueller technischer Stand: N1, N3, N5, N6, N7, N8 und A sind laut
  Dokumentation umgesetzt; N4 bleibt wegen des fehlenden externen Offsite-
  Backup-Ziels teilweise offen. N2 ist technisch weitgehend umgesetzt, der
  echte bidirektionale eBay-Verkaufsnachweis und die Klärung der in der
  Zustellhistorie fehlenden Notifications bleiben offen.
- Weitere Betreiberpunkte: Rechtsinhalte enthalten weiterhin Arbeitsentwürfe
  bzw. Prüfhinweise; für das Offsite-Backup fehlen Zielanbieter und Zugangsdaten.
- Nicht durchgeführt: kein Deploy und keine Produktionsdatenänderung.
- Git: Die vorgeschriebene Handover-Dokumentation wurde ergänzt und lokal
  committed; der abschließende Git-Status wird nach diesem Eintrag geprüft.
## 2026-08-10 – Messe-Flyer BrandyCards

- Auftrag: Flyer für die kommende Messe vorbereiten; vorhandenes Logo und Markenmaterial prüfen.
- Status: ABGESCHLOSSEN
- Ergebnis: Das transparente Logo ist vorhanden unter `app/brand/brandycards-logo.png`;
  ein erneuter Upload ist nicht noetig. Vorhandene Messeflyer-Ausgaben und
  Gestaltungsdokumentation wurden ebenfalls gefunden. Fuer eine neue Variante
  fehlen noch konkrete Messedaten bzw. gewuenschte Inhalte.
## 2026-08-10 - Komplett neue Messeflyer-Ideen

- Auftrag: Neue Flyer-Richtungen von Grund auf entwickeln; vorhandene Flyer
  ausdruecklich nicht als Vorlage verwenden.
- Leitidee aus der Brudernotiz: auffaellig und mitnahmefreundlich, klar groesser
  als eine Visitenkarte und mit mehr Informationen.
- Stand: ABGESCHLOSSEN.
- Ergebnis: Drei neue Konzeptbilder erstellt und getrennt gespeichert:
  Card Vault, Card Hunt und Card Archive. Die Brudernotiz wurde als Leitidee
  umgesetzt: hohe Fernwirkung, groesser als eine Visitenkarte und mit klaren
  Informationsbloecken. Vorhandene Flyer wurden nicht als Gestaltungsreferenz
  verwendet.
## 2026-08-10 - Drei neue beidseitige Flyer ohne AI-Slop

- Auftrag: Drei neue Flyer-Richtungen mit Vorder- und Rueckseite entwickeln;
  fruehere Entwuerfe ausdruecklich nicht als Gestaltungsvorlage verwenden.
- Leitplanken: realistisch produzierbares Layout, saubere Typografie, wenig
  Dekoration, starke Mitnahme- und Fernwirkung, Rueckseite mit eigenstaendigem
  Informationsnutzen.
- Stand: ABGESCHLOSSEN.
- Ergebnis: Drei eigenstaendige beidseitige A5-Flyer wurden als sauber gesetzte
  ReportLab-PDFs erstellt: Karte gefunden, Sammlungs-Check und Nicht nur Karten.
  Jede PDF hat zwei Seiten; alle sechs Seiten wurden als PNG gerendert und
  visuell auf Rand, Lesbarkeit und Hierarchie geprueft. Die frueheren
  Entwuerfe und AI-Bildkonzepte wurden nicht als Vorlage verwendet.
## 2026-08-10 - Card-Hunt-Flyer gegen AI-Slop ueberarbeiten

- Auftrag: Die vom Bruder favorisierte Card-Hunt-Idee als weniger ueberladenes,
  professionelles beidseitiges Layout neu setzen.
- Kritikpunkt: Die Referenz kombiniert zu viele Deko-Cliches gleichzeitig;
  Pfeile, Sterne, Punkte, Karten und Text muessen auf einen klaren visuellen
  Hauptgedanken reduziert werden.
- Stand: ABGESCHLOSSEN.
- Ergebnis: Die Card-Hunt-Idee wurde als beidseitiger A5-Flyer neu gesetzt.
  Die Gestaltung reduziert die Referenz auf eine klare Typografie, zwei
  Kartenformen, eine begrenzte Farbpalette und eine strukturierte Rueckseite.
  PDF und beide Seiten-PNGs wurden gerendert und visuell geprueft; der QR-Code
  bleibt bewusst als Platzhalter markiert.
## 2026-08-10 - Card-Hunt-Flyer mit mehr Spannung

- Auftrag: Die zuletzt beruhigte Card-Hunt-Variante weiterentwickeln, weil sie
  zu langweilig wirkt.
- Ziel: Mehr Energie und Charakter durch ein kontrolliertes asymmetrisches
  Raster, eine markante Diagonale und ein starkes Kartenmotiv; keine Deko-
  Ansammlung und kein AI-Slop.
- Stand: ABGESCHLOSSEN.
- Ergebnis: Eine dynamischere Card-Hunt-Variante als beidseitiger A5-Flyer
  erstellt. Die Energie kommt aus einer einzigen Diagonale, einem kontrollierten
  Kartenstapel und klaren Farbkontrasten; QR- und Footerbereich sind sauber
  getrennt. PDF und beide PNG-Seiten wurden gerendert und visuell geprueft.
## 2026-08-10 - Originalen Card-Hunt-Look auf Sportkarten umstellen

- Auftrag: Die vom Nutzer favorisierte uebertriebene Originalrichtung erneut
  verwenden und auf Sportkarten ausrichten.
- Vorgabe: Sportkarten im Text referenzieren; in allen dargestellten Motiven
  ausschliesslich Fussball und American Football verwenden.
- Stand: ABGESCHLOSSEN.
- Ergebnis: Die uebertriebene Original-Pop-Art-Richtung wurde auf Sportkarten
  umgestellt. Der Text referenziert Sportkarten, Sammeln, Tauschen sowie
  An- und Verkauf; die dargestellten Sportmotive sind ausschliesslich Fussball
  und American Football. Die neue PNG-Version wurde separat gespeichert und
  visuell geprueft.
## 2026-08-10 - Sportkarten-Flyer als Vorder- und Rueckseite

- Auftrag: Die Original-Pop-Art-Richtung als beidseitigen Flyer ausarbeiten.
- Vorgabe: Im unteren Textbereich keine einzelnen Sportarten nennen; Fussball
  und American Football duerfen ausschliesslich als Bildmotive erscheinen.
- Stand: ABGESCHLOSSEN.
- Ergebnis: Vorder- und Rueckseite im uebertriebenen Original-Pop-Art-Stil
  erstellt und separat gespeichert. Die unteren Textfelder verwenden nur
  allgemeine Kategorien (Karten, Sammlungen, An- & Verkauf); Fussball und
  American Football erscheinen ausschliesslich als Bildmotive. Beide Seiten
  wurden visuell geprueft.

## 2026-08-11 - A4-Aufsteller fuer Messe gestalten

- Auftrag: Zwei passende A4-Aufsteller aus der vorgelegten Idee entwickeln:
  PayPal-Zahlung mit QR-Code sowie BrandyCards Buy/Sell/Trade.
- Ergebnis: Zwei A4-Aufsteller als getrennte Konzept-PNGs erstellt: PayPal-Zahlung
  mit leerem QR-Code-Feld sowie Buy/Sell/Trade mit Sportkarten-Informationen.
  Die Entwuerfe liegen im Visualisierungsordner; das vorhandene Logo und der
  echte PayPal-QR-Code muessen im finalen Satz noch exakt eingesetzt werden.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - A4-Aufsteller bereinigen und Sportkarten korrigieren

- Auftrag: Die beiden A4-Aufsteller ohne sinnlose untere Textboxen neu setzen.
- Korrektur: Ueberall die Schreibweise "Sportkarten" verwenden, nicht
  "Sportskarten".
- Ergebnis: Beide Aufsteller neu erstellt; dekorative untere Textboxen und Footer-Baender entfernt. Der PayPal-QR-Platzhalter bleibt als einziges funktionales Feld erhalten. Die finalen PNGs liegen im Visualisierungsordner.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - A4-Aufsteller an BrandyCards-Farbwelt anpassen

- Auftrag: Die beiden korrigierten A4-Aufsteller farblich an das BrandyCards-Logo anpassen.
- Ziel: Navy, Rot, Warmweiss und dezente Goldakzente; Layout, Texte und QR-Platzhalter beibehalten.
- Ergebnis: Beide Varianten in einer Navy-Rot-Warmweiss-Gold-Farbwelt neu erstellt und im Visualisierungsordner abgelegt. Der echte Markenlogo- und QR-Code-Einsatz bleibt fuer den finalen Drucksatz austauschbar.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Echtes BrandyCards-Logo in A4-Aufsteller integrieren

- Auftrag: Das vorhandene Logo als echtes Gestaltungselement in beide A4-Aufsteller einbetten, statt den Markennamen nur als Schriftzug zu setzen.
- Ziel: Sinnvolle, logisch platzierte Logo-Positionen bei unveraendertem Text- und Informationsaufbau.
- Ergebnis: Das echte Logo ist beim PayPal-Aufsteller oben als Markenanker und beim Buy/Sell/Trade-Aufsteller unten unter dem CTA als Sign-off eingebettet. Beide PNGs liegen im Visualisierungsordner.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Originales BrandyCards-Logo unveraendert einsetzen

- Auftrag: Die beiden A4-Aufsteller mit der bereitgestellten Original-PNG des Logos ausstatten; keine KI-Neuzeichnung des Logos verwenden.
- Umsetzung: Logo als originale PNG-Ebene ueber die bestehenden Aufsteller gesetzt und die vorherigen kuenstlichen Logoformen abgedeckt.
- Ergebnis: PayPal-Logo oben als Markenanker; Buy/Sell/Trade-Logo unten als klarer Sign-off unter dem CTA. Neue PNGs liegen im Visualisierungsordner.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - A4-Aufsteller ohne Sport- und Kartenmotive neu setzen

- Auftrag: Das bestehende Navy-Rot-Warmweiss-Gold-Basisdesign beibehalten, aber alle sport- und kartenbezogenen Bilder sowie Panel-Layouts entfernen.
- Umsetzung: Zwei abstrakte Hintergruende mit gemeinsamem Logo-Feld oben erstellen und das Original-Logo anschliessend unveraendert technisch einsetzen.
- Ergebnis: Beide PNGs sind abstrakt und typografisch; Sport- und Kartenmotive sowie kartenartige Panels wurden entfernt. Das Original-Logo sitzt im gemeinsamen Kopfbereich, der PayPal-QR-Platzhalter bleibt funktional erhalten.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Logo direkt in abstrakten Flyer integrieren

- Auftrag: Den weissen Kopfstreifen entfernen und das bereitgestellte Original-Logo direkt auf den durchgehenden Flyer-Hintergrund setzen.
- Umsetzung: Bestehendes abstraktes Navy-Rot-Warmweiss-Gold-Basisdesign beibehalten; nur den Kopfbereich integrieren und das Original-Logo unveraendert platzieren.
- Ergebnis: Der weisse Balken ist entfernt. Das Original-Logo sitzt direkt auf dem durchgehenden dunklen Flyer-Hintergrund; Sport- und Kartenmotive bleiben entfernt.
- Stand: ABGESCHLOSSEN.


## 2026-08-11 - Referenzfarbwelt auf bestehende Flyer uebertragen

- Auftrag: Die bestehende abstrakte A4-Flyerbasis in die Schwarz-Dunkelbraun-Gold-Weiss/Creme-Farbwelt der bereitgestellten Referenz uebertragen.
- Umsetzung: Layout und Original-Logo erhalten; nur die Farben der bestehenden Flyer systematisch anpassen.
- Ergebnis: Beide Flyer liegen als neue Referenzfarbwelt-Varianten vor; Schwarz/Dunkelbraun dominiert, Gold ersetzt die roten Akzente, Weiss/Creme bleibt fuer Kontrast. Das Original-Logo wurde erneut unveraendert eingesetzt.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Graded-Slab-Flyer mit Vorder- und Rueckseite erstellen

- Auftrag: Einen Flyer im Stil einer gegradeten Karte als Vorder- und Rueckseite fuer BrandyCards erstellen.
- Umsetzung: Einheitlichen Slab-Rahmen als Basis erzeugen; Original-Logo, exakte Texte und QR-Platzhalter separat und sauber einsetzen.
- Ergebnis: Vorder- und Rueckseite als PNG erstellt. Das Original-Logo ist unveraendert eingebettet; die Vorderseite ist markenorientiert, die Rueckseite enthaelt Buy/Sell/Trade-Informationen und einen neutralen PayPal-QR-Platzhalter ohne Fake-QR.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Slab-Basis in Referenzfarbwelt umsetzen

- Auftrag: Die blanke Slab-Basis aus Bild 1 strukturell unveraendert in die Schwarz-Dunkelbraun-Gold-Farbwelt aus Bild 2 uebertragen.
- Umsetzung: Nur Material- und Flaechenfarben anpassen; keine Texte, Logos oder Flyer-Inhalte einsetzen.
- Ergebnis: Neue blanke Basisdatei mit schwarzem/dunkelbraunem Grund, Goldrahmen und warmen Metallreflexen erstellt. Struktur und Slab-Aufbau bleiben erhalten.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Inneren Label-Rahmen der Slab-Basis entfernen

- Auftrag: Den zusaetzlichen inneren Goldrahmen im oberen Labelbereich der schwarz-goldenen Slab-Basis entfernen.
- Umsetzung: Aeusseren Slab-Rahmen und Grundstruktur erhalten; nur den inneren rechteckigen Labelrahmen ueberdecken.
- Ergebnis: Der komplette innere obere Labelrahmen ist entfernt; der aeussere Slab-Rahmen bleibt als Kontur erhalten.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Slab-Basis mit Plakette und PayPal-QR vorbereiten

- Auftrag: In die markierten Bereiche der bereinigten Slab-Basis eine blanke Goldplakette, den echten PayPal-QR-Code und einen freien Textbereich einsetzen.
- Umsetzung: Farbmarkierungen nur als Koordinaten verwenden; finale Datei ohne gruene, rote oder blaue Markierungen ausgeben.
- Ergebnis: Goldene Metallplakette oben links und echter PayPal-QR-Code oben rechts eingesetzt. Der grosse Hauptbereich bleibt frei fuer den spaeteren Text.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - QR-Feld verkleinern und Goldplakette verfeinern

- Auftrag: Das quadratische QR-Feld verkleinern, die Goldplakette proportional verlaengern und deren Materialwirkung realistischer als gebuerstetes Gold gestalten.
- Umsetzung: Originale Slab-Basis und echter QR-Code beibehalten; nur Plaque und QR-Platzierung anpassen.
- Ergebnis: QR-Feld kleiner und weiterhin quadratisch; Goldplakette laenger angelegt und mit feinen horizontalen Metallreflexen als gebuerstetes Gold gestaltet. Der Hauptbereich bleibt frei.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Dreizeilige Gravur auf Goldplakette setzen

- Auftrag: Die Goldplakette mit drei vorgegebenen Zeilen in schwarzer, leicht vertiefter Gravuroptik beschriften.
- Text: BrandyCards / Cologne Card Con 2026 / Buy · Sell · Trade.
- Ergebnis: Die drei vorgegebenen Zeilen wurden exakt auf der Goldplakette als schwarze, leicht vertiefte Gravur umgesetzt.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Ankaufstext im unteren Textfeld

- Auftrag: Einen kürzeren, professionellen und nahbaren mehrzeiligen Ankaufstext in das große untere Feld der Slab-Grafik setzen.
- Umsetzung: Überschrift in hochwertiger Serifenschrift; Zusatzzeilen in klarer Sans-Serif; warmes Gold und Elfenbein passend zur Schwarz-Gold-Gestaltung.
- Text: KARTEN ZU VERKAUFEN? / Wir kaufen einzelne Karten / und komplette Sammlungen. / Fair bewertet · persönlich & unkompliziert. / Sprich uns gerne an.
- Ergebnis: Text sauber zentriert in einer neuen PNG-Version umgesetzt.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Hochaufloesende Flyer-Version erzeugen

- Auftrag: Die bestehende Slab-Flyer-Grafik in deutlich besserer Aufloesung ausgeben.
- Umsetzung: Vierfache Zielaufloesung; Text neu rasterisieren und QR-Code erneut pixelgenau einsetzen; Layout und Inhalte beibehalten.
- Ergebnis: Hochauflösende PNG-Version mit 2176 x 3240 Pixeln und 300 DPI erzeugt; Texte neu gerastert und QR-Code erneut pixelgenau eingesetzt.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Mittleren Ankaufstext schaerfen

- Auftrag: Die Unschärfe des mehrzeiligen Haupttexts im unteren mittleren Feld korrigieren.
- Umsetzung: Text neu mit klareren Kanten und reduziertem Schatten-/Highlight-Versatz in die hochauflösende PNG-Version rendern.
- Ergebnis: Mittlerer Ankaufstext mit klarerer Arial-Typografie und reduziertem Schatten neu gerendert; Datei weiterhin 2176 x 3240 Pixel bei 300 DPI.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Dezentes Art-deco-Design im Hauptfenster

- Auftrag: Den freien Raum im großen mittleren Textfenster elegant und dezent gestalten.
- Umsetzung: Symmetrische feine Goldornamente, Divider und sehr zurückhaltende Fächerlinien ergänzen; Text, QR-Code und Slab-Rahmen unverändert lassen.
- Ergebnis: Symmetrische, dezente Goldornamente und Fächerlinien in das Hauptfenster integriert; Text, QR-Code und Rahmen unverändert belassen.
- Stand: ABGESCHLOSSEN.

## 2026-08-11 - Fliessende Wellenlinien statt Art-deco-Ornamente

- Auftrag: Das bisherige Art-deco-Design im Hauptfenster durch leichte, parallel verlaufende Wellenlinien nach Referenz ersetzen.
- Umsetzung: Dezente antike Goldlinien als fliessende Wellen oberhalb und unterhalb des Textes; Text, QR-Code und Rahmen unverändert lassen.
- Ergebnis: Das Art-deco-Design ersetzt durch feine, parallel laufende antike Gold-Wellenlinien nach Referenz; Text, QR-Code und Rahmen unverändert.
- Stand: ABGESCHLOSSEN.


## Auftrag 2026-08-12: Webshop erklären
- Status: ABGESCHLOSSEN.
- Ergebnis: Projektstruktur, Technologien, Datenhaltung, Checkout, eBay-Synchronisierung, Authentifizierung und wichtige Dateipfade vollständig lesend untersucht.
- Festgestellt: TypeScript/TSX mit vinext, Next.js App Router und React; Cloudflare Workers, D1, R2, Supabase, PayPal und eBay.
- Änderungen: Nur dieser Übergabevermerk wurde ergänzt; die vorbestehenden Änderungen in app/api/orders/route.ts und lib/paypal/settle-order.ts wurden nicht verändert.


## Auftrag 2026-08-12: Gesamtarchitektur als Architekturschaubild
- Status: LÄUFT.
- Ziel: Die vollständige Webshop-Architektur mit internen Komponenten, Cloudflare-Diensten, externen Integrationen und Datenflüssen als clean strukturiertes Diagramm visualisieren.
- Umsetzung: Visualisierungsfunktion verwenden; keine Produktionsdaten oder Anwendungscodes verändern.


## Auftrag 2026-08-12: Gesamtarchitektur als Architekturschaubild — abgeschlossen
- Ergebnis: Eine clean strukturierte Mermaid-Architekturübersicht erstellt, die Browser, Cloudflare Worker, vinext/Next.js/React, API-Routen, Geschäftslogik, D1, R2, Cron, Supabase, PayPal, eBay, Resend sowie Build/Deployment und Tests verbindet.
- Status: ABGESCHLOSSEN.


## Auftrag 2026-08-12: Architektur als UML-Komponentendiagramm
- Status: LÄUFT.
- Ziel: Die bisherige Architekturübersicht in ein besser lesbares UML-Komponentenmodell und eine kompakte UML-Sequenz für den Kaufablauf überführen.
- Umsetzung: Statische Mermaid-UML-Darstellung; keine Anwendungscodes oder Produktionsdaten verändern.


## Auftrag 2026-08-12: Architektur als UML-Komponentendiagramm — abgeschlossen
- Ergebnis: Eine besser lesbare UML-Komponentendarstellung mit Stereotypen für Akteur, Komponenten, Datenbank, Speicher und externe Systeme sowie eine separate UML-Sequenz für den Kaufablauf erstellt.
- Status: ABGESCHLOSSEN.


## Auftrag 2026-08-13: UML-Architekturdiagramme als PDFs
- Status: LÄUFT.
- Ziel: Das UML-Komponentendiagramm und das UML-Sequenzdiagramm als zwei lesbare PDF-Dateien ausgeben.
- Umsetzung: Vektorbasierte PDFs mit ReportLab unter output/pdf/ erzeugen, rendern und visuell prüfen.


## Auftrag 2026-08-13: UML-Architekturdiagramme als PDFs — abgeschlossen
- Ergebnis: Zwei PDFs erstellt: output/pdf/brandycards_uml_komponentenarchitektur.pdf (UML-Komponentendiagramm) und output/pdf/brandycards_uml_kaufablauf.pdf (UML-Sequenzdiagramm).
- Prüfung: Beide PDFs sind einseitig im A3-Querformat; Rendering erfolgreich; Textpositionen liegen vollständig innerhalb der Seitenränder; zentrale Komponenten und Kaufablaufschritte sind enthalten.
- Aufräumen: Temporäre Builder- und Renderdateien wurden entfernt; die beiden finalen PDFs bleiben unter output/pdf/.
- Status: ABGESCHLOSSEN.


## Auftrag 2026-08-13: Zweites Adminkonto freischalten
- Status: LÄUFT.
- Ziel: rand_sebastian@gmx.de zusätzlich zu p.brand94@googlemail.com als Admin-Adresse konfigurieren.
- Prüfung: Aktuelle Admin-Konfiguration und Worker-Deployment kontrollieren; keine Secrets ausgeben.
- Umsetzung: Produktions-Secret ADMIN_EMAILS nur mit den beiden Allowlist-Adressen aktualisieren und danach die Worker-Konfiguration verifizieren.


## Auftrag 2026-08-13: Zweites Adminkonto freischalten — abgeschlossen
- Ergebnis: Produktives Cloudflare-Secret ADMIN_EMAILS erfolgreich auf p.brand94@googlemail.com,brand_sebastian@gmx.de gesetzt.
- Prüfung: Secret ist vorhanden; https://shop.brandycards.de/ antwortet mit HTTP 200.
- D1-Prüfung: p.brand94@googlemail.com war bereits bestätigter ADMIN; rand_sebastian@gmx.de war noch nicht als Benutzer vorhanden.
- Hinweis: Sebastian muss sich mit rand_sebastian@gmx.de registrieren und die E-Mail bestätigen. Beim ersten authentifizierten Zugriff wird die D1-Rolle automatisch auf ADMIN gesetzt.
- Status: ABGESCHLOSSEN.


## Auftrag 2026-08-13: Korrektur der zweiten Admin-Adresse
- Status: LÄUFT.
- Ziel: rand_sebastian@gmx.net statt der versehentlich eingetragenen .de-Adresse in der produktiven ADMIN_EMAILS-Allowlist setzen; p.brand94@googlemail.com beibehalten.
- Umsetzung: Cloudflare-Secret aktualisieren und Worker-Erreichbarkeit prüfen.


## Auftrag 2026-08-13: Korrektur der zweiten Admin-Adresse — abgeschlossen
- Ergebnis: Produktives Cloudflare-Secret ADMIN_EMAILS erfolgreich auf p.brand94@googlemail.com,brand_sebastian@gmx.net korrigiert; die .de-Adresse ist damit entfernt.
- Prüfung: Secret ist vorhanden; https://shop.brandycards.de/ antwortet mit HTTP 200.
- Hinweis: Sebastian muss sich mit rand_sebastian@gmx.net registrieren und die E-Mail bestätigen. Beim ersten authentifizierten Zugriff wird die D1-Rolle automatisch auf ADMIN gesetzt.
- Status: ABGESCHLOSSEN.


## Auftrag 2026-08-13: Inaktive Karten aus Produktion entfernen
- Status: LÄUFT.
- Ziel: Die aktuell sechs INACTIVE-Karten aus der produktiven D1-Datenbank entfernen.
- Sicherheitsprüfung: Exakte Produkt-IDs sowie Verknüpfungen zu Bestellungen, Bestand, Bildern, eBay-Listings, Preisvorschlägen und Reservierungen vor dem Löschen prüfen.
- Umsetzung: Nur die bestätigten inaktiven Karten und abhängigen Datensätze löschen; anschließend Produktionsdaten lesend verifizieren.


- Zwischenstand: Keine Produktionsdaten gelöscht. Die Abfrage ergab 261 INACTIVE-Produkte insgesamt, davon 7 heute aktualisierte Einträge; zwei inaktive Produkte haben Bestellverknüpfungen. Die sechs heute aktualisierten Einzelkarten sind nicht eindeutig genug, solange der zusätzliche inaktive Bundle-Eintrag nicht ausgeschlossen ist. Löschung wartet auf Bestätigung der exakten sechs Karten.

## Auftrag 2026-08-13: Inaktive Karten aus Produktion entfernen - abgeschlossen
- Ergebnis: Genau sechs bestaetigte INACTIVE-Karten plus das zugehoerige Bundle aus der produktiven D1-Datenbank geloescht.
- Sicherheitspruefung: Alle sieben Produkte hatten keine Bestellungen, Reservierungen, Preisangebote oder offenen Outbox-Jobs; die zugehoerigen eBay-Listings waren ENDED.
- Kaskadenpruefung: Nach der Loeschung verblieben zu diesen sieben IDs 0 Produkte, 0 Bilder, 0 eBay-Listings, 0 Inventory-Eintraege, 0 Preisangebote, 0 Reservierungen und 0 Bestellverknuepfungen.
- Status: ABGESCHLOSSEN.

## Auftrag 2026-08-14: Screenshot-Nachweise fuer alle Xray-Testfaelle
- Status: ABGESCHLOSSEN.
- Ziel: Fuer jeden der 333 vorhandenen Xray-Testfaelle einen verpflichtenden Screenshot-Nachweis je Testschritt und fuer jeden positiven, negativen oder blockierten Fall dokumentieren.
- Rahmen: Keine Testergebnisse erfinden und keine realen Passwoerter oder sonstigen Geheimnisse in Screenshots speichern; vorhandene Stories, Tasks und Tests nicht loeschen.
- Umsetzung: Alle 333 Xray-Testbeschreibungen per Issue-Key-CSV-Update um die Pflicht "Screenshot je Testschritt" erweitert. Testplan KAN-898 und Testausfuehrung KAN-899 enthalten die gleichen Regeln fuer PASS, FAIL und BLOCKED.
- Verifikation: JQL mit dem Screenshot-Marker liefert 333 Testvorgaenge; KAN-565, KAN-600, KAN-700, KAN-800 und KAN-897 stichprobenartig geprueft. Keine Testergebnisse vorweggenommen.
- Sicherheitsregel: Passwoerter, Tokens, Zahlungsdaten und sonstige Geheimnisse muessen vor dem Screenshot maskiert oder geschwaerzt werden.
