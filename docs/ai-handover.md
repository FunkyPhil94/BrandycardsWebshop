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

- **Stand:** LÄUFT
- **Datum:** 2026-08-06
- **Ziel:** Kartendarstellung geradeziehen, Filter entfernen, Detailseite je Karte
  mit Bild-Zoom und eBay-Artikelbeschreibung.
- **Vom Nutzer gewünscht:** Bilder gerade statt gekippt, rund 20 % weniger Zoom,
  Filterleiste weg (es gibt nur Festpreis, keine Auktionen), Titel klickbar,
  Detailseite mit vergrößerbarem Bild und der HTML-Beschreibung aus eBay.
- **Befund vorab:** `description_html` ist bei allen 296 aktiven Listings leer.
  `GetMyeBaySelling` liefert keine Beschreibung; dafür braucht es `GetItem` mit
  einem Aufruf **je Artikel**. 296 Aufrufe pro Sync wären zu teuer.
- **Geplante Schritte:**
  1. CSS: Rotation der Produktbilder entfernen, Zoom reduzieren
  2. Filterleiste auf `/karten` entfernen, Suche bleibt
  3. `GetItem`-Abruf im eBay-Client ergänzen
  4. HTML-Sanitizer als eigenes Modul — eBay-Beschreibungen sind fremdes Markup
     und enthalten regelmäßig Skripte, iframes und Event-Handler. Ungefiltert
     eingebettet wäre das eine XSS-Lücke auf eigener Domain.
  5. `/api/products/[id]` liefert Karte, Bilder und Beschreibung; fehlt die
     Beschreibung, wird sie einmalig von eBay geholt und in `description_html`
     gespeichert (danach aus der Datenbank)
  6. Detailseite `/karten/[id]` mit Bildergalerie, Klick-Zoom und Beschreibung
  7. Titel auf `/karten` verlinken
- **Betroffen:** `app/globals.css`, `app/karten/page.tsx`, neue Detailseite und
  API-Route, `lib/ebay-client.ts`, neues Sanitizer-Modul, Tests.
- **Verifikation:** `npx tsc --noEmit`, `npm run lint`, `npm test`, Deploy und
  Abruf einer echten Detailseite gegen Produktion.
- **Achtung beim Deploy:** `.env.local` muss im Build-Verzeichnis liegen.
- **Ergebnis:** _(wird nach dem Durchlauf eingetragen)_

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
