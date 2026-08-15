# BrandyCards Agentenprotokoll

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
