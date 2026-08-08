# Offene Aufgaben

Arbeitsvorrat für kommende KI-Sitzungen. **Von oben nach unten abarbeiten.**

**Vor jedem Punkt:** Eintrag in [ai-handover.md](ai-handover.md) anlegen (Regel in
[CLAUDE.md](../CLAUDE.md)). **Nach jedem Punkt:** Ergebnis nachtragen, committen,
pushen, Punkt nach unten unter „Erledigt" verschieben.

Jede Aufgabe steht für sich — Dateien, Begründung und Abnahmekriterien stehen
dabei, damit niemand den Gesprächsverlauf braucht.

---

## Warum diese Reihenfolge

**Stand 2026-08-08:** Die Punkte 0 bis 5 sind allesamt erledigt und deployed —
PayPal steht auf Live und hat echtes Geld eingenommen, der Sync schreibt nur
noch Änderungen, die Kunden-E-Mails sind scharf, die Sicherheitskorrekturen
samt CSP ohne `'unsafe-inline'` sind in Produktion, und der Checkout zeigt den
ausgehandelten Preis. **Punkt 6 (eBay-Schreibpfad) ist seit dem 2026-08-08
gebaut und deployed, aber nicht abgenommen** — der Schalter steht noch auf
`false`, und der Nachweis an einer Testkarte fehlt. **Der nächste ungebaute
Punkt dieser Liste ist Punkt 7.**

**Seit 2026-08-07 läuft das Projekt auf Workers Paid (5 $/Monat).** Damit sind
die harten Tagesdeckel weg (D1 wird nach Verbrauch abgerechnet), `Email
Sending` steht zur Verfügung, und die Grenze von 50 Unteranfragen je Anfrage
ist auf 10 000 gestiegen. Das entschärft mehrere Punkte unten — es macht sie
aber nicht überflüssig, siehe Punkt 2.

Drei Überlegungen bestimmen die Reihenfolge:

1. **Der Import ist unzuverlässig, und das ist schlimmer als langsam.** Am
   2026-08-07 blieb ein Lauf hängen und legte den Import über eine Stunde
   still, bis jemand von Hand eingriff. Ein Bestand, der stillschweigend
   veraltet, ist gefährlicher als einer, der langsam aktualisiert wird — man
   merkt es nicht. Deshalb steht Punkt 1 ganz oben.
2. **Der Shop konnte bis zum 2026-08-07 niemandem verkaufen.** Der Checkout
   verlangt ein Konto, ein Konto verlangt eine bestätigte E-Mail-Adresse — und
   die Bestätigungslinks zeigten auf `localhost` (SEC-18). **Diese Kette ist
   seit dem 2026-08-08 vollständig durchgespielt:** Der Abnahmekauf
   `BC-20260808-89309FCA` lief auf `PAID`, und die Bestellbestätigung kam an.
   Der Kaufweg steht — offen ist an ihm nur noch die **Verkäufernachricht**
   (Punkt 3), die auf den nächsten echten Kauf zum Beleg wartet.
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

## 0. ~~PayPal auf Live umstellen~~ — UMGESETZT am 2026-08-08, Abnahme steht aus

Der Betreiber hat Live-App, Live-Webhook auf
`https://shop.brandycards.de/api/paypal/webhook` und die drei Secrets
eingerichtet; `PAYPAL_ENVIRONMENT = "production"` steht in `[vars]`, deployed
als Version `4a6b7a46`. `wrangler deploy` bestätigt die Bindung, und der Webhook
antwortet mit 400 statt 503 — die Webhook-ID liegt also vor.

**Ein Test hält den Wert jetzt fest** (`tests/hardening.test.mjs`). Der Grund:
`lib/paypal/config.ts` fällt bei fehlendem Wert **still** auf `sandbox` zurück,
und genau dieser Zustand blieb vom 2026-08-06 bis zum 2026-08-08 unbemerkt —
der Shop sah gesund aus und konnte kein Geld einnehmen.

**✅ ABGENOMMEN am 2026-08-08:** Bestellung `BC-20260808-89309FCA` über 3,46 €
(1 Cent Ware + 3,45 € Versand) steht auf `PAID`, die Zahlung auf `CAPTURED` mit
Capture-ID `1LC23949C0153504L`, der Bestand auf `SOLD`, die Webhook-Zeile auf
`PROCESSED`, und die Bestellbestätigung ist angekommen. **Der Shop nimmt echtes
Geld ein.**

PayPal hat dabei **0,49 € Transaktionsgebühr** einbehalten (2,97 € netto von
3,46 €). Das entspricht 2,99 % + 0,39 € und trifft bei kleinen Beträgen
überproportional — bei einer 5-€-Karte bleiben rund 4,46 €. **Vor dem
Verkaufsstart einmal durchrechnen**, ob Versandpauschale und Mindestpreis das
tragen.

<details><summary>Ursprünglicher Eintrag, zur Nachvollziehbarkeit</summary>

### PayPal auf Live umstellen — SCHLÄGT ALLES ANDERE

**Aufwand:** klein · **Hängt an:** einer Handlung des Betreibers ·
**Blockiert:** jeden Verkauf

**Warum ganz oben, vor allem anderen:** `PAYPAL_ENVIRONMENT` ist **nirgends
gesetzt** — weder in `[vars]` der `wrangler.toml` noch als Secret.
`lib/paypal/config.ts` fällt damit auf `sandbox` zurück, und der Shop spricht
mit `api-m.sandbox.paypal.com`. **Ein echter Kunde kann nicht bezahlen.**

Alle anderen Punkte dieser Liste verbessern einen Shop, der nichts einnehmen
kann. Am 2026-08-08 beim Testkauf gefunden.

**Was der Betreiber tun muss (die KI kann es nicht):**
1. Auf `developer.paypal.com` eine **Live**-App anlegen → Live Client ID und
   Secret
2. Einen **Live**-Webhook auf `https://shop.brandycards.de/api/paypal/webhook`
   → Webhook-ID
3. Die drei Secrets ersetzen: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
   `PAYPAL_WEBHOOK_ID`

**Was die KI tut, sobald 1–3 gemeldet sind:**
`PAYPAL_ENVIRONMENT = "production"` in `[vars]` der `wrangler.toml` eintragen.
**Das ist kein Geheimnis** und gehört nicht zu den Secrets. Danach deployen.

**Unbekannt und nur vom Betreiber zu beantworten:** ob die *heute*
hinterlegten `PAYPAL_CLIENT_ID`/`SECRET` Sandbox- oder Live-Daten sind.
Secrets lassen sich nur dem Namen nach auflisten.

**Fertig, wenn:** Ein echter Kauf über einen kleinen Betrag geht durch, die
Bestellung steht auf `PAID`, und die Bestellbestätigung kommt an. Danach
erstatten. Der Weg ist am 2026-08-08 in der Sandbox vollständig
durchgespielt worden — der Code-Pfad ist derselbe, nur der Endpunkt
unterscheidet sich.

</details>

---

## 1. ~~Zeitgrenzen für eBay, und eine Sperre, die sich nicht verklemmt~~ — ERLEDIGT am 2026-08-07

Deployed als Version `07da6e9b`. Die vermutete Ursachenkette stimmte in den
ersten beiden Gliedern und war im dritten falsch; dazu kam ein unabhängiger
Fehler in der Veraltet-Prüfung. Diagnose und Belege stehen in
[ai-agent-log.md](ai-agent-log.md), der Durchlauf in
[ai-handover.md](ai-handover.md) unter Historie.

Kurz: `fetchWithTimeout` an allen fünf eBay-Aufrufen; neues Modul
`lib/sync-lock.ts` mit Sperre auf Verfallszeit, `isSyncRunStale` über
`parseDbTimestamp` und `withDeadline` für den ganzen Lauf; der Aufräumcode für
verwaiste `sync_runs`-Zeilen läuft jetzt **vor** der Sperrprüfung.
11 Tests in `tests/ebay-sync-timeout.test.mjs`, Rot-Nachweis geführt.

<details><summary>Ursprünglicher Eintrag, zur Nachvollziehbarkeit</summary>

**Aufwand:** klein · **Hängt an:** nichts · **Blockiert:** die Verlässlichkeit
jedes Imports

**Warum:** Am 2026-08-07 blieb der Sync-Lauf von 13:20 auf `RUNNING` hängen und
**kein einziger weiterer Lauf startete danach** — über eine Stunde lang, obwohl
der Cron alle 10 Minuten feuerte. Dasselbe Muster gab es an dem Tag schon um
04:00 und vor 11:50 („Veralteter Sync-Lauf automatisch geschlossen").

**Die wahrscheinliche Ursache — bitte zuerst bestätigen, nicht annehmen:**

`lib/ebay-client.ts` setzt an **keinem einzigen** `fetch` eine Zeitgrenze.
`lib/paypal/client.ts` daneben hat an jedem Aufruf `AbortSignal.timeout(10_000)`.
Bleibt eine eBay-Antwort aus, wartet der Lauf **unbegrenzt**. Dann greift die
Kette:

1. `localSyncLock` in `lib/ebay-sync.ts` wird nie zurückgesetzt, weil `finally`
   nie erreicht wird.
2. Jeder weitere Lauf **im selben Isolate** bricht sofort mit „läuft bereits"
   ab — und erreicht damit den Aufräumcode gar nicht, der verwaiste Läufe nach
   30 Minuten schließt.
3. Weil zusätzlich die Datenbankzeile auf `RUNNING` steht, verweigern auch
   andere Isolates den Start (`INSERT … WHERE NOT EXISTS (… RUNNING)`).

Ein einziger hängender Aufruf legt den Import also **dauerhaft** still, bis
jemand von Hand eingreift. Genau das war am 2026-08-07 nötig.

**Wie:**
- `fetchWithTimeout` nach dem Vorbild von `lib/paypal/client.ts` in
  `lib/ebay-client.ts` einführen und an **jedem** Aufruf verwenden:
  `getAccessToken`, `getActiveEbayListings`, `getEbayItemDescription`,
  `getEbayAvailability`, `withdrawEbayOffer`. Für den Import darf die Grenze
  großzügiger sein als die 10 s bei PayPal — ein Lauf dauert rund 77 Sekunden
  über mehrere Aufrufe —, aber sie muss existieren.
- Die Sperre so bauen, dass ein abgestürzter Lauf sie nicht dauerhaft hält.
  Ein Zeitstempel statt eines Wahrheitswerts genügt: Ist die Sperre älter als
  ein Lauf dauern darf, gilt sie als verfallen.
- **Wichtig:** Der Aufräumcode für verwaiste Datenbankzeilen muss laufen,
  *bevor* die Sperre den Lauf abweisen kann — heute steht er dahinter und wird
  im Fehlerfall nie erreicht.
- Beim Vergleich `activeRun.startedAt < staleBefore` die Zeitstempelfalle
  beachten: `started_at` kommt aus SQLites `CURRENT_TIMESTAMP` im Format
  `YYYY-MM-DD HH:MM:SS`, `staleBefore` ist ISO-8601 mit `T` und `Z`. Roh
  verglichen sortiert `' '` vor `'T'`. `lib/retention.ts` zeigt, wie es richtig
  geht.

**Fertig, wenn:** Ein Test stellt eine nicht antwortende eBay-API nach (mit
gestubbtem `fetch`, wie in `tests/ebay-availability.test.mjs`) und belegt, dass
der Lauf mit einem Fehler endet statt zu hängen — und dass der **nächste** Lauf
danach wieder startet. Ohne die Korrektur muss der Test hängen bzw. rot sein.

</details>

---

## 2. ~~Der Sync darf nur schreiben, was sich geändert hat~~ — ERLEDIGT am 2026-08-08

Deployed als Version `6f33f7f1`. **An der Produktion gemessen:** Der Lauf um
08:00 UTC meldet **0 aktualisiert** und schreibt **einen** `sync_events`-Eintrag
(die Deaktivierung des Testartikels); die vier Läufe davor meldeten je 294 und
294–295. Der Katalog blieb unversehrt — 294 Produkte, 294 Listings, 302 Bilder.

Der Vergleich stellt gegenüber, was geschrieben würde, und was schon dasteht
(`lib/ebay-sync-diff.ts`); bleibt keine Anweisung übrig, entfällt der Batch.

**Zwei Dinge sind bewusst noch nicht gemacht und gehören zusammen:**
`ZEILEN_JE_LAUF` in `tests/ebay-stock-check.test.mjs` steht weiter auf 5 396,
und der Cron bleibt bei `0 */2 * * *`. Beides sollte auf Grundlage der
**Tageszahlen ab 2026-08-09** angepasst werden — `wrangler d1 insights
--timePeriod 1d --limit 100` enthält bis dahin noch Läufe von vor dem Deploy.
Erst dann darf der Takt beschleunigt werden; der Test dort erzwingt die
Reihenfolge.

<details><summary>Ursprünglicher Eintrag, zur Nachvollziehbarkeit</summary>

### Der Sync darf nur schreiben, was sich geändert hat

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

**Seit dem Wechsel auf Workers Paid ist das kein Ausfallrisiko mehr, sondern
eine Rechnung.** Die Aufgabe bleibt trotzdem, und zwar aus zwei Gründen:

| bei 3-Minuten-Takt | Schreibvorgänge/Monat | Kosten auf Paid |
|---|---|---|
| Sync wie jetzt | ~78 Mio. | 5 $ + **~28 $** |
| Sync nach der Korrektur | ~86 000 | 5 $ + **0 $** |

Rund **28 $ im Monat, dauerhaft**, dafür dass 99,95 % der Schreibvorgänge
nichts bewirken. Und ohne die Korrektur bleibt der Takt bei zwei Stunden,
weil die Kosten sonst mit jeder Beschleunigung linear mitwachsen.

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

</details>

---

## 3. ~~Kunden-E-Mails~~ — ERLEDIGT am 2026-08-08, scharf und echt zugestellt

Alle fünf Anlässe sind gebaut und verdrahtet: Bestellbestätigung,
Preisvorschlag angenommen, Preisvorschlag abgelehnt, Eingangsbestätigung für
Anfrage und für Kartenankauf. Anbieter ist Resend, die Wortlaute stehen als
reine Funktionen in `lib/email/templates.ts` und sind ohne Versand prüfbar
(20 Tests in `tests/email.test.mjs`).

**Der Versand ist scharf.** Die Domain `brandycards.de` ist bei Resend
verifiziert (TLS auf `Enforced`), `RESEND_API_KEY` liegt als Cloudflare-Secret.
**Zwei Anlässe sind durch echte Zustellung belegt**, nicht nur durch Tests: die
Eingangsbestätigung einer Anfrage (2026-08-08, 05:45 UTC) und die
Bestellbestätigung aus dem Abnahmekauf `BC-20260808-89309FCA`. Die übrigen drei
sind durch Tests abgedeckt.

> **Diese Überschrift lautete bis zum 2026-08-08 „wartet auf den Schlüssel"** —
> vier Tage, nachdem der Schlüssel lag und Nachrichten ankamen. Wer nur diese
> Datei las, hielt den offensichtlichsten nächsten Schritt für offen. Beim
> Abhaken gehört der Kopf der Aufgabe mitgezogen, nicht nur der Rumpf.

**Ein Rest bleibt, und er ist klein, aber ungeprüft:** Die
**Verkäufernachricht** an `brandycards@gmx.de` mit der Lieferadresse ist erst
seit dem 2026-08-08 gebaut und **nur durch Tests belegt**. Ob sie ankommt und
die Adresse trägt, zeigt erst der nächste echte Kauf.

Begründung der Bauweise in [ai-agent-log.md](ai-agent-log.md), Durchlauf in
[ai-handover.md](ai-handover.md).

<details><summary>Ursprünglicher Eintrag, zur Nachvollziehbarkeit</summary>

### Kunden-E-Mails

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

</details>

---

## 4. ~~Sicherheitskorrekturen deployen~~ — ERLEDIGT am 2026-08-07

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

## 4a. ~~CSP ohne `'unsafe-inline'`: Nonces für die Inline-Skripte~~ — ERLEDIGT am 2026-08-08

`script-src` lautet jetzt `'self' 'nonce-…'`. Der Zufallswert entsteht je
Antwort in `worker/index.ts`, ein `HTMLRewriter` hängt ihn jedem `<script>` an,
`lib/security-headers.ts` setzt ihn in die Regel. Antworten, die kein HTML sind,
bekommen `script-src 'self'` — `'unsafe-inline'` steht damit in **keiner**
Antwort mehr.

**Der Gewinn ist an beiden Enden gemessen:** Derselbe eingeschleuste
`<img onerror=…>` läuft gegen die alte Regel und wird gegen die neue mit einem
`script-src-attr`-Verstoß abgewiesen.

**Bewusste Abweichung: kein `'strict-dynamic'`.** Es würde `'self'` unwirksam
machen, während alles Nachgeladene ohnehin von dieser Herkunft kommt. Begründung
in [ai-handover.md](ai-handover.md).

**`style-src` behält `'unsafe-inline'`** — React und vinext setzen Inline-Stile.
Das bleibt offen und ist eine eigene Aufgabe.

<details><summary>Ursprünglicher Eintrag, zur Nachvollziehbarkeit</summary>

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

</details>

---

## 4b. ~~Bestand live prüfen, bevor Geld fließt~~ — ERLEDIGT am 2026-08-07

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
## 5. ~~Checkout zeigt den ausgehandelten Preis~~ — ERLEDIGT am 2026-08-08

Gebaut: `GET /api/account/offers` liefert dem angemeldeten Kunden seine
angenommenen, unverfallenen Angebote; der Checkout zeigt je Position den
ausgehandelten Preis, den durchgestrichenen Listenpreis und die Ersparnis.

**Der Kern war nicht die Anzeige, sondern die eine Regel.** Sie steht jetzt in
`lib/offer-price.ts` (`effectiveUnitPrice`) und wird von der Anzeige **und** von
`app/api/orders/route.ts` benutzt — nachgebaut wäre sie die Stelle, an der
Anzeige und Abrechnung auseinanderlaufen und der Kunde einen anderen Betrag
sieht als den abgebuchten. `pickAcceptedOffers` in `lib/price-offers.ts` ist
entsprechend die eine Quelle, aus der sich `pickAcceptedPrices` ableitet.

Am verbindlichen Preis ändert sich **nichts**: Er entsteht weiterhin allein
serverseitig, der Checkout schickt nach wie vor nur Produkt-Kennungen.
6 neue Tests, Rot-Nachweis geführt, im Browser an drei Fällen belegt (ohne
Angebot, mit Angebot, Angebot über dem Listenpreis). Durchlauf in
[ai-handover.md](ai-handover.md).

<details><summary>Ursprünglicher Eintrag, zur Nachvollziehbarkeit</summary>

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

</details>

---

## 6. eBay-Schreibpfad — GEBAUT am 2026-08-08, Abnahme steht aus

**Der Code ist fertig und deployed** (Version `b4421267`, Commit `63df714`).
Die Warteschlange adressiert jetzt über die **ItemID** statt über die
Inventory-API-OfferID und setzt die Menge per `ReviseInventoryStatus` auf 0.
Das war der eigentliche Fehler: `GetMyeBaySelling` liefert nie eine OfferID,
also stieg **jeder** Aufruf an der fehlenden Kennung aus — die Outbox hat seit
ihrem Bau **keinen einzigen Auftrag** bekommen. Der Schreibpfad war nicht nur
abgeschaltet, er war unerprobt.

Dazu zwei Dinge, die beim Bauen dazukamen: **Auktionen** werden gar nicht erst
eingereiht (ihre Menge ist nicht änderbar, ein solcher Auftrag würde ewig
scheitern), und ein **bereits beendetes Angebot gilt als Erfolg**, erkannt an
der `ErrorCode`-Nummer statt am übersetzbaren Fließtext. 15 Tests in
`tests/ebay-outbox.test.mjs`, Rot-Nachweis je einzeln geführt.

**`EBAY_WRITE_ENABLED` steht weiterhin auf `false`.** Aufträge entstehen ab
jetzt bei jedem bezahlten Verkauf, werden aber nicht ausgeführt. `PENDING`-
Zeilen in `ebay_outbox` sind deshalb der Normalzustand und kein Fehler.

**Was noch fehlt — und es liegt beim Betreiber:**

1. **Den Schreib-Scope bestätigen — das geht jetzt per Knopfdruck.** Als Admin
   angemeldet `GET /api/admin/ebay/write-check` aufrufen. Die Route tauscht ein
   Token mit dem Schreib-Scope und **fasst kein Angebot an**; sie ist deshalb
   auch bei `EBAY_WRITE_ENABLED=false` gefahrlos.
   - `{"ok": true}` → der Token trägt `sell.inventory`, weiter mit Schritt 2.
   - `{"ok": false}` → die eBay-Zustimmung einmal über
     `/api/admin/ebay/oauth/start` erneuern. Der Zustimmungsweg fordert den
     Schreib-Scope bereits an (seit 2026-08-06), es genügt also der Durchlauf.

   *(Die lokalen Zugangsdaten in `.env.local` taugen zum Prüfen nicht — ihr
   Refresh-Token ist veraltet und scheitert für **jeden** Scope gleich. Deshalb
   die Prüfung aus dem Worker heraus.)*
2. **An einer Testkarte nachweisen**, dass die Menge bei eBay wirklich auf 0
   geht — **an einer, deren Verschwinden nicht wehtut, und das ist wörtlich
   gemeint.** Bei einem Festpreisangebot mit Menge 1 beendet eBay das Angebot,
   wenn die Menge auf 0 geht; die Umkehrbarkeit, wegen der `ReviseInventoryStatus`
   und nicht `EndItem` gewählt wurde, greift dann womöglich nicht, und
   Wiedereinstellen ergäbe eine neue ItemID. Für den Betrieb bleibt das die
   richtige Wahl — verkauft ist verkauft, das Angebot *soll* weg. Für den Test
   heißt es: ein eigens eingestelltes Wegwerf-Angebot nehmen, wie beim
   1-Cent-Testartikel für PayPal. **Die KI kann keines anlegen** — es gibt
   keinen Code-Pfad zum Einstellen, der Import ist rein lesend.
3. **Erst dann `EBAY_WRITE_ENABLED=true`** setzen. Der Schalter existiert genau
   für diese Reihenfolge.
4. Nach dem ersten echten Verkauf `ebay_outbox` kontrollieren: Status
   `SUCCEEDED`, kein `FAILED`.

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

Die Prüfung selbst ist durch (siehe „Erledigt"). **17 von 18 Befunden sind
geschlossen** — SEC-15 (90 Tage Aufbewahrung) und SEC-16 (Datenschutztext)
wurden am 2026-08-07 nachgezogen, nachdem der Betreiber entschieden hatte,
SEC-18 (Kontowiederherstellung) ebenfalls. Ein Befund bleibt offen:

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
Löschfrist ergänzt). Damit **17 von 18 Befunden geschlossen** (SEC-18 kam nach
Phase 1 dazu und ist ebenfalls behoben; die Statusübersicht in
[security-findings.md](security-findings.md) ist für die Zählung maßgeblich).
Der damals geltende Cloudflare-**Free**-Tarif hatte SEC-05 von *mittel* auf
*hoch* gehoben: Rund 2 900 Aufrufe von `/api/products` brauchten das
D1-Tageskontingent auf, danach stand der ganze Shop bis zum nächsten Tag.
**Diese Begründung ist überholt** — seit dem 2026-08-07 läuft das Projekt auf
Workers Paid, die harten Tagesdeckel sind weg (siehe „Warum diese Reihenfolge"
ganz oben). Die eingebaute Zwischenspeicherung bleibt trotzdem richtig, sie
kostet jetzt nur kein Ausfallrisiko mehr, sondern Geld.

**Der Deploy fehlt noch — er steht als Punkt 2 oben.** Ohne ihn wirkt keine der
Korrekturen, auch die Löschfrist nicht. Ein Befund bleibt offen, siehe Punkt 8.

**Nebenbei repariert:** `npm run dev` startete gar nicht — `nodejs_compat` war
in `vite.config.ts` und `wrangler.toml` doppelt deklariert, und das gebündelte
`workerd` war zu alt für das `compatibility_date`. Beides war vorbestehend.
