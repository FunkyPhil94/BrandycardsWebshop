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
- **Ziel:** Startseite entschlacken. Bisher liegt der gesamte Shop-Inhalt auf
  `/`. Künftig trägt die Landingpage nur Hero, eine Galerie mit genau 5 Karten,
  Verweise auf Unterseiten und den Footer.
- **Vom Nutzer entschieden:**
  - „Neueste" soll auf dem echten eBay-Einstelldatum beruhen, nicht auf dem
    Importdatum. Grund: alle 297 Karten wurden am selben Tag importiert,
    `start_at` ist durchgehend NULL — „neueste" wäre sonst willkürlich.
  - Aufteilung in `/karten`, `/anfragen`, `/verkaufen`, `/ueber-uns`.
  - Galerie: Klick auf die Bildfläche blättert weiter; Titel und ein Button
    darunter führen zum Angebot.
- **Geplante Schritte:**
  1. Sync-Mapper um `ListingDetails/StartTime` erweitern, `start_at` füllen
     (Spalte existiert bereits, keine Migration nötig)
  2. `/api/products/highlights` liefert 5 neueste (nach `start_at`) und
     5 teuerste (nach `price_amount_cents`)
  3. Geteilte `SiteHeader`/`SiteFooter` samt Warenkorb-Hook auslagern
  4. Neue Seiten `/karten`, `/anfragen`, `/verkaufen`, `/ueber-uns`
  5. Landingpage auf Hero + Galerie + Verweise + Footer reduzieren
  6. Galerie: 2-Sekunden-Takt, Pause bei Hover/Fokus, `prefers-reduced-motion`
     respektieren, Umschalter „Neu" / „Beliebt"
  7. CSS ergänzen, Tests, lokale Prüfung, Deploy
- **Betroffen:** `app/page.tsx`, neue Seiten unter `app/`, `app/globals.css`,
  `lib/ebay-client.ts`, `lib/ebay-sync.ts`, neue API-Route, Tests.
- **Verifikation:** `npx tsc --noEmit`, `npm run lint`, `npm test`, danach Deploy
  und Sichtprüfung der neuen Seiten.
- **Achtung beim Deploy:** `.env.local` muss im Build-Verzeichnis liegen.
- **Nach dem Deploy nötig:** ein Sync-Lauf, damit `start_at` befüllt wird.
  Vorher zeigt die Ansicht „Neu" nichts bzw. fällt auf das Importdatum zurück.
- **Ergebnis:** _(wird nach dem Durchlauf eingetragen)_

---

## Offene Punkte

Kein Auftrag, sondern der Zustand, den die nächste Sitzung kennen muss.

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
