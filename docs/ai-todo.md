# Offene Aufgaben

Arbeitsvorrat für kommende KI-Sitzungen. **Von oben nach unten abarbeiten.**

**Vor jedem Punkt:** Eintrag in [ai-handover.md](ai-handover.md) anlegen (Regel in
[CLAUDE.md](../CLAUDE.md)). **Nach jedem Punkt:** Ergebnis nachtragen, committen,
pushen, Punkt nach unten unter „Erledigt" verschieben.

Jede Aufgabe steht für sich — Dateien, Begründung und Abnahmekriterien stehen
dabei, damit niemand den Gesprächsverlauf braucht.

---

## Warum diese Reihenfolge

Drei Überlegungen bestimmen sie, in dieser Rangfolge:

1. **Was kann Geld kosten?** Alle 296 Karten sind Einzelstücke und stehen
   gleichzeitig hier und auf eBay. Ein Doppelverkauf bedeutet Rückerstattung,
   verärgerte Kunden und — bei eBay-Stornos — eine Verschlechterung des
   Verkäuferstatus. Dieses Risiko besteht **jetzt schon**, unabhängig von jeder
   neuen Funktion. Deshalb stehen die billigsten Gegenmaßnahmen ganz oben.
2. **Was hängt woran?** Werbung für das Verhandeln (Punkt 7) darf erst laufen,
   wenn das Erlebnis trägt: richtiger Preis im Checkout, Antwort per E-Mail —
   und vor allem der eBay-Schreibpfad. Mehr Shop-Verkäufe zu bewerben, während
   verkaufte Karten auf eBay online bleiben, vergrößert genau das Risiko aus
   Punkt 1.
3. **Was kostet wenig und wirkt sofort?** Punkt 1 ist eine Zeile, Punkt 2 eine
   Konfiguration, Punkt 3 ein überschaubarer Eingriff. Zusammen nehmen sie den
   Großteil des Risikos weg, bevor jemand den großen Brocken anfasst.

Kurz: **erst absichern, dann das Erlebnis vervollständigen, dann bewerben,
zuletzt ausbauen.**

Die Sicherheitsprüfung (Punkt 8) steht bewusst außerhalb dieser Kette: Sie ändert
nichts und blockiert nichts, kann also jederzeit dazwischengeschoben werden. Ihr
auffälligster Voranalyse-Fund wurde als Punkt 2 vorgezogen, weil er mit einer
Konfigurationszeile behoben ist.

---

## 1. Sync alle 10 Minuten statt stündlich

**Aufwand:** Minuten · **Hängt an:** nichts

**Warum:** Wird eine Karte auf eBay verkauft, erfährt der Shop es erst beim
nächsten Import — aktuell bis zu 60 Minuten später. Solange ist sie hier noch
kaufbar. Das Fenster schrumpft auf ein Sechstel.

**Wie:** In `wrangler.toml` `crons = ["0 * * * *"]` auf `["*/10 * * * *"]`.
Ein Sync-Lauf dauert rund 30 Sekunden und verarbeitet knapp 300 Angebote; alle
10 Minuten trägt das ohne Weiteres.

**Fertig, wenn:** Deployed und im Cloudflare-Dashboard unter „Triggers"
sichtbar; ein Lauf in `sync_runs` mit Status `SUCCEEDED` bestätigt.

---

## 2. Rate-Limiting tatsächlich scharf schalten

**Aufwand:** klein · **Hängt an:** nichts

**Warum:** `lib/rate-limit.ts` nutzt das Cloudflare-Binding `RATE_LIMITER`, falls
vorhanden — **in `wrangler.toml` ist es nicht konfiguriert.** Ohne Binding fällt
der Code auf eine `Map` im Arbeitsspeicher zurück. Workers-Isolate sind aber
kurzlebig und existieren vielfach parallel; eine solche Map teilt sich nichts
mit anderen Instanzen. Die Begrenzung auf `/api/inquiries`,
`/api/card-submissions` und `/api/prelisted-interest` ist damit in Produktion
sehr wahrscheinlich **wirkungslos** — und das ist genau der Schutz gegen Bots
und Formularfluten.

**Wie:** Rate-Limiting-Binding in `wrangler.toml` deklarieren und deployen.
Zusätzlich sollte das Fehlen des Bindings beim Start protokolliert werden — ein
stiller Rückfall auf einen wirkungslosen Schutz ist schlimmer als gar keiner,
weil er Sicherheit vortäuscht.

**Zusammen mit Punkt 8 zu bewerten:** Ohne Bot-Schutz (Turnstile) bleibt auch
ein funktionierendes Rate-Limit nur eine halbe Antwort.

**Fertig, wenn:** Das Binding ist deployed, und wiederholte Anfragen an einen
öffentlichen Endpunkt liefern nachweislich `429` — **lokal geprüft, nicht gegen
die Produktion.**

---

## 3. Bestand live prüfen, bevor Geld fließt

**Aufwand:** klein · **Hängt an:** nichts

**Warum:** Die wirksamste Einzelmaßnahme gegen Doppelverkäufe in der Richtung
„auf eBay verkauft, Shop weiß es nicht". Statt auf den nächsten Import zu warten,
wird genau im entscheidenden Moment gefragt — wenn der Kunde zahlt.

**Wie:** In `app/api/paypal/capture/route.ts` vor dem Capture (alternativ in
`app/api/paypal/orders/route.ts` vor dem Anlegen) für jede Karte der Bestellung
ein `GetItem` gegen eBay und prüfen, ob `QuantityAvailable > 0`. Ein Aufruf je
Karte, nur an dieser einen Stelle. `getEbayItemDescription` in
`lib/ebay-client.ts` zeigt Aufbau und Fehlerbehandlung eines `GetItem`-Aufrufs.

**Wichtig:** Ist eBay nicht erreichbar, darf die Bestellung **nicht** blockiert
werden — sonst legt ein eBay-Ausfall den Shop lahm. Fehler protokollieren und
durchlassen; die Prüfung ist eine zusätzliche Sicherung, keine Voraussetzung.
Beim Capture zusätzlich beachten: Der Kunde hat bei PayPal bereits zugestimmt,
ein Abbruch muss sauber zurückgemeldet und die Reservierung freigegeben werden.

**Fertig, wenn:** Eine Bestellung auf eine bei eBay ausverkaufte Karte wird mit
verständlicher Meldung abgelehnt, statt eine Zahlung entgegenzunehmen.

---

## 4. Checkout zeigt den ausgehandelten Preis

**Aufwand:** klein · **Hängt an:** nichts

**Warum:** Nach einer angenommenen Verhandlung zeigt der Checkout weiterhin den
Listenpreis. Der Rabatt erscheint erst in der Serverantwort und bei PayPal.
Kunden zahlen nie zu viel, sehen den Vorteil aber zu spät — und eine
transparente Preisangabe vor dem Bestellabschluss ist in Deutschland auch
rechtlich das saubere Vorgehen. Solange noch niemand ein angenommenes Angebot
hat, ist das folgenlos; **mit dem ersten angenommenen Vorschlag wird es sofort
sichtbar.**

**Stand:** `app/checkout/page.tsx` rechnet clientseitig aus
`product.priceAmountCents`. Die verbindliche Auflösung liegt in
`lib/price-offers.ts` (`acceptedOfferPrices`), benutzt von
`app/api/orders/route.ts`.

**Wie:** Route `GET /api/account/offers` bauen, die für den angemeldeten Nutzer
alle angenommenen, unverfallenen Angebote als `productId → Betrag` liefert. Der
Checkout zeigt je Position den ausgehandelten Preis, den durchgestrichenen
Listenpreis und die Ersparnis.

**Achtung:** Reine Darstellung. Der verbindliche Preis wird weiterhin
ausschließlich serverseitig bestimmt — niemals einen Betrag aus dem Browser
übernehmen.

**Fertig, wenn:** Ein Konto mit angenommenem Angebot sieht im Checkout exakt den
Betrag, den die Bestellung anschließend berechnet.

---

## 5. Kunden-E-Mails

**Aufwand:** mittel · **Hängt an:** nichts, ist aber Voraussetzung für Punkt 7

**Warum:** Preisvorschläge werden still entschieden. Der Kunde muss von sich aus
auf die Kartenseite zurückkehren, um zu erfahren, ob angenommen wurde. Das
trägt, solange kaum jemand die Funktion kennt — sobald sie beworben wird, ist es
der schwächste Punkt im ganzen Ablauf.

**Fehlt komplett:** Es gibt keinerlei Versand-Infrastruktur. Supabase verschickt
nur seine eigenen Anmelde-Mails. Für eigene Nachrichten braucht es einen
Anbieter; auf Cloudflare Workers bieten sich Resend oder MailChannels an. Der
API-Schlüssel gehört als Cloudflare-Secret hinterlegt, **niemals** ins
Repository.

**Anlässe, nach Wichtigkeit:**
1. Preisvorschlag angenommen — mit Betrag, Gültigkeit und Link zur Karte
2. Preisvorschlag abgelehnt
3. Bestellbestätigung nach erfolgreicher Zahlung
4. Eingangsbestätigung für Anfrage und Kartenankauf

**Ton:** Professionell, aber nicht steif. BrandyCards ist ein Familienprojekt
zweier Brüder, das darf man hören. Kein „Sehr geehrte Damen und Herren", kein
Behördendeutsch — persönlich, knapp, freundlich, geduzt wie der übrige Shop.

**Wichtig:** Ein fehlgeschlagener Versand darf **nie** die auslösende Aktion
scheitern lassen. Muster wie bei der Beschreibungsabfrage in
`app/api/products/[id]/route.ts`: Fehler protokollieren, Ablauf fortsetzen.
Impressum-Link in den Fuß; bei rein transaktionalen Mails ist keine Abmeldung
nötig, bei Werbung schon.

---

## 6. eBay-Schreibpfad reparieren

**Aufwand:** groß · **Hängt an:** nichts · **Blockiert:** Punkt 7

**Warum:** Die zweite Richtung des Doppelverkaufs — im Shop verkauft, eBay weiß
es nicht. Sie ist die unangenehmere: Ein Storno bei eBay verschlechtert den
Verkäuferstatus, das wirkt über den einzelnen Fall hinaus. Und sie wird mit
jedem zusätzlichen Shop-Verkauf wahrscheinlicher — weshalb dieser Punkt vor der
Bewerbung stehen muss.

**Stand:** `mapActiveListing` in `lib/ebay-sync.ts` setzt `ebayOfferId` fest auf
`null`, weil `GetMyeBaySelling` nur eine ItemID liefert und keine
Inventory-API-Offer-ID. Dadurch bricht `enqueueEbayWithdraw` in
`lib/ebay-outbox.ts` sofort ab und die Outbox bekommt nie einen Auftrag. Aktuell
nur dadurch entschärft, dass `EBAY_WRITE_ENABLED=false` steht.

**Wie:** Die Outbox ist fertig — Dedupe-Key, Lease, Backoff, Fehlerstatus — und
wartet nur auf Aufträge. Zu ändern sind Operation und Identifikator: statt
Inventory-API `offer/{offerId}/withdraw` die Trading-API mit der ItemID.

**Empfehlung: `ReviseInventoryStatus` mit Menge 0, nicht `EndItem`.** Der erste
Weg ist **umkehrbar** — läuft eine Bestellung ins Leere oder verfällt die
Reservierung, lässt sich die Menge zurücksetzen. `EndItem` beendet das Angebot
endgültig; Wiedereinstellen geht nur als neues Listing mit neuer ItemID, wodurch
die lokale Zuordnung bricht.

**Vorgehen:**
1. Benötigten OAuth-Scope für den Schreibzugriff prüfen
2. Umstellung an **einer** Testkarte nachweisen
3. Erst dann `EBAY_WRITE_ENABLED=true` setzen — der Schalter existiert genau dafür
4. Nach dem ersten echten Verkauf `ebay_outbox` kontrollieren: Status
   `SUCCEEDED`, kein `FAILED`

**Fertig, wenn:** Ein bezahlter Shop-Verkauf setzt die eBay-Menge nachweislich
auf 0, und die Outbox zeigt den Auftrag als erfolgreich.

---

## 7. Verhandeln auf der Seite bewerben

**Aufwand:** klein · **Hängt an:** Punkt 4, 5 und 6

**Warum:** Die Funktion existiert, aber niemand erfährt davon — dabei ist genau
sie die Antwort auf „warum hier bestellen statt auf eBay". Sie steht bewusst
hinten: Werbung wirkt erst, wenn der Preis im Checkout stimmt (3), der Kunde
eine Antwort bekommt (4) und verkaufte Karten von eBay verschwinden (5).
Vorher würde mehr Zulauf nur mehr Reibung erzeugen.

**Wo:**
- Landingpage: eigener Abschnitt oder Erweiterung der Verweiskacheln
- `/karten`: Hinweis über dem Raster
- Kartendetailseite: das Angebotsformular ist da, darf aber deutlicher einladen

**Botschaft:** Jeder Preis kann so angenommen **oder** verhandelt werden. Der
Gedanke dahinter — dem Hobby etwas zurückgeben — ist der eigentliche Grund und
darf ruhig so gesagt werden. Regeln transparent nennen: nur mit Kundenkonto,
drei Vorschläge je Karte, angenommene Preise gelten 48 Stunden.

**Achtung:** Bei Auktionen gibt es kein Verhandeln, dort wird auf eBay geboten.
Der Text darf das nicht versprechen.

---

## 8. Vollständige Sicherheitsprüfung

**Aufwand:** groß (reine Analyse) · **Hängt an:** nichts · **Blockiert:** nichts

**Warum:** Bisher wurde Sicherheit punktuell mitgedacht, nie systematisch
geprüft. Der Shop nimmt echtes Geld ein, speichert Adressen und nimmt
unauthentifizierte Uploads entgegen.

**Der Auftrag ist ausformuliert:** [security-audit-brief.md](security-audit-brief.md).
Er enthält Systemüberblick, Vertrauensgrenzen, Angreifermodelle, zwölf konkrete
Verdachtsmomente mit Dateiverweisen, Regeln für die Durchführung und das
Berichtsformat. Gedacht für ein Modell mit hoher Reasoning-Tiefe.

**Kann jederzeit laufen** — die Prüfung ändert nichts am System und blockiert
keinen anderen Punkt. Sinnvoll ist sie, sobald ein längeres Zeitfenster da ist.

**Ergebnis:** `docs/security-findings.md`. Daraus abgeleitete Korrekturen kommen
anschließend nach Schweregrad in diese Liste.

**Vorgezogen:** Der auffälligste Voranalyse-Fund steckt bereits als Punkt 2 hier
drin — er ist zu billig zu beheben, um auf den Bericht zu warten.

---

## 9. Englische Sprachversion

**Aufwand:** sehr groß · **Hängt an:** einer Entscheidung des Nutzers

**Warum:** Ausdrücklich für später vorgesehen. Sammelkarten sind ein
internationaler Markt.

**Ehrlich zum Umfang:** Das ist die größte Aufgabe der Liste und kein
Nebenbei-Projekt. Sämtliche Oberflächentexte liegen fest verdrahtet in den
Komponenten, dazu die Fehlermeldungen aller API-Routen (`lib/public-form.ts` und
jede Route einzeln) sowie die Rechtstexte.

**Vor dem ersten Handgriff mit dem Nutzer klären:**
- Nur Oberfläche, oder auch Rechtstexte? Letztere brauchen fachliche Prüfung —
  eine maschinelle Übersetzung von AGB und Widerrufsbelehrung wäre riskant.
- **Kartentitel und eBay-Beschreibungen kommen deutsch von eBay** und lassen
  sich nicht mitübersetzen. Wie soll der Shop damit umgehen? Das ist die
  unangenehmste Frage, weil sie den Nutzen begrenzt.
- Sprache in der URL (`/en/...`) oder über eine Einstellung im Konto?
- Preise und Versandkosten bleiben in Euro.

**Empfehlung:** Nicht ohne Bibliothek anfangen — Next.js bringt Bausteine für
lokalisiertes Routing mit. Und erst beginnen, wenn die vier Fragen beantwortet
sind.

---

## Dauerregeln

- **Alles committen und pushen.** Am Ende jeder Sitzung darf nichts
  unversioniert liegen bleiben. Prüfen mit `git status --short` und
  `git log --oneline origin/agent/initial-brandycards..HEAD` — beides muss leer
  sein. Der lokale DNS-Resolver fällt sporadisch aus, `git push` daher notfalls
  wiederholen.
- **Vor jedem Deploy:** `.env.local` muss im Build-Verzeichnis liegen, sonst
  brechen `/admin` und `/account`. Danach `npx tsc --noEmit`, `npm run lint`,
  `npm test` — CI prüft keine Typen.
- **Produktionsdaten** nur lesend anfassen; schreibende Eingriffe nach Rücksprache.
- **Nach dem Deploy** eine Seite prüfen, die Client-Konfiguration braucht
  (`/admin` oder `/account`) — Startseite und API sehen auch dann gesund aus,
  wenn das Bundle kaputt ist.

---

## Erledigt

_(Erledigte Punkte hierher verschieben, mit Datum und Commit.)_
