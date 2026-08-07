# Offene Aufgaben

Arbeitsvorrat für kommende KI-Sitzungen. **Von oben nach unten abarbeiten.**

**Vor jedem Punkt:** Eintrag in [ai-handover.md](ai-handover.md) anlegen (Regel in
[CLAUDE.md](../CLAUDE.md)). **Nach jedem Punkt:** Ergebnis nachtragen, committen,
pushen, Punkt nach unten unter „Erledigt" verschieben.

Jede Aufgabe steht für sich — Dateien, Begründung und Abnahmekriterien stehen
dabei, damit niemand den Gesprächsverlauf braucht.

---

## Warum diese Reihenfolge

**Stand 2026-08-07:** Die Sicherheitsprüfung ist durch und deployed, und die
Bestandsprüfung vor der Zahlung ist gebaut. Damit hat sich die Rangfolge
verschoben.

Drei Überlegungen bestimmen sie jetzt:

1. **Etwas läuft gerade an einer Grenze.** Der Sync schreibt rund 5 400
   D1-Zeilen je Lauf und lag damit selbst stündlich bei 102 % des
   Free-Budgets. Der Cron steht deshalb notgedrungen auf zweistündlich, was
   das Doppelverkaufsfenster wieder aufreißt. Solange das so ist, blockiert es
   jede Beschleunigung — und irgendwann auch die Schreibvorgänge echter
   Bestellungen. Deshalb steht es ganz oben.
2. **Der Shop konnte bis heute niemandem verkaufen.** Der Checkout verlangt ein
   Konto, ein Konto verlangt eine bestätigte E-Mail-Adresse — und die
   Bestätigungslinks zeigten auf `localhost` (SEC-18). Diese Tür ist seit
   heute offen. Was jetzt zählt, ist, dass der erste echte Kauf **vollständig**
   funktioniert. Dort klafft die nächste Lücke: Wer zahlt, bekommt keine
   Bestätigung.
3. **Was kann Geld kosten?** Alle 296 Karten sind Einzelstücke und stehen
   gleichzeitig hier und auf eBay. Ein Doppelverkauf bedeutet Rückerstattung,
   verärgerte Kunden und — bei eBay-Stornos — eine Verschlechterung des
   Verkäuferstatus. Die Richtung „auf eBay verkauft, Shop weiß es nicht" ist
   am Zahlungsmoment abgedeckt. Die andere Richtung — „im Shop verkauft, eBay
   weiß es nicht" — ist **offen** und wird mit jedem Verkauf wahrscheinlicher.
   Das ist Punkt 6, der große Brocken, und er muss vor jeder Werbung stehen.

Kurz: **erst die Grenze entschärfen, dann den Kaufweg zu Ende bauen, dann den
eBay-Schreibpfad, dann bewerben.**

---

## 1. Der Sync darf nur schreiben, was sich geändert hat

**Aufwand:** mittel · **Hängt an:** nichts · **Blockiert:** jeden schnelleren
Import-Takt

**Warum ganz oben:** Am 2026-08-07 mit `wrangler d1 insights` gemessen — ein
Sync-Lauf schreibt **~5 396 Zeilen**. Gegen das Free-Budget von 100 000
geschriebenen Zeilen pro Tag:

| Takt | Läufe/Tag | Zeilen/Tag | Anteil |
|---|---|---|---|
| alle 3 Min | 480 | 2 590 000 | 2590 % |
| alle 10 Min | 144 | 777 000 | 777 % |
| stündlich | 24 | 130 000 | **130 %** |
| alle 2 Std *(jetzt)* | 12 | 65 000 | 65 % |

**Auch stündlich war schon über dem Budget.** Der Cron steht deshalb vorerst
auf zweistündlich — ein Notbehelf, der das Doppelverkaufsfenster wieder
vergrößert.

**Nach der Korrektur ist das Budget kein Thema mehr.** Bleiben nur noch die
beiden `sync_runs`-Schreibvorgänge je Lauf (Anlegen und Abschließen, mit Index
~6 Zeilen), kostet ein Lauf ohne Änderungen fast nichts:

| Takt | Zeilen geschrieben/Tag | Anteil | Zeilen gelesen/Tag | Anteil |
|---|---|---|---|---|
| alle 3 Min | ~2 900 | **3 %** | ~960 000 | **19 %** |

Der begrenzende Faktor kippt dabei von den Schreib- auf die **Lesevorgänge** —
die bleiben, weil der Lauf zum Vergleichen weiter alles lesen muss (~2 000
Zeilen: 538 Listings zweimal, 539 Bestände, 302 Bilder). 19 % von 5 Mio. lassen
reichlich Raum für den Shop selbst.

**Warum ein Lauf so teuer ist:** D1 zählt Indexschreibvorgänge mit (ein
`update products` kostet 3 Zeilen, ein `update ebay_listings` 5). Vor allem
aber schreibt der Lauf **jedes Mal alles neu**, obwohl sich zwischen zwei
Läufen fast nie etwas ändert. Die vier teuersten Abfragen in 24 Stunden:

```
31 692  insert sync_events     ein Ereignis je Listing je Lauf, meist "UPDATED" ohne Änderung
26 085  update ebay_listings   identische Daten neu geschrieben
25 491  update products        identische Titel und Beschreibungen neu geschrieben
18 048  insert product_assets  alle Bilder jedes Mal gelöscht und neu eingefügt
```

**Wie:** In `lib/ebay-sync.ts` je Listing vergleichen, was in `mapped` steht,
mit dem, was schon in der Datenbank liegt — und den ganzen Batch überspringen,
wenn nichts abweicht. Dieselbe Bewegung wie bei SEC-09 in `lib/app-user.ts`.
Im Einzelnen:
- **`product_assets` nicht blind löschen und neu einfügen.** Sind die
  `sourceUrl`-Listen gleich, gar nichts anfassen. Das allein sind ~18 000 der
  gemessenen Zeilen.
- **`sync_events` nur bei echten Ereignissen** schreiben: `IMPORTED`,
  `DEACTIVATED`, `FAILED`. Ein `UPDATED` für ein unverändertes Listing hat
  keinen Aussagewert und kostet ~31 700 Zeilen. Nebenwirkung: Die Tabelle
  wächst heute um ~42 000 Zeilen pro Tag; sie hatte am 2026-08-07 bereits
  9 616 Zeilen.
- **`lastSyncedAt` nicht als Grund zum Schreiben nehmen.** Wenn nur dieses
  Feld sich ändert, ist der Schreibvorgang die einzige Änderung — und kostet
  mit Index mehr, als er wert ist. Entweder weglassen oder bewusst seltener
  aktualisieren.

**Achtung:** Der Vergleich muss `rawData` und `shippingData` einbeziehen oder
sie bewusst ausklammern — sonst schreibt ein wechselndes JSON-Feld weiter jedes
Mal alles neu, und die Ersparnis verpufft still.

**Fertig, wenn:** `wrangler d1 insights brandycards-production --timePeriod 1d
--sort-by writes` zeigt nach einem Tag deutlich weniger geschriebene Zeilen,
und `ZEILEN_JE_LAUF` in `tests/ebay-stock-check.test.mjs` kann auf den neuen
Messwert gesenkt werden. **Erst dann** darf der Cron wieder beschleunigt
werden — der Test dort erzwingt genau diese Reihenfolge.

---

## 2. Kunden-E-Mails

**Aufwand:** mittel · **Hängt an:** nichts · **Blockiert:** Punkt 7

**Warum jetzt ganz oben:** Wer im Shop zahlt, bekommt **keine
Bestellbestätigung**. Es gibt überhaupt keinen eigenen E-Mail-Versand — nur
Supabase verschickt seine Anmeldemails. Solange der Shop niemandem verkauft
hat, war das folgenlos. Seit dem 2026-08-07 kann sich zum ersten Mal überhaupt
ein Kunde registrieren (bis dahin zeigten die Bestätigungslinks auf
`localhost`, siehe SEC-18 in [security-findings.md](security-findings.md)) —
der erste echte Käufer zahlt also demnächst 40 € und hört nichts.

**Fehlt komplett:** Für eigene Nachrichten braucht es einen Anbieter; auf
Cloudflare Workers bieten sich Resend oder MailChannels an. Der API-Schlüssel
gehört als Cloudflare-Secret hinterlegt, **niemals** ins Repository. Die
Datenschutzerklärung nennt in Abschnitt 5 bereits Resend für die
Supabase-Anmeldemails — das ist der naheliegende Anbieter.

**Anlässe, nach Wichtigkeit:**
1. **Bestellbestätigung nach erfolgreicher Zahlung** — das ist die Lücke, die
   jetzt zuerst wehtut
2. Preisvorschlag angenommen — mit Betrag, Gültigkeit und Link zur Karte
3. Preisvorschlag abgelehnt
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

## 3. ~~Sicherheitskorrekturen deployen~~ — ERLEDIGT am 2026-08-07

Deployed als Version `1cfd52f1`, HSTS nachgezogen als `650c189a`. In Produktion
nachgeprüft: `/account` und `/admin` laden, alle Kopfzeilen gesetzt, CSP
durchsetzend, `cache-control` auf dem Katalog, beide Rate-Limit-Bindings
aufgelöst, 296 Karten ohne blockierte Ressource, eBay-Import um 09:00
erfolgreich. Einzelheiten in
[security-findings.md](security-findings.md) unter „Deploy am 2026-08-07".

_Ursprünglicher Eintrag, zur Nachvollziehbarkeit:_

<details><summary>Sicherheitskorrekturen deployen</summary>

**Aufwand:** klein · **Hängt an:** nichts · **Blockiert:** die Wirkung von allem
aus der Sicherheitsprüfung

**Warum:** Die Prüfung (früher Punkt 8) ist durch, 15 von 17 Befunden sind
behoben und gepusht — **aber nichts davon wirkt in Produktion.** Dort läuft der
Stand davor. Besonders das Rate-Limit: Es lebt vom Cloudflare-Binding, und das
entsteht erst beim Deploy. Bis dahin steht der Shop genau so da, wie ihn
[security-findings.md](security-findings.md) beschreibt.

**Wie:** Schrittfolge samt Nachprüfung steht in
[security-findings.md](security-findings.md) unter „E-6 — Deploy". Kurz:
aus dem **Hauptverzeichnis** (nicht aus einem Worktree), mit `.env.local`,
`npx tsc --noEmit` + `npm run lint` + `npm test`, dann `npx wrangler deploy`.

**Fertig, wenn:**
- `/account` und `/admin` laden (nicht „Supabase ist noch nicht konfiguriert")
- `curl -sI https://shop.brandycards.de/` zeigt die Sicherheits-Kopfzeilen
- `curl -sI https://shop.brandycards.de/api/products` zeigt `cache-control`
- Im Dashboard stehen die Bindings `RATE_LIMITER` und `RATE_LIMITER_STRICT`

**Nicht** gegen die Produktion nachtesten, ob das Limit greift — lokal ist es
belegt (10 Anfragen durch, dann `429` mit `retry-after: 60`).

</details>

---

## 3a. CSP ohne `'unsafe-inline'`: Nonces für die Inline-Skripte

**Aufwand:** mittel · **Hängt an:** nichts · **Nicht nebenbei erledigen**

**Warum:** Die CSP setzt seit dem 2026-08-07 durch — aber `script-src` trägt
`'unsafe-inline'`, weil vinext acht Inline-`<script>`-Blöcke je Seite
ausliefert (RSC-Parameter, Navigationszustand, Browser-Einstieg). Damit sind
auch **Inline-Eventhandler erlaubt**: Ein künftig eingeschleustes
`<img onerror=…>` würde laufen. Genau diese Form hatte SEC-01.

Was die Regel heute schon leistet, ist die zweite Hälfte: `script-src 'self'`
verbietet fremde Skripte, `connect-src` begrenzt jedes Ziel auf diese Herkunft
und Supabase. Ein gestohlenes Token kommt schwer heraus. Das ist echte
Tiefenverteidigung, aber eben nicht die ganze.

**Wie:** Je Antwort einen Zufallswert erzeugen, mit `HTMLRewriter` im Worker
jedem `<script>` ohne `src` ein `nonce="…"` anhängen und in der Regel
`'unsafe-inline'` durch `'nonce-…' 'strict-dynamic'` ersetzen.
[lib/security-headers.ts](../lib/security-headers.ts) und
[worker/index.ts](../worker/index.ts).

**Achtung, drei Fallen:**
- Der Zufallswert muss **je Antwort** neu sein, sonst ist er wertlos.
- `'strict-dynamic'` wird gebraucht, weil vinext weitere Skripte nachlädt.
- `HTMLRewriter` darf nur auf `text/html` laufen, nicht auf JSON oder Bilder.

**Fertig, wenn:** `script-src` trägt kein `'unsafe-inline'` mehr, und
Startseite, `/karten`, Kartendetail, `/checkout`, `/account` und `/admin` sind
ohne Konsolenfehler bedienbar — **lokal geprüft, bevor deployed wird.**

---

## 3b. ~~Bestand live prüfen, bevor Geld fließt~~ — ERLEDIGT am 2026-08-07

Geprüft wird jetzt an zwei Stellen: in `app/api/paypal/orders/route.ts` vor dem
Gang zu PayPal (damit der Kunde es früh erfährt) und in
`app/api/paypal/capture/route.ts` unmittelbar vor dem Einzug — dort bewusst
**vor** dem `PENDING → PROCESSING`-Riegel, damit eine abgelehnte Bestellung
nicht in `PROCESSING` hängenbleibt. Bei Ablehnung wird die Reservierung
freigegeben und die Karte beim Namen genannt.

Die Leitregel des ursprünglichen Punktes ist eingehalten und durch Tests
festgehalten: **Antwortet eBay nicht, wird der Kauf durchgelassen.** Unbekannt
gilt nie als ausverkauft — ein eBay-Ausfall darf den Shop nicht anhalten.

`lib/ebay-stock-check.ts` (Entscheidung, ohne Netz prüfbar),
`lib/ebay-stock-guard.ts` (Verdrahtung), `getEbayAvailability` in
`lib/ebay-client.ts` (ein Tokenaufruf je Bestellung, dann ein GetItem je Karte).
21 Tests in `tests/ebay-stock-check.test.mjs` und
`tests/ebay-availability.test.mjs`.

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

## 8. Reste aus der Sicherheitsprüfung

**Aufwand:** klein bis mittel · **Hängt an:** nichts

Die Prüfung selbst ist durch (siehe „Erledigt"). **16 von 17 Befunden sind
geschlossen** — SEC-15 (90 Tage Aufbewahrung) und SEC-16 (Datenschutztext)
wurden am 2026-08-07 nachgezogen, nachdem der Betreiber entschieden hatte.
Ein Befund bleibt offen:

**SEC-12 — eBay-OAuth-Rückseite zeigt den Refresh-Token ohne Anmeldung.**
`app/api/admin/ebay/oauth/callback/route.ts` ist die einzige Route unter
`/api/admin/**` ohne Rollenprüfung. Eine hinzuzufügen wäre **falsch**: eBay
leitet den *Browser* dorthin um, und eine Navigation trägt keinen
`Authorization`-Header — dort liegt in diesem Shop die Supabase-Sitzung. Die
Prüfung würde den eBay-Anschluss blockieren, ohne etwas zu sichern. Die
Begründung steht als Kommentar an der Route.

*Richtiger Weg:* Den Token nicht in die Antwort auf die Umleitung schreiben.
Austausch hinter einer kurzlebigen Anspruchs-Kennung parken, die der angemeldete
Adminbereich mit seinem Bearer-Token einlöst. Braucht eine Tabelle, also eine
Migration — **beim nächsten ohnehin nötigen Schemaschritt erledigen** und dabei
`drizzle/meta/_journal.json` nachziehen (endet bei `0002`).

**Aus SEC-15 bleibt ein Rest:** Es gibt keinen Selbstbedienungsweg für Auskunft
oder Löschung des **Kontos**. Die Löschfrist für Kartenangebote steht (90 Tage,
automatisch im geplanten Lauf), aber ein Kunde kann seine eigenen Daten weder
einsehen noch löschen lassen — er muss eine E-Mail schreiben. Das ist zulässig
und trägt, solange es genau einen Nutzer gibt. **Vor dem Verkaufsstart sollte
es stehen.**

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

### ~~Sync alle 10 Minuten statt stündlich~~ — 2026-08-07, ZURÜCKGENOMMEN

Deployed als `0b25ae0f` (10:45 UTC), **am selben Tag um 12:0x zurückgenommen**
auf `0 */2 * * *` (Version `2557ca3d`).

**Warum zurückgenommen — ein Fehler beim Prüfen, nicht beim Bauen.** Vor dem
Deploy hatte ich zwei Grenzen nachgerechnet und daraus „unkritisch" geschlossen:
das eBay-Kontingent (drei Aufrufe je Lauf, 432 statt 72 am Tag gegen 5 000) und
die Laufzeit (77 Sekunden gegen 600 Sekunden Abstand). Beide Zahlen stimmen.

**Die dritte Grenze habe ich nicht angesehen: das D1-Schreibbudget.** Gemessen
mit `wrangler d1 insights` schreibt ein Lauf ~5 396 Zeilen. Der 10-Minuten-Takt
läge damit bei 613 % des Free-Budgets von 100 000 Zeilen pro Tag — und selbst
der stündliche Stand davor bei 102 %.

Besonders ärgerlich, weil der Free-Tarif am selben Tag schon einmal Thema war:
Er war der Grund, SEC-05 von *mittel* auf *hoch* hochzustufen. Die Lehre ist
nicht „mehr rechnen", sondern: **Wenn eine Änderung die Frequenz einer Schleife
erhöht, sind alle Ressourcen dieser Schleife zu prüfen, nicht die
naheliegendste.**

Was aus dem Eintrag richtig bleibt: Ein Lauf dauert **rund 77 Sekunden**, nicht
die ursprünglich behaupteten 30. Und `releaseExpiredReservations` hängt am
selben Cron — bei zweistündlichem Takt kommt eine abgelaufene Reservierung
jetzt nach 15–135 Minuten zurück statt nach 15–75. Die Obergrenze aus SEC-03
begrenzt den Schaden weiterhin.

**Der Weg zurück zu schnellen Takten steht als Punkt 1 oben** — er führt über
einen billigeren Lauf, nicht über einen anderen Cron-Ausdruck.

### Vollständige Sicherheitsprüfung — 2026-08-07

Auftrag: [security-audit-brief.md](security-audit-brief.md).
Bericht: [security-findings.md](security-findings.md).
Commits: `4fbde38` (Bericht), `eff5c35` (Korrekturen), `7b73c4f` (Nachprüfung).

17 Befunde, drei davon hoch: der Beschreibungs-Parser hob die Arbeit des
HTML-Sanitizers wieder auf und lieferte `&lt;img onerror=…&gt;` als lebendes
Markup aus; das Rate-Limit war mangels Binding still wirkungslos; ein einzelnes
Konto konnte den gesamten Bestand hinter unbezahlten Bestellungen blockieren.
15 behoben, je mit einem Test, der den Angriff nachstellt.

Ausdrücklich als tragfähig bestätigt: keine SQL-Injection, kein IDOR, PayPal-
Webhook wirklich verifiziert und idempotent, Preisintegrität durchgängig
serverseitig, Supabase erzwingt E-Mail-Bestätigung, der selbstgeschriebene
Sanitizer hielt 49 Angriffen stand.

**Nachgezogen am 2026-08-07**, nachdem der Betreiber entschieden hatte:
SEC-15 (90 Tage Aufbewahrung für abgeschlossene Kartenangebote, automatisch im
geplanten Lauf) und SEC-16 (Datenschutzerklärung um die eBay-Bildserver und die
Löschfrist ergänzt). Damit **16 von 17 Befunden geschlossen**. Der bestätigte
Cloudflare-**Free**-Tarif hat SEC-05 von *mittel* auf *hoch* gehoben: Rund
2 900 Aufrufe von `/api/products` brauchen das D1-Tageskontingent auf, danach
steht der ganze Shop bis zum nächsten Tag.

**Der Deploy fehlt noch — er steht als Punkt 2 oben.** Ohne ihn wirkt keine der
Korrekturen, auch die Löschfrist nicht. Ein Befund bleibt offen, siehe Punkt 8.

**Nebenbei repariert:** `npm run dev` startete gar nicht — `nodejs_compat` war
in `vite.config.ts` und `wrangler.toml` doppelt deklariert, und das gebündelte
`workerd` war zu alt für das `compatibility_date`. Beides war vorbestehend.
