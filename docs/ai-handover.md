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

- ~~**Auf schmalen Geräten gibt es keine Hauptnavigation.**~~ **Erledigt am
  2026-08-07:** Burger-Menü gebaut, deployed als `fc35c017`. `.main-nav` bleibt
  unter 850 px ausgeblendet, die Navigation übernimmt dort die Schaltfläche in
  der Kopfzeile. Der Kontolink steht weiterhin daneben in der Leiste und
  **nicht** zusätzlich im Menü — zwei Wege zum selben Ziel sind eine
  Fehlerquelle, keine Hilfe.
- **Dauerfreigabe, am 2026-08-07 zuletzt auf Commits und Pushes ausgeweitet:**
  „Immer committen, pushen und deployen, ohne mich zu fragen." Ein `git push`
  und ein `npx wrangler deploy` nach grüner Prüfkette
  (`tsc`, Lint, `npm test`, Bundle-Probe) brauchen **keine** Einzelrücksprache
  mehr — auch nicht am Ende einer Sitzung, in der nur Oberfläche geändert
  wurde. **Nicht** eingeschlossen und weiterhin abzusprechen: schreibende
  Eingriffe in Produktionsdaten, Migrationen, Änderungen am eBay-Angebots-
  bestand und alles, was Kosten oder Fremddienste hinzufügt.
  **Deployed wird aus dem Hauptverzeichnis, nie aus einem Worktree** — dorthin
  wird `.env.local` nicht vererbt.
- **Frische Installationen sind kaputt, und das trifft jeden.** `npm ci`
  blockiert seit einer npm-Neuerung die Installationsskripte; `workerd` und
  `esbuild` bleiben dadurch unvollständig, und `npm run dev` stirbt beim Start
  mit „The Workers runtime crashed unexpectedly". Behelf:
  `npm install-scripts approve workerd esbuild sharp unrs-resolver && npm rebuild`.
  **Erledigt und überholt:** Das Feld `allowScripts` steht seit Commit
  `c4abc9c` in der `package.json`, der Betreiber hat die Freigabe also
  eingecheckt. Ein frisches `npm ci` bringt `workerd` seitdem vollständig mit;
  am 2026-08-07 in einem leeren Worktree nachgeprüft — `npm install-scripts
  approve` meldete „Nothing to approve", und `npm run dev` startete. **Diese
  Stelle behauptete bis dahin das Gegenteil.**
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
- **Vor dem Push in die CI sehen, nicht nur auf die lokale Prüfkette.** Am
  2026-08-07 lief `npm test` lokal 130/130, während dieselbe Datei in CI elf
  Tests abbrach — **hier Node 24, in CI Node 22**. Ein Deploy ging auf grüner
  lokaler Kette raus, obwohl CI seit Stunden rot war. `gh run list --limit 3`
  kostet nichts und hätte es gezeigt.
- **Produktion ist aktuell; zuletzt deployed ist `fc35c017`** (Burger-Menü
  für schmale Geräte). Davor `161c74e4` (Kontolink im mobilen Kopf). Davor `21bd0667` (CI-Korrektur und
  schlankere Kopfleiste, 126 px statt 164 px). Davor `783402f9` (Warenkorb-
  grenze und Oberflächenkorrekturen). Weiter davor am 2026-08-07
  ging mehrfach hintereinander etwas raus: `1cfd52f1` (alle
  Sicherheitskorrekturen), `650c189a` (HSTS), `81c6422d` (Profilformular),
  `d893527a` (Konto- und Adminfläche in der Sprache des Shops), `0b25ae0f`
  (Import alle 10 Minuten, Bestandsprüfung vor der Zahlung), `2557ca3d`
  (Rücknahme des 10-Minuten-Takts), `a1cdd14f` (`start_at` im Mapper) und
  `07da6e9b` (Zeitgrenzen für eBay, Sperre mit Verfallszeit).
  **Diese Aufzählung endete früher bei `0b25ae0f` und behauptete „fünf
  Deploys" — dabei kamen die drei wichtigsten danach.** Wer den Stand wissen
  will, verlässt sich besser auf `npx wrangler deployments list` als auf diese
  Liste.
  Das Rate-Limit hat seine Bindings, der Katalog wird am Rand
  zwischengespeichert, alle sechs Sicherheits-Kopfzeilen sind gesetzt, die CSP
  setzt durch. Nachprüfung in
  [security-findings.md](security-findings.md) unter „Deploy am 2026-08-07".
- **Der Import läuft alle zwei Stunden, nicht alle 10 Minuten.** Maßgeblich ist
  `crons = ["0 */2 * * *"]` in [wrangler.toml](../wrangler.toml) — das ist die
  Wahrheit, wenn eine Angabe hier ihr je widerspricht. Der 10-Minuten-Takt lief
  am 2026-08-07 nur wenige Stunden (Version `0b25ae0f`, erster Lauf 10:50:40
  UTC, `SUCCEEDED`, 294 aktualisiert) und wurde **am selben Tag zurückgenommen**
  (`2557ca3d`), weil er bei ~5 396 geschriebenen Zeilen je Lauf das
  D1-Schreibbudget um ein Vielfaches gerissen hätte. Begründung in
  [ai-todo.md](ai-todo.md) unter „Erledigt".
  **Folgen, die man kennen muss:** Das Fenster für „auf eBay verkauft, der Shop
  weiß es nicht" ist bis zu zwei Stunden groß — geschlossen wird es erst an der
  Kasse durch die Bestandsprüfung, nicht durch den Import. Und
  `releaseExpiredReservations` hängt am selben Cron, eine abgelaufene
  Reservierung kommt daher nach 15–135 Minuten zurück, nicht nach 15–25.
  Der Weg zurück zu einem schnellen Takt führt über Punkt 2 in
  [ai-todo.md](ai-todo.md) (nur schreiben, was sich geändert hat), **nicht**
  über einen anderen Cron-Ausdruck.
  Ein Lauf dauert **rund 77 Sekunden** — nicht die 30, die früher in der
  Aufgabenliste standen.
- **Die Kontofläche im angemeldeten Zustand hat niemand geprüft.** Weder das
  Profilformular noch die Adminübersicht mit echten Zahlen — dafür wäre eine
  Anmeldung mit dem Passwort des Betreibers nötig. Die Gestaltung stammt
  vollständig aus den vorhandenen Regeln (`--paper`, `--ink`, `--line`,
  `--muted`, `#f8f6f1` wie `.form-card`), sollte also tragen; ein Blick lohnt
  trotzdem.
- **Schriften und Logo kommen aus dem Build, nicht aus `public/`.** Sie liegen
  als Quelle in `app/fonts/` und `app/BrandyCards_Logo_transparent.png` und
  landen mit Inhalts-Hash unter `/assets/`. **Das ist Absicht und kein
  Schönheitsfehler:** Nur gehashte Dateien bekommen
  `cache-control: max-age=31536000, immutable`; alles unter `public/` wird mit
  `max-age=0, must-revalidate` ausgeliefert und bei jedem Seitenaufruf neu
  angefragt (gemessen: 85 ms je Rundlauf). **Wer eine Schrift oder ein Bild
  ergänzt, legt sie deshalb nach `app/` und verweist relativ darauf** —
  `url('./fonts/…')` in der CSS, `import … from "./bild.png"` im TSX. Ein
  absoluter Pfad `/fonts/…` fasst Vite nicht an.
  **Achtung beim Bild-Import:** Er liefert ein Objekt `{src, width, height}`,
  keine Zeichenkette. `<img src={bild}>` bricht **still** zu `[object Object]`;
  richtig ist `src={bild.src}`. Begründung in `assets.d.ts`.
- **Die Schriften liegen im Repository und werden selbst ausgeliefert**
  (10 Dateien, 228 KB, Schnitte `latin` und `latin-ext`).
  Der frühere `@import` von Google Fonts wurde von der eigenen CSP blockiert —
  der Shop lief unbemerkt auf Ersatzschriften. **Wer eine Schrift, einen
  Schnitt oder ein Schriftgewicht ergänzt, muss die Datei mit einchecken**;
  ein neuer `@import` würde wieder still blockiert. Die CSP bleibt dafür
  unverändert eng (`font-src 'self' data:`).
- **Die CSP trägt `'unsafe-inline'` für Skripte.** vinext liefert acht
  Inline-`<script>`-Blöcke je Seite; ohne Nonces bliebe die Seite sonst leer.
  Folge: Inline-Eventhandler sind erlaubt, ein künftiges `<img onerror=…>`
  liefe. Was greift, ist die zweite Hälfte — keine fremden Skripte, kein
  Übertragungsziel außer dieser Herkunft und Supabase. Voller Schutz braucht
  Nonces, Punkt 4a in [ai-todo.md](ai-todo.md).
- **HSTS ist gesetzt**, als `max-age=31536000` **ohne** `includeSubDomains` und
  **ohne** `preload`. Rückweg, falls je nötig: `max-age=0` setzen und deployen —
  das funktioniert nur, weil `preload` fehlt.
- **Cloudflare-Tarif ist seit 2026-08-07 Workers Paid (5 $/Monat).** Damit sind
  die harten Tagesdeckel weg — D1 rechnet nach Verbrauch ab (25 Mrd.
  Lesevorgänge und 50 Mio. Schreibvorgänge im Monat inklusive). Ebenfalls
  dadurch entschärft: `Email Sending` ist verfügbar (Voraussetzung für Punkt 3
  in [ai-todo.md](ai-todo.md)), und die Grenze von 50 Unteranfragen je Anfrage
  ist auf 10 000 gestiegen. Letzteres betraf die Bestandsprüfung vor der
  Zahlung: Sie macht einen eBay-Aufruf je Karte, und bei 50 Karten wäre sie auf
  Free an die Grenze gestoßen.
- **Der hängende Sync-Lauf vom 2026-08-07 ist behoben** (Version `07da6e9b`,
  siehe Historie). Was davon zu wissen bleibt: Ein Lauf ist jetzt nach
  5 Minuten in jedem Fall beendet, und eine `RUNNING`-Zeile wird vom nächsten
  Cron-Schlag danach eingesammelt — ein Eingriff von Hand sollte nie wieder
  nötig sein. Bleibt der Import trotzdem stehen, ist die Ursache **nicht**
  mehr die Sperre und die Suche fängt woanders an.
- **Zwei Messfehler von mir an diesem Tag, damit sie sich nicht wiederholen:**
  1. `wrangler d1 insights` liefert standardmäßig nur die **Top 5** Abfragen.
     Das Flag heißt **`--limit`**, nicht `--count`. Mit `--limit 100` meldet die
     Datenbank 95 Abfragen — die ersten Zahlen waren dadurch deutlich zu
     niedrig.
  2. Ich schloss aus „der Aufräumvorgang schreibt nicht" auf „das
     Schreibbudget ist erschöpft". **Falsch** — ein Testschreibvorgang lief
     anstandslos durch. Der Import stand aus einem anderen Grund. Aus einem
     ausbleibenden Effekt auf eine Ursache zu schließen, ohne die Ursache zu
     prüfen, war der Fehler.
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
- ~~**Sync-Lauf nötig, damit „Neu dabei" echt wird.**~~ **Erledigt, am
  2026-08-07 an der Produktion nachgemessen:**
  `curl -s https://shop.brandycards.de/api/products/highlights` meldet
  `"startAtAvailable": true`. Die Sync-Läufe seit Version `a1cdd14f` haben
  `ebay_listings.start_at` gefüllt; „Neu dabei" zeigt echte Einstelldaten
  (06.08. 17:13, 17:09, 17:00, dann 04.08. 18:23), absteigend sortiert, statt
  der Importreihenfolge als Notbehelf.
- ~~**Preisvorschlag hat keine Oberfläche mehr.**~~ **Veraltet, korrigiert am
  2026-08-07:** `/api/price-offers` verlangt heute ein Produkt mit **aktivem
  eBay-Listing** und lehnt Auktionen ab, nicht `PRELISTED`
  (`app/api/price-offers/route.ts:34`). Das Formular existiert und ist auf der
  Kartendetailseite eingebunden (`app/karten/[id]/page.tsx:138`).
- ~~**CI hat den aktuellen `main` nie geprüft.**~~ **Erledigt am 2026-08-07:**
  `main` wurde auf `c4abc9c` vorgespult und zeigt damit auf einen Commit, dessen
  CI-Lauf grün war (130/130). `main` und `agent/initial-brandycards` stehen auf
  demselben Baum. **Deployt wird weiterhin aus `agent/initial-brandycards`** —
  das Hauptverzeichnis steht darauf ausgecheckt, und dort liegt `.env.local`.
- ~~**CI prüft keine Typen.**~~ **Erledigt am 2026-08-07:** Der Workflow führt
  jetzt `npx tsc --noEmit` aus, auditiert die Abhängigkeiten und pinnt seine
  Actions auf Commit-SHAs statt auf bewegliche Tags.
  **Lokal weiterhin selbst ausführen** — der Workflow läuft erst beim Push.
- **eBay-Schreibpfad ist unterbrochen.** `mapActiveListing` setzt `ebayOfferId`
  fest auf `null`, weil `GetMyeBaySelling` nur eine ItemID liefert. Dadurch bleibt
  die `ebay_outbox` ohne Auftrag und ein bezahlter Webshop-Kauf beendet das
  eBay-Angebot nicht. Entschärft nur durch `EBAY_WRITE_ENABLED=false`.
  **Maßgeblich für die Umstellung ist [ai-todo.md](ai-todo.md) Punkt 6:
  `ReviseInventoryStatus` mit Menge 0, nicht `EndItem`.** Ältere Stellen in
  dieser Datei und in [ai-agent-log.md](ai-agent-log.md) nennen noch
  `EndItem`/`EndFixedPriceItem` — das war der erste Gedanke und ist überholt;
  `EndItem` ist endgültig und bricht durch die neue ItemID die lokale Zuordnung.
  **Was in Punkt 6 fehlt und vorher zu klären ist:** „Umkehrbar" gilt für
  `ReviseInventoryStatus` nur, wenn im eBay-Konto die **Out-of-Stock-Option**
  aktiv ist. Ohne sie beendet eBay ein Festpreisangebot, dessen Menge auf 0
  fällt, von selbst — bei lauter Einzelstücken (Menge 1) also **immer**, und
  dann ist dieser Weg genauso endgültig wie `EndItem`. Zu prüfen über
  `GetUserPreferences` (`OutOfStockControlPreference`), bevor gebaut wird.
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

### 2026-08-08 — Seitentitel: Sports Cards statt Football Collectibles

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-08
- **Ziel:** Der Seitentitel „BrandyCards — Football Collectibles" wird zu
  „BrandyCards — Sports Cards". Letzte Stelle im Projekt, die noch von Fußball
  spricht; sie steht in der Registerkarte, im Lesezeichen und in der
  Suchmaschinen-Trefferliste.
- **Betroffen:** `app/layout.tsx:5`. Sonst nichts — `grep` auf `football` und
  `collectibles` findet im ganzen Projekt nur diese eine Zeile.
- **Der Gedankenstrich bleibt.** Er war beim Entfernen der Gedankenstriche
  bewusst ausgenommen: Registerkartentext, kein Fließtext, und dort ist er ein
  üblicher Trenner. Der Auftrag betrifft nur die Wortwahl.
- **Verifikation:** Titel in Produktion prüfen, **und zwar mit `curl` und
  mehreren Abrufen** — der Rand lieferte beim letzten Durchlauf minutenlang
  gemischt alte und neue Fassung.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün (`tsc`, Lint 0 Fehler, 149/149).
  Der Titel lautet jetzt „BrandyCards — Sports Cards".
- **Damit ist die Umbenennung vollständig.** `grep -rni` auf `app/` und `lib/`
  findet weder `football` noch `collectibles`, weder „Fußball" noch
  „Sammelkarten". Der Shop spricht durchgängig von **Sportkarten** bzw.
  **Sports Cards**.
- **In Produktion nachgeprüft, mehrfach hintereinander** statt mit einer
  einzelnen Stichprobe — siehe den Eintrag darunter, warum das nötig ist.


### 2026-08-07 — Doch Sportkarten, nicht Sammelkarten

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** „Sammelkarten" wieder auf **„Sportkarten"** umstellen. Der Betreiber
  hatte den Begriff im vorigen Durchlauf verwechselt und korrigiert das jetzt.
  Damit spricht der Shop **einen** Begriff, statt wie seit einer Stunde zwei.
- **Betroffen:** `app/layout.tsx:6`, `app/ueber-uns/page.tsx:7`,
  `app/ueber-uns/page.tsx:17` — dieselben drei Stellen wie im Durchlauf davor.
  Der Banner sagt bereits „Sportkarten" und bleibt unangetastet.
- **Verifikation:** Kein „Sammelkarten" und kein „Fußball" mehr in sichtbarem
  Text oder in den Beschreibungen, in Produktion nachgeprüft. **Dabei mit einer
  frisch geladenen Seite arbeiten** — beim letzten Mal zeigte der Browser
  minutenlang den alten Text, während `curl` schon den neuen lieferte.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün (`tsc`, Lint 0 Fehler, 149/149).
  Weder „Sammelkarten" noch „Fußball" kommen im Projekt noch vor; der Shop
  spricht durchgängig von **Sportkarten**, passend zur Vorzeile „THE HOME OF
  SPORTS CARDS".
- **Die vier Stellen:** `app/page.tsx:48` (Banner, stand schon so),
  `app/layout.tsx:6`, `app/ueber-uns/page.tsx:7`, `app/ueber-uns/page.tsx:17`.
- **Zur Historie dieser drei Stellen, damit niemand die Kehrtwende für einen
  Fehler hält:** Sie hießen am 2026-08-07 nacheinander „Fußballkarten",
  „Sammelkarten" und nun „Sportkarten". Der mittlere Schritt beruhte auf einer
  Wortverwechslung des Betreibers und wurde von ihm selbst korrigiert.
- **In Produktion nachgeprüft, mit frisch geladener Seite** — die Falle vom
  Durchlauf davor war genau das: Der Browser zeigte minutenlang den alten Text,
  während `curl` schon den neuen lieferte, und das sah aus wie ein
  fehlgeschlagener Deploy. **Erst `curl`, dann der Browser, und der Browser nur
  ohne Cache.**


### 2026-08-07 — Sammelkarten statt Fußballkarten

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Die drei verbliebenen „Fußballkarten"-Stellen auf **„Sammelkarten"**
  umstellen: die beiden Seitenbeschreibungen (`app/layout.tsx:6`,
  `app/ueber-uns/page.tsx:7`) und den Absatz über die beiden Brüder
  (`app/ueber-uns/page.tsx:17`). Der Betreiber hat das ausdrücklich für alle
  drei angeordnet, also auch für die Tatsachenaussage, bei der ich vorher
  nachgefragt hatte.
- **Sprachlich zu beachten:** Die Beschreibung in `layout.tsx` lautet heute
  „Ausgewählte Fußball-Trading-Cards **für Sammler**". Ein bloßes Ersetzen
  ergäbe „Sammelkarten für Sammler" — die Dopplung wird beim Umbau aufgelöst.
- **Bleibt bewusst stehen:** „Sportkarten" im Banner und „THE HOME OF SPORTS
  CARDS" darüber. Der Auftrag galt den drei genannten Stellen. Dass der Shop
  damit an einer Stelle von Sportkarten und sonst von Sammelkarten spricht,
  wird dem Betreiber genannt.
- **Betroffen:** `app/layout.tsx`, `app/ueber-uns/page.tsx`. Nur Text.
- **Verifikation:** Kein „Fußball" mehr in sichtbarem Text oder in den
  Beschreibungen; die Über-uns-Seite im Browser ansehen.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün (`tsc`, Lint 0 Fehler, 149/149).
  **Im ganzen Projekt kommt „Fußball" in keiner Form mehr vor** — geprüft über
  `grep -rni` auf `app/` und `lib/`, und im ausgelieferten HTML von Startseite
  und `/ueber-uns` je null Treffer.
- **Die Dopplung wurde aufgelöst, nicht nur das Wort getauscht:** Aus
  „Ausgewählte Fußball-Trading-Cards **für Sammler**. Persönlich ausgesucht und
  sicher verpackt." wurde „Ausgewählte Sammelkarten, persönlich ausgesucht und
  sicher verpackt." Ein reines Ersetzen hätte „Sammelkarten für Sammler"
  ergeben.
- **Im Browser nachgemessen:** Der Absatz auf `/ueber-uns` steht weiterhin auf
  zwei Zeilen, kein waagerechter Überlauf; beide Seitenbeschreibungen tragen
  den neuen Text.
- **Bewusst stehen geblieben — der Betreiber weiß davon:** Der Banner sagt
  „Sportkarten", die Vorzeile darüber „THE HOME OF SPORTS CARDS", der Rest des
  Shops „Sammelkarten". Beides ist weiter gefasst als Fußball, aber es sind
  **zwei** Begriffe. Wer das vereinheitlichen will, muss sich entscheiden;
  angefasst wird es nur auf Ansage.


### 2026-08-07 — Banner: Fußballkarten wird zu Sportkarten

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Im Banner der Startseite „Fußballkarten" durch „Sportkarten"
  ersetzen (`app/page.tsx`, `.hero-text`).
- **Passt zur Vorzeile darüber**, die schon „THE HOME OF SPORTS CARDS" sagt.
- **Bewusst nur diese eine Stelle.** Drei weitere nennen ebenfalls
  „Fußballkarten": die beiden Seitenbeschreibungen (`app/layout.tsx:6`,
  `app/ueber-uns/page.tsx:7`) und der Absatz über die beiden Brüder
  (`app/ueber-uns/page.tsx:17`). Der Auftrag lautete „hier", und der
  Brüder-Absatz ist eine **Tatsachenaussage** darüber, was die beiden sammeln —
  die zu ändern steht mir nicht zu. Wird dem Betreiber vorgelegt.
- **Betroffen:** `app/page.tsx`. Nur Text.
- **Verifikation:** Im Browser prüfen, dass der Satz weiterhin auf zwei Zeilen
  passt und die Knöpfe darunter nicht verrutschen.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün (`tsc`, Lint 0 Fehler, 149/149).
  Im Browser nachgemessen: bei 1280 px weiterhin **zwei** Zeilen, die
  Knopfleiste steht unverändert bei 581 px; bei 375 px drei Zeilen wie zuvor,
  kein waagerechter Überlauf.
- **Offen für den Betreiber:** Drei Stellen sagen weiter „Fußballkarten":
  `app/layout.tsx:6`, `app/ueber-uns/page.tsx:7` und
  `app/ueber-uns/page.tsx:17`. Die ersten beiden sind Seitenbeschreibungen für
  Suchmaschinen, die dritte eine Aussage darüber, was die beiden Brüder
  sammeln. **Ob sie mitziehen, entscheidet der Betreiber** — der Banner spricht
  seit heute von Sportkarten, die Über-uns-Seite von Fußballkarten.


### 2026-08-07 — Gedankenstriche raus, Verkaufen-Kachel korrigiert

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Textänderungen aus einer Sichtprüfung des Betreibers.
  1. **Gedankenstriche raus.** Sie durchziehen die Werbetexte („Der komplette
     Bestand mit Suche und Filter — Festpreis, Auktion und Vormerkliste."). Die
     Sätze werden dabei umgebaut, nicht nur der Strich durch ein Komma ersetzt.
  2. **„Preisvorschlag" auf der Verkaufen-Kachel der Startseite** ist das
     falsche Wort: Dort nennt der Kunde *uns* seinen Preis.
- **Befund zu Punkt 2, der die Sache entscheidet:** „Preisvorschlag" ist im
  Shop bereits **belegt** — so heißt die Verhandlung auf der Käuferseite
  (`lib/price-offers.ts`, `app/karten/[id]/offer-form.tsx`). Die Seite
  `/verkaufen`, auf die die Kachel zeigt, sagt dagegen schon
  **„Preisvorstellung"** und **„Wunschpreis"**. Die Kachel ist also nicht nur
  schief formuliert, sie **widerspricht ihrem eigenen Ziel und belegt ein Wort
  doppelt**. Sie wird an die Seite angeglichen, nicht neu erfunden.
- **Umfang:** Alle zwölf Gedankenstriche in sichtbarem Text, auch die vier, die
  der Betreiber nicht abgebildet hat (`/anfragen` zweiter Absatz, Vormerk-
  Formular auf `/karten`, zwei Stellen im Angebotsformular). Ein halb
  bereinigter Shop wäre schlechter als gar keiner.
- **Bewusst ausgenommen:** die beiden `<title>`-Angaben
  („BrandyCards — Football Collectibles", „Über uns — BrandyCards"). Das ist
  Registerkartentext, kein Fließtext; dort ist der Strich ein üblicher Trenner
  und hat keine Alternative, die nicht schlechter aussieht. Wird dem Betreiber
  genannt.
- **Betroffen:** `app/page.tsx`, `app/karten/page.tsx`, `app/anfragen/page.tsx`,
  `app/ueber-uns/page.tsx`, `app/karten/[id]/offer-form.tsx`. **Nur Text —
  kein Verhalten, keine Datenbank, keine API, kein eBay-Aufruf.**
- **Verifikation:** `grep` auf `—` in sichtbarem Text muss leer sein; Prüfkette;
  die geänderten Seiten im Browser ansehen, damit kein Satz umbricht oder
  seine Kachel sprengt.
- **Ergebnis: ABGESCHLOSSEN.** Zwölf Stellen umformuliert. Prüfkette grün
  (`tsc`, Lint 0 Fehler, 149/149).
- **Im Browser nachgemessen, nicht nur im Quelltext ersetzt:** Startseite,
  `/karten`, `/anfragen`, `/ueber-uns` und `/verkaufen` enthalten im
  ausgelieferten Text **null** Gedankenstriche. Die vier Kacheln auf der
  Startseite stehen weiter auf gleicher Höhe (je 278 px), kein Text läuft über
  seinen Kasten hinaus, und bei 375 px gibt es keinen waagerechten Überlauf.
- **Die geänderten Sätze:**
  - „… mit Suche und Filter**.** Festpreis, Auktion und Vormerkliste."
  - „… Schreib uns**,** auch ohne Kundenkonto."
  - „Unser gesamter Bestand**.** Jede Karte einzeln geprüft …"
  - „Hinterlasse deine E-Mail-Adresse**.** Wir melden uns …"
  - „Schreib uns, wonach du suchst**.** Ein Kundenkonto brauchst du dafür
    nicht …"
  - „… desto schneller finden wir sie**.** Set, Spieler und Kartennummer …"
  - „Verhandeln geht nur mit Kundenkonto**.** So wissen wir …"
  - Platzhalter: „Optional**,** zum Beispiel wenn du mehrere Karten möchtest"
  - „… Begeisterung für Fußballkarten**.** Ehrlich, persönlich und …"
  - „… zu groß für zwei Ordner war**. Daraus wurde** BrandyCards."
  - „… zeigt denselben Bestand**. Beides ist** synchronisiert, damit …"
- **Zur Verkaufen-Kachel:** aus „Karten anbieten oder einen **Preisvorschlag**
  machen" wurde „Karten anbieten und deinen **Wunschpreis** nennen. Bilder
  kannst du direkt mitschicken." Damit spricht die Kachel dieselbe Sprache wie
  die Seite, auf die sie zeigt, und das Wort „Preisvorschlag" bleibt der
  Käuferverhandlung vorbehalten. Der Grund steht als Kommentar an der Stelle,
  damit ihn niemand versehentlich zurückdreht.
- **Ausgenommen geblieben:** die beiden `<title>`-Angaben (`app/layout.tsx:5`,
  `app/ueber-uns/page.tsx:6`). Registerkartentext, kein Fließtext. Wird dem
  Betreiber genannt; ein Wechsel auf `·` oder `|` wäre jederzeit möglich.


### 2026-08-07 — Banner: Grafik und Überschrift nicht mehr markierbar

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Zwei Mängel, die der Betreiber beim Markieren von Text auf der
  Startseite gesehen hat.
  1. **Die Kartengrafik rechts im Banner ist auswählbarer Text.** „BRANDYCARDS",
     „01 / 01", „BC", „THE COLLECTOR'S CHOICE", „LEVERKUSEN GERMANY" und
     „EST. 2026" stehen als echte HTML-Elemente da (`app/page.tsx`,
     `.hero-art`). Beim Markieren wird die Grafik zu einer Ansammlung blauer
     Kästen — sie soll sich wie ein Bild verhalten.
  2. **Die Markierungen der beiden Überschriftzeilen überlappen sich.**
- **Ursache von 2, gemessen statt vermutet:** Bei 89,6 px Schriftgröße ist die
  Zeilenhöhe `.9` = 80,64 px, die Zeilen stehen also 82 px auseinander. Das
  gemalte Markierungsrechteck ist aber **123 px** hoch — der Browser nimmt
  dafür die **Schriftmetriken** (Oberlänge + Unterlänge ≈ 1,37 em), nicht die
  Zeilenhöhe. Daraus **40 px Überlappung**; das Rechteck der ersten Zeile legt
  sich über die Oberlängen von „character.".
- **Vier Wege, alle durchgemessen:**

  | Weg | Überlappung | Höhe der Überschrift | Preis |
  |---|---|---|---|
  | so lassen | 40 px | 164 px | — |
  | `line-height: 1.37` | 0 px | 249 px | **+85 px, das enge Satzbild ist hin** |
  | Schriftmetriken stutzen | 10 px | 163 px | kursive Zeile rutscht 10 px |
  | nicht markierbar | entfällt | 164 px | Überschrift lässt sich nicht kopieren |

  Der dritte Weg ist erst möglich, seit wir die Schriften selbst ausliefern
  (`ascent-override` in einer eigenen `@font-face`-Familie). Er drückt das
  Rechteck von 123 px auf **81 px**, also genau auf die Zeilenhöhe — bringt die
  Überlappung aber nicht ganz auf null und verschiebt die kursive Zeile
  sichtbar.
- **Gewählt: der vierte Weg für beide Punkte** — `user-select: none` auf der
  Kartengrafik **und** auf der Banner-Überschrift. Begründung: Er löst beide
  Mängel vollständig und **verändert die Darstellung um keinen einzigen
  Bildpunkt**; der Betreiber hat ausdrücklich gesagt, dass ihm der Banner
  gefällt. Die Kartengrafik ist reine Dekoration, die Überschrift ein
  Schaubild aus zwei Wörtern — beides ist nichts, was jemand herauskopieren
  will. **Der Fließtext darunter bleibt markierbar**, der ist Inhalt.
- **Warum kein echtes Bild aus der Kartengrafik:** Der Wunsch war „soll ein
  Bild sein". Das Ziel dahinter — sie soll sich beim Markieren wie ein Bild
  verhalten — erreicht `user-select: none` vollständig. Eine Rastergrafik
  daraus zu machen kostet Ladezeit, wird auf hochauflösenden Bildschirmen
  unschärfer als die jetzige CSS-Zeichnung und friert Farben ein, die heute aus
  den Farbvariablen kommen. Wird dem Betreiber als Alternative genannt.
- **Mitzunehmen:** `.hero-art` trägt ein `aria-label` an einem `div` **ohne
  Rolle** — das ist wirkungslos. Richtig ist `aria-hidden="true"`, denn für
  Vorleseprogramme ist die Grafik Zierrat; heute lesen sie „BRANDYCARDS 01 / 01
  BC …" mit.
- **Betroffen:** `app/globals.css`, `app/page.tsx`. **Kein Datenmodell, keine
  API, keine Datenbank, kein eBay-Aufruf.**
- **Verifikation:** Im Browser eine Auswahl über die ganze Seite legen und
  messen, dass aus Kartengrafik und Überschrift **kein** Text in der Auswahl
  landet, der Fließtext aber schon; dazu belegen, dass sich die dargestellten
  Maße von Überschrift und Grafik **nicht** geändert haben.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün (`tsc`, Lint 0 Fehler, 149/149).
  Gemessen im Browser:
  - `user-select` ist auf Überschrift, Grafik, Kartenvorderseite,
    Spielerkürzel und Stempel `none`.
  - Eine Auswahl über das **einzelne** Element liefert bei allen dekorativen
    Teilen **0 Zeichen**; der Fließtext dagegen 94.
  - Eine Auswahl über das **ganze** Banner enthält nur noch Vorzeile,
    Fließtext und die beiden Knöpfe — kein „BC", kein „COLLECTOR'S CHOICE",
    kein „EST. 2026", keine Überschrift.
  - **Maße unverändert:** Überschrift 435×164, Grafik 530×430 — dieselben
    Werte wie vorher. Es hat sich kein Bildpunkt verschoben.
- **Zwei Messverfahren von mir taugten nichts — beide aus demselben Grund:**
  1. Ein **programmatisch** über `document.body` gelegter Bereich meldete den
     Kartentext weiter als ausgewählt. Die Range-API kennt `user-select` nicht;
     sie beschreibt Geometrie und Inhalt, nicht das, was der Nutzer auswählen
     kann. Dasselbe gilt für `Range.getClientRects()` — es liefert weiter
     Rechtecke über der Grafik, obwohl dort nichts markiert werden kann.
  2. `document.caretRangeFromPoint` als Ersatz gedacht: ebenfalls untauglich,
     das ist Treffererkennung und ignoriert `user-select` genauso.
     **Tragfähig ist allein `Selection.toString()` je Element.**
  Nebenbei aufgeklärt: Ein Treffer auf „BRANDYCARDS" in der Auswahl kam nicht
  aus der Grafik, sondern aus dem Link „Mehr über BrandyCards" — `Selection`
  gibt den **dargestellten** Text zurück, `text-transform:uppercase` schlägt
  also durch.
- **Was ich nicht prüfen konnte:** einen Blick auf das gemalte Bild. Die
  Vorschau ließ sich in dieser Sitzung nicht einblenden, Bildschirmfotos
  scheiterten. Der Nachweis stützt sich deshalb auf die Textauswahl und die
  berechneten Stile, nicht auf den Augenschein. **Wer als Nächstes hier ist:
  einmal mit der Maus über den Banner ziehen und hinsehen.**


### 2026-08-07 — Logo von 730 KB auf 30 KB

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Das Logo verkleinern. Es ist eine **747 KB** große PNG mit
  1264×842 Bildpunkten und wird mit **164 px** Breite dargestellt (112 px auf
  schmalen Geräten). Der Betreiber hat zugestimmt, nachdem der Befund vorlag.
- **Warum es trotz `immutable` noch zählt:** Das Caching hilft ab dem zweiten
  Besuch. Der **erste** Besuch lädt 747 KB, und das Logo steht im Kopf jeder
  Seite — es konkurriert also mit dem Text um die erste Sekunde.
- **Geplante Schritte:**
  1. Mit `sharp` mehrere Varianten erzeugen und **messen statt schätzen**:
     verkleinerte PNG, PNG mit reduzierter Palette, WebP. Dann die kleinste
     wählen, die verlustfrei genug aussieht.
  2. Zielbreite **500 px**: Das ist mehr als das Doppelte der größten
     Darstellung (164 px) und deckt damit auch Bildschirme mit doppelter und
     dreifacher Punktdichte ab, ohne unscharf zu werden.
  3. **Das Original bleibt im Repository** (`app/brand/…-original.png`), wird
     aber nicht importiert und landet damit auch nicht im Bauergebnis. Ein
     verkleinertes Bild lässt sich nicht wieder vergrößern; die Vorlage muss
     auffindbar bleiben.
  4. `assets.d.ts` um `*.webp` ergänzen, falls die Wahl darauf fällt.
- **Betroffen:** `app/site-chrome.tsx`, `assets.d.ts`, neu `app/brand/*`.
  **Kein Code sonst, keine Datenbank, keine API, kein eBay-Aufruf.**
- **Verifikation:** Größe vorher/nachher belegen; im Browser prüfen, dass das
  Logo in Kopf **und** Fuß lädt, die Kopfleiste bei 126 px bleibt (sonst
  stimmt `--header-h` nicht mehr) und das Bild bei 375 px wie bei 1280 px
  scharf aussieht — also die gerenderten Maße gegen die natürlichen halten.
- **Risiko und Rückweg:** Sichtbare Verschlechterung eines Markenzeichens. Der
  Rückweg ist ein Zeilenwechsel im Import zurück auf das Original, das genau
  dafür liegen bleibt.
- **Ergebnis: ABGESCHLOSSEN.** `app/brand/brandycards-logo.png`, 500×333,
  **30,4 KB statt 729,8 KB — 4,2 % der ursprünglichen Größe.** Prüfkette grün
  (`tsc`, Lint 0 Fehler, 149/149).
- **Die Wahl fiel gegen WebP, und zwar aufgrund einer Messung.** Nach
  Dateigröße allein hätte WebP gewonnen (19–24 KB gegen 30 KB). Entscheidend
  war aber, **wie viel vom Original übrig bleibt**. Verglichen wurde bei 328 px
  — der doppelten Anzeigebreite — auf dem echten Kopfleisten-Hintergrund
  `#f2f0eb`:

  | Variante | Größe | mittlere Abweichung | größter Fehler | sichtbar abweichend |
  |---|---|---|---|---|
  | **PNG 500, Palette** | **30,4 KB** | **0,49** | **24** | **3,7 %** |
  | WebP 500, q90 | 24,2 KB | 1,86 | 63 | 15,7 % |
  | WebP 500, q82 | 19,4 KB | 1,98 | 71 | 16,9 % |
  | WebP 500, verlustfrei | 77,3 KB | 1,45 | 43 | 13,3 % |
  | PNG 500, volle Farbtiefe | 127,6 KB | 0,27 | 21 | 1,7 % |

  Die Palette-PNG ist 6 KB größer als WebP q90 und dabei **rund viermal
  originalgetreuer**. Bei einem Markenzeichen ist das die richtige Seite des
  Tauschs; die vollfarbige PNG wäre nochmals besser, kostet aber das Vierfache
  für einen Unterschied, den bei 164 px niemand sieht. Nebenbei entfällt damit
  die Frage nach WebP-Unterstützung und eine Ergänzung in `assets.d.ts`.
- **Eine Messung, die zuerst Unsinn ergab — als Warnung:** Der erste Vergleich
  lief auf den rohen RGBA-Werten und meldete für *jede* Variante einen
  Maximalfehler von 255. Ursache: In vollständig durchsichtigen Bildpunkten ist
  der Farbwert beliebig, und davon besteht ein Logo mit Freisteller
  größtenteils. **Erst das Auflegen auf den echten Hintergrund macht den
  Vergleich aussagekräftig.** Wer hier nachmisst, muss `flatten` benutzen.
- **Im Browser gemessen:** Beide Logos (Kopf und Fuß) laden, natürlich 500×333.
  Bei 1280 px dargestellt mit 164×109 — Schärfereserve **3,05×**, deckt also
  dreifache Punktdichte. Bei 375 px dargestellt mit 112×75, Reserve **4,46×**.
  Kopfleiste unverändert 126 px bzw. 92 px und deckungsgleich mit `--header-h`,
  kein waagerechter Überlauf, keine fehlerhaften Abrufe.
- **Das Original bleibt als `app/brand/brandycards-logo-original.png` liegen**
  und wird **nicht** importiert — im Bauergebnis steht nur die 30-KB-Fassung
  (nachgeprüft: `find dist -name "*original*"` ist leer). Wer das Logo neu
  aufbereitet, geht von dieser Vorlage aus, nicht von der verkleinerten Datei.


### 2026-08-07 — Schriften und Logo in den Build, mit Inhalts-Hash

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Schriften **und** Logo aus `public/` in den Build geben, damit sie
  einen Inhalts-Hash im Dateinamen bekommen — und damit dauerhaft gecacht
  werden.
- **Befund, gemessen:** Der Build vergibt zwei Klassen von Cache-Regeln.
  Gehashte Bau-Ergebnisse (`/assets/index-CwO5vYEP.css`) bekommen
  `max-age=31536000, immutable`. **Alles unter `public/` bekommt
  `max-age=0, must-revalidate`** — Schriften und Logo also auch. Der Browser
  fragt sie bei jedem Seitenaufruf neu an; die Antwort ist ein 304 ohne Daten,
  aber der Rundlauf bleibt. Von hier aus dreimal gemessen: **85 ms**. Bis er
  durch ist, zeigt `font-display: swap` die Ersatzschrift — der Schriftwechsel
  ist damit bei *jedem* Besuch kurz sichtbar, nicht nur beim ersten.
- **Warum nicht einfach die Header ändern:** Ohne Hash im Dateinamen würde ein
  langes `max-age` einen späteren Austausch derselben Datei bei Bestandskunden
  monatelang blockieren. Der Hash löst beides zugleich — deshalb der Weg über
  den Build und nicht über eine Cache-Regel daneben.
- **Geplante Schritte:**
  1. Die zehn `woff2` von `public/fonts/` nach `app/fonts/` verschieben und in
     `app/globals.css` die zehn `url('/fonts/…')` auf `url('./fonts/…')`
     umstellen. Relative Pfade in CSS fasst Vite an, absolute nicht.
  2. Das Logo aus `public/` in den Build geben und in `app/site-chrome.tsx` an
     **zwei** Stellen (Kopfzeile und Fuß) darauf verweisen.
  3. **Offene Frage, die empirisch zu klären ist, nicht durch Annahme:** Was
     ein Bild-Import in diesem Projekt liefert. Unter Vite ist das eine
     Zeichenkette, unter Next.js ein `StaticImageData`-Objekt mit `src`,
     `width` und `height` — und vinext ist beides zugleich. Deshalb erst
     ausprobieren und `npx tsc --noEmit` sowie das Bauergebnis ansehen, bevor
     die Form feststeht.
- **Betroffen:** `app/globals.css`, `app/site-chrome.tsx`, neu `app/fonts/*`,
  Entfall von `public/fonts/` und `public/BrandyCards_Logo_transparent.png`.
  **Kein Datenmodell, keine API, keine Datenbank, kein eBay-Aufruf.**
- **Verifikation:** In Produktion belegen, dass Schriften und Logo gehashte
  Namen tragen **und** `cache-control: …immutable` liefern; dazu Kopfzeile und
  Fuß im Browser ansehen, damit das Logo nicht still verschwindet.
- **Nebenbefund, noch nicht entschieden:** Das Logo ist eine **747 KB** große
  PNG und wird mit 164 px Breite dargestellt (Original 1264×842). Das ist
  unabhängig vom Cache zu viel und trifft jeden Erstbesucher. Nicht Teil dieses
  Auftrags — ein Neucodieren verändert ein Gestaltungsmittel des Betreibers und
  wird ihm vorgelegt.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler,
  `npm test` 149/149. Alle elf Dateien tragen jetzt einen Inhalts-Hash und
  liegen unter `/assets/`, `public/` enthält nur noch die vier SVG-Symbole.
- **Die offene Frage aus Schritt 3 ist beantwortet — und meine erste Annahme
  war falsch.** Ich hatte den Bild-Import als Zeichenkette deklariert, wie es
  unter reinem Vite richtig wäre. **vinext folgt aber Next.js und liefert ein
  Objekt** `{src, width, height}`. Der Typprüfer schwieg dazu, weil die
  Deklaration selbst die falsche Behauptung war — `npx tsc --noEmit` lief
  sauber durch, während die Seite kaputt war.
  **Sichtbar wurde es erst im Browser:** `src="[object Object]"`, das Logo lud
  nicht (`naturalWidth` 0), und die Kopfleiste fiel von 126 px auf **59 px**
  zusammen. JSX verkettet das Objekt still zu `[object Object]`, statt zu
  klagen. Genau dafür stand der Punkt als „empirisch klären" im Plan.
  Belegt am Bauergebnis: `a=\`/assets/BrandyCards_Logo_transparent-BAqeCyeB.png\`,
  o={width:1264,height:842}, c={src:a,…}`. `assets.d.ts` hält die Form und den
  Grund fest.
- **Mitgenommen, weil die Maße nun ohnehin zur Hand sind:** `width` und
  `height` stehen jetzt am `<img>`. Der Browser kann den Platz damit
  reservieren, bevor das Bild da ist — bei 747 KB im Kopf jeder Seite nicht
  nebensächlich. Die CSS setzt die Anzeigebreite weiterhin (164 px bzw. 112 px
  auf schmalen Geräten).
- **Lokal im Browser gemessen:** beide Logos geladen, 1264×842 natürlich,
  164×109 dargestellt, Kopfleiste wieder **126 px** und deckungsgleich mit
  `--header-h`; Schriften laden, kein Fremdhost, keine fehlerhaften Abrufe.


### 2026-08-07 — Schriften selbst ausliefern statt von Google

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Die drei Schriften selbst ausliefern statt von Google Fonts. Der
  Betreiber hat sich am 2026-08-07 dafür entschieden, nachdem der Befund
  vorlag.
- **Warum:** `app/globals.css:1` lädt DM Mono, Manrope und Playfair Display per
  `@import` von `fonts.googleapis.com`. Die CSP erlaubt nur
  `style-src 'self' 'unsafe-inline'` — der Browser **blockt den Import**.
  Nachgeprüft, dass das nicht nur lokal gilt: Die ausgelieferte CSS in
  Produktion trägt den `@import`, und der `content-security-policy`-Kopf dort
  nennt dieselbe Regel. **Der Shop läuft seit jeher auf Ersatzschriften.**
- **Warum selbst ausliefern und nicht die CSP öffnen:** Zwei Fremdhosts weniger
  (`fonts.googleapis.com` für die CSS, `fonts.gstatic.com` für die Dateien),
  die CSP bleibt eng, und es entfällt ein Datenabfluss an Google bei jedem
  Seitenaufruf — was die Datenschutzerklärung sonst nennen müsste. Dazu ein
  Rundlauf weniger beim Laden: Der Browser muss heute erst die CSS holen, um
  überhaupt zu erfahren, welche Dateien er braucht.
- **Geplante Schritte:**
  1. Die `woff2`-Dateien von `fonts.gstatic.com` holen, **nur die Schnitte
     `latin` und `latin-ext`**. `latin-ext` wird gebraucht, weil Kartentitel
     von eBay polnische und südslawische Namen enthalten (`Kamiński`,
     `Jovanović`) — ohne den Schnitt wechselt mitten im Wort die Schrift.
     Nicht geholt werden Kyrillisch, Griechisch und Vietnamesisch.
  2. Ablage in `public/fonts/`. Die CSP erlaubt `font-src 'self' data:`,
     eigene Dateien sind damit ohne Änderung an der Regel abgedeckt.
  3. `@import` in `app/globals.css` durch `@font-face`-Blöcke ersetzen, mit
     `font-display:swap` und den `unicode-range`-Angaben aus der Google-CSS —
     ohne sie lädt der Browser beide Schnitte statt nur des gebrauchten.
  4. Manrope und Playfair Display sind **variable** Schriften (ein Schnitt
     deckt `400 800` bzw. `500 600` ab), DM Mono ist statisch und braucht 400
     und 500 einzeln.
- **Betroffen:** `app/globals.css`, neu `public/fonts/*.woff2`.
  **Kein Code, keine Datenbank, keine Migration, kein eBay-Aufruf.** Die CSP
  bleibt unverändert — das ist der Punkt der Übung.
- **Verifikation:** Im Browser messen, nicht im Markup suchen: keine
  CSP-Meldung mehr in der Konsole, kein Abruf an `fonts.gstatic.com` oder
  `fonts.googleapis.com` in den Netzwerkanfragen, und die tatsächlich
  verwendete Schrift über `document.fonts.check` bzw. die gerenderte
  Textbreite gegen die Ersatzschrift prüfen. Danach Prüfkette und Deploy.
- **Rückweg:** Der `@import` ist eine Zeile; die Schriftdateien stören nicht,
  wenn sie ungenutzt liegen bleiben.
- **Ergebnis: ABGESCHLOSSEN.** Zehn `woff2`-Dateien unter `public/fonts/`,
  zusammen **228 KB**; `@import` durch zehn `@font-face`-Blöcke ersetzt.
  Prüfkette grün: `tsc` sauber, Lint 0 Fehler, `npm test` 149/149.
- **Im Browser gemessen, nicht im Markup gesucht:**
  - **Netzwerk:** alle Schriftabrufe gehen an `/fonts/…`, alle mit 200. **Kein
    einziger Abruf an `fonts.gstatic.com` oder `fonts.googleapis.com`.**
  - **Konsole:** keine Fehler mehr. Vorher standen dort bei jedem Seitenaufruf
    CSP-Meldungen zur blockierten Google-CSS.
  - **Tatsächlich geladen** meldet `document.fonts`: DM Mono 400, DM Mono 500,
    Manrope 400–800 und Playfair Display italic — also genau die Schnitte, die
    die Seite braucht.
  - **`unicode-range` wirkt:** Auf einer normalen Seite lädt der Browser **nur**
    `latin`. Erst als Text mit `Kamiński`, `Jovanović` und `Šešelj` im Dokument
    stand, kam `manrope-…-latin-ext.woff2` dazu. Der Schnitt ist damit belegt
    nötig und kostet trotzdem nichts, solange er nicht gebraucht wird.
- **Ein Messversuch, der nichts taugte — damit ihn niemand wiederholt:** Ich
  wollte die Schrift über die gerenderte Textbreite gegen `sans-serif`
  nachweisen. Ergebnis: 539 px gegen 536 px. Manrope und die Ersatzschrift des
  Browsers liegen so dicht beieinander, dass die Messung **nichts** belegt —
  weder das eine noch das andere. Tragfähig sind die Netzwerkanfragen und
  `document.fonts`, nicht die Breite.
- **Nach dem Deploy in Produktion nachgeprüft:** `document.fonts` meldet DM Mono
  400/500 und Manrope als geladen, `performance.getEntriesByType('resource')`
  zeigt **keinen einzigen Fremdhost** mehr, die Konsole ist fehlerfrei, und
  `/fonts/manrope-400-800-normal-latin.woff2` antwortet mit 200 und
  `content-type: font/woff2`. Deployed als Version `eb242e0b`.
- **Offen geblieben, erst nach dem Deploy gemessen:** Die Schriften werden mit
  `cache-control: public, max-age=0, must-revalidate` ausgeliefert. Der Browser
  fragt sie damit bei **jedem** Seitenaufruf neu an — die Antwort ist zwar ein
  304, aber der Rundlauf bleibt. Für Dateien, die sich praktisch nie ändern,
  ist das verschenkt. **Nicht einfach hochgesetzt**, weil die Dateinamen
  **keinen Inhalts-Hash** tragen (`manrope-400-800-normal-latin.woff2`): Mit
  einem langen `max-age` würde ein späterer Austausch derselben Datei bei
  Bestandskunden monatelang nicht ankommen. Der saubere Weg ist ein Hash im
  Dateinamen und dann `immutable` — das ist eine eigene Änderung.
- **Nicht gemacht, bewusst:** Kein `<link rel="preload">` für die beiden
  wichtigsten Schriften. Der Browser entdeckt die Dateien erst, wenn er die CSS
  geparst hat; ein Preload würde den ersten Textaufbau beschleunigen. Das ist
  eine eigene Änderung mit eigener Messung und gehörte nicht in diesen Auftrag.


### 2026-08-07 — Warenkorb-Umschalter und Blättern im Bestand

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Zwei Punkte aus einer Sichtprüfung des Betreibers.
  1. **Eine Karte lässt sich nicht wieder aus dem Warenkorb nehmen.** Auf
     `/karten` steht der Knopf nach dem Hinzufügen auf „Bereits im Warenkorb"
     und ist **deaktiviert** — eine Sackgasse. Der einzige Weg hinaus führt
     über den Checkout, wo es einen „Entfernen"-Knopf gibt. Das ist umständlich.
  2. **`/karten` listet alle 294 Angebote auf einer Seite.** Gewünscht ist
     Blättern mit 10, 20, 50 oder 100 Karten je Seite.
- **Befund zum ersten Punkt, beim Lesen dazugekommen:** Der „Entfernen"-Knopf
  im Checkout schreibt zwar den `sessionStorage`, löst aber **kein**
  `brandycards-cart-changed` aus. Nachgezogen, weil `useCart` genau an diesem
  Ereignis hängt.
  **Meine Begründung dafür war beim Planen falsch, und die Messung hat sie
  widerlegt:** Ich hatte geschrieben, die Zahl im Warenkorbsymbol der
  Kopfleiste bleibe dadurch stehen. Der Checkout rendert aber **gar keine
  Kopfleiste** (`document.querySelector('.site-header-bar')` → `null`), es gibt
  dort also keinen Abnehmer des Ereignisses. Der Fehler ist heute **folgenlos**.
  Die Zeile bleibt trotzdem drin: Sie kostet nichts, und der Tag, an dem der
  Checkout eine Kopfleiste bekommt, wäre sonst der Tag mit der falschen Zahl.
  **Als Fehler gemeldet hätte ich ihn nicht dürfen, ohne ihn gesehen zu haben.**
- **Geplante Umsetzung:**
  - `useCart` bekommt `removeFromCart`. Der Knopf wird vom deaktivierten
    Hinweis zu einem **Umschalter**: „In den Warenkorb" ↔ „Aus dem Warenkorb".
  - `cartButtonState` entscheidet künftig auch die Aktion (`add` / `remove` /
    keine). **Wichtig:** Liegt eine Karte im Warenkorb und ist inzwischen
    ausverkauft, muss „Entfernen" trotzdem möglich sein — sonst klemmt sie
    dauerhaft fest. Deshalb wird „im Warenkorb" **vor** „nicht verfügbar"
    geprüft.
  - `cartButtonState` und die Blätter-Rechnung wandern nach `lib/` und
    bekommen Tests. Beides ist reine Entscheidungslogik und ohne Browser
    prüfbar — dieselbe Bewegung wie bei `lib/ebay-stock-check.ts`.
  - Seitengröße und Seitenzahl stehen in der URL (`?pro=50&seite=3`), gelesen
    über `window.location` im Mount-Effekt, geschrieben mit `replaceState`.
    **Grund:** Wer von Seite 7 in eine Karte klickt und zurückgeht, landet
    sonst wieder auf Seite 1. Kein `useSearchParams`, weil das eine
    Suspense-Grenze verlangt; kein Lesen von `window` beim ersten Rendern,
    das bräche die Hydration.
- **Betroffen:** `lib/cart.ts` (neu), `lib/pagination.ts` (neu),
  `tests/cart-and-pagination.test.mjs` (neu, in `npm test` aufnehmen),
  `app/site-chrome.tsx`, `app/karten/page.tsx`, `app/karten/[id]/page.tsx`,
  `app/gallery.tsx`, `app/checkout/page.tsx`, `app/globals.css`.
  **Keine Datenbank, keine Migration, kein eBay-Aufruf.**
- **Verifikation:** `npx tsc --noEmit`, `npm run lint`, `npm test`; dazu im
  laufenden Browser messen statt nur im Markup suchen — Hinzufügen und
  Entfernen samt Zahl in der Kopfleiste, Blättern bei allen vier Seitengrößen,
  Rücksprung aus einer Kartendetailseite auf dieselbe Seite, Verhalten bei
  aktiver Suche. Danach Prüfkette und Deploy (Dauerfreigabe).
- **Angekündigt:** Danach folgen noch inhaltliche Textänderungen.
- **Ergebnis: ABGESCHLOSSEN.** Prüfkette grün: `tsc` sauber, Lint 0 Fehler (die
  bekannte `img`-Warnung), `npm test` **149/149** — 19 neue Tests in
  `tests/cart-and-pagination.test.mjs`.
- **Im laufenden Browser gemessen, mit 137 Testkarten in der lokalen D1**
  (Produktionsdaten unberührt):
  - **Warenkorb:** Klick → „Aus dem Warenkorb ×", Kopfzahl 0 → 1,
    `sessionStorage` `{id:1}`. Zweiter Klick → „In den Warenkorb +",
    Kopfzahl zurück auf 0, Warenkorb `{}`.
  - **Der Randfall, der die Prüfreihenfolge begründet:** Eine Karte mit
    Bestand 0, die im Warenkorb liegt, zeigt „Aus dem Warenkorb" und ist
    **klickbar**. Nach dem Entfernen steht sie auf „Nicht verfügbar" und ist
    gesperrt. Genau so soll es sein — ohne die Reihenfolge klemmte sie fest.
  - **Blättern:** 137 Karten → 7 Seiten zu 20, 3 zu 50, 14 zu 10. Letzte Seite
    korrekt unvollständig (`Karte 101–137 von 137`, 37 Karten), „Weiter"
    gesperrt, „Zurück" nicht.
  - **URL:** Seite 1 mit Vorgabegröße lässt die URL leer, sonst
    `?pro=50&seite=3`. Direktaufruf dieser URL stellt Größe **und** Seite
    wieder her.
  - **Der eigentliche Zweck der URL, durchgespielt:** Von `?pro=50&seite=3` in
    eine Karte geklickt, dann zurück — die Übersicht steht wieder auf Seite 3
    mit 50 je Seite.
  - **Suche:** Von Seite 6 aus „Griezmann" getippt → 19 Treffer, Seite 1,
    Blätterleiste verschwindet, URL leer. Ohne das Zurücksetzen wäre eine leere
    Ansicht erschienen.
  - **375 px:** kein waagerechter Überlauf, Leiste bricht auf 331 px um.
- **Zwei Dinge, die erst die Messung gezeigt hat:**
  1. **„Nicht verfügbar +"** — der gesperrte Knopf trug weiter das Pluszeichen
     und versprach damit etwas, das nicht geht. Das Zeichen hängt jetzt an der
     Aktion, nicht am Knopf.
  2. **Tippziele von 36×35 px** auf dem Handy. Unter 850 px jetzt 44×43 px; die
     Leiste bricht dort ohnehin um, die Höhe kostet also keine Breite.
- **Eine Erwartung im Test war falsch, nicht der Code:** Ich hatte
  `pageNumbers(1, 5)` als `[1,2,3,…,5]` erwartet, geliefert wurde `[1,2,…,5]`.
  Der Code hatte recht — aber die Leiste war zu geizig: Sie versteckte zwei
  Seiten hinter einem Zeichen derselben Breite. Das Fenster steht deshalb jetzt
  auf 2 statt 1. Bis sieben Seiten stehen damit vollständig da, bei 30 Seiten
  bleiben es höchstens neun Schaltflächen — beides durch Tests festgehalten.
- **Nebenbefund, nicht behoben, betrifft das Aussehen des ganzen Shops:**
  `app/globals.css:1` lädt DM Mono, Manrope und Playfair Display per `@import`
  von `fonts.googleapis.com`. Die CSP erlaubt aber nur
  `style-src 'self' 'unsafe-inline'` — der Browser **blockt den Import**.
  Nachgeprüft, dass das nicht nur lokal gilt: Die ausgelieferte
  `assets/index-DxBX5tCZ.css` in Produktion trägt den `@import`, und der
  `content-security-policy`-Kopf dort nennt dieselbe Regel. **Der Shop läuft
  damit in Produktion auf Ersatzschriften.** Nicht angefasst, weil die
  Behebung eine Entscheidung verlangt: Schriften selbst ausliefern (dann bleibt
  die CSP eng und es entfällt ein Fremddienst) oder `fonts.googleapis.com` und
  `fonts.gstatic.com` in die Regel aufnehmen. Gehört dem Betreiber vorgelegt.
- **Nebenbefund zur Doku:** Der offene Punkt „`allowScripts` ist bewusst nicht
  eingecheckt" stimmt nicht mehr — das Feld steht seit Commit `c4abc9c`
  („Checke die Freigabe der Installationsskripte ein") in der `package.json`.
  Der Punkt ist entsprechend korrigiert.

### 2026-08-07 — „Neu dabei" ist echt, und die Dauerfreigabe wächst

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Zwei überholte Stellen in dieser Datei schließen, beide durch
  Messung an der Produktion belegt statt durch Annahme.
- **Anlass:** Eine reine Durchsicht von GitHub, lokalem Stand und allen
  `.md`-Dateien. Sie ergab: alles synchron (`main`,
  `agent/initial-brandycards` und die Worktrees auf `8eabd3e`), CI auf den
  letzten vier Läufen grün, letzter Deploy `fc35c017`, kein Eintrag auf
  `LÄUFT`. Zwei Doku-Stellen waren aber von der Wirklichkeit überholt.
- **Befund 1, gemessen:** `curl -s
  https://shop.brandycards.de/api/products/highlights` meldet
  `"startAtAvailable": true`. Die Sync-Läufe seit `a1cdd14f` haben
  `ebay_listings.start_at` gefüllt; die fünf neuesten Karten tragen echte
  Einstelldaten (06.08. 17:13, 17:09, 17:00, dann 04.08. 18:23), absteigend
  sortiert. Der Notbehelf „Importreihenfolge statt fünf willkürlicher Karten"
  greift nicht mehr. Damit ist die Nachprüfung erledigt, die der Eintrag zu
  `a1cdd14f` der jeweils nächsten Sitzung aufgetragen hatte.
- **Befund 2, vom Betreiber:** Die Dauerfreigabe gilt jetzt auch für Commits
  und Pushes — „immer committen, pushen und deployen, ohne mich zu fragen".
  Der Eintrag unter „Offene Punkte" nannte nur Deploys. Die Ausnahmen bleiben
  unverändert: Produktionsdaten, Migrationen, eBay-Bestand, alles mit Kosten.
- **Betroffen:** `docs/ai-handover.md`. **Kein Code, keine Datenbank, keine
  Migration, kein eBay-Aufruf.**
- **Ergebnis: ABGESCHLOSSEN.** Beide Stellen nachgezogen, committet und nach
  `agent/initial-brandycards` und `main` gepusht.
- **Bewusst nicht deployed, trotz der Dauerfreigabe:** Die Änderung betrifft
  ausschließlich Dokumentation. Am ausgelieferten Worker ändert sich kein Byte,
  ein `wrangler deploy` hätte nichts zu tun und würde nur eine Version ohne
  Inhalt in die Liste schreiben — die man später beim Zurückrollen sucht und
  nicht versteht. **Produktion bleibt auf `fc35c017`.**

### 2026-08-07 — Burger-Menü für schmale Geräte (fc35c017)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Burger-Menü für schmale Geräte. Schließt den offenen Punkt
  „Auf schmalen Geräten gibt es keine Hauptnavigation".
- **Ausgangslage:** `.main-nav` steht im 850-px-Block auf `display:none`.
  Karten, Anfragen, Verkaufen und Über uns sind dort nur über den Seitenfuß
  erreichbar. `SiteHeader` ist bereits eine Client-Komponente (`"use client"`),
  Zustand ist also ohne Umbau möglich.
- **Geplante Umsetzung:**
  - Schaltfläche in der Kopfzeile, nur unter 850 px sichtbar, mit
    `aria-expanded`, `aria-controls` und wechselnder Beschriftung
    („Menü öffnen" / „Menü schließen").
  - Die Liste klappt **absolut positioniert** unter der Leiste auf, nicht im
    Fluss. Grund: Die Leiste muss ihre 92 px behalten, sonst stimmt
    `--header-h` im geöffneten Zustand nicht mehr.
  - Schließt bei Klick auf einen Eintrag, bei `Escape` und bei Klick daneben.
  - Ab 851 px sind Schaltfläche und Liste per CSS ausgeblendet — damit ist ein
    offen gelassenes Menü beim Vergrößern des Fensters folgenlos, ohne dass
    dafür Zustand aufgeräumt werden muss.
  - **Kein zweiter Kontolink im Menü.** Er steht seit `161c74e4` in der Leiste;
    zwei Wege zum selben Ziel sind eine Fehlerquelle, keine Hilfe.
- **Betroffen:** `app/site-chrome.tsx`, `app/globals.css`. Kein Datenmodell,
  keine API, kein eBay.
- **Verifikation:** Bei 375 px im Browser: Menü öffnet und schließt über die
  Schaltfläche, `Escape` schließt, ein Klick auf einen Eintrag navigiert und
  schließt; `aria-expanded` folgt dem Zustand; die Leistenhöhe bleibt im
  geöffneten Zustand bei 92 px; kein waagerechter Überlauf. Bei 1280 px darf
  nichts davon sichtbar sein. Dann Prüfkette und Deploy.
- **Ergebnis: ABGESCHLOSSEN**, deployed als Version `fc35c017`.
  `tsc` sauber, Lint 0 Fehler, `npm test` 130/130.
  **Live auf `shop.brandycards.de` bei 375 px durchgespielt:** Schaltfläche
  sichtbar, `aria-expanded` folgt dem Zustand, Beschriftung wechselt auf
  „Menü schließen", alle vier Einträge mit korrekten Zielen, `aria-current`
  markiert die aktive Seite, `Escape` schließt, Klick daneben schließt, Klick
  **innerhalb** der Leiste schließt nicht, Klick auf einen Eintrag navigiert und
  schließt. Leiste bleibt im geöffneten Zustand bei 91 px, kein waagerechter
  Überlauf. Bei 1280 px sind Schaltfläche und Liste `display:none` — auch nach
  einem erzwungenen Klick auf die unsichtbare Schaltfläche.
- **Drei Dinge, die die Messung erst sichtbar gemacht hat:**
  1. **Der Burger drückte das Logo zusammen** — die Leiste fiel auf 83 px statt
     92 px. Ursache war nicht die Schaltfläche, sondern der Standardabstand von
     **48 px** zwischen Logo und Aktionen: Von 331 px verfügbarer Breite nahm er
     allein 48. Unter 500 px steht er jetzt auf 14 px, damit bleibt das Logo bei
     112 px und die Leiste bei ihren 92 px (gemessen 91, Subpixel-Rundung).
  2. **Das Menü begann 1 px zu hoch.** `top:100%` bezieht sich auf die
     Padding-Box der Leiste, deren Rahmenlinie liegt darunter — die Liste lag
     damit auf der Linie. Jetzt `top:calc(100% + 1px)`, und der eigene Rahmen
     der Liste entfällt, weil die Linie der Leiste bereits trennt.
  3. Die Schaltfläche wurde selbst zusammengedrückt (31 statt 38 px), daher
     `flex-shrink:0`.
- **Nochmals dieselbe Falle wie beim Deploy davor, diesmal andersherum:** Die
  Prüfung direkt nach `wrangler deploy` zeigte noch das **alte** Stylesheet —
  nicht weil der Deploy fehlschlug, sondern weil die Verteilung an den Rand
  einen Moment braucht. Nach etwa 20 Sekunden lieferte die Produktion die neue
  Datei. **Nach einem Deploy kurz warten, bevor man die Bundle-Referenz
  prüft**, sonst diagnostiziert man ein Problem, das keines ist.

### 2026-08-07 — Kontolink im mobilen Kopf (161c74e4)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Auf schmalen Geräten fehlt in der Kopfleiste der Zugang zum Konto.
  Er soll dort erscheinen.
- **Befund:** Im 850-px-Block stehen **`.main-nav` *und* `.account-link` auf
  `display:none`**. Auf dem Handy bleibt damit nur Logo und Warenkorb — nicht
  nur „Konto" fehlt, sondern **die gesamte Navigation**. Karten, Anfragen,
  Verkaufen und Über uns sind ausschließlich über den Seitenfuß erreichbar,
  also nach dem Scrollen über die ganze Seite.
- **Umfang dieses Durchlaufs:** Nur der Kontolink, wie beauftragt. Die fehlende
  Hauptnavigation ist der größere Punkt, aber ein eigener — sie braucht ein
  Menü und damit eine Gestaltungsentscheidung, keine Zeile CSS. Wird als
  offener Punkt hinterlegt statt nebenbei erfunden.
- **Geplante Schritte:** `.account-link` im 850-px-Block wieder einblenden und
  unter 500 px so verkleinern, dass Logo, Konto und Warenkorb nebeneinander
  passen, ohne die Leiste zu verbreitern oder umzubrechen.
- **Betroffen:** `app/globals.css`. Kein Datenmodell, keine API, kein eBay.
- **Verifikation:** Bei 375 px und 768 px im Browser messen: Kontolink
  sichtbar, kein waagerechter Überlauf, Leistenhöhe unverändert 92 px bzw.
  126 px (sonst stimmt `--header-h` nicht mehr). Dann Prüfkette und Deploy.
- **Ergebnis: ABGESCHLOSSEN**, deployed als Version `161c74e4`.
  `tsc` sauber, Lint 0 Fehler, `npm test` 130/130.
  Live auf `shop.brandycards.de` bei 375 px nachgemessen: „Konto ↗" sichtbar,
  Ziel `/account`, auf einer Höhe mit dem Warenkorb, Leiste unverändert 92 px,
  kein waagerechter Überlauf. Bei 768 px ebenso, Leiste 126 px.
- **Nebenbefund bei 320 px:** Dort passt die Leiste die Sache selbst an — das
  Logo schrumpft als Flex-Element **proportional** mit (94×63 statt 112×75,
  Seitenverhältnis unverändert), die Leiste wird 80 px statt 92 px. Gewollt:
  lieber ein etwas kleineres Logo als eine umbrechende Kopfzeile. `--header-h`
  ist damit unterhalb von ~340 px eine **Obergrenze**; folgenlos, weil unter
  850 px nur `scroll-padding-top` den Wert nutzt und ein zu großer Wert dort
  bloß etwas mehr Luft über dem Sprungziel lässt. Steht als Kommentar im CSS.
- **Dabei mitkorrigiert:** Der Kommentar an `--header-h` nannte noch die alten
  Höhen 164/150/116 px — beim Verschlanken der Leiste hatte ich die Werte in
  den Deklarationen geändert, den Kommentar daneben aber nicht. Jetzt 126/92.
- **Zwei Fallen, in die ich gelaufen bin und die Zeit gekostet haben:**
  1. Der Browser zeigte nach dem Deploy hartnäckig die **alte** Kopfzeile. Nicht
     der Deploy war schuld, sondern eine gecachte Seite, die noch auf das alte
     Stylesheet zeigte. Wer prüfen will, ob ein Deploy wirklich durch ist,
     fragt mit `curl` nach dem referenzierten Dateinamen — das umgeht jeden
     Browser-Cache:
     `curl -s https://shop.brandycards.de/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.css'`
  2. Die Meldung `Total Upload: 2428.22 KiB` ist bei zwei Deploys **identisch**,
     obwohl sich CSS geändert hat. Sie taugt **nicht** als Beleg dafür, dass
     etwas Neues hochgeladen wurde.

### 2026-08-07 — main auf den Arbeitsstand vorgespult (53 Commits)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** `main` auf den Arbeitsstand bringen. Der Branch hängt **53 Commits**
  zurück (`a36e626`, der Merge von heute Mittag), während
  `agent/initial-brandycards` auf `c4abc9c` steht.
- **Ausgangslage:** `main` ist ein **direkter Vorfahr** — keine Divergenz, kein
  Konflikt, ein reiner Fast-Forward. `main` ist **nicht** branch-protected, aber
  **Default-Branch**: Wer das Repository klont, bekommt derzeit den Stand von
  heute Mittag. Die Spitze `c4abc9c` ist **grün durch die CI**
  (Lauf zu `c4abc9c`, 130/130).
  Produktion ist nicht betroffen — deployt wird aus
  `agent/initial-brandycards`.
- **Warum jetzt und nicht wie beim letzten Mal:** Derselbe Schritt stand am
  2026-08-06 schon einmal an und scheiterte damals an der Berechtigungsprüfung
  der Umgebung, nicht am Inhalt. Zusätzlich lief die CI damals gar nicht
  (GitHub-Actions-Ausfall); diesmal ist die Spitze geprüft.
- **Geplante Schritte:** `git push origin origin/agent/initial-brandycards:main`
  (Fast-Forward, kein Merge-Commit, keine Historie umgeschrieben).
- **Betroffen:** Branch `main` auf GitHub. **Kein Code, kein Deployment, keine
  Datenbank.** Der Branch `agent/initial-brandycards` bleibt bestehen — das
  Hauptverzeichnis steht darauf ausgecheckt.
- **Verifikation:** `main` und `agent/initial-brandycards` zeigen anschließend
  auf **denselben Baum** (`git rev-parse <branch>^{tree}` vergleichen).
- **Rückweg:** `git push --force origin a36e626:main` stellt den alten Stand
  wieder her. Möglich, weil nichts umgeschrieben, nur vorgespult wird.
- **Ergebnis: ABGESCHLOSSEN.** `a36e626..c4abc9c` als Fast-Forward auf `main`
  gepusht. Nachgeprüft: Abstand zwischen `origin/main` und
  `origin/agent/initial-brandycards` ist **0/0**, beide zeigen auf denselben
  Baum `c4dafc9`, und die GitHub-API meldet für `main` ebenfalls `c4abc9c`.
  Damit ist der Punkt geschlossen, der seit dem 2026-08-06 offen war.
  `agent/initial-brandycards` wurde **nicht** gelöscht — das Hauptverzeichnis
  steht darauf ausgecheckt, und von dort wird deployed.

### 2026-08-07 — CI wieder grün, Kopfleiste verschlankt (21bd0667)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Zwei Dinge: **CI wieder grün bekommen** und die klebende Kopfleiste
  verschlanken.
- **Befund 1 — CI ist seit dem 2026-08-07, 15:16 Uhr rot, und es ist mir
  entgangen.** Ich habe `783402f9` auf grüner *lokaler* Prüfkette deployed,
  ohne den CI-Zustand anzusehen. Der Fehler stammt **nicht** aus meinen
  Änderungen (letzter grüner Lauf 15:11, erster roter 15:16 — beides vor dieser
  Sitzung), aber beim Push hätte ich ihn sehen müssen.
  - Symptom: `npm test` meldet in CI 130 Tests, **0 fehlgeschlagen, 11
    abgebrochen** → Exit 1. Alle elf stammen aus
    `tests/ebay-sync-timeout.test.mjs` und tragen `cancelledByParent` mit
    `Promise resolution is still pending but the event loop has already resolved`.
  - Ursache: **`AbortSignal.timeout()` hält den Event-Loop nicht wach** (der
    Timer ist unref'd). Im Test ist die stumme `fetch`-Zusage das einzige
    offene Handle; Node stellt fest, dass nichts mehr Fortschritt machen kann,
    und räumt ab, bevor die Zeitgrenze greift. **Lokal läuft Node 24, in CI
    Node 22** — daher 130/130 auf diesem Rechner und rot auf GitHub.
  - **Das ist ein Fehler im Test, nicht in der Produktion.** Im Worker hält die
    laufende Anfrage den Kontext offen; die Zeitgrenze selbst ist richtig.
    Korrigiert wird deshalb der Stub: Er hält den Loop für die Dauer des
    Versuchs mit einem ref'd Timer wach — das bildet die Situation ab, die im
    Worker ohnehin herrscht.
- **Befund 2 — Kopfleiste zu wuchtig.** Sie ist 164 px hoch und nimmt geklebt
  fast ein Viertel eines 720-px-Fensters ein. Sie soll „minimal größer als das
  Logo" werden: Logo bleibt, Innenabstand schrumpft. `--header-h` muss danach
  **neu gemessen** werden — davon hängen der Sticky-Versatz von
  `.detail-media` und `scroll-padding-top` ab.
- **Geplante Schritte:** Test korrigieren und den Rot-Nachweis **unter Node 22**
  führen, statt zu behaupten, es helfe; Innenabstand der Kopfzeile reduzieren;
  Höhen an allen drei Breakpoints neu messen; Prüfkette; deployen; **den
  CI-Lauf abwarten und grün sehen**, nicht annehmen.
- **Betroffen:** `tests/ebay-sync-timeout.test.mjs`, `app/globals.css`.
  Keine Produktionsdaten, keine Migration, kein eBay.
- **Ergebnis: ABGESCHLOSSEN.** Commit `013b9a7`, deployed als Version
  `21bd0667`.
  - **CI ist wieder grün.** Lauf `31204192313` auf `013b9a7`: **130 Tests, 130
    bestanden, 0 fehlgeschlagen, 0 abgebrochen.** Die beiden Läufe davor
    (`22e8cb7`, `0a9c48d`) waren rot mit je 11 abgebrochenen Tests. Damit ist
    die Korrektur dort belegt, wo sie belegt werden musste — unter Node 22.
  - Kopfleiste live nachgemessen: **126 px** bei 109 px Logo, also 17 px Rand
    insgesamt; `--header-h` stimmt mit dem gemessenen Wert überein, und die
    Leiste klebt beim Scrollen unverändert bei `top:0`.
  - `/account` und `/admin` antworten mit 200 und ohne „Supabase ist noch nicht
    konfiguriert", `/` und `/karten` 200.
- **Beleg für Befund 1, gemessen statt vermutet:** Ein Skript, dessen einziges
  offenes Handle ein `AbortSignal.timeout(600)` mit `abort`-Listener ist,
  endete **nach 1 ms** — der Abbruch feuerte nie. Das gilt sogar unter Node 24;
  dass die Tests hier durchliefen, war ein Rennen, das Node 24 gewinnt und
  Node 22 verliert. **Ein echtes Node 22 stand nicht zur Verfügung** (kein
  nvm/fnm; `npx node@22` liefert das lokale Node 24). Der Nachweis, dass die
  Korrektur greift, ist deshalb **der grüne CI-Lauf**, nicht ein lokaler Lauf.
- **Zur Kopfleiste, nachgemessen:** Das Logo rendert bei 164 px Breite genau
  **109 px** hoch (Original 1264×842). Mit 8 px Innenabstand kommt die Leiste
  auf **126 px** statt 164 px. Browserwerte an beiden Breakpoints deckungsgleich
  mit `--header-h`: 126/109 auf 1280 px, 92/75 auf 375 px, kein waagerechter
  Überlauf, Kleben unverändert.
- **Fallstrick, der Zeit gekostet hat und der nächsten Sitzung erspart bleiben
  soll:** Der Vorschau-Server startet im **Worktree**, während diese Änderungen
  im **Hauptverzeichnis** lagen. Er lieferte deshalb minutenlang das alte CSS,
  und die Messung zeigte hartnäckig die alten 164 px. Wer im Hauptverzeichnis
  arbeitet, startet `npm run dev` auch dort — sonst misst er einen anderen
  Stand, als er gerade schreibt.

### 2026-08-07 — Warenkorbgrenze und Oberflächenkorrekturen deployed (783402f9)

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Die sieben Oberflächen- und Warenkorbkorrekturen aus dem Eintrag
  darunter nach `agent/initial-brandycards` bringen und deployen.
- **Neue Dauerfreigabe des Betreibers:** „Immer deployen, nicht fragen."
  Deploys nach grüner Prüfkette brauchen ab sofort **keine** Rückfrage mehr.
  Unverändert abzusprechen bleiben: Produktionsdaten, Migrationen,
  eBay-Bestand, alles mit Kosten.
- **Ausgangslage, zwei Stolpersteine:**
  1. Die Arbeit liegt in einem Worktree auf `claude/brandycards-onboarding-b56bd0`.
     **Dort darf nicht deployed werden** — `.env.local` wird in Worktrees nicht
     vererbt, genau so ging schon ein Deploy schief.
  2. **Das Hauptverzeichnis steht auf `0504567` und ist damit 48 Commits
     zurück.** Es muss vor dem Deploy nachgezogen werden, und weil sich
     `package-lock.json` dazwischen stark geändert hat, auch `npm ci`.
- **Geplante Schritte:**
  1. Im Worktree committen und nach `origin/agent/initial-brandycards` pushen
  2. Hauptverzeichnis: `git pull`, `npm ci`
  3. Prüfkette dort: `npx tsc --noEmit`, `npm run lint`, `npm test`
  4. **Bundle-Probe:** `grep -rl "supabase.co" dist/client/assets` — findet sie
     nichts, fehlte `.env.local` beim Build und der Deploy wird abgebrochen
  5. `npx wrangler deploy`
  6. Nachprüfen: `/account` und `/admin` laden (nicht „Supabase ist noch nicht
     konfiguriert"), Sicherheits-Kopfzeilen, `cache-control` am Katalog
- **Betroffen:** Branch `agent/initial-brandycards`, Produktions-Deployment.
  **Keine** Datenbank, **keine** Migration, **kein** eBay-Aufruf.
- **Risiko:** Der Deploy schaltet Oberflächenänderungen live, darunter eine
  Verhaltensänderung am Kaufknopf. Rückweg ist ein Rollback auf die vorige
  Worker-Version im Cloudflare-Dashboard.
- **Ergebnis: ABGESCHLOSSEN.** Commit `0a9c48d`, als Fast-Forward nach
  `agent/initial-brandycards` gepusht (`9d0ea64..0a9c48d`).
  **Deployed als Version `783402f9`.**
  - Hauptverzeichnis stand auf `0504567`, also 48 Commits zurück — nachgezogen
    und `npm ci`. Prüfkette dort: `tsc` sauber, Lint 0 Fehler (die bekannte
    `img`-Warnung), `npm test` **130/130**.
  - **Bundle-Probe bestanden:** `supabase.co` liegt in
    `dist/client/assets/supabase-browser-RbW28-cr.js`. Zusätzlich gegengeprüft,
    dass **keines** der Server-Geheimnisse im Client-Bundle steht
    (`EBAY_CLIENT_SECRET`, `EBAY_REFRESH_TOKEN`, `ADMIN_EMAILS`).
  - **Nach dem Deploy in Produktion geprüft**, mit der Seite zuerst, die
    Client-Konfiguration braucht: `/account` und `/admin` antworten mit 200 und
    **ohne** „Supabase ist noch nicht konfiguriert"; `/` und `/karten` 200.
    Alle sechs Sicherheits-Kopfzeilen stehen, `cache-control` am Katalog ist
    `public, max-age=60, stale-while-revalidate=300`.
  - **Die Korrekturen selbst live nachgemessen**, nicht nur im Markup gesucht:
    Auf `/karten` (294 Kaufknöpfe) macht ein Klick die Menge 1 und sperrt den
    Knopf auf „Bereits im Warenkorb"; drei weitere Klicks ändern nichts. Die
    Kopfleiste rastet ab Scrollposition 600 bei `top:0` ein, gemessene Höhe
    **164 px** — genau der Wert in `--header-h`. Hero-Text und `EST. 2026`
    stehen, der alte „FOOTBALL CARDS"-Text ist weg.
- **Offen geblieben, bewusst:** `npm ci` blockiert die Installationsskripte,
  dadurch bleibt `workerd` unvollständig und `npm run dev` startet nicht.
  Behelf lokal ausgeführt
  (`npm install-scripts approve workerd esbuild sharp unrs-resolver && npm rebuild`),
  das dabei entstehende Feld `allowScripts` in der `package.json` aber
  **nicht eingecheckt**: Es erlaubt Installationsskripten dauerhaft die
  Ausführung und ist damit eine Entscheidung über die Lieferkette. **Wer als
  Nächstes frisch installiert, läuft erneut hinein.**

### 2026-08-07 — Sichtprüfung: sechs Oberflächenpunkte und ein Warenkorbfehler

- **Stand:** ABGESCHLOSSEN
- **Datum:** 2026-08-07
- **Ziel:** Sieben Punkte aus einer Sichtprüfung des Betreibers — sechs
  Oberfläche, einer davon ein **echter Fehler im Warenkorb**.
- **Die Punkte:**
  1. **Werteleiste („AUTHENTIC CARDS ✦ …") bricht mobil.** `.ticker` ist ein
     `flex` ohne Umbruch mit `overflow:hidden` — auf schmalen Geräten wird
     abgeschnitten statt umgebrochen.
  2. **`EST. 2024` → `EST. 2026`** im Hero-Stempel.
  3. **Kopfleiste soll beim Scrollen oben bleiben** (`position:sticky`).
     Achtung: `.detail-media` klebt bereits bei `top:24px` und muss um die
     Kopfhöhe versetzt werden, sonst schiebt es sich darunter.
  4. **Hero-Text:** „THE HOME OF FOOTBALL CARDS" → „THE HOME OF SPORTS CARDS",
     Fließtext neu.
  5. **Galerie springt.** `.gallery-stage` und der Titel wachsen mit dem
     Text — bei einer Rotation alle 2 Sekunden hüpft das Layout sichtbar.
     Feste Höhe für Titel und Bühne.
  6. **Warenkorb-Fehler (kein Kosmetikpunkt):** `addToCart` in
     `app/site-chrome.tsx:51` erhöht die Menge ungeprüft. Eine Karte, die es
     genau **einmal** gibt, lässt sich beliebig oft hinzufügen. Der Server
     lehnt das später ab (`app/api/orders/route.ts:75`), der Kunde erfährt es
     also erst nach dem Ausfüllen der Adresse. Die Grenze fehlt im Browser.
  7. **„BC" auf der Hero-Karte unlesbar.** `.hero-player` ist `#282019` auf
     einem Verlauf, der ab 46 % auf `#262321` umschlägt — dunkel auf dunkel.
- **Geplante Schritte:** Punkte 1–5 und 7 in `app/globals.css` und
  `app/page.tsx`. Punkt 6 in `app/site-chrome.tsx` (Grenze in `addToCart`),
  dazu die drei Kaufknöpfe (`gallery.tsx`, `karten/page.tsx`,
  `karten/[id]/page.tsx`) und `app/checkout/page.tsx`, das eine veraltete
  Menge aus `sessionStorage` sonst weiterreicht.
- **Betroffen:** `app/globals.css`, `app/page.tsx`, `app/site-chrome.tsx`,
  `app/gallery.tsx`, `app/karten/page.tsx`, `app/karten/[id]/page.tsx`,
  `app/checkout/page.tsx`. Keine Datenbank, kein Schema, kein eBay.
- **Verifikation:** `npx tsc --noEmit`, `npm run lint`, `npm test`; dazu die
  Oberfläche lokal im Browser gegenprüfen (Kopfleiste beim Scrollen, Galerie
  ohne Sprung, Warenkorbknopf nach dem zweiten Klick). **Kein Deploy** in
  diesem Durchlauf ohne Ansage.
- **Ergebnis: ABGESCHLOSSEN, nicht deployed.** `npx tsc --noEmit` sauber,
  `npm run lint` 0 Fehler (die eine bekannte `img`-Warnung in `app/admin`),
  `npm test` **130/130**. Alle sieben Punkte im laufenden Browser nachgemessen,
  nicht nur im Code geändert:
  - **Warenkorb:** ein Klick → `{"p1":1}`, Knopf danach deaktiviert
    („Bereits im Warenkorb"); drei weitere Klicks ändern nichts. Ein von Hand
    auf `{"p1":7,"p3":4}` gesetzter `sessionStorage` wird im Checkout auf je 1
    zurückgeschnitten (Summe 28,45 € statt 115 €).
  - **Galerie:** über sieben Kartenwechsel Bühne konstant 488 px, Titel 58 px,
    Beschreibung 62 px, und der Kaufknopf bleibt auf derselben Bildschirm-
    position — auch bei einer Karte ganz ohne Beschreibung und bei einem
    Titel, der über zwei Zeilen hinausgeht.
  - **Kopfleiste:** ab Scrollposition 400 fest bei `top:0`, der Versandhinweis
    darüber scrollt weg. Treffertest in der Leistenmitte liefert immer die
    Leiste — es scheint nichts durch.
  - **Werteleiste:** bei 375 px und 768 px kein waagerechter Überlauf mehr
    (vorher abgeschnitten), Umbruch auf zwei Zeilen.
- **Zwei Messbefunde, die eine Annahme widerlegt haben:**
  1. **Die Kopfleiste ist 164 px hoch, nicht die 110 px, die ich geschätzt
     hatte** — an den drei Breakpoints 164 / 150 / 116 px. Davon hängen der
     Sticky-Versatz von `.detail-media` und `scroll-padding-top` ab; mit dem
     Schätzwert wäre das Kartenbild beim Scrollen unter die Leiste gerutscht.
     Die Werte stehen jetzt als `--header-h` je Breakpoint im CSS, mit dem
     Hinweis, bei Änderungen an Logo oder Innenabstand neu zu messen.
  2. Die umgebrochene Werteleiste begann auf schmalen Geräten mit einem
     **einzelnen ✦** in der zweiten Zeile. Unter 500 px entfallen die Rauten
     deshalb ganz.
- **Nebenbefund, nicht behoben, betrifft jede frische Installation:**
  `npm ci` bricht die Installationsskripte ab (npm verlangt seit Neuestem eine
  Freigabe), dadurch bleibt `workerd` unvollständig und **`npm run dev` stürzt
  beim Start ab**. Sichtbar wird das als „The Workers runtime crashed
  unexpectedly". Abhilfe:
  `npm install-scripts approve workerd esbuild sharp unrs-resolver && npm rebuild`.
  Das schreibt ein Feld `allowScripts` in die `package.json`. **Bewusst nicht
  eingecheckt** — es erlaubt Installationsskripten dauerhaft die Ausführung und
  ist damit eine Entscheidung über die Lieferkette, die der Betreiber treffen
  sollte, nicht ein Nebeneffekt eines Oberflächenauftrags.
- **Ebenfalls zu wissen:** Der Worktree hatte kein eigenes `node_modules` und
  zog das des Hauptverzeichnisses, dessen `workerd` zu alt für das
  `compatibility_date` dieses Branches war. Erst `npm ci` im Worktree machte
  die lokale Vorschau überhaupt möglich.
- **Lokale Datenbank:** Für die Sichtprüfung wurden die Migrationen auf die
  **lokale** D1 angewandt und fünf Testkarten eingefügt (`--local`).
  **Produktionsdaten wurden nicht angefasst.**

### 2026-08-07 — Sechs Fehler in der Doku, gefunden beim Kaltlesen

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Die Dokumentation gegen sich selbst und gegen den Code prüfen. Anlass
  war eine reine Einarbeitungssitzung — der erste Leser, der die Unterlagen ohne
  Vorwissen las.
- **Vorbemerkung, die eigentliche Lehre des Durchlaufs:** Der Worktree, aus dem
  gelesen wurde, hing **48 Commits zurück**. `docs/ai-todo.md`,
  `docs/security-findings.md`, `docs/security-audit-brief.md` und rund 30
  Code-Dateien existierten dort schlicht nicht, und die eingelesene `CLAUDE.md`
  war die alte Fassung. Wer in einem Worktree arbeitet, prüft **vor** dem ersten
  Urteil `git rev-list --left-right --count HEAD...origin/agent/initial-brandycards`
  — sonst beurteilt er einen Stand, den es nicht mehr gibt.
- **Gefunden und korrigiert:**
  1. **Falscher Import-Takt.** „Offene Punkte" behauptete „Der Import läuft alle
     10 Minuten und ist belegt". Real: `0 */2 * * *` in `wrangler.toml`, und
     `ai-todo.md` dokumentiert die Rücknahme am selben Tag. Die Fassung hier war
     die falsche — und beschönigte ausgerechnet das Doppelverkaufsfenster.
     Korrigiert samt der Folgen (Fenster bis zu zwei Stunden, Reservierungen
     kommen nach 15–135 Minuten zurück).
  2. **Zwei gegensätzliche Empfehlungen zum eBay-Schreibpfad.** Hier und im
     Agentenprotokoll stand `EndItem`/`EndFixedPriceItem`, in `ai-todo.md`
     Punkt 6 ausdrücklich das Gegenteil (`ReviseInventoryStatus` mit Menge 0).
     `ai-todo.md` ist jetzt an beiden Stellen als maßgeblich gekennzeichnet.
  3. **Befundzahl.** Überall „17 Befunde / 16 von 17 geschlossen", tatsächlich
     **18** (SEC-01…SEC-18), geschlossen **17 von 18**. Ursache: SEC-18 kam nach
     Phase 1 dazu und wurde in den Summen nie nachgezogen. Die Statusübersicht in
     `security-findings.md` ist jetzt ausdrücklich die maßgebliche Quelle.
  4. **Veraltete Reservierungsfrist** im Agentenprotokoll („15–25 Minuten") —
     galt nur für den 10-Minuten-Takt, real 15–135 Minuten.
  5. **Free-Tarif als Begründung**, obwohl seit dem 2026-08-07 Workers Paid
     läuft. Stand noch in der SEC-05-Begründung in `ai-todo.md`.
  6. **Veraltete Deploy-Liste.** „Produktion ist aktuell. Fünf Deploys …"
     endete bei `0b25ae0f` — dabei kamen `2557ca3d`, `a1cdd14f` und `07da6e9b`
     erst danach. Der Eintrag nannte also ausgerechnet den zurückgenommenen
     Stand als den letzten.
- **Ergänzt, weil es in Punkt 6 fehlte:** „`ReviseInventoryStatus` ist
  umkehrbar" gilt nur, wenn im eBay-Konto die **Out-of-Stock-Option** aktiv ist.
  Ohne sie beendet eBay ein Festpreisangebot mit Menge 0 selbst — bei lauter
  Einzelstücken also immer, und dann ist der Weg genauso endgültig wie `EndItem`.
  Vor dem Bau über `GetUserPreferences` (`OutOfStockControlPreference`) prüfen.
- **Betroffen:** `docs/ai-handover.md`, `docs/ai-todo.md`,
  `docs/security-findings.md`, `docs/ai-agent-log.md`. **Kein Code, keine
  Datenbank, kein Deployment, kein eBay-Aufruf.**
- **Ergebnis:** Alle fünf Stellen korrigiert. Historische Einträge blieben
  stehen und haben nur dort eine Korrekturmarke bekommen, wo sie einen
  Kaltleser sonst in die Irre führen — ein Protokoll, das rückwirkend
  geglättet wird, verliert seinen Zweck.
- **Nicht geprüft, bewusst:** Ob die Zahlen aus den „Offenen Punkten" (296
  aktive Karten, `start_at`, letzter Sync-Lauf) noch stimmen. Lesende
  D1-Abfragen wären erlaubt gewesen, die Sitzung war aber als reine Lesearbeit
  am Code angelegt. **Wer als Nächstes hier ist, sollte das nachholen.**

### 2026-08-07 — Zeitgrenzen für eBay, und eine Sperre, die sich nicht verklemmt

- **Stand:** ABGESCHLOSSEN
- **Ziel:** Punkt 1 aus [ai-todo.md](ai-todo.md). Der Import blieb an diesem Tag
  dreimal auf `RUNNING` hängen; einmal über eine Stunde, bis von Hand
  eingegriffen wurde.
- **Diagnose zuerst, wie beauftragt — die vermutete Ursache stimmt nur zur
  Hälfte:**
  - **Bestätigt:** `lib/ebay-client.ts` setzte an keinem der fünf `fetch`-Aufrufe
    eine Zeitgrenze. Und `localSyncLock` wurde nur im `finally` eines `await`
    zurückgesetzt — kommt das `await` nie zurück, bleibt die Sperre für die
    Lebensdauer des Isolates gesetzt.
  - **Widerlegt:** Glied 3 der Kette („weil zusätzlich die Datenbankzeile auf
    `RUNNING` steht, verweigern auch andere Isolates den Start"). Die
    Produktionsdaten sagen etwas anderes. Der 04:00-Lauf wurde erst um 09:00
    freigegeben, der 11:50-Lauf erst um 12:30 — beide durch „Veralteter
    Sync-Lauf automatisch geschlossen", also durch genau den Aufräumcode, der
    laut Vermutung nie erreicht wird. Er *wird* erreicht, nur sporadisch: immer
    dann, wenn ein frisches Isolate an die Reihe kommt. Die Cron-Schläge
    dazwischen (05:00–08:00, 12:00–12:20) hinterließen keine Zeile — die
    Signatur eines Abbruchs **vor** dem `INSERT`. Der dauerhafte Blocker war
    also allein die Sperre im Isolate, nicht die Datenbankzeile. Die Korrektur
    daraus: Der Aufräumcode gehört **vor** die Sperrprüfung, nicht dahinter.
  - **Neu gefunden, unabhängig davon:** Die Veraltet-Prüfung
    `activeRun.startedAt < staleBefore` verglich `2026-08-07 13:20:40` aus
    SQLites `CURRENT_TIMESTAMP` mit ISO-8601 als Zeichenketten. An Stelle 10
    steht links ein Leerzeichen (0x20), rechts ein `T` (0x54) — der Vergleich
    war **unabhängig vom Alter immer wahr**. Jeder laufende Import galt als
    verwaist, auch ein drei Sekunden alter. Die 30-Minuten-Frist gab es nur auf
    dem Papier. Genau die Falle, vor der `lib/retention.ts` seit SEC-15 warnt.
  - **Nicht belegbar und deshalb nicht behauptet:** *welcher* `await` am
    2026-08-07 hängen blieb. Ein stehengebliebenes `db.batch` — 294 Stück je
    Lauf, ebenfalls unbegrenzt — oder ein von Cloudflare abgeräumter Aufruf
    erzeugt dieselbe Signatur. Zeitgrenzen an den `fetch`-Aufrufen sind daher
    **notwendig, aber nicht hinreichend**; der ganze Lauf braucht eine Frist.
- **Ergebnis:** Gebaut und deployed als Version `07da6e9b`.
  - `fetchWithTimeout` an allen fünf eBay-Aufrufen, 30 s, über
    `EBAY_FETCH_TIMEOUT_MS` übersteuerbar.
  - Neu `lib/sync-lock.ts` (netzfrei, ohne D1, damit prüfbar): `ExpiringLock`
    mit Verfallszeit statt Wahrheitswert, `isSyncRunStale` über
    `parseDbTimestamp`, `withDeadline` für den ganzen Lauf. Frist und
    Verfallszeit stehen bei 5 Minuten gegen einen Lauf von ~77 Sekunden.
  - `lib/ebay-sync.ts`: `releaseStaleSyncRuns()` läuft jetzt vor der
    Sperrprüfung.
  - `tests/ebay-sync-timeout.test.mjs`, 11 Tests, in `npm test` aufgenommen.
    Rot-Nachweis geführt: Ohne die Korrekturen laufen die drei `fetch`-Tests in
    ihr Zeitlimit („hängt", genau das Abnahmekriterium), und die Tests zur
    Zeitstempelfalle und zur verfallenden Sperre schlagen fehl.
  - Prüfkette grün: `npx tsc --noEmit` sauber, `npm run lint` 0 Fehler (die
    bekannte `img`-Warnung), `npm test` 130/130, Bundle-Probe bestanden,
    `/admin`, `/account` und `/` nach dem Deploy mit 200 und ohne
    „Supabase ist noch nicht konfiguriert".
  - **Cron unverändert** bei `0 */2 * * *`. Beschleunigung erst nach Punkt 2.
- **Noch nicht gesehen:** ein echter Lauf unter dem neuen Code. Deploy war um
  15:1x UTC, der nächste Cron-Schlag um 16:00 UTC. Beim nächsten Arbeitsschritt
  nachsehen: `SELECT started_at, status, updated_count FROM sync_runs ORDER BY
  started_at DESC LIMIT 3`.

### 2026-08-07 — Sync-Takt, D1-Budget und ein hängengebliebener Lauf

- **Stand:** ABGESCHLOSSEN

**Anlass:** Der Betreiber fragte, ob der Sync statt alle 10 auch alle 5 oder 3
Minuten laufen kann. Beim Nachrechnen kam heraus, dass schon der
10-Minuten-Takt ein Fehler war — **meiner, von heute Vormittag.**

**Gemessen mit `wrangler d1 insights`, letzte 24 h:**

| | |
|---|---|
| geschriebene Zeilen | **115 026** |
| Sync-Läufe darin | ~27 (also im Wesentlichen stündlich) |
| Kosten je Lauf | **~5 396 Zeilen** |

Hochgerechnet gegen das dokumentierte Free-Budget von **100 000 geschriebenen
Zeilen pro Tag**:

| Takt | Läufe/Tag | Zeilen/Tag | Anteil |
|---|---|---|---|
| stündlich | 24 | 102 000 | **102 %** |
| alle 10 Min *(heute deployed)* | 144 | 613 000 | **613 %** |
| alle 5 Min | 288 | 1 227 000 | 1227 % |
| alle 3 Min | 480 | 2 045 000 | 2045 % |

**Was ich heute früh falsch gemacht habe:** Ich habe das eBay-Kontingent
nachgerechnet (3 Aufrufe je Lauf, unkritisch) und die Laufzeit gemessen (77 s),
aber **das D1-Schreibbudget nicht angesehen** — obwohl der Free-Tarif am selben
Tag als Begründung für die Hochstufung von SEC-05 diente. Der Fehler war,
*eine* Ressourcengrenze zu prüfen und daraus „unkritisch" zu schließen.

**Warum ein Lauf so teuer ist:** D1 zählt **Indexschreibvorgänge mit**. Ein
`update products` kostet laut Messung 3 Zeilen, ein `update ebay_listings` 5.
Vor allem aber schreibt der Sync **jedes Mal alles neu**, auch wenn sich nichts
geändert hat — 294 Listings mal Produkt, Listing, Bestand, alle Bilder gelöscht
und neu eingefügt, plus ein `sync_event` je Listing. Die vier teuersten
Abfragen der letzten 24 h:

```
31 692  insert sync_events      (ein Ereignis je Listing je Lauf, meist "UPDATED" ohne Änderung)
26 085  update ebay_listings
25 491  update products
18 048  insert product_assets   (jedes Bild jedes Mal geloescht und neu eingefuegt)
```

**Schritt 1 (dieser Eintrag): Cron sofort zurück auf stündlich.** Nicht die
Lösung, aber es stoppt das Ausbluten. Das Risiko ist heute klein, weil die
Bestandsprüfung vor der Zahlung (heute gebaut) den entscheidenden Moment
ohnehin absichert und der Shop noch keine echten Kunden hat.

**Schritt 2 (danach, die eigentliche Arbeit): Der Sync darf nur schreiben, was
sich geändert hat.** Dann kostet ein Lauf im Normalfall nahe null Zeilen, und
**3 Minuten wären problemlos möglich.** Dasselbe Muster wie bei SEC-09.
Zusätzlich: `sync_events` nur noch bei echten Ereignissen schreiben, nicht bei
jedem unveränderten Listing — die Tabelle wächst sonst um ~42 000 Zeilen/Tag.

**Unsicherheit, ausdrücklich:** Die 100 000 sind der dokumentierte Free-Wert,
nicht der im Dashboard abgelesene. Der Betreiber sollte ihn unter *Workers &
Pages → D1 → brandycards-production → Metrics* bestätigen. Am Verhältnis
ändert das nichts: 10 Minuten sind das Sechsfache von stündlich.

**Ergebnis: ABGESCHLOSSEN — mit einer Korrektur an mir selbst.**

**Meine Diagnose war teilweise falsch.** Ich schloss aus „der Aufräumvorgang
schreibt nicht" auf „das D1-Schreibbudget ist erschöpft". Ein Testschreibvorgang
lief anschließend anstandslos durch (`changes: 1`) — das Budget war **nicht**
erschöpft. Der Import stand aus einem anderen Grund; die wahrscheinliche
Ursache (fehlende Zeitgrenzen im eBay-Client) ist jetzt Punkt 1 in
[ai-todo.md](ai-todo.md).

Was davon **richtig** bleibt und gemessen ist:
- Ein Sync-Lauf schreibt **~5 396 D1-Zeilen**. Bei 14 Läufen wurden 4 116
  Aktualisierungen geschrieben, davon waren **2** echte Änderungen —
  **99,95 % ohne Wirkung.**
- `raw_data` ist deterministisch (`{"source":"trading-api","marketplaceId":…,
  "itemId":…}`, kein Zeitstempel), `shipping_data` wird nie geschrieben. Die
  Stelle, an der ein Änderungsvergleich hätte scheitern können, ist damit
  ausgeräumt: Nur `last_synced_at` und `updated_at` müssen ausgeklammert werden.
- Der Cron steht auf `0 */2 * * *` (Version `2557ca3d`, 14:31 UTC).

**Der Betreiber ist danach auf Workers Paid gewechselt.** Damit ist der
Notbehelf keine Notwendigkeit mehr, sondern nur noch eine Kostenfrage —
Einzelheiten unter „Offene Punkte" und in Punkt 2 der Aufgabenliste.

Deployed als Version `2557ca3d`, `schedule: 0 */2 * * *` im Protokoll bestätigt.
**Zweistündlich, nicht stündlich** — beim Schreiben des Tests kam heraus, dass
auch stündlich mit 102 % schon über dem Budget lag. Zweistündlich sind 51 %
und lassen Platz für die Schreibvorgänge echter Bestellungen.

`tests/ebay-stock-check.test.mjs` enthält jetzt einen Test, der den Cron gegen
das Budget rechnet. Gegenprobe gemacht: Er lehnt `0 * * * *`, `*/10 * * * *`
und `*/3 * * * *` ab und lässt `0 */2 * * *` durch. Er ist bewusst kein Verbot
schneller Takte, sondern eine **Kopplung**: Wer beschleunigen will, muss zuerst
`ZEILEN_JE_LAUF` senken — und das geht nur, indem der Lauf wirklich billiger
wird.

`npm test` 119 Tests grün, `tsc` sauber, Lint 0 Fehler.

**Schritt 2 ist die eigentliche Arbeit und steht als Punkt 1 in
[ai-todo.md](ai-todo.md):** Der Sync darf nur schreiben, was sich geändert hat.
Er kostet heute ~5 396 Zeilen je Lauf, obwohl sich zwischen zwei Läufen fast
nie etwas ändert — 294 Listings werden samt Produkt, Bestand und **allen
Bildern** gelöscht und neu eingefügt, plus ein `sync_event` je Listing. Danach
kostet ein Lauf im Normalfall nahe null, und die ursprünglich gewünschten drei
Minuten sind problemlos.

**Der Betreiber wollte eigentlich mit den Kunden-E-Mails weitermachen.** Diese
Sache kam dazwischen, weil sie zeitkritisch war — der 10-Minuten-Takt hätte das
Tagesbudget noch heute Abend aufgebraucht, und dann scheitern auch die
Schreibvorgänge echter Bestellungen.


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
Punkt 3a in [ai-todo.md](ai-todo.md).

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
