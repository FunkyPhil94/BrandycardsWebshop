# BrandyCards Agentenprotokoll

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
