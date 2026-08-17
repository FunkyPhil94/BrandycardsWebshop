# BrandyCards Webshop

Selbst gebauter Shop für Fußball-Sammelkarten. vinext (Next.js 16 / React 19) auf
Cloudflare Workers, D1 als Datenbank, R2 für Uploads, Supabase für die
Kundenauthentifizierung, PayPal für Zahlungen, eBay als Warenquelle.
Produktion: `shop.brandycards.de`.

## Pflicht: Übergabeprotokoll führen

**Vor** dem ersten schreibenden oder ausführenden Schritt eines Auftrags wird das
Vorhaben in [docs/ai-handover.md](docs/ai-handover.md) eingetragen — vorher, nicht
danach. **Nach** dem Durchlauf wird das Ergebnis nachgetragen, **auch bei
Fehlschlag oder Abbruch**.

Grund: Endet eine Sitzung mitten in der Arbeit — aufgebrauchtes Token-Kontingent,
abgebrochene Verbindung, hängendes Werkzeug — muss die nächste KI ohne Rückfragen
sehen, was geplant war und was dadurch halbfertig liegen geblieben ist.

Steht dort ein Eintrag auf `LÄUFT`, gilt der Auftrag als unterbrochen: erst den
tatsächlichen Zustand prüfen (`git status`, `git log`, Deployment, Datenbank) und
das Ergebnis nachtragen, dann neue Arbeit beginnen.

Reine Lesearbeit braucht keinen Eintrag. Sobald Dateien, Datenbank, Deployment
oder Fremdsysteme berührt werden, braucht sie einen.

Die fachliche Begründung einer Lösung gehört zusätzlich in
[docs/ai-agent-log.md](docs/ai-agent-log.md) — dort steht das *Warum*, im
Übergabeprotokoll das *Was gerade läuft*.

## Woran als Nächstes gearbeitet wird

Der Arbeitsvorrat steht in [docs/ai-todo.md](docs/ai-todo.md), von oben nach
unten sortiert. Fragt der Nutzer offen „was steht an?" oder bittet um den
nächsten Schritt, ist das die Quelle. Jede Aufgabe ist selbsttragend
beschrieben — Dateien, Begründung und Abnahmekriterien stehen dabei.

**Am Ende jeder Sitzung** darf nichts unversioniert liegen bleiben:
`git status --short` und `git log --oneline origin/agent/initial-brandycards..HEAD`
müssen beide leer sein.

## Befehle

```bash
npm run dev          # lokale Entwicklung
npm run build        # Produktions-Build nach dist/
npm test             # Build + alle Tests
npm run lint         # ESLint
npx tsc --noEmit     # Typprüfung -- NICHT Teil von npm test, separat ausführen
```

## Fallen, die schon zugeschlagen haben

- **Build braucht `.env.local` im Build-Verzeichnis.** `NEXT_PUBLIC_SUPABASE_*`
  wird zur Buildzeit ins Client-Bundle eingebacken, nicht zur Laufzeit gelesen.
  Ohne die Datei brechen `/admin` und `/account` mit „Supabase ist noch nicht
  konfiguriert" ab, während Startseite und `/api/*` gesund aussehen. Cloudflare-
  Secrets helfen nicht, sie erreichen nur den Worker. **Git-Worktrees erben die
  ignorierte Datei nicht** — genau so ging schon ein Deploy schief.
  Nach dem Build prüfen: `grep -rl "supabase.co" dist/client/assets`
- **Ein Deploy ist erst verifiziert, wenn eine Seite geprüft wurde, die
  Client-Konfiguration braucht.** `/` und `/api/products` waren durchgehend
  gesund, während `/admin` kaputt war.
- **D1 begrenzt gebundene Parameter pro Statement.** Sammel-Inserts kosten einen
  Parameter je Zeile *und* Spalte. Grenzen stehen in `lib/d1-limits.ts` und
  werden von `tests/d1-limits.test.mjs` an echtem SQL gemessen — nicht schätzen.
- **`npm test` prüft keine Typen.** Es baut nur, und `npm run lint` sieht keine
  Typfehler. `npx tsc --noEmit` gehört deshalb vor jeden Commit — lokal, denn
  lokal merkt man es Sekunden später statt im Pull Request.
  *(Die CI prüft Typen inzwischen sehr wohl: `.github/workflows/ci.yml` hat seit
  SEC-14 einen Schritt `Type check` und auditiert zusätzlich. Diese Stelle
  behauptete bis zum 2026-08-09 das Gegenteil. Der Rat bleibt derselbe, die
  Begründung ist eine andere.)*
- **Der erste Build nach einer neuen Route liefert sie nicht aus.** Am
  2026-08-17 zweimal hintereinander erlebt, mit identischem Quellstand: Nach dem
  Anlegen neuer Seitenverzeichnisse listet `npm run build` die Routen zwar in
  seiner Tabelle auf, der daraus ausgerollte Worker antwortet auf die zuletzt
  hinzugekommenen aber mit **404**. Ein zweiter Build und Deploy — ohne jede
  Änderung am Code — liefert sie dann aus. Die Ursache ist nicht geklärt, das
  Verhalten ist es. **Nach jedem Deploy mit neuen Routen jede neue Adresse
  einzeln abfragen**, ein 404 heißt hier „nochmal bauen", nicht „Code kaputt".
- **`npx wrangler r2 object delete` meldet Erfolg und löscht nichts.** Die
  OAuth-Anmeldung der CLI trägt **keinen R2-Bereich** (`npx wrangler whoami`
  zeigt `d1 (write)`, `workers (write)` … aber nichts für R2). Die CLI prüft das
  nicht und schreibt trotzdem „Delete complete." — am 2026-08-17 fünfmal
  hintereinander, während die Objekte nachweislich liegen blieben. Lesen
  (`r2 object get`) funktioniert, das täuscht zusätzlich. **Nach jedem
  R2-Schreibvorgang gegenprüfen:** `npx wrangler r2 bucket info <bucket>` oder
  das Objekt erneut holen. Wirklich löschen kann nur der Worker über seine
  Bindung — also die Anwendung selbst oder der geplante Waisen-Aufräumer in
  `lib/card-submission-cleanup.ts` (Karenz: 24 Stunden).
- **`drizzle/meta/_journal.json` ist veraltet** (endet bei `0002`, während
  `0003`–`0008` handgeschrieben dazukamen). `npm run db:generate` würde gegen den
  alten Snapshot diffen und die Migrationen erneut erzeugen.

## Deployment

Schrittfolge steht in der [README](README.md) unter „Before the first production
deployment". Kurz: bauen (mit `.env.local`!), `npx wrangler deploy`. Secrets
liegen als Cloudflare-Secrets und gehören niemals in `wrangler.toml`, `.env.example`
oder ins Repository.

## Produktionsdaten

D1 lässt sich lesend abfragen — das ist beim Diagnostizieren oft der schnellste Weg
zur Wahrheit:

```bash
npx wrangler d1 execute brandycards-production --remote --json --command "SELECT ..."
```

Schreibende Eingriffe in Produktionsdaten nur nach ausdrücklicher Rücksprache.
