# BrandyCards Agentenprotokoll

Dieses Protokoll hält fest, welche spezialisierten Agents im Projekt eingesetzt wurden, welche Prüfaufträge sie erhielten und wie ihre Ergebnisse in die Umsetzung eingeflossen sind.

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

## Arbeitsweise

Agents erhalten klar abgegrenzte Prüf- oder Implementierungsaufträge. Ihre Ergebnisse werden vor Übernahme geprüft. Änderungen werden anschließend lokal getestet, committed und nach GitHub gepusht.
