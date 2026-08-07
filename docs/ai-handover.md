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

_Kein laufender Auftrag._ Vorlage: Stand, Datum, Ziel, geplante Schritte,
betroffene Dateien, Verifikation, Ergebnis.

---

## Offene Punkte

Kein Auftrag, sondern der Zustand, den die nächste Sitzung kennen muss.
Geplante Arbeit steht dagegen in [ai-todo.md](ai-todo.md).

- **Dauerfreigabe für Deploys.** Der Betreiber am 2026-08-07: „Deploy. Dafür
  brauchst du nicht fragen." Ein `npx wrangler deploy` nach grüner Prüfkette
  (`tsc`, Lint, `npm test`, Bundle-Probe) braucht **keine** Einzelrücksprache
  mehr. **Nicht** eingeschlossen und weiterhin abzusprechen: schreibende
  Eingriffe in Produktionsdaten, Migrationen, Änderungen am eBay-Angebots-
  bestand und alles, was Kosten oder Fremddienste hinzufügt.
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
- **Produktion ist aktuell.** Fünf Deploys am 2026-08-07: `1cfd52f1` (alle
  Sicherheitskorrekturen), `650c189a` (HSTS), `81c6422d` (Profilformular),
  `d893527a` (Konto- und Adminfläche in der Sprache des Shops), `0b25ae0f`
  (Import alle 10 Minuten, Bestandsprüfung vor der Zahlung). Das Rate-Limit
  hat seine Bindings, der Katalog wird am Rand zwischengespeichert, alle sechs
  Sicherheits-Kopfzeilen sind gesetzt, die CSP setzt durch. Nachprüfung in
  [security-findings.md](security-findings.md) unter „Deploy am 2026-08-07".
- **Der Import läuft alle 10 Minuten und ist belegt.** Erster Lauf im neuen
  Takt am 2026-08-07 um 10:50:40 UTC, `SUCCEEDED`, 294 aktualisiert. Ein Lauf
  dauert **rund 77 Sekunden** — nicht die 30, die früher in der Aufgabenliste
  standen. Für 10 Minuten Abstand unkritisch, aber die richtige Zahl, falls
  jemand die Frequenz je weiter erhöhen will.
- **Die Kontofläche im angemeldeten Zustand hat niemand geprüft.** Weder das
  Profilformular noch die Adminübersicht mit echten Zahlen — dafür wäre eine
  Anmeldung mit dem Passwort des Betreibers nötig. Die Gestaltung stammt
  vollständig aus den vorhandenen Regeln (`--paper`, `--ink`, `--line`,
  `--muted`, `#f8f6f1` wie `.form-card`), sollte also tragen; ein Blick lohnt
  trotzdem.
- **Die CSP trägt `'unsafe-inline'` für Skripte.** vinext liefert acht
  Inline-`<script>`-Blöcke je Seite; ohne Nonces bliebe die Seite sonst leer.
  Folge: Inline-Eventhandler sind erlaubt, ein künftiges `<img onerror=…>`
  liefe. Was greift, ist die zweite Hälfte — keine fremden Skripte, kein
  Übertragungsziel außer dieser Herkunft und Supabase. Voller Schutz braucht
  Nonces, Punkt 2a in [ai-todo.md](ai-todo.md).
- **HSTS ist gesetzt**, als `max-age=31536000` **ohne** `includeSubDomains` und
  **ohne** `preload`. Rückweg, falls je nötig: `max-age=0` setzen und deployen —
  das funktioniert nur, weil `preload` fehlt.
- **Cloudflare-Tarif ist Free** (vom Betreiber bestätigt, 2026-08-07). Das
  heißt: 5 Mio. gelesene D1-Zeilen pro Tag für **alles zusammen** — jeden
  Seitenaufruf und jeden stündlichen eBay-Import. SEC-05 wurde deshalb auf
  *hoch* hochgestuft. Sollte der Shop wachsen, ist Workers Paid (5 $/Monat) die
  einfachere Antwort als weiteres Sparen an Abfragen.
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
- **Sync-Lauf nötig, damit „Neu dabei" echt wird.** `ebay_listings.start_at` ist
  noch überall NULL; der Mapper füllt es erst ab Version `a1cdd14f`. Solange
  liefert `/api/products/highlights` für „neueste" bewusst die Importreihenfolge
  (`startAtAvailable: false`) statt fünf willkürlicher Karten. Nach einem
  Sync-Lauf prüfen: `curl -s https://shop.brandycards.de/api/products/highlights`
  muss `"startAtAvailable": true` melden.
- ~~**Preisvorschlag hat keine Oberfläche mehr.**~~ **Veraltet, korrigiert am
  2026-08-07:** `/api/price-offers` verlangt heute ein Produkt mit **aktivem
  eBay-Listing** und lehnt Auktionen ab, nicht `PRELISTED`
  (`app/api/price-offers/route.ts:34`). Das Formular existiert und ist auf der
  Kartendetailseite eingebunden (`app/karten/[id]/page.tsx:138`).
- **CI hat den aktuellen `main` nie geprüft.** Der Merge lief während des
  GitHub-Actions-Ausfalls vom 2026-08-06 und wurde nur lokal verifiziert. Sobald
  Actions wieder `operational` meldet, einmal den Workflow über `main` laufen
  lassen: `gh workflow run CI --ref main` oder `gh run rerun <id>`. Status prüfen:
  `curl -s https://www.githubstatus.com/api/v2/components.json`
- ~~**CI prüft keine Typen.**~~ **Erledigt am 2026-08-07:** Der Workflow führt
  jetzt `npx tsc --noEmit` aus, auditiert die Abhängigkeiten und pinnt seine
  Actions auf Commit-SHAs statt auf bewegliche Tags.
  **Lokal weiterhin selbst ausführen** — der Workflow läuft erst beim Push.
- **eBay-Schreibpfad ist unterbrochen.** `mapActiveListing` setzt `ebayOfferId`
  fest auf `null`, weil `GetMyeBaySelling` nur eine ItemID liefert. Dadurch bleibt
  die `ebay_outbox` ohne Auftrag und ein bezahlter Webshop-Kauf beendet das
  eBay-Angebot nicht. Entschärft nur durch `EBAY_WRITE_ENABLED=false`. Umstellung
  auf `EndItem`/`EndFixedPriceItem` steht aus.
- **Migrationsjournal ist veraltet.** `drizzle/meta/_journal.json` endet bei
  `0002`, `0003`–`0005` kamen handgeschrieben dazu. `npm run db:generate` würde
  gegen den alten Snapshot diffen. Vor dem nächsten Schemaschritt nachziehen.
- **Build braucht `.env.local`.** `NEXT_PUBLIC_SUPABASE_*` wird zur Buildzeit
  eingebacken. Ein Build ohne die Datei liefert ein Bundle aus, in dem `/admin`
  und `/account` mit „Supabase ist noch nicht konfiguriert" abbrechen, während der
  Rest gesund aussieht. Git-Worktrees erben die ignorierte Datei nicht. Details in
  der README unter „Before the first production deployment".

---

## Historie

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
Punkt 2a in [ai-todo.md](ai-todo.md).

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
