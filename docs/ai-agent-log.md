# BrandyCards Agentenprotokoll

## 2026-08-18 - K.A.R.L. bekommt eine Stimme, ohne dass eine Zahl wackelt

Der Betreiber wollte zweierlei: einen persönlicheren Assistenten mit eigener
Persönlichkeit, und eine modernere Oberfläche. Beides ist gebaut. Was hier
steht, ist die Begründung für die Zuschnitte, nicht die Liste der Dateien.

**Die eine Entscheidung, an der alles hängt: Wer formuliert?** Es gab zwei
ernsthafte Wege. Der eine reicht die fertigen Zahlen an ein Modell und lässt es
frei nacherzählen — das klingt am lebendigsten. Der andere lässt die Datenzeilen
unangetastet und setzt nur einen Rahmen darum. Vorgelegt als Wahl, entschieden
hat der Betreiber den zweiten.

Die Begründung, die ihm dabei vorlag und die hier stehen bleiben soll: Ein
Sprachmodell, das aus 147,50 € einen schönen Satz macht, kann daraus „rund
150 €" machen. Dieser Assistent ist von der ersten Zeile an entlang der Linie
gebaut, dass eine fehlende Auskunft besser ist als eine erfundene — er
unterscheidet „nichts da" von „nicht nachgesehen", er nennt zu jeder Zahl Quelle
und Stand, und er weigert sich, eine Menge zu erfinden, die nicht gemeldet
wurde. Ein zweiter Modellaufruf über die fertigen Zahlen hätte genau diese Linie
an ihrer letzten Stelle aufgegeben. **Ein Rahmen dagegen kann nichts
verfälschen, weil er die Zahlen nie zu sehen bekommt.**

Das ist keine Theorie, sondern eine Bauvorschrift: `lib/assistant/persona.ts`
bekommt die Werkzeugergebnisse nur, um *qualitativ* abzulesen, ob etwas
vorliegt, wartet oder ausgefallen ist. Eine Zahl verlässt dieses Modul nicht,
und ein Test in `tests/karl-persona.test.mjs` hält fest, dass Einleitung und
Kommentar keine Ziffer enthalten. Stünde dort eine, stünde dieselbe Zahl zweimal
in der Antwort — und zwei Fassungen derselben Zahl können sich widersprechen.

**Wechselnde Formulierungen ohne Zufallsgenerator.** Abwechslung ist der halbe
Witz an einer Persönlichkeit, aber `Math.random()` macht jede Antwort unprüfbar
und lässt dieselbe Frage zweimal hintereinander grundlos anders klingen. Gewählt
wird deshalb über einen Streuwert aus Frage und Tag: über Fragen hinweg
abwechslungsreich, für dieselbe Frage am selben Tag stabil, und im Test exakt
vorhersagbar.

**Smalltalk endet vor dem Planer, und das war die riskanteste Stelle.** Ein
„danke" soll eine Antwort bekommen statt einer Absage, keinen Modellaufruf
kosten und nicht als unbeantwortete Fachfrage in der Messtabelle landen. Der
teuerste denkbare Fehler dabei wäre die Gegenrichtung: eine echte Fachfrage, die
mit einem Spruch abgespeist wird. Die Erkennung ist deshalb doppelt gesichert —
höchstens sechs Wörter, und kein einziges Fachwort aus einer weit gefassten
Liste. „Na, wie läuft der Verkauf?" fängt an wie Smalltalk und läuft ungebremst
zum Planer durch; sieben solcher Fälle stehen als Test fest. Die Schieflage ist
Absicht: Lieber rutscht ein „hallo" in den Planer, als dass eine Umsatzfrage in
der Witzeschublade endet.

**Zwei Persona-Dateien, und warum das keine Doppelung ist.** Die Stimme der
*Antwort* gehört auf den Server, weil dort die Antwort entsteht — Phase 4 hat
dem Client das Formatieren von Daten ausdrücklich entzogen. Begrüßung beim
Öffnen, Statuszeile und Tippanzeige entstehen dagegen an Stellen, die der Server
nie zu sehen bekommt: Er weiß nicht, dass ein Fenster aufgeklappt wurde. Die
Grenze ist scharf gezogen und in beiden Dateien notiert: **Der Server textet nie
über Bedienelemente, der Client nie über Daten.**

**Die Oberfläche wurde gemessen, nicht behauptet.** Die Änderungen entstanden in
zwei Runden, und die zweite kam aus einem Screenshot der laufenden App. Sie
korrigierte zwei Dinge, die am Reißbrett nicht auffielen: Der Launcher stand mit
Kopf und Namen weiterhin über dem Panel, das seit dieser Fassung dieselbe
Kopfzeile trägt — „K.A.R.L." stand zweimal übereinander. Und die vier
Beispielfragen liefen nebeneinander aus dem 520 Punkte breiten Fenster hinaus;
ein waagerechter Rollbalken für vier Knöpfe ist kein Angebot, sondern ein
Versteck. Jetzt verschwindet der Launcher, solange das Panel offen ist, und die
Chips stehen in Zweierreihen.

**Wie der Screenshot überhaupt zustande kam, denn das ist wiederverwendbar.**
Ein Bildschirmabzug half nicht: Das Fenster liegt neben dem Pet, und aus einem
DPI-unbewussten Prozess stimmen weder Koordinaten noch Größe — der Abzug zeigte
zweimal den Browser des Betreibers statt der App. Was trägt, ist `PrintWindow`
mit `PW_RENDERFULLCONTENT` auf das Fensterhandle, nachdem der messende Prozess
per `SetProcessDpiAwarenessContext(-4)` DPI-bewusst gemacht wurde: Damit rendert
das Fenster sein eigenes Bild in voller Auflösung, auch wenn es verdeckt ist.
Bedient wurde die laufende App über UI-Automation — erst der Launcher über
`AutomationId="AssistantLauncher"`, dann der Chip über seinen Namen. Die Frage
lief dabei gegen den echten Shop und kam mit einer echten Antwort zurück.

**Was dieser Lauf nicht belegt:** Der Rahmen um die Antworten war im Screenshot
nicht zu sehen, weil der Desktop gegen die *ausgerollte* Serverfassung sprach.
Die Serverhälfte ist durch Tests belegt, nicht durch diese Messung — die
Trennung gehört benannt, sonst liest sich der Screenshot als Beleg für mehr, als
er zeigt.

## 2026-08-17 - Rest 1: Zwei falsche Pläne, bevor der richtige übrig blieb

Der Betreiber beauftragte das Wegwerf-Angebot — auf meinen eigenen Vorschlag hin.
Zwischen Vorschlag und Ausführung lag eine Prüfung, und sie widerlegte beide
Entwürfe, die ich für naheliegend gehalten hatte.

**Erstens: Das Wegwerf-Angebot ist keine kleine Sache.** Im Code existiert kein
`AddItem`/`AddFixedPriceItem`; der Schreibpfad kann ausschließlich Mengen
bestehender Angebote ändern. Es hätte eine komplette neue Schreibfähigkeit
gebraucht — Kategorie, Zustand, Artikelmerkmale, Versand- und
Rücknahmerichtlinien —, dazu eine weitere OAuth-Zustimmung, weil
`sell.inventory` kein Einstellen deckt. Und es wäre ein echtes öffentliches
Angebot gewesen, das ein echter Käufer in den Minuten seiner Existenz kaufen
kann; ein vom Verkäufer stornierter Kauf schlägt bei eBay auf den
Verkäuferstatus durch. Ich hatte das als „würde es sofort beweisen" angeboten,
ohne diese Kette zu prüfen. **Ein Vorschlag ist erst dann einer, wenn seine
Kosten geprüft sind — sonst ist er eine Einladung zu einem Fehler, für die man
selbst die Zustimmung eingeholt hat.**

**Zweitens: Der naheliegende Ersatz wäre irreversibel gewesen.** Ein laufendes
Angebot auf 0 setzen und zurücksetzen — klingt sauber, funktioniert aber nicht:
eBay beendet ein Festpreisangebot bei Menge 0, und ein beendetes Angebot lässt
sich nicht revidieren. Genau diesen Zweig behandelt der Code als
`ALREADY_ENDED`. Ohne `AddItem` wäre eines von 291 echten Angeboten dauerhaft
verloren gewesen — und zwar aufgefallen wäre das erst *nach* dem Schreiben.

**Der dritte Entwurf entstand aus einer Zahl, die ich vorher nicht kannte.** Die
Annahme „alle Karten sind Einzelstücke" stimmt fast, aber nicht ganz: sieben
Angebote haben Menge 2, zwei haben 3, und eines hat 6. Damit war ein
nicht-destruktiver Beweis möglich — 6 → 5 → 6 an einem Angebot, das dabei
durchgehend `Active` bleibt und die eBay-Aktivliste nie verlässt. Damit entfiel
auch die Sync-Sorge, die ich zwei Nachrichten vorher noch selbst genannt hatte:
Sie galt nur für die Variante mit Menge 0.

**Der erste Lauf brach ab, und die Reihenfolge war der Grund, dass es harmlos
blieb.** Der lokale `EBAY_REFRESH_TOKEN` stammte von vor der dritten
Zustimmungsrunde und wurde mit `invalid_grant` abgewiesen. Weil der Ablauf mit
dem **Lesen** der Ausgangsmenge beginnt und nicht mit dem Schreiben, war
gewiss — nicht bloß wahrscheinlich —, dass nichts verändert wurde. Bei
umgekehrter Reihenfolge wäre das Ergebnis dasselbe gewesen, aber die Aussage
darüber nur eine Vermutung.

**Der zweite Lauf zeigte es:** Menge 5 bei Status `Active`, danach sauber auf 6
zurück. Nachkontrolle an der Datenbank: `quantity_sold` unverändert 0, und die
Sync-Läufe melden `updated_count: 0` — eBay und Datenbank stimmen überein. Der
Nulldurchgang wäre auch hier sichtbar geworden: Hätte die Wiederherstellung
versagt, hätte der Sync eine 5 geschrieben und der Zähler wäre gestiegen.

**Was bewusst unbewiesen bleibt**, und das gehört zur Redlichkeit dieses
Ergebnisses: dass Menge 0 ein Angebot beendet. Bewiesen ist der Mechanismus,
nicht dieser eine Zahlenwert. In der Produktion ist das Beenden die gewünschte
Wirkung, und der Outbox-Lauf liest die Menge seit heute nach jedem `REVISED`
zurück — der erste echte Verkauf trägt den Rest nach.

**Eine verworfene Abkürzung, die genannt sein soll:** Die einzige Stelle mit
gültigem Token war der Worker. Eine Adminroute, die beliebige eBay-Mengen
setzen kann, hätte den Beweis in Minuten geliefert — und wäre dauerhaft
gefährlicher gewesen als der Beweis wert ist. Produktionscode für einen Testlauf
einzubauen und wieder zu entfernen ist der falsche Handel; den Token in eine
ignorierte lokale Datei zu tragen, war der richtige.

## 2026-08-17 - Punkt 6: Was nicht beweisbar ist, kann man wenigstens bezeugen lassen

Der eBay-Schreibpfad war seit dem 2026-08-08 abgenommen, mit zwei kleinen
Resten. Der erste — fällt die Menge eines **laufenden** Angebots wirklich auf 0?
— ist der wichtigere: Er ist die Richtung, die Doppelverkäufe verhindert. Der
Abnahmetest lief gegen ein bereits beendetes Angebot und konnte ihn nicht zeigen.

**Zuerst der Zustand, dann der Plan.** Die Produktion meldete lesend zwei
Outbox-Aufträge, beide `SUCCEEDED`, den neuesten vom 08.08. Nichts hängt, nichts
ist fehlgeschlagen — aber auch nichts Neues: Seit der Abnahme hat kein
Shop-Verkauf den Pfad berührt. Rest 1 war also nicht durch Warten erledigt
worden, wie man hätte hoffen können.

**Beweisen konnte ich ihn nicht, und das ist eine Grenze, keine Bequemlichkeit.**
Es bräuchte einen echten Verkauf — nicht herbeiführbar — oder ein
Wegwerf-Angebot, also einen Schreibzugriff auf ein Fremdsystem. Der ist
ausdrücklich rücksprachepflichtig, und ihn eigenmächtig vorzunehmen wäre genau
die Art von Eigeninitiative, die in einem Shop mit Einzelstücken teuer wird.

**Also die Frage gedreht: Wenn ich es nicht beweisen kann, kann ich dafür sorgen,
dass der nächste echte Verkauf es von allein bezeugt?** Bisher belegte ein
erfolgreicher Auftrag nur, dass eBay die Anfrage angenommen hat. `Ack: Success`
ist aber nicht dasselbe wie „die Menge steht jetzt auf 0". Nach einem `REVISED`
wird sie deshalb über das vorhandene `getEbayAvailability` zurückgelesen.

**Der eigentliche Gewinn stellte sich dabei als der Gegenfall heraus.** Meldet
eBay Erfolg, während die Menge danach nicht 0 ist, wäre die Karte im Shop
verkauft und dort weiter käuflich — genau der stille Doppelverkauf, dessen
Verhinderung der Sinn dieses Punktes ist. Ohne Nachlesen ist dieser Zustand
unsichtbar: Die Outbox stünde auf `SUCCEEDED`, und niemand hätte einen Anlass
nachzusehen. Aus einer einmaligen Beweisführung wurde damit eine dauerhafte
Kontrolle — das ist mehr wert als der Beweis selbst.

Drei Entscheidungen fielen dabei jeweils gegen die bequemere Variante. `null`
alarmiert nicht, weil „nicht ablesbar" nicht „nicht null" ist — dieselbe Linie,
die `AssistantSalesChannel.available` zieht. Ein Fehlschlag beim Nachlesen wirft
nicht, weil der Auftrag sonst in `RETRY_WAIT` liefe und dieselbe Menge ein
zweites Mal setzte; eine Diagnose darf den Geschäftsvorgang nicht gefährden. Und
nachgelesen wird nur bei `REVISED`, weil bei einem beendeten Angebot nichts mehr
zu prüfen ist und der Trading-Topf geteilt wird.

**Der lehrreichste Fund kam beim Testen und hat mit der Aufgabe nichts zu tun.**
Der erste Testlauf scheiterte an `ERR_UNSUPPORTED_DIR_IMPORT`:
`lib/ebay-outbox.ts` importiert `../db` als Verzeichnis, und Node-ESM kann das
nicht auflösen. Die Datei ist aus den Tests **gar nicht ladbar** — weshalb kein
einziger der fünfzehn Outbox-Tests die Schleife selbst prüft. Sie treffen alle
den Client und das Planmodul. Niemand hat das entschieden; es ist eine
unbemerkte Nebenwirkung der Importform.

Sichtbar wurde es nur, weil ich neue Logik zunächst in die falsche Datei
geschrieben hatte und sie testen wollte. Wäre ich dem Muster der bestehenden
Tests gefolgt, ohne einen eigenen zu schreiben, wäre die Lücke weiter unbemerkt
geblieben — und mein Code mit ihr ungetestet. **Ein Testlauf, der an der
Modulauflösung scheitert, ist deshalb kein Werkzeugärgernis, sondern eine
Aussage über die Architektur.** Die Grenze verläuft in diesem Projekt sichtbar
an der Dateiendung: Testbare Module importieren mit `.ts`, gebündelte ohne.

## 2026-08-17 - Modell-Planer: Ein alter Test hatte recht, aber nicht ganz

Punkt 1 der offenen Assistant-Themen bestand nominell aus einem einzigen
Handgriff: `OPENAI_API_KEY` setzen, und freie Formulierungen funktionieren. Der
Code stand seit Phase 4, getestet bis in die Prompt-Injektionen. Genau solche
Aufgaben sind die verräterischen — es gibt nichts zu bauen, also prüft man
nichts.

**Zwei Vorflugprüfungen, deren Ergebnis „unverändert" war.** Der Modellname
`gpt-5.6-luna` stammte aus einer früheren Sitzung; er ist gültig, beherrscht
`reasoning.effort` und Funktionsaufrufe und kostet 0,20 $ / 1,20 $ je Million
Token — für einen Planer, der nur Werkzeugnamen wählt, die sachlich richtige
Wahl statt der teuren Variante. Und die Responses-API erwartet **flache**
Tool-Definitionen ohne verschachteltes `function`-Feld; das Vertauschen mit der
Chat-Completions-Form ist die häufigste Ursache für „invalid parameter". Der
Code hatte beides richtig. Dass eine Prüfung nichts findet, macht sie nicht
überflüssig — sie war die Voraussetzung dafür, den Betreiber überhaupt einen
Zugang anlegen zu lassen.

**Die Lücke lag im Fehlerfall, und sie war ein Rückschritt in Wartestellung.**
`HybridAssistantPlanner` rief den Modell-Planer ohne Auffangnetz. Ein falscher
Schlüssel hätte damit ein generisches 503 für die ganze Anfrage erzeugt — also
*weniger* Auskunft als der heutige Zustand ohne Schlüssel, der eine erklärende
Antwort liefert. Die Aktivierung hätte das Verhalten verschlechtert, wenn sie
misslingt. Und der Betreiber hätte nicht erkennen können, ob Schlüssel,
Guthaben oder Modellname schuld ist.

**Dann widersprach ein Test aus Phase 5, und das war der lehrreiche Moment.**
Er hieß „der Hybridplaner verschluckt einen Modellfehler nicht" und verlangte
einen durchgeworfenen Fehler. Der erste Reflex — der Test ist veraltet, er muss
weg — war falsch. Hinter ihm stand ein Einwand, den mein Entwurf tatsächlich
verletzte: Ich hatte den Anbieterausfall als `UNSUPPORTED` ausgegeben, also als
„diese Frage ist nicht beantwortbar". Das ist eine Behauptung über etwas, das
nie geprüft wurde. Ob die Frage beantwortbar wäre, war unbekannt.

Diesen Unterschied hält das Projekt an mehreren Stellen sorgfältig auseinander:
`AssistantSalesChannel.available` trennt „null Verkäufe" von „Kanal nicht
gelesen", und die `ASSISTANT_UNAVAILABLE_CODES` unterscheiden „es gibt nichts"
von „ich darf nicht nachsehen" von „ich habe noch nie nachgesehen". Mein Entwurf
hätte genau diese Linie verwischt.

Die Auflösung war deshalb kein Kompromiss, sondern ein dritter Zustand:
`MODEL_FAILED` führt zu `status: "FAILED"` — die Anfrage versinkt nicht in einem
503, der Nutzer bekommt einen brauchbaren deutschen Satz, und trotzdem behauptet
niemand, die Frage sei unbeantwortbar. Der Fehler wird serverseitig mit
Statuscode protokolliert; zum Gerät geht kein Anbieterdetail.

Der Phase-5-Test wurde umgeschrieben, aber mit seiner Begründung daneben: Form
geändert, Absicht behalten. **Ein widersprechender Test ist zuerst ein Zeuge,
nicht ein Hindernis** — hier hat er einen echten Denkfehler abgefangen, und die
Aufgabe wurde dadurch besser gelöst als geplant.

## 2026-08-17 - Härtung: Eine Migration ist erst geprüft, wenn sie echte Daten sah

Der Auftrag stand seit Phase 2 als „vor produktiver Assistant-Nutzung offen" und
nannte drei Punkte: HTTPS-Zielprüfung, DPAPI-Tokenablage, Widerruf/Rotation. Der
erste Schritt war deshalb nicht Bauen, sondern **Nachsehen, was davon noch
stimmt** — eine Notiz aus einer früheren Sitzung beschreibt den Zustand von
damals, nicht den von heute.

Zwei der drei Punkte waren erledigt, ohne dass es jemand nachgetragen hatte:
`claim/route.ts` setzt eine Gültigkeit von 90 Tagen,
`authenticateAvatarDevice` prüft sie, Tokens liegen serverseitig nur als
SHA-256-Hash, und der Widerruf über `revoked_at` wirkt bis in die App, die
daraufhin eine neue Kopplung verlangt. Übrig blieben das Klartext-Token auf der
Platte und die fehlende HTTPS-Pflicht.

**Warum das Klartext-Token heute schwerer wiegt als bei der Notiz.** Damals
öffnete es Lesezugriff auf Geschäftsdaten. Seit demselben Tag, an dem die
Spracherkennung auf Azure umgestellt wurde, berechtigt dasselbe Token
zusätzlich dazu, Sprachtoken auf Kosten des Betreibers ausstellen zu lassen.
Eine Angriffsfläche ist gewachsen, während die Notiz unverändert dastand — das
ist das eigentliche Argument dafür, alte Sicherheitsnotizen nicht nur
abzuarbeiten, sondern **neu zu bewerten**.

**Der lehrreiche Teil war ein Fehler, der beinahe durchgegangen wäre.** Vor dem
ersten Migrationslauf wurde die echte Einstellungsdatei des Betreibers
strukturell gelesen — Feldnamen und Zeichenlängen, nie der Wert selbst. Dabei
fiel auf: Auf der Platte heißt das Feld `DeviceToken` mit großem D, im neuen
Code hieß das Migrationsfeld `deviceToken`. `JsonSerializer` liest ohne
`PropertyNameCaseInsensitive` case-sensitiv. Die Migration hätte also nicht
gegriffen; das vorhandene Token wäre als verloren gewertet worden, und der
Betreiber hätte neu koppeln müssen — ohne eine Meldung, die den Grund nennt.

Bemerkenswert ist, **wodurch** es auffiel: nicht durch einen Test, sondern durch
den Blick auf echte Daten vor dem Eingriff. Ein selbst geschriebenes
Testdokument hätte die Annahme des Autors getragen — camelCase, weil der Autor
camelCase gedacht hat — und den Fehler exakt reproduziert, ohne ihn zu zeigen.
Eine Formatmigration ist deshalb erst geprüft, wenn sie gegen eine **echte** alte
Datei lief. Der Test hält die Schreibweise jetzt fest und verbietet zusätzlich
`PropertyNameCaseInsensitive`, weil eine spätere Ergänzung dieser Option
stillschweigend ändern würde, welche Dateien noch gelesen werden können.

**Zwei Entscheidungen zum Wesen von DPAPI.** Ein Entschlüsselungsfehler wird als
„nicht gekoppelt" behandelt und nicht als Defekt: Eine kopierte Datei auf einem
fremden Rechner *soll* sich nicht öffnen lassen, das ist der Zweck. Und die
zusätzliche Entropie ist kein Geheimnis, sondern eine Zweckbindung — ein
anderswo im Profil abgelegter DPAPI-Wert ist hier nicht verwendbar.

**HTTPS wird verlangt, Loopback bleibt frei.** Über diese Adresse geht das Token
in jeder Anfrage als Kopfzeile hinaus; ein Tippfehler im Schema hätte es
unverschlüsselt auf die Leitung gelegt, ohne sichtbare Folge. Ausgenommen ist
nur Loopback, weil `npm run dev` auf `http://localhost:3000` der in der README
beschriebene Entwicklungsweg ist und dort nichts das Gerät verlässt.

**Ein Nebenbefund wurde mitgenommen, weil er dasselbe Muster hatte:** Die App
verwarf das `expiresAt` der Kopplung und hätte am 90. Tag ohne Ankündigung eine
neue verlangt. Dasselbe stille Brechen wie eine ablaufende Cloud-Testversion —
und derselbe billige Ausweg: den Zeitpunkt speichern und sieben Tage vorher
etwas sagen. Für eine Kopplung, die älter als dieses Feld ist, wird bewusst
nichts behauptet; eine erfundene Frist wäre schlechter als keine.

**Zum Schluss der unscheinbarste, aber notwendige Schritt:** Die vor dem
Migrationslauf angelegte Sicherung enthielt das Token im Klartext. Sie wurde
nach der Verifikation gelöscht. Eine Sicherung, die genau das Geheimnis
preisgibt, dessen Schutz die Aufgabe war, hätte die ganze Arbeit aufgehoben —
und wäre dabei mit dem guten Gewissen einer sorgfältigen Vorsichtsmaßnahme
liegengeblieben.

## 2026-08-17 - Variante 3: Der Test, der 30 Sekunden kostete und drei Wege sparte

Zwei Ausbaustufen hatten die Spracherkennung nicht gerettet. Bevor eine dritte
gebaut wurde, stand deshalb eine andere Frage an: **Ist die Engine schuld oder
das Mikrofon?** Beides hätte dieselben Symptome erzeugt, und für die eine
Antwort wäre jeder Modellwechsel sinnlos gewesen.

Die Probe kostete den Betreiber eine halbe Minute: dieselbe Frage, ins selbe
Textfeld, aber über die Windows-Diktierfunktion (Win+H). Sie lief gut. Damit
waren Mikrofon, Aufnahmeweg und Aussprache in einem Zug ausgeschlossen, und die
Engine war überführt.

**Der Fund lag im zweiten Schritt.** Win+H nutzt nicht die lokale Erkennung,
sondern Azure Speech. Der Test hatte also nicht nur eine Ursache
ausgeschlossen, sondern nebenbei einen Dienst validiert — an dieser Stimme,
diesem Mikrofon, diesem Vokabular. Das ist eine Güte von Beleg, die keine
Anbieterbenchmark liefert: Dort steht, wie ein System auf fremden Testdaten
abschneidet, hier stand, wie es bei diesem Nutzer abschneidet.

Am Gerät ausgelesen, was bis dahin arbeitete: `Microsoft Speech Recognizer 8.0
for Windows (German - Germany)`, die SAPI-Engine aus Windows-7-Zeiten. Kein
neuronales Modell, kein Training an modernen Daten. Rückblickend erklärt das,
warum Variante 2 nichts brachte, obwohl eine geschlossene Grammatik die
Paradedisziplin solcher Engines ist: Wenn selbst die stärkste Maßnahme für eine
Technik nichts bewirkt, ist die Technik das Problem.

**Drei Wege wurden geprüft und zwei verworfen**, jeweils aus einem harten Grund
statt aus Geschmack:

- `Windows.Media.SpeechRecognition` — die frühere „Variante 3" — verlangt
  Paketidentität und ist abgekündigt; Microsoft hat die Windows-Spracherkennung
  durch Voice Access ersetzt. Meine eigene frühere Empfehlung dazu war falsch.
- NVIDIA Canary-1B-v2 ist ein gutes Modell mit unproblematischer Lizenz und
  ~8,4 % WER auf Deutsch. Aber NVIDIA rät von CPU-Betrieb ab, und in diesem
  Notebook steckt eine Intel Iris Xe. Die GGUF-Portierung liefe zwar auf der
  CPU, nennt aber Linux als unterstütztes System.

Azure blieb übrig — und zwar als der einzige Kandidat mit einem Beleg.

**Zwei Dinge machen den Umbau kleiner, als er klingt.** Das Speech SDK braucht
keine Paketidentität; der Blocker, an dem die WinRT-Variante scheiterte,
existiert hier nicht, und der unpackaged Startpfad mit Pet-Overlay bleibt
unberührt. Und `RecognizeOnceAsync()` ist fast formgleich mit dem bisherigen
`Recognize()`, sodass `SpeechTranscriptionResult` seine Form behält.

**Damit tragen beide Vorstufen weiter, statt ersetzt zu werden.** Die 16
Phrasen aus Variante 2 spannen die Erkennung als Phrase List vor — hier
allerdings als Gewichtung statt als geschlossene Grammatik, weshalb die
Konfidenzschwelle entfällt, die es lokal brauchte. Das ausführliche
Ausgabeformat liefert eine N-Best-Liste, über die die Vorauswahl aus Variante 1
unverändert entscheidet. Aus zwei Stufen, die für sich wenig brachten, wird die
Korrekturschicht über einer Engine, die endlich trägt.

**Der Schlüssel bleibt im Worker.** Azure stellt zu einem Abonnementschlüssel
kurzlebige Token aus; der Desktop bekommt nur diese. Das ist dieselbe Trennung
wie beim Modell-Planer aus Phase 4 — der Client kennt weder Zugangsdaten noch
Abrechnung, sondern ein Papier, das von allein verfällt.

**Zwei Entscheidungen, die im Zweifel gegen Bequemlichkeit fielen.** Die Wahl
zwischen online und lokal fällt *vor* dem Zuhören: Ein Rückfall danach nähme
nichts zurück, weil das Gesagte verklungen ist und ohnehin wiederholt werden
müsste. Und ein abgelehntes Token wird als Betreiberproblem benannt, nicht als
Mikrofonfehler — sonst sucht jemand am Headset, während ein Secret falsch steht.

**Aufgegeben wurde dabei eine Zusage aus Phase 3:** Audio verlässt jetzt das
Gerät. Der Betreiber hat das ausdrücklich freigegeben, weil das Projekt privat
läuft und Genauigkeit vorgeht. Das gehört als Entscheidung protokolliert, nicht
als Detail verschwiegen — wer später Datenschutztexte schreibt, muss es wissen.

## 2026-08-16 - Variante 2: die Grammatik gehört dorthin, wo die Regeln stehen

Variante 1 war ausgerollt und nachweislich scharf, als der Betreiber sprechend
prüfte: „absolut schrecklich, aber sie funktioniert prinzipiell". Das ist kein
Fehlschlag, sondern ein Messergebnis. Die Vorauswahl kann nur unter dem wählen,
was SAPI ihr anbietet; enthält keine der fünf Lesarten die gemeinte Frage, hilft
der beste Schiedsrichter nichts. Damit war die Annahme hinter Variante 1
widerlegt — die richtige Lesart ist meist gar nicht dabei — und der Engpass
eindeutig lokalisiert.

**Freies Diktat ist der falsche Betriebsfall.** Eine `DictationGrammar()` spannt
die gesamte deutsche Sprache auf und muss aus Millionen Wortfolgen die
wahrscheinlichste raten. Genau darin ist die alte SAPI-Desktop-Erkennung
schwach. Bekommt sie stattdessen eine geschlossene Liste von Sätzen, wird aus
dem Raten ein Vergleich — das ist der Fall, für den die Engine gebaut wurde.

**Die eigentliche Schwierigkeit war nicht die Grammatik, sondern ihr Ort.** Die
Fragemuster liegen bereits im serverseitigen Planer. Sie im Desktop noch einmal
hinzuschreiben, wäre die Doppelpflege gewesen, die Phase 4 abgeschafft hat —
und sie wäre schlimmer als die alte: Zwei Listen, die auseinanderdriften,
erzeugen Fragen, die der Nutzer perfekt ausspricht und trotzdem nicht
beantwortet bekommt. Der ärgerlichste denkbare Fehler.

Die Phrasen stehen deshalb in `ASSISTANT_SPEECH_PHRASES` neben den Planerregeln
und werden über die bestehende `GET`-Route mitgeliefert; ein neuer Pfad
entstand nicht. Zusammengehalten werden beide Seiten **durch einen Test, nicht
durch Disziplin**: Jede ausgelieferte Phrase muss durch den
`RuleBasedAssistantPlanner` laufen und mindestens ein Werkzeug treffen. Eine
Phrase, die er nicht versteht, macht die Suite rot. Zusätzlich wird verlangt,
dass die Grammatik mindestens zehn der zwölf Werkzeuge erreicht — eine
Grammatik, die nur zwei Ecken abdeckt, verengte den Suchraum auf den falschen
Ausschnitt.

**Beide Grammatiken laufen nebeneinander, und das ist Absicht.** Eine
geschlossene Grammatik kennt nur ihre Sätze; alles andere presst sie in den
nächstgelegenen. Das freie Diktat bleibt deshalb geladen und fängt auf, was
nicht vorgesehen war. Ein Grammatiktreffer wird den Diktatlesarten nur
oberhalb einer Konfidenzschwelle vorgezogen — sie trennt „das war eine dieser
Fragen" von „das war es nicht, hier ist die ähnlichste". Der Startwert 0,5 ist
ausdrücklich geraten und gehört am Gerät nachjustiert; eine ehrlichere Zahl gibt
es vor dem ersten echten Sprechen nicht.

Die beiden Schichten greifen dabei ineinander: Grammatiktreffer kommen in der
Kandidatenliste nach vorn, und darüber entscheidet weiterhin die Vorauswahl aus
Variante 1. Variante 1 wurde damit nicht ersetzt, sondern bekommt bessere
Kandidaten.

**Der Nebenbefund war die halbe Erklärung wert.** `SelectRecognizer()` fällt
notfalls auf irgendeinen installierten Erkenner zurück — auf einem Gerät ohne
deutsche Sprachfunktion also auf einen englischen, stillschweigend. Die
Statusmeldung nennt die verwendete Sprache jetzt. Zugleich wird die deutsche
Grammatik einem nichtdeutschen Erkenner gar nicht erst untergeschoben:
`GrammarBuilder` und Erkenner müssen dieselbe Kultur haben, sonst wirft schon
das Laden.

**Nebenbei hat die Prüfung ihren eigenen Wächter bestätigt.** Beim Durchmessen
aller 16 Phrasen über die echte Route antworteten die letzten acht mit 429. Die
Ratenbegrenzung greift also wirklich — und das ist genau der Grund, aus dem
Variante 1 alle Kandidaten in einer einzigen Anfrage prüft statt in fünf.

## 2026-08-16 - Variante 1: der Planer entscheidet, welche Lesart gemeint war

Die Spracheingabe war „etwas ungenau". Das Mikrofon war es nicht, die
Erkennersprache auch nicht — beides hatte Phase 10 schon ausgeschlossen. Übrig
blieb die blanke `DictationGrammar()` von `System.Speech`: freies Diktat, das
Fachvokabular schlecht trifft. Die Fragen an diesen Assistenten bestehen aber
aus fast nichts anderem.

Der Ansatz nutzt aus, dass die Erkennung ihre Unsicherheit **kennt und
ausweist**. `RecognitionResult.Alternates` trägt weitere Lesarten desselben
Diktats, nach Konfidenz sortiert; genommen wurde bisher blind die erste. Die
zusätzliche Information lag also schon vor, sie wurde nur weggeworfen.

Wer entscheidet, ist der Punkt. Ein zweites Erkennungssystem danebenzustellen
hieße, dieselbe Frage noch einmal falsch beantworten zu können. Der Planer
dagegen weiß etwas, das kein Erkenner weiß: **welche Sätze überhaupt eine Frage
sind, die dieses System beantworten kann.** Zwölf Werkzeuge decken einen
winzigen Ausschnitt des Deutschen ab. Eine Lesart, die dort landet, ist mit
hoher Wahrscheinlichkeit die gemeinte — und eine, die nirgends landet, war als
Frage ohnehin wertlos. Das ist der ganze Gedanke: Die Domäne ist so klein, dass
Zuordenbarkeit selbst zum Erkennungssignal wird.

**Drei Entscheidungen, die der Entwurf offengelassen hatte.**

*Eine Anfrage statt einer je Kandidat.* Der Arbeitsvorrat sah bis zu fünf
Prüfaufrufe vor. Die Ratenbegrenzung liegt bei zehn Anfragen je Minute und wird
mit der eigentlichen Frage geteilt — fünf Prüfungen plus eine Frage wären sechs
davon für **eine** gesprochene Frage gewesen. Alle Kandidaten gehen deshalb
gemeinsam hinaus; es bleiben zwei Anfragen. Die Kosten der Grenze bestimmen
hier den Zuschnitt der Schnittstelle, nicht umgekehrt.

*Nur der Regelplaner prüft.* Der Hybrid-Planer darf je Frage 15 Sekunden ans
Modell geben. Fünf Kandidaten wären im schlechtesten Fall über eine Minute
Wartezeit **vor** der eigentlichen Frage, dazu fünf bezahlte Aufrufe — für eine
Vorauswahl, die auch danebenliegen kann. Der Modellpfad bleibt deshalb der
eigentlichen Frage vorbehalten. Der Preis dafür ist bekannt und klein: Eine
Lesart, die nur das Modell verstünde, wird nicht vorgezogen.

*Auswählen, nicht diktieren.* Die Prüfung liefert einen Text zurück, und dieser
Text würde anschließend als Frage gestellt und im Panel als eigene Eingabe
angezeigt. Zwischen Desktop und Shop steht im Ernstfall ein fremder
Zwischenknoten. Übernommen wird deshalb nur ein Wert, der **wörtlich einer der
gesendeten Lesarten** entspricht.

**Was die Prüfung nicht darf: die Frage verhindern.** Sie ist eine
Verbesserung, keine Voraussetzung. Netzfehler, 429, Zeitüberschreitung,
unlesbare Antwort — jeder dieser Fälle endet im ersten Kandidaten und damit im
bisherigen Verhalten. Deshalb fängt `SelectCandidateAsync` alles ab und wirft
nichts; deshalb ist ihr Zeitrahmen mit acht Sekunden deutlich kürzer als die
dreißig der Frage. Was sie an Zeit verbraucht, wartet der Nutzer zusätzlich.

**Ein Wächtertest schlug an, und das war richtig so.** Phase 8 hält als
Gleichheitsprüfung fest, welche Pfade der Desktop nach außen anspricht — genau
einen. Die neue Prüfroute ließ ihn rot werden. Nachgezogen wurde die Liste, nicht
die Prüfung: Sie ist weiterhin eine Gleichheit, jetzt über zwei Pfade, und ein
dritter fällt weiter auf.

**Belegt ist die Entscheidung, nicht die Trefferquote.** An der echten
HTTP-Route mit echtem Gerätetoken (lokal, danach entfernt): Liegt die erste
Lesart daneben und die zweite trifft, kommt `selectedIndex: 1` zurück; trifft
keine, kommt `null` — es wird nichts erraten. Ob im Alltag oft genug eine
passende Lesart dabei ist, zeigt aber erst das Sprechen. Diese Zahl ist mit
keinem Test zu haben.

## 2026-08-16 - Phase 10: Der Assistant war nie produktiv erreichbar

Der Auftrag lautete, den Desktop-Pet produktiv zu verifizieren. Die erste
Frage — „Was habe ich zuletzt verkauft?" — kam mit HTTP 503 zurück. Die
zweite auch, und die fünf danach ebenfalls. Der Ausgangsstand nannte den
Assistenten „bis Phase 9 produktiv ausgerollt" und „keine offenen
Produktionsfehler bekannt". Beides stimmte nicht, und der Grund dafür ist
lehrreicher als der Fehler selbst.

**Die Eingrenzung dauerte drei Anfragen.** `GET` ohne Token: 401. `GET` mit
Token: 503. Damit war die Sache entschieden, bevor irgendein Orchestrator im
Spiel war: Zwischen „kein Token" und „Token vorhanden" liegt genau ein Schritt,
und das ist der Datenbank-Lookup in `authenticateAvatarDevice`. Der
`POST`-Pfad bestätigte es von der anderen Seite — selbst ein falscher
Content-Type, der eigentlich 415 ergeben müsste, kam als 503 zurück. Beide
Prüfungen liegen *hinter* `authorize()`, also war schon davor Schluss.

Die Produktionsdatenbank sagte den Rest:

```
PRAGMA table_info(avatar_device_tokens) → id, token_hash, label, created_at, revoked_at
```

Fünf Spalten. Das Schema kennt neun. Es fehlen `scopes`, `pairing_id`,
`created_by_user_id` und `expires_at` — exakt die vier aus Migration `0011`.
`0010` war eingespielt, `0011` nicht. Drizzle wählt `scopes` mit ab, D1
antwortet `no such column: scopes`, und die Route macht daraus pflichtschuldig
ihr generisches „Der freie Assistant ist gerade nicht verfügbar."

**Warum das neun Phasen lang niemandem auffiel.** Die Phasen 5 bis 9 waren
gründlich — 504 Tests, Prompt-Injektionen, gemessene Read-only-Zusicherung,
Timeout-Nachweis mit echter Wartezeit. Nur lief alles davon gegen Testdoppel
und lokale Datenbanken. Produktiv verifiziert wurden die *Daten*: `SELECT` auf
`ebay_read_syncs`, 133 Verkäufe, vier Quellen auf `OK`. Das ist die Hälfte, die
funktionierte. Die andere Hälfte — kommt eine Frage vom Desktop bis zu diesen
Daten durch? — wurde nie gestellt.

Dieselbe Falle steht seit Langem in CLAUDE.md, nur mit anderen Namen: „`/` und
`/api/products` waren durchgehend gesund, während `/admin` kaputt war." Hier
waren es `/` und `/api/products` gegen `/api/avatar/device/*`. Der Satz galt
schon, er wurde nur auf die falsche Route angewendet.

**Und warum der Pet trotzdem harmlos aussah.** Der Ereignisabruf benutzt
denselben Lookup und antwortet ebenfalls 503. Ein Pet ohne Ereignisse zeigt
seine Leerlaufschleife. Genau dieselbe Verwechslung, die Phase 8 für die
eBay-Quellen aufgelöst hat — „keine Nachrichten" gegen „keine Verbindung" —
existierte hier noch eine Ebene tiefer, im Desktop-Client selbst: Ein Pet, das
sich bewegt, sagt nichts darüber aus, ob es den Shop erreicht.

**Der Fehler blieb stehen.** Eine Remote-Migration war in diesem Auftrag
ausgeschlossen, und der Eingriff wäre eine Zeile gewesen. Die Versuchung, „das
ist doch nur ein ALTER TABLE" zu denken, ist bei genau der Art Grenze am
größten, die es zu respektieren gilt. Der Befehl steht im Übergabeprotokoll.

**Stattdessen wurde der Beweis lokal geführt.** Alle vierzehn Migrationen in
eine lokale D1, zwei Gerätetoken — einer mit `ASSISTANT_READ`, einer nur mit
`EVENTS` —, Prüfdaten für jede geforderte Frage. Neun Fragen, neunmal 200,
neunmal `ANSWERED`. Damit ist der Satz belegbar, auf den es ankommt: Es fehlen
die Spalten, nicht die Funktion. Ein „müsste eigentlich gehen" wäre hier
wertlos gewesen.

**Der Datenschutznachweis wurde umgedreht.** Nicht „die Werkzeuge wählen keine
Kundenspalten aus" (das lässt sich im Code nachlesen und beweist nichts über
die Antwort), sondern: Die Prüfbestellung bekam eine E-Mail-Adresse, einen
Namen, eine Straße, eine Postleitzahl und eine Telefonnummer in genau jene
Spalten, und jede Antwort wurde gegen diese sechs Zeichenketten geprüft. Null
Treffer. Dazu ein Test, der die Spaltennamen im Quelltext festnagelt — mit
einer benannten Ausnahme: `sales.ts` wählt `avatarEvents.payload` aus, gibt ihn
aber nur an `ebayEventQuantity` und übernimmt ihn in kein DTO. Eine Ausnahme,
die im Test steht, ist eine Entscheidung; eine, die nur im Code steht, ist ein
Zufall.

**Zum Planer gab es wenig zu härten und viel zu belegen.** `OPENAI_API_KEY`
fehlt produktiv, also lief nie etwas anderes als der deterministische Planer.
Die Härtung besteht deshalb aus Fällen, in denen eine Modellantwort *fast*
richtig aussieht: `arguments` als Objekt statt als String, `"null"`, `"[1,2]"`,
ein `days` von 91 trotz `strict: true`, und Namen dicht neben echten —
`New_Orders`, `" new_orders"`, `constructor`, `__proto__`. Der letzte Punkt ist
der einzige mit echtem Zahn: `parseOpenAIPlannedTools` prüft gegen
`ASSISTANT_TOOL_NAMES.includes`, nicht gegen Objektzugehörigkeit, sonst wäre
`__proto__` ein gültiger Schlüssel gewesen.

Bewusst *nicht* geändert wurde, dass `HybridAssistantPlanner` einen Modellfehler
weiterreicht. Das Phase-5-Protokoll begründet es ausdrücklich: Die Route macht
daraus ein 503 statt einer erfundenen Antwort. Ein Fehler, der als solcher
ankommt, ist besser als einer, der zu einer Auskunft geglättet wird — und eine
dokumentierte Entscheidung kippt man nicht nebenbei in einer Prüfphase.

**Nachtrag am selben Tag: die Migration wurde freigegeben und eingespielt.**
Der Ereignisabruf sprang von 503 auf 200, der Assistant von 503 auf 401. Der
zweite Wert ist die interessante Zahl: Beide produktiven Tokenzeilen stammen
vom 2026-08-15 und damit aus der Zeit vor dem Scope-Konzept. `ALTER TABLE ADD
COLUMN scopes ... DEFAULT '["EVENTS"]'` gibt ihnen genau das — und nichts
weiter. Der Kommentar in `0011` hatte diesen Fall vorweggenommen: Ein alter
Ereignistoken erbt keinen Zugriff auf Geschäftsdaten.

Das ist die richtige Vorgabe, und sie kostet den Betreiber einen Kopplungsvorgang.
Die naheliegende Abkürzung — ein `UPDATE` auf die bestehende Zeile — wurde
nicht genommen. Sie hätte in einer Minute funktioniert und dabei die einzige
Schutzabsicht dieser Migration stillschweigend zurückgenommen. Ein
Sicherheitsstandard, der beim ersten eigenen Umweg umgangen wird, ist keiner.

Bemerkenswert bleibt, dass der Ausfall die Kopplung selbst mit umfasste: Der
Claim-Pfad schreibt `scopes`, `pairing_id`, `created_by_user_id` und
`expires_at` und wäre an denselben fehlenden Spalten gescheitert. Wer nach dem
Ausfall versucht hätte, das Problem durch Neukoppeln zu lösen, hätte ein
zweites 503 bekommen — und vermutlich den Desktop verdächtigt.

**Der produktive Durchlauf fand dann noch einen Fehler — im Prüfskript, und
dahinter einen echten.** Nach dem Neukoppeln kamen fünf der sieben Fragen sauber
zurück, zwei als `UNSUPPORTED`. Der erste Verdacht war der Planer; die Ursache
war, dass ich „Verkaeufe" und „Preisvorschlaege" ohne Umlaute in die Fragedatei
getippt hatte. Beide Fragen mit Umlaut nachgestellt: beantwortet.

Damit hätte man es auf sich beruhen lassen können. Die Gegenprobe war trotzdem
die Mühe wert, denn sie zeigt einen Befund, den ich sonst als eigenen Fehler
abgehakt hätte: `normalizeQuestion` zerlegt nach NFD und entfernt Diakritika,
macht also aus `ä` ein `a`. Die deutsche Ersatzschreibung `ae` ist aber keine
Diakritik, sondern zwei Buchstaben — „verkaeufe" enthält kein „verkauf" und
trifft kein einziges Schlüsselwort. Wer ohne deutsche Tastatur tippt, bekommt
vom Assistenten ein Achselzucken.

Das wiegt schwerer, als es klingt, weil der Regelplaner mangels
`OPENAI_API_KEY` derzeit der *einzige* Planer ist. Ein Modell hätte „Verkaeufe"
mühelos verstanden; der Fallback muss jede Formulierung selbst treffen. Genau
deshalb ist die naheliegende Reparatur auch die falsche: `ue → u` würde „neue"
zu „neu" machen, und „neue anfrage" träfe nicht mehr. Die gefaltete Fassung
gehört *neben* die ursprüngliche, nicht an ihre Stelle — dann kann eine
Ersetzung nur Treffer hinzufügen und keinen wegnehmen.

**Nachtrag: auf Zuruf umgesetzt.** `foldUmlautDigraphs` faltet `ae`/`oe`/`ue`,
und der Regelplaner sucht gegen beide Fassungen. Der Gewinn reicht über die
zwei gemeldeten Fragen hinaus, weil die Suchbegriffe ohnehin in der
diakritikfreien Form dastehen: „verfuegbar", „uebersicht", „haeufigsten",
„nachfuellung", „ruecknahmen", „erloes" treffen jetzt alle. Das war kein
Zufallsfund, sondern die Folge davon, dass NFD und Ersatzschreibung dasselbe
Ziel haben und nur auf verschiedenen Wegen dorthin kommen.

Beim Schreiben ging der Kommentar daneben: Er behauptete, „neue" werde zu
„nu". Es wird zu „neu" — ein `ue`, nicht zwei. Der Test hat es beim ersten Lauf
gefangen. Das Argument trägt weiterhin, denn auch „neu anfrage" trifft
`neue anfrage` nicht; falsch war nur das Beispiel. Erwähnenswert ist es, weil
ein Kommentar mit den falschen Buchstaben schlimmer ist als keiner: Der
nächste Leser prüft ihn nicht nach, er glaubt ihn.

Ausgerollt als Worker-Version `7201bbd4-eb97-4c94-854a-56b7db817be4`. Der
`wrangler deploy` selbst wurde von der Berechtigungsprüfung dieser Sitzung
abgewiesen und vom Betreiber ausgeführt; der Build davor lief ausnahmsweise aus
dem Worktree, weil das Hauptverzeichnis fremde unversionierte Änderungen trug.
Die Regel „nie aus einem Worktree bauen" zielt auf die nicht vererbte
`.env.local` — deshalb wurde nicht nur das lokale `dist/` geprüft, sondern das
**ausgelieferte** Bundle: `GET /assets/i18n-Cf04_SOV.js` enthält `supabase.co`,
und `/admin` meldet „Nicht authentifiziert" statt „Supabase ist noch nicht
konfiguriert". Eine Regel durch die Prüfung zu ersetzen, die sie erzwingen
soll, ist nur dann zulässig, wenn man die Prüfung auch wirklich macht.

Die Abnahme bestätigte beides: „Wie viele **Verkaeufe** …" liefert jetzt
dieselbe Antwort wie die Fassung mit Umlaut — gleiche Werkzeuge, gleiche
Zahlen, gleicher Datenstand. Und „Erzähl mir einen Witz über Sammelkarten"
bleibt `UNSUPPORTED`. Der zweite Teil ist der wichtigere: Eine Faltung, die
Treffer erfindet, wäre schlimmer als die Lücke, die sie schließt.

**Die Ratenbegrenzung brauchte zwei Anläufe.** Vierzehn Anfragen nacheinander
liefen sämtlich durch, obwohl die Grenze bei zehn pro Minute liegt. Vierzig
gleichzeitige ergaben 34 × 429. Cloudflares Zähler ist ausdrücklich als
näherungsweise dokumentiert; bei langsamer Folge greift er unzuverlässig, unter
Last greift er. Wer ihn mit einer Handvoll Anfragen prüft und dann „wirkungslos"
notiert, hat das Gegenteil gemessen.

## 2026-08-16 - Phase 9: Warum ein Verkauf anders gespeichert wird als eine Aufrufzahl

Phase 8 hat eine Bauweise etabliert, die gut funktioniert: abrufen, alles mit
demselben Stempel schreiben, alles mit abweichendem Stempel löschen. Zweimal
derselbe eBay-Inhalt ergibt denselben Tabelleninhalt. Für die Verkaufshistorie
wäre genau diese Bauweise ein Datenverlust gewesen.

**Der Unterschied liegt in der Bedeutung von „eBay meldet es nicht mehr".** Bei
Aufrufzahlen, Postfach und Preisvorschlägen heißt das: gilt nicht mehr. Ein
zurückgezogener Preisvorschlag *ist* weg. Bei einem Verkauf heißt es: aus dem
90-Tage-Fenster gerutscht. Der Verkauf hat trotzdem stattgefunden. Hätte
`syncSales` gelöscht wie seine drei Geschwister, wäre die Historie bei jedem
Lauf auf das Abfragefenster zurückgeschnitten worden — und zwar lautlos, weil
eine Übersicht „letzte 90 Tage" auch dann plausibel aussieht, wenn ihr der
hintere Teil fehlt. Die Verkaufstabelle wird deshalb als einzige nur
fortgeschrieben, nie geleert; ein Test hält fest, dass es zu ihr kein
`db.delete` gibt.

**Der Umsatz war die zweite Falle, und sie ist rein arithmetisch.** eBay legt
den Bestellbetrag auf jeden Posten der Bestellung, weil sich Versand und
Steuern nicht nach einem mitgelieferten Schlüssel aufteilen lassen. Wer die
Posten summiert, zählt eine Bestellung mit drei Karten dreifach. An echtem SQL
nachgemessen: über Bestellungen eindeutig gemacht 4 500 Cent, naiv über Posten
9 000. **Beide Zahlen sehen aus wie ein Umsatz.** Nur eine ist einer.

**Eine Zahl ohne Bezugsgröße ist keine Auskunft.** „Umsatz" kann brutto oder
nach Gebühren heißen, mit oder ohne Versand — die Antworten liegen bei diesem
Sortiment gut zehn Prozent auseinander. Die Fulfillment-Antwort nennt die
eBay-Gebühren nicht vollständig, eine Netto-Zahl wäre also geraten. Der
Datensatz führt deshalb ein Feld `revenueBasis`, dessen Inhalt in jede Antwort
mit hineingeht: brutto, inklusive vom Käufer getragenem Versand, vor Gebühren.

**Und die Fortsetzung von Phase 8s Grundgedanken:** Fehlt die eBay-Hälfte,
entsteht keine Gesamtsumme. Die Shop-Zahlen stehen trotzdem da, die eBay-Zeile
nennt den Grund. Eine addierte Zahl, der ein ganzer Verkaufskanal fehlt, wäre
schlimmer als eine fehlende — sie sähe vollständig aus, und niemand sähe ihr an,
dass sie es nicht ist. Dasselbe gilt bei gemischten Währungen.

**Der Planer musste eine Frage lernen zu unterscheiden.** „Was habe ich zuletzt
verkauft?" und „Was habe ich in den letzten 30 Tagen verkauft?" enthalten
dasselbe Wort. Die neue Regel steht deshalb *vor* `latest_sale` und greift nur
bei einem genannten Zeitraum oder dem Wort Umsatz. Zusätzlich braucht die
Übersicht einen zweiten Parameter: `requestedLimit` hätte aus „30 Tagen" die
Zahl 30 gelesen, sie auf 20 gedeckelt und daraus einen Zeitraum von drei Wochen
gemacht — eine falsche Antwort, die niemandem auffällt.

## 2026-08-16 - Ein leeres Ereignisprotokoll sieht aus wie ein falscher Verkauf

Der Betreiber sagte, er habe gestern verkauft; `latest_sale` nannte den 09.08.
Beide hatten recht. Die Abfrage liest Shop-Bestellungen **und** eBay-Verkäufe,
letztere aber aus `avatar_events` — und diese Tabelle war leer, weil der Code,
der sie füllt, erst am selben Tag entstand. Der Verkauf war korrekt verbucht:
Angebot beendet, Bestand abgebucht, Karte inaktiv. Nur die Spur, aus der der
Assistent liest, gab es zum Zeitpunkt des Verkaufs noch nicht.

**Das ist die unangenehmste Sorte Fehler, die dieses Projekt kennt:** eine
Antwort, die plausibel ist und kein Warnschild trägt. Phase 8 hat für die
eBay-Quellen genau dagegen gebaut — `ebay_read_syncs` unterscheidet „nichts da"
von „nicht nachgesehen". `latest_sale` hat kein Gegenstück dazu. Es kann nicht
sagen „ich kenne eBay-Verkäufe erst ab heute", weil es das selbst nicht weiß.

**Rückwirkend füllbar war es, weil die Rohmeldungen noch liegen.**
`webhook_events` hebt jede eingegangene eBay-Meldung im Original auf — das war
für Deduplizierung und Nachvollziehbarkeit gedacht und trug hier eine zweite
Frucht: Aus sechs gespeicherten `ORDER_CONFIRMATION`-Meldungen ließen sich die
fehlenden Ereignisse nachbilden, ohne eBay noch einmal zu fragen. Wer Rohdaten
aufhebt, kann später Fragen beantworten, die beim Speichern noch niemand
gestellt hat.

**Fünf statt sechs, und das ist richtig so.** Zum Verkauf vom 13.08. existiert
kein Angebot mehr — die Bereinigung desselben Tages hat es entfernt. Ein
Ereignis darauf zu erfinden hieße, einen Fremdschlüssel ins Leere zeigen zu
lassen; der Live-Handler überspringt unbekannte Angebote aus demselben Grund.
Die Lücke ist dokumentiert statt gefüllt.

**Zur Quellenfrage.** „Über den Shop oder direkt von eBay?" trennt Transport
von Herkunft. Die Meldungen *sind* eBays Daten, signaturgeprüft und
unverändert; der Shop war nur der Briefkasten. Ein Live-Abruf hätte mehr
gebracht — Verkäufe vor dem 09.08. und die Beträge — und dafür einen Scope
verlangt, den die Zustimmung nicht enthält. Der Unterschied ist also nicht
„echter" gegen „abgeleitet", sondern „vollständiger" gegen „sofort verfügbar".

## 2026-08-16 - Die Rechteliste sichtbar setzen, statt sie zu verstecken

Phase 8 hat den Analytics-Scope bewusst *nicht* in `wrangler.toml` geschrieben,
und `tests/assistant-phase8.test.mjs` hielt genau das fest: Die Variable durfte
dort nicht vorkommen. Der Betreiber hat die Freischaltung heute ausdrücklich
angefordert — damit ist die Bedingung des Tests erfüllt, aber seine Prüfung
falsch geworden.

**Der naheliegende Weg wäre der schlechtere gewesen.** `wrangler secret put
EBAY_OAUTH_CONSENT_SCOPES` hätte sofort gewirkt, keinen Deploy gebraucht und
keinen Test angefasst. Der Test wäre grün geblieben *und hätte gelogen*: Er
behauptet etwas über die Produktionskonfiguration, das er an `wrangler.toml`
allein nicht mehr sehen kann. Eine Rechteliste ist außerdem kein Geheimnis —
der Token ist eins. Sie zu den Secrets zu legen, hieße: Niemand kann mehr
nachlesen, was der Knopf „eBay verbinden" eigentlich anfragt.

Also steht die Liste jetzt sichtbar in `[vars]`, und die Prüfung wurde
**schärfer statt weicher**: nicht mehr „die Variable fehlt", sondern „sie
enthält genau diese zwei Scopes". Das alte `doesNotMatch` hätte einen dritten,
später angehängten Scope nur so lange bemerkt, wie überhaupt keiner dastand;
die neue Gleichheitsprüfung bemerkt ihn immer. Der eigentliche Schutz — keine
*stille* Ausweitung — bleibt damit erhalten, obwohl die Ausweitung stattfand.

**Wirksam ist die Zeile noch nicht, und das ist keine Nachlässigkeit.** Ein
ausgestellter Refresh-Token trägt die Scopes seiner Entstehung; anheften lässt
sich keiner. Bis der Kontoinhaber die Zustimmung erneut durchläuft, bleibt der
alte Token gültig und die Aufrufzahlen melden weiter `SCOPE_NOT_GRANTED` — die
richtige Antwort, nicht ein Fehler.

**Nachtrag: die Sperre löschen, nicht zurückdatieren.** Nachdem der neue Token
lag, hielt `ebay_read_syncs` die Aufrufzahlen noch sechs Stunden zurück — die
Wartezeit nach `SCOPE_NOT_GRANTED`, die gegen sinnloses Dagegenlaufen gedacht
war und nun der frischen Zustimmung im Weg stand. Der geplante Griff
(`last_attempt_at = NULL`) scheiterte: Die Spalte ist `NOT NULL`, obwohl der
Typ `EbayReadSyncRow` sie als `string | null` führt. **Der Typ beschreibt, was
die Prüffunktion verträgt, nicht was die Tabelle zulässt** — beides sah gleich
aus und war es nicht.

Statt zurückzudatieren wurde die Zeile gelöscht. Ein alter Zeitstempel hätte
einen Versuch behauptet, den es nie gab; eine fehlende Zeile sagt die Wahrheit,
gilt in `isEbayReadSyncDue` sofort als fällig, und der Upsert legt sie beim
nächsten Lauf richtig an. Drei Minuten später: `OK`, 277 Angebote, 1 670
Aufrufe im 30-Tage-Fenster. Der Umweg war der bessere Weg.

**Nebenbefund, der die eigentliche Lehre trägt:** Die Prüfung an der
Produktionsdatenbank zeigte Phase 8 als ausgerollt — Migration `0012`
angewendet, `ebay_read_syncs` mit `OK` für Postfach und Preisvorschläge —,
während das Übergabeprotokoll dieselben Schritte noch als „nicht ausgeführt"
führte. Der Deploy geschah nach dem letzten Commit und wurde nirgends
nachgetragen. Ein Protokoll, das hinter der Wirklichkeit zurückbleibt, ist
schlimmer als keines: Es lädt die nächste Sitzung dazu ein, einen bereits
erledigten Schritt noch einmal zu tun. Deshalb steht der Rollout jetzt im
Phase-8-Eintrag, mit Versionskennung und Uhrzeit.

## 2026-08-16 - Phase 8: drei eBay-Quellen, von denen eine nicht liefern darf

Phase 8 sollte drei Fragen beantwortbar machen: Aufrufzahlen, neue
eBay-Nachrichten, Käufer-Preisvorschläge. Zwei davon gehen. Die dritte geht
nicht, und der Aufwand dieser Phase steckt zu einem guten Teil darin, dass sie
das auch sagt, statt zu schweigen.

**Zuerst nachgesehen, dann gebaut.** Die drei Datentypen liegen hinter drei
verschiedenen eBay-Schnittstellen mit drei verschiedenen Rechtelagen:

| Datentyp | Aufruf | Scope |
|---|---|---|
| Aufrufzahlen | Sell Analytics REST, `getTrafficReport` | `sell.analytics.readonly` |
| Nachrichten | Trading XML, `GetMyMessages` | Basis-`api_scope` |
| Preisvorschläge | Trading XML, `GetBestOffers` | Basis-`api_scope` |

Der Befund, der alles Weitere bestimmt: `app/api/admin/ebay/oauth/start/route.ts`
fordert bei der Zustimmung genau einen Scope an — `sell.inventory`. Damit
enthält der gespeicherte Refresh-Token `sell.analytics.readonly` nicht, und ein
Scope lässt sich einem ausgestellten Token nicht nachträglich anheften. Die
Aufrufzahlen sind also nicht „noch nicht gebaut", sondern **bis zu einer neuen
Zustimmung des Kontoinhabers nicht abrufbar**. Der Weg dorthin steht jetzt als
auskommentierte `EBAY_OAUTH_CONSENT_SCOPES` in `.env.example`; die
Voreinstellung fragt unverändert denselben einen Scope an, damit ein Klick auf
„eBay verbinden" nicht mehr verlangt, als jemand wollte.

**Eine leere Tabelle ist mehrdeutig — das ist der Kern der Phase.** „Postfach
leer", „wir durften nie hineinsehen" und „wir haben noch nicht nachgesehen"
sehen in D1 alle drei gleich aus: null Zeilen. Ohne eine vierte Tabelle wäre
jede Antwort darauf geraten. `ebay_read_syncs` hält deshalb je Datentyp fest,
wie der letzte Versuch ausging, und `lib/assistant/ebay-availability.ts` ist die
einzige Stelle, an der daraus ein Satz wird — sechs unterscheidbare Gründe statt
eines pauschalen „nicht verfügbar". Genau deshalb konnte Phase 8 die beiden
alten Festwerte `DATA_NOT_CAPTURED` und `SOURCE_NOT_CONNECTED` nicht einfach
durch `READY` ersetzen: Verfügbarkeit ist hier keine Eigenschaft des Werkzeugs,
sondern des letzten Abrufs.

**Datensparsamkeit als Bauweise, nicht als Vorsatz.** Das Postfach wird mit
`DetailLevel ReturnHeaders` gelesen — eBay liefert den Nachrichtentext dann gar
nicht erst. Was nicht ankommt, kann auch nicht versehentlich gespeichert werden;
das ist stabiler als ein Vorsatz, es wegzulassen. Bei den Preisvorschlägen fehlt
die Käuferkennung aus demselben Grund im Datentyp: Für „gibt es neue
Vorschläge?" zählen Karte, Betrag und Frist. Wer geboten hat, steht bei eBay.

**Drei Befunde entstanden erst beim Messen.**

1. *Die Kennzahlen werden über den Antwortkopf zugeordnet, nicht über die
   Position.* eBay liefert `metricValues` in der Reihenfolge von
   `header.metrics`. Wäre die Position fest verdrahtet, vertauschte eine
   Änderung dieser Reihenfolge Aufrufe und Einblendungen — lautlos, weil beides
   Zahlen sind. Der Test dreht die Reihenfolge deshalb absichtlich um.
2. *`Number(null)` ist 0.* Der erste Entwurf las eine fehlende Kennzahl als
   „null Aufrufe" — genau die erfundene Zahl, die die `applicable`-Prüfung
   darüber verhindern sollte. Der Test hat es gefunden, nicht das Lesen.
3. *„Angebote" enthält „gebot".* Der Planer bekam kurzzeitig `gebot` als
   Suchwort für Preisvorschläge und beantwortete damit die Frage nach den
   *Aufrufen* nebenbei mit Preisvorschlägen — `containsAny` sucht
   Teilzeichenketten, keine Wörter.

**`BestOfferType` nennt keinen Eingangszeitpunkt.** Es gibt `ExpirationTime`,
aber kein Gegenstück. Aus der 48-Stunden-Frist einen Eingang zurückzurechnen
wäre geraten, also gibt es das Feld nicht; sortiert wird nach Ablauf, was
ohnehin die nützlichere Ordnung ist — der Vorschlag, der zuerst verfällt,
braucht zuerst eine Antwort.

**Idempotenz durch Fensterschreibweise.** Ein Lauf stempelt alles, was er
schreibt, mit derselben Uhrzeit und löscht danach, was einen anderen Stempel
trägt. Zweimal derselbe eBay-Inhalt ergibt denselben Tabelleninhalt, auch nach
einem Abbruch mittendrin; an lokalem D1 nachgemessen. Ein **fehlgeschlagener**
Abruf schreibt und löscht nichts — sonst leerte ein eBay-Ausfall die Tabelle
und der Assistant meldete „keine Nachrichten", wo „keine Verbindung" richtig
wäre.

**Der Takt ist die eigentliche Grenze, nicht die Technik.** Der Cron feuert alle
drei Minuten. Zwei zusätzliche Trading-Aufrufe je Schlag wären 960 am Tag aus
demselben 5 000er-Topf, aus dem die Bestandsprüfung an der Kasse bezahlt wird —
und ein blockierter Checkout wiegt schwerer als ein 15 Minuten alter
Nachrichtenstand. Der Lesesync drosselt sich deshalb selbst auf 15 Minuten
(192 Aufrufe/Tag) und wartet nach einem Rechtefehler sechs Stunden, weil dagegen
anzulaufen nichts bringt: Da hilft nur eine neue Zustimmung.

Der Modell-Planer bleibt aus: kein `OPENAI_API_KEY`, kein externer Aufruf. Die
drei neuen Fragen beantwortet der regelbasierte Planer. **Nicht geprüft:** ein
echter Aufruf gegen eBay — alle Tests laufen gegen Fixtures, wie beauftragt.
Ob das Konto tatsächlich Nachrichten und Preisvorschläge herausgibt, erweist
sich erst im Betrieb; scheitert es, steht der Grund in `ebay_read_syncs.detail`
und der Assistant sagt es.

## 2026-08-16 - Phase 7: zwei veraltete Zahlen und ein Text, der nicht uns gehört

Phase 6 hat zwei Punkte ausdrücklich offen gelassen und dabei genau benannt,
warum: Der DPI-Wechsel zwischen Bildschirmen war „blind zu ändern, ohne es je
gesehen zu haben, geraten gewesen", und die Framework-Meldung im
`HttpRequestException`-Pfad war „deutsch lokalisiert und nennt Adresse und
Port, also brauchbar". Beides stimmte — und beides hielt der Nachprüfung nicht
stand.

**Die Skalierung wurde am falschen Bildschirm abgelesen.** Der Ablauf beim
Öffnen des Launchers war: Größe rechnen, dann neben das Pet schieben.
`ToPhysicalPixels` nahm die Skalierung aus `RootFrame.XamlRoot`, also die des
Bildschirms, auf dem das Fenster *gerade* lag; `PositionBesidePet` schob es
danach dorthin, wo das *Pet* liegt. Bei einem Bildschirm ist das dieselbe
Zahl und fällt nie auf. Bei zweien ist es die Zahl des Herkunftsschirms, und
`WM_DPICHANGED` kommt erst *nach* dem Verschieben — die Größe entstand also
zwangsläufig mit einem veralteten Faktor. Behoben ist es durch die
Reihenfolge, nicht durch eine Korrektur hinterher: Erst wird die Lage des Pets
aufgelöst, dann über `MonitorFromRect` + `GetDpiForMonitor(MDT_EFFECTIVE_DPI)`
die Skalierung *des Zielbildschirms* geholt, dann gerechnet. Der Faktor wird
seitdem an jeder Umrechnung ausdrücklich mitgegeben; die parameterlose
Fassung, die sich ihren Faktor still selbst nahm, gibt es nicht mehr.

Lässt sich kein Wert ermitteln, meldet die Abfrage `null` und der Aufrufer
fällt auf die bisherige Rechnung zurück. Ein erfundener Standardfaktor von 1,0
wäre hier keine Vereinfachung, sondern genau der Fehler, der behoben werden
soll — nur ohne die Chance, ihn zu bemerken.

**Die zweite Richtung ist die umgekehrte.** Nicht das Pet, sondern der
Launcher selbst wandert — am Titelbalken gezogen oder weil jemand die
Anzeigeeinstellung im Betrieb ändert. Die Fenstergröße in physischen Pixeln
bleibt dann stehen, während der XAML-Inhalt sofort mit dem neuen Faktor
gezeichnet wird; das Panel wäre abgeschnitten. `XamlRoot.Changed` ist dafür
das ehrliche Signal, weil es die tatsächlich angewandte Rasterisierung meldet
statt eine vermutete. Die Lage bleibt dabei, wo der Nutzer sie hingezogen hat
— nur die Größe wird nachgeführt und in den Arbeitsbereich geklemmt. Die
Schranke gegen den zuletzt angewandten Faktor ist kein Feinschliff: `Changed`
feuert auch bei jeder Größenänderung, das eigene `MoveAndResize` löste sich
sonst endlos selbst aus.

**Am Gerät hängt ein Monitor. Der Zweischirmfall ist damit nicht prüfbar und
wird nicht behauptet.** Was stattdessen gemessen wurde: dass die Wege, auf
denen die neue Rechnung ihre Zahlen holt, hier wirklich funktionieren
(`GetDpiForMonitor` liefert 144, also 150 %; `MonitorFromRect` findet für das
Pet-Rechteck denselben Bildschirm; für ein Rechteck außerhalb aller
Bildschirme liefert `MONITOR_DEFAULTTONEAREST` einen Monitor statt `NULL`).
Und die Regressionsprobe: Bei einem Bildschirm ergibt die neue Rechnung
`(1252,1164)-(1852,1320)` — auf den Pixel das, was Phase 6 am laufenden
Fenster gemessen hat. Die Zweischirmfälle wurden als Rechenvorschrift
durchgespielt, mit den Konstanten aus der echten Quelldatei gelesen statt
abgeschrieben: Die alte Regel verfehlt die Sollbreite um Faktor 1,5
beziehungsweise 0,67, die neue trifft sie. Dazu 12 000 zufällige Pet-Lagen auf
drei simulierten Bildschirmen ohne eine einzige Lage außerhalb des
Arbeitsbereichs. **Das ist eine Simulation, kein Mehrschirmtest.**

**Der Fehlertext gehörte uns nie.** Phase 6 hielt `ex.Message` für brauchbar,
weil dort *"Es konnte keine Verbindung hergestellt werden, da der Zielcomputer
die Verbindung verweigerte. (127.0.0.1:…)"* stand. Das ist aber eine
Eigenschaft dieses Rechners: .NET liefert Socket-Meldungen in der
Systemsprache. Auf einem englischen Windows steht dort *"An error occurred
while sending the request."* — und der allgemeine Auffangzweig konnte
ohnehin jeden beliebigen Framework-Text durchreichen; gemessen etwa *"Unable
to read data from the transport connection: …"* und *"The request was canceled
due to the configured HttpClient.Timeout of 30 seconds elapsing."*

Die Übersetzung entscheidet deshalb **ausschließlich anhand von
Aufzählungswerten** — `SocketError` und `HttpRequestError` —, nie anhand des
Meldungstexts. Damit hängt die Anzeige nicht an Windows-Sprache und
.NET-Fassung. Die belastbare Zusicherung dahinter: Jeder angezeigte Satz steht
wörtlich als Zeichenkette in der eigenen Quelldatei. Ein Wort- oder
Teilstringvergleich hätte das nicht geleistet — „die Verbindung" steht völlig
zu Recht in beiden Texten, sobald Windows deutsch ist.

Zwei Befunde entstanden erst beim Messen, nicht beim Entwerfen:

- **Die TLS-Meldung wurde vom Socket verdeckt.** Bei einem HTTPS-Aufruf auf
  einen reinen HTTP-Zuhörer steht im Fehlerbaum *zusätzlich* ein
  zurückgesetzter Socket. Mit der Socket-Prüfung zuerst meldete die Anzeige
  „unterwegs getrennt" statt auf die gesicherte Verbindung zu zeigen. Die
  TLS-, Namens-, Proxy- und Anmeldefälle stehen deshalb jetzt *vor* der
  Socket-Prüfung; die Socket-Prüfung bleibt danach, weil sie den
  Verbindungsaufbau genauer benennt (abgelehnt, unbekannter Name, kein Netz),
  wo `HttpRequestError` nur `ConnectionError` weiß.
- **Ein abgerissener Antwortkörper kommt nackt an.** Wird nach
  `ResponseHeadersRead` gelesen und die Gegenstelle legt mittendrin auf, ist
  es eine `IOException` — nicht in eine `HttpRequestException` verpackt. Der
  Assistant-Pfad fängt sie seit Phase 6 selbst ab, der Ereignisabruf lief in
  den allgemeinen Fall. Sie hat jetzt einen eigenen.

Der einzige Text, der weiterhin durchgereicht wird, ist der eigener
`InvalidOperationException`s — der ist im Programm formuliert und für den
Nutzer gedacht. Auch er wird begrenzt: `ReadApiErrorAsync` gibt das Feld
`error` aus der Shop-Antwort zurück, und dessen Länge bestimmt der Absender.
Phase 6 hat genau diesen Weg im Assistant-Pfad begrenzt und den Kopplungspfad
übersehen; 2 000 Zeichen kamen dort ungebremst durch. Zusammengezogen wird auf
eine Zeile, nicht wie im Antwortpfad mehrzeilig erhalten — Ziel ist die
einzeilige Statuszeile. `char.IsControl` deckt dabei mehr ab als der
Vergleich gegen U+0020 aus Phase 6: auch U+007F und den C1-Bereich.

**Die Pet-Größe wurde nicht angefasst.** Nachgemessen statt übernommen: Beide
Atlanten sind 1536×1872 (`Assets/spritesheet.png` und
`avatar/brandycards-avatar/spritesheet.webp`, letzterer aus dem VP8L-Kopf
gelesen) — es gibt kein höher aufgelöstes Original. In einer Leerlaufkachel
sind 5,3 % der Pixel teiltransparent, 76,1 % ganz leer, 18,6 % ganz deckend.
Diese weiche Kante ist der Grund gegen Interpolation: `UpdateLayeredWindow`
zeigt sie ohne Hintergrund, der Artefakte kaschieren würde. Was stattdessen
entstanden ist, sind die Anforderungen an neues 2×-Material mit konkreten
Maßen (3072×3744, Kachel 384×416, echtes nicht vormultipliziertes Alpha, 2 px
transparenter Rand) im Desktop-README — damit die spätere Grafikarbeit nicht
raten muss. `NativePetOverlay.cs` ist in diesem Durchlauf unverändert
geblieben, auch dort, wo eine DPI-Abfrage bequem gewesen wäre: Die Lage des
Zielbildschirms wird aus dem Pet-*Rechteck* bestimmt, das die Datei ohnehin
schon meldet.

**Was nicht geprüft werden konnte.** Das laufende Fenster. Smart App Control
ist auf diesem Gerät scharf geschaltet (`VerifiedAndReputablePolicyState = 1`)
und hat die frisch gebaute `BrandyCards.Desktop.exe` am Start gehindert:
„Eine Anwendungssteuerungsrichtlinie hat diese Datei blockiert." Der Build ist
sauber, aber Sichtprüfung des transparenten Pets, Fensterlagen am lebenden
Objekt und die Fehlerpfade im Panel konnten diesmal nicht wiederholt werden.
Eine Sicherheitseinstellung des Systems dafür zu ändern, kam nicht in Frage.

## 2026-08-16 - Phase 6: was übrig bleibt, wenn nicht die eigene Route antwortet

Drei Risiken standen offen. Was sie verbindet, wurde erst beim Messen sichtbar:
Alle drei treten genau dann auf, wenn etwas anderes antwortet als die eigene
Route — ein Proxy, eine Portalseite, ein halb gestorbener Server — oder wenn
der Nutzer das Pet anfasst. Kein Servertest kann sie finden, weil der Server
dabei nicht beteiligt ist. Sie wurden deshalb gegen einen Wegwerf-Testserver
auf `127.0.0.1` gemessen, der genau diese Fälle spielt, und die echte
`AssistantConversationService.cs` wurde als Quelldatei in ein Prüfprogramm
eingebunden, statt ihr Verhalten nachzubauen.

**Der Serverfehlerpfad hielt nur, solange der Shop antwortete.** Der
Statuspfad war in Ordnung: 4xx und 5xx mit JSON-Körper landeten korrekt als
deutsche Meldung im Panel. Was fehlte, war alles darunter. Bei HTTP 200 mit
einem Körper, der kein JSON ist — die Fehlerseite eines Zwischenknotens, eine
Portalseite im Hotel-WLAN — warf `ReadFromJsonAsync` eine `JsonException`, und
ihr englischer Text stand wörtlich in der Unterhaltung: *"'<' is an invalid
start of a value. Path: $ | LineNumber: 0"*. Bei `{"answer": 42}` kam sogar der
interne Typname mit: *"…could not be converted to …+AssistantReply"*. Das ist
keine Meldung, das ist ein Stacktrace-Fragment im Gesicht des Nutzers.

Dazu kam die fehlende Grenze. Ein Testserver mit zwei Millionen Zeichen kam
ungebremst durch und landete vollständig in einem `TextBlock`. Die Reparatur
ist nicht nur die Obergrenze, sondern auch, *wo* sie greift:
`HttpCompletionOption.ResponseHeadersRead` musste dazu, denn in der
Voreinstellung liest `SendAsync` den ganzen Körper in den Speicher, bevor es
zurückkehrt — eine Grenze danach hätte nur noch die Anzeige begrenzt, nicht
den Speicher. Gelesen wird jetzt gestreamt mit einem Byte mehr als erlaubt;
nur so ist „genau voll" von „zu groß" unterscheidbar.

Zwei Grenzen, nicht eine: Der Antworttext darf 20 000 Zeichen haben, weil der
Orchestrator aus sechs Werkzeugen à zwanzig Einträgen legitim mehrere
Kilobyte erzeugt — eine zu enge Grenze hätte gültige Auskünfte abgeschnitten,
und das wäre schlimmer als der Fehler, der behoben werden sollte. Eine vom
Server gelieferte *Fehlermeldung* darf 500; die der eigenen Route sind alle
unter 100 Zeichen lang, alles darüber kommt nicht von ihr. Steuerzeichen
fliegen raus, Zeilenumbrüche bleiben — der Antwortformatierer erzeugt echte
mehrzeilige Listen, und die zu zerstören hätte den Normalfall beschädigt, um
einen Ausnahmefall zu heilen. Nachgemessen: eine dreizeilige Bestellliste
kommt unverändert an, ein Fehlertext mit ANSI-Sequenzen verliert sie.

Nebenbei fiel auf, dass die Statuszeile auch bei HTTP 503 „Antwort empfangen"
meldete. `AskAsync` gab in beiden Fällen nur einen Text zurück, der Aufrufer
konnte Auskunft und Absage nicht unterscheiden. Jetzt sagt der Rückgabewert
beides.

**Mehrschirmbetrieb ließ sich nicht prüfen — die Ursache dahinter schon.** Am
Gerät hängt ein Monitor, `SM_CMONITORS` meldet 1. Ein echter Zweischirmtest
hat nicht stattgefunden und wird hier auch nicht behauptet. Beim Codelesen
zeigte sich aber, dass das eigentliche Problem gar nicht am zweiten Monitor
hängt: Das Pet ist **verschiebbar** — `WM_NCHITTEST` antwortet mit
`HTCAPTION`, die ganze Fläche ist ein Ziehgriff — während
`MainWindow.PositionBesidePet` unbeirrt gegen `DisplayArea.Primary.WorkArea`
und die Startränder rechnete. Ein an den linken Rand gezogenes Pet ließ das
Fenster beim nächsten Öffnen unten rechts stehen. Das ist auf *einem* Monitor
reproduzierbar, und es ist dieselbe Ursache, die auf zwei Monitoren dazu
führt, dass der Launcher auf dem Primärschirm zurückbleibt.

Damit war die Prüfung möglich: Das Overlay meldet über `GetWindowRect` seine
tatsächliche Lage und über `MonitorFromWindow`/`GetMonitorInfo` den
Arbeitsbereich des Bildschirms, auf dem es liegt — read-only, ohne Eingriff in
Größe, Zeichenweg oder Alpha-Pfad. Gemessen bei 150 %: Pet an den linken
oberen Rand geschoben, Fenster folgt und stellt sich rechts daneben, weil
links kein Platz ist; Pet in die Mitte geschoben, Fenster steht links, 16 px
Abstand, Unterkanten bündig. Ohne Bewegung bleibt die Position auf den Pixel
dieselbe wie in Phase 5b — die Mehrschirmtauglichkeit folgt daraus
konstruktiv, geprüft ist sie nicht.

Eine Falle steckte in der Reihenfolge: `EnterPetMode` stellte das Fenster
daneben, *bevor* `Show()` das Pet platzierte. Vor `Show()` liegt das native
Fenster bei 0/0, die Lage wäre also die linke obere Ecke gewesen. Deshalb
meldet `CurrentPlacement()` vor `Show()` bewusst `null`, und der Aufruf wurde
getauscht — zwei voneinander unabhängige Absicherungen für denselben Fehler.

**Die Pet-Größe wurde analysiert und nicht angefasst.** Bei 150 % ist das Pet
effektiv 173×200 Pixel groß, weil es in *physischen* Pixeln gezeichnet wird:
260×300 fest, `DrawImageUnscaled`, keine DPI-Umrechnung. Der Launcher rechnet
dagegen über `ToPhysicalPixels` und behält seine 400×104 effektiven Pixel bei
jeder Skalierung. Das Pet schrumpft also relativ zu allem anderen, je höher
die Skalierung: 260×300 bei 100 %, 173×200 bei 150 %, 130×150 bei 200 %.
Inkonsistent ist das — sinnvoll nicht.

Geändert wurde es trotzdem nicht, und der Grund ist nachgesehen, nicht
vermutet: Es gibt kein höher aufgelöstes Ausgangsmaterial. Der Atlas ist
1536×1872 (8×9 Kacheln à 192×208), die `spritesheet.webp` daneben hat exakt
dieselben Maße. Eine Vergrößerung auf 150 % hieße, 192×208 um den Faktor 1,5
zu interpolieren — ein nicht-ganzzahliger Faktor auf Material, das ausweislich
der Stichprobe bereits weiche, teiltransparente Kanten hat (rund 5 % der
Pixel). Das berührt genau die drei Dinge, die intakt bleiben sollten:
Transparenz (der Alpha-Pfad läuft über vormultipliziertes PArgb und
`UpdateLayeredWindow`), Animation (jede der 6 bis 8 Kacheln je Zeile müsste
identisch skaliert werden) und Positionierung (`WindowWidth`/`WindowHeight`
sind zugleich die Bezugsgrößen für die Ränder und liegen als `PetWidth`/
`PetHeight` ein zweites Mal in `MainWindow`). Die Optionen stehen im
Übergabeprotokoll; die Entscheidung ist eine gestalterische und braucht neues
Bildmaterial, keinen Interpolationsfilter.

**Der Modell-Planer blieb aus.** Kein `OPENAI_API_KEY`, kein externer Aufruf,
keine Änderung an `lib/assistant`. Während der gesamten Prüfung hatte der
Desktop genau eine bestehende Verbindung: `127.0.0.1:8791`. Die produktive
`settings.json` wurde vorher gesichert, während der Prüfung auf den lokalen
Testserver gezeigt und danach byte-gleich wiederhergestellt (SHA256 vorher =
nachher).

## 2026-08-16 - Phase 5b: die beiden offenen Punkte aus Phase 5 schließen

Phase 5 hat zwei Befunde bewusst stehen lassen und im Übergabeprotokoll
begründet, warum. Beide sind hier erledigt — und beide zeigen, dass die
Begründung von damals richtig war, die Sache aber nicht auf sich beruhen
konnte.

**Der Zeitrahmen war in der falschen Richtung geordnet.** Der Client wartete
zwölf Sekunden, der Modell-Planer darf fünfzehn laufen. Solange kein
Modellzugang konfiguriert ist, fällt das nicht auf: Der lokale Planer antwortet
in Millisekunden. Sobald er konfiguriert wird, hätte der Desktop bei jeder
frei formulierten Frage drei Sekunden zu früh aufgegeben und einen Fehler
gezeigt, während der Server noch an derselben Frage arbeitete — die schlechteste
denkbare Fehlerart, weil sie erst in dem Moment auftritt, in dem das Feature
scharf gestellt wird, und wie ein Serverfehler aussieht.

Die naheliegende Korrektur — `_httpClient.Timeout` einfach hochsetzen — wäre
falsch gewesen. Derselbe Client holt alle drei Sekunden Ereignisse ab; ein
stummer Shop hätte den Abruf dann eine halbe Minute blockiert, statt binnen
Sekunden „nicht erreichbar" zu melden. `HttpClient.Timeout` ist aber eine
Obergrenze für den gesamten Client und lässt sich je Aufruf nur verkürzen,
nicht verlängern. Also steht dort jetzt der *längste* Fall — die
Assistant-Anfrage mit 30 s — und Kopplung wie Ereignisabruf begrenzen sich
selbst über eine eigene `CancellationTokenSource` mit 12 s. Die 30 s sind
nicht gegriffen: Sie lassen dem Serverpfad den doppelten Modellzeitrahmen
plus Netzweg und bleiben eine harte Grenze; endlos wartet nichts.

Dass die beiden Werte in verschiedenen Sprachen und Projekten liegen — C# hier,
TypeScript dort — ist genau der Grund, warum ein Kommentar nicht reicht. Wer
`MODEL_TIMEOUT_MS` anfasst, sieht die C#-Datei nicht. `tests/assistant-phase5b.test.mjs`
liest deshalb beide Zahlen aus den echten Quelldateien und erzwingt die
Ordnung samt Netzpuffer. Derselbe Test hält fest, dass die Grenze endlich
bleibt und dass die kurzen Pfade kurz bleiben.

Am Fenster wurde nachgeprüft, was der Nutzer davon sieht. Gegen einen
TCP-Server, der Verbindungen annimmt und nie antwortet, stand das Panel
zwanzig Sekunden nach dem Senden noch auf „Assistant liest Daten …" — mit den
alten zwölf Sekunden wäre es da längst gescheitert — und meldete nach dreißig
Sekunden „Der Shop hat innerhalb von 30 Sekunden nicht geantwortet." Ein
Abbruch entsteht hier ausschließlich aus dem Zeitrahmen, deshalb bekommt
`OperationCanceledException` einen eigenen Zweig; sonst stünde die englische
Framework-Meldung samt einer Zahl im Panel, die niemand einordnen kann.
Ebenso `HttpRequestException`: gegen einen toten Port meldet das Panel jetzt
„Der Shop ist gerade nicht erreichbar …" statt „Die Anfrage konnte nicht
ausgeführt werden".

**Das Pet lag unter der Taskleiste.** Phase 5 hatte 24 Pixel gemessen und nicht
angefasst, weil `NativePetOverlay.cs` unter Änderungsverbot stand. Die Ursache
ist eine Zeile: Das Fenster ankerte an `SM_CXSCREEN`/`SM_CYSCREEN`, also an der
*ganzen* Bildschirmfläche, und die 48 Pixel Abstand waren zugleich als
Platzhalter für die Taskleiste gedacht. Bei 150 % ist die hier 72 Pixel hoch —
der Platzhalter war schlicht zu klein, und bei einer seitlich angedockten
Taskleiste hätte er gar nichts genützt.

Bemerkenswert ist, dass `MainWindow.PositionBesidePet` für das danebenliegende
Fenster längst `DisplayArea.Primary.WorkArea` verwendet, mit exakt denselben
Rändern 32 und 48. Die beiden Fenster rechneten also gegen verschiedene
Bezugssysteme und standen deshalb 24 Pixel versetzt, obwohl der Code so aussah,
als wären sie bündig. `SPI_GETWORKAREA` im Overlay behebt beides in einem: Die
Taskleiste ist ausgespart, unabhängig von Höhe und Kante, und die Unterkanten
liegen tatsächlich auf einer Linie. Gemessen am laufenden Fenster:
Pet (1868,1020)–(2128,1320), Launcher (1252,1164)–(1852,1320) — gleiche
Unterkante, 16 Pixel Abstand, 48 Pixel über dem Arbeitsbereichsrand bei 1368.

Größe und Zeichenweg blieben unberührt: Es ändert sich ausschließlich der
Startpunkt in `Show()`. Der Nachweis lief über ein Wegwerf-Programm, das genau
diese Datei einbindet und sonst nichts — kein Netz, keine Kopplung. Gegen die
Fassung vor der Änderung meldete es 24 Pixel Überlappung, danach 0, bei
unveränderten 260×300 und gesetztem `WS_EX_LAYERED`.

**Zur Messfalle, die dabei fast zu einem Fehlbefund geführt hätte.** Ein
Prüfskript ohne eigene DPI-Kennzeichnung bekommt von `GetWindowRect`
virtualisierte Koordinaten: Das 260×300 große Pet erschien als 173×200, der
Launcher als 400×104, das Setup-Fenster als 520×760 — was wie der bereits in
Phase 5 behobene DPI-Fehler aussah. Erst mit
`SetThreadDpiAwarenessContext(PER_MONITOR_AWARE_V2)` im *Beobachter* kamen die
echten Werte: 780×1140 für das Setup-Fenster, also die beabsichtigten 520×760
effektiv. Phase 5 hatte recht; das Messwerkzeug war schuld. Wer hier künftig
misst, muss den Beobachter DPI-fähig machen, sonst misst er sein eigenes
Skript.

Nicht geändert wurde die Pet-*Größe*. Sie ist bei 150 % weiterhin nur 173×200
effektive Pixel groß. Das zu beheben hieße, Pixelgrafik zu skalieren, und
berührt damit Transparenz und Erscheinungsbild — eine andere Entscheidung als
eine falsche Ankerkante, und keine, die nebenbei getroffen werden sollte.
Mehrschirmbetrieb blieb ungeprüft, weil am Gerät weiterhin nur ein Monitor
hängt; `SM_CMONITORS` meldet 1.

## 2026-08-16 - Phase 5 des Desktop-Assistenten: Abnahme statt Ausbau

Phase 5 hat nichts hinzugefügt, sondern nachgewiesen. Der Prüfweg war
bewusst der echte: ein laufender Dev-Server mit lokaler D1, echte
HTTP-Anfragen, ein gebautes WinUI-Fenster und UI-Automation statt Codelesen.
Genau daran hängt der Wert der beiden Befunde — beide waren durch Lesen des
Codes unsichtbar und zeigten sich erst am laufenden System.

Der erste Befund kam aus dem Tastaturlauf. Die Kopplung gegen `npm run dev`
scheiterte mit „Die Anfrage muss ihre Größe angeben." — HTTP 411. Ursache ist
`PostAsJsonAsync`: `JsonContent` kann seine Länge nicht vorab berechnen und
sendet deshalb chunked, was die Worker-Laufzeit ablehnt. Phase 4 hatte dieses
Problem für den Assistant-Endpunkt bereits gelöst und den Grund im Code
notiert, die Kopplung aber nicht mitgezogen. Die Korrektur überträgt exakt
dieselbe Lösung. In Produktion war der Weg nie kaputt, weil Cloudflare
chunked akzeptiert; die Lücke betraf ausschließlich die in der README
beschriebene lokale Inbetriebnahme. Die neue Prüfung in
`tests/assistant-phase5.test.mjs` verbietet `PostAsJsonAsync` deshalb für den
gesamten Client, nicht nur für die eine Zeile.

Der zweite Befund kam aus der Messung. `ConfigureSetupWindow` übergab
`AppWindow.Resize` rohe 520×760, während `ConfigureLauncherWindow` seit Phase 2
über `ToPhysicalPixels` skaliert. Bei 144 dpi ergab das ein Fenster von
347×507 effektiven Pixeln statt 520×760. Der naheliegende Fix — einfach
`ToPhysicalPixels` auch hier aufrufen — hätte nichts geändert:
`ConfigureSetupWindow` läuft im Konstruktor, `RootFrame.XamlRoot` ist dort noch
`null`, und der bisherige Rückfall auf 1.0 hätte still weiter falsch
gerechnet. Deshalb liefert `RasterizationScale()` jetzt einen zweiten Weg über
`GetDpiForWindow` auf dem Fenster-Handle. Die Nachmessung ergab 780×1140
physisch, also die beabsichtigten 520×760 effektiv — auch auf dem Rückweg,
wenn ein Widerruf die App in die Setup-Ansicht zurückwirft.

Die Serverseite hielt allen 45 HTTP-Fällen stand. Sechs verschiedene Gründe
führen zu 401, darunter der wichtigste: ein Token mit ausschließlich `EVENTS`
erreicht den Assistant nicht. Elf Eingabefälle decken Content-Type, kaputtes
JSON, Zusatzfelder, die alte Phase-1-Direktwahl, leere und zu lange Fragen
sowie drei verschiedene Wege, einen zu großen oder längenlosen Body zu
schicken. Vier Prompt-Injektionen — Löschbefehl, Rollenwechsel, Kundendaten,
Geheimnisse — lieferten nichts davon; der Planer kennt schlicht kein Werkzeug
dafür, und die Antwort entsteht ohnehin deterministisch aus typisierten DTOs.
Der entscheidende Beleg steht am Ende: die Zeilenzahlen der Datenbank waren
vor und nach dem Durchlauf identisch. Read-only ist damit nicht behauptet,
sondern gemessen.

Beim Timeout wurde bewusst nicht der echte Anbieter angerufen. Ein
Fetch-Doppel, das nie antwortet, belegt stattdessen, dass die Modellplanung
unter einem Abbruchsignal läuft und nach fünfzehn Sekunden endet — der einzige
Test der Suite, der echte Wartezeit kostet, und der einzige, der beweist, dass
ein hängender Anbieter eine Geräteanfrage nicht endlos offen hält. Dass
`HybridAssistantPlanner` einen Modellfehler weiterreicht statt ihn zu
verschlucken, ist die Voraussetzung dafür, dass die Route daraus ein 503 mit
generischem Text macht, statt eine Antwort zu erfinden.

Drei Dinge bleiben offen und stehen ausdrücklich als solche im
Übergabeprotokoll. Der Mehrschirmbetrieb ließ sich nicht real prüfen, weil am
Prüfgerät nur ein Monitor hängt; aus dem Code ankern Launcher und Pet beide
fest am Primärmonitor, was sich nur zusammen mit der Pet-Positionierung ändern
ließe — und die stand unter Änderungsverbot. Der Client-Timeout von zwölf
Sekunden liegt unter dem Modell-Timeout von fünfzehn; das fällt erst auf, wenn
`OPENAI_API_KEY` gesetzt wird, und wurde deshalb nicht eigenmächtig
verschoben. Und das Pet selbst zeichnet in physischen Pixeln, wirkt bei 150 %
entsprechend klein und ragt 24 Pixel in die Taskleiste — festgehalten, nicht
angefasst.

## 2026-08-16 - Phase 4 des Desktop-Assistenten: zentraler Read-only-Orchestrator

Phase 4 verschiebt die gesamte Frageverarbeitung vom WinUI-Client auf einen
zentralen serverseitigen Manager. Der öffentliche Gerätevertrag akzeptiert nur
noch `{ message }`; direkte Tool-Wahl, Prompt-Zusatzfelder, SQL und sonstige
Argumente werden abgewiesen. `AssistantConversationService` kennt deshalb
weder Toolnamen noch Daten-DTOs mehr. Text und das lokal erkannte Diktat laufen
weiter durch dieselbe `SendAssistantMessageAsync`-Methode und erhalten vom
Server ausschließlich die fertige Textantwort.

Der Manager besteht bewusst nicht aus autonomen Subagents. Ein geschlossener
Regelplaner deckt die bekannten und zusammengesetzten deutschen Shopfragen
deterministisch ab. Für freiere Formulierungen kann serverseitig die OpenAI
Responses API genutzt werden. Der Modell-Planer sieht genau die zehn
bestehenden Toolnamen, jeweils mit einem strikten Schema, das nur `limit` von 1
bis 20 enthält. Modellantworten werden nicht vertraut: Jeder Function Call
wird erneut durch `parseAssistantToolInput` geschickt, unbekannte Namen,
Zusatzfelder und Grenzverletzungen scheitern. Maximal sechs eindeutige Calls
werden pro Frage berücksichtigt. `OPENAI_API_KEY` bleibt eine reine
Servervariable; der Desktop kennt weder Schlüssel noch Provider-URL.

Die endgültige Antwort wird absichtlich nicht vom Modell geschrieben. Ein
deterministischer Formatter verarbeitet ausschließlich die typisierten
Registry-Ergebnisse. Damit kann kein Modell einen Preis, eine Menge, einen
Status, eine Quelle oder eine Aktualisierungszeit erfinden. Eine fehlende eBay-
Verkaufsmenge wird insbesondere nicht mehr wie zuvor lokal als `1×` ausgegeben.
`AVAILABLE` mit leerer Liste, `UNAVAILABLE`, partielle Toolfehler und ein
vollständiger Lesefehler besitzen eigene, kurze deutsche Texte. Mehrere
Ergebnisse bleiben getrennt und tragen ihre jeweilige Quelle und Frische; rohe
Fehlerdetails werden nur serverseitig protokolliert.

Die API behält Geräteauthentifizierung, `ASSISTANT_READ`, Vorab-Rate-Limit,
4-KiB-Bodygrenze und `no-store`. Kein neuer Datenhandler wurde ergänzt und kein
Schreibmodul importiert. Auch der OpenAI-Pfad kann nur Registry-Namen und ein
kleines Ergebnislimit planen; SQL, Tabellen, Nachrichten, Angebote und eBay-
Änderungen sind für ihn strukturell unerreichbar. Bekannte Fragen funktionieren
ohne Modellschlüssel. Eine unbekannte Formulierung meldet ohne Schlüssel
ausdrücklich, dass der freie Modell-Planer nicht konfiguriert ist, statt eine
Antwort zu erfinden.

Die vollständige Suite besteht nach der Erweiterung aus 383 grünen Tests. Davon
prüfen 16 neue Orchestrator-Fälle Routing, Mehrfachauswahl, eBay-/Shop-
Abgrenzung, strikte Modellargumente, leere und nicht verfügbare Daten,
Teil-/Gesamtfehler, Quellen, fehlende Mengen, serverseitige Secrets und den
gemeinsamen Text-/Diktatpfad; die 11 Phase-1-Registrytests bleiben grün. Der
Produktions-Build, `npx tsc --noEmit` und der WinUI-x64-Debug-Build waren
erfolgreich; WinUI meldete 0 Warnungen und 0 Fehler. ESLint meldet 0 Fehler und
nur die bekannte Hook-Warnung in `app/account/page.tsx`.

Für den echten lokalen Desktoplauf wurde die vorhandene Scope-Migration
`0011_avatar_assistant_scope.sql` nur auf die lokale D1 angewendet. Ein
kurzlebiges lokales Gerätetoken und ein temporärer Claim/Event-Proxy ließen die
sichtbare App ihre Assistant-Requests an die echte localhost-API senden. Die
Frage nach nicht verfügbaren eBay-Daten lieferte HTTP 200 und beide expliziten
`UNAVAILABLE`-Antworten; die Bestellfrage lieferte den belegten Leerzustand aus
`SHOP_DB`. Beim Sprachlauf wurde die synthetische Lautsprecherausgabe als
„Welche Bestellungen sind Moll“ erkannt, als normale Frage gesendet und korrekt
auf `new_orders` geroutet. Testtoken und Pairing wurden danach nachweislich auf
0 bereinigt, der Proxy entfernt und die ursprüngliche produktive Desktop-
Einstellung restauriert. Es gab keine Remote-Migration, Produktionsänderung
oder Deployment. `NativePetOverlay.cs` und das transparente Pet blieben
unverändert; die finale App-Instanz zeigt Launcher und Overlay und antwortet.

## 2026-08-16 - Phase 3 des Desktop-Assistenten: lokale Windows-Spracheingabe

Die bestehende App wird bewusst weiterhin unpackaged gestartet. Die aktuelle
WinRT-`Windows.Media.SpeechRecognition`-API setzt Paketidentität voraus und
würde damit den etablierten CLI-/Overlay-Startpfad verändern. Stattdessen nutzt
der neue lokale `WindowsSpeechRecognitionService` die Windows Desktop Speech
Recognition über `System.Speech`: Die einmalige in-process-Diktatsitzung lädt
eine `DictationGrammar`, verwendet das Windows-Standardmikrofon und gibt nur
den erkannten Text an den Launcher zurück. Audio und Transkript verlassen dabei
nicht den lokalen Prozess.

Der Mikrofon-Button ist ein Standard-WinUI-Button mit zugänglichem Namen und
Hilfetext. Er liegt in der logischen Tab-Reihenfolge zwischen Texteingabe und
Senden, kündigt „Windows hört zu …“ sowie Fehler über die vorhandene höfliche
Live-Region an und deaktiviert Texteingabe, Mikrofon und Senden während einer
laufenden Diktat- oder Datenabfrage. Nach Erfolg setzt der Handler den erkannten
Text kurz in die normale Eingabe und ruft dann dieselbe
`SendAssistantMessageAsync`-Methode auf wie eine Texteingabe. Folglich bleibt
`AssistantConversationService.ResolveTool` der einzige natürliche
Freitext-zu-Tool-Pfad; es gibt weder Modell-Orchestrierung noch Sprach- oder
Realtime-Antworten.

Die Fehlerzuordnung behandelt fehlende lokale Recognizer, gesperrte
Mikrofonberechtigung, nicht unterstützte Plattformen, nicht initialisierbares
Mikrofon und leere Diktate als konkrete Benutzerhinweise. Windows kann den
Desktop-Datenschutzschalter jederzeit ändern; der Test verändert ihn deshalb
nicht. Auf dem Prüfgerät waren die lokalen Erkenner Deutsch (Deutschland) und
Englisch (Vereinigtes Königreich) installiert. Ein echter lokaler Aufruf ohne
gesprochenen Text lief bis zum erwarteten leeren Ergebnis durch und stellte die
Bedienelemente wieder her.

Der x64-Debug-Build lief mit 0 Warnungen und 0 Fehlern. Die fokussierten
Assistant-Tests bestanden 11/11, die Gesamtsuite 367/367, und TypeScript war
fehlerfrei. Die interaktive UI-Automation bestätigte transparentes Pet und
Launcher nebeneinander, die unveränderte effektive Panelgröße bei 150 % DPI
sowie Namen, Fokusfähigkeit und Aktivierbarkeit des Mikrofon-Buttons. Weder
`NativePetOverlay.cs`, Fensterpositionierung, Event-Polling noch Assistant-API
wurden geändert; es gab keine Produktionsänderung, Remote-Migration oder
Deployment.

## 2026-08-16 - Phase 2 des Desktop-Assistenten: zugänglicher WinUI-Launcher

Das per-pixel-transparente native Pet bleibt ein eigenes, nicht aktivierendes
`WS_EX_LAYERED`-Overlay; `NativePetOverlay.cs`, Atlas-Rendering, Animationstimer
und Event-Polling wurden nicht verändert. Statt das vorhandene WinUI-Fenster im
gekoppelten Zustand auszublenden, bleibt es nun als separates, fokussierbares
Launcherfenster links neben dem Pet sichtbar. Der Launcher öffnet ein
einseitiges Textpanel und skaliert seine effektiven Maße über die aktuelle
`XamlRoot.RasterizationScale`, damit 520×680 effektive Pixel auch bei 150 % DPI
tatsächlich nutzbar bleiben.

Das Panel verwendet ausschließlich eingebaute WinUI-Controls. Launcher,
Schließen, Texteingabe, Senden und „Verbindung ändern“ besitzen zugängliche
Namen, eine definierte Tab-Reihenfolge und sichtbare Standard-Fokuszustände.
Beim Öffnen erhält das Nachrichtenfeld den Fokus; Escape schließt das Panel und
setzt den Fokus zurück auf den Launcher. Statusmeldungen sind als höfliche
Live-Regionen markiert. Theme-Dictionaries und theme-aware Styles halten
Setup, Nachrichten und Bedienelemente in Light, Dark und High Contrast lesbar.

Eine neue lokale `AssistantConversationService`-Schicht ordnet natürliche
deutsche Fragen deterministisch den zehn festen Phase-1-Werkzeugnamen zu und
formatiert deren typisierte JSON-Antworten als verständlichen Text. Unbekannte
Fragen werden rein lokal mit unterstützten Beispielen beantwortet. Es wurde
weder ein freier Orchestrator noch eine Spracheingabe ergänzt; die
Assistant-API blieb unverändert und erhält weiterhin nur `{ tool, limit }`.
Das Launcherfenster und seine lokale Hilfsantwort funktionieren auch ohne
erreichbaren Webshop, während echte Datenabfragen erwartungsgemäß die
bestehende Geräteverbindung benötigen.

Verifikation: Der x64-Debug-Build war mit 0 Warnungen und 0 Fehlern
erfolgreich; die fokussierten Assistant-Tests bestanden 11/11. Der finale
unpackaged Prozess antwortet und zeigt gleichzeitig das transparente Pet und
das WinUI-Fenster. Die DPI-bewusste Sichtprüfung bestätigte Launcher,
Textpanel, lesbare Unterhaltung und unveränderte Alpha-Darstellung. Die
Tastaturprüfung öffnete per Enter, sendete eine lokale unbekannte Frage per
Tab+Enter, schloss per Escape und öffnete erneut. Der Accessibility-Baum
enthielt alle erwarteten benannten Controls und die lokale Antwort. Ein erster
Restore war innerhalb der Netzwerk-Sandbox blockiert und wurde mit
freigegebenem NuGet-Zugriff wiederholt. Ein Zwischenbuild war durch die zur
Sichtprüfung laufende App gesperrt; der finale Build zunächst durch zwei
eindeutig identifizierte, hängende lokale Reflection-Testprozesse. Nach dem
gezielten Beenden dieser eigenen Prozesse lief der Build jeweils sauber durch.
Es wurden keine Produktionsdaten verändert, keine Remote-Migration
ausgeführt und nichts deployed.

## 2026-08-16 - Phase 1 des Desktop-Assistenten: sichere Datenwerkzeuge

Die erste Assistant-Phase verwendet die bestehende, nur serverseitig prüfbare
Desktop-Geräteauthentifizierung. Der neue Endpunkt
`/api/avatar/device/assistant` akzeptiert keine natürliche Sprache und kein
SQL, sondern ausschließlich eine feste Tool-ID sowie eine auf 1 bis 20
begrenzte Ergebniszahl. Der zentrale Registry-Dispatcher kennt nur lesende
Handler; schreibende Shop- oder eBay-Funktionen werden nicht importiert.

Die Werkzeuge lesen Shop-Verkäufe, letzte Einstellungen, neue bezahlte oder in
Bearbeitung befindliche Bestellungen, offene Shop-Preisvorschläge,
Bestandswidersprüche, neue Shop-Anfragen, eBay-Sync-/Outbox-Zustand und
Statistiken über fest formulierte Drizzle-Abfragen. Gemischte SQLite- und
ISO-Zeitstempel werden vor Sortierung mit `datetime(...)` und in Antworten als
ISO-8601 normalisiert. Antworten enthalten Kartentitel, Status, Mengen,
Preise, Zeit und Datenfrische, aber keine E-Mail-/Adressdaten, Geräte- oder
Provider-Tokens, Webhook-Payloads oder sonstigen Rohdaten.

Die vorhandene eBay-Anbindung erfasst weder Listing-Aufrufzahlen noch das
eBay-Postfach. Diese beiden Tools liefern deshalb einen typisierten Status
`UNAVAILABLE` mit `DATA_NOT_CAPTURED` beziehungsweise
`SOURCE_NOT_CONNECTED`. Shop-Preisvorschläge bleiben ausdrücklich von bislang
nicht integrierten eBay-Käuferangeboten getrennt. So kann ein späterer
Orchestrator keine fehlenden Daten als Tatsachen formulieren.

Der Endpunkt ist zusätzlich größenbegrenzt, schon vor dem D1-Token-Lookup
rate-limited, nicht cachebar und gibt bei internen Fehlern nur eine generische
Meldung aus. Die lokale Migration `0011_avatar_assistant_scope.sql` lässt
bestehende Tokens ausdrücklich auf dem Ereignis-Scope; nur eine neue,
Admin-autorisierte Kopplung erhält `ASSISTANT_READ`, Betreiberzuordnung und
90 Tage Laufzeit. Die Credential wird im Desktop-Client noch im Klartext unter
`%LOCALAPPDATA%` gespeichert. Vor produktiver Assistant-Nutzung wird dieser
Clientpfad in der UI-Phase gehärtet (HTTPS außer Loopback, DPAPI,
Widerruf/Rotation). Die Migration wurde nicht remote angewendet und es wurden
keine Produktionsdaten verändert.

Verifikation: fokussierte Assistant-Tests 11/11, TypeScript ohne Fehler,
Produktions-Build erfolgreich und gesamte Suite 367/367 bestanden. Der
separate x64-Debug-Build des unveränderten WinUI-Pets war mit 0 Warnungen und
0 Fehlern erfolgreich. ESLint hat keine neue Warnung; die vorbestehende
Hook-Warnung in `app/account/page.tsx` bleibt unverändert. Es wurde nichts
deployed und keine Remote-Migration oder Produktionsabfrage ausgeführt.

## 2026-08-15 - Eigenständige Dokumentation des BWS-CSV-Imports

Die abgeschlossene Importarbeit wurde zusätzlich in
`docs/jira/bws-importdokumentation.txt` dokumentiert. Die Datei enthält die
vier Quelldateien mit Mengen und BWS-Schlüsselbereichen, die Importreihenfolge,
Story- und Xray-Test-Verknüpfungen, die Einschränkung der Task-Parent-
Hierarchie, die 250er-CSV-Grenze, die durchgeführten Stichproben sowie die
Abgrenzung zwischen importierten Testdefinitionen und tatsächlicher
Testausführung.

## 2026-08-15 - Vier CSV-Dateien in BWS importiert

Die vier angeforderten CSV-Dateien wurden in das neue Jira-Projekt `BWS`
importiert: 9 Epics, 111 Stories, 444 Tasks und 35 Xray-Testfälle. Jira weist
damit 599 Vorgänge im Projekt aus. Die neuen Schlüsselbereiche sind:

- Epics `BWS-1` bis `BWS-9`
- Stories `BWS-10` bis `BWS-120`
- Tasks `BWS-121` bis `BWS-564`
- Xray-Tests `BWS-565` bis `BWS-599`

Die Story-CSV wurde vor dem Import von den alten `KAN-*`-Epic-Referenzen auf
die neuen `BWS-*`-Epics abgebildet. Eine Stichprobe bestätigt bei `BWS-10` die
Überordnung unter Epic `BWS-1`.

Jira akzeptiert im teamverwalteten BWS-Projekt keine Task-Parent-Beziehung zu
einer Story. Der erste Importversuch mit diesem Feld wurde vollständig mit
0 angelegten Tasks abgewiesen. Danach wurden die Tasks ohne ungültiges
Parent-Feld importiert; jede Beschreibung enthält weiterhin die konkrete
Referenz `Zugehörige Story: BWS-*`. Wegen der Jira-Grenze von 250 Vorgängen je
CSV wurde der Taskbestand in 251 und 193 Vorgänge geteilt.

Die 35 neuen Xray-Tests wurden aus `new-test-cases.csv` erzeugt. Die dortigen
Story-Codes wurden über die Story-Importdaten auf BWS-Schlüssel aufgelöst und
über das Jira-Linkfeld `Test` mit den Stories verbunden. Eine Stichprobe zeigt
bei `BWS-565` die Verknüpfung zu `BWS-21`; die Story zeigt den Test als `is
tested by`.

Die BWS-Boardansicht wurde danach wieder geöffnet. Sie zeigt 590 Karten in
`Zu erledigen`; die 9 Epics sind im Board nicht als Karten enthalten, aber im
Projekt vorhanden. Keine alten KAN-Vorgänge oder bestehenden Projekte wurden
verändert.

## 2026-08-15 - BWS-Vorgangstypen auf Xray-Notwendigkeit geprüft

Die Klarstellung bezog sich auf Jira-Vorgangstypen, nicht auf einzelne
Vorgänge. Im neuen BWS-Projekt sind `Epic`, `Task`, `Story`, `Feature`, `Bug`
und die fünf Xray-Typen `Test`, `Precondition`, `Test Set`, `Test Plan` sowie
`Test Execution` verfügbar.

Für Xray sind `Test` und `Test Execution` der Kernumfang für Testfälle und
Testausführungen. `Test Plan`, `Test Set` und `Precondition` sind keine harte
Minimalpflicht, unterstützen aber die gewünschte vollständige Organisation,
Gruppierung und Wiederverwendung. Sie wurden deshalb nicht entfernt.

Die Standardtypen `Epic`, `Story`, `Task` und `Bug` bleiben für die fachliche
und technische Produktarbeit erforderlich. `Feature` ist kein Xray-Typ, aber
ohne einen eindeutigen Hinweis, dass er versehentlich angelegt wurde, kein
sicherer Löschkandidat. Es wurden daher keine Vorgangstypen gelöscht; die
Xray-Typen sind im BWS-Projekt verfügbar und boardfähig.

## 2026-08-15 - Xray-Integration im neuen BWS-Board geprüft

Das neu angelegte Jira-Projekt `BWS` mit Board 34 wurde geprüft. Xray ist auf
der Jira-Site aktiv: Im Erstellungsdialog des Projekts stehen neben `Epic`,
`Task`, `Story`, `Feature` und `Bug` auch die Xray-Vorgangstypen `Test`,
`Precondition`, `Test Set`, `Test Plan` und `Test Execution` zur Verfügung.
Damit ist Xray im neuen Projekt eingebunden und kann von diesem Board aus für
Testvorgänge, Testpläne und Testausführungen genutzt werden. Eine zusätzliche
Site- oder Board-Verbindung musste nicht eingerichtet werden.

Die Vorgangsinventur mit `project = BWS` und eine siteweite Prüfung mit
`ORDER BY created DESC` ergaben keine Vorgänge. Es existieren somit keine
zusätzlich angelegten Vorgänge, die für Xray bereinigt oder gelöscht werden
müssten. Das Board wurde anschließend wieder geöffnet und zur Prüfung
offen gelassen; es enthält aktuell noch keine Vorgänge.

## 2026-08-15 - KAN-897 nach Responsive-Fix erneut ausgeführt und Maßnahmenplan ergänzt

KAN-897 war der erste nicht bestandene Test in der absteigenden Prüfung der
Xray-Ausführung KAN-899. Die Ursache war die bereits bekannte Wide-Screen-
Darstellung aus KAN-1355. Der zugehörige Shop-Fix aus Commit `25f3257` war
bereits produktiv als Version
`0bd8f09e-40b3-45cc-aae1-8cb073904fe8` ausgerollt; deshalb war in diesem
Durchlauf keine weitere Codeänderung erforderlich.

Der vierte native Xray-Schritt von KAN-897 wurde mit dem tatsächlichen
Retest-Ergebnis aktualisiert und von `FAILED` auf `PASSED` gesetzt. Die drei
vorherigen Schritte waren bereits `PASSED`; damit steht KAN-897 im Testlauf
KAN-899 insgesamt auf `PASSED`. Als Nachweis wurden sieben neue Screenshots an
KAN-897 angehängt: 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440,
3840 x 2160, 768 x 1024 und 390 x 844 CSS-Pixel. Die Jira-Anhangszahl beträgt
damit 20.

Die zuvor erzeugte Textdatei enthielt bereits Tasks, Ziele, Erledigt-Kriterien,
Testschritte, erwartete Ergebnisse, Viewports und Screenshotregeln. Sie hatte
aber noch keinen ausdrücklich benannten Plan, welche Änderungen Mensch oder KI
vornehmen und welche Nachweise vor einem positiven Testergebnis vorliegen
müssen. Deshalb wurden `docs/jira/artifact_work/build-cascade-list.ps1` und
die daraus erzeugte
`docs/jira/generated/brandycards-kaskadische-task-test-liste.txt` erweitert:
globaler Maßnahmenplan, konkrete vier Task-Umsetzungen je Story sowie ein
Lösungs- und Nachweisplan je Xray-Test inklusive Korrekturzyklus bei FAIL.

## 2026-08-15 - Kaskadierende Gesamtübersicht für Jira-Tasks und Xray-Tests

Für die vorhandenen Jira-/Xray-Importdaten wurde eine vollständige, lesbare
Textübersicht erzeugt: 9 Epics, 111 Stories, 444 Tasks und 333 Xray-Tests. Die
Jira-Schlüssel der Tasks und Tests wurden anhand der bestätigten Importbereiche
KAN-121 bis KAN-564 sowie KAN-565 bis KAN-897 zugeordnet. Die Prüfung bestätigt
111 Stories mit jeweils vier Tasks und drei Tests; alle Schlüssel sind genau
einmal vertreten.

Die Kaskade trennt die technische Abhängigkeit von der tatsächlichen Jira-
Beziehung. Ein Task verweist auf seine Parent-Story, ein Test auf die von ihm
abgedeckte Story. Zusätzlich wurden fachliche Phasen abgeleitet: Vorbedingungen
für Security/Navigation/Design/Xray, Katalogbasis, Suche und Details,
Konto/Warenkorb, Transaktion, Anbieter, Betrieb, UX-Abnahme und abschließende
Test-/Release-Governance. Diese Querabhängigkeiten sind im Artefakt ausdrücklich
als empfohlene Reihenfolge markiert, weil der Export keine vollständige Blocks-
Matrix enthält.

Die Datei
`docs/jira/generated/brandycards-kaskadische-task-test-liste.txt` enthält je
Story die Fachbeschreibung, empfohlene Vorbedingungen, alle vier Tasks mit Ziel
und Erledigt-Kriterien sowie alle drei Xray-Tests mit Testart, Voraussetzungen,
Schritten, erwartetem Ergebnis, sieben Responsive-Viewports und
Screenshot-/Nachweisregeln. Der Generator liegt unter
`docs/jira/artifact_work/build-cascade-list.ps1`.

## 2026-08-15 - KAN-1355 behoben und betroffene Xray-Tests nachgeprüft

Der zuvor dokumentierte Wide-Screen-Fehler in KAN-1355 wurde reproduziert und im
Shop-Code behoben. Ursache war `.split-copy`: Bei sehr breiten Viewports konnte
das wachsende rechte Padding zusammen mit `max-width: 510px` die verfügbare
Inhaltsbreite auf 0 px reduzieren. Der Fix ist bewusst klein und setzt für das
Grid-Item `max-width: none` und `min-width: 0`. Die Änderung wurde als Commit
`25f3257 fix: keep offer section readable on wide screens` deployed; Cloudflare
meldete die produktive Version `0bd8f09e-40b3-45cc-aae1-8cb073904fe8` für
`shop.brandycards.de`.

Die lokale Prüfung war erfolgreich: `npm run lint` (nur die bekannte Warnung in
`app/account/page.tsx`), `npx tsc --noEmit` und `npm test` mit 356 von 356 Tests
bestanden. Produktiv wurden 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440,
3840 x 2160, 768 x 1024 und 390 x 844 CSS-Pixel geprüft. Die Angebotsüberschrift
hat in allen Viewports eine positive Breite; horizontaler Dokumentüberlauf wurde
nicht festgestellt. Je Viewport wurde ein Screenshot als Jira-Nachweis an KAN-820,
KAN-829 und KAN-1355 angehängt. KAN-1355 wurde danach auf `Fertig` gesetzt.

KAN-820 und KAN-829 wurden in Xray KAN-899 erneut mit vier nativen Schritten
ausgeführt und auf `PASSED` gesetzt. Neben den sieben Responsive-Screenshots
wurden je Test zusätzliche Shop-Belege für Ausgangslage, Navigation und Ergebnis
sowie die vier Xray-Schritt-Screenshots angehängt.

KAN-841 wurde ebenfalls erneut geprüft. Der Shop zeigt dabei keinen belegten
Tastaturfehler. Der In-App-Browser verarbeitet den Tab-Key jedoch nicht als
zuverlässigen Fokuswechsel: Nach `cua.keypress({keys:["TAB"]})` bleibt
`document.activeElement` auf `BODY`, obwohl fokussierbare Links vorhanden sind.
Deshalb wurde Schritt 3 mit Screenshot und tatsächlichem Ergebnis auf `TODO`
belassen, statt einen PASS zu erfinden. Eine abschließende Bewertung benötigt
einen vollwertigen Browser mit verifizierbarem Fokuswechsel.

## 2026-08-15 - Xray-Tests KAN-590 bis KAN-565 abgeschlossen

Der letzte in der bestehenden 333er-Xray-Ausführung vorhandene Restblock wurde
vollständig bearbeitet: KAN-590 bis KAN-565. Das sind 26 Tests, weil die
Testvorgänge bei KAN-565 beginnen; KAN-564 und niedrigere Schlüssel gehören
nicht zu dieser Ausführung. Die 26 Ergebnisse verteilen sich auf 17 `PASSED`
und 9 `FAILED`. Die Fehlfälle enthalten den Verweis auf KAN-1355.

Je Test wurden vier native Schritt-Screenshots sowie sieben Screenshots für die
vereinbarten CSS-Viewports 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440,
3840 x 2160, 768 x 1024 und 390 x 844 erstellt. Damit liegen für jeden der
26 Tests elf lokale Screenshot-Nachweise vor; die Upload-Routine bestätigte
die Jira-Anhänge. Die Viewport-Einstellung wurde zurückgesetzt und der Browser
auf KAN-565 als Handoff belassen.

KAN-580 zeigte zunächst keine nativen Schritte. Die vier Schritte wurden aus
der vorhandenen Xray-Testbeschreibung zusammengeführt und der Test danach
vollständig als FAILED ausgeführt. Kein vorhandener Test blieb technisch
blockiert. Mit diesem Block sind alle ursprünglich offenen 175 Tests von
KAN-739 bis KAN-565 abgearbeitet.

## 2026-08-15 - Xray-Tests KAN-640 bis KAN-591 abgeschlossen

Der nächste 50er-Block der Xray-Testausführung KAN-899 wurde in absteigender
Reihenfolge vollständig bearbeitet: KAN-640 bis KAN-591. Alle 50 Tests wurden
mit vier nativen Xray-Schritten ausgeführt und anschließend mit `PASSED` oder
`FAILED` bewertet. Die Einzelverteilung lautet 33 `PASSED` und 17 `FAILED`;
die Fehlfälle enthalten den Verweis auf den bekannten Fehler KAN-1355.

Je Test wurden vier Schritt-Screenshots sowie sieben Screenshots für die
vereinbarten CSS-Viewports 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440,
3840 x 2160, 768 x 1024 und 390 x 844 erstellt. Damit liegen je Test elf
lokale Screenshot-Nachweise vor; die Upload-Routine bestätigte die Anhänge an
den jeweiligen Jira-Vorgängen. Die Viewport-Einstellung wurde zurückgesetzt
und der Browser auf KAN-591 als Handoff belassen.

KAN-626 zeigte zunächst keine nativen Schritte. Die vier Schritte wurden aus
der vorhandenen Xray-Testbeschreibung zusammengeführt und der Test danach
vollständig als PASSED ausgeführt. Nach dieser Korrektur blieb kein Test
technisch blockiert. Der nächste offene Test ist KAN-590.

## 2026-08-15 - Xray-Tests KAN-690 bis KAN-641 abgeschlossen

Der nächste 50er-Block der Xray-Testausführung KAN-899 wurde in absteigender
Reihenfolge vollständig bearbeitet: KAN-690 bis KAN-641. Alle 50 Tests wurden
mit vier nativen Xray-Schritten ausgeführt und anschließend mit `PASSED` oder
`FAILED` bewertet. Die Einzelverteilung lautet 33 `PASSED` und 17 `FAILED`;
die Fehlfälle enthalten den Verweis auf den bekannten Fehler KAN-1355.

Je Test wurden vier Schritt-Screenshots sowie sieben Screenshots für die
vereinbarten CSS-Viewports 1440 x 900, 1920 x 1080, 2560 x 1440, 3440 x 1440,
3840 x 2160, 768 x 1024 und 390 x 844 erstellt. Das ergibt elf lokale
Screenshot-Nachweise je Test; die Upload-Routine bestätigte die Anhänge an
den jeweiligen Jira-Vorgängen. Die Viewport-Einstellung wurde nach dem Lauf
zurückgesetzt und der Browser auf KAN-641 als Handoff belassen.

Eine technische Besonderheit war Xrays Lazyload im eingebetteten Testfenster:
Die nativen Schritte wurden erst nach einem echten Scrollen des iframe geladen.
Der Vorbereitungsschritt wurde dafür stabilisiert. Danach waren alle 50 Tests
ausführbar; kein Test blieb technisch blockiert. Der nächste offene Test ist
KAN-640.

## 2026-08-14 - Xray-Tests um hohe Viewport-Aufloesungen erweitert

Die Responsive-Testvorgabe wurde auf alle 333 bestehenden Xray-Testvorgaenge
angewendet. Neben Desktop 1440 x 900, Tablet 768 x 1024 und Smartphone
390 x 844 sind jetzt Full HD 1920 x 1080, WQHD 2560 x 1440, Ultrawide
3440 x 1440 und 4K 3840 x 2160 fest dokumentiert. KAN-898 und KAN-899
wurden ebenfalls um dieselbe Regel ergaenzt.

Der erste CSV-Updateversuch war in dieser Jira-Konfiguration nicht sicher:
Jira interpretierte die Schluesselspalte als Neuanlage und erzeugte zunaechst
die Bereiche KAN-900 bis KAN-1150 sowie KAN-1151 bis KAN-1350. Zwei weitere
kleine Importproben erzeugten KAN-1351 bis KAN-1354. Alle diese exakten Bereiche
wurden anschliessend ueber Jira-Bulk-Loeschen entfernt und mit JQL als leer
verifiziert. Die bestehenden Tests wurden danach ueber das Jira-Bearbeitungs-
formular anhand ihrer internen IDs aktualisiert.

Die Abschlusspruefung ueber
`project = KAN AND issuetype = Test AND issuekey >= KAN-565 AND issuekey <= KAN-897 AND description ~ "Responsive Viewports"`
liefert 333 von 333 Tests. Der Builder und die vollstaendige sowie in zwei
Chunks geteilte Update-CSV sind fuer kuenftige Testfaelle vorbereitet.

Wichtig: Die Erweiterung aendert die Testdokumentation, nicht die Testergebnisse.
Die neuen Viewports wurden nicht rueckwirkend als ausgefuehrt markiert; bei einer
Ausfuehrung ist je definiertem Viewport ein eigener Screenshot nachzuweisen.

## 2026-08-10 — Aufmerksamkeitsstärkere Impact-Flyer erstellt

Die klaren Rasterlayouts wurden bewusst nicht mit zusätzlichem Fließtext
überladen. Für mehr Fernwirkung wurden stattdessen die Headlines vergrößert,
die Kontraste verschärft, rote Flächen als Blickführung ergänzt und die
Akzentfarben stärker gegeneinander gesetzt. So bleiben die Inhalte schnell
erfassbar, wirken am Messetisch aber präsenter.

Die Impact-Versionen A und B wurden als Vorder- und Rückseite gerendert. Die
PDFs und PNG-Vorschauen wurden visuell geprüft.

## 2026-08-10 — Zwei vollständig neue, rasterbasierte BrandyCards-Flyer erstellt

Die bisherigen Flyer wurden für diesen Durchlauf nicht weiterverwendet. Stattdessen
wurden zwei neue Systeme entwickelt: eine helle, redaktionelle Variante mit
klarer Seitenleiste und eine dunkle, kontrastreiche Variante mit modularen
Informationskacheln.

Beide Varianten arbeiten mit einem festen 12-Spalten-Raster, konsistenter
Ausrichtung, zwei Schriftstilen, begrenzten Farben und bewusstem Weißraum.
Die Inhalte wurden neu formuliert und QR-Code, Instagram-Hinweis sowie
MESSE26-Rabatt in klar getrennten Bereichen platziert. Vorder- und Rückseiten
wurden als HTML, PNG und PDF gerendert und visuell geprüft.

## 2026-08-10 — Eigenständigen Chrome-/Collector-Rahmen für Flyer erstellt

Die 1:1-Übernahme der Referenz war für den Flyer zu wörtlich. Deshalb wurde
der Rahmen neu als eigenes Gestaltungssystem aufgebaut: silberne Mehrfachkanten,
kantige Ecken, rote Diagonalelemente, dunkles Collector-Panel und ein eigenes
Namensfeld. Dadurch bleibt die gewünschte Kartenanmutung erhalten, ohne die
Referenzkarte zu duplizieren.

Logo, QR-Code, Instagram-Hinweis und MESSE26-Rabatt wurden in Vorder- und
Rückseite integriert. Die HTML-Datei wurde im Browser gerendert; beide PNGs
und die zweiseitige PDF wurden anschließend visuell geprüft.

## 2026-08-10 — Chrome-Rahmen pixelgenau als Flyer umgesetzt

Der Nutzer hat die Nutzungsrechte für das bereitgestellte Kartendesign bestätigt.
Deshalb wurde die Vorderseite nicht nachgezeichnet oder generativ verändert,
sondern als unveränderte Pixelvorlage übernommen. So bleibt der Rahmen exakt
identisch zum Referenzbild.

Für die Rückseite wurde der innere Bildbereich durch eigenständige BrandyCards-
Inhalte ersetzt. QR-Code, Instagram-Hinweis und MESSE26-Rabatt sind enthalten;
die Vorderseite wurde anschließend nochmals pixelweise gegen die Referenz
geprüft. Beide Seiten wurden als PNG und zweiseitige PDF ausgegeben.

## 2026-08-10 — Vier eigenständige Karten-inspirierte Messeflyer gestaltet

Die Referenzkarten liefern unterschiedliche Gestaltungssprachen: Gold/Premium,
dunkle Collector-Optik, starke rote Dynamik und eine chromatisch-futuristische
Rahmung. Diese Prinzipien wurden als eigenständige Flyer-Systeme umgesetzt,
ohne Topps-, Liga-, Vereins- oder Spieler-Elemente zu kopieren. So bleiben Logo,
QR-Code, Instagram-Hinweis und Messeaktion nutzbar, während die Flyer klar auf
die BrandyCards-Marke einzahlen.

Die vier Varianten G bis J wurden jeweils als Vorder- und Rückseite, PNG-
Vorschau, HTML-Datei und zweiseitige PDF gerendert und visuell geprüft.

## 2026-08-10 — Textüberarbeitung und Vorverkaufslink

- **Befund:** Die sichtbaren Angebotsformulierungen nutzten Gedankenstriche als
  Satzklammern. Das wirkte auf Deutsch und Englisch uneinheitlich und gab den
  Texten einen vorgefertigten Ton. Auf `/anfragen` wurde der globale breite
  CTA-Stil außerdem auf einen Link mitten im Fließtext angewendet. Dadurch
  entstanden auf Mobilgeräten eine lange Unterstreichung und abgetrennte
  Satzzeichen.
- **Entscheidung:** Die Sätze wurden in kurze, eigenständige Aussagen
  umformuliert. Deutsch und Englisch sind sinngemäß, aber nicht wortgleich.
  Der Vorverkaufshinweis besteht jetzt aus einem eigenen Linkabsatz und einer
  schlanken Inline-Linkklasse; es wurde keine Geschäftslogik verändert.
- **Ergebnis:** Zusätzlich wurden Versandspannen, Kontolöschung, Metadaten,
  API-Fehlertexte und Verkäufermails sprachlich bereinigt. Ein Regressionstest
  prüft die sichtbaren Textschlüssel auf Gedankenstriche und schützt die
  Inline-Darstellung des Vorverkaufslinks.

## 2026-08-10 — Vollständige EU-Länderauswahl im Checkout

- **Befund:** `app/checkout/page.tsx` bot nur Deutschland, Österreich,
  Belgien, Frankreich, Italien, Niederlande und Spanien an. Die API in
  `app/api/orders/route.ts` akzeptierte dagegen bereits alle 27 EU-
  Mitgliedstaaten.
- **Entscheidung:** Eine gemeinsame Liste in `lib/shipping-countries.ts`
  verhindert, dass Dropdown und Servervalidierung erneut auseinanderlaufen.
  Deutschland bleibt wegen der abweichenden Versandpauschale separat behandelt.
- **Ergebnis:** Alle EU-Länder sind auf Deutsch und Englisch auswählbar; die
  Versandkosten- und Adressvalidierung bleibt unverändert fachlich korrekt.

## 2026-08-10 — Drei eBay-Verkäufe mit nur einer Notification abgeglichen

- **Obsidian:** Artikel `398174236865` hat die einzige gespeicherte
  `ORDER_CONFIRMATION` erhalten. Sie wurde verarbeitet; Listing `ENDED`,
  Restmenge 0, `quantity_sold` 1, Inventory `SOLD`.
- **Vieira:** Artikel `398249844242` ist um 20:43:05 UTC durch den Sync als
  „nicht mehr in eBay-Aktivliste vorhanden“ deaktiviert worden. Es gibt keine
  passende Notification; `quantity_sold` blieb 0 und Inventory steht auf
  `UNAVAILABLE`.
- **Mikey Moore:** Der zeitlich passende Artikel `398174236850` wurde um
  20:52:04 UTC ebenfalls nur vom Sync deaktiviert. Es gibt keine passende
  Notification und `quantity_sold` blieb 0. Ein anderer Mikey-Moore-Artikel
  (`398174220750`) ist noch aktiv und daher nicht bestätigt.
- **Schlussfolgerung:** Der Fallback-Sync entfernt verschwundene Listings aus
  dem Shop, kann aber einen Verkauf nicht sicher von einer Beendigung oder
  Löschung unterscheiden. Die zwei Verkäufe wurden deshalb nicht als verkauft
  verbucht. Als nächste Maßnahme ist die eBay-Zustellhistorie zu prüfen; eine
  manuelle Produktionsbuchung wurde nicht vorgenommen.

## 2026-08-10 — Produktionsprüfung eBay-Notifications

- **Befund:** In `webhook_events` existiert insgesamt genau eine eBay-
  `ORDER_CONFIRMATION`, eingegangen am 2026-08-09 um 20:42:15 UTC für
  eBay-Bestellung `12-15006-19207`, Artikel `398174236865`, Menge 1.
- **Verarbeitung:** Das Ereignis ist `PROCESSED`, ohne `error_message`; es gibt
  in den letzten 48 Stunden weder `FAILED`- noch hängende `RECEIVED`-Ereignisse
  und keine doppelte `external_event_id`. Das Listing wurde auf `ENDED` mit
  Restmenge 0 und `quantity_sold` 1 gesetzt. Produkt und Inventory stehen auf
  `INACTIVE`/`SOLD`, verfügbar 0, verkauft 1.
- **Nebenprüfungen:** Die eBay-Sync-Läufe bis 2026-08-10 06:01 UTC sind
  `SUCCEEDED` mit `failed_count = 0`; die eBay-Outbox enthält keine offenen oder
  fehlgeschlagenen Aufträge.
- **Offene Auffälligkeit:** Die Betreiberangabe nennt mehrere Verkäufe, die
  Datenbank enthält aber nur diese eine eBay-Notification. Der nächste
  Prüfpunkt liegt deshalb bei der eBay-Notification-Zustellung bzw. der
  eBay-Developer-Konfiguration; Produktionsdaten wurden nicht verändert.

## 2026-08-09 — N4: Datenschutz, Aufbewahrung und Wiederherstellung

- **Minimierung:** `payments.raw_data` wird nur für abgeschlossene PayPal-
  Vorgänge (`CAPTURED`, `FAILED`, `VOIDED`, `REFUNDED`) nach 30 Tagen gelöscht.
  `webhook_events.payload` wird für endgültig verarbeitete oder fehlgeschlagene
  Ereignisse nach 30 Tagen geleert. Status, Beträge, Provider-IDs und Zeitpunkte
  bleiben als Nachvollziehbarkeits-Metadaten erhalten. Die PayPal-Capture-Route
  gibt keine Rohantwort mehr zurück.
- **Backup:** `scripts/backup-production.mjs` exportiert D1 und lädt nur echte,
  referenzierte R2-Uploads aus `products/` und `card-submissions/`. Die 302
  `ebay/...`-Schlüssel sind in der aktuellen Datenbank keine R2-Objekte,
  sondern Verweise auf direkt von eBay geladene Bild-URLs; sie werden deshalb
  als `externalAssets` im Manifest dokumentiert und nicht fälschlich als
  fehlende R2-Dateien gemeldet.
- **Restore:** `scripts/restore-backup.mjs` akzeptiert ausschließlich lokale
  Restore-Ziele. Der D1-Export wird für die isolierte Testinstanz nach
  Tabellen-/Fremdschlüsselabhängigkeiten geordnet. Der Testlauf am 2026-08-09
  stellte 543 Produkte, 4 Bestellungen, 4 Zahlungen und 7 Webhook-Ereignisse
  lokal wieder her; im Produktions-Backup gab es 0 fehlende R2-Objekte und 302
  externe eBay-Assets.
- **Dokumentation und offener Betriebspunkt:** Datenschutztext,
  [backup-restore.md](backup-restore.md) und N4 im Todo sind aktualisiert. Ein
  regelmäßig eingeplanter, verschlüsselter Offsite-Backup-Job ist bewusst noch
  nicht aktiviert, weil Zielsystem, Token, Aufbewahrung und Alarmierung eine
  Betreiberentscheidung benötigen.

## 2026-08-09 — N3: Ausfallsicherheit, Ressourcenlimits und automatische Bereinigung

- **Umsetzung:** Der geplante Worker-Lauf räumt verwaiste Uploads in den R2-
  Präfixen `card-submissions/` und `products/` auf. Eine 24-Stunden-Gnadenfrist
  schützt gerade angelegte Dateien; pro Lauf werden höchstens 100 Objekte
  gelöscht. Die manuelle Admin-Bereinigung nutzt dieselbe Funktion.
- **Ressourcenlimits:** JSON-Anfragen werden im Worker bei 64 KiB abgewiesen,
  bevor Routen sie puffern. eBay- und PayPal-Webhooks lesen den Stream direkt
  bis 256 KiB. Fehlende oder ungültige Größenangaben bei normalen JSON-Routen
  werden ebenfalls abgewiesen.
- **Timeouts und CSP:** Supabase-Auth, Supabase-Admin und eBay-OAuth brechen
  nach zehn Sekunden ab. Der Worker versieht `<script>`- und `<style>`-Blöcke
  mit dem Antwort-Nonce; `style-src 'unsafe-inline'` und das letzte React-
  Style-Attribut sind entfernt.
- **Verifikation:** 335 Tests, TypeScript, Lint, Produktions-Build und
  `git diff --check` waren erfolgreich. Die Produktionsrouten `/`, `/admin`,
  `/account` und `/api/products` antworteten mit HTTP 200; die CSP wurde ohne
  `unsafe-inline` und mit Script-/Style-Nonce geprüft.
- **Release:** Commit `b8fa35b9da8fd78cbdfa85e125f5af1a0163672f`, Cloudflare-
  Version `d7927df3-c86f-4a94-82ae-c4adf145bcaa` und Sites-Version 11 sind
  veröffentlicht. MFA ist Betreiber-seitig bestätigt; die Secret-Rotation
  bleibt der separate Betreiber-Schritt.

## 2026-08-09 — eBay-OAuth-Scopefehler im geplanten Sync behoben

- **Befund:** Der Produktions-Sync erhielt beim Refresh-Token-Aufruf HTTP 400
  `invalid_scope`. In `wrangler.toml` und `.env.example` waren neben Inventory-
  Rechten auch `sell.fulfillment*` und der Notification-Scope hinterlegt,
  obwohl der laufende Lese-Sync diese Rechte nicht benötigt. Ein Refresh-Token
  darf bei eBay nur die ursprünglich erteilten oder eingeschränkte Rechte
  anfordern; der zusätzliche Scope war im vorhandenen Token nicht enthalten.
- **Änderung:** Der reguläre Lese-Sync lässt das optionale `scope`-Feld beim
  Refresh weg und nutzt damit die ursprüngliche Consent-Zusammenstellung.
  Schreiboperationen verwenden ausschließlich `sell.inventory`. Die
  Notification-Subscription bleibt als eigenständige eBay-Konfiguration
  unangetastet.
- **Regression:** Ein Test stellt sicher, dass der Lese-Sync keinen expliziten
  Scope mehr an den Refresh-Endpunkt sendet; Konfigurationstests verhindern
  die versehentliche Vermischung von Shop-OAuth und Notification-Scopes.
- **Verifikation:** 330 Tests, TypeScript, Lint, Produktions-Build und
  `git diff --check` waren erfolgreich.
- **Live-Prüfung:** Der Cloudflare-Worker wurde als Version
  `3c3f6575-032a-4d58-9ea1-4fa1f42a6e5e` deployed. `/` und `/api/products`
  antworten mit HTTP 200; der erste eBay-Lauf danach (19:10 Uhr) steht in D1
  auf `SUCCEEDED`, während 19:07 Uhr der letzte alte `invalid_scope`-Fehler
  war.

## 2026-08-09 – eBay-ORDER_CONFIRMATION-Endpoint umgesetzt

- **Umsetzung:** Der öffentliche Endpoint `/api/ebay/notifications` beantwortet
  die eBay-Challenge und prüft eingehende `X-EBAY-SIGNATURE`-Header mit dem von
  eBay gelieferten ECDSA-Public-Key. Public Keys und Application-Tokens werden
  nur kurzzeitig im Worker-Cache gehalten; die Verifikations- und
  Nutzlastgrenze liegt vor der Datenbankarbeit.
- **Verbuchung:** `ORDER_CONFIRMATION` wird anhand der `notificationId`
  idempotent in `webhook_events` geführt. Listing- und Inventory-Menge werden
  in einem D1-Batch reduziert; ausverkaufte Listings und Produkte werden
  deaktiviert. `ebay_item_id` und `ebay_listing_id` werden beide akzeptiert.
- **Betrieb:** Nicht zuordenbare Listings oder lokale Bestandsabweichungen
  werden als Betriebsalarm gemeldet. Keine unsignierten Nutzlasten und keine
  simulierten Produktionsdaten wurden verwendet.
- **Offen:** Destination, Subscription, Verification-Secret, erneute OAuth-
  Zustimmung und der erste echte Verkauf müssen noch vom Betreiber in eBay bzw.
  Cloudflare eingerichtet und abgenommen werden.
- **Verifikation:** Der offizielle eBay-Signaturaufbau (inklusive SHA-1-
  Testfixture), Challenge-Hash, Payload-Parser und Route-Härtung sind durch
  sieben neue Tests abgedeckt.

Dieses Protokoll hält fest, welche spezialisierten Agents im Projekt eingesetzt wurden, welche Prüfaufträge sie erhielten und wie ihre Ergebnisse in die Umsetzung eingeflossen sind.

## 2026-08-09 – N2 Betriebsalarme ergänzt

- **Umsetzung:** Fehlgeschlagene eBay-Synchronisierungen, erstmals wieder
  aufgenommene hängende Outbox-Aufträge, endgültig fehlgeschlagene Outbox-
  Aufträge, erste PayPal-Webhook-Fehler je Event und nicht zugestellte wichtige
  E-Mails lösen jetzt eine zentrale Betreiberwarnung aus.
- **Sicherheit und Rauschen:** Wiederholungen bleiben bis zum endgültigen
  Zustand still. Alarmdetails werden einzeilig auf 600 Zeichen begrenzt und in
  HTML maskiert; Empfängeradressen und vollständige Fremdpayloads werden nicht
  in die Alarmkennung übernommen. Der Alarmversand darf den auslösenden Ablauf
  nicht scheitern lassen.
- **Grenze:** Die offizielle eBay-Seller-Notification-Integration und der
  echte bidirektionale Verkaufsnachweis bleiben als Betreiber-/eBay-Aufgabe
  offen. Es wurden keine Produktionsdaten geschrieben.
- **Verifikation:** `npx tsc --noEmit`, `npm run lint`, Build und `npm test`
  mit 323 Tests erfolgreich.

## 2026-08-09 – N1 Admin-Sicherheit umgesetzt

- **Umsetzung:** Supabase-AAL2 ist jetzt die zentrale Servervoraussetzung für
  alle Adminrouten. Die einzige AAL1-Ausnahme ist der geschützte
  `/api/admin/mfa/status`-Endpunkt, damit ein bereits zugelassenes Adminkonto
  TOTP einmalig einrichten kann. Die Adminseite zeigt dafür QR-Code/Secret und
  bestätigt den ersten 6-stelligen Code über Supabase MFA.
- **Frische Bestätigung:** Schreib-, Lösch-, eBay- und OAuth-Aktionen verlangen
  zusätzlich eine MFA-Bestätigung aus den letzten zehn Minuten. Der Browser
  fordert den Code unmittelbar vor der Aktion an; der Server prüft die
  AAL-/AMR-Claims des zuvor von Supabase validierten Tokens.
- **Auditierung:** Mutationen an Produkten, Bestellungen, Preisvorschlägen,
  Anfragen, Kartenangeboten, eBay-Sync, Outbox und OAuth werden in der bereits
  vorhandenen `audit_events`-Tabelle mit Admin, Aktion, Objekt und Zeit erfasst.
  Eine IP wird nur bei gesetztem `AUDIT_IP_HASH_SALT` als gesalzener Hash
  gespeichert, nie im Klartext.
- **Verifikation:** `npx tsc --noEmit`, `npm run lint`, `npm test` und der
  Build sind erfolgreich; alle 319 Tests sind grün. Keine Produktionsdaten
  wurden geschrieben.
- **Offen:** Die praktische MFA-Einrichtung des Adminkontos, Secret-Rotation
  und der erste echte eBay-Verkaufsnachweis müssen noch durch den Betreiber
  abgenommen werden.

## 2026-08-09 – Reihenfolge der priorisierten Todo neu geordnet

- **Auslöser:** Die bisherige Liste war nach Nutzen und Kosten sortiert, aber
  nicht vollständig nach fachlichen Abhängigkeiten.
- **Entscheidung:** Admin-Sicherheit steht jetzt vor der eBay-Automatisierung,
  weil MFA, Re-Authentifizierung, Auditierung und Secret-Rotation die
  privilegierten Schreibpfade absichern. Danach folgen Doppelverkaufsschutz,
  Ausfallsicherheit sowie Datenschutz und Wiederherstellung. Kundenkonto und
  Versand bauen auf dieser Grundlage auf; Sprache und Transaktionsmails
  vervollständigen diesen Prozess. Katalog-/Vorverkaufsfunktionen und SEO
  folgen erst danach, weil sie Reichweite erhöhen und stabile Transaktionswege
  voraussetzen.
- **Ergebnis:** Die acht bestehenden Arbeitspakete wurden in `docs/ai-todo.md`
  als N1 bis N8 entsprechend dieser Reihenfolge neu nummeriert. Inhalt und
  Umfang der offenen Punkte blieben unverändert.

## 2026-08-09 – Neue priorisierte Todo aus Sicherheits- und Funktionsanalyse

- **Auslöser:** Nach Abschluss der bisherigen Sicherheits-, Sprach- und
  Adminarbeiten wurde gefragt, welche Funktions- und Sicherheitslücken noch
  sinnvoll wären.
- **Befunde:** Der aktive eBay-Schreibpfad ist am laufenden Angebot noch nicht
  praktisch belegt; Seller-Notifications fehlen. Die R2-Orphan-Bereinigung ist
  vorhanden, wird aber nur über eine manuelle Adminroute aufgerufen. Die
  vorhandene `audit_events`-Tabelle wird nicht beschrieben. Kunden sehen keine
  Bestellhistorie oder Versandverfolgung; `SHIPPED` speichert weder Zeitpunkt
  noch Trackingdaten. PayPal-/Webhook-Rohdaten brauchen eine ausdrückliche
  Aufbewahrungsentscheidung. Manuelle Karten fehlen in den Startseiten-
  Höhepunkten, die Katalogpagination läuft clientseitig, und die
  Sprachpräferenz sowie E-Mail-Vorlagen sind nicht vollständig
  sprachübergreifend.
- **Entscheidung:** Gleichartige Punkte wurden zu acht Arbeitspaketen
  gebündelt und nach Nutzen vor Kosten geordnet: Betriebsstabilität, Admin-
  Sicherheit, Ausfallsicherheit, Datenschutz/Recovery, Kunden- und Versandfluss,
  Katalog, Sprache sowie SEO/Wartbarkeit. Es wurde kein Anwendungscode und
  keine Produktionsdaten geändert.

## 2026-08-09 – Vorverkauf ohne Festpreis, mit Bildern

- Auslöser: Vorverkaufskarten sollten bis zu zwei eigene Bilder aufnehmen können; zugleich sollte ein manuell angelegter Artikel keinen Festpreis mehr vortäuschen.
- Umsetzung: Die Adminanlage akzeptiert bis zu zwei geprüfte JPG-, PNG- oder WebP-Dateien, legt sie privat in R2 ab und verknüpft sie über `product_assets` mit einer öffentlichen, statusgeschützten Asset-Route. Die Vorverkaufs- und Detailansicht zeigen nur „Preis auf Anfrage“ und den Preisvorschlag.
- Preislogik: Manuelle Produkte bleiben mit `priceAmountCents: null` gespeichert. Ein Vorschlag darf ohne Listenpreis abgegeben werden; erst ein gültiger angenommener Vorschlag macht die Karte über die serverseitige Preisauflösung bestellbar. Beim Öffnen der Detailseite wird sie einmal in den Warenkorb gelegt. Alte Warenkorbeinträge ohne gültige Zusage werden im Checkout verworfen und die Bestellroute lehnt sie ab.
- Verifikation: `npx tsc --noEmit`, `npm run lint` und `npm test` mit 313/313 Tests erfolgreich. Es wurden keine Produktionsdaten geschrieben.

## 2026-08-06 – Capture/Expiry-Prüfung

- Agent: Dewey (`gpt-5.6-luna`, mittleres Reasoning)
- Auftrag: Capture- und Reservierungsablauf auf Rennen zwischen PayPal-Capture und Ablaufbereinigung prüfen.
- Ergebnis: Ein Vorab-Status-Read war nicht ausreichend; ein Capture konnte parallel zur Freigabe laufen.
- Umsetzung: Bestellung erhält vor dem externen Capture atomar den Status `PROCESSING`; Freigabe beansprucht eine Bestellung atomar über `PENDING → CANCELLED`; unklare Capture-Fehler werden nicht automatisch zurückgesetzt.

## 2026-08-06 – Bestell-/Webhook-Idempotenz

- Agent: Faraday (`gpt-5.6-luna`, mittleres Reasoning)
- Auftrag: Race Conditions und doppelte Verarbeitung in Bestellung, Settlement und PayPal-Webhooks prüfen.
- Ergebnis: Inventar-Updates mussten anhand betroffener Zeilen geprüft werden; Settlement und Webhook-Zustände mussten idempotent und monoton werden.
- Umsetzung: Bestandsreservierung prüft D1-Änderungszahlen, Teilreservierungen werden kompensiert, Settlement bucht nur nach erfolgreichem `ACTIVE → CONVERTED`, und PayPal-Events können nach `FAILED` erneut verarbeitet werden.

## 2026-08-06 – eBay-Synchronisierung

- Agent: Pauli (`gpt-5.6-luna`, mittleres Reasoning)
- Auftrag: Bestehenden eBay-Code und die Einbindung für Verkaufsbenachrichtigungen prüfen.
- Ergebnis: Der aktuelle eBay-Code ist lesend; für bidirektionale Synchronisierung müssen Angebots-ID, Benachrichtigungsroute und retry-fähige Schreibvorgänge ergänzt werden. Menge 0 darf außerdem nicht wieder als aktives Produkt erscheinen.
- Umsetzung: `ebayOfferId` wird separat persistiert, und eBay-Angebote mit Menge 0 werden lokal als beendet/inaktiv geführt. Die nächste Ausbaustufe ist die idempotente eBay-Verkaufsbenachrichtigung und eine Outbox für eBay-Bestandsänderungen.

## 2026-08-06 - eBay-Outbox und Wiederanlauf

- Agent: Hilbert (`gpt-5.6-luna`, mittleres Reasoning)
- Auftrag: Schema, eBay-Client, PayPal-Webhook und eBay-Synchronisierung auf eine sichere, retry-fähige bidirektionale Bestandsarchitektur prüfen.
- Ergebnis: Lokale Bestandsänderung und Outbox müssen zusammengehören; Aufträge sollen absolute Zielzustände enthalten und über Deduplizierung sowie Leases erneut übernommen werden können. Für eBay-Verkäufe wird zusätzlich eine fachliche Idempotenz pro Bestellposition benötigt.
- Umsetzung: Die erste Ausbaustufe führt `ebay_outbox` mit Dedupe-Key, Claim-Lease, Backoff und dauerhaftem Fehlerstatus ein. Nach einer bezahlten Webshop-Bestellung wird das eBay-Angebot asynchron zum Beenden vorgemerkt; der Worker verarbeitet bis zu zehn Aufträge pro Lauf. Der Schreibpfad bleibt bis zur Freigabe der eBay-Schreibberechtigung über `EBAY_WRITE_ENABLED` deaktiviert.

## Arbeitsweise

## 2026-08-06 - eBay-Importfilter und Dubletten

- Ausloeser: Der Admin-Sync importierte unveroeffentlichte API-Angebote und konnte dadurch alte Testangebote bzw. doppelte Eintraege anzeigen.
- Direkte Codepruefung: Die eBay-Offer-Abfrage filterte weder `PUBLISHED` noch `listingStatus=ACTIVE` und nutzte die `next`-Pagination nicht.
- Umsetzung: Nur veroeffentlichte, aktive Listings werden uebernommen; `next`-Seiten werden gelesen; doppelte Listing-IDs werden innerhalb eines Sync-Laufs uebersprungen. Nicht mehr sichtbare lokale Eintraege werden weiterhin sicher deaktiviert statt geloescht.
- Verifikation: `npm run lint` (keine Fehler, nur bestehende Bildoptimierungs-Warnungen) und `npm test` (2/2 Tests erfolgreich).
- Hinweis: Die verfuegbaren spezialisierten Agent-Slots waren in diesem Lauf bereits belegt; deshalb wurde diese Korrektur als direkte Codepruefung nachvollziehbar dokumentiert und nicht einem neuen Agenten zugeschrieben.

## 2026-08-06 - Aktive eBay-Verkaufsangebote statt Inventory-Entwuerfe

- Ausloeser: Der Sync lieferte nur 10 Datensaetze, obwohl im eBay-Konto 294 aktive Artikel sichtbar sind. Die zuvor genutzte Inventory-API enthielt zusaetzlich alte, nie veroeffentlichte Testangebote.
- Umsetzung: Der Import fragt jetzt `GetMyeBaySelling` mit der aktiven Liste und 200 Eintraegen pro Seite ab. Dadurch werden auch Angebote importiert, die direkt in der eBay-Oberflaeche erstellt wurden; lokale IDs basieren auf der stabilen eBay-ItemID. Die bestehende Deduplizierung und Deaktivierung nicht mehr aktiver Listings bleibt erhalten.
- Verifikation: `npm test` erfolgreich (2/2); `npm run lint` ohne Fehler, nur die bekannten `img`-Optimierungswarnungen.
- Agententransparenz: Die spezialisierten Agent-Slots waren weiterhin belegt. Deshalb wurde die Umsetzung direkt vorgenommen; es wurde kein nicht ausgefuehrter Agentenlauf behauptet.

## 2026-08-06 - Bestandsaufnahme: Schreibpfad durch API-Wechsel unterbrochen

- Ausloeser: Bestandsaufnahme des Gesamtstands nach der Serie von eBay-Sync-Korrekturen.
- Befund (offen, nicht behoben): Der Wechsel von der Inventory-API auf die Trading-API
  (`GetMyeBaySelling`) hat den zuvor gebauten Schreibpfad stillgelegt. `mapActiveListing`
  setzt `ebayOfferId` fest auf `null`, weil `GetMyeBaySelling` nur eine ItemID liefert.
  Dadurch ist `ebay_listings.ebay_offer_id` fuer alle importierten Angebote NULL,
  `enqueueEbayWithdraw` bricht sofort ab, und die komplette `ebay_outbox` samt
  Lease, Backoff und Dedupe-Key erhaelt nie einen Auftrag. Folge: Eine im Webshop
  bezahlte Bestellung beendet das eBay-Angebot nicht - Doppelverkaufsrisiko.
- Naechster Schritt: Der Schreibpfad muss auf die Trading-API umgestellt werden
  (`EndItem` / `EndFixedPriceItem` ueber die ItemID) statt auf den Inventory-API-Aufruf
  `offer/{offerId}/withdraw`. Alternativ muessten Angebote wieder ueber die Inventory-API
  gefuehrt werden - das war aber genau der Grund fuer den Wechsel, weil dort nur 10 statt
  294 Artikel sichtbar waren. Die Outbox-Mechanik selbst bleibt unveraendert nutzbar;
  nur Operation und Identifikator aendern sich.
  **Nachtrag, die Empfehlung hat sich geaendert:** Dass der Schreibpfad ueber die
  Trading-API gehen muss, gilt weiterhin. Der Aufruf soll aber
  **`ReviseInventoryStatus` mit Menge 0** sein, nicht `EndItem` -- siehe
  [ai-todo.md](ai-todo.md) Punkt 6, das ist die maßgebliche Fassung. `EndItem`
  ist endgueltig und erzwingt beim Wiedereinstellen eine neue ItemID, wodurch
  die lokale Zuordnung bricht. Zu pruefen ist vorher, ob im eBay-Konto die
  **Out-of-Stock-Option** aktiv ist: ohne sie beendet eBay ein Festpreisangebot
  mit Menge 0 selbst, und bei Einzelstuecken waere dieser Weg genauso
  endgueltig wie `EndItem`.
- In diesem Lauf behoben: Zwei kaputte Umlaut-Encodings in Nutzerfehlermeldungen
  (`lib/ebay-client.ts`, `app/api/card-submissions/route.ts`), fehlendes `all()` in der
  handgeschriebenen `D1PreparedStatement`-Deklaration (`tsc --noEmit` war rot, CI prueft
  keine Typen), Entfernung der toten Inventory-API-Reste `getAllInventoryItems`,
  `getOffersForSku`, `ebayJson` und `activeListingCache` - `getOffersForSku` erzeugte
  gefaelschte Offer-IDs der Form `trading-<itemId>`, die beim spaeteren Verdrahten
  falsche Withdraw-Calls ausgeloest haetten. Zusaetzlich protokolliert
  `enqueueEbayWithdraw` den fehlenden Offer-Bezug jetzt, statt still `false` zurueckzugeben.
- Ebenfalls offen: `drizzle/meta/_journal.json` endet bei `0002_add_usernames`, waehrend
  `0003`-`0005` handgeschrieben dazukamen. `npm run db:generate` wuerde gegen den veralteten
  Snapshot diffen und diese Migrationen erneut erzeugen. Vor dem naechsten Schema-Schritt
  muss der Journal-/Snapshot-Stand nachgezogen werden.
- Verifikation: `npm run lint` (0 Fehler, 4 bekannte `img`-Warnungen), `npm test` (2/2),
  `npx tsc --noEmit` jetzt fehlerfrei.

## 2026-08-06 - 539 statt 294 Produkte: SoldList wurde mitimportiert

- Ausloeser: Das Admin-Dashboard zeigte 539 Produkte, obwohl im eBay-Konto nur
  294 aktive Angebote existieren.
- Datenbefund (Produktions-D1, nur lesend abgefragt): 533 Produkte `ACTIVE`, 6 `INACTIVE`.
  In `ebay_listings` 530 aktive Zeilen mit 530 *verschiedenen* ItemIDs, aber nur
  333 verschiedenen Titeln. Die doppelten Titel verteilten sich auf getrennte
  Nummernkreise (`39801…` gegenueber `39817…`/`3982…`) - typisch fuer Karten, die
  verkauft und anschliessend neu eingestellt wurden.
- Ausschluss Deaktivierung: Die beiden letzten Laeufe standen auf `SUCCEEDED` mit
  `failed_count = 0` und `deactivated_count = 0`, verarbeiteten aber 530 Listings.
  Die Deaktivierung wurde also nicht uebersprungen - eBay lieferte der Anwendung
  tatsaechlich 530 Eintraege.
- Ursache: `DetailLevel` ist ein Request-Feld von `GetMyeBaySelling`. Mit `ReturnAll`
  und ohne ausdruecklichen Opt-out liefert eBay zusaetzlich `SoldList`, `UnsoldList`,
  `ScheduledList` und `BidList`. `parseTradingResponse` suchte `<Item>`-Bloecke im
  *gesamten* Dokument und sammelte damit auch verkaufte und unverkaufte Artikel ein.
  Eine verkaufte und neu eingestellte Karte erschien dadurch zweimal: einmal unter
  der alten, verkauften ItemID aus der SoldList und einmal unter der neuen aktiven.
  Auch `TotalNumberOfPages`/`TotalNumberOfEntries` wurden aus dem ganzen Dokument
  gelesen und konnten zu einem fremden Container gehoeren.
- Umsetzung: Das Parsen ist jetzt auf den `<ActiveList>`-Container begrenzt, die
  Pagination wird aus dessen `<PaginationResult>` gelesen, und die uebrigen Container
  werden im Request ausdruecklich mit `<Include>false</Include>` abgewaehlt. Die
  Deaktivierung laeuft in Bloecken zu 50 statt vier Einzelqueries pro Listing, weil
  der naechste Lauf den aufgelaufenen Rueckstand auf einmal abraeumen muss.
  Die Produktkachel im Admin-Dashboard zaehlt nur noch `ACTIVE`-Produkte; deaktivierte
  Zeilen bleiben als Historie bestehen und haetten die Zahl sonst weiter verfaelscht.
- Verifikation: Neuer Regressionstest `tests/ebay-active-list.test.mjs` mit gestubbtem
  eBay-Antwortdokument (ActiveList plus SoldList mit gleichen Titeln unter aelteren IDs).
  Der Test wurde gegen den alten Parserstand gegengeprueft und schlaegt dort fehl.
  `npm test` 4/4, `npm run lint` ohne Fehler, `npx tsc --noEmit` sauber.
- Offen: Die rund 236 veralteten Zeilen stehen noch auf `ACTIVE`. Der naechste
  Sync-Lauf setzt sie ueber die Deaktivierung auf `ENDED`/`INACTIVE`. Bis dahin zeigt
  der Shop sie weiterhin an.

## 2026-08-06 - Deploy-Fehler: Client-Bundle ohne Supabase-Konfiguration

- Ausloeser: Nach dem Deploy des eBay-Importfixes zeigte `/admin` nur noch
  "Supabase ist noch nicht konfiguriert. Bitte .env.local anlegen." Vorher lief die Seite.
- Ursache: Der Build lief aus einem Git-Worktree. Worktrees uebernehmen ignorierte
  Dateien nicht, also fehlte dort `.env.local`. `NEXT_PUBLIC_SUPABASE_URL` und
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` werden zur *Buildzeit* ins Client-Bundle
  inlined - nicht zur Laufzeit gelesen. Ohne sie faellt `getSupabaseBrowserClient()`
  in den Fehlerzweig. Die Cloudflare-Secrets helfen hier nicht, sie erreichen nur den
  Worker zur Laufzeit, nicht den Client-Build.
- Umsetzung: `.env.local` in das Build-Verzeichnis kopiert, sauber neu gebaut und
  erneut deployed (Version `baba72cb`). Der Deploy-Abschnitt im README benennt die
  Bedingung jetzt ausdruecklich, inklusive Worktree-Falle und Pruefkommando.
- Verifikation: Vor dem Deploy wurde das Client-Bundle geprueft - beide
  `NEXT_PUBLIC_`-Werte enthalten, und kein Server-Secret enthalten
  (`EBAY_CLIENT_SECRET`, `EBAY_REFRESH_TOKEN`, `EBAY_CLIENT_ID`, `ADMIN_EMAILS`).
  `EBAY_ENVIRONMENT` schlug zunaechst an, ist aber woertlich "production", ein
  generisches Wort, das ohnehin offen in `wrangler.toml` steht - falsch positiv.
  Nach dem Deploy im live ausgelieferten Chunk gegengeprueft: beide Werte vorhanden,
  Fehlerzweig wegoptimiert, `/admin` antwortet mit HTTP 200.
- Lehre: Ein Deploy ist erst verifiziert, wenn eine Seite geprueft wurde, die
  Client-Konfiguration braucht. Startseite und `/api/products` waren durchgehend
  gesund und haetten den Fehler nie gezeigt.

## 2026-08-06 - D1-Parametergrenze in der Batch-Deaktivierung

- Ausloeser: Der Admin-Sync brach ab mit
  `D1_ERROR: too many SQL variables at offset 1070: SQLITE_ERROR`.
- Ursache: Selbst eingebaut. Die Umstellung der Deaktivierung auf Bloecke zu 50 erzeugte
  ein Sammel-`INSERT` in `sync_events` mit 50 Zeilen x 6 Spalten = 300 gebundenen
  Parametern. D1 begrenzt die Parameter pro *Statement*; die drei `inArray`-Updates
  lagen mit rund 42 harmlos darunter, der Insert nicht.
- Umsetzung: Die Blockgroessen kommen jetzt aus `lib/d1-limits.ts` statt aus einer
  Schaetzung. Die Id-Listen bleiben bei 40, das Event-Insert wird innerhalb desselben
  Batches in Teilstuecke zu 15 Zeilen zerlegt (90 Parameter).
- Verifikation: `tests/d1-limits.test.mjs` misst die von Drizzle *tatsaechlich* erzeugten
  SQL-Parameter statt sie zu zaehlen, und enthaelt den kaputten 50-Zeilen-Fall als
  Fixture, der die Grenze nachweislich reisst. Gemessen: 15 Zeilen -> 90 Parameter,
  40 Ids -> 42 Parameter, vorher 50 Zeilen -> 300 Parameter.
- Wichtiger Nebenbefund: Der fehlgeschlagene Lauf belegt, dass der Importfix greift.
  Er verarbeitete 294 Updates plus 3 Neuimporte, also 297 Angebote - gegenueber 530 in
  allen Laeufen davor. Der Parserfix ist damit gegen die echte eBay-API bestaetigt,
  nicht nur gegen den Stub. Es fehlt nur noch ein Lauf, der die Deaktivierung ausfuehrt.

## 2026-08-07 - Vollstaendige Sicherheitspruefung

- Auftrag: [security-audit-brief.md](security-audit-brief.md), drei Phasen
  (pruefen, beheben, nachpruefen). Bericht: [security-findings.md](security-findings.md).
- Ergebnis: 17 Befunde, drei hoch. 15 behoben, je mit einem Test, der den
  Angriff nachstellt und ohne die Korrektur rot ist.

**Warum die Loesungen so aussehen, wie sie aussehen:**

- **Der Sanitizer war nicht das Problem, sein Nachbar war es.** `sanitizeHtml`
  hielt 49 Umgehungsversuchen stand — verschachtelte und sich neu bildende
  Tags, `<svg>`/MathML, `&#x6a;avascript:`, Steuerzeichen in URLs, NULL-Bytes,
  mXSS-Muster. Er ist tragfaehig, weil er Attribute nicht durchreicht, sondern
  aus einer Allowlist **neu serialisiert**. Der Fehler sass eine Ebene weiter:
  `parseEbayDescription` rief auf dem sanitisierten Ergebnis `decode()` auf und
  gab es als HTML zurueck. Aus korrekt escapetem `&lt;img onerror=…&gt;` wurde
  wieder ein lebendes Tag. Die Lehre ist nicht „kein Eigenbau", sondern:
  **nach einem Sanitizer darf niemand mehr am Ergebnis arbeiten.** Deshalb
  escaped der Rueckfallzweig jetzt selbst, statt sich auf die Vorstufe zu
  verlassen.
- **Zwei Rate-Limit-Namespaces statt einem.** Ein Cloudflare-Binding traegt
  genau eine Grenze. Die Parameter `limit`/`windowMs` im Code waren mit Binding
  wirkungslos — sie sahen aus wie drei verschiedene Grenzen und waeren eine
  gewesen. Jetzt gibt es `RATE_LIMITER` (10/60s) und `RATE_LIMITER_STRICT`
  (3/60s), und `tests/rate-limit.test.mjs` vergleicht die Tabelle im Code mit
  `wrangler.toml`, damit beide nicht auseinanderlaufen.
- **Die Bestandsgrenze zaehlt Einheiten, nicht Bestellungen.** Drei
  Bestellungen zu zwanzig richten denselben Schaden an wie eine zu sechzig —
  was weh tut, ist die Zahl unverkaeuflicher Karten. `MAX_RESERVED_UNITS_PER_USER`
  ist bewusst auf denselben Wert wie ein voller Warenkorb gesetzt: niemand, der
  vorher bestellen konnte, wird abgewiesen.
- **`releaseExpiredReservations` bekam einen `userId`-Parameter**, statt eine
  zweite Funktion zu bauen. Die Bestellroute gibt damit zuerst die eigenen
  abgelaufenen Reservierungen des Kunden frei — sonst haette die neue Grenze
  jemanden bis zu einer Stunde ausgesperrt wegen eines Checkouts, den er vor
  15 Minuten abgebrochen hat.
- **Testbarkeit erzwang kleine Schnitte.** `lib/rate-limit.ts`,
  `lib/app-user.ts` und die Routen importieren `cloudflare:workers` bzw. `../db`
  und lassen sich im Node-Testrunner nicht laden. Die Entscheidungen wanderten
  deshalb in `lib/rate-limit-policy.ts`, `lib/order-guard.ts`,
  `lib/form-bot-guard.ts`, `lib/security-headers.ts` und `lib/user-profile.ts`
  — dasselbe Muster, das `pickAcceptedPrices` in `lib/price-offers.ts` schon
  vorgibt.
- **Honeypot und Zeitschwelle statt Turnstile**, nach Entscheidung des Nutzers:
  unsichtbar, kostenlos, kein Fremddienst, keine Ergaenzung der
  Datenschutzerklaerung. Eigenes Loch dabei gefunden und geschlossen:
  `useFormSubmit` ruft nach Erfolg `form.reset()`, was den Zeitstempel auf `0`
  zuruecksetzt — die Schwelle haette nur beim ersten Absenden je Seitenaufruf
  gegriffen.
- **Die CSP laeuft berichtend**, ebenfalls nach Entscheidung des Nutzers. Eine
  zu enge Regel legt den Shop lahm, und ohne echten Verkehr laesst sich das
  nicht unterscheiden.
- **Ein Fix wurde zurueckgenommen, weil er falsch war.** `requireAdmin` vor der
  eBay-OAuth-Rueckseite haette den Anschluss zerstoert: eBay leitet den
  *Browser* dorthin um, und eine Navigation traegt keinen
  `Authorization`-Header. SEC-12 blieb offen, mit der Begruendung als Kommentar
  an der Route, statt halb gebaut zu sein.
- **Nebenbefund, vorbestehend:** `npm run dev` startete nicht. `nodejs_compat`
  war doppelt deklariert (`vite.config.ts` **und** `wrangler.toml`), und das in
  `@cloudflare/vite-plugin@1.37.1` gebuendelte `workerd` kannte das
  `compatibility_date 2026-08-05` nicht. Ohne beides haette sich keine
  Korrektur lokal nachstellen lassen — was der Auftrag ausdruecklich verlangt.

**Verifikation:** `npm test` 63 → 85 Tests, alle gruen. `npx tsc --noEmit`
sauber. `npm audit` gesamt 18 → 16, *hoch* 13 → 8. Live gegen einen lokalen
Server gemessen: 429 nach 10 Anfragen, `411` bei `Transfer-Encoding: chunked`,
Sicherheits-Kopfzeilen an `/`, `/karten` und `/api/products`,
`cache-control: public, max-age=60` im Erfolgsfall und `no-store` im Fehlerfall,
und der SEC-01-Payload kommt escaped aus `GET /api/products/[id]` zurueck.

## 2026-08-07 - Aufbewahrungsfrist und Datenschutztext (SEC-15, SEC-16)

Nachtrag zur Sicherheitspruefung: die beiden Befunde, die auf eine Entscheidung
des Betreibers gewartet haben. Ergebnis: **17 von 18 Befunden geschlossen.**
*(Korrigiert; der Eintrag sagte „16 von 17". SEC-18 kam nach Phase 1 dazu und
ist ebenfalls behoben. Maßgeblich ist die Statusübersicht in
[security-findings.md](security-findings.md).)*

**Warum die Loesung so aussieht:**

- **Die Frist zaehlt nur abgeschlossene Vorgaenge.** `ACCEPTED` ist bewusst
  ausgenommen — daraus wird ein Ankauf, und fuer Kaufvorgaenge gelten handels-
  und steuerrechtliche Aufbewahrungspflichten, die eine 90-Tage-Loeschung
  ueberschreiben wuerden. Offene Vorgaenge (`NEW`, `IN_REVIEW`, `NEEDS_INFO`)
  bleiben ebenfalls, unabhaengig vom Alter.
- **Der Loeschlauf haengt am Cron, nicht an einer Schaltflaeche.** Eine Frist,
  die jemand von Hand ausloesen muss, ist keine Frist. Die Admin-Route bleibt
  zusaetzlich bestehen, damit man nicht bis zur naechsten Stunde warten muss.
- **R2 vor der Datenbankzeile.** Bricht das Loeschen eines Objekts ab,
  verschwindet die Zeile trotzdem und das Objekt ist verwaist — der bestehende
  Waisenlauf sammelt es binnen 24 Stunden ein. Andersherum bliebe eine Zeile
  zurueck, die auf ein fehlendes Bild zeigt, und der Adminbereich zeigte einen
  kaputten Vorgang. Selbstheilend statt sauber-aussehend.

**Die eigentliche Falle war das Zeitstempelformat, und sie waere ein eigener
Befund gewesen.** `card_submissions.created_at`/`updated_at` bekommen ihre
Werte aus SQLites `CURRENT_TIMESTAMP` und stehen damit im Format
`YYYY-MM-DD HH:MM:SS`; der uebrige Anwendungscode schreibt ISO-8601 mit `T` und
`Z`. Ein direkter `<=`-Vergleich zwischen beiden Formen ist falsch, weil `' '`
(0x20) vor `'T'` (0x54) sortiert. Gemessen an der lokalen Datenbank, Stichtag
heute Mitternacht, ein Vorgang von heute 23 Uhr im Bestand:

```
naiver Vergleich loescht : 4 Vorgaenge
mit datetime() loescht   : 3 Vorgaenge
```

Ein Vorgang von **heute** waere als 90 Tage alt geloescht worden. Beide Seiten
laufen deshalb ueber SQLites `datetime()`, und `parseDbTimestamp` liest in
JavaScript beide Formate. Ein Datumsfehler in einem Loeschlauf ist die
unangenehmste Sorte Fehler: Er faellt erst auf, wenn die Daten weg sind.

**Nebenbefund aus der Tarifauskunft:** Der Betreiber hat den Cloudflare-**Free**
-Tarif bestaetigt. Damit ist SEC-05 kein Kostenproblem, sondern ein
Ausfallproblem — 5 Mio. gelesene D1-Zeilen pro Tag fuer alles zusammen, rund
2 900 Aufrufe von `/api/products` brauchen sie auf, danach antwortet jede
datenbankgestuetzte Seite mit 503. Der Befund wurde von *mittel* auf *hoch*
hochgestuft; die eingebaute Zwischenspeicherung nimmt ihm den Boden, wirkt aber
erst mit dem Deploy.

**Verifikation:** `npm test` 85 → 96 Tests, alle gruen. `npx tsc --noEmit` und
`npm run lint` sauber. Der Loeschlauf wurde gegen die **lokale** D1 mit
Zeitstempeln in beiden Formaten geprueft; kein schreibender Eingriff in
Produktionsdaten.

## 2026-08-07 - Doppelverkaufsschutz: Import alle 10 Minuten, Bestandspruefung vor der Zahlung

Punkt 1 und 3 aus [ai-todo.md](ai-todo.md). Beide zielen auf dieselbe Richtung:
*auf eBay verkauft, der Shop weiss es nicht*. Die andere Richtung bleibt offen
(Punkt 6).

**Warum die Loesungen so aussehen:**

- **Der Import allein reicht nicht, die Pruefung allein auch nicht.** Ein
  10-Minuten-Takt verkleinert das Fenster, schliesst es aber nie: Die Karte
  kann zwei Minuten vor der Zahlung weggehen. Die Bestandspruefung schliesst
  genau diesen Rest, ist dafuer aber teuer (ein GetItem je Karte) und darf
  deshalb nur an der Kasse laufen, nicht bei jedem Seitenaufruf. Zusammen
  ergeben sie ein Netz, einzeln nicht. `tests/ebay-stock-check.test.mjs` haelt
  die Kopplung fest, indem es den Cron mitprueft.
- **Gerechnet statt geschaetzt.** Ein Sync-Lauf sind **drei** eBay-Aufrufe: ein
  Token plus zwei Seiten a 200 Angebote bei 296 Karten. 432 statt 72 am Tag,
  gegen ein Standardkontingent von 5 000. Die naheliegende Sorge beim
  Sechsfachen der Frequenz ist damit ausgeraeumt, ohne sie zu vermuten.
- **Zweite Wirkung des Crons, die leicht uebersehen wird:**
  `releaseExpiredReservations` haengt am selben Lauf. Abgelaufene
  Reservierungen kommen jetzt nach 15-25 statt nach 15-75 Minuten zurueck --
  das entschaerft SEC-03 zusaetzlich zu der dort eingebauten Obergrenze.
  **Nachtrag: Diese Zahl gilt nicht mehr.** Der 10-Minuten-Takt wurde am selben
  Tag zurueckgenommen (`0 */2 * * *`), damit sind es **15-135 Minuten**. Die
  Obergrenze aus SEC-03 traegt den Schutz seitdem allein.
- **Die Leitregel steht ueber der Wirksamkeit: ein eBay-Ausfall darf nichts
  blockieren.** Unbekannt gilt nie als ausverkauft. Fehlende Antwort, HTTP-
  Fehler, eBay-Fehlermeldung, unlesbare Menge -- alles laesst den Kauf durch.
  Der Grund ist eine Abwaegung, keine Bequemlichkeit: Ein Shop, der wegen einer
  fremden API nicht verkaufen kann, richtet mehr Schaden an als der seltene
  Doppelverkauf, den die Pruefung verhindert. Vier Tests halten das fest, und
  ein Test prueft, dass auch ein Fehler *in der Pruefung selbst* freigibt.
- **Der Unterschied zwischen `null` und `0` traegt die ganze Regel.** Deshalb
  gibt `parseItemAvailability` bei einer unlesbaren Antwort ausdruecklich
  `null` zurueck und nicht `0`, und `getEbayAvailability` laesst eine
  gescheiterte Karte aus der Map *fehlen*, statt sie mit 0 einzutragen. Beides
  hat einen eigenen Test, weil ein spaeterer "Aufraeumer" hier sonst leicht
  eine 0 einsetzt und damit die Regel umdreht.
- **Geprueft wird an zwei Stellen, nicht an einer.** Vor dem Gang zu PayPal
  (freundlich: der Kunde erfaehrt es, bevor er zahlt) und unmittelbar vor dem
  Einzug (wirksam: das ist der letzte Moment vor dem Geld). Im Capture bewusst
  **vor** dem `PENDING -> PROCESSING`-Riegel -- danach bliebe eine abgelehnte
  Bestellung in `PROCESSING` haengen und kaeme nur von Hand wieder heraus.
- **Kein aktives `void` der PayPal-Order.** Sie bleibt uneingezogen und
  verfaellt. Ein Void waere ein weiterer Fremdaufruf mit eigenen Fehlerpfaden
  an der Stelle, an der gerade schon etwas schiefgelaufen ist.
- **Ein Tokenaufruf je Bestellung**, nicht je Karte. `getEbayItemDescription`
  daneben macht es anders, weil es immer nur eine Karte betrifft.
- **Die Meldung nennt die Karte beim Namen.** "Ein Artikel ist nicht mehr
  verfuegbar" laesst jemanden mit fuenf Karten im Warenkorb ratlos zurueck.

**Verifikation:** 21 neue Tests, gegen Fixtures statt gegen das echte
eBay-Konto -- `globalThis.fetch` gestubbt nach dem Muster von
`tests/ebay-active-list.test.mjs`, inklusive der GetItem-Antwortformen mit und
ohne `QuantityAvailable`. `npm test` 98 -> 119, alle gruen. Die Leitregel wurde
testweise aufgehoben (unbekannt = ausverkauft) und die zugehoerigen vier Tests
nachweislich rot gesehen.

## Arbeitsweise

Agents erhalten klar abgegrenzte Prüf- oder Implementierungsaufträge. Ihre Ergebnisse werden vor Übernahme geprüft. Änderungen werden anschließend lokal getestet, committed und nach GitHub gepusht.

## 2026-08-07 - Warum der Import haengenblieb, und was daran nicht stimmte

- Ausloeser: Drei Sync-Laeufe blieben an diesem Tag auf `RUNNING` haengen (04:00,
  11:50, 13:20). Der letzte legte den Import ueber eine Stunde still, bis die
  Zeile von Hand freigegeben wurde.
- Vermutete Ursache laut Aufgabenliste: `lib/ebay-client.ts` setzt an keinem
  `fetch` eine Zeitgrenze; die Sperre `localSyncLock` bleibt deshalb haengen;
  und weil zusaetzlich die `sync_runs`-Zeile auf `RUNNING` steht, koennen auch
  andere Isolates nicht starten.
- Pruefung an den Produktionsdaten statt am Verdacht: Die fehlende Zeitgrenze
  und die haengende Sperre sind im Code belegt. Das dritte Glied ist **falsch**.
  Der 04:00-Lauf wurde um 09:00 freigegeben, der 11:50-Lauf um 12:30 — beide mit
  „Veralteter Sync-Lauf automatisch geschlossen", also durch genau den
  Aufraeumcode, der laut Vermutung nie erreicht wird. Er wird erreicht, aber nur
  von einem frischen Isolate. Die Cron-Schlaege dazwischen hinterliessen gar
  keine Zeile — die Signatur eines Abbruchs vor dem `INSERT`. Der dauerhafte
  Blocker war also die Sperre im Isolate, und der eigentliche Konstruktions-
  fehler ist die **Reihenfolge**: Aufraeumen stand hinter der Sperrpruefung.
- Nebenbefund, unabhaengig und aelter: Die Veraltet-Pruefung verglich
  `2026-08-07 13:20:40` aus SQLites `CURRENT_TIMESTAMP` mit ISO-8601 als
  Zeichenketten. Das Leerzeichen (0x20) sortiert vor dem `T` (0x54), der
  Vergleich war damit immer wahr — die 30-Minuten-Frist existierte nur auf dem
  Papier, jeder gerade gestartete Lauf galt als verwaist. Dieselbe Falle ist in
  `lib/retention.ts` seit SEC-15 dokumentiert; sie war hier nur nicht angewandt.
- Was bewusst offen bleibt: Welcher `await` konkret haengenblieb, laesst sich
  nicht mehr feststellen. Ein stehengebliebenes `db.batch` — 294 je Lauf,
  ebenfalls unbegrenzt — oder ein von Cloudflare abgeraeumter Aufruf erzeugt
  dieselbe Signatur. Deshalb reicht es nicht, die `fetch`-Aufrufe zu begrenzen:
  der ganze Lauf bekommt eine Frist (`withDeadline`), unabhaengig davon, wo er
  steckenbleibt.
- Umsetzung: `fetchWithTimeout` an allen fuenf eBay-Aufrufen; neues Modul
  `lib/sync-lock.ts` mit `ExpiringLock` (Verfallszeit statt Wahrheitswert),
  `isSyncRunStale` ueber `parseDbTimestamp` und `withDeadline`; Aufraeumcode
  laeuft vor der Sperrpruefung.
- Verifikation: `tests/ebay-sync-timeout.test.mjs`, 11 Tests. Rot-Nachweis
  gefuehrt — ohne die Korrekturen laufen die drei `fetch`-Tests in ihr
  Zeitlimit, statt einen Fehler zu liefern. `npx tsc --noEmit` sauber,
  `npm run lint` 0 Fehler, `npm test` 130/130. Deployed als `07da6e9b`.

## 2026-08-08 - Kunden-E-Mails: warum genau so

**Anlass:** Punkt 3 aus `ai-todo.md`. Der Shop hatte keinen eigenen Versand;
wer bezahlte, hörte nichts.

**Anbieter Resend, nicht MailChannels.** Die Datenschutzerklärung nennt Resend
in Abschnitt 5 bereits für die Supabase-Anmeldemails. Denselben Auftrags-
verarbeiter ein zweites Mal zu nutzen heißt: keine neue Offenlegung, kein
zweiter Vertrag, keine Textänderung. Das wog schwerer als jeder technische
Unterschied zwischen den beiden.

**Warum der Versand abgewartet wird, obwohl er den Checkout verlangsamt.**
Naheliegend wäre `ctx.waitUntil`, damit die Antwort sofort hinausgeht. Das
gibt es aber nur im Worker-Einstieg (`worker/index.ts`), nicht in den
Route-Handlern. Eine einfach nicht abgewartete Zusage ist keine Alternative:
Cloudflare räumt sie nach der Antwort ab, und der Versand fiele unvorhersehbar
mal aus, mal nicht. Genau diese Klasse von Fehler hat am 2026-08-07 den
eBay-Import stundenlang lahmgelegt. Also: abwarten, aber mit einer Zeitgrenze
von 5 Sekunden.

**Warum es keine neue Datenbankspalte für "Bestätigung verschickt" gibt.**
Eine Bestellung wird auf zwei Wegen bezahlt: durch die Rückkehr des Kunden aus
PayPal und durch den Webhook. Laufen beide, gäbe es zwei Bestätigungen. Der
naheliegende Weg wäre eine Spalte `confirmation_sent_at` - das hieße Migration,
und Migrationen sind rücksprachepflichtig.

Nicht nötig: **Der Übergang der Zahlung von `CREATED/APPROVED` auf `CAPTURED`
ist bereits der Einmal-Moment.** Beide Stellen schreiben ihn jetzt bedingt und
prüfen `meta.changes === 1`; wer gewinnt, verschickt. Dieselbe Bewegung, die
`app/api/admin/offers/route.ts` für Preisvorschläge schon macht.

**Nebenwirkung, die den Ausschlag gab:** Vorher schrieben beide Stellen den
Übergang **ungeschützt**. Ein Wettlauf hätte sich still überschrieben. Die
Bedingung ist also nicht nur die Grundlage für den Versand, sondern eine
Korrektur am Zahlungspfad selbst.

**Warum Ausfälle folgenlos bleiben müssen, und wie.** `sendEmail` wirft
grundsätzlich nicht, sondern meldet ein Ergebnis. Zusätzlich liegt jeder
Aufruf in `versucheVersand`, weil auch das *Zusammenbauen* der Nachricht
fehlschlagen kann - eine fehlende Verknüpfung, ein unerwarteter Wert. Ein
Kunde, der bezahlt hat, bekommt seine Karten auch dann, wenn Resend gerade
nicht erreichbar ist; er bekommt nur keine Bestätigung.

**Warum Kartentitel maskiert werden.** Sie kommen von eBay, sind also
Fremdeingabe. Im HTML-Teil wird maskiert, aus der Betreffzeile fliegen
Zeilenumbrüche. Resend nimmt den Betreff zwar als JSON-Feld und setzt die
Kopfzeilen selbst - sich darauf zu verlassen wäre eine Wette auf fremdes
Verhalten. Rot-Nachweis geführt: Ohne Maskierung fallen genau die zwei Tests,
die sie prüfen.

**Ohne Schlüssel ist alles ein Leerlauf.** `getEmailConfig()` liefert dann
`null`, der Versand protokolliert eine Zeile und kehrt zurück. Der Shop
verhält sich vor und nach dem Hinterlegen des Secrets gleich. Belegt: Eine
echte Anfrage über `/anfragen` lief mit 201 durch, die Zeile steht in der
Datenbank, im Protokoll steht nur der Hinweis auf den fehlenden Schlüssel.

## 2026-08-08 – Bestellungen im Adminbereich sichtbar machen

**Warum eine eigene Route und nicht das Dashboard erweitern.**
`/api/admin/dashboard` liefert Zähler und die letzten Kartenangebote und wird
beim Laden der Seite einmal geholt. Bestellungen samt Positionen, Zahlungen und
Adressen dranzuhängen hätte diesen einen Aufruf um drei weitere Abfragen
verlängert — und zwar auch dann, wenn niemand die Bestellungen ansieht. Die
Ansicht bekommt deshalb `/api/admin/orders` für sich, genau wie die
Preisvorschläge ihre eigene Route haben.

**Warum `requireAdmin` aus `lib/admin-access.ts` und nicht die ausgeschriebene
Prüfung.** Beides bestünde den Test „keine Route unter `/api/admin` ohne
Rollenprüfung". Der Helfer fängt zusätzlich den Fall ab, dass die Prüfung selbst
wirft (kaputtes Token, Supabase nicht erreichbar) und antwortet dann mit 401
statt mit einem 500er aus dem `catch` der Route.

**Warum die Seitengröße 25 beträgt und nicht 50.** Positionen und Zahlungen
werden über `inArray` an den Bestell-Ids nachgeladen; jede Id ist ein gebundener
Parameter. `D1_SAFE_ID_LIST` steht bei 40. Die Zahl ist also keine Geschmacks-
frage, und `tests/d1-limits.test.mjs` liest sie jetzt aus der Route und misst
die erzeugten Abfragen — dieselbe Falle hat am 2026-08-06 den Sync zerlegt.

**Warum die Adresse noch einmal feldweise gelesen wird.** Sie liegt als JSON in
der Spalte. Der Checkout schreibt sie zwar durch `cleanAddress` geprüft, aber
die Spalte selbst garantiert nichts, und ältere Zeilen müssen dem heutigen
Format nicht folgen. Die Ansicht zeigt lieber „keine vollständige Lieferadresse"
als eine halbe Adresse, mit der niemand etwas verschicken kann.

**Warum die PayPal-Capture-Id mit angezeigt wird.** Sie ist der einzige Faden
zwischen einer Bestellung hier und dem Vorgang im PayPal-Konto. Ohne sie ist
eine Rückerstattung Suchen von Hand — genau die Sorte Aufgabe, für die bisher
`wrangler d1 execute` nötig war.

**Nebenbefund, der Arbeit gespart hat.** Der Arbeitsvorrat führte unter Punkt
12.3 „es fehlt ausschließlich die Oberfläche" für Preisvorschläge. Das stimmt
nicht mehr: `app/admin/offers-panel.tsx` existiert seit `a0d4367`, wird in
`app/admin/page.tsx` gerendert, und die Stile stehen in `globals.css`. Der
Eintrag ist richtiggestellt, bevor die nächste Sitzung die Arbeit ein zweites
Mal beginnt.

## 2026-08-08 – Auskunft und Kontolöschung zur Selbstbedienung

**Warum Bestellungen nicht mitgelöscht werden.** Der Löschanspruch aus Art. 17
DSGVO endet dort, wo eine gesetzliche Aufbewahrungspflicht beginnt (Abs. 3
lit. b). Rechnungs- und Zahlungsdaten fallen darunter. Sie bleiben deshalb
stehen und verlieren nur die Verknüpfung zum Konto — `orders.user_id` fällt
durch `ON DELETE SET NULL` von selbst weg, sobald die Kontozeile verschwindet.
Die Lieferadresse bleibt in der Bestellung, weil sie *der Beleg ist*, nicht ein
Anhängsel daran. Wichtig war, dass das **vor** dem Klick dasteht und nicht
danach: im Abtipp-Dialog, in der Bestätigungsmail und im Datenschutztext.

**Warum die Route ohne Service-Role-Key gar nicht erst anfängt.** Der halbe
Zustand — Shopdaten gelöscht, Anmeldung funktioniert weiter — ist schlechter
als der Zustand davor: Der Kunde glaubt, er sei gelöscht, kann sich aber
einloggen und bekommt ein leeres Konto. Deshalb steht `hasSupabaseAdminAccess()`
vor dem ersten Schreibzugriff, und die Oberfläche fragt denselben Zustand über
`GET /api/account/delete` ab, damit gar kein Knopf erscheint, der nicht kann.

**Warum erst die Shopdaten und dann das Anmeldekonto.** Die umgekehrte
Reihenfolge ist die gefährliche: Fällt die Anmeldung zuerst und scheitert danach
das Löschen der Shopdaten, steht der Kunde ohne Login da — und **ohne Login
erreicht er den Selbstbedienungsweg nicht mehr**, um es erneut zu versuchen. In
der gewählten Reihenfolge ist der schlimmste Fall: Daten weg (das war der
Wunsch), Anmeldung noch da, und die Antwort sagt genau das, statt „alles
erledigt" zu melden.

**Wogegen der Test wirklich schützt.** Nicht gegen einen Absturz — der fiele
auf. Sondern gegen die stille Lücke: Jemand ergänzt in einem halben Jahr eine
Tabelle mit `user_id`, und die Auskunft liefert sie nicht mit, die Löschung
lässt sie stehen. Beides bemerkt niemand, weil beides erfolgreich aussieht.
`tests/account-data.test.mjs` liest deshalb `db/schema.ts` und verlangt für jede
Tabelle mit Nutzerbezug entweder ein Vorkommen in `lib/account-data.ts` oder
einen **begründeten** Eintrag in der Ausnahmeliste. Beim ersten Lauf hat der
Test prompt `products` gemeldet — `created_by_user_id` zeigt dort auf den Admin,
nicht auf einen Kunden. Genau diese Sorte Fund ist der Zweck.

**Warum `payments.raw_data` spaltenweise ausgeschlossen wird.** Ein `select()`
über die Zahlungstabelle hätte die vollständige PayPal-Antwort in die Auskunft
geschrieben. Ein Auskunftsrecht ist kein Grund, Abwicklungsdaten eines Dritten
herauszugeben. Die Spalte wird deshalb gar nicht erst gelesen, statt sie
hinterher zu entfernen — was man vergessen kann.

## 2026-08-08 – Was der Löschlauf ans Licht brachte

**Der Fehler war von außen unsichtbar, und genau das ist der Punkt.** Die
Zuordnung von Daten zu einem Konto lief über `user_id`. `/anfragen` und
`/verkaufen` sind aber **öffentliche** Formulare: Sie schreiben `guest_email`
und lassen `user_id` leer, auch wenn der Absender angemeldet ist. Nur
Preisvorschläge setzen die Verknüpfung, weil ihre Route eine Anmeldung
verlangt.

Die Folge wäre gewesen: Die Auskunft liefert eine Datei ohne die Anfrage des
Kunden aus — vollständig aussehend, aber unvollständig. Die Löschung meldet
Erfolg und lässt die E-Mail-Adresse in `inquiries` stehen. **Beide Antworten
wären grün gewesen.** Kein Statuscode, kein Protokolleintrag, keine Ausnahme
hätte es verraten.

**Warum kein Test das gefunden hat.** `tests/account-data.test.mjs` prüfte, ob
*jede Tabelle mit Nutzerbezug vorkommt*. Sie kamen alle vor. Der Test prüfte
nicht, ob der **Schlüssel trifft** — und das ist die schwerere Frage, weil sie
nicht aus dem Schema folgt, sondern daraus, wie die Zeilen entstehen. Der Test
prüft jetzt beides; die Erweiterung entstand aus dem Fund, nicht aus einer
Vorahnung.

**Gefunden wurde er nur durch die Reihenfolge.** Vor dem unwiderruflichen
Schritt wurde eine Momentaufnahme der Produktionsdatenbank gemacht — nicht als
Formalie, sondern um hinterher vergleichen zu können. Dabei stand `user_id`
auf `NULL`, wo eine Kennung hätte stehen müssen. Wäre erst nach dem Löschen
nachgesehen worden, hätte man eine stehengebliebene Anfrage gesehen und sie
womöglich für einen Nebeneffekt gehalten.

**Warum die E-Mail-Adresse als Schlüssel zulässig ist.** Ein Konto entsteht in
diesem Shop erst nach bestätigter E-Mail (`findOrCreateAppUser` verweigert
vorher). Wer unter einer Adresse angemeldet ist, hat den Zugriff auf dieses
Postfach nachgewiesen — Daten, die unter dieser Adresse eingereicht wurden,
gehören ihm. Verglichen wird über `lower()` auf beiden Seiten: Die Kontoadresse
wird normalisiert gespeichert, die Formularadresse so, wie sie getippt wurde.

**Was bewusst so blieb.** Die öffentlichen Formulare setzen weiterhin kein
`user_id`. Über die Adresse ist der Fall abgedeckt, und ein Bearer-Token durch
ein öffentliches Formular zu schleusen wäre Aufwand ohne Gewinn — zumal Gäste
ohne Konto einreichen dürfen und ihre Zeilen ohnehin nur an der Adresse hängen.

## 2026-08-08 – Warum manuelle Karten keine eigene `kind` bekommen haben

Der Arbeitsvorrat verlangte für Punkt 11 eine **dritte Produktart**
(`kind = 'MANUAL'`). Auf D1 ist das nicht erreichbar, und der Weg dorthin
zeigte zwei Fallen, die beide erst im lokalen Probelauf sichtbar wurden.

**Erster Versuch: Tabelle neu bauen.** Neue Tabelle mit erweiterter
CHECK-Bedingung, Daten kopieren, `DROP TABLE products`, umbenennen — das
Standardrezept. Danach waren `ebay_listings` und `inventory` **leer**. Grund:
Bei aktiver Fremdschlüsselprüfung führt `DROP TABLE` intern ein `DELETE FROM`
aus, und das löst jede `ON DELETE CASCADE`-Aktion aus. In Produktion hätte das
543 Angebote und den gesamten Bestand mitgenommen — und zwar **stillschweigend
und erfolgreich gemeldet**.

**`defer_foreign_keys` hilft dagegen nicht.** Es verschiebt
Verletzungsmeldungen ans Transaktionsende; es schaltet keine Aktionen ab. Das
war die eigentliche Fehlannahme.

**Zweiter Versuch: `legacy_alter_table` + Umbenennen.** Die alte Tabelle zur
Seite schieben, damit die `REFERENCES`-Klauseln der Kinder auf den Namen
`products` zeigen bleiben und die Kaskade später ins Leere läuft. Scheitert
hart: Die bestehende CHECK-Bedingung ist qualifiziert geschrieben
(`"products"."kind"`), nach dem Umbenennen zeigt sie ins Nichts —
`no such column: products.kind`.

**Und `PRAGMA foreign_keys = OFF` greift auf D1 nicht.** Gemessen statt
vermutet: Nach dem Setzen liefert `PRAGMA foreign_keys` weiterhin `1`.

**Ergebnis:** Die CHECK-Bedingung auf `kind` ist auf dieser Datenbank
unveränderlich. Die Unterscheidung zieht deshalb eine neue Spalte `origin`
ohne CHECK ein. Manuelle Karten sind `kind = 'PRELISTED'` **und**
`origin = 'MANUAL'`. Der Preis ist dabei, dass `kind` seine Aussagekraft
verliert: Es beantwortet nur noch „räumt der Waisen-Sweep diese Zeile ab?".

**Die Falle, die daraus entsteht, und wie sie festgenagelt ist.**
`PRELISTED` bedeutet an anderer Stelle „Ankündigung, immer sichtbar, Menge 0".
Würde `istImKatalogSichtbar` die PRELISTED-Zeile vor der `origin`-Zeile prüfen,
wäre **jede verkaufte Handkarte unsterblich** — sie bliebe mit Kaufknopf im
Schaufenster. `tests/manual-cards.test.mjs` prüft genau diesen Fall.

**Umgekehrte Regel beim Bestand.** Bei eBay-Karten gilt: keine Bestandszeile →
Listing-Menge zählt („im Zweifel anzeigen", weil ein halb geschriebener Import
sonst den Katalog leert). Bei manuellen Karten gibt es kein Listing, auf das
man zurückfallen könnte — ohne Bestandszeile also **nichts anbieten**. Dieselbe
Funktion, zwei entgegengesetzte Vorzeichen; deshalb steht die Begründung an
beiden Stellen im Code.

## 2026-08-09 – Was der Durchstich fand, und die Tests nicht

Die Bausteine für manuelle Karten waren gebaut und mit 23 Tests belegt:
Sichtbarkeit im Katalog, Handmarkierungen, Übernahme durch den Sync, das
Anlegen mit Bestandszeile. Alles grün. Dann wurde **eine echte Testkarte in der
lokalen Datenbank angelegt und durchgeklickt** — und dabei fielen drei Stellen
auf, die kein Test berührt hatte:

1. **Der Checkout** (`app/api/orders/route.ts`) verknüpfte `ebay_listings` per
   `innerJoin`. Eine manuelle Karte hat kein Listing; die Bestellung scheiterte
   mit „Ein Artikel ist nicht mehr verfügbar" — während die Karte im
   Schaufenster stand und ein Kaufknopf daneben.
2. **Die Preisvorschlag-Route** (`app/api/price-offers/route.ts`) ebenso. Der
   Kasten erschien, das Absenden lief in ein 404.
3. **Die Detailseite** zeigte den Vorschlag-Kasten nur bei
   `category === "Festpreis"`. Manuelle Karten tragen „Direkt bei uns" — der
   Kasten fehlte also genau bei den Karten, die der Betreiber ausdrücklich
   verhandelbar haben wollte.

**Warum die Tests das nicht fanden.** Sie prüften, was gebaut wurde, nicht was
davon abhängt. Eine neue Produktart ist keine neue Funktion an einer Stelle,
sondern eine Annahme, die an vielen Stellen steckt: „jedes Produkt hat ein
eBay-Listing". Diese Annahme stand in vier Dateien, aufgeschrieben als
`innerJoin` — und `innerJoin` schweigt, wenn er etwas herausfiltert. Er wirft
keinen Fehler, er liefert eine leere Zeile, und der Aufrufer sagt „nicht
verfügbar".

**Die Lehre für den nächsten Umbau dieser Art:** Nicht nach dem neuen Fall
suchen, sondern nach der alten Annahme. `grep -rn "innerJoin(ebayListings"`
über das Projekt hätte alle drei in einem Zug gezeigt — und das war am Ende
auch der Weg, der sie fand.

**Warum `highlights` trotzdem beim `innerJoin` bleibt.** Dort ist die Annahme
kein Versehen: Die Höhepunkte auf der Startseite sind eine Auswahl aus dem
eBay-Bestand. Manuelle Karten dort mitlaufen zu lassen, wäre eine inhaltliche
Entscheidung des Betreibers, keine Fehlerbehebung — sie steht als offener Punkt
im Protokoll statt als stille Änderung im Code.

## 2026-08-09 — PayPal-Webhooks mit `RECEIVED` wiederholbar machen (S-02)

Der Befund war kein fehlender PayPal-Aufruf, sondern ein falscher Zustandspunkt:
Eine bereits angelegte `webhook_events`-Zeile mit `RECEIVED` wurde genauso wie
`PROCESSED` als Dublette mit HTTP 200 beantwortet. Nach einem Abbruch zwischen
dem Insert und der Verarbeitung konnte PayPal deshalb aufhören zu wiederholen,
obwohl die Zahlung noch nicht verarbeitet war.

Die Korrektur behandelt ausschließlich `PROCESSED` als fertige Dublette. Eine
frische `RECEIVED`-Zeile erhält eine retrybare 503-Antwort mit
`retry-after: 300`; eine mindestens fünf Minuten alte Zeile darf erneut
verarbeitet werden. Der alte Zeitstempel wird dabei bedingt gegen den neuen
Zeitstempel ausgetauscht, sodass zwei verspätete Zustellungen nicht parallel in
den Zahlungsweg einsteigen. Die Zeitentscheidung lebt in
`lib/paypal/webhook-retry.ts` und versteht sowohl SQLite- als auch ISO-Zeitstempel.

Das Verhalten ist mit drei reinen Funktionstests und Quelltext-Wächtern belegt.
Die bestehende Bedingung für `CAPTURED`-Duplikate und der gemeinsame
`PROCESSED`-Ausgang bleiben unangetastet. Verifikation: S02-Test 10/10,
`npm test` 310/310, `npx tsc --noEmit` und `npm run lint` ohne Fehler.

## 2026-08-09 — Authentifizierte Routen mit Rate-Limits versehen (S-04)

Der Prüfbericht hatte sechs authentifizierte Routen ohne gemeinsame Begrenzung
markiert: Preisvorschläge, DSGVO-Auskunft, Kontolöschung, Profilsynchronisation
und die beiden PayPal-Schritte. Authentifizierung allein schützt diese Endpunkte
nicht vor wiederholten teuren Supabase-/D1-Lesevorgängen oder gegen das erneute
Anstoßen von Zahlungslogik.

Alle sechs Routen verwenden jetzt den vorhandenen Standard-Limiter
`RATE_LIMITER` mit 10 Anfragen je 60 Sekunden, aber jeweils mit einem eigenen
Scope. Dadurch teilen sich Preisvorschläge, Kontoverwaltung und PayPal nicht
unbeabsichtigt ihr Kontingent. Die Begrenzung greift vor der fachlichen Arbeit;
die bisherige Authentifizierung und die Antworten für gültige bzw. nicht
authentifizierte Anfragen bleiben erhalten.

Wichtig für Clients: Eine Überschreitung bleibt ein eigener Fehler und wird als
HTTP 429 mit `retry-after` beantwortet. Sie fällt nicht in den allgemeinen
503-Zweig, der echte Dienstfehler signalisiert. Die Kontodatenroute bleibt
weiterhin `no-store`; die zusätzliche Begrenzung ist nur eine Bremse für
wiederholte Exporte.

Die sechs Scopes und die 429-Behandlung sind mit einem Hardening-Test abgedeckt.
Verifikation vor dem Deploy: S-04-Test 6/6, `npm test` 311/311,
`npx tsc --noEmit` und `npm run lint` ohne Fehler. Es wurden keine
Produktionsdaten geschrieben.

## 2026-08-09 — Startseiten-Galerie an den Bestand anschließen (F-01)

Die Galerie war die letzte öffentliche Produktfläche, die noch eine eigene,
falsche Verfügbarkeitsentscheidung traf: Sie las `ebay_listings.quantity`,
obwohl ein Shop-Verkauf ausschließlich `inventory` bucht. Dadurch konnte eine
bereits verkaufte Karte im Schaufenster bleiben. Zusätzlich ließ die Route
Auktionen durch, obwohl deren Bestand bei eBay nicht zurückgenommen werden
kann und der übrige Katalog sie deshalb ausblendet.

Die Route verbindet `inventory` jetzt per `leftJoin` mit dem bestehenden
eBay-Listing. Das `leftJoin` ist wichtig, weil ein teilweise importiertes
Listing noch ohne Bestandszeile nicht aus der Auswahl fallen soll; in diesem
Fall greift die bestehende Fallback-Regel auf die Listing-Menge. Die endgültige
Sichtbarkeit läuft über `istImKatalogSichtbar`, und die ausgegebene Menge über
`verfuegbareMenge`. Erst danach wird auf fünf Karten gekürzt. So füllen
ausverkaufte Karten oder Auktionen die fünf Plätze nicht mehr vor verfügbaren
Festpreisangeboten.

Manuelle Karten bleiben bewusst außerhalb dieser Galerie. Die Produktquelle
der Route bleibt an eBay-Listings gebunden; die Entscheidung, manuelle Karten
in die Startseiten-Auswahl aufzunehmen, ist im Prüfbericht als Betreiber-
entscheidung markiert und wurde nicht stillschweigend vorweggenommen.

Ein Quelltext-Wächter schützt die drei entscheidenden Verdrahtungen — Bestand,
gemeinsame Sichtbarkeit und Filter-vor-Limit. Verifikation vor dem Deploy:
F-01-Zieltests 30/30, `npm test` 311/311, `npx tsc --noEmit` und `npm run lint`
ohne Fehler. Es wurden keine Produktionsdaten geschrieben.

## 2026-08-09 — Englische Sprachversion im Kundenbereich

Die Sprachumschaltung sitzt zentral in einem clientseitigen Provider. Die
Auswahl wird im Browser und als Cookie gespeichert, damit sie über Navigation
und neue Sitzungen erhalten bleibt; die Kopfzeile bietet mit DE- und EN-Flagge
eine per Tastatur bedienbare Auswahl. Preise und Versand werden für Englisch
weiterhin in Euro formatiert.

Die Übersetzung läuft bewusst über die deutschen Quelltexte als Schlüssel.
Dadurch bleiben Kartentitel und eBay-Beschreibungen, die aus dem Katalog kommen,
unverändert deutsch, während Shoptexte, Formulare, Konto, Checkout, PayPal-
Rückläufe und Rechtstexte eine englische Fassung erhalten. Bekannte API-Fehler
werden im Client ebenfalls über denselben Katalog aufgelöst.

Verifikation vor dem Abschluss: TypeScript ohne Fehler, Lint ohne Fehler
(eine bestehende Hook-Warnung im Konto bleibt), Produktions-Build erfolgreich,
315 Tests grün inklusive Sprachtest. Es wurden keine Produktionsdaten geändert.

Der erste Live-Aufruf zeigte, dass die Rechtstextseiten als Serverkomponenten
den clientseitigen Sprach-Hook direkt aufriefen und deshalb in Cloudflare 500
liefen. Die fünf betroffenen Seiten wurden als Clientkomponenten markiert,
erneut getestet und als `cc7cc18` deployed. Nach der Edge-Propagierung antworten
alle öffentlichen Shop-Routen und `/api/products` live mit HTTP 200. Das
zusätzliche Sites-Projekt wurde wegen `.openai/hosting.json` angelegt; die
Version ist gespeichert, aber eine neue öffentliche Sites-Zieladresse bleibt
bis zu einer separaten Freigabe unpubliziert.

## 2026-08-09 — Sites öffentlich freigegeben und Apex-Domain geprüft

Nach ausdrücklicher Freigabe wurde Sites-Version 2 aus dem aktuellen Stand
gespeichert, veröffentlicht und auf `public` gestellt. Die Sites-Adresse ist
`https://brandycards-webshop.p-brand94.chatgpt.site`; ein normaler Browser-
User-Agent erhält HTTP 200.

Die bestehende Produktion bleibt `https://shop.brandycards.de`. In
`wrangler.toml` ist nur dieser Host als Custom Domain eingetragen. Für
`brandycards.de` gibt es keine Redirect-Regel; die beiden Cloudflare-A-Records
stellen nur DNS-Zustellung her und erzeugen keine HTTP-Weiterleitung. Der
Apex-Aufruf endet derzeit mit Cloudflare HTTP 525, bevor der Worker greift.
Eine separate 301-Weiterleitung des Apex auf den Shop ist daher noch offen.

## 2026-08-10 — Neue Messeflyer E und F gestaltet

Auf Wunsch nach einem komplett neuen Messeauftritt wurden zwei eigenständige
Richtungen gebaut. Variante E arbeitet als Eyecatcher mit tiefem Navy,
kontrastierendem Rot, großen Headlines und diagonalen Farbflächen. Variante F
ist sportlich-künstlerisch angelegt: Ein großer grafischer Seitenkeil, eine
reduzierte „90“-Marke und eine typografisch stärker komponierte Vorderseite
geben ihr mehr Bewegung. Beide Richtungen bleiben bewusst bei Logo, QR-Code,
Instagram-Hinweis und vorhandenen Shopinformationen; zusätzliche Bilder wurden
nicht erfunden.

Die je zwei PNG-Vorschauen und zweiseitigen PDFs wurden nach visueller Prüfung
und kleinen Layoutkorrekturen an F-Vorderseite und E-Rückseiten-Schrittleiste
final neu gerendert.

## 2026-08-10 — Flyer D mit mehr visueller Präsenz erstellt

Flyer D bleibt bewusst in der ruhigen C-Farbwelt, füllt die Vorderseite aber
mit einem klaren Dreierblock: Kaufen, Sammeln und Verkaufen. Dadurch bekommt
die Seite mehr Struktur und Inhalt, ohne zusätzliche Bilder zu erfinden oder
die Gestaltung zu überladen. Die Rückseite übernimmt den bewährten Aufbau mit
den drei Kontakt-Schritten und dem gleichmäßig gesetzten QR-Rabattfeld.

Die beiden PNG-Vorschauen und die zweiseitige PDF wurden nach einem Korrekturlauf
für die QR-Klassenbindung erneut gerendert und visuell geprüft.

## 2026-08-10 — QR-Feld von Flyer C mit mehr Luft gesetzt

Die vier einheitlich formatierten QR-Zeilen standen noch zu dicht beieinander.
Das Raster verwendet jetzt größere Zeilen und einen festen Zwischenabstand.
Schriftfamilie, Schriftgröße und Schriftstärke wurden dabei nicht verändert.
Die Rückseiten-PNG und die zweiseitige Flyer-C-PDF wurden neu gerendert und
visuell geprüft.

## 2026-08-10 — QR-Feld von Flyer C vollständig vereinheitlicht

Die vorherige Anpassung hatte zwar eine gemeinsame Schriftfamilie gesetzt,
aber weiterhin unterschiedliche Größen und Gewichtungen für Überschrift, Frist,
Rabatt und Code verwendet. Das QR-Feld nutzt jetzt für alle vier Zeilen exakt
dieselbe Schriftfamilie, Größe, Stärke und Zeilenhöhe. Die Farbe bleibt als
einzige bewusste Unterscheidung bestehen.

Die Rückseiten-PNG und die zweiseitige Flyer-C-PDF wurden neu gerendert und
visuell geprüft.

## 2026-08-10 — Flyer C typografisch vereinheitlicht

Die QR-Beschriftung bestand zuvor aus unterschiedlich gesetzten Elementen mit
abweichenden Größen und Abständen. Für Flyer C verwenden alle Seitenelemente
jetzt explizit dieselbe Schriftfamilie. Der QR-Hinweis ist als gleichmäßige
Abfolge aus Überschrift, Frist, Rabatt und Rabattcode umgesetzt. Dadurch bleibt
die Hierarchie erhalten, ohne wie mehrere unterschiedliche Schriftstile zu
wirken.

Die beiden PNG-Vorschauen und die zweiseitige PDF wurden neu gerendert und
visuell geprüft.

## 2026-08-10 — Flyer C aus A-Vorderseite und B-Rückseite zusammengeführt

Flyer C verbindet die stärkere Vorderseite von Flyer A mit der ruhigeren
Rückseite von Flyer B. Auf der Vorderseite steht jetzt „Einzelkarten ·
Sammlungen · An- und Verkauf“. Das QR-Feld auf der Rückseite wurde so
formuliert, dass der Nutzen und die Frist sofort verständlich sind: „Jetzt im
Shop sparen“, „Bis zum 20.09.2026“, „5 % Rabatt“ und „Code: MESSE26“.

Die neue zweiseitige PDF, die HTML-Datei und beide PNG-Vorschauen liegen im
Ausgabeordner und wurden nach dem Rendern visuell geprüft.

## 2026-08-10 — Gemeinsames Layout für die Messeflyer

Flyer A war gestalterisch die ruhigere und passendere Referenz. Deshalb wurde
sein Grundaufbau auf alle vier Seiten übertragen: helle Papierfläche, dezente
Linien, gedämpfter Akzentton, gleicher Footer und gleiche Logo-Position. Das
Logo ist auf allen Seiten einheitlich größer gesetzt, damit die Marke auf dem
kleinen Format nicht untergeht. Flyer A erhielt mit einem kurzen Satz für
Sammler und Fans etwas mehr Inhalt. Flyer B bleibt auf den Sammlungsankauf
ausgerichtet, wirkt aber nicht mehr wie ein eigener Gestaltungstyp.

Die vier PNG-Vorschauen und die beiden zweiseitigen PDFs im bestehenden
Ausgabeordner wurden neu gerendert. Die visuelle Prüfung bestätigte, dass Logo,
Footer und Grundraster über alle Seiten konsistent sind.

## 2026-08-10 — Messeflyer für die Messekommunikation überarbeitet

Die ruhige Gestaltung der beiden zweiseitigen Flyer bleibt bewusst bei der
bestehenden Farbwelt aus Navy, Creme und gedämpftem Rot. Der Shop-Hinweis wurde
auf Kaufen und Verkaufen erweitert, weil der QR-Code nicht ausschließlich den
Ankauf von Sammlungen vermitteln soll. Der Rabatt ist jetzt ohne Erklärung
verständlich: **5 % Rabatt** und **Code: MESSE26** stehen direkt neben dem
QR-Code. Dort wurde der Instagram-Hinweis entfernt, damit der QR-Bereich eine
einzige klare Handlung unterstützt. Instagram steht ausschließlich im unteren
Banner und verwendet das vom Betreiber bereitgestellte Logo.

Die HTML-Quelle, vier PNG-Vorschauen und zwei zweiseitige PDFs liegen im
Ausgabeordner des Visualisierungsprojekts. Alle Seiten wurden nach dem Rendern
visuell geprüft; die PDFs sind vollständig geschrieben und enthalten Vorder-
und Rückseite.

## 2026-08-11 - Drei neue beidseitige Flyer von Grund auf

Die drei Richtungen wurden bewusst nicht aus den bisherigen Flyern abgeleitet.
Stattdessen teilen sie nur die belastbaren Markenanforderungen: gute Fernwirkung,
klare Typografie, echte Shop-Kontaktdaten und das unveraenderte Original-Logo.

- Flyer 01 arbeitet editorial mit Creme, Navy und Coral; eine klare Such-Headline
  und die Rueckseite mit drei Nutzungswegen richten sich an spontane Messe- und
  Shopbesucher.
- Flyer 02 nutzt eine ruhige Archiv-/Premiumwelt aus Navy, Creme und Gold; die
  Rueckseite baut Vertrauen ueber Herkunft, Auswahl, Verpackung und Erreichbarkeit
  auf.
- Flyer 03 setzt auf eine energische Coral/Navy-Diagonale; Buy, Sell und Trade
  sind visuell der Hauptgedanke, ohne erfundene Spieler- oder Produktbilder.

Alle sechs Seiten wurden als A5-PDF gesetzt, mit dem Original-Logo eingebettet,
als PNG gerendert und technisch auf Seitenformat, Textrahmen, URL, E-Mail,
Logo-Einbettung und Aufloesung geprueft. Die finalen PDF-Ausgaben liegen unter
`output/pdf/`, die gerenderten Vorschauen unter `output/previews/`.
## 2026-08-11 - Graded-Sports-Card-Flyer fuer BrandyCards

Der neue Flyer greift die wiedererkennbaren Konventionen einer gegradeten
Sportkarte auf: ein oberes Ident-Label, eine Grade-Zone, die sichtbare
Kartenkammer, Serien- und Barcode-Details, Sicherheitslinien, Schraubpunkte und
eine Holografik. Diese Sprache wurde als eigenstaendiges BrandyCards-System
gebaut, mit Navy, Peach, Coral, Ice und Gold statt fremder Markenkennzeichen.

Auf der Vorderseite liegt der Schwerpunkt auf dem Objektcharakter: Der Flyer
soll auf Distanz wie ein versiegeltes Sammlerstueck gelesen werden. Die
Rueckseite funktioniert wie ein Collector Report mit Kaufen, Verkaufen,
Sammeln, Kontakt und QR-CTA. Ein abstraktes Sportmotiv ersetzt ein erfundenes
Spielerfoto und bleibt dadurch fuer Fussball- und andere Sportkarten offen.

Die erste Renderfassung hatte einzelne Koordinaten als Millimeter interpretiert,
obwohl Punkte gemeint waren. Das wurde vor der Ausgabe korrigiert; der finale
Renderlauf besteht die A5-, Textrahmen-, Logo- und PNG-Aufloesungspruefung.
## 2026-08-12 — Gastcheckout ohne Kundenkonto

Der Checkout akzeptiert jetzt auch Besucher ohne Supabase-Konto. Die E-Mail für
Bestellbestätigung und Zuordnung wird serverseitig validiert und zusammen mit
der Lieferadresse gespeichert. Kontobestellungen bleiben unverändert; bei
Gastbestellungen sind `userId` und `guestEmail` sauber getrennt.

PayPal-Start, Capture und Abbruch suchen die Bestellung nur noch über ihre
zufällige Bestell-ID und prüfen dann, ob sie entweder dem eingeloggten Konto oder
einer Gastbestellung gehört. Die Serverlogik berechnet Preise und Bestand weiter
selbst, begrenzt auch Gastreservierungen und behält die vorhandene idempotente
Capture-/Webhook-Logik. Ein erfolgreicher Capture kann dadurch weiterhin die
Bestell- und Verkäufernachricht auslösen.

Die Oberfläche zeigt den Gastweg verständlich an, ohne Registrierung oder Login
zu verlangen. `npx tsc --noEmit`, ESLint, Build und 356 Tests waren erfolgreich;
es bleibt nur die bereits vorhandene Hook-Warnung in `app/account/page.tsx`.

## 2026-08-13 — Arbeitsboard mit Epic-Swimlanes

Der Nutzer möchte kein sprintzentriertes Setup, sondern ein Board, in dem
Epics und darunter Stories bzw. Tasks visuell nach Status verfolgt werden.
Daher wurden im bestehenden teamverwalteten BrandyCards-Bereich die Sprints
deaktiviert und die Board-Gruppierung auf `Epic` gesetzt. Die vorhandene
Kanban-Struktur bleibt erhalten; die Erstellungsmaske bietet `Epic`, `Story`
und `Task`, und Unteraufgaben können über die Parent-Beziehung angelegt werden.
Es wurden keine Beispielvorgänge erzeugt.

## 2026-08-13 — Xray Standard-Trial

Für das gewünschte Testmanagement wurde die einfachste Xray-Cloud-Edition
(`Standard`) auf der Jira-Site `brandycards.atlassian.net` als 30-Tage-Trial
installiert. Die Atlassian-Marketplace-Prüfung zeigte anschließend USD 10 pro
Monat als Schätzung nach dem Trial bei 10 Nutzern, zuzüglich Steuern. Die
Advanced-Edition wurde nicht ausgewählt und es wurden keine Testdaten angelegt.

## 2026-08-13 — Xray konfigurieren und Test Repository anlegen

Im teamverwalteten Jira-Bereich wurden die fünf benötigten Xray-Arbeitstypen
`Test`, `Precondition`, `Test Set`, `Test Plan` und `Test Execution` angelegt
und den Xray-Entitäten zugeordnet. `Epic` und `Story` sind als testabdeckbare
Vorgangstypen konfiguriert. Im funktionierenden Xray Testing Board wurde im
Test Repository der Basisordner `Webshop` erstellt; fachliche Testfälle und
sonstige Beispielvorgänge wurden bewusst noch nicht angelegt.

## 2026-08-13 — Jira-Epics per CSV importieren

Die fachliche Struktur wurde als neun reine Epic-Vorgänge importiert, damit
Stories und Tasks später gezielt darunter angelegt werden können. Der neue
Jira-Importassistent validierte die CSV zwar, legte im bestehenden
teamverwalteten Projekt aber keine Vorgänge an. Deshalb wurde die dafür
geeignete alte CSV-Importmaske verwendet. Dort wurden `Work type`,
`Summary`, `Description` und `Work item ID` zugeordnet; der Import meldete
anschließend neun erfolgreich angelegte Vorgänge. Eine JQL-Prüfung bestätigte
alle neun Epics in KAN.

## 2026-08-13 — Jira-User-Stories per CSV importieren

Die CSV enthielt 111 eindeutige User Stories statt der zuvor erwarteten 108;
der Nutzer bestätigte die vollständige Menge. Der Import legte alle 111 Stories
als KAN-10 bis KAN-120 an. Jira konnte beim Erstimport die neun Parent-Epics
nicht automatisch auflösen und meldete dafür neun Warnungen. Ein anschließender
CSV-Update wurde bei den bereits vorhandenen teamverwalteten Vorgängen
übersprungen. Deshalb wurden die Stories in neun kontrollierten
Stapeländerungen den Epics KAN-1 bis KAN-9 zugeordnet. Die Verifikation ergab
11, 13, 12, 12, 10, 12, 13, 14 und 14 Stories je Epic; die Gesamt-JQL-Abfrage
zeigt 111 Stories. Es wurden keine Tasks, Tests oder weiteren Epics angelegt.

## 2026-08-13 — Jira-Story-Priorisierung und MVP-Schnitt

Für den MVP wurde angenommen, dass Kunden Karten finden, Produktdetails
ansehen, Karten in den Warenkorb legen, als Gast bestellen und per PayPal
bezahlen können. Der Betreiber soll Katalog, Bestand, Bestellungen,
Synchronisation und Versandbetrieb verwalten können. Kundenkonto und
Verkäuferfunktionen folgen danach.

Die 111 Stories wurden in Jira priorisiert: 53 als `Highest` für den
unmittelbaren Shop-Kern und die notwendige Administration, 42 als `High` für
UI, Xray und direkt anschließende Funktionen, 4 als `Medium` für spätere
Betriebs- und Komfortfunktionen sowie 12 als `Lowest` für die vollständige
Verkäuferfunktionalität. Eine JQL-Prüfung ergab keine Story ohne Priorität.

## 2026-08-13 — Jira-Story-Erweiterung mit Akzeptanzkriterien, Tasks und Xray-Tests

Der Nutzer wollte die nächsten Arbeitsschritte für alle 111 vorhandenen Stories
ausführen und dabei lieber zu viele als zu wenige, detailliert beschriebene
Testfälle und Tasks erhalten. Dafür wurden aus den vorhandenen Story-/Epic-Daten
reproduzierbare CSV-Artefakte erzeugt: je Story sechs konkrete Akzeptanzkriterien,
vier fachlich passende Umsetzungstasks und drei Xray-Testfälle (Happy Path,
negative/Grenzwertfälle sowie Berechtigung/Betrieb). Die Beschreibungen enthalten
Ziel, Vorgehen, Erledigt-Kriterien bzw. Vorbedingungen, Schritte, erwartetes
Ergebnis und Nachbereitung.

Die Akzeptanzkriterien wurden mit dem alten Jira-CSV-Importer über `Issue Key`
als Update importiert; der Importlog meldete 111 erfolgreich aktualisierte
Vorgänge und 0 neu erstellte Vorgänge. KAN-10 wurde anschließend direkt geprüft:
Die Beschreibung enthält die sechs Akzeptanzkriterien.

Die 444 Tasks wurden als Jira-Tasks importiert. Die Feldzuordnung enthielt
`Vorgangs-ID`, `Übergeordnet`, `Vorgangstyp`, Zusammenfassung, Beschreibung und
Priorität. Jira legte alle 444 Tasks an, setzte aber bei regulären Tasks im
teamverwalteten Projekt keine Parent-Beziehung zu Stories. Ein isolierter
Korrekturimport für KAN-121 mit der numerischen Story-ID 10009 meldete
`Unable to retrieve issue key for parent : 10009` und importierte 0 Vorgänge.
Damit wurde keine weitere Datenänderung verursacht. Die Tasks bleiben erhalten;
ihre zugehörige Story ist in jeder Beschreibung als `Parent: KAN-xx` und als
Abhängigkeit dokumentiert. KAN-121 wurde stichprobenartig geprüft.

Die 333 Xray-Testfälle wurden anschließend mit Priorität, Beschreibung,
Vorgangs-ID, Vorgangstyp und dem Linkfeld `Link "Test"` importiert. Der Importlog
bestätigte 333 erfolgreich importierte Vorgänge. Die anschließende
Stichprobenprüfung von KAN-565 zeigte den Link zu KAN-10; die Story KAN-10 zeigt
im Bereich „Verknüpfte Vorgänge“ die drei Tests KAN-565 bis KAN-567. Eine
JQL-Prüfung bestätigte 333 Testvorgänge.

Die wiederverwendbaren Importdateien liegen unter `docs/jira/generated/`:
`brandycards-story-acceptance-criteria.csv`, `brandycards-detailed-tasks.csv`,
`brandycards-xray-tests.csv` sowie die Prüfübersicht
`brandycards-jira-expansion-review.xlsx`. Der Builder liegt unter
`docs/jira/artifact_work/build-expansion.mjs`.

## 2026-08-14 — Xray-Schritt 5: Testplan und erste Testausführung

Schritt 5 wurde als Einrichtung der organisatorischen Xray-Struktur vor der
eigentlichen Testausführung umgesetzt. Im Projekt KAN entstand der Testplan
`KAN-898` „BrandyCards MVP – Gesamttestplan“. Die 333 vorhandenen Xray-Tests
wurden über die Xray-JQL-Auswahl `project = KAN AND issuetype = Test` vollständig
hinzugefügt; der Testplan zeigt `TOTAL TESTS: 333` und `TO DO: 333 (100 %)`.

Anschließend wurde die Testausführung `KAN-899` „BrandyCards MVP –
Testausführung 01 – Basisabnahme“ erstellt. Sie wurde dem Testplan hinzugefügt
und ebenfalls mit allen 333 Tests bestückt. Die Stichprobe der Ausführung zeigt
`TOTAL TESTS: 333` und `TO DO: 333 (100 %)`. Damit ist die Ausführung vorbereitet,
aber noch nicht durchgeführt: Es wurden bewusst keine Ergebnisse auf PASS, FAIL
oder BLOCKED gesetzt.

Die Ausführungsbeschreibung legt fest, dass vor dem Start Umgebung, Build,
Browser/Gerät, Testdaten und Rolle dokumentiert werden. PASS bedeutet, dass das
tatsächliche Ergebnis dem erwarteten entspricht; FAIL verlangt Abweichung,
Reproduktionsschritte und Nachweis; BLOCKED verlangt die dokumentierte Ursache.
Ein negativer Test ist PASS, wenn das erwartete Fehlverhalten korrekt eintritt.

## 2026-08-14 — Screenshot-Nachweise für alle Xray-Testfälle

Die Anforderung wurde auf alle 333 vorhandenen Xray-Testfälle angewendet. Die
Beschreibungen enthalten jetzt verbindlich: unmittelbar nach jedem einzelnen
Testschritt einen eigenen Screenshot am jeweiligen Testlauf zu hinterlegen,
Eingabe und sichtbares Ergebnis nachvollziehbar zu zeigen, PASS erst nach
vollständiger Evidenz zu vergeben und auch FAIL/BLOCKED mit Nachweis,
Testergebnis, Tester, Datum und Umgebung zu dokumentieren. Für Login-Tests ist
der Nachweis damit mindestens in die drei relevanten Momente Loginseite,
maskierte Eingabe und Ergebnis nach dem Login aufgeteilt.

Sensible Daten dürfen nicht im Klartext in Screenshots erscheinen; Passwörter,
Tokens und Zahlungsdaten müssen maskiert oder geschwärzt werden. Als konkrete
Ablagekonvention dient beispielsweise `KAN-565_S01_Loginseite_PASS.png`.

Der Testplan `KAN-898` und die Testausführung `KAN-899` wurden ebenfalls um die
Screenshotpflicht sowie die Regeln für PASS, FAIL und BLOCKED ergänzt. Die
Verifikation über JQL mit dem Screenshot-Marker liefert 333 Testvorgänge;
KAN-565, KAN-600, KAN-700, KAN-800 und KAN-897 wurden zusätzlich einzeln
stichprobenartig geprüft. Es wurden keine Testergebnisse vorweggenommen.

Die Regel ist außerdem im reproduzierbaren Builder
`docs/jira/artifact_work/build-expansion.mjs` und im erzeugten Artefakt
`docs/jira/generated/brandycards-xray-tests.csv` hinterlegt. Das separate
Update-Artefakt liegt unter
`docs/jira/generated/brandycards-xray-screenshot-policy-update.csv`.

## 2026-08-14 — Xray-Ausfuehrung: Umgebungspruefung vor Start

Vor einer Ergebnisbuchung in KAN-899 wurde die dokumentierte Produktions-URL
`https://shop.brandycards.de` geprueft. Die Startseite und der oeffentliche
Kartenbestand laden. Der Kontobereich zeigt die Login-Maske; der Adminbereich
meldet ohne Sitzung `Nicht authentifiziert`.

Damit fehlen fuer die 333 generischen Testfaelle noch eine isolierte Umgebung,
Testkonten und vorbereitete Testdaten. Insbesondere duerfen Kauf-, Zahlungs- und
Adminfaelle nicht gegen Produktion oder mit privaten Zugangsdaten ausgefuehrt
werden. Deshalb wurden keine Xray-Ergebnisse oder Screenshots als Testergebnis
eingetragen; KAN-899 bleibt vollstaendig auf `TO DO` und wartet auf Testzugang.

## 2026-08-14 - Xray-Ausfuehrung: zehn sichere UI-Smoke-Tests

Nach der Freigabe einer angemeldeten Browser-Sitzung wurden zehn einfache,
nicht-destruktive UI-Testfaelle gegen `https://shop.brandycards.de` ausgefuehrt:
KAN-814, KAN-817, KAN-820, KAN-823, KAN-826, KAN-829, KAN-832, KAN-835,
KAN-838 und KAN-841. Jeder Test wurde mit Startansicht, Desktop-, Tablet- und
Smartphone-Viewport, Aktionsschritt und Ergebnisansicht belegt. Damit entstanden
60 Screenshots; sie wurden an die jeweiligen Xray-Testvorgaenge angehaengt und
sind im Testlauf als Vorgangs-Anhaenge zum Test einsehbar.

Alle zehn Tests wurden nur nach erfolgreicher sichtbarer Pruefung als `PASS`
gebucht. Die serverseitige Verifikation von KAN-899 zeigt `10 PASS`, `323 TO DO`
und `333 Tests gesamt`. KAN-823 benoetigte fuer den Produktdetailaufruf eine
direkte Produkt-URL, weil der sichtbare Link im aktuellen Viewport nicht klickbar
war; der Detailinhalt wurde anschliessend geprueft. Kauf, Zahlung und
Admin-Schreibvorgaenge wurden nicht ausgefuehrt. Die restlichen 323 Tests bleiben
bewusst offen.

## 2026-08-14 - Fehlende Xray-Screenshot-Anhaenge ergaenzt

Die sechs bei der Vollstaendigkeitspruefung festgestellten Vorgänge KAN-817,
KAN-826, KAN-829, KAN-832, KAN-835 und KAN-838 hatten keine gespeicherten
Jira-Anhaenge, obwohl ihre jeweils sechs lokalen Nachweisdateien noch vorhanden
waren. Die 36 Dateien wurden deshalb ueber den Standard-Jira-Anhang an die
jeweiligen Testvorgaenge uebertragen.

Die anschliessende Jira-Pruefung zeigt bei jedem dieser sechs Vorgänge genau
sechs Screenshot-Anhaenge. KAN-899 wurde erneut geladen und zeigt unveraendert
`10 PASS`, `323 TO DO` und `333 Tests gesamt`. Es wurden keine fachlichen
Teststatuswerte oder Shopdaten veraendert.

## 2026-08-14 - Xray-Nachweise KAN-820 repariert

Die gemeldete Inkonsistenz wurde direkt in Jira geprüft: KAN-820 hatte im
Bereich Anhänge keine Einträge, während KAN-823 sechs Screenshot-Anhänge zeigte.
Die sechs lokalen KAN-820-Nachweise waren noch vorhanden. Ursache war damit
kein fehlender Testlauf, sondern ein fehlgeschlagener bzw. nicht persistierter
Upload beim ursprünglichen Durchlauf.

Die sechs Dateien wurden über den Standard-Jira-Anhang am Vorgang KAN-820
hochgeladen. Eine erneute Prüfung des Jira-Vorgangs zeigt alle sechs Dateien;
eine Prüfung des Xray-Testlaufs KAN-899 zeigt sie zusätzlich unter
„Vorgangs-Anhänge zum Test“. Der Teststatus blieb unverändert: 10 PASS, 323 TO
DO, 333 Tests gesamt. Es wurden keine weiteren fachlichen Änderungen oder
schreibenden Shop-Aktionen ausgeführt.

## 2026-08-14 - Responsive-Xray-Pruefung fuer hohe Aufloesungen

Die neuen Zielbreiten 1920 x 1080, 2560 x 1440, 3440 x 1440 und 3840 x 2160
wurden auf den oeffentlichen Shop-Routen `/`, `/karten`, `/vorverkauf`,
`/anfragen`, `/verkaufen`, `/ueber-uns`, `/account` und `/checkout` geprueft.
Die CSS-Viewportwerte wurden im Browser verifiziert; auf keiner Route wurde ein
horizontaler Ueberlauf ueber `document.documentElement.scrollWidth` oder
`body.scrollWidth` festgestellt.

Die kritische Sichtpruefung fand einen reproduzierbaren Layoutfehler auf der
Startseite: Im Abschnitt `Mach uns ein Angebot.` wird die Angebots-Spalte ab
2560 CSS-Pixeln kollabiert. Die Ueberschrift und der Begleittext haben dort eine
Bounding-Box-Breite von 0 Pixeln und sind nicht sauber lesbar. Der Befund ist
kein Artefakt der Screenshot-Kachelung, sondern durch die DOM-Metriken bestaetigt.
Bei 1920 Pixeln ist die Spalte bereits auffaellig schmal.

Dafuer wurde KAN-1355 mit Reproduktionsschritten, Sollverhalten, betroffenen
Viewports und dem Nachweis `responsive-home-3840-offer-section.jpg` angelegt.
Der Nachweis wurde an KAN-1355, KAN-829 und KAN-820 angehaengt. KAN-829 erhielt
ausserdem einen Kommentar, dass der bisherige PASS den neuen Responsive-Befund
nicht abdeckt. Der alte KAN-899-Testlauf wurde nicht nachtraeglich umgebucht,
weil die Statusauswahl in der sichtbaren Xray-Ausfuehrungsansicht nicht
reagierte; dadurch blieb der historische KAN-829-PASS unveraendert.

Die gesamte Suite umfasst 333 Tests. Die nicht-destruktive oeffentliche
Responsive-Pruefung ist damit abgedeckt; die restlichen 323 Tests bleiben
`TO DO`, weil Kauf-, Zahlungs-, Login-, Bestell- und Adminnahe Szenarien eine
isolierte Umgebung, Testkonten und Testdaten benoetigen. Es wurden keine
produktiven Bestellungen, Zahlungen oder Admin-Schreibvorgaenge ausgefuehrt.

## 2026-08-14 - Zehn abgeschlossene Xray-Tests erneut geprueft

Die zehn bisher als PASS abgeschlossenen visuellen Standardtests KAN-814,
KAN-817, KAN-820, KAN-823, KAN-826, KAN-829, KAN-832, KAN-835, KAN-838 und
KAN-841 wurden erneut gegen den oeffentlichen Shop bewertet. Die exakten CSS-
Viewports waren Full HD 1920 x 1080, WQHD 2560 x 1440, Ultrawide 3440 x 1440
und 4K 3840 x 2160. Zusaetzlich wurden Produktliste, ein echter Produktdetail-
pfad, Anfrage-/Verkaufsformulare, Konto-/Leerzustand und die oeffentliche
Navigation gezielt aufgesucht.

Die Ergebnisse wurden in einer konsolidierten Auswertung an KAN-899 sowie in
den betroffenen Testfall-Kommentaren dokumentiert. KAN-814 und KAN-817 zeigen
keinen Ueberlauf in den Navigationsflaechen. KAN-823, KAN-826, KAN-832 und
KAN-838 zeigen die erwarteten sichtbaren Inhalte ohne Ueberlauf. KAN-835 zeigt
stabile geladene Zielansichten; ein echter asynchroner Ladezustand war in der
oeffentlichen Sitzung nicht reproduzierbar.

KAN-820 und KAN-829 sind ab WQHD fachlich als FAIL zu bewerten: Der Abschnitt
`Mach uns ein Angebot.` kollabiert bei 2560, 3440 und 3840 CSS-Pixeln; die
Bounding-Box der Ueberschrift wird 0 Pixel breit. Bei Full HD ist die Spalte
bereits auffaellig schmal. Der Fehler ist in KAN-1355 beschrieben und mit
`responsive-home-3840-offer-section.jpg` belegt.

KAN-841 konnte in dieser Browsersteuerung nicht belastbar wiederholt werden:
Die Tab-Taste liess den Fokus trotz vorhandener Fokusziele nicht verlaesslich
vom BODY auf die Links wechseln. Deshalb wurde dieser Test nicht kuenstlich als
PASS oder FAIL gebucht. Ebenso wurden die historischen Xray-Ergebniswerte nicht
umgebucht; KAN-899 bleibt bei 10 PASS, 323 TO DO und 333 Tests gesamt. Es wurden
keine Bestellungen, Zahlungen oder produktiven Admin-Schreibvorgaenge ausgefuehrt.

## 2026-08-14 - Xray-Statuswerte der zehn Wiederholungstests angepasst

Die Xray-Testausfuehrung KAN-899 wurde ueber die sichtbare Xray-Testlaufansicht
aktualisiert. Die Statusauswahl war als `data-status-id`-Steuerung im Xray-
Testlauf vorhanden; eine direkte Statusaenderung wurde jeweils gespeichert und
anschliessend erneut geladen verifiziert.

Geaendert wurden KAN-820 und KAN-829 von `PASSED` auf `FAILED`. Beide Tests
zeigen den reproduzierten Layoutfehler im Abschnitt `Mach uns ein Angebot.` ab
WQHD; der Fehler ist in KAN-1355 beschrieben und mit Screenshot belegt. KAN-841
wurde von `PASSED` auf `TO DO` gesetzt, weil die Tab-Tastatursteuerung in der
Browsersteuerung nicht verlaesslich simulierbar war. Die Xray-Konfiguration
bietet keinen `BLOCKED`-Status; `TO DO` ist deshalb der nicht-irrefuehrende
Status fuer einen nicht abgeschlossenen Testlauf.

Die sieben uebrigen Tests blieben `PASSED`: KAN-814, KAN-817, KAN-823, KAN-826,
KAN-832, KAN-835 und KAN-838. Die Ausfuehrungsuebersicht bestaetigt nach der
Aenderung `7 PASSED`, `2 FAILED`, `324 TO DO`, `333` gesamt. Jeder der zehn
Testlaeufe wurde einzeln nachgeladen und auf seinen Status geprueft. Die
Statusaenderung und Begruendung wurden zusaetzlich als Kommentar an KAN-899
gespeichert. Es wurden keine Shopdaten, Bestellungen, Zahlungen oder Admin-
Schreibvorgaenge veraendert.

## 2026-08-14 - Naechste 20 Xray-Tests wegen fehlender nativer Schritte blockiert

Die naechsten 20 offenen Tests der Ausfuehrung KAN-899 wurden in der Xray-Reihenfolge KAN-897 bis KAN-878 einzeln aufgerufen. Jeder Testlauf stand auf `TO DO`. Im unteren Bereich der Xray-Ausfuehrung zeigte jeder Vorgang `Schritte 0 / Keine`; die fachlichen Schritte aus der Beschreibung sind keine nativen Xray-Manual-Steps und koennen deshalb nicht schrittweise ausgefuehrt oder mit Schrittresultaten belegt werden.

Es wurden keine PASS- oder FAIL-Werte erfunden. Alle 20 Testlaeufe bleiben `TO DO`; KAN-899 bleibt bei 7 PASSED, 2 FAILED, 324 TO DO und 333 Tests gesamt. Fuer jeden betroffenen Vorgang wurde ein eigener Screenshot des konkreten Xray-Testlaufs mit Titel, Status und Umgebung als Jira-Anhang gespeichert. Die lokalen Nachweise liegen unter `docs/jira/generated/e9-next-20/`.

Waehrend der Diagnose wurden bei KAN-878 kurzzeitig vier unvollstaendige native Schritte angelegt. Sie wurden vollstaendig geloescht und KAN-878 anschliessend wieder mit `Schritte 0 / Keine` verifiziert; die Testbeschreibung wurde nicht veraendert. Als umsetzbarer Folgepunkt wurde Jira-Todo KAN-1356 erstellt. Es fordert die Anlage der nativen Schritte, deren fachliche Pruefung sowie die anschliessende erneute Ausfuehrung mit Schritt-, Viewport- und Screenshot-Nachweisen. Shopdaten, Bestellungen, Zahlungen und Admin-Schreibvorgaenge blieben unberuehrt.

## 2026-08-14 - Weitere 30 Xray-Tests wegen fehlender nativer Schritte blockiert

Die naechsten 30 offenen Tests der Ausfuehrung KAN-899 wurden in der Reihenfolge
KAN-877 bis KAN-848 einzeln geprueft. Jeder Testlauf stand auf `TO DO` und zeigte
im Xray-Testlauf `Schritte 0 / Keine`. Damit sind die Schritte weiterhin nur als
Beschreibungstext importiert und nicht als native Xray-Manual-Steps ausfuehrbar.

Es wurden keine Ergebniswerte vorweggenommen oder umgebucht. Die 30 Testlaeufe
bleiben `TO DO`; die Ausfuehrung KAN-899 bleibt bei 7 PASSED, 2 FAILED, 324 TO
DO und 333 Tests gesamt. Fuer jeden Test wurde ein eigener Screenshot des
konkreten Xray-Laufs als Blocker-Nachweis erzeugt und am Jira-Test angehaengt.
Die lokalen Dateien liegen unter `docs/jira/generated/e9-next-30/`.

Als Folgepunkt wurde Jira-Todo KAN-1357 erstellt. Es fordert die Umwandlung der
Beschreibungen in native Manual Steps, deren fachliche Pruefung und danach die
erneute Ausfuehrung mit Schritt-, Responsive-Viewport- und Screenshotnachweisen.
Es wurden keine Stories, Testbeschreibungen, Shopdaten, Bestellungen, Zahlungen
oder Admin-Schreibvorgaenge veraendert.

## 2026-08-14 - Native Manual Steps fuer alle Xray-Tests angelegt

Die vorherigen Blocker `KAN-1356` und `KAN-1357` zeigten, dass die vier
fachlichen Schritte nur als Beschreibungstext vorlagen. Deshalb wurden die
Vorlagen aus `build-expansion.mjs` nach Testtyp aufgeloest und als native
Xray-Manual-Steps importiert. Jeder der 333 Tests KAN-565 bis KAN-897 besitzt
jetzt vier Schritte mit den Feldern Aktion, Daten und Erwartetes Resultat; die
Daten enthalten den konkreten Story- und Testbezug sowie die Testart.

Der belastbare Importweg war Xrays Zwischenablage-Import: tab-getrennte Werte
mit Kopfzeile `Action`, `Data`, `Expected Result`, anschliessende Zuordnung auf
`Aktion*`, `Daten` und `Erwartetes Resultat`, danach Speichern ueber `Erstellen`.
Ein direkter Datei-Upload war in der eingebetteten Xray-Modalansicht nicht
zuverlaessig ausloesbar; die Zwischenablage wurde deshalb bewusst verwendet.
Nach jedem Import wurde der native Schrittbereich geprueft; einzelne
transiente UI-Fehler wurden durch einen sicheren Wiederholungsversuch behandelt,
der bei bereits vorhandenen Schritten nichts doppelt anlegt.

Stichproben nach Reload: KAN-565, KAN-620, KAN-820, KAN-849, KAN-878 und
KAN-897 zeigen jeweils alle vier erwarteten Aktionen. Die Xray-Ergebniswerte
blieben unveraendert bei 7 PASSED, 2 FAILED und 324 TO DO. Es wurden keine
Screenshots, Testbeschreibungen, Stories, Tasks, Shopdaten, Bestellungen,
Zahlungen oder Admin-Schreibvorgaenge veraendert.

## 2026-08-14 - Erste 30 Xray-Tests ausgefuehrt

Die ersten 30 Testfaelle der Xray-Testausfuehrung KAN-899 wurden in ihrer
Reihenfolge KAN-897 bis KAN-868 bearbeitet. Die zuvor nur im Beschreibungstext
vorhandenen fachlichen Schritte wurden in der nativen Xray-Testlaufansicht
zusammengefuehrt und je Test mit vier Schrittresultaten dokumentiert.

Fuer jeden Test wurden vier Schritt-Screenshots sowie sieben Viewport-Screenshots
angehaengt: Desktop 1440 x 900, Full HD 1920 x 1080, WQHD 2560 x 1440,
Ultrawide 3440 x 1440, 4K 3840 x 2160, Tablet 768 x 1024 und Smartphone
390 x 844 CSS-Pixel. Die CSS-Metrikpruefung zeigte in allen bearbeiteten
Viewporten keinen horizontalen Ueberlauf. Die Ansicht wurde danach auf die
Standardgroesse zurueckgesetzt.

Die Ausfuehrungsuebersicht KAN-899 bestaetigt `25 PASSED`, `14 FAILED`,
`294 TO DO`, `333` Tests gesamt. Die zehn Fehler-/Regressionstests wurden
wegen des reproduzierten und als KAN-1355 dokumentierten Layoutfehlers auf
`FAILED` gesetzt; KAN-872 und KAN-869 wurden wegen der nicht vollstaendig
persistierten Test-Set-Zuordnung ebenfalls als Traceability-Fehler dokumentiert.
Die Test-Set-Oberflaeche speicherte 25 von 30 Zuordnungen in KAN-1358; die fuenf
fehlenden Zuordnungen konnten dort nicht dauerhaft hinzugefuegt werden.

Die Jira-Anhaenge wurden stichprobenartig nach dem Upload und ueber die
Anhangspaginierung verifiziert. Es wurden keine Bestellungen, Zahlungen oder
produktiven Admin-Schreibvorgaenge ausgefuehrt.

## 2026-08-14 - Naechste 30 Xray-Tests ausgefuehrt

Der tatsaechlich naechste offene 30er-Block der Testausfuehrung KAN-899 bestand
aus KAN-867 bis KAN-839 sowie KAN-837. KAN-838 war bereits vor diesem Block
PASSED und wurde zusaetzlich erneut geprueft, aber nicht als neuer offener Fall
gezaehlt. Alle 30 offenen Tests wurden mit vier nativen Xray-Schritten
ausgefuehrt.

Fuer jeden der 30 offenen Tests wurden vier Schritt-Screenshots und sieben
Viewport-Screenshots als Jira-Anhaenge erzeugt: 1440 x 900, 1920 x 1080,
2560 x 1440, 3440 x 1440, 3840 x 2160, 768 x 1024 und 390 x 844 CSS-Pixel.
In der CSS-Metrikpruefung wurde fuer keinen der bearbeiteten Tests ein
horizontaler Ueberlauf festgestellt. Die sichtbare Xray-Listenansicht
bestaetigt 19 PASSED und 11 FAILED; die elf FAILED-Faelle sind
Fehler-/Regressionstests mit dem offenen bekannten Layoutfehler KAN-1355.

KAN-849 blieb nach einem fehlgeschlagenen Statuswechsel kurz auf EXECUTING und
wurde manuell auf FAILED gesetzt und um die sieben Viewport-Nachweise ergaenzt.
KAN-848 wurde nach einem unterbrochenen Lauf vollstaendig nachgeholt. KAN-837
wurde nach verzogerter nativer Schrittanzeige in einem Wiederholungsversuch
erfolgreich ausgefuehrt. Der Kopfzaehler von KAN-899 zeigt danach konsistent
`44 PASSED`, `25 FAILED`, `264 TO DO`, `333` gesamt.

## 2026-08-14 - Naechste 39 Xray-Tests ausgefuehrt

Der naechste offene Block in der Xray-Testausfuehrung KAN-899 wurde nach
Ueberspringen bereits abgeschlossener Tests ausgefuehrt: KAN-836, KAN-834,
KAN-833, KAN-831, KAN-830, KAN-828, KAN-827, KAN-825, KAN-824, KAN-822,
KAN-821, KAN-819, KAN-818, KAN-816, KAN-815, KAN-813, KAN-812, KAN-811,
KAN-810, KAN-809, KAN-808, KAN-807, KAN-806, KAN-805, KAN-804, KAN-803,
KAN-802, KAN-801, KAN-800, KAN-799, KAN-798, KAN-797, KAN-796, KAN-795,
KAN-794, KAN-793, KAN-792, KAN-791 und KAN-790. KAN-835, KAN-832, KAN-829,
KAN-826, KAN-823, KAN-820, KAN-817 und KAN-814 waren bereits abgeschlossen
und wurden deshalb nicht erneut als offene Tests gezählt.

Alle 39 Tests wurden mit vier nativen Xray-Schritten ausgeführt. Je Test
wurden vier Schritt-Screenshots und sieben Viewport-Screenshots als Jira-
Anhänge hochgeladen: Desktop 1440 x 900, Full HD 1920 x 1080, WQHD 2560 x
1440, Ultrawide 3440 x 1440, 4K 3840 x 2160, Tablet 768 x 1024 und
Smartphone 390 x 844 CSS-Pixel. Die CSS-Metrikprüfung ergab in allen Fällen
keinen horizontalen Überlauf. Fehlerfälle erhielten zusätzlich den
KAN-1355-Referenznachweis.

Die Einzelergebnisse sind 24 `PASSED` und 15 `FAILED`. Nach dem Reload zeigt
KAN-899 konsistent `68 PASSED`, `40 FAILED`, `225 TO DO`, `333` Tests gesamt.
Die lokale Evidenzprüfung bestätigt für jeden der 39 Tests mindestens elf
Beweisdateien; fehlende Screenshot-Anhänge wurden nicht festgestellt.

## 2026-08-14 - Naechste 50 Xray-Tests ausgefuehrt

Der naechste offene 50er-Block der Xray-Testausfuehrung KAN-899 wurde in der
Reihenfolge KAN-789 bis KAN-740 bearbeitet. Alle 50 Tests standen zu Beginn
auf `TO DO`; bereits erledigte Vorgaenge wurden nicht erneut ausgefuehrt.

Alle Tests wurden mit vier nativen Xray-Schritten ausgefuehrt. Je Test wurden
vier Schritt-Screenshots und sieben Viewport-Screenshots als Jira-Anhaenge
hochgeladen: Desktop 1440 x 900, Full HD 1920 x 1080, WQHD 2560 x 1440,
Ultrawide 3440 x 1440, 4K 3840 x 2160, Tablet 768 x 1024 und Smartphone
390 x 844 CSS-Pixel. Die CSS-Metrikpruefung zeigte keinen horizontalen
Ueberlauf. Fehlerfaelle erhielten zusaetzlich den Referenznachweis fuer den
offenen Layoutfehler KAN-1355.

Die Einzelresultate sind 33 `PASSED` und 17 `FAILED`. Nach dem Reload bestaetigt
die Xray-Ausfuehrungsuebersicht KAN-899 konsistent `101 PASSED`, `57 FAILED`,
`175 TO DO`, `333` Tests gesamt. Fuer alle 50 Tests wurden lokal mindestens
elf Evidenzdateien gefunden; fehlende Screenshot-Anhaenge wurden nicht
festgestellt.

Bei KAN-787, KAN-775, KAN-779 und KAN-768 war die Testdefinition im Xray-Lauf
zunaechst noch nicht synchronisiert. Die nativen Schritte wurden gezielt
zusammengefuehrt und die Tests anschliessend erfolgreich ausgefuehrt; kein
Test blieb technisch blockiert.

## 2026-08-14 - Restliche 175 Xray-Tests pausiert

Auf Wunsch des Nutzers wurde der laufende Block nach dem zuletzt bearbeiteten
Test KAN-691 angehalten. Von KAN-739 bis KAN-691 sind 49 Tests vollständig
ausgeführt und mit vier nativen Schrittresultaten, vier Schritt-Screenshots
und sieben Viewport-Screenshots dokumentiert; Fehlerfälle erhielten den
KAN-1355-Referenznachweis. Bis zur Pause ergeben sich 33 `PASSED` und 16
`FAILED`. Die Fortsetzung beginnt mit KAN-690. Eine technische Besonderheit
des Browserlaufs war, dass einzelne Xray-Editoren bereits vorbefüllte
Ergebnistexte zeigten; der Bearbeitungsablauf wurde dafür stabilisiert.

## 2026-08-16 - Desktop-Pet statt Avatar-Anwendungsfenster

Der Webshop zeigt im Adminbereich keinen Live-Avatar mehr. Die Pairing-Funktion
bleibt dort als einzige notwendige Desktop-Verbindung sichtbar. Der Grund für
die scheinbar fehlende Reaktion war zweifach: Die produktive Ereignistabelle war
leer, und die WinUI-App hatte im Leerlauf keinen Timer, der den Atlas wechselte.

Die WinUI-App verwendet nun im verbundenen Zustand ein transparentes,
rahmenloses Always-on-top-Fenster mit dem Avatar als einzigem sichtbaren Inhalt.
Eine separate Idle-Uhr sorgt für permanente sichtbare Bewegung; die vier
Ereignisanimationen bleiben in ihrer Warteschlange und werden weiterhin über
den geschützten Gerätefeed ausgelöst. Die Setup-Ansicht wird nur beim ersten
Koppeln oder nach „Verbindung ändern“ eingeblendet.

Der lokale WinUI-Build lief mit 0 Fehlern und 0 Warnungen. Der Webtestlauf
bestand mit 356/356 Tests; die TypeScript-Prüfung war erfolgreich. Der Worker
wurde auf Produktionsversion `fee50e21-b368-4069-a381-0ffb967b28de` deployed
und die produktive Admin-Seite danach auf das Entfernen des Live-Avatars sowie
das Weiterbestehen der Desktop-Verbindung geprüft. Es wurden keine Secrets
ausgegeben und keine Testereignisse in die Produktion geschrieben.

## 2026-08-16 - Native Transparenz für den Desktop-Pet

Der Screenshot mit schwarzer Fläche und weißem Rahmen zeigte die bekannte
Einschränkung: Ein transparentes XAML-Root allein macht ein WinUI-3-
Top-Level-Fenster nicht zu einem echten transparenten Desktop-Pet. Die
Anwendung erhielt deshalb eine kleine native Win32-Interop-Schicht.

Im Pet-Modus wird das Fenster als rahmenloses `WS_POPUP` mit
`WS_EX_LAYERED` geführt. Eine eindeutige Color-Key-Fläche wird über
`SetLayeredWindowAttributes` aus dem Fenster entfernt; der native Non-Client-
Rahmen und der schwarze Button-Hintergrund werden ebenfalls nicht mehr
angezeigt. Für die Pairing-Ansicht werden die ursprünglichen Fensterstile
wiederhergestellt, damit die Einrichtung weiterhin lesbar bleibt.

Der WinUI-Build lief danach mit 0 Fehlern und 0 Warnungen. Die neue Instanz
wurde erneut gestartet und antwortet. Produktive D1-Daten, Eventfeed,
Pairing-Token und Cloudflare-Konfiguration wurden nicht verändert.

## 2026-08-16 - Color-Key-Ansatz durch DWM-Transparenz ersetzen

Die Nutzerprüfung zeigte, dass der vorherige Color-Key-Ansatz nicht griff: Das
grüne Füllfeld wurde als sichtbarer Teil der WinUI-Komposition dargestellt.
Dieser Ansatz wurde deshalb vollständig entfernt.

Das Pet verwendet nun ein rahmenloses `WS_POPUP` und erweitert den DWM-Frame
über die gesamte Fensterfläche (`DwmExtendFrameIntoClientArea` mit negativen
Rändern). Zusätzlich setzt die native Fensterkompositions-API den transparenten
Gradient-Zustand. Das XAML zeichnet keine Hintergrundfarbe mehr; der kleine
Einstellungsbutton ist ebenfalls ohne Hintergrund.

Die Anwendung wurde danach mit 0 Fehlern und 0 Warnungen gebaut, die alte
Instanz beendet und die neue Instanz gestartet. Es wurden keine produktiven
Daten, Tokens oder Cloudflare-Einstellungen verändert.

## 2026-08-16 - Native per-pixel-Transparenz für den Desktop-Pet

Die DWM-Variante wurde durch ein echtes natives `WS_EX_LAYERED`-Overlay ersetzt.
Die WinUI-Hauptansicht wird im verbundenen Zustand ausgeblendet; das Overlay
zeichnet ausschließlich eine 260x300 große ARGB-Fläche über
`UpdateLayeredWindow`. Der Avatar wird aus einer transparenten PNG-Atlasdatei
gerendert, sodass kein XAML-, Color-Key- oder DWM-Hintergrund mehr an der
sichtbaren Pet-Fläche beteiligt ist. Rechtsklick oder Doppelklick öffnet wieder
die Verbindungsansicht.

Der Atlas wurde aus dem bestehenden validierten WebP deterministisch in PNG
überführt. Die Pixelprüfung ergab 642866 sichtbare und 2232526 transparente
Pixel sowie 0 RGB-Rückstände in transparenten Pixeln. Die gerenderte
260x300-Vorschau zeigt ausschließlich den Avatar auf dem Prüf-Hintergrund.

Der WinUI-Build lief mit 0 Warnungen und 0 Fehlern. Das Standard-Launch-Profil
wurde auf `BrandyCards.Desktop (Unpackaged)` korrigiert. Die native
Fensteraufnahme konnte in dieser Codex-Ausführungsumgebung noch nicht erfolgen,
weil dort keine sichtbaren Top-Level-Fenster enumeriert werden; die echte
Desktop-Sichtprüfung bleibt deshalb offen. Produktionsdaten, Tokens und
Cloudflare-Einstellungen wurden nicht verändert.

## 2026-08-16 - Erneuter Build nach dem Transparenzwechsel

`NativePetOverlay` wurde nochmals geprüft: `SetFrame(0, 0)` wird erst nach
`ShowWindow` ausgeführt und der fehlende Screen-DC wird sicher abgefangen. Der
Output-Atlas enthält 1536x1872 Pixel; die Ecke hat Alpha 0 und keinen RGB-
Rückstand. Der erneute Build mit dem Unpackaged-Profil lief mit 0 Warnungen und
0 Fehlern.

Ein separater Laufzeit-Smoketest konnte in der Codex-Ausführungsumgebung kein
Fenster erzeugen, weil `EnumWindows` dort 0 Top-Level-Fenster liefert. Das ist
eine Einschränkung der isolierten Desktop-Sitzung; der sichtbare Windows-
Desktop des Benutzers ist damit nicht fotografisch verifiziert. Es wurden keine
Produktionsdaten, Tokens oder Cloudflare-Einstellungen verändert.

## 2026-08-16 - Finaler Screenshot-Nachweis der Pet-Transparenz

Der Fehler lag im manuellen `CreateDibSection`-Pfad: Der Aufruf hing in der
interaktiven Windows-Sitzung, obwohl das Fenster bereits sichtbar war. Der
Overlay-Frame wird jetzt aus dem transparenten `Bitmap` mit
`GetHbitmap(Color.FromArgb(0, 0, 0, 0))` erzeugt und an
`UpdateLayeredWindow` übergeben. Die temporäre Diagnoseprotokollierung und die
Debug-Marker wurden anschließend aus dem Quellcode entfernt.

Der bereinigte Build lief mit 0 Warnungen und 0 Fehlern. Der echte Windows-
Desktop wurde DPI-bewusst aufgenommen; der Avatar ist am unteren rechten Rand
sichtbar, ohne grünes Rechteck oder schwarzen Fensterrahmen. Der ausgeschnittene
260x300-Overlay-Bereich enthielt in 19.500 Stichproben 0 grüne Hintergrundpixel.
Produktionsdaten, Tokens und Cloudflare-Einstellungen blieben unverändert.

## 2026-08-17 - Aufrufzähler im Adminbereich

Der Adminbereich zeigt jetzt die Seitenaufrufe des eigenen Shops in drei
Zeiträumen (24 Stunden, 7 Tage, 30 Tage) samt Aufschlüsselung nach
Seitenbereich. Vier Entscheidungen dahinter sind erklärungsbedürftig.

**Gezählt wird im Browser, nicht im Worker.** Im Worker wäre es billiger zu
haben gewesen — jede Anfrage kommt dort ohnehin vorbei. Er sieht aber auch
Suchmaschinen, Vorabrufe, RSC-Nachladungen und jede Bilddatei. Die Zahl im
Adminbereich wäre ein Vielfaches dessen gewesen, was jemand tatsächlich
angesehen hat, und hätte sich bei jeder Änderung am Ausliefern verschoben,
ohne dass sich am Besucherverhalten etwas geändert hätte. Der Preis der
Browser-Variante: Besucher ohne JavaScript zählen nicht mit.

**Ein Eimer je Stunde und Pfadmuster, kein Ereignisprotokoll.** Eine Zeile je
Aufruf wäre die naheliegende Form gewesen und die falsche: Sie wächst mit dem
Erfolg des Shops, und jede 30-Tage-Auswertung müsste alles davon lesen. So
kostet ein Aufruf einen Schreibvorgang, die Auswertung liest höchstens 720
Eimer je Muster, und es gibt schlicht keine Stelle, an der etwas über eine
einzelne Person stehen könnte.

**Der Pfad wird auf ein Muster reduziert.** Roh gespeichert bekäme jede der
~300 Karten eine eigene Zeile je Stunde — aus 17 Zeilen am Tag würden 7 000.
Zusätzlich trügen Abfrageparameter die Suchbegriffe der Besucher in die
Datenbank. `/karten/<id>` wird deshalb zu `/karten/[id]`, Abfrage und Anker
fallen weg. Aufrufzahlen je einzelnem Angebot gibt es für die eBay-Seite
weiterhin in `ebay_listing_traffic`; die beiden Zahlen messen Verschiedenes und
sind nicht vergleichbar.

**Der Adminbereich zählt sich selbst nicht mit.** Die eigenen Besuche des
Betreibers in der Zahl, an der er den Shop misst, wären eine Verfälschung — und
zwar die größte genau dann, wenn sonst wenig los ist.

Datenschutzseite, Abschnitt 11, wurde nachgezogen: Sie behauptete bis heute,
es gebe keinerlei Analysefunktionen. Der Zähler setzt kein Cookie, speichert
keine Adresse, keine Geräte- oder Sitzungskennung und bildet kein Profil; die
Eimer werden nach 90 Tagen vom bestehenden Cron gelöscht.

**Was der Zähler nicht kann:** rückwirkend zählen. Es gibt keine historischen
Daten, der erste Eimer entsteht mit dem Deploy. Die Zahlen für 7 und 30 Tage
sind bis dahin unvollständig, und das steht als Satz in der Kachel — sonst
läse sich der Aufbau der Messung wie ein einbrechender Shop.

## 2026-08-17 — Warum die Kartenbilder im Admin unsichtbar waren

Unter `/admin` stand bei jedem Kartenangebot nur das Ersatzsymbol des Browsers
mit dem Alternativtext. Die Bilder lagen nicht falsch, sie kamen nicht durch die
eigene Sicherheitsregel.

Die eingesendeten Bilder sind bewusst **nicht** frei abrufbar: Sie liegen in R2
und `/api/admin/card-submissions/assets` gibt sie nur gegen eine gültige
Adminsitzung heraus. Ein `<img src="/api/…">` trüge diesen Kopf nicht — der
Browser lädt Bilder ohne die Kopfzeilen, die `fetch` mitschickt. `app/admin/page.tsx`
holt sie deshalb angemeldet per `fetch` und legt das Ergebnis mit
`URL.createObjectURL` als `blob:`-Adresse in die Seite.

Genau dort griff die CSP: `img-src` nannte `'self'`, `data:` und die
eBay-Bildserver — aber kein `blob:`. **`'self'` deckt `blob:` nicht ab**, das ist
ein eigenes Schema mit eigener Erlaubnis. Der Browser verwarf jedes Bild still;
in der Seite blieb ein `<img>` mit einer Adresse, die er nicht laden durfte. Das
sieht exakt aus wie ein kaputter Upload, war aber keiner — die Dateien lagen die
ganze Zeit unversehrt in R2.

**Warum `blob:` sicherheitlich billig ist:** Eine solche Adresse entsteht nur im
Browser selbst, aus Daten, die diese Seite bereits geladen hat, und ist auf das
Dokument beschränkt, das sie erzeugt hat. Sie öffnet keine fremde Herkunft —
anders als es ein zusätzlicher Hostname täte. Der Angriffsweg, gegen den
`img-src` schützt (Bilder von fremden Servern nachladen und damit Daten
hinaustragen), bleibt unverändert versperrt.

Die Regel steht ab jetzt in `tests/hardening.test.mjs`, mit dem Fehlerbild als
Begründung daneben. Ohne den Test sähe `blob:` beim nächsten Aufräumen der CSP
wie überflüssiger Ballast aus — und `/admin` wäre wieder blind.

## 2026-08-17 — Warum trotz reparierter CSP kein Bild kam

Nach der `blob:`-Korrektur blieb das Ersatzsymbol stehen. Der zweite Grund lag
nicht im Code, sondern im Datenbestand: **Keine der fünf eingesendeten Dateien
enthält ein Bild.** Aus R2 geholt und aufgemacht:

| Angebot | Datei | Aufbau |
|---|---|---|
| Nachweis 2MB | 2 000 022 B | JFIF-Kopf (20 B), dann Zufallsbytes, am Ende `ffd9` |
| Grenztest900 | 921 622 B | dito |
| Grenztest500 | 512 022 B | dito |
| Grenztest200 | 204 822 B | dito |
| (PNG) | 14 B | PNG-Signatur, dahinter das Wort `KAPUTT` |

Den vier JPEG-Dateien fehlen `SOF0` und `SOS` — also Bildgröße und Bilddaten.
Was bleibt, ist ein Umschlag ohne Inhalt. Die Größen verraten die Herkunft:
200/500/900 KB und 2 MB, jeweils plus 22 Byte Kopf. Das sind Prüfdateien aus
einem Test der Upload-Grenzen, keine Fotos.

**Warum sie überhaupt angenommen wurden:** Der Upload prüft die ersten Bytes —
und die stimmen. Ein gültiger Dateikopf ist aber kein Beweis für ein
decodierbares Bild. Das ist eine bewusste Grenze der Prüfung und kein Fehler:
Vollständiges Decodieren im Worker kostet Rechenzeit und Speicher an einer
Stelle, die jeder Fremde ohne Anmeldung erreicht.

**Was daraus folgt, unabhängig von diesen Testdateien:** Das Ersatzsymbol des
Browsers sieht bei einer blockierten Adresse genauso aus wie bei einer Datei
ohne Bilddaten. Diese Ununterscheidbarkeit hat die Suche in die falsche Richtung
gelenkt — erst zur CSP, die tatsächlich kaputt war, aber eben nur die halbe
Geschichte. `app/admin/requests-panel.tsx` schreibt jetzt hin, was los ist:
„Bild nicht abrufbar" (der Abruf scheiterte) oder „Datei ist kein Bild" (der
Browser konnte nichts daraus machen). Dieselbe Überlegung wie bei „keine
Preisvorstellung": Eine leere Stelle ist von einem Anzeigefehler nicht zu
unterscheiden.

## 2026-08-17 — Warum ein fehlgeschlagener Aufruf niemand abmeldet

Nach drei Preisvorschlägen stand auf der Kartenseite der Anmeldekasten — bei
einem angemeldeten Kunden. Erwartet war „Für diese Karte hast du alle Vorschläge
genutzt", und dieser Satz war die ganze Zeit im Code.

Der Server war nicht schuld, das ließ sich an echten Daten zeigen: drei Zeilen
auf `REJECTED` in `price_offers`, also `signedIn: true` und `attemptsLeft: 0`.

Die Ursache war ein zusammengefallenes Begriffspaar. Das Formular kannte
`signedIn: boolean`, und der `catch` schrieb bei **jedem** Fehlschlag
`signedIn: false`:

```ts
} catch {
  if (!cancelled) setState({ signedIn: false, offers: [], attemptsLeft: 0 });
}
```

Ein abgelaufenes Zugriffstoken, ein 503, ein abgebrochenes Netz — alles wurde zu
„nicht angemeldet". Das ist keine Ungenauigkeit, sondern eine **falsche
Auskunft**: Die Seite forderte jemanden zum Anmelden auf, der angemeldet war,
und verschwieg dabei den Zustand, den sie eigentlich zeigen sollte.

Dieselbe Verwechslung hatte schon einmal zugeschlagen. Der Kommentar über
`onAuthStateChange` in derselben Datei beschreibt den Wettlauf beim Seitenaufbau:
Token noch nicht da → Anmeldekasten. Damals wurde ein zweiter Versuch
nachgerüstet, der das Symptom in den meisten Fällen wegräumte. Die Ursache blieb
liegen, und deshalb kam sie wieder — diesmal an einer Stelle, wo kein weiteres
Anmeldeereignis nachkommt, das den Fehler überschreiben könnte.

Jetzt gibt es vier Zustände: lädt, abgemeldet, bereit, Fehler. **Ob jemand
angemeldet ist, entscheidet Supabase. Ob die Abfrage geklappt hat, entscheidet
der Aufruf.** Zwei Fragen, zwei Antworten. Ein `401` gilt weiterhin als
abgemeldet — dort ist es die Wahrheit. Alles andere zeigt einen Hinweis mit
„Erneut versuchen" und sagt ausdrücklich, dass die bisherigen Vorschläge davon
nicht betroffen sind.

Dieselbe Falle steckt in jedem `catch`, der einen Fehler in einen fachlichen
Zustand umdeutet. Am Bild im Adminbereich war es heute schon dasselbe Muster:
Das Ersatzsymbol des Browsers hieß gleichzeitig „blockiert" und „keine
Bilddaten" — auch dort war die Behebung, die Fälle auseinanderzuziehen.
