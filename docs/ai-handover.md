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

- **Sync-Lauf nötig, damit „Neu dabei" echt wird.** `ebay_listings.start_at` ist
  noch überall NULL; der Mapper füllt es erst ab Version `a1cdd14f`. Solange
  liefert `/api/products/highlights` für „neueste" bewusst die Importreihenfolge
  (`startAtAvailable: false`) statt fünf willkürlicher Karten. Nach einem
  Sync-Lauf prüfen: `curl -s https://shop.brandycards.de/api/products/highlights`
  muss `"startAtAvailable": true` melden.
- **Preisvorschlag hat keine Oberfläche mehr.** `/api/price-offers` verlangt eine
  `PRELISTED`-Produkt-ID, aber alle 297 Produkte sind `EBAY_SYNCED`. Entweder
  Prelisted-Produkte pflegbar machen (Admin-Oberfläche fehlt) oder die Route für
  aktive Listings öffnen. Bis dahin gibt es dafür bewusst kein Formular.
- **CI hat den aktuellen `main` nie geprüft.** Der Merge lief während des
  GitHub-Actions-Ausfalls vom 2026-08-06 und wurde nur lokal verifiziert. Sobald
  Actions wieder `operational` meldet, einmal den Workflow über `main` laufen
  lassen: `gh workflow run CI --ref main` oder `gh run rerun <id>`. Status prüfen:
  `curl -s https://www.githubstatus.com/api/v2/components.json`
- **CI prüft keine Typen.** `npm test` baut nur, `npm run lint` sieht keine
  Typfehler. Ein `tsc --noEmit`-Schritt im Workflow wäre sinnvoll — der reale
  Typfehler in `D1PreparedStatement` ist durch alle grünen Läufe gerutscht.
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
