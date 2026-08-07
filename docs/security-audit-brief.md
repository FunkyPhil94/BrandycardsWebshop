# Prüfauftrag: Sicherheitsanalyse BrandyCards Webshop

**Für:** einen KI-Agenten mit hoher Reasoning-Tiefe
**Art:** Whitebox-Codeprüfung mit lesenden Live-Stichproben
**Stand der Vorarbeit:** 2026-08-06

---

## 0. Wie dieser Auftrag zu lesen ist

Dieses Dokument nennt bewusst auch, was bereits als geprüft gilt und wo bereits
Verdacht besteht. **Beides ist als Ausgangspunkt gedacht, nicht als Ergebnis.**
Prüfe jede Aussage nach, statt sie zu übernehmen — sie stammt aus einer Sitzung
mit begrenzter Zeit, nicht aus einer systematischen Analyse.

Wo dieses Dokument irrt, ist der Irrtum selbst ein Befund: Notiere ihn.

**Grundhaltung:** Suche nicht nach Bestätigung, dass das System sicher ist.
Suche den Weg hinein. Für jede Schutzmaßnahme lautet die Frage nicht „gibt es
sie?", sondern „unter welchen Umständen greift sie nicht?".

---

## 1. Was das System ist

Selbstgebauter Shop für Fußball-Sammelkarten, betrieben von zwei Privatpersonen
(GbR) in Leverkusen. Rund 300 Karten, ausschließlich Einzelstücke, parallel bei
eBay gelistet.

| Bereich | Technik |
|---|---|
| Laufzeit | Cloudflare Workers, vinext (Next.js 16 / React 19) |
| Datenbank | Cloudflare D1 (SQLite), Zugriff über Drizzle ORM |
| Dateien | Cloudflare R2 (Bucket `UPLOADS`, privat) |
| Authentifizierung | Supabase (E-Mail/Passwort), Token serverseitig geprüft |
| Zahlung | PayPal (Orders v2, Capture, Webhook) |
| Warenquelle | eBay Trading API (`GetMyeBaySelling`, `GetItem`) |
| Domain | `shop.brandycards.de` |

**Einstiegspunkte für die Analyse:** `worker/index.ts` (Worker-Eintritt),
`app/api/**` (alle HTTP-Endpunkte), `lib/**` (Geschäftslogik), `db/schema.ts`
(Datenmodell), `wrangler.toml` (Bindings, Cron, Variablen).

---

## 2. Vertrauensgrenzen

Zeichne diese Grenzen nach und prüfe jede einzeln:

1. **Browser → Worker.** Alles aus dem Browser ist feindlich. Besonders relevant:
   Warenkorb, Adressdaten, Produkt-IDs, Uploads.
2. **Worker → D1.** Parametrisierung, Mengenbegrenzung, Transaktionsgrenzen.
3. **Worker → R2.** Was landet dort, wer kann es lesen, wie werden Schlüssel gebildet.
4. **PayPal → Worker (Webhook).** Eingehend, von außen aufrufbar.
5. **eBay → Worker (Sync).** Fremde Daten, die in die eigene Datenbank fließen und
   im Shop angezeigt werden — inklusive HTML-Beschreibungen.
6. **Supabase → Worker.** Identität. Was passiert, wenn ein Token gefälscht,
   abgelaufen oder für ein anderes Projekt ausgestellt ist?
7. **Admin → Worker.** Rollenprüfung, Rechteausweitung.

---

## 3. Was geschützt werden muss

Nach Schadenshöhe geordnet:

1. **Zahlungsintegrität.** Kann jemand den Preis beeinflussen? Eine Bestellung als
   bezahlt markieren, ohne zu zahlen? Fremde Bestellungen manipulieren?
2. **Kundendaten.** Adressen, E-Mail-Adressen, Bestellhistorie. DSGVO-relevant.
3. **Hochgeladene Bilder** in R2 aus dem Kartenankauf — fremdes Eigentum.
4. **Zugangsdaten.** eBay-Refresh-Token, PayPal-Secrets, Supabase-Schlüssel,
   Cloudflare-Zugang.
5. **Verfügbarkeit und Kosten.** Workers, D1 und R2 rechnen nach Nutzung ab.
   Ein Angreifer, der Kosten erzeugt, schadet auch ohne Datenabfluss.
6. **eBay-Kontostatus.** Stornos wegen Doppelverkäufen verschlechtern den
   Verkäuferstatus — ein Angreifer könnte das gezielt provozieren.

---

## 4. Angreifermodelle

Denke jeden Bereich aus diesen vier Perspektiven durch:

- **Anonymer Besucher.** Kein Konto. Erreicht alle öffentlichen Endpunkte.
- **Angemeldeter Kunde.** Eigenes Konto, will fremde Daten sehen, günstiger
  kaufen oder mehr Rechte erlangen.
- **Automatisiertes Skript / Bot.** Kein Interesse an Daten, sondern an Masse:
  Formulare fluten, Kosten erzeugen, Bestand blockieren, Preise abgreifen.
- **Kompromittierte Fremdquelle.** eBay-Antworten oder PayPal-Callbacks, die
  nicht das sind, was sie zu sein vorgeben.

---

## 5. Bereits geprüft — bitte gegenprüfen, nicht übernehmen

Diese Punkte wurden im Laufe der Entwicklung betrachtet und wirkten in Ordnung.
**Verifiziere sie eigenständig**, insbesondere auf Umgehungswege:

- **SQL-Injection:** Zugriffe laufen über Drizzle; rohes SQL in `lib/ebay-sync.ts`
  nutzt `.prepare().bind()`. Prüfe **jede** Stelle mit rohem SQL und jede
  Stelle, an der Werte in einen Query-Builder fließen — besonders `inArray`,
  `sql\`\`` -Templates und dynamisch gebaute Bedingungen.
- **PayPal-Webhook:** `verifyPayPalWebhookSignature` wird in
  `app/api/paypal/webhook/route.ts` aufgerufen. Prüfe: Wird das Ergebnis
  ausgewertet oder nur geloggt? Was passiert bei Verifikationsfehler? Wird der
  **rohe** Body verifiziert oder ein neu serialisierter? Ist die Verarbeitung
  idempotent (`webhook_events`, `external_event_id`)?
- **Preisintegrität:** Der Checkout nimmt nur Produkt-IDs entgegen; Beträge
  werden serverseitig aufgelöst (`lib/price-offers.ts`, `app/api/orders/route.ts`).
  PayPal wird aus `orders.totalAmountCents` belastet. Suche nach jedem Pfad, auf
  dem doch ein Betrag aus dem Browser wirksam wird.
- **XSS über eBay-Beschreibungen:** `lib/sanitize-html.ts` filtert gegen eine
  Allowlist, bevor `dangerouslySetInnerHTML` greift. **Das ist ein
  selbstgeschriebener Sanitizer — behandle ihn als Hauptverdächtigen.** Siehe 6.2.
- **Rollenprüfung:** Admin über serverseitige `ADMIN_EMAILS`-Allowlist, nur bei
  bestätigter E-Mail. Prüfe jeden Admin-Endpunkt einzeln auf die Prüfung.
- **Secrets:** Liegen als Cloudflare-Secrets, nicht im Repository. Das
  Client-Bundle wurde stichprobenhaft auf Secrets geprüft. Prüfe erneut und
  vollständig, auch Sourcemaps.

---

## 6. Konkrete Verdachtsmomente

Diese Punkte sind aufgefallen, aber **nicht abschließend untersucht**. Sie sind
der wertvollste Startpunkt.

### 6.1 Rate-Limiting greift in Produktion vermutlich nicht *(hoher Verdacht)*

`lib/rate-limit.ts` nutzt das Binding `RATE_LIMITER`, falls vorhanden, und fällt
sonst auf eine `Map` im Arbeitsspeicher zurück. **In `wrangler.toml` ist kein
`RATE_LIMITER` konfiguriert.**

Workers-Isolate sind kurzlebig und existieren vielfach parallel über mehrere
Rechenzentren. Eine Map im Isolate teilt sich also nichts mit anderen Instanzen
und wird laufend verworfen.

Zu klären:
- Ist die Begrenzung dadurch praktisch wirkungslos?
- Wie viele Anfragen kommen tatsächlich durch? (**Nicht gegen Produktion
  testen** — analytisch beantworten oder lokal nachstellen.)
- Was folgt daraus für `/api/inquiries`, `/api/card-submissions`,
  `/api/prelisted-interest`?
- Ist der Rückfall auf eine wirkungslose Begrenzung ein stiller Ausfall? Sollte
  das Fehlen des Bindings beim Start protokolliert werden?

### 6.2 Selbstgeschriebener HTML-Sanitizer *(strukturelles Risiko)*

`lib/sanitize-html.ts` ist regexbasiert. Eigene Sanitizer sind historisch eine
der ergiebigsten Fehlerquellen überhaupt. Es gibt Tests
(`tests/sanitize-html.test.mjs`), aber Tests zeigen nur bekannte Fälle.

Greife ihn gezielt an: verschachtelte und unvollständige Tags, `<svg>`- und
MathML-Kontexte, `<noscript>`, Attribute ohne Anführungszeichen, Backticks,
NULL-Bytes, überlange Eingaben, doppelte Kodierung, `&#x6a;avascript:`,
Zeilenumbrüche und Steuerzeichen in URLs, `srcset`, `xlink:href`, mutation-XSS
durch Reparsing im Browser.

**Bewerte auch grundsätzlich:** Ist ein Eigenbau hier vertretbar, oder sollte
die Beschreibung in einem `sandbox`-iframe isoliert werden? Beachte dabei, dass
Supabase-Token im Browser gespeichert werden — ein XSS wäre damit direkt eine
Kontoübernahme. Das erhöht den Einsatz erheblich.

### 6.3 Unauthentifizierter Endpunkt löst externe API-Aufrufe aus

`app/api/products/[id]/route.ts` ruft bei fehlender Beschreibung `GetItem` bei
eBay auf und speichert das Ergebnis. Der Endpunkt ist öffentlich.

Zu klären: Kann jemand durch Aufrufe vieler IDs eBay-Kontingent verbrauchen oder
Kosten erzeugen? Greift die ID-Validierung zuverlässig? Sollte der Abruf
begrenzt, in den Hintergrund verlagert oder nur angemeldeten Nutzern erlaubt sein?

### 6.4 Unauthentifizierte Uploads nach R2

`app/api/card-submissions/route.ts` nimmt bis zu fünf Bilder à 10 MB ohne Konto
entgegen. Es gibt `assertSameOrigin`, eine Content-Length-Grenze und MIME-Prüfung.

Zu klären: Wird der MIME-Typ am **Inhalt** geprüft oder nur am gemeldeten Wert?
Kann eine polyglotte Datei durchrutschen? Lässt sich die Content-Length-Grenze
mit `Transfer-Encoding: chunked` umgehen? Wie werden Speicherschlüssel gebildet —
sind sie erratbar? Wer kann die Objekte lesen? Gibt es eine Obergrenze für die
Gesamtmenge? Werden verwaiste Objekte aufgeräumt (`lib/card-submission-cleanup.ts`)?

### 6.5 Kein Bot-Schutz auf öffentlichen Formularen

Weder Turnstile noch ein vergleichbarer Mechanismus. In Verbindung mit 6.1
bewerten: Wie aufwendig wäre es, die Datenbank mit Anfragen zu fluten oder R2 zu
füllen? Was kostet das den Betreiber?

### 6.6 `/api/products` ohne Begrenzung

Liefert alle rund 300 Produkte samt Bild-Join in einer Antwort, ohne
Seitenaufteilung, ohne Authentifizierung. Bewerte Antwortgröße, D1-Leselast und
Missbrauchspotenzial durch wiederholte Aufrufe.

### 6.7 Origin-Prüfung nur bei vorhandenem Header

`readJsonBody` in `lib/public-form.ts` prüft die Herkunft **nur, wenn** ein
`Origin`-Header vorhanden ist. Zu klären: Welche Anfragen kommen ohne diesen
Header an? Ist das eine echte CSRF-Lücke oder durch die JSON-Anforderung und
CORS ausreichend abgedeckt? Gilt dieselbe Bewertung für alle Endpunkte —
insbesondere die mit `multipart/form-data`?

### 6.8 Preisverhandlung als neue Angriffsfläche

Neu gebaut (`app/api/price-offers/route.ts`, `app/api/admin/offers/route.ts`,
`lib/price-offers.ts`). Prüfe: Lässt sich die Grenze von drei Vorschlägen je
Karte umgehen (Nebenläufigkeit, mehrere Konten, zurückgezogene Angebote)? Kann
ein Kunde ein fremdes Angebot einlösen? Was passiert bei gleichzeitigem Annehmen
und Kaufen? Kann ein abgelaufenes Angebot wiederbelebt werden? Ist der
Admin-Endpunkt gegen Rechteausweitung abgesichert?

### 6.9 Nebenläufigkeit rund um Bestand und Zahlung

Mehrfach überarbeitet, siehe `docs/ai-agent-log.md`. Trotzdem prüfen:
Doppelte Capture-Aufrufe, gleichzeitiges Ablaufen der Reservierung und Capture,
Webhook parallel zum Capture, mehrere Bestellungen auf dieselbe Karte,
D1-Batch-Grenzen (`lib/d1-limits.ts`).

### 6.10 Supabase-Konfiguration

Nicht untersucht. Prüfe: Sind Datentabellen in Supabase vorhanden, und falls ja,
ist Row Level Security aktiv? Wie ist die Passwort-Richtlinie? Ist die
Registrierung offen? Gibt es E-Mail-Bestätigungszwang? Kann jemand über die
Registrierung Konten mit fremden E-Mail-Adressen anlegen? Wie sieht die
Token-Gültigkeit aus, und wird ein Token serverseitig gegen die richtige
Projekt-Instanz geprüft?

### 6.11 Abhängigkeiten und Lieferkette

Keine automatische Prüfung in CI. Führe `npm audit` aus, bewerte die Ergebnisse,
und prüfe die GitHub-Actions-Workflows auf Rechte (`permissions:`), auf
Verwendung nicht gepinnter Actions und darauf, ob ein Pull Request von außen
Zugriff auf Secrets erlangen kann.

### 6.12 Fehlermeldungen und Protokolle

Prüfe, ob interne Details nach außen dringen (Stacktraces, SQL, Dateipfade) und
ob umgekehrt sicherheitsrelevante Ereignisse überhaupt protokolliert werden.
Achte auf personenbezogene Daten und Zugangsdaten in `console.log`/`console.error`.

---

## 7. Bereiche, die vollständig abzudecken sind

Auch dort, wo bisher nichts auffiel:

1. Jeder Endpunkt unter `app/api/**` einzeln: Authentifizierung, Autorisierung,
   Eingabevalidierung, Mengenbegrenzung, Fehlerverhalten
2. Autorisierung auf Objektebene: Kann Nutzer A Daten von Nutzer B sehen oder
   ändern? Besonders Bestellungen, Angebote, Kontoprofil
3. Sicherheitsrelevante HTTP-Header (CSP, X-Content-Type-Options,
   Referrer-Policy, Permissions-Policy) — siehe `public/_headers`, falls vorhanden
4. Cookies und Token: Speicherort, Gültigkeit, Übertragung
5. Admin-Oberfläche und alle `app/api/admin/**`-Routen
6. Der geplante Ablauf `worker/index.ts` (Cron): Was passiert bei Fehlern, kann
   er von außen ausgelöst werden?
7. Datenmodell (`db/schema.ts`): Fremdschlüssel, Löschverhalten, Constraints
8. DSGVO-Nahes: Auskunft, Löschung, Aufbewahrung, Datensparsamkeit
9. Rechtstexte-Seiten auf Vollständigkeit der Pflichtangaben *(nur Hinweis, keine
   Rechtsberatung)*

---

## 8. Regeln für die Durchführung

**Erlaubt:**
- Vollständige Codeprüfung
- Lesende D1-Abfragen: `npx wrangler d1 execute brandycards-production --remote --json --command "SELECT ..."`
- Lesende HTTP-Aufrufe auf öffentliche Seiten in normalem Umfang
- Lokales Nachstellen von Angriffen (`npm run dev`, Testskripte, Unit-Tests)

**Nicht erlaubt ohne ausdrückliche Rücksprache:**
- Lasttests, Fluten, automatisierte Angriffe gegen die Produktion
- Schreibende Eingriffe in Produktionsdaten
- Echte Bestellungen oder PayPal-Transaktionen
- Änderungen an Cloudflare-Konfiguration oder Secrets
- Jede Interaktion mit dem echten eBay-Konto, die Angebote verändert

**Umgang mit Zugangsdaten:** Die Datei `.env.local` enthält echte Zugangsdaten.
Niemals Werte daraus ausgeben, in Berichte schreiben oder committen — nur auf
Variablennamen verweisen.

---

## 9. Form des Berichts

Lege `docs/security-findings.md` an. Je Befund:

- **Kennung und Titel**
- **Schweregrad** (kritisch / hoch / mittel / niedrig / Hinweis) **mit Begründung**
  — nicht nur ein Etikett, sondern warum diese Einstufung
- **Ort:** Datei und Zeile
- **Angriffsweg:** konkret und nachvollziehbar. Wer kann was tun, mit welchem
  Vorwissen, in welcher Reihenfolge?
- **Auswirkung:** was der Angreifer erreicht, in Geld oder Daten ausgedrückt
- **Nachweis:** Beleg, dass es real ist — nicht „könnte theoretisch"
- **Empfehlung:** konkreter Vorschlag, mit Aufwandseinschätzung
- **Sicherheit der Einschätzung:** bestätigt / plausibel / Vermutung

Am Ende eine **Gesamteinschätzung**: Wo steht die Plattform, was ist das größte
Einzelrisiko, und in welcher Reihenfolge sollte behoben werden?

**Nenne ausdrücklich auch, was du geprüft und für unbedenklich befunden hast.**
Ein Bericht, der nur Probleme auflistet, lässt offen, ob ein Bereich sicher ist
oder nur nicht angesehen wurde.

**Wenn du unsicher bist, sage es.** Eine ehrlich als unklar markierte Stelle ist
wertvoller als eine falsche Entwarnung. Dies ist der Lebensunterhalt zweier
Menschen — eine übersehene Lücke kostet sie echtes Geld und das Vertrauen ihrer
Kunden.

---

## 10. Nützlicher Kontext

- `docs/ai-agent-log.md` — warum bestimmte Lösungen so aussehen, welche Fehler
  bereits auftraten und wie sie behoben wurden
- `docs/ai-handover.md` — aktueller Stand, offene Punkte
- `docs/ai-todo.md` — geplante Arbeit; mehrere Punkte berühren die Sicherheit
- `CLAUDE.md` — bekannte Fallstricke des Projekts

**Bekannte Schwächen der Werkzeugkette, die die Analyse betreffen:** CI prüft
keine Typen (`npx tsc --noEmit` separat ausführen), GitHub Actions hatte am
2026-08-06 einen Ausfall, und der Standard-Branch `main` hinkt dem Arbeitsstand
hinterher — prüfe `agent/initial-brandycards`, nicht `main`.
