# Prüfbericht BrandyCards-Webshop — 2026-08-09

**Art:** Vollständige Prüfung von Sicherheit **und** Funktion. Whitebox-Codeprüfung,
lokale Prüfkette, lesende Live-Stichproben gegen D1 und HTTP-Abrufe gegen die
Produktion.

**Geprüfter Stand:** Branch `claude/brandycards-webshop-audit-f0d47b` @ `17ef207`
(dateigleich mit `agent/initial-brandycards`).
**Produktion:** Version `11c2dd57`, deployed 2026-08-09 06:40 UTC.

**Produktion läuft auf dem aktuellen Code.** Der letzte Codecommit ist `9b45c67`
(„Raeum den toten Auktionscode ab"), genau der Stand von `11c2dd57`; `0d9c5f1`
und `17ef207` darüber ändern ausschließlich Dokumentation.

**Nichts wurde verändert.** Kein Deploy, kein schreibender D1-Befehl, kein
abgesendetes Formular, kein angefasstes eBay-Angebot. Die Wächter der
öffentlichen Formulare sind ausdrücklich an Antworten nachgewiesen worden, die
**vor** dem Datenbankschreibvorgang greifen.

---

## Wie dieser Bericht zu lesen ist

Jeder Befund trägt eine Kennung (`S-…` Sicherheit, `F-…` Funktion, `OK-…`
bestätigt gesund), einen Schweregrad, den Beleg und einen Status:

- **BELEGT** — an Code, Befehlsausgabe, Datenbank oder HTTP-Antwort nachgewiesen;
  der Beleg steht dabei
- **VERMUTUNG** — begründet, aber nicht ausgelöst oder nicht gemessen; als
  solche kenntlich gemacht

Wo beides zutrifft (Codeform belegt, Wirkung nicht gemessen), steht es getrennt
dabei. Die Empfehlungen sind **benannt, nicht umgesetzt** — dies war ein reiner
Prüfauftrag.

### Die sieben Schein-Fehler aus dem Auftrag

Alle sieben wurden geprüft und **keiner** als Befund aufgenommen:

1. `kind = 'PRELISTED'` **und** `origin = 'MANUAL'` ist die tragende Regel für
   manuelle Karten. Sie bleibt unangetastet — S-06 unten weist ausdrücklich
   darauf hin, dass die dortige Korrektur **nicht** über `kind` laufen darf.
2. Keine Tabellenneubauten vorgeschlagen.
3. `drizzle/meta/_journal.json` bleibt bei `0002`; `npm run db:generate` wurde
   nicht ausgeführt.
4. `app/api/admin/ebay/oauth/callback/route.ts` bleibt ohne `requireAdmin` —
   siehe OK-02.
5. Die 249 inaktiven Produkte sind gewollte Historie; Maßstab sind die 294
   aktiven eBay-Angebote, und die stimmen (OK-12).
6. `.env.local` lag im Worktree, der Build ist vollständig (OK-04).
7. `npx tsc --noEmit` wurde separat ausgeführt (OK-10).

---

## Befunde, absteigend nach Schwere

### S-01 · mittel · Ein Fehler im geplanten Lauf kann die fünf anderen Aufgaben abwürgen

**Was ist der Fall:** `worker/index.ts` reicht `Promise.all([...])` an
`waitUntil` — lehnt eine der sechs Zusagen ab, ist die Gesamtzusage sofort
erledigt, während die übrigen noch laufen.

**Beleg:** [worker/index.ts:85-104](../worker/index.ts). Dass `runEbaySync`
wirft, ist belegt: D1 zählt 24 `FAILED`-Läufe am 2026-08-06/07, darunter
„eBay OAuth fehlgeschlagen (400)", „D1_ERROR: too many SQL variables" und
„eBay-Synchronisierung hat die Zeitgrenze überschritten".

**Auswirkung:** Reißt der Import, können `processEbayOutbox` (die eBay-Rücknahme
verkaufter Karten), `releaseExpiredReservations`, `expireLapsedOffers`, die
90-Tage-Löschung und das Abräumen abgelaufener OAuth-Ansprüche mitten im Lauf
abgeschnitten werden. Betroffen ist der Betreiber (Doppelverkauf bei eBay,
gesperrter Bestand) und der Kunde (Karte bleibt reserviert).

**Status:** **BELEGT** für die Codeform und dafür, dass `runEbaySync` wirft.
**VERMUTUNG** für die Abbruchwirkung — sie folgt aus dokumentiertem
`waitUntil`-Verhalten, ich habe sie nicht gemessen.

**Empfehlung:** `Promise.allSettled` statt `Promise.all`, jede Ablehnung einzeln
protokollieren.

---

### S-02 · mittel · Ein abgebrochener Webhook wird nie wiederholt, weil `RECEIVED` als erledigt gilt

**Was ist der Fall:** Die Eingangsprüfung behandelt `RECEIVED` genauso wie
`PROCESSED` und antwortet mit `duplicate: true`.

**Beleg:** [app/api/paypal/webhook/route.ts:69](../app/api/paypal/webhook/route.ts).
In Produktion steht `WH-4MD290111R3948627-8AM47435BU5710537`
(`PAYMENT.CAPTURE.COMPLETED`) seit `2026-08-08T06:10:22.766Z` auf `RECEIVED`,
`processed_at` ist `NULL`, keine Fehlermeldung.

**Auswirkung:** Stirbt eine Zustellung *nach* dem Einfügen der Zeile, aber vor
der Verarbeitung (CPU-Grenze, Isolate-Abbruch — eine geworfene Ausnahme setzt
korrekt `FAILED` und wird sauber wiederholt), wird PayPals Wiederholung stumm
mit 200 abgewiesen. Die Bestellung bliebe auf `PENDING`, der Bestand reserviert,
ohne Bestätigungsmail und ohne eBay-Rücknahme — bei bereits eingezogenem Geld.

**Einordnung:** Die *konkrete* Zeile ist ein Überbleibsel des vor `e204d3d7`
behobenen Fehlers und folgenlos — die zugehörige Bestellung steht auf `PAID`,
die Zahlung auf `CAPTURED`. Sie belegt aber, dass `RECEIVED`-Zeilen entstehen
und dauerhaft liegenbleiben, und sie führt jede spätere Suche nach hängenden
Webhooks in die Irre.

**Status:** **BELEGT** (Code und Datenbankzeile); die Abbruchvariante ist
**VERMUTUNG**.

**Empfehlung:** Nur `PROCESSED` als Dublette werten und `RECEIVED`-Zeilen ab
einem Alter von wenigen Minuten erneut verarbeiten.

---

### F-01 · mittel · Die Startseiten-Galerie kennt weder den Bestand noch manuelle Karten

**Was ist der Fall:** `/api/products/highlights` verknüpft `ebay_listings` per
`innerJoin` und liest die Menge aus dem **Listing** statt aus `inventory` — genau
der Fehler, für den `lib/catalog-availability.ts` gebaut wurde, an dieser einen
Route unverändert.

**Beleg:**
[app/api/products/highlights/route.ts:32-45](../app/api/products/highlights/route.ts)
(`select()` mit `innerJoin`, `quantity: ebayListings.quantity`) und Zeile 63
(`live` prüft nur Produkt- und Listingstatus, nie den Bestand).

**Auswirkung, drei Teile:**

1. Von Hand eingestellte Karten erscheinen **nie** in der Galerie. Das ist in
   ai-todo Punkt A als bewusst offen vermerkt.
2. Eine im Shop verkaufte Karte bleibt in der Galerie stehen, bis das
   eBay-Listing endet. Ein Klick darauf liefert 404 („Diese Karte ist nicht
   verfügbar"), weil Katalog und Detailseite den Bestand sehr wohl prüfen. Das
   Fenster ist klein — die Outbox nimmt sofort zurück, der Sync läuft alle drei
   Minuten —, aber es ist die sichtbarste Fläche des Shops.
3. Der Typ trägt weiterhin `category: "Auktion"`, und Auktionen werden hier
   **nicht** gefiltert, während Katalog und Detailseite sie ablehnen. Heute
   latent: D1 zählt 0 Auktionen.

**Status:** **BELEGT** (Code). Die Sichtbarkeitsdauer ist nicht gemessen.

**Empfehlung:** Dieselbe Entscheidung wie im Katalog verwenden
(`istImKatalogSichtbar` / `verfuegbareMenge`) und `inventory` per `leftJoin`
mitnehmen.

---

### F-02 · mittel · Der gesamte Vorverkaufszweig ist in Produktion unerprobt

**Was ist der Fall:** Es gibt keine einzige von Hand eingestellte Karte.

**Beleg:** D1 — `SELECT COUNT(*) FROM products WHERE origin='MANUAL'` → **0**;
`/api/products` liefert 294 Karten, **alle** mit `category: "Festpreis"`;
`/vorverkauf` antwortet mit 200 und bleibt leer („Lade …", danach nichts).

**Auswirkung:** Anlegen, Katalog, Detailseite, Verhandeln, Bestellung,
Bestandsführung und die Zusammenführung mit einem später auftauchenden
eBay-Angebot sind ausschließlich durch Tests gedeckt. Das Abnahmekriterium von
ai-todo Punkt 11 („eine von Hand angelegte Karte erscheint im Katalog, überlebt
mehrere Sync-Läufe, lässt sich kaufen") ist offen. Die drei Fehler, die der
Durchstich am 2026-08-09 fand — Checkout, Preisvorschlag-Route und Detailseite
hingen alle noch am eBay-Listing —, sind der Beleg dafür, dass Tests an dieser
Stelle nicht reichen.

**Status:** **BELEGT**.

**Empfehlung:** Eine Wegwerfkarte über `/admin` anlegen und bis zur
Bestellbestätigung durchkaufen, nach dem Muster des 1-Cent-Testartikels für
PayPal.

---

### S-03 · niedrig · Mengenänderung im Adminbereich ignoriert laufende Reservierungen

**Was ist der Fall:** `PATCH /api/admin/products` schreibt `availableQuantity`
absolut und setzt den Status hart, ohne `reservedQuantity` zu berücksichtigen.

**Beleg:** [app/api/admin/products/route.ts:200-204](../app/api/admin/products/route.ts).

**Auswirkung:** Hält ein Kunde gerade eine manuelle Karte in einer offenen
Bestellung (`available = 0`, `reserved = 1`) und der Betreiber setzt die Menge
auf 1, existiert dasselbe Einzelstück zweimal — beide Bestellungen gehen durch.
Nur über den Adminbereich auslösbar, deshalb niedrig.

**Status:** **BELEGT** (Code); heute nicht auslösbar, weil es keine manuellen
Karten gibt (siehe F-02).

**Empfehlung:** Relativ rechnen wie in `app/api/orders/route.ts`, oder die
Änderung bei aktiver Reservierung ablehnen.

---

### S-04 · niedrig · Sechs angemeldete Routen ohne Mengenbegrenzung

**Was ist der Fall:** `/api/price-offers` (POST), `/api/account/data`,
`/api/account/delete`, `/api/account/profile`, `/api/paypal/orders` und
`/api/paypal/capture` rufen `enforcePublicRateLimit` nicht auf.

**Beleg:** Volltextsuche über `app/` — die sieben Aufrufer sind
`account/offers`, `validate-registration`, `card-submissions`, `inquiries`,
`orders`, `prelisted-interest`, `products/[id]`.

**Auswirkung:** Jede angemeldete Anfrage kostet einen Supabase-Aufruf
(`/auth/v1/user`) plus D1-Lesevorgänge; `/api/price-offers` schreibt zusätzlich
eine Zeile — bis zu 3 × 294 = 882 Zeilen je Konto. Kein Datenabfluss, eine
Rechnung. Bei `/api/account/data` ist die Auslassung im Code ausdrücklich
begründet („wer seine eigenen Daten zehnmal herunterlädt, schadet niemandem")
und trägt.

**Status:** **BELEGT**.

**Empfehlung:** Die schreibende Route (`price-offers`) an den Standardtarif
hängen; bei den übrigen die Entscheidung wie bei `account/data` danebenschreiben.

---

### S-05 · Hinweis (DSGVO) · Zahlungsrohdaten sind weder in der Auskunft noch in der Löschung

**Was ist der Fall:** `payments.raw_data` und `webhook_events.payload` enthalten
die vollständige PayPal-Antwort samt Zahlerdaten. Die Auskunft liest `raw_data`
bewusst nicht und `webhook_events` gar nicht; die Löschung fasst beides nicht an.
`webhook_events` hat keine `user_id` — der Test in `tests/account-data.test.mjs`,
der die Tabellenliste gegen das Schema hält, kann die Lücke deshalb nicht sehen.

**Beleg:** [lib/account-data.ts:69-82](../lib/account-data.ts) (Spalten einzeln
gewählt, `raw_data` ausgelassen) und :135-165 (Löschung ohne `webhook_events`).
D1, nur auf Feldnamen geprüft, ohne Werte auszulesen:

```
payments.raw_data       : 3 von 3 Zeilen mit email_address, 2 mit given_name/full_name
webhook_events.payload  : 6 von 6 Zeilen mit email_address, 3 mit given_name/full_name
```

**Auswirkung:** Art. 15 verlangt Auskunft über *alle* verarbeiteten
personenbezogenen Daten; nach einer Kontolöschung bleibt die PayPal-Adresse des
Kunden in `webhook_events` ohne Frist stehen. Für die Bestellung selbst greift
Art. 17 Abs. 3 lit. b — für die Webhook-Rohdaten ist das nicht dieselbe
Begründung.

**Status:** **BELEGT** (Datenbestand). Die rechtliche Bewertung ist
ausdrücklich **keine Rechtsberatung**.

**Empfehlung:** Entscheiden — entweder `webhook_events` in Auskunft und Löschung
aufnehmen, oder eine Aufbewahrungsfrist darauf setzen und die Begründung in der
Datenschutzerklärung nennen.

---

### S-06 · Hinweis · Die `prelistedOnly`-Prüfung meint nicht mehr, was sie sagt

**Was ist der Fall:** `existingProduct(productId, true)` lehnt ab, wenn
`product.kind !== 'PRELISTED'` — manuelle Karten tragen aber genau dieses `kind`.

**Beleg:** [lib/public-form.ts:142](../lib/public-form.ts),
[app/api/prelisted-interest/route.ts:23](../app/api/prelisted-interest/route.ts),
[db/schema.ts:24-37](../db/schema.ts).

**Auswirkung:** `POST /api/prelisted-interest` akzeptiert ein „Vormerken" auf
eine Karte, die sofort kaufbar ist. Folgenlos, solange die Oberfläche den Knopf
dort nicht zeigt (Kategorie „Direkt bei uns") und es keine manuellen Karten gibt.

**Status:** **BELEGT** (Code); nicht ausgelöst, weil das eine Zeile in
`inquiries` geschrieben hätte.

**Empfehlung:** Die Prüfung auf `origin === 'EBAY' && kind === 'PRELISTED'`
ziehen. **`kind` bleibt unangetastet** — die CHECK-Bedingung darauf ist auf D1
unveränderlich, Begründung im Kopf von
`drizzle/0006_manual_cards_and_oauth_claims.sql`.

---

### S-07 · niedrig · Vier hohe Abhängigkeitsmeldungen im Produktionsbaum, alle Bauwerkzeug

**Was ist der Fall:** `npm audit --omit=dev` meldet 4 hohe Befunde: dreimal
`postcss` (Pfad-Traversal und Offenlegung über `sourceMappingURL`) und einmal
`sharp` (libvips-CVEs). Insgesamt 19 Meldungen (1 niedrig, 7 mittel, 11 hoch).

**Beleg:** `npm audit`-Ausgabe. Kein direktes `next`-Advisory mehr — installiert
ist 16.2.11, die Meldung lautet „Depends on vulnerable versions of postcss/sharp".

**Auswirkung:** Erreichen den Worker nicht — zur Laufzeit wird kein CSS
verarbeitet, und Bilder laufen über die Cloudflare-Images-Bindung, nicht über
`sharp`. Die CI stuft bewusst erst bei `critical` rot
([.github/workflows/ci.yml](../.github/workflows/ci.yml)) und druckt den vollen
Bericht trotzdem — die Begründung steht als Kommentar dabei und trägt.

**Status:** **BELEGT** (Meldungen); die Nichterreichbarkeit ist aus dem Code
abgeleitet, nicht durch Ausnutzungsversuche widerlegt.

**Empfehlung:** So lassen, beim nächsten Next-Minor mitziehen.

---

### F-03 · niedrig · Der eBay-Schreibpfad ist am *laufenden* Angebot weiterhin unbewiesen

**Beleg:** D1 `ebay_outbox` — genau zwei Zeilen, beide `SUCCEEDED` beim ersten
Versuch, beide auf dieselbe, bei eBay bereits beendete ItemID `398200679813`
(2026-08-08 10:28 und 10:33). Kein Auftrag aus einem echten Verkauf.

**Auswirkung:** Dass die Menge eines *aktiven* Angebots wirklich auf 0 fällt, hat
niemand gesehen. Deckt sich mit dem offenen Rest von ai-todo Punkt 6.

**Status:** **BELEGT**.

**Empfehlung:** Nach dem nächsten echten Verkauf `ebay_outbox` ansehen
(`SUCCEEDED`, kein `FAILED`) und im Worker-Protokoll die Zeile
`[ebay-outbox] Auftrag erledigt.` mit ihrem `ergebnis`.

---

### F-04 · niedrig · Die eigentliche Ursache von SEC-04 steht unverändert

**Was ist der Fall:** 13 von 294 Listings haben eine zwischengespeicherte
Beschreibung; die übrigen 281 lösen beim ersten Öffnen zwei eBay-Aufrufe aus,
und ein *leeres* Ergebnis wird nie gemerkt.

**Beleg:** D1 (`description_html` gefüllt: **13**);
[app/api/products/[id]/route.ts:79-92](../app/api/products/%5Bid%5D/route.ts) —
`if (fetched)` ohne Negativ-Merker.

**Auswirkung:** Zwischen einem Angreifer und dem eBay-Tageskontingent steht
allein das Rate-Limit auf dem Bereich `ebay-description`. Die Entlastung wirkt,
die Ursache bleibt; E-4 (`description_fetched_at`) ist auf den nächsten
Schemaschritt vertagt.

**Status:** **BELEGT**.

**Empfehlung:** `description_fetched_at` beim nächsten ohnehin nötigen
Schemaschritt nachziehen.

---

### F-05 · niedrig · Eine Erstattung gibt weder Bestand noch eBay-Angebot zurück

**Beleg:** [app/api/paypal/webhook/route.ts:120-124](../app/api/paypal/webhook/route.ts)
— `PAYMENT.CAPTURE.REFUNDED` setzt Zahlung und Bestellung auf `REFUNDED`, mehr
nicht.

**Auswirkung:** Nach einer Rückerstattung bleibt die Karte auf `SOLD` und ist im
Shop wie bei eBay verschwunden; sie wieder verkäuflich zu machen geht nur von
Hand über die Datenbank.

**Status:** **BELEGT**.

**Empfehlung:** Bewusst entscheiden — entweder so lassen und im Adminbereich
benennen, oder eine Rücknahme bauen.

---

### F-06 · niedrig · Das Übergabeprotokoll widerspricht sich selbst und der Produktion

**Was ist der Fall:** Der Abschnitt „Offene Punkte" in
[docs/ai-handover.md](ai-handover.md) enthält Aussagen, die weiter oben in
derselben Datei widerlegt werden und die die Produktion widerlegt.

**Beleg, jeweils gemessen:**

| Behauptung unter „Offene Punkte" | Tatsächlich |
|---|---|
| 🔴 „Der Shop kann kein echtes Geld einnehmen: PayPal läuft in der Sandbox" | `PAYPAL_ENVIRONMENT = "production"` in [wrangler.toml:30](../wrangler.toml); drei Bestellungen auf `PAID`/`CAPTURED` |
| „Der Import läuft alle zwei Stunden" | `crons = ["*/3 * * * *"]` in [wrangler.toml:72](../wrangler.toml); Läufe im Drei-Minuten-Takt belegt |
| „Die CSP trägt `'unsafe-inline'` für Skripte" | Antwort von `/` trägt `script-src 'self' 'nonce-…'` |
| „zuletzt deployed ist `fc35c017`" | `wrangler deployments list` → `11c2dd57`, heute 06:40 UTC |
| Webhook-Dublettenpfad als offen beschrieben | Seit `e204d3d7` behoben (der Merker statt des `return`) |

**Auswirkung:** Dies ist die Datei, die CLAUDE.md zur Pflichtlektüre macht. Der
rote Punkt ist die auffälligste Zeile darin und ist falsch — die nächste Sitzung
fängt an der falschen Stelle an. Es ist dieselbe Lehre, die das Projekt an
ai-todo Punkt 3 schon einmal gezogen hat: „Beim Abhaken gehört der Kopf der
Aufgabe mitgezogen, nicht nur der Rumpf."

**Status:** **BELEGT**.

**Empfehlung:** „Offene Punkte" gegen den heutigen Zustand durchgehen und
Erledigtes in die Historie schieben.

---

### F-07 · niedrig · Der Kommentar über dem Cron widerlegt den Cron

**Beleg:** [wrangler.toml:44-72](../wrangler.toml) — drei Zeilen über
`crons = ["*/3 * * * *"]` steht ein 28-zeiliger Block, der zweistündlich
begründet und mit dem Free-Budget rechnet, das es seit dem 2026-08-07 nicht mehr
gibt („VORÜBERGEHEND zurück auf stündlich", „alle 2 Std *(jetzt)*").

**Auswirkung:** Wer den Takt anfassen will, liest die Begründung für den Zustand
von vorgestern.

**Status:** **BELEGT**.

**Empfehlung:** Auf die zwei tragenden Sätze kürzen: die eBay-Kontingentgrenze
und den Verweis auf `tests/ebay-stock-check.test.mjs`.

---

### F-08 · niedrig · Zwei überholte Angaben in CLAUDE.md

**Beleg:** [CLAUDE.md:66-70](../CLAUDE.md).

- „CI prüft keine Typen" — [.github/workflows/ci.yml](../.github/workflows/ci.yml)
  hat seit SEC-14 einen Schritt `Type check` mit `npx tsc --noEmit` und
  auditiert zusätzlich.
- „`0003`–`0005` handgeschrieben" — es sind inzwischen `0003`–`0006`.

**Auswirkung:** Der Rat („`tsc` separat laufen lassen") bleibt richtig, die
Begründung nicht — und ein Rat mit falschem Grund wird irgendwann fallen
gelassen.

**Status:** **BELEGT**.

**Empfehlung:** Auf „`npm test` prüft keine Typen" umschreiben und die
Migrationsspanne nachziehen.

---

### S-08 · niedrig · `/api/orders/release` liest den Körper ohne `try`

**Beleg:** [app/api/orders/release/route.ts:11](../app/api/orders/release/route.ts).

**Auswirkung:** Nur mit gültiger Sitzung erreichbar — die Authentifizierung
steht davor, live nachgemessen: `POST` ohne Token → **401**. Was vinext bei einer
durchschlagenden Ausnahme ausliefert (allgemeiner 500er oder Stacktrace), ist
weiterhin ungemessen. Das ist Unsicherheit 6 der Prüfung vom 2026-08-07,
unverändert offen.

**Status:** **VERMUTUNG** für die Antwortform, **BELEGT** für die fehlende
Absicherung.

**Empfehlung:** `try`/`catch` mit 400, wie in
`app/api/paypal/capture/route.ts:31`.

---

## Geprüft und tragfähig

| # | Was | Beleg |
|---|---|---|
| **OK-01** | Rollenprüfung auf **allen** `/api/admin/**`-Routen, im Code und live | 12 Routen (GET/POST/PATCH/DELETE) ohne Token → durchgehend **401**; `tests/hardening.test.mjs:347` durchsucht `app/api/admin/` rekursiv und erzwingt es für jede neue Route, mit der OAuth-Rückseite als einzig zugelassener Ausnahme |
| **OK-02** | SEC-12 ist wirklich geschlossen | [callback/route.ts:60-85](../app/api/admin/ebay/oauth/callback/route.ts) parkt den Token in `ebay_oauth_claims` und leitet mit 303 in den Adminbereich um; `/claim` ist adminpflichtiges `POST`, löscht die Zeile beim Abholen und räumt abgelaufene vorher weg; der geplante Lauf räumt zusätzlich ab. D1: **0** Zeilen. Die Kennung allein gibt nichts heraus |
| **OK-03** | Sicherheitskopfzeilen und CSP in Produktion | `curl -I https://shop.brandycards.de/`: `strict-transport-security: max-age=31536000` (ohne `includeSubDomains`, ohne `preload`), `x-content-type-options`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy`, `x-frame-options: DENY`, CSP **durchsetzend** mit `script-src 'self' 'nonce-…'`; auf JSON-Antworten `script-src 'self'` — **kein `'unsafe-inline'` in irgendeiner Antwort**. `connect-src` ohne Platzhalter, nur `'self'` und die Supabase-Domäne |
| **OK-04** | Keine Geheimnisse im Repository oder im Client-Bundle | Jeder Wert aus `.env.local` maschinell gegen alle 41 Dateien in `dist/client` geprüft: nur `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sind enthalten, und das müssen sie sein. `ADMIN_EMAILS`, `EBAY_CLIENT_SECRET`, `EBAY_REFRESH_TOKEN` u. a.: **nicht im Bundle**. Keine Sourcemaps. `git grep` über Schlüsselmuster: nur Variablennamen in Doku und Code. `.env.local` ist ignoriert (`.gitignore:32`) |
| **OK-05** | SEC-01 hält der Nutzlast von damals stand | Gegen die echten Module ausgeführt: `<h2>Zustand</h2><div>Karte ist top &lt;img src=x onerror=…&gt; Ende</div>` ergibt `section.html = "<p>Karte ist top &lt;img src=x onerror=…&gt; Ende</p>"` — escaped, Text erhalten |
| **OK-06** | Bot- und Herkunftsschutz sind in Produktion scharf | Ohne eine einzige Zeile zu schreiben nachgewiesen: falscher `content-type` → **415**, gefüllter Honeypot → **400**, fremder `Origin` → **403** |
| **OK-07** | PayPal: Signatur, Idempotenz, Betragsprüfung | Roher Körper vor jeder Verarbeitung gelesen, `if (!verified) return 400`, ohne `PAYPAL_WEBHOOK_ID` 503 statt Durchlass, Idempotenz über `uniqueIndex(provider, externalEventId)`, bedingte Statusübergänge mit `changes !== 1` als Wächter, Betrag **und** Währung gegen Bestellung *und* gespeicherte Zahlung, erstattete Zahlung nicht erneut als bezahlt markierbar. In Produktion: 3 Bestellungen `PAID`, 3 Zahlungen `CAPTURED` mit Capture-Id, alle Reservierungen `CONVERTED`, 0 offene Reservierungen, 0 offene Bestellungen |
| **OK-08** | Preisintegrität durchgängig serverseitig | `/api/orders` nimmt nur Produktkennungen; der Listenpreis kommt aus Listing bzw. Produkt, der ausgehandelte aus `effectiveUnitPrice` — **eine** Funktion für Anzeige und Abrechnung ([lib/offer-price.ts](../lib/offer-price.ts), [lib/price-offers.ts:51](../lib/price-offers.ts)); `/api/paypal/orders` rechnet die Summe aus `order_items` neu und lehnt bei Abweichung ab; der Capture prüft `capture.amount.value` gegen den Bestellbetrag |
| **OK-09** | Rate-Limit ist wirklich verdrahtet | Zwei Namespaces in [wrangler.toml:95-103](../wrangler.toml), passend zu `RATE_LIMIT_TIERS`; `tests/rate-limit.test.mjs` vergleicht beides und schlägt bei Drift an; Schlüssel ausschließlich aus `cf-connecting-ip`, `x-forwarded-for` fließt nicht mehr ein; ein fehlendes Binding wird laut protokolliert statt still umgangen; die Ersatz-Map räumt sich auf |
| **OK-10** | Prüfkette grün | `npx tsc --noEmit` sauber · `npm run lint` 0 Fehler, 0 Warnungen · `npm test` **288/288** · CI prüft Typen, auditiert und pinnt Actions auf Commit-SHAs, Auslöser ist `pull_request` (nicht `pull_request_target`) · `git status --short` leer |
| **OK-11** | Supabase-Anbindung | Token gegen die Projektinstanz geprüft ([lib/supabase-server.ts:15](../lib/supabase-server.ts)); Service-Role-Key an genau einer Stelle ([lib/supabase-admin.ts](../lib/supabase-admin.ts)), nie im Bundle, ohne ihn bricht die Löschung mit 503 **vor** dem ersten Schreibzugriff ab; Adminrolle nur aus `ADMIN_EMAILS` **und** nur bei bestätigter Adresse; `user_metadata` liefert nur `username`/`displayName`, nie `role` |
| **OK-12** | Katalog stimmt mit eBay überein | D1: 294 aktive Produkte = 294 aktive Listings; `/api/products` liefert **294**, alle mit Preis, alle mit Bild, alle Menge 1, alle „Festpreis". 0 Waisen (aktives Produkt ohne Bestandszeile), 0 aktive Listings mit ausverkauftem Bestand, 0 Auktionen |
| **OK-13** | Der geplante Lauf trägt | Takt `*/3`, die letzten 12 Läufe alle `SUCCEEDED` mit 0 Importen, 0 Aktualisierungen, 0 Deaktivierungen, 0 Fehlern — der Vergleichslauf aus ai-todo Punkt 2 wirkt in Produktion. **Seit dem 2026-08-07 kein einziger fehlgeschlagener Lauf**: alle 24 `FAILED` und 3 `PARTIAL` stammen vom 06./07. |
| **OK-14** | Doppelverkauf in beide Richtungen abgesichert | „eBay → Shop": Bestandsprüfung vor dem Gang zu PayPal *und* unmittelbar vor dem Einzug, bewusst **vor** dem `PENDING → PROCESSING`-Riegel, mit ausdrücklichem Durchlass bei eBay-Ausfall. „Shop → eBay": Outbox wird beim Abrechnen eingereiht **und sofort** mit 5-Sekunden-Frist abgearbeitet, der geplante Lauf ist das Netz; Lease 10 Minuten, exponentieller Backoff, Endstatus nach 5 Versuchen, Dedupe-Schlüssel eindeutig |
| **OK-15** | Alle Seiten erreichbar, Client-Konfiguration im Bundle | `/`, `/karten`, `/vorverkauf`, `/ueber-uns`, `/anfragen`, `/verkaufen`, `/checkout`, `/account`, `/admin`, `/datenschutz`, `/impressum`, `/agb` → alle **200**. `/account` zeigt das Anmeldeformular, `/admin` „Lade Administrationsbereich …" — **nicht** „Supabase ist noch nicht konfiguriert" |
| **OK-16** | Checkout zeigt den ausgehandelten Preis | `/api/account/offers` mit Bearer-Token, durchgestrichener Listenpreis, Ersparniszeile, Hinweis „Dein ausgehandelter Preis" je Position ([app/checkout/page.tsx:60,166](../app/checkout/page.tsx)) — aus derselben Regel, die auch abrechnet |
| **OK-17** | Adminkonsole vollständig bedienbar | Bestellungen (mit Positionen, Zahlungsstand, Lieferadresse), Karten (anlegen, ändern, Handmarkierung zurücknehmen), Anfragen, Kartenangebote, eBay-Warteschlange mit Fehlergrund und nächstem Versuchszeitpunkt — alle adminpflichtig, alle ohne Token 401. Preis und Menge einer eBay-Karte sind gesperrt, statt eine Änderung vorzutäuschen, die der Import zurückschreibt |
| **OK-18** | Preisvorschläge | Doppelklick durch bedingtes `UPDATE` mit `inArray(status, OPEN)` abgefangen (sonst 409), 48-Stunden-Frist beim Annehmen gesetzt, abgelaufene doppelt abgesichert (`expireLapsedOffers` im geplanten Lauf **und** `expiresAt > now` bei jedem Lesevorgang), fehlende Frist gilt als **nicht** gültig, mehrere angenommene Angebote je Karte ergeben den für den Kunden besseren Preis |
| **OK-19** | Importsperre kann sich nicht mehr verklemmen | `ExpiringLock` mit Verfallszeit statt Wahrheitswert, Frist über den **ganzen** Lauf (`withDeadline`, 5 Minuten), Aufräumen verwaister `sync_runs`-Zeilen **vor** der Sperrprüfung, Zeitstempelfalle über `parseDbTimestamp` umgangen ([lib/sync-lock.ts](../lib/sync-lock.ts)); alle fünf eBay-Aufrufe mit Zeitgrenze |
| **OK-20** | Aufbewahrung und Löschung | 90-Tage-Frist im geplanten Lauf, R2-Objekte **vor** der Datenbankzeile, `datetime()` auf beiden Seiten des Vergleichs; Kontolöschung ordnet über `user_id` **oder** die bestätigte Adresse zu (der Fund vom 2026-08-08), blockiert bei `PENDING`/`PROCESSING`-Bestellungen und bricht ohne Service-Role-Key ab, bevor etwas geschrieben wurde |
| **OK-21** | Uploads nach R2 | MIME am **Inhalt** geprüft (Magic Bytes für JPEG, PNG, WebP), `Content-Length` Pflicht **vor** dem Puffern (411), Speicherschlüssel aus zwei Zufallswerten, privater Bucket, Auslieferung nur über die Adminroute mit festem `content-type`, `nosniff` und `no-store`; Rücknahme bei Fehlschlag, verwaiste Objekte binnen 24 Stunden eingesammelt |
| **OK-22** | Stand und Versionierung | `git status --short` leer, nichts unversioniert; Produktion läuft auf dem aktuellen Code (`11c2dd57` = letzter Codecommit `9b45c67`, darüber nur Dokumentation) |

---

## Abschluss

**Geprüfter Umfang:** Vollständige Codeprüfung von `worker/`, `lib/`, `db/`,
`drizzle/` und allen 23 API-Routen; `npx tsc --noEmit`, `npm run lint`,
`npm test` (288 Tests) lokal ausgeführt; acht lesende D1-Abfragen gegen
`brandycards-production`; rund 40 HTTP-Abrufe gegen `shop.brandycards.de`
(Kopfzeilen, alle zwölf Seiten, alle Admin- und Kontoendpunkte ohne Token,
Formularwächter, Katalog-, Detail- und Galerieantworten); Client-Bundle
wertweise gegen `.env.local` geprüft; `npm audit`; `wrangler deployments list`.

**Bewusst nicht geprüft:** Alles hinter der Anmeldung — Adminkonsole und
Kontofläche im eingeloggten Zustand, insbesondere die Bestellansicht mit echten
Daten; dafür wäre das Passwort des Betreibers nötig. Das Rate-Limit gegen
Produktion — das wäre genau die Last, gegen die es schützt. Jeder schreibende
Vorgang: kein Formular abgesendet, keine Bestellung angelegt, kein eBay-Angebot
angefasst, kein D1-Schreibbefehl; die Wächter sind stattdessen an Antworten
nachgewiesen, die **vor** dem Insert greifen. Die Supabase-Passwortrichtlinie
und die JWT-Laufzeit — über keinen öffentlichen Endpunkt lesbar, unverändert
offen seit der Prüfung vom 2026-08-07.

**Die drei dringendsten Punkte:**

1. **S-01** — `Promise.allSettled` im geplanten Lauf, damit ein eBay-Fehler nicht
   die eBay-Rücknahme mitreißt.
2. **F-02** — eine manuelle Karte anlegen und durchkaufen; der einzige
   vollständige Zweig ohne jeden Produktionsbeleg.
3. **F-06** — den Abschnitt „Offene Punkte" im Übergabeprotokoll richtigstellen,
   solange dort in Rot steht, der Shop könne kein Geld einnehmen.
