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

## 2. Sicherheitskorrekturen deployen

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

---

## 2a. CSP scharf schalten

**Aufwand:** klein · **Hängt an:** Punkt 2 · **Nicht vor:** ein paar Tagen
Beobachtung

**Warum:** Die Content-Security-Policy läuft bewusst als
`Content-Security-Policy-Report-Only` — sie meldet Verstöße und verhindert
nichts. Erst durchsetzend schützt sie gegen die nächste Lücke der Art SEC-01,
und weil das Supabase-Token im `localStorage` liegt, ist ein XSS hier direkt
eine Kontoübernahme.

**Wie:** Nach dem Deploy einige Tage die Browser-Konsole auf
`Content-Security-Policy-Report-Only`-Meldungen ansehen. Sind sie ruhig, in
[lib/security-headers.ts](../lib/security-headers.ts) `CSP_HEADER_NAME` auf
`content-security-policy` umstellen und erneut deployen.

**Achtung:** Eine zu enge Regel legt den Shop lahm. Auffällige Meldungen erst
verstehen, dann die Regel erweitern — nicht `'unsafe-*'` nachschieben, bis es
still ist.

**Fertig, wenn:** Der Header heißt `content-security-policy`, und Startseite,
`/karten`, eine Kartendetailseite, `/checkout`, `/account` und `/admin` sind
ohne Konsolenfehler bedienbar.

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

## 8. Reste aus der Sicherheitsprüfung

**Aufwand:** klein bis mittel · **Hängt an:** nichts

Die Prüfung selbst ist durch (siehe „Erledigt"). Zwei Befunde blieben bewusst
offen, weil sie keine reine Codeänderung sind:

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

**SEC-15 — Aufbewahrung und Löschung.** Kartenangebote und ihre Bilder werden
nie automatisch gelöscht; `cleanupOrphanedCardSubmissionAssets` räumt nur
verwaiste R2-Objekte auf. Es gibt keinen Selbstbedienungsweg für Auskunft oder
Löschung, obwohl die Datenschutzerklärung beides zusagt (per E-Mail, das ist
zulässig). **Das ist zuerst eine Festlegung, keine Programmierarbeit:** Wie
lange bleiben abgelehnte Kartenangebote liegen? Danach ist die Erweiterung des
vorhandenen Aufräumlaufs überschaubar.

**Ebenfalls offen, kein Sicherheitsbefund:** Ein Satz zu den direkt von eBays
CDN geladenen Bildern gehört in Abschnitt 6 oder 11 der Datenschutzerklärung
(SEC-16). Die technische Hälfte — `Referrer-Policy` — ist gesetzt.

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

### Vollständige Sicherheitsprüfung — 2026-08-07

Auftrag: [security-audit-brief.md](security-audit-brief.md).
Bericht: [security-findings.md](security-findings.md).
Commits: `4fbde38` (Bericht), `eff5c35` (Korrekturen), `<Phase 3>` (Nachprüfung).

17 Befunde, drei davon hoch: der Beschreibungs-Parser hob die Arbeit des
HTML-Sanitizers wieder auf und lieferte `&lt;img onerror=…&gt;` als lebendes
Markup aus; das Rate-Limit war mangels Binding still wirkungslos; ein einzelnes
Konto konnte den gesamten Bestand hinter unbezahlten Bestellungen blockieren.
15 behoben, je mit einem Test, der den Angriff nachstellt.

Ausdrücklich als tragfähig bestätigt: keine SQL-Injection, kein IDOR, PayPal-
Webhook wirklich verifiziert und idempotent, Preisintegrität durchgängig
serverseitig, Supabase erzwingt E-Mail-Bestätigung, der selbstgeschriebene
Sanitizer hielt 49 Angriffen stand.

**Der Deploy fehlt noch — er steht als Punkt 2 oben.** Ohne ihn wirkt keine der
Korrekturen. Zwei Befunde bleiben offen, siehe Punkt 8.

**Nebenbei repariert:** `npm run dev` startete gar nicht — `nodejs_compat` war
in `vite.config.ts` und `wrangler.toml` doppelt deklariert, und das gebündelte
`workerd` war zu alt für das `compatibility_date`. Beides war vorbestehend.
