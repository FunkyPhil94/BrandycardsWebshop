# Sicherheitsprüfung BrandyCards — Befunde

**Auftrag:** [security-audit-brief.md](security-audit-brief.md)
**Art:** Whitebox-Codeprüfung, lokale Angriffsnachstellung, lesende Live-Stichproben
**Geprüfter Stand:** `agent/initial-brandycards` @ `0504567`
**Datum:** 2026-08-07

---

## Wie dieser Bericht zu lesen ist

Jeder Befund nennt am Ende seine **Sicherheit der Einschätzung**:

- **bestätigt** — lokal nachgestellt oder direkt gemessen, der Beleg steht dabei
- **plausibel** — aus dem Code eindeutig ableitbar, aber nicht praktisch ausgelöst
  (weil das einen Angriff gegen Produktion oder gegen eBay bedeutet hätte)
- **Vermutung** — begründet, aber nicht belegt; als solche kenntlich gemacht

Abschnitt [Geprüft und unbedenklich](#geprüft-und-unbedenklich) nennt ausdrücklich,
was untersucht und für tragfähig befunden wurde. Abschnitt
[Korrekturen am Prüfauftrag](#korrekturen-am-prüfauftrag) nennt die Stellen, an
denen der Auftrag selbst irrt.

**Der Status je Befund** steht in der Übersicht direkt darunter und wurde in
Phase 3 nachgeprüft.

---

## Statusübersicht (Stand nach Phase 3)

| Befund | Schweregrad | Status | Nachweis der Schließung |
|---|---|---|---|
| [SEC-01](#sec-01--der-html-sanitizer-wird-nach-seinem-lauf-wieder-aufgehoben) | hoch | **behoben** | 4 Tests, vorher rot · zusätzlich live über `GET /api/products/[id]` gegen den lokalen Server |
| [SEC-02](#sec-02--rate-limiting-ist-in-produktion-wirkungslos) | hoch | **behoben, wirkt erst mit dem Deploy** | `wrangler deploy --dry-run` löst beide Bindings auf · lokal 10× 201 dann 429 mit `retry-after: 60` |
| [SEC-03](#sec-03--ein-einziges-konto-kann-den-gesamten-bestand-blockieren) | hoch | **behoben** | Angriff gegen die Entscheidungslogik nachgestellt: 296 → 50 Einheiten |
| [SEC-04](#sec-04--jeder-kann-über-apiproductsid-ebay-kontingent-verbrennen) | mittel | **behoben** | eigener Grenzwert nur für den eBay-Abruf; Karte wird weiterhin ausgeliefert |
| [SEC-05](#sec-05--apiproducts-liefert-128-kb-und-1-725-d1-zeilen-je-aufruf) | **hoch** (hochgestuft, siehe unten) | **behoben** | lokal: `cache-control: public, max-age=60, …` im Erfolgsfall, `no-store` im Fehlerfall |
| [SEC-06](#sec-06--keine-einzige-sicherheits-kopfzeile) | mittel | **behoben, CSP durchsetzend, HSTS gesetzt** | in Produktion gemessen; siehe [Deploy](#deploy-am-2026-08-07) |
| [SEC-07](#sec-07--die-registrierung-schickt-das-klartextpasswort-an-den-eigenen-server) | mittel | **behoben** | lokal: Anfrage mit Passwort → 400, ohne → 200 |
| [SEC-08](#sec-08--die-upload-größengrenze-lässt-sich-durch-weglassen-von-content-length-umgehen) | niedrig | **behoben** | lokal: `Transfer-Encoding: chunked` → 411 vor dem Puffern |
| [SEC-09](#sec-09--jede-angemeldete-anfrage-schreibt-in-users-und-ruft-supabase) | niedrig | **behoben** | 3 Tests |
| [SEC-10](#sec-10--bestandsbuchung-liest-und-schreibt-absolute-mengen) | niedrig | **behoben** | Test verbietet absolute Mengen in Buchung und Rücknahme |
| [SEC-11](#sec-11--toter-authentifizierungscode-der-http-kopfzeilen-vertraut) | niedrig | **behoben** | Datei gelöscht, Test schlägt an, falls sie zurückkehrt |
| [SEC-12](#sec-12--die-ebay-oauth-rückseite-zeigt-den-refresh-token-ohne-anmeldung) | niedrig | **offen** | siehe [Phase 3](#phase-3--nachprüfung) — der naheliegende Fix wäre falsch |
| [SEC-13](#sec-13--abhängigkeiten-18-offene-meldungen-next-neun-advisories-hinter-dem-patchstand) | mittel | **behoben, wirkt erst mit dem Deploy** | 9 `next`-Advisories weg; verbleibend nur Bauwerkzeug |
| [SEC-14](#sec-14--ci-prüft-weder-typen-noch-abhängigkeiten-actions-sind-nicht-gepinnt) | niedrig | **behoben** | Workflow prüft Typen, auditiert, Actions auf Commit gepinnt |
| [SEC-15](#sec-15--kein-selbstbedienungs-auskunfts--oder-löschweg-unbegrenzte-aufbewahrung) | Hinweis | **behoben** | 90-Tage-Frist, vom Betreiber festgelegt; 11 Tests, darunter die Zeitstempel-Falle |
| [SEC-16](#sec-16--bilder-kommen-direkt-von-ebays-cdn) | Hinweis | **behoben** | `Referrer-Policy` gesetzt; Abschnitt 7 und 11 der Datenschutzerklärung ergänzt |
| [SEC-17](#sec-17--rate-limit-schlüssel-vertraut-auf-x-forwarded-for) | niedrig | **behoben** | Test belegt, dass `x-forwarded-for` nicht mehr in den Schlüssel gelangt |
| [SEC-18](#sec-18--kontowiederherstellung-führt-auf-localhost) | **hoch** | **wartet auf den Betreiber** | reine Supabase-Konfiguration, im Code ist nichts zu ändern |

Zusätzlich umgesetzt: **E-2** (Honeypot und Zeitschwelle, nach Entscheidung des
Nutzers statt Turnstile) und zwei vorbestehende Blocker der Entwicklungsumgebung,
siehe [Phase 3](#phase-3--nachprüfung).

---

## Datenbasis der Live-Stichproben

Alles lesend, nichts gegen Produktion geschrieben:

| Quelle | Ergebnis |
|---|---|
| D1 `brandycards-production` (lesend) | 542 Produkte, davon 296 `ACTIVE`; 539 Listings, davon **12 mit zwischengespeicherter Beschreibung**; 1 Nutzer (ADMIN, E-Mail bestätigt); 1 Bestellung (`PAID`, 4,45 €); 3 Webhook-Ereignisse, alle `PROCESSED`; 0 Preisvorschläge, 0 Kartenangebote, 0 Anfragen, 0 aktive Reservierungen |
| `GET https://shop.brandycards.de/` | 200, **keine einzige Sicherheits-Kopfzeile** |
| `GET https://shop.brandycards.de/api/products` | 200, **130 723 Bytes**, 0,4 s |
| D1-Messung derselben Abfrage | **1 725 gelesene Zeilen** je Aufruf |
| `GET <supabase>/auth/v1/settings` (öffentlicher Endpunkt) | `mailer_autoconfirm: false`, `disable_signup: false`, `anonymous_users: false`, nur E-Mail-Anmeldung |
| `GET <supabase>/rest/v1/` mit dem Publishable Key | **401** — die Data API ist mit diesem Schlüssel nicht erreichbar |
| `npm audit` | 18 Meldungen: 13 hoch, 4 mittel, 1 niedrig |

---

# Befunde

## SEC-01 — Der HTML-Sanitizer wird nach seinem Lauf wieder aufgehoben

**Schweregrad: hoch**

**Warum hoch:** Ein XSS auf `shop.brandycards.de` ist hier keine Kosmetik. Der
Supabase-Client läuft mit `persistSession: true`
([lib/supabase-browser.ts:12](lib/supabase-browser.ts:12)), das Access-Token liegt
also im `localStorage` derselben Herkunft. Skriptausführung auf der Kartenseite
bedeutet damit **Kontoübernahme**, beim Admin-Konto zusätzlich Zugriff auf
Kundendaten, Bestellungen und die eBay-Verwaltung. Nicht *kritisch*, weil der
Eingabeweg über die eBay-Beschreibung läuft und damit ein kompromittiertes
eBay-Konto oder eine manipulierte eBay-Antwort voraussetzt — keine Lücke, die ein
anonymer Besucher allein auslösen kann.

**Ort:** [lib/ebay-description.ts:23](lib/ebay-description.ts:23) (`decode`),
[lib/ebay-description.ts:100](lib/ebay-description.ts:100) (`` `<p>${text(body)}</p>` ``),
Senke: [app/karten/[id]/page.tsx:163](app/karten/[id]/page.tsx:163)
(`dangerouslySetInnerHTML`)

**Angriffsweg:**

1. `sanitizeHtml` arbeitet korrekt: Was kein erlaubtes Tag ist, wird zu Text und
   `<`/`>` werden zu `&lt;`/`&gt;` escaped. Aus `&lt;img src=x onerror=…&gt;`
   in der eBay-Beschreibung macht der Sanitizer — richtigerweise — genau diesen
   escapeten Text.
2. `parseEbayDescription` bekommt dieses *bereits sichere* HTML und ruft darauf
   `text()` auf. `text()` ruft `decode()`, und `decode()` **macht das Escaping
   rückgängig**: `&lt;` wird wieder zu `<`, `&gt;` wieder zu `>`.
3. Findet der Parser im Abschnittsrumpf keinen Block (`p`, `ul`, `ol`,
   `blockquote`, `pre`, `h3`–`h6`), greift der Rückfall
   `` `<p>${text(body)}</p>` `` — der entschlüsselte Text wandert **als Markup**
   in `section.html`.
4. `section.html` geht ungeprüft in `dangerouslySetInnerHTML`.

Ein `<div>` als Wrapper genügt, um in den Rückfallzweig zu geraten — und genau
das erzeugen eBays Vorlagen. Für den Angriff reicht also eine Beschreibung der
Form:

```html
<h2>Zustand</h2>
<div>Karte ist top &lt;img src=x onerror=alert(document.domain)&gt;</div>
```

Auf eBay sieht das aus wie harmloser Text.

**Auswirkung:** Skriptausführung im Kontext von `shop.brandycards.de` bei jedem
Besucher, der diese Karte öffnet. Ausgelesen werden können das Supabase-Token
(Kontoübernahme), der Warenkorb und alles, was das Konto darf. Beim Admin-Konto:
Kundenadressen, Bestellungen, hochgeladene Bilder, eBay-OAuth-Start.

**Nachweis (bestätigt):** Lokal gegen die echten Module ausgeführt:

```
Eingabe    : <h2>Zustand</h2><div>Karte ist top &lt;img src=x onerror=alert(1)&gt; Ende</div>
sanitizeHtml: <h2>Zustand</h2><div>Karte ist top &lt;img src=x onerror=alert(1)&gt; Ende</div>   ← korrekt escaped
section.html: <p>Karte ist top <img src=x onerror=alert(1)> Ende</p>                              ← wieder scharf
```

Ebenso für `&lt;script&gt;…&lt;/script&gt;` (im Browser über `innerHTML` zwar
inert, aber der Beleg, dass der Filter vollständig umgangen ist) und für
`&LT;…&GT;`, weil `decode()` mit `/gi` arbeitet.

**Erreichbarkeit heute:** Die 12 aktuell zwischengespeicherten Beschreibungen
laufen alle über den Blockzweig oder erzeugen gar keine Abschnitte — der
verwundbare Zweig wird von den heutigen Daten **nicht** getroffen. Er ist aber
kein Sonderfall, sondern die normale Behandlung jeder Beschreibung ohne
Block-Markup unter der Überschrift.

**Empfehlung:** `text()` darf nicht das Ergebnis eines Sanitizers dekodieren und
dann als HTML zurückgeben. Zwei Zeilen Arbeit, plus Test:

1. Im Rückfallzweig den Text wieder escapen, bevor er in `<p>…</p>` geht —
   dieselbe `escapeText`-Regel wie im Sanitizer.
2. `decode()` nur noch dort verwenden, wo das Ergebnis als **Text** weitergegeben
   wird (`specs`, `heading` — beides läuft über React und wird escaped).

Aufwand: klein (< 1 h inkl. Test).

**Zusätzlich empfohlen (eigene Entscheidung nötig, siehe [SEC-06](#sec-06--keine-einzige-sicherheits-kopfzeile)):**
Eine Content-Security-Policy hätte diesen Befund von „Kontoübernahme" auf
„nichts passiert" reduziert.

**Sicherheit der Einschätzung: bestätigt.**

**Status:** _(Phase 3)_

---

## SEC-02 — Rate-Limiting ist in Produktion wirkungslos

**Schweregrad: hoch**

**Warum hoch:** Es ist der einzige Schutz der drei öffentlichen Formulare, er
täuscht Wirksamkeit vor, und er fällt **still** aus. Kein Fehler, kein Log,
keine Metrik — der Code sieht abgesichert aus, ist es aber nicht. Ein
vorgetäuschter Schutz ist schlechter als ein fehlender, weil niemand mehr
hinschaut.

**Ort:** [lib/rate-limit.ts:20](lib/rate-limit.ts:20) (`env.RATE_LIMITER`),
[wrangler.toml](wrangler.toml) — dort ist **kein** `[[ratelimits]]`-Eintrag.
Betroffene Aufrufer: [app/api/inquiries/route.ts:17](app/api/inquiries/route.ts:17),
[app/api/card-submissions/route.ts:21](app/api/card-submissions/route.ts:21),
[app/api/prelisted-interest/route.ts:16](app/api/prelisted-interest/route.ts:16)

**Angriffsweg:** Ohne Binding fällt `enforcePublicRateLimit` auf eine `Map` im
Modulgeltungsbereich zurück. Diese Map lebt **im Isolate**. Cloudflare Workers
erzeugen Isolates pro Rechenzentrum, mehrfach parallel, und verwerfen sie nach
Sekunden bis Minuten Leerlauf. Zwei aufeinanderfolgende Anfragen desselben
Angreifers landen typischerweise in verschiedenen Isolates; der Zähler beginnt
jedes Mal bei 1. Es genügt, die Anfragen zu verteilen oder schlicht zu warten —
selbst ohne jede Mühe greift die Grenze nur, wenn ein Isolate zufällig
wiederverwendet wird.

**Auswirkung:**
- `/api/inquiries` und `/api/prelisted-interest` schreiben je Aufruf eine Zeile
  nach `inquiries`. D1 rechnet Schreibvorgänge ab; das Admin-Dashboard wird
  unbrauchbar.
- `/api/card-submissions` nimmt je Aufruf bis zu **50 MB** nach R2 entgegen. R2
  rechnet Speicher und Operationen ab. Kein Gesamtlimit, keine Obergrenze pro
  Absender.
- In Verbindung mit [SEC-05](#sec-05--apiproducts-liefert-128-kb-und-1-725-d1-zeilen-je-aufruf)
  und [SEC-04](#sec-04--jeder-kann-über-apiproductsid-ebay-kontingent-verbrennen)
  ist das der Hebel für alle mengenbasierten Angriffe.

**Nachweis (bestätigt):** `wrangler.toml` enthält `[vars]`, `[triggers]`,
`[assets]`, `[images]`, `[[d1_databases]]`, `[[r2_buckets]]` — und keinen
Rate-Limit-Eintrag. Das Schema von Wrangler 4.92
(`node_modules/wrangler/config-schema.json` → `RawConfig.properties.ratelimits`)
kennt den Eintrag als `[[ratelimits]]` mit `name`, `namespace_id` und
`simple = { limit, period }`, `period` ∈ {10, 60}.

**Empfehlung:**
1. `[[ratelimits]]` in `wrangler.toml` deklarieren.
2. Das Fehlen des Bindings beim ersten Aufruf **protokollieren** — ein stiller
   Rückfall darf nicht wieder passieren.
3. Beachten: Bei aktivem Binding sind die Parameter `limit` und `windowMs` in
   `enforcePublicRateLimit` **wirkungslos**, weil Cloudflare die Grenze aus der
   Konfiguration nimmt. Entweder je Endpunkt ein eigener Namespace oder eine
   bewusst gemeinsame Grenze — nicht so tun, als wären es drei verschiedene.
4. Cloudflares Rate Limiting zählt **pro Rechenzentrum**, nicht global. Das ist
   um Größenordnungen besser als eine Isolate-Map, aber kein exakter Zähler.

Aufwand: klein. **Der Deploy ist Voraussetzung — ohne ihn ändert sich nichts.**

**Sicherheit der Einschätzung: bestätigt** (Fehlen des Bindings gemessen; die
Isolate-Lebensdauer ist dokumentiertes Plattformverhalten, nicht gegen Produktion
nachgestellt).

---

## SEC-03 — Ein einziges Konto kann den gesamten Bestand blockieren

**Schweregrad: hoch**

**Warum hoch:** Kein Datenabfluss, aber direkter Umsatzausfall bei minimalem
Aufwand. Der Shop steht dann für alle anderen still, und zwar sichtbar
(„Nicht verfügbar"), nicht als Fehlermeldung. Die Kosten für den Angreifer:
eine bestätigte E-Mail-Adresse.

**Ort:** [app/api/orders/route.ts:36](app/api/orders/route.ts:36) — kein
Rate-Limit, keine Obergrenze offener Bestellungen;
[wrangler.toml:25](wrangler.toml:25) — `crons = ["0 * * * *"]`;
[lib/paypal/settle-order.ts:51](lib/paypal/settle-order.ts:51) —
`releaseExpiredReservations` läuft nur im Cron

**Angriffsweg:**

1. Angreifer legt ein Konto an und bestätigt die E-Mail-Adresse (einmalig).
2. `GET /api/products` liefert alle 296 Produkt-IDs — öffentlich, ohne Anmeldung.
3. `POST /api/orders` nimmt bis zu **50 Positionen** je Bestellung an
   ([Zeile 41](app/api/orders/route.ts:41)). Sechs Aufrufe decken den ganzen
   Bestand ab.
4. Jede Position setzt `inventory.availableQuantity` auf 0 und legt eine
   Reservierung über **15 Minuten** an ([Zeile 9](app/api/orders/route.ts:9)).
5. Die Bestellung wird nie bezahlt. Freigegeben wird sie erst vom
   `scheduled`-Lauf — und der läuft **stündlich**. Die tatsächliche Sperrdauer
   liegt damit zwischen 15 und **75 Minuten**, nicht bei 15.
6. Wiederholen. Es gibt weder eine Mengenbegrenzung auf `/api/orders` noch eine
   Grenze für gleichzeitig offene `PENDING`-Bestellungen je Nutzer.

**Auswirkung:** Der Shop zeigt jede Karte als nicht verfügbar. Kunden kaufen
stattdessen bei eBay oder gar nicht. Nebenwirkung: `orders`, `order_items` und
`reservations` füllen sich mit Müll (bis zu 3 Zeilen je Karte je Runde).

**Nachweis (plausibel):** Aus dem Code eindeutig; **nicht** gegen Produktion
ausgelöst, weil das ein Angriff auf den laufenden Betrieb wäre. Belegt sind:
kein `enforcePublicRateLimit` in der Datei (Volltextsuche), `items.length > 50`
als einzige Mengenprüfung, `RESERVATION_MINUTES = 15`, stündlicher Cron,
`releaseExpiredReservations` ohne zweiten Aufrufer.

**Empfehlung (nach Wirkung geordnet):**
1. Vor dem Anlegen einer Bestellung die **eigenen abgelaufenen** Reservierungen
   des Nutzers freigeben. Kostet nichts und macht den Angriff selbstheilend.
2. Offene `PENDING`-Bestellungen je Nutzer begrenzen (z. B. 3). Ein echter Kunde
   hat nie mehr als eine.
3. `/api/orders` an das Rate-Limit hängen (setzt [SEC-02](#sec-02--rate-limiting-ist-in-produktion-wirkungslos) voraus).
4. Unabhängig davon: Cron auf `*/10 * * * *` — steht ohnehin als Punkt 1 in
   [ai-todo.md](ai-todo.md) und verkürzt das Fenster auf 15–25 Minuten.

Aufwand: klein bis mittel.

---

## SEC-04 — Jeder kann über `/api/products/[id]` eBay-Kontingent verbrennen

**Schweregrad: mittel**

**Warum mittel und nicht niedrig:** Der Schaden trifft nicht diesen Endpunkt,
sondern den **Import**. Ist das eBay-Tageskontingent aufgebraucht, läuft
`runEbaySync` in `getAccessToken` bzw. `GetMyeBaySelling` auf Fehler. Der Shop
verkauft dann weiter aus einem veralteten Bestand — und das ist genau die
Doppelverkaufs-Situation, gegen die [ai-todo.md](ai-todo.md) Punkt 1 und 3
antreten. Nicht hoch, weil ein Angreifer dafür ausdauernd Anfragen stellen muss
und der Effekt nach 24 Stunden von selbst endet.

**Ort:** [app/api/products/[id]/route.ts:35-47](app/api/products/[id]/route.ts:35)

**Angriffsweg:**

1. Der Endpunkt ist öffentlich, ohne Anmeldung, ohne Rate-Limit.
2. Ist `descriptionHtml` leer und eine `ebayItemId` vorhanden, ruft er
   `getEbayItemDescription`. Das sind **zwei** eBay-Aufrufe je Anfrage:
   `identity/v1/oauth2/token` und `GetItem`.
3. Das Ergebnis wird nur zwischengespeichert, **wenn eBay etwas liefert**
   ([Zeile 38](app/api/products/[id]/route.ts:38): `if (fetched)`). Liefert eBay
   nichts — leere Beschreibung, Auktion ohne Text, Fehler —, wird nichts
   gespeichert und **jede weitere Anfrage ruft erneut an**. Unbegrenzt.
4. Von 296 aktiven Karten haben heute **12** eine gespeicherte Beschreibung. Die
   restlichen 284 sind alle Kandidaten; jede ohne Beschreibung bei eBay ist eine
   dauerhafte Quelle.
5. Zusätzlich: Gleichzeitige Anfragen auf dieselbe Karte lösen alle einen eigenen
   `GetItem` aus, es gibt keine Zusammenfassung.

**Auswirkung:** Aufgebrauchtes eBay-Kontingent → Import steht → veralteter
Bestand → Verkauf bereits verkaufter Karten → Storno bei eBay →
Verkäuferstatus. Zusätzlich Worker-CPU und Wartezeit für echte Besucher.

**Nachweis (plausibel):** Der unbegrenzte Wiederholpfad ist aus dem Code
eindeutig (`if (fetched)` ohne Negativ-Merker) und über die D1-Zahl
12 von 296 belegt. Das konkrete eBay-Tageskontingent ist **nicht gemessen** —
gegen das echte eBay-Konto wurde bewusst nichts ausgelöst. Der Standardwert für
die Trading API liegt bei 5 000 Aufrufen/Tag; das entspräche ~2 500 Anfragen.

**Empfehlung:**
1. Den eBay-Abruf hinter ein Rate-Limit legen — **nur den Abruf**, nicht die
   Seite. Läuft das Limit, wird die Karte weiterhin ausgeliefert, nur ohne
   Beschreibung. Setzt [SEC-02](#sec-02--rate-limiting-ist-in-produktion-wirkungslos) voraus.
2. Dauerhaft sauberer: eine Spalte `description_fetched_at`, damit auch ein
   *leeres* Ergebnis gemerkt wird. Das ist eine Migration und damit ein
   schreibender Eingriff in Produktion — **gehört abgesprochen**, siehe
   [Wartet auf Entscheidung](#wartet-auf-entscheidung).

---

## SEC-05 — `/api/products` liefert 128 KB und 1 725 D1-Zeilen je Aufruf

**Schweregrad: hoch** *(am 2026-08-07 von mittel hochgestuft)*

**Warum hoch:** Kein Datenabfluss — die Daten sind öffentlich —, aber der
billigste Weg, den Shop lahmzulegen. Die Einstufung hing am Cloudflare-Tarif;
der Betreiber hat bestätigt: **Free.** Damit ist die Obergrenze 5 Mio. gelesene
D1-Zeilen pro Tag, und rund **2 900 Aufrufe** brauchen sie auf. Danach antwortet
nicht nur dieser Endpunkt mit 503, sondern **jede datenbankgestützte Seite** —
Startseite, Kartenliste, Kartendetail, Checkout — bis zum nächsten Tag.
Das ist ein Ausfall, keine Rechnung, und er kostet einen Angreifer nichts
außer einer Schleife.

Die eingebaute Zwischenspeicherung am Rand nimmt dem den Boden: Wiederholte
Aufrufe beantwortet Cloudflare, ohne D1 anzufassen. **Sie wirkt allerdings erst
mit dem Deploy.**

**Ort:** [app/api/products/route.ts:6](app/api/products/route.ts:6) — kein Limit,
keine Seitenaufteilung, keine `cache-control`-Kopfzeile, keine Anmeldung

**Angriffsweg:** `GET /api/products` in einer Schleife. Keine Vorbedingung.

**Auswirkung — gemessen:**

| Größe | Wert |
|---|---|
| Antwortgröße | 130 723 Bytes |
| D1-Zeilen je Aufruf | 1 725 |
| Antwortzeit | ~0,4 s |

Free-Tarif D1: 5 Mio. gelesene Zeilen/Tag. **~2 900 Aufrufe** brauchen das
Tageskontingent auf — das sind rund 370 MB, in wenigen Minuten erzeugt. Danach
antwortet **jede** D1-gestützte Seite mit 503, inklusive Startseite, Kartenliste
und Checkout. **Der Betreiber hat den Free-Tarif bestätigt**, dies ist also der
tatsächliche Fall, nicht der schlimmstenfalls angenommene.

**Nachweis (bestätigt):** Antwortgröße und Zeit per `curl` gegen Produktion
gemessen (ein einzelner Aufruf, kein Lasttest). Die 1 725 Zeilen stammen aus
einer lesenden D1-Ausführung derselben Abfrage; `rows_read` kommt aus der
D1-Antwort selbst.

**Empfehlung:**
1. `cache-control: public, max-age=60, stale-while-revalidate=300` setzen. Der
   Katalog ändert sich stündlich; Cloudflare beantwortet die Last dann am Rand,
   ohne D1 anzufassen. **Wirkt sofort und ist die billigste Maßnahme.**
2. Die Bild-Verknüpfung begrenzen: die Liste braucht ein Bild je Karte, nicht
   alle. `/api/products/highlights` macht das bereits richtig
   ([Zeile 22](app/api/products/highlights/route.ts:22)).
3. Mittelfristig Seitenaufteilung — ändert aber die Bedienung von `/karten`
   (Suche läuft heute rein clientseitig über den vollständigen Katalog) und
   gehört deshalb abgesprochen.

---

## SEC-06 — Keine einzige Sicherheits-Kopfzeile

**Schweregrad: mittel**

**Warum mittel:** Für sich genommen keine Lücke. Aber jede Kopfzeile, die fehlt,
ist eine Schadensbegrenzung, die nicht greift — und
[SEC-01](#sec-01--der-html-sanitizer-wird-nach-seinem-lauf-wieder-aufgehoben)
zeigt, dass genau dieser Fall eintreten kann.

**Ort:** [next.config.ts](next.config.ts) (leer), [worker/index.ts](worker/index.ts)
(reicht die Antwort unverändert durch), kein `public/_headers`

**Nachweis (bestätigt):** Antwort von `https://shop.brandycards.de/` enthält
weder `content-security-policy`, `x-content-type-options`, `referrer-policy`,
`permissions-policy` noch `x-frame-options`.

**Auswirkung im Einzelnen:**

| Fehlend | Folge hier konkret |
|---|---|
| `Content-Security-Policy` | SEC-01 wird von „Skript blockiert" zu „Kontoübernahme" |
| `X-Content-Type-Options: nosniff` | gilt bereits für Admin-Bilder, sonst nirgends |
| `Referrer-Policy` | die **vollständige URL** der Kartenseite geht an `i.ebayimg.com` mit jedem Bild |
| `Permissions-Policy` | Kamera, Mikrofon, Geolocation stehen eingebetteten Inhalten offen |
| `X-Frame-Options` / `frame-ancestors` | der Shop lässt sich in fremde Seiten einbetten (Clickjacking auf „In den Warenkorb", „Vorschlag senden") |

**Empfehlung:** Die vier unstrittigen Kopfzeilen zentral in
`worker/index.ts` setzen — das erfasst auch die serverseitig gerenderten Seiten,
was `public/_headers` (nur statische Dateien) nicht täte.

**Die CSP gehört getrennt entschieden**, siehe
[Wartet auf Entscheidung](#wartet-auf-entscheidung): eine zu strenge Regel legt
den Shop lahm, eine zu lockere nützt nichts, und ohne Test gegen das echte
Bundle ist beides nicht zu unterscheiden.

---

## SEC-07 — Die Registrierung schickt das Klartextpasswort an den eigenen Server

**Schweregrad: mittel**

**Warum mittel:** Kein aktiver Angriffsweg, aber ein Umgang mit Zugangsdaten, der
nicht sein muss. Das Passwort erreicht einen Server, der es nicht braucht — und
jeder künftige Fehlerpfad, jedes zusätzliche Logging und jede
Fehlerberichterstattung auf dieser Route hätte es dann in der Hand. Genau so
entstehen Passwörter in Logdateien.

**Ort:** [app/api/account/validate-registration/route.ts:6-11](app/api/account/validate-registration/route.ts:6),
Aufrufer [app/account/page.tsx:115-119](app/account/page.tsx:115)

**Angriffsweg:** Kein Angriff nötig — das ist der Normalbetrieb. Bei jeder
Registrierung geht `{ username, password, passwordConfirmation }` als JSON an den
eigenen Worker. Der Server prüft dort ausschließlich `password.length >= 8` und
`password === passwordConfirmation`. **Beides ist reine Formularprüfung, für die
kein Server nötig ist.** Anschließend geht dasselbe Passwort noch einmal an
Supabase — dorthin gehört es.

**Auswirkung:** Das Passwort liegt für die Dauer der Anfrage im Worker-Speicher
und in jedem Zwischenspeicher auf dem Weg. Kein Abfluss belegt; das Risiko ist
struktureller Natur.

**Nachweis (bestätigt):** Der Client sendet das Feld
([app/account/page.tsx:118](app/account/page.tsx:118)), die Route liest es
([Zeile 7](app/api/account/validate-registration/route.ts:7)). Die Route hat
zudem **kein Rate-Limit** und **keine Herkunftsprüfung**.

**Empfehlung:** Passwortlänge und -gleichheit im Browser prüfen — das Formular
hat bereits `minLength={8}` und `required`. Die Route auf die Prüfung des
Benutzernamens reduzieren oder ganz entfernen. Aufwand: klein.

---

## SEC-08 — Die Upload-Größengrenze lässt sich durch Weglassen von `Content-Length` umgehen

**Schweregrad: niedrig**

**Warum niedrig und nicht mittel:** Cloudflare begrenzt den Anfragekörper
plattformseitig (100 MB im Standardtarif). Der Angreifer gewinnt also den Bereich
zwischen 52 MB und der Plattformgrenze, nicht mehr. Das reicht, um das Isolate
über sein Speicherlimit zu bringen, nicht um beliebig zu schaden.

**Ort:** [app/api/card-submissions/route.ts:47](app/api/card-submissions/route.ts:47)

**Angriffsweg:** `Number(request.headers.get("content-length") ?? 0)` ergibt bei
fehlender Kopfzeile `0` — die Prüfung `> 52_000_000` läuft ins Leere. Bei
`Transfer-Encoding: chunked` gibt es keine `Content-Length`. Erst danach folgt
`await request.formData()`, und das puffert den **vollständigen** Körper, bevor
irgendeine Größenprüfung greift ([Zeile 49](app/api/card-submissions/route.ts:49)).
Die anschließenden Prüfungen auf `file.size` und `bytes.byteLength` kommen zu
spät — der Speicher ist da schon belegt.

**Auswirkung:** Isolate-Absturz (128 MB Speichergrenze) statt sauberer 413er.
Kein Datenverlust, keine Persistenz. Mit [SEC-02](#sec-02--rate-limiting-ist-in-produktion-wirkungslos)
zusammen wiederholbar.

**Nachweis (plausibel):** Aus dem Code eindeutig. Nicht gegen Produktion
ausgelöst — das wäre ein Lasttest.

**Empfehlung:** Fehlende `Content-Length` bei `multipart/form-data` ablehnen
(`411 Length Required`) statt sie als 0 zu lesen. Zwei Zeilen.

---

## SEC-09 — Jede angemeldete Anfrage schreibt in `users` und ruft Supabase

**Schweregrad: niedrig**

**Ort:** [lib/app-user.ts:79](lib/app-user.ts:79) →
[lib/app-user.ts:52-63](lib/app-user.ts:52)

**Angriffsweg / Auswirkung, zwei getrennte Punkte:**

1. **Schreibverstärkung.** `getAuthenticatedAppUser` ruft immer
   `findOrCreateAppUser`, und das führt bedingungslos ein `UPDATE users` aus —
   auch bei reinen Leseanfragen wie `GET /api/price-offers`, die die
   Kartendetailseite bei **jedem** Aufruf stellt. Dazu kommt je Anfrage ein
   `fetch` gegen `<supabase>/auth/v1/user`. Ein Angreifer mit einem gültigen
   Token erzeugt so D1-Schreibvorgänge und Supabase-Last im Verhältnis 1:1 zu
   seinen Anfragen.

2. **Selbstblockade über den Benutzernamen.** Der Benutzername wird aus
   `authUser.user_metadata?.username` übernommen
   ([Zeile 39](lib/app-user.ts:39)). `user_metadata` ist in Supabase
   **vom Nutzer selbst beschreibbar** (`supabase.auth.updateUser({ data: … })`,
   genutzt in [app/account/page.tsx:82](app/account/page.tsx:82)). Setzt jemand
   dort einen bereits vergebenen Namen, verletzt das `users_username_unique`
   ([db/schema.ts:49](db/schema.ts:49)) — und weil der `UPDATE` bei **jeder**
   angemeldeten Anfrage läuft, schlägt danach jeder Aufruf fehl. Fremde Konten
   sind nicht betroffen (der Index verhindert die Übernahme), das eigene wird
   unbrauchbar.

**Nachweis (plausibel):** Aus dem Code eindeutig; nicht ausgelöst, weil dafür ein
zweites Konto in der Produktions-Supabase nötig wäre.

**Empfehlung:** Den `UPDATE` nur ausführen, wenn sich tatsächlich etwas ändert,
und den Namenskonflikt abfangen statt durchschlagen zu lassen. Aufwand: klein.

---

## SEC-10 — Bestandsbuchung liest und schreibt absolute Mengen

**Schweregrad: niedrig**

**Ort:** [app/api/orders/route.ts:80](app/api/orders/route.ts:80) und die
Rücknahme in [Zeile 83-86](app/api/orders/route.ts:83)

**Angriffsweg:** Die Buchung schreibt `availableQuantity: item.stock.availableQuantity - item.quantity`
— einen Wert, der **vor** dem Schreiben gelesen wurde. Zwei gleichzeitige
Anfragen können beide die Bedingung `gte(availableQuantity, quantity)` erfüllen
und anschließend denselben absoluten Wert schreiben; eine Buchung geht verloren.
Die Spalte `version` ([db/schema.ts:129](db/schema.ts:129)) existiert genau für
diesen Zweck, wird in der `where`-Bedingung aber **nicht** verwendet.

**Warum trotzdem nur niedrig:** Alle Karten sind Einzelstücke. Bei
`availableQuantity = 1` und `quantity = 1` schließt der `gte`-Wächter die Lücke
vollständig — die zweite Buchung findet 0 vor und wird zurückgerollt. Der Fehler
wird erst bei Mengen > 1 wirksam, die es hier nicht gibt.

`lib/paypal/settle-order.ts` macht es an der entsprechenden Stelle bereits
richtig (relatives SQL, [Zeile 19](lib/paypal/settle-order.ts:19)).

**Nachweis (plausibel):** Codelesen; unter den heutigen Daten nicht auslösbar.

**Empfehlung:** Relatives SQL statt absoluter Werte, in Buchung **und**
Rücknahme. Aufwand: klein. Lohnt sich, bevor jemals eine Karte mit Menge > 1
angelegt wird.

---

## SEC-11 — Toter Authentifizierungscode, der HTTP-Kopfzeilen vertraut

**Schweregrad: niedrig** (heute wirkungslos)

**Ort:** [app/chatgpt-auth.ts](app/chatgpt-auth.ts)

**Befund:** Das Modul liest `oai-authenticated-user-id` und
`oai-authenticated-user-email` aus dem Anfragekopf und gibt daraus einen
angemeldeten Nutzer zurück — ohne jede Signatur- oder Herkunftsprüfung. Es
stammt aus der Starter-Vorlage und wird **nirgends importiert** (Volltextsuche:
nur `README.md` und die Datei selbst).

**Angriffsweg:** Heute keiner. Würde jemand `getChatGPTUser()` künftig
verwenden, weil es einladend danebenliegt, genügte
`curl -H "oai-authenticated-user-email: admin@…"`, um sich als beliebiger Nutzer
auszugeben. Genau so entstehen Lücken: nicht durch Absicht, sondern durch
liegengebliebene Bausteine.

**Nachweis: bestätigt** (Volltextsuche über das Repository).

**Empfehlung:** Datei löschen, README-Abschnitt entfernen. Aufwand: Minuten.

---

## SEC-12 — Die eBay-OAuth-Rückseite zeigt den Refresh-Token ohne Anmeldung

**Schweregrad: niedrig**

**Ort:** [app/api/admin/ebay/oauth/callback/route.ts:22](app/api/admin/ebay/oauth/callback/route.ts:22)

**Befund:** Die Route hat — anders als jede andere unter `/api/admin/**` —
**keine** `requireAdmin`-Prüfung. Sie authentifiziert allein über den `state`
und rendert bei Erfolg den eBay-**Refresh-Token** in eine HTML-Seite.

**Was den Angriff trotzdem schwer macht:** `state` ist HMAC-signiert mit
`EBAY_CLIENT_SECRET`, auf 10 Minuten begrenzt
([Zeile 5-16](app/api/admin/ebay/oauth/callback/route.ts:5)) und wird nur von der
admin-geschützten `/start`-Route ausgegeben. Der `code` ist bei eBay einmalig
einlösbar. Ein Angreifer bräuchte also die Weiterleitungs-URL des Admins,
**bevor** dessen Browser sie öffnet.

**Restrisiko:** `code` und `state` stehen in der Query-Zeichenkette und landen
damit in Browserverlauf, Proxy- und Zugriffsprotokollen. Wer dort mitliest und
schnell genug ist, bekommt einen langlebigen eBay-Refresh-Token — Vollzugriff auf
das Verkäuferkonto im Rahmen des Scopes. `cache-control: no-store` ist gesetzt,
das ist richtig.

**Nachweis: bestätigt** (fehlende Prüfung im Code; Signaturprüfung vorhanden und
korrekt aufgebaut — Zeitfenster **und** HMAC werden beide geprüft).

**Empfehlung:** `requireAdmin` auch hier vorschalten. Der Admin ist zu diesem
Zeitpunkt ohnehin angemeldet — es kostet nichts. Aufwand: Minuten.

---

## SEC-13 — Abhängigkeiten: 18 offene Meldungen, `next` neun Advisories hinter dem Patchstand

**Schweregrad: mittel**

**Ort:** [package.json](package.json), [.github/workflows/ci.yml](.github/workflows/ci.yml)
(keine Prüfung eingebaut)

**Nachweis (bestätigt):** `npm audit` → 13 hoch, 4 mittel, 1 niedrig.

Laufzeitrelevant (Produktionsabhängigkeiten):

| Paket | ist | soll | Bemerkung |
|---|---|---|---|
| `next` | 16.2.6 | ≥ 16.2.11 | **9 Advisories**, u. a. „Middleware/Proxy bypass", „SSRF in rewrites", „Cache confusion of response bodies" |
| `react-server-dom-webpack` | 19.2.6 | ≥ 19.2.8 | DoS in Server Functions |

Alles Übrige (`wrangler`, `vite`, `esbuild`, `drizzle-kit`, `sharp`, `miniflare`,
`postcss`, `undici`, `js-yaml`, `brace-expansion`) ist Werkzeugkette und erreicht
den Worker nicht.

**Ehrlich zur Ausnutzbarkeit:** Der Shop läuft auf **vinext**, nicht auf Next.js'
eigenem Server, hat keine Middleware, keine Server Actions und keine
`rewrites`. Mehrere der neun Advisories greifen deshalb hier vermutlich nicht.
Das ist aber eine **Vermutung** — nachweisen ließe sie sich nur, indem man jedes
Advisory gegen vinexts Umsetzung prüft. Der billigere Weg ist der Patch.

**Empfehlung:**
1. `next` auf 16.2.11 und `react-server-dom-webpack` auf 19.2.8 heben (beides
   Patch-Stände, keine Breaking Changes) — danach `npm test`, `npm run lint`,
   `npx tsc --noEmit`. **Wirksam wird das erst mit dem nächsten Deploy.**
2. `npm audit --audit-level=high` in die CI aufnehmen.

---

## SEC-14 — CI prüft weder Typen noch Abhängigkeiten, Actions sind nicht gepinnt

**Schweregrad: niedrig**

**Ort:** [.github/workflows/ci.yml](.github/workflows/ci.yml)

**Was gut ist** (und ausdrücklich so bleiben sollte):
- `permissions: contents: read` — minimale Rechte, korrekt gesetzt
- Auslöser ist `pull_request`, **nicht** `pull_request_target`. Ein Pull Request
  von außen bekommt damit **keinen** Zugriff auf Secrets. Das ist die Frage aus
  Abschnitt 6.11 des Auftrags, und die Antwort ist: sauber gelöst.
- Es sind ohnehin keine Secrets im Workflow hinterlegt.

**Was fehlt:**
- `npx tsc --noEmit` — Typfehler rutschen durch, steht auch in
  [CLAUDE.md](../CLAUDE.md) und [ai-handover.md](ai-handover.md) als bekanntes Loch
- `npm audit` — siehe [SEC-13](#sec-13--abhängigkeiten-18-offene-meldungen-next-neun-advisories-hinter-dem-patchstand)
- `actions/checkout@v4` und `actions/setup-node@v4` sind auf ein bewegliches Tag
  gepinnt, nicht auf einen Commit-SHA. Wird das Tag verschoben, läuft fremder
  Code im Build. Bei `contents: read` und ohne Secrets ist der Schaden begrenzt —
  der Angreifer könnte den Build manipulieren, aber nichts stehlen.

**Nachweis: bestätigt** (Workflow gelesen).

---

## SEC-15 — Kein Selbstbedienungs-Auskunfts- oder Löschweg, unbegrenzte Aufbewahrung

**Schweregrad: Hinweis** (keine Rechtsberatung)

**Ort:** [app/datenschutz/page.tsx:26](app/datenschutz/page.tsx:26),
[lib/card-submission-cleanup.ts](lib/card-submission-cleanup.ts)

**Befund:**
- Die Datenschutzerklärung verweist für Auskunft und Löschung auf eine
  E-Mail-Adresse. Das ist zulässig, setzt aber voraus, dass jemand die Anfragen
  auch bearbeiten kann — es gibt **keine** Route, die die Daten eines Nutzers
  ausgibt oder löscht. Auch keine Admin-Oberfläche dafür (nur
  `DELETE /api/admin/card-submissions` für einzelne Kartenangebote).
- `cleanupOrphanedCardSubmissionAssets` räumt **nur verwaiste R2-Objekte** auf,
  also solche ohne Datenbankzeile. Kartenangebote und ihre Bilder selbst werden
  nie automatisch gelöscht, unabhängig vom Alter.
- `users`-Zeilen entstehen automatisch bei der ersten angemeldeten Anfrage
  ([lib/app-user.ts:66](lib/app-user.ts:66)) — auch ohne jede Bestellung.

**Empfehlung:** Eine Aufbewahrungsfrist für abgeschlossene Kartenangebote
festlegen und den vorhandenen Aufräumlauf darauf erweitern. Ein Konto-Löschweg
kann warten, solange es einen Nutzer gibt — sollte aber vor dem Verkaufsstart
stehen.

**Umgesetzt am 2026-08-07.** Der Betreiber hat **90 Tage** festgelegt.
`deleteExpiredCardSubmissions` in
[lib/card-submission-cleanup.ts](../lib/card-submission-cleanup.ts) löscht
abgeschlossene Vorgänge (`REJECTED`, `CLOSED`) samt R2-Objekten 90 Tage nach
der letzten Statusänderung, ausgelöst vom `scheduled`-Lauf — eine Frist, die
jemand von Hand auslösen muss, ist keine. Die Entscheidung selbst steht als
reine Funktion in [lib/retention.ts](../lib/retention.ts) und ist in
`tests/retention.test.mjs` mit 11 Tests belegt.

**Bewusst ausgenommen:** `ACCEPTED`. Daraus wird ein Ankauf, und für
Kaufvorgänge gelten handels- und steuerrechtliche Aufbewahrungspflichten, die
eine 90-Tage-Löschung überschreiben würden. Offene Vorgänge (`NEW`,
`IN_REVIEW`, `NEEDS_INFO`) bleiben ebenfalls, unabhängig vom Alter.

**Eine Falle, die dabei aufgefallen ist und selbst ein Befund gewesen wäre:**
`card_submissions.created_at`/`updated_at` bekommen ihre Werte aus SQLites
`CURRENT_TIMESTAMP` und stehen damit im Format `YYYY-MM-DD HH:MM:SS`, während
der übrige Anwendungscode ISO-8601 mit `T` und `Z` schreibt. Ein direkter
`<=`-Vergleich zwischen beiden Formen ist falsch, weil `' '` (0x20) vor `'T'`
(0x54) sortiert. Gemessen an der lokalen Datenbank:

```
Stichtag heute Mitternacht, ein Vorgang von heute 23 Uhr im Bestand:
  naiver Vergleich loescht : 4 Vorgaenge
  mit datetime() loescht   : 3 Vorgaenge
```

Der naive Vergleich hätte einen Vorgang von **heute** als 90 Tage alt
eingestuft und gelöscht. Beide Seiten laufen deshalb über SQLites `datetime()`.
Ein Löschlauf mit einem Datumsfehler ist die unangenehmste Sorte Fehler —
er fällt erst auf, wenn die Daten weg sind.

**Weiterhin offen:** Ein Selbstbedienungsweg für Auskunft und Löschung des
Kontos. Solange es genau einen Nutzer gibt (den Betreiber selbst), ist der
Verweis auf die E-Mail-Adresse in der Datenschutzerklärung tragfähig. Vor dem
Verkaufsstart sollte er stehen.

---

## SEC-16 — Bilder kommen direkt von eBays CDN

**Schweregrad: Hinweis** (keine Rechtsberatung)

**Ort:** [app/karten/page.tsx](app/karten/page.tsx),
[app/karten/[id]/page.tsx:100](app/karten/[id]/page.tsx:100),
[app/gallery.tsx](app/gallery.tsx) — überall `<img src={eBay-URL}>`

**Befund:** Jeder Seitenaufruf lädt Bilder direkt von `i.ebayimg.com`. Damit
erhält eBay IP-Adresse, User-Agent und — mangels `Referrer-Policy`, siehe
[SEC-06](#sec-06--keine-einzige-sicherheits-kopfzeile) — die **vollständige URL**
der besuchten Kartenseite jedes Besuchers. Abschnitt 11 der
Datenschutzerklärung sagt: „Wir setzen derzeit keine nicht erforderlichen
Analyse-, Werbe- oder Resend-Trackingfunktionen ein." Das ist für eigene Zwecke
richtig, erwähnt die Einbindung fremder Inhalte aber nicht.

**Empfehlung:** `Referrer-Policy: strict-origin-when-cross-origin` setzen (Teil
der SEC-06-Korrektur, kostet nichts) und Abschnitt 6 oder 11 der
Datenschutzerklärung um einen Satz zu eBay-Bildern ergänzen. Wer die Übertragung
ganz vermeiden will, müsste die Bilder über R2 spiegeln — spürbarer Aufwand und
laufende Kosten, deshalb hier nur als Option genannt.

**Umgesetzt am 2026-08-07.** Die `Referrer-Policy` ist gesetzt (SEC-06).
Abschnitt 7 der Datenschutzerklärung heißt jetzt „eBay-Synchronisierung und
Kartenbilder" und benennt ausdrücklich, dass die Bilder direkt von eBays
Servern geladen werden, welche Daten dabei übertragen werden, dass nur die
Herkunft und nicht die vollständige Adresse mitgeht, und auf welche
Rechtsgrundlage sich das stützt. Abschnitt 11 verweist darauf, damit die
Aussage „kein Tracking" nicht mehr allein steht. Abschnitt 9 nennt die
90-Tage-Frist aus [SEC-15](#sec-15--kein-selbstbedienungs-auskunfts--oder-löschweg-unbegrenzte-aufbewahrung).

**Ausdrücklich keine Rechtsberatung.** Der Hinweis am Ende der Seite nennt jetzt
Abschnitt 7 und 9 als die beiden, die vor dem Verkaufsstart fachlich zu prüfen
sind. Die Spiegelung über R2 bleibt die einzige Variante, die die Übertragung
ganz vermeidet — sie steht weiterhin nur als Option da.

---

## SEC-17 — Rate-Limit-Schlüssel vertraut auf `x-forwarded-for`

**Schweregrad: niedrig**

**Ort:** [lib/rate-limit.ts:8](lib/rate-limit.ts:8)

**Befund:** Fehlt `cf-connecting-ip`, greift der Code auf `x-forwarded-for`
zurück. Diese Kopfzeile stammt vom Client und ist frei wählbar; wer sie je
Anfrage ändert, umgeht **jedes** Zählverfahren.

**Warum trotzdem niedrig:** Cloudflare setzt `cf-connecting-ip` bei jeder
Anfrage, die über das Netz kommt, und überschreibt sie. Der Worker ist über
`routes` an `shop.brandycards.de` gebunden, `workers_dev = false` und
`preview_urls = false` — es gibt also keinen Weg, ihn unter Umgehung von
Cloudflare zu erreichen. Der Rückfallpfad ist heute **nicht erreichbar**.

Zusätzlich: Die Ersatz-`Map` löscht abgelaufene Einträge nie
([Zeile 26-30](lib/rate-limit.ts:26)); in einem langlebigen Isolate wächst sie
unbegrenzt.

**Empfehlung:** Den `x-forwarded-for`-Rückfall streichen und stattdessen bei
fehlender `cf-connecting-ip` konservativ zählen. Aufwand: Minuten. Mitzuerledigen
mit [SEC-02](#sec-02--rate-limiting-ist-in-produktion-wirkungslos).

---

## SEC-18 — Kontowiederherstellung führt auf `localhost`

**Schweregrad: hoch**

*Nachgemeldet am 2026-08-07. Nicht durch Codeprüfung gefunden, sondern weil der
Betreiber den Ablauf durchgeklickt hat — ein Hinweis darauf, wie begrenzt eine
reine Whitebox-Prüfung ist: Der Code war richtig, die Konfiguration dahinter
nicht.*

**Warum hoch:** Kein Einbruchsweg, aber **Passwort-Zurücksetzen und
E-Mail-Bestätigung funktionieren für echte Kunden nicht.** Wer sein Passwort
vergisst, bekommt einen Link auf `http://localhost:3000` und damit
„Die Website ist nicht erreichbar". Wer sich neu registriert, kann seine
E-Mail-Adresse nicht bestätigen — und ohne Bestätigung legt
`findOrCreateAppUser` kein Konto an
([lib/app-user.ts:48](lib/app-user.ts:48)). Ein Shop, in dem sich niemand
registrieren und niemand sein Passwort zurücksetzen kann, ist für neue Kunden
geschlossen.

**Ort:** Supabase-Konfiguration, nicht der Code. Betroffen sind
[app/account/page.tsx:109](app/account/page.tsx:109) (`resetPasswordForEmail`)
und [app/account/page.tsx:127](app/account/page.tsx:127) (`signUp` mit
`emailRedirectTo`).

**Nachweis (bestätigt):** Der Link aus der Reset-Mail zeigt auf

```
http://localhost:3000/#access_token=eyJhbGciOiJFUzI1NiIs…
```

Entscheidend ist die **Form** dieser URL. Der Code setzt
`redirectTo: ${window.location.origin}/account?next=…` — von der Produktion
aus müsste daraus
`https://shop.brandycards.de/account?next=…#access_token=…` werden. Da steht
aber der **Wurzelpfad**, kein `/account` und kein `?next=`. Supabase hat das
`redirectTo` also **verworfen** und ist auf die konfigurierte **Site URL**
zurückgefallen — und die steht auf `http://localhost:3000`.

**Auswirkung:** Registrierung und Passwort-Zurücksetzen sind unbrauchbar. Der
Sicherheitsanteil ist gering, aber vorhanden: Das Zugriffstoken landet im
URL-Fragment einer Adresse, die der Browser nicht laden kann, und bleibt im
Verlauf stehen. Es wird nie an einen Server übertragen (Fragmente werden nicht
gesendet), der eigentliche Schaden ist die kaputte Wiederherstellung.

**Empfehlung — im Supabase-Dashboard unter *Authentication → URL Configuration*:**

| Feld | Wert |
|---|---|
| **Site URL** | `https://shop.brandycards.de` |
| **Redirect URLs** | `https://shop.brandycards.de/**` |
| optional für lokale Entwicklung | zusätzlich `http://localhost:3000/**` |

`Site URL` ist der Rückfall, `Redirect URLs` die Allowlist — **beide** müssen
gesetzt sein, sonst greift wieder der Rückfall. Bleibt `localhost` in der
Allowlist, zeigt ein von `localhost` aus angeforderter Link weiterhin dorthin;
das ist beim Entwickeln gewollt und in Produktion folgenlos.

**Fertig, wenn:** Eine Anforderung „Passwort vergessen" auf
`shop.brandycards.de` liefert eine Mail, deren Link auf
`https://shop.brandycards.de/account?next=…#access_token=…` zeigt, und das
Formular „Neues Passwort festlegen" erscheint.

**Am Code ist nichts zu ändern** — `window.location.origin` ist genau richtig,
weil es lokal wie in Produktion die passende Adresse liefert. Der Fehler lag
allein in der Allowlist.

**Sicherheit der Einschätzung: bestätigt.**

---

# Geprüft und unbedenklich

Diese Bereiche wurden untersucht und geben **keinen** Anlass zur Korrektur. Sie
stehen hier, damit erkennbar ist, dass sie angesehen und nicht übersprungen
wurden.

### SQL-Injection — sauber

Alle vier Stellen mit rohem SQL geprüft:
`lib/ebay-sync.ts` [53](lib/ebay-sync.ts:53) (keine Interpolation),
[148](lib/ebay-sync.ts:148), [186](lib/ebay-sync.ts:186),
[193](lib/ebay-sync.ts:193) (jeweils `.bind()`).
Alle `sql`-Templates geprüft: `lib/price-offers.ts` [70](lib/price-offers.ts:70)
und [82](lib/price-offers.ts:82), `lib/paypal/settle-order.ts`
[19-21](lib/paypal/settle-order.ts:19),
`app/api/products/highlights/route.ts` [22](app/api/products/highlights/route.ts:22)
— interpoliert werden ausschließlich Drizzle-Spaltenreferenzen und Werte, die
Drizzle als Parameter bindet. `inArray` bindet je Element einen Parameter; die
größte Liste stammt aus `/api/orders` und ist auf 50 Positionen begrenzt, bleibt
also klar unter `D1_MAX_BOUND_PARAMS = 100`.

### PayPal-Webhook — sauber, und das ist belegt

- Verifiziert wird der **rohe** Körper, gelesen vor jeder Verarbeitung
  ([Zeile 50](app/api/paypal/webhook/route.ts:50))
- Das Ergebnis wird **ausgewertet**, nicht nur geloggt: `if (!verified) return 400`
  ([Zeile 63](app/api/paypal/webhook/route.ts:63))
- Fehlt `PAYPAL_WEBHOOK_ID`, antwortet die Route mit 503 statt durchzulassen —
  fail-closed ([Zeile 55](app/api/paypal/webhook/route.ts:55))
- Idempotenz über `webhook_events` mit `uniqueIndex(provider, externalEventId)`;
  `RECEIVED`/`PROCESSED` werden als Duplikat abgewiesen
- Betrag **und** Währung werden gegen die Bestellung **und** gegen die
  gespeicherte Zahlung geprüft ([Zeile 82](app/api/paypal/webhook/route.ts:82))
- Eine erstattete Zahlung kann nicht erneut als bezahlt markiert werden
  ([Zeile 87](app/api/paypal/webhook/route.ts:87))

Der Auftrag fragt, ob der Körper neu serialisiert wird: Ja — `webhook_event:
JSON.parse(input.body)` in [lib/paypal/client.ts:118](lib/paypal/client.ts:118).
Das entspricht dem, was PayPals `verify-webhook-signature`-API erwartet, und
schlüge im Zweifel **fehl** (fail-closed), nicht durch. **Belegt:** In Produktion
stehen drei Webhook-Ereignisse, alle mit Status `PROCESSED` und ohne
Fehlermeldung — die Verifikation funktioniert real.

### Preisintegrität — sauber

Kein Pfad gefunden, auf dem ein Betrag aus dem Browser wirksam wird:
- `/api/orders` nimmt nur `productId` und `quantity`; der Preis kommt aus
  `ebayListings.priceAmountCents` bzw. aus dem serverseitig aufgelösten Angebot
- Ein angenommenes Angebot kann den Preis nur **senken**:
  `Math.min(agreed, listing.priceAmountCents)`
  ([app/api/orders/route.ts:67](app/api/orders/route.ts:67))
- `/api/paypal/orders` **rechnet die Summe aus `order_items` neu** und lehnt bei
  Abweichung ab ([Zeile 22-24](app/api/paypal/orders/route.ts:22))
- Der Capture prüft `capture.amount.value` gegen
  `centsToPayPalValue(order.totalAmountCents)`
  ([app/api/paypal/capture/route.ts:65](app/api/paypal/capture/route.ts:65))
- Ein Statusübergang `PENDING → PROCESSING` mit `changes !== 1` als Wächter
  verhindert doppelte Captures ([Zeile 59](app/api/paypal/capture/route.ts:59))

### Objektbezogene Autorisierung — kein IDOR gefunden

Jede Route, die fremde Daten liefern könnte, filtert nach dem angemeldeten
Nutzer:
`orders/release` ([Zeile 15](app/api/orders/release/route.ts:15)),
`paypal/orders` ([Zeile 18](app/api/paypal/orders/route.ts:18)),
`paypal/capture` ([Zeile 38](app/api/paypal/capture/route.ts:38)),
`price-offers` GET ([Zeile 110](app/api/price-offers/route.ts:110)) — alle mit
`eq(…userId, appUser.id)`. `acceptedOfferPrices` ebenso
([lib/price-offers.ts:34](lib/price-offers.ts:34)). **Ein fremdes Angebot lässt
sich nicht einlösen.**

### Rollenprüfung — jede Admin-Route einzeln geprüft

| Route | Prüfung |
|---|---|
| `admin/dashboard` | ✅ |
| `admin/ebay-sync` | ✅ |
| `admin/card-submissions` (DELETE) | ✅ |
| `admin/card-submissions/assets` | ✅ |
| `admin/card-submissions/cleanup` | ✅ |
| `admin/offers` (GET + POST) | ✅ |
| `admin/ebay/oauth/start` | ✅ |
| `admin/ebay/oauth/callback` | ❌ → [SEC-12](#sec-12--die-ebay-oauth-rückseite-zeigt-den-refresh-token-ohne-anmeldung) |

Die Rolle kommt ausschließlich aus der serverseitigen `ADMIN_EMAILS`-Liste und
**nur bei bestätigter E-Mail-Adresse**
([lib/app-user.ts:24](lib/app-user.ts:24)). Eine Rechteausweitung über
`user_metadata` ist nicht möglich — dort wird nur `username` und `displayName`
gelesen, nie `role`.

### Supabase — geprüft, und besser als befürchtet

Der Auftrag nennt das als „nicht untersucht". Gemessen am öffentlichen
Einstellungs-Endpunkt:

| Frage | Antwort |
|---|---|
| E-Mail-Bestätigung erzwungen? | **Ja** — `mailer_autoconfirm: false` |
| Registrierung offen? | Ja (`disable_signup: false`) — für einen Shop erwartbar |
| Anonyme Anmeldungen? | Nein |
| Fremdanbieter-Logins? | Keine aktiv, nur E-Mail |
| Datentabellen über den Publishable Key erreichbar? | **Nein** — `/rest/v1/` antwortet mit 401 |
| Row Level Security aktiv? | **Frage entfällt** — im Schema `public` gibt es überhaupt keine Tabellen (vom Betreiber am 2026-08-07 im Dashboard bestätigt: „No tables to create policies for"). Supabase wird ausschließlich zur Anmeldung genutzt, sämtliche Anwendungsdaten liegen in D1 |
| Schlüsselform | `sb_publishable_*` (neues Format), kein Legacy-JWT |

**Das entschärft das größte denkbare Risiko:** Weil `email_confirmed_at` erst
nach echter Bestätigung gesetzt wird, kann sich niemand durch Registrierung mit
einer Adresse aus `ADMIN_EMAILS` Adminrechte verschaffen. Wäre
`mailer_autoconfirm` aktiv, wäre genau das möglich gewesen — dann hätte hier ein
kritischer Befund gestanden.

Die Token-Prüfung läuft gegen `<project>/auth/v1/user`
([lib/supabase-server.ts:15](lib/supabase-server.ts:15)), also gegen die
**richtige** Projektinstanz. Ein Token aus einem fremden Supabase-Projekt wird
abgelehnt. Kein Service-Role-Key im Code oder im Client.

**Zur RLS-Frage aus Abschnitt 6.10 des Auftrags:** Sie stellt sich nicht. Das
Schema `public` enthält **keine einzige Tabelle** — Supabase dient hier
ausschließlich der Anmeldung, alle Anwendungsdaten liegen in D1. Wo keine
Tabelle steht, kann auch keine ohne Zeilenschutz stehen. Empfehlenswert bleibt
der Schalter *„Automatically enable RLS on new tables"*, damit das so bleibt,
falls dort je eine Tabelle entsteht.

**Unsicherheit, ausdrücklich benannt:** Passwortrichtlinie und Token-Laufzeit
gibt der öffentliche Endpunkt nicht preis; siehe
[Offene Unsicherheiten](#offene-unsicherheiten).

### Uploads nach R2 — die Fragen des Auftrags, einzeln beantwortet

| Frage aus 6.4 | Antwort |
|---|---|
| MIME am Inhalt oder nur am gemeldeten Wert geprüft? | **Am Inhalt.** Magic Bytes für JPEG, PNG und WebP ([Zeile 94-98](app/api/card-submissions/route.ts:94)) |
| Polyglotte Datei möglich? | Möglich (gültiger PNG-Kopf + angehängte Nutzlast), aber folgenlos: privater Bucket, Auslieferung nur über die Admin-Route mit festem `content-type` und `x-content-type-options: nosniff` |
| `Content-Length` umgehbar? | **Ja** → [SEC-08](#sec-08--die-upload-größengrenze-lässt-sich-durch-weglassen-von-content-length-umgehen) |
| Speicherschlüssel erratbar? | Nein: `card-submissions/{submissionId}/{crypto.randomUUID()}.{ext}` — zwei Zufallswerte |
| Wer kann die Objekte lesen? | Nur Admins über `/api/admin/card-submissions/assets`; der Bucket ist privat, es gibt keine öffentliche R2-Route |
| Obergrenze für die Gesamtmenge? | **Nein** → Teil von [SEC-02](#sec-02--rate-limiting-ist-in-produktion-wirkungslos) |
| Verwaiste Objekte aufgeräumt? | Ja bei Fehlschlag (Rücknahme in [Zeile 79-85](app/api/card-submissions/route.ts:79)) und über `cleanupOrphanedCardSubmissionAssets`; **nicht** nach Alter → [SEC-15](#sec-15--kein-selbstbedienungs-auskunfts--oder-löschweg-unbegrenzte-aufbewahrung) |

### Preisverhandlung — die Fragen aus 6.8, einzeln beantwortet

| Frage | Antwort |
|---|---|
| Grenze von drei Vorschlägen über zurückgezogene Angebote umgehbar? | **Nein.** `WITHDRAWN` zählt zwar nicht mit, aber es gibt **keine** Route, über die ein Kunde diesen Status setzen könnte |
| Über mehrere Konten? | Ja — die Grenze gilt je Nutzer. Das ist Absicht (jedes Konto braucht eine bestätigte E-Mail) und keine Lücke |
| Nebenläufigkeit? | Zwei gleichzeitige Anfragen können beide die Zählprüfung passieren; Ergebnis wären 4 statt 3 Vorschlägen. Folgenlos: Ein Vorschlag ist ein Vorschlag, entschieden wird er einzeln vom Admin |
| Fremdes Angebot einlösbar? | **Nein**, siehe objektbezogene Autorisierung |
| Gleichzeitig annehmen und kaufen? | Unkritisch: Der Preis wird beim Anlegen der Bestellung serverseitig aufgelöst und ist danach in `order_items` festgeschrieben. Ob das Angebot eine Sekunde früher oder später angenommen wird, ändert nur, ob der Rabatt greift — nie den Betrag nach oben |
| Abgelaufenes Angebot wiederbelebbar? | **Nein**, doppelt abgesichert: `expireLapsedOffers` im Cron **und** `expiresAt > now` bei jedem Lesevorgang ([lib/price-offers.ts:53](lib/price-offers.ts:53)). Fehlt `expiresAt`, gilt das Angebot als **nicht** gültig — die vorsichtige Richtung |
| Admin-Endpunkt gegen Rechteausweitung gesichert? | Ja; zusätzlich verhindert `inArray(status, ['NEW','IN_REVIEW'])` in der `where`-Bedingung, dass eine bereits getroffene Entscheidung überschrieben wird ([app/api/admin/offers/route.ts:72](app/api/admin/offers/route.ts:72)) |

### Der Sanitizer selbst — hält stand

Unabhängig von [SEC-01](#sec-01--der-html-sanitizer-wird-nach-seinem-lauf-wieder-aufgehoben)
(das ist ein Fehler **nach** dem Sanitizer) wurde `sanitizeHtml` mit 49
Nutzlasten aus den bekannten Umgehungsklassen beschossen: verschachtelte und
sich neu bildende Tags (`<scr<source>ipt>`), `<svg>`/MathML/`<noscript>`/
`<template>`, Anführungszeichen-Verwirrung, `javascript:` mit Steuerzeichen,
Tabulatoren und Zeilenumbrüchen, `&#x6a;avascript:`, `data:text/html`,
`data:image/svg+xml`, `xlink:href`, `srcset`, NULL-Bytes im Tagnamen,
Groß-/Kleinschreibung, Kommentare, CDATA, Stapelverwirrung durch unbalancierte
Tags und die Trunkierungsgrenze bei 200 000 Zeichen.

**Keine einzige Nutzlast kam als ausführbares Markup durch.** Der tragende
Grund ist die Bauart: Attribute werden nicht durchgereicht, sondern aus einer
Allowlist **neu serialisiert** — der Name kommt aus einer festen Menge, der Wert
wird escaped und in Anführungszeichen gesetzt. Unbekannte Tags verlieren ihre
Markup-Bedeutung im Scanner, auch wenn sie sich vorher aus Resten neu
zusammensetzen konnten.

Zwei Details, die den Test bestanden haben und deshalb erwähnenswert sind:
`safeUrl` entfernt Steuerzeichen `\x00`–`\x1f` **vor** der Protokollprüfung, und
die Prüfung ist eine Allowlist (`https?:`, `mailto:`, `//`, `/`, `#`), keine
Blockliste. Beides ist genau richtig herum.

### Weiteres, ohne Befund

- **Cron:** `scheduled()` ist von außen nicht auslösbar (kein HTTP-Pfad); Fehler
  werden gefangen und protokolliert
- **Keine `*.workers.dev`-Fläche:** `workers_dev = false`, `preview_urls = false`
  — der Worker ist ausschließlich unter `shop.brandycards.de` erreichbar
- **Protokollierung:** Keine Zugangsdaten und keine personenbezogenen Daten in
  `console.*`; alle 24 Aufrufe geprüft
- **Fehlermeldungen nach außen:** Die öffentlichen Routen geben durchweg
  allgemeine Meldungen (`jsonError` in
  [lib/public-form.ts:140](lib/public-form.ts:140)); Details bleiben im Log. Die
  einzige Route, die Interna ausgibt, ist `admin/ebay-sync`
  ([Zeile 17](app/api/admin/ebay-sync/route.ts:17)) — und die ist admin-geschützt
- **Datenmodell:** Fremdschlüssel und Löschverhalten sind durchdacht — `restrict`
  auf `reservations.productId`/`inventoryId` (verhindert Löschen unter laufender
  Reservierung), `set null` auf `orders.userId` (Bestellung überlebt die
  Kontolöschung, wichtig für Aufbewahrungspflichten), `cascade` dort, wo Daten
  ohne Elternzeile sinnlos sind. `check`-Bedingungen verhindern negative Mengen
  und Beträge
- **eBay-Outbox:** Dedupe-Schlüssel, Lease mit 10-Minuten-Verfall, Backoff,
  Endstatus nach 5 Versuchen — sauber gebaut. Bekommt nur nie einen Auftrag,
  siehe [ai-todo.md](ai-todo.md) Punkt 6 (funktionale Lücke, kein Sicherheitsbefund)

---

# Korrekturen am Prüfauftrag

Der Auftrag bittet ausdrücklich darum, eigene Irrtümer als Befund zu notieren.

### 6.7 „Origin-Prüfung nur bei vorhandenem Header" ist **kein CSRF-Befund**

`assertSameOrigin` ([lib/public-form.ts:60](lib/public-form.ts:60)) kehrt bei
fehlendem `Origin` zurück, ohne zu prüfen. Das ist trotzdem keine CSRF-Lücke:

- Die JSON-Routen verlangen `content-type: application/json`. Das ist **kein**
  CORS-sicherer Wert; ein fremder Ursprung löst damit einen Preflight aus, und
  der scheitert mangels CORS-Kopfzeilen. Die Anfrage wird nie gesendet.
- Der `multipart/form-data`-Pfad wäre als einfache Anfrage ohne Preflight
  möglich — aber alle aktuellen Browser senden bei herkunftsübergreifenden
  POST-Formularen einen `Origin`-Header. Genau dann greift die Prüfung.
- Die angemeldeten Routen tragen ihre Identität im `Authorization`-Header. Den
  kann eine fremde Seite nicht setzen; CSRF ist dort strukturell ausgeschlossen.
- Was **ohne** `Origin` durchkommt, sind Nicht-Browser-Clients: `curl`, Skripte,
  Bots. Die sind aber gar nicht das CSRF-Modell — sie sind das Mengenmodell, und
  dagegen hilft nur [SEC-02](#sec-02--rate-limiting-ist-in-produktion-wirkungslos).

**Fazit:** Die Beobachtung stimmt, die Einordnung nicht. Die eigentliche Lücke
dahinter ist das wirkungslose Rate-Limit, nicht die Herkunftsprüfung.

### 6.2 „Selbstgeschriebener Sanitizer als Hauptverdächtiger" — der Verdacht trifft den Falschen

Der Sanitizer selbst hat alle 49 Angriffe abgewehrt. Der Fehler sitzt eine Ebene
weiter, in `parseEbayDescription`, das die Arbeit des Sanitizers wieder
rückgängig macht ([SEC-01](#sec-01--der-html-sanitizer-wird-nach-seinem-lauf-wieder-aufgehoben)).
Die Lehre ist trotzdem die des Auftrags — nur genauer: Nicht der Eigenbau war das
Problem, sondern dass **nach** dem Sanitizer noch jemand am Ergebnis arbeitet.

### 6.10 „Supabase nicht untersucht" — die entscheidende Einstellung sitzt richtig

Siehe [Geprüft und unbedenklich](#supabase--geprüft-und-besser-als-befürchtet).
`mailer_autoconfirm: false` schließt den einzigen Weg, über den sich jemand
Adminrechte hätte verschaffen können.

### Veralteter Stand in `ai-handover.md`

Unter „Offene Punkte" steht: „`/api/price-offers` verlangt eine
`PRELISTED`-Produkt-ID". Das stimmt nicht mehr — die Route verlangt heute ein
Produkt mit **aktivem eBay-Listing** und lehnt Auktionen ab
([app/api/price-offers/route.ts:34](app/api/price-offers/route.ts:34)). Das
Formular existiert und ist auf der Kartendetailseite eingebunden
([app/karten/[id]/page.tsx:138](app/karten/[id]/page.tsx:138)). Kein
Sicherheitsbefund, aber irreführend für die nächste Sitzung.

---

# Offene Unsicherheiten

Ehrlich als ungeklärt markiert, statt eine Entwarnung zu geben:

1. ~~**Cloudflare-Tarif.**~~ **Geklärt am 2026-08-07: Free.**
   [SEC-05](#sec-05--apiproducts-liefert-128-kb-und-1-725-d1-zeilen-je-aufruf)
   bedeutet damit „Shop steht still", nicht „Rechnung steigt", und wurde auf
   **hoch** hochgestuft. Nebenwirkung, die im Auge zu behalten ist: Auf dem
   Free-Tarif zählen auch der stündliche eBay-Import und jeder Seitenaufruf
   gegen dieselben 5 Mio. Zeilen. Sollte der Shop wachsen, ist der
   Workers-Paid-Tarif für 5 $/Monat die einfachere Antwort als weiteres
   Sparen an Abfragen.
2. **eBay-Kontingent.** Das tatsächliche Tageslimit des Keysets ist nicht
   gemessen — dafür hätte ich gegen das echte eBay-Konto arbeiten müssen. Die
   5 000 in [SEC-04](#sec-04--jeder-kann-über-apiproductsid-ebay-kontingent-verbrennen)
   sind eBays Standardwert, nicht der bestätigte Wert dieses Kontos.
3. **Supabase-Passwortrichtlinie und Token-Laufzeit.** Der öffentliche
   Einstellungs-Endpunkt gibt beides nicht preis. Serverseitig ist nur
   `password.length >= 8` erkennbar, und das ist reine Formularprüfung. Nachsehen
   im Supabase-Dashboard unter *Authentication → Policies*: Mindestlänge,
   Prüfung gegen bekannte Leaks (HIBP), JWT-Laufzeit.
4. **HSTS.** Die Antwort trägt kein `strict-transport-security`. Ob das auf
   Zonenebene bei Cloudflare gesetzt ist, lässt sich nur im Dashboard prüfen
   (SSL/TLS → Edge Certificates → HSTS).
5. **Advisories gegen vinext.** Ob die neun `next`-Advisories aus
   [SEC-13](#sec-13--abhängigkeiten-18-offene-meldungen-next-neun-advisories-hinter-dem-patchstand)
   unter vinext auf Workers überhaupt greifen, habe ich **nicht** einzeln
   nachgeprüft. Der Patch ist billiger als die Prüfung.
6. **Verhalten bei unbehandelten Ausnahmen.** `/api/orders/release`
   ([Zeile 11](app/api/orders/release/route.ts:11)) ruft `request.json()` ohne
   `try`/`catch`. Was der vinext-Handler bei einer durchschlagenden Ausnahme
   ausliefert — allgemeiner 500er oder Stacktrace —, ist noch nicht lokal
   gemessen. Wird in Phase 3 geklärt.

---

# Phase 3 — Nachprüfung

Nach den Korrekturen wurde jeder Befund erneut angesehen: greift die Korrektur
wirklich, und ist ein Umweg offen geblieben?

## Was am laufenden System gemessen wurde

Die Prüfung lief gegen einen **lokalen** Server mit lokaler D1, nie gegen
Produktion. Dass das überhaupt ging, war selbst Arbeit — siehe
[Zwei Blocker in der Entwicklungsumgebung](#zwei-blocker-in-der-entwicklungsumgebung).

| Prüfung | Ergebnis |
|---|---|
| `wrangler deploy --dry-run` | `env.RATE_LIMITER (10 requests/60s)` und `env.RATE_LIMITER_STRICT (3 requests/60s)` werden als **Rate Limit** aufgelöst — die Konfiguration ist gültig und erreicht den Worker |
| 14× `POST /api/inquiries` von einer IP | `201 ×10`, dann `429 ×4` mit `retry-after: 60` |
| 6× `POST /api/card-submissions` | `201 ×3`, dann `429 ×3` — der strenge Tarif greift getrennt |
| Log auf die Warnung „Binding fehlt" | **0 Treffer** — es zählte das echte Binding, nicht der Rückfall |
| Honeypot gefüllt | 400 |
| Formular sofort abgeschickt | 400 |
| Zeitstempel Tage alt | 400 |
| normal ausgefülltes Formular | **201** — der Weg für Kunden bleibt offen |
| `POST /api/account/validate-registration` mit Passwort | 400 |
| dieselbe Route nur mit Benutzername | 200 |
| `multipart/form-data` mit `Transfer-Encoding: chunked` | **411**, bevor der Körper gepuffert wird |
| dasselbe mit `Content-Length` | 400 (normale Feldprüfung) — die Grenze blockiert keinen echten Upload |
| `GET /`, `/karten` | `content-security-policy-report-only`, `permissions-policy`, `referrer-policy`, `x-content-type-options`, `x-frame-options` |
| `GET /api/products` mit Daten | `cache-control: public, max-age=60, stale-while-revalidate=300` |
| `GET /api/products` ohne Datenbank | 503 mit `cache-control: no-store` — ein Ausfall wird **nicht** zwischengespeichert |
| `GET /api/products/[id]` mit dem SEC-01-Payload in der Beschreibung | `"<p>Karte ist top &lt;img src=x onerror=alert(document.domain)&gt; Ende</p>"` — escaped, Text erhalten |

## Jeder Fix mit einem Test, der ohne ihn rot ist

Verlangt war, das nachzuweisen, nicht zu behaupten. Zurückgenommen und gemessen:

| Korrektur | Ohne die Korrektur |
|---|---|
| SEC-01 (`escapeHtml` im Rückfallzweig) | 4 Tests rot, u. a. `script tag rebuilt: <p><script>alert(1)</script> Rest</p>` |
| SEC-02 (`[[ratelimits]]` in `wrangler.toml`) | `wrangler.toml declares no [[ratelimits]] at all — the limiter is inert in production` |
| SEC-03 (Obergrenze auf gehaltenen Bestand) | `an attacker still reserved the entire stock (296 of 296)` |

Die übrigen Tests wurden beim Schreiben rot gesehen, bevor die jeweilige
Korrektur stand.

## Umwege, die geprüft und für geschlossen befunden wurden

- **SEC-01, andere Wege in dieselbe Senke.** `blocks.join("\n")` gibt wörtliche
  Ausschnitte des *sanitisierten* HTML weiter und bleibt damit sicher;
  `specs` und `heading` laufen als Text durch React. Der Rückfallzweig war die
  einzige Stelle, an der aus Text wieder Markup wurde.
- **SEC-01, andere Kodierungen.** `decode()` arbeitet mit `/gi`, also greift
  `&LT;` genauso wie `&lt;` — eigener Test. Doppelt kodiertes `&amp;lt;` wird
  nur eine Ebene aufgelöst und bleibt harmlos.
- **SEC-02, Umgehung über den Schlüssel.** `x-forwarded-for` fließt nicht mehr
  ein (SEC-17). Ein Angreifer kann den Zähler damit nicht mehr je Anfrage
  zurücksetzen.
- **SEC-03, Freigabe als Umweg.** Ein Angreifer könnte seine Bestellungen über
  `/api/orders/release` freigeben, um neue anzulegen — das gibt den Bestand
  aber genau frei und bringt ihm nichts.
- **SEC-03, Reservierungen ohne Nutzer.** `reservedUnitsForUser` zählt nach
  `userId`; die Bestellroute setzt ihn immer. Es gibt keinen Pfad, der eine
  `ACTIVE`-Reservierung ohne `userId` erzeugt.
- **SEC-03, Restrisiko benannt.** Ein Konto hält weiterhin **bis zu 50 von 296
  Karten** (17 %) dauerhaft, solange es nachfasst. Mehr Konten heißt mehr
  Bestand — jedes braucht eine bestätigte E-Mail-Adresse. Wer das enger ziehen
  will, senkt `MAX_RESERVED_UNITS_PER_USER`; darunter leidet dann aber ein
  echter Großeinkauf.
- **E-2, Loch in der eigenen Korrektur.** `useFormSubmit` ruft nach Erfolg
  `form.reset()`, was den Zeitstempel auf `0` zurücksetzt — die Zeitschwelle
  hätte nur beim **ersten** Absenden je Seitenaufruf gegriffen. Der Stempel
  wird jetzt nach jedem `reset` erneuert; ein Test hält das fest.
- **E-2, keine neue Barriere.** Der Honeypot ist für Bildschirmleser über
  `aria-hidden` unsichtbar und für Passwortverwalter über `autoComplete="off"`
  gesperrt. Ein fehlender Zeitstempel — altes Cache-Exemplar, abgeschaltetes
  JavaScript — wird **nicht** gegen den Absender gewertet.

## SEC-12 bleibt offen, und warum der naheliegende Fix falsch war

Der erste Ansatz war, `requireAdmin` vor die OAuth-Rückseite zu setzen. **Das
wäre kaputt gewesen:** eBay leitet den *Browser* dorthin um, und eine Navigation
trägt keinen `Authorization`-Header — dort liegt in diesem Shop aber die
Supabase-Sitzung. Die Prüfung hätte den einzigen Weg zu einem funktionierenden
eBay-Token blockiert, ohne irgendetwas zu sichern.

Der richtige Weg wäre, den Token gar nicht erst in die Antwort auf die
Umleitung zu schreiben: Austausch hinter einer kurzlebigen Anspruchs-Kennung
parken und ihn den angemeldeten Adminbereich mit seinem Bearer-Token abholen
lassen. Das braucht einen Ablageort, also eine Migration — und die ist ein
schreibender Eingriff in die Produktionsdatenbank. Deshalb steht der Befund
weiter offen, statt halb gebaut zu sein. Die Begründung steht als Kommentar an
der Route selbst, damit die nächste Sitzung nicht denselben Irrweg nimmt.

## Zwei Blocker in der Entwicklungsumgebung

Beim Versuch, die Korrekturen lokal gegen einen laufenden Server zu prüfen,
stellte sich heraus: **`npm run dev` startete überhaupt nicht** — und zwar
schon vor dieser Sitzung, mit unveränderter `wrangler.toml` nachgemessen. Zwei
unabhängige Ursachen:

1. `vite.config.ts` deklarierte `compatibility_flags: ["nodejs_compat"]`, das
   `wrangler.toml` ebenfalls. Der Cloudflare-Plugin fügt beide zusammen, und
   die Laufzeit lehnt `["nodejs_compat", "nodejs_compat"]` ab. Behoben durch
   Streichen des Duplikats in `vite.config.ts`; `wrangler.toml` bleibt die
   einzige Quelle, wie es die README beschreibt.
2. Das in `@cloudflare/vite-plugin@1.37.1` gebündelte `workerd` unterstützte
   nur Kompatibilitätsdaten bis `2026-05-22`, das Projekt steht auf
   `2026-08-05`. Behoben durch Anheben auf `1.51.0` (und `wrangler` auf
   `4.119.0`). **Das `compatibility_date` wurde nicht angefasst** — es
   bestimmt das Verhalten in Produktion.

Kein Sicherheitsbefund, aber ohne diese beiden Schritte hätte niemand eine
Korrektur lokal nachstellen können — was der Prüfauftrag ausdrücklich verlangt.

## Was nach den Korrekturen erneut gemessen wurde

- `npx tsc --noEmit` — sauber
- `npm run lint` — 0 Fehler, 1 vorbestehende Warnung (`<img>` im Adminbereich)
- `npm test` — **85 Tests, alle grün** (vorher 63)
- `npm audit` — gesamt von 18 auf 16, *hoch* von 13 auf 8. Produktionsseitig
  bleiben 3, alle drei Bauwerkzeug, das `next` mitbringt (`postcss`, `sharp`);
  sie erreichen den Worker nicht
- Client-Bundle vollständig auf Zugangsdaten durchsucht: **kein einziger Wert
  aus `.env.local` im Bundle**, und **keine Sourcemaps** im Client-Build. Die
  Supabase-URL ist erwartungsgemäß enthalten — sie muss es sein

---

# Deploy am 2026-08-07

Die Korrekturen sind in Produktion. Zwei Deploys, weil HSTS nachgezogen wurde.

**Version 1** `1cfd52f1` · **Version 2** `650c189a` (HSTS)

## Vor dem Deploy

`npx tsc --noEmit` sauber, `npm run lint` 0 Fehler, `npm test` 98 Tests grün,
`grep -rl "supabase.co" dist/client/assets` trifft — die Client-Konfiguration
ist im Bundle, `/admin` und `/account` kommen nicht kaputt heraus.

## In Produktion nachgeprüft

| Prüfung | Ergebnis |
|---|---|
| `/account` | zeigt das Anmeldeformular, **nicht** „Supabase ist noch nicht konfiguriert" |
| `/admin` | zeigt „Bitte melde dich zuerst an" — der Client ist initialisiert |
| `/karten` | 296 Karten im Raster, 0 blockierte Ressourcen, 0 Konsolenfehler |
| Kartendetailseite mit echtem eBay-Bild | alle Bilder geladen, keine CSP-Blockade |
| `/checkout`, `/anfragen` | keine Konsolenfehler; Honeypot und Zeitstempel sind live |
| Bindings beim Deploy | `env.RATE_LIMITER (10 requests/60s)` und `env.RATE_LIMITER_STRICT (3 requests/60s)` als **Rate Limit** aufgelöst |
| Kopfzeilen an `/` | `content-security-policy` (durchsetzend), `strict-transport-security`, `referrer-policy`, `permissions-policy`, `x-content-type-options`, `x-frame-options` |
| `cache-control` auf `/api/products` | `public, max-age=60, stale-while-revalidate=300` |
| eBay-Import nach dem Deploy | Lauf um 09:00 `SUCCEEDED`, 294 aktualisiert, 2 deaktiviert, 0 Fehler |

**Das Rate-Limit wurde bewusst nicht gegen Produktion getestet** — das wäre
genau die Last, gegen die es schützt. Lokal ist es belegt: 10 Anfragen durch,
dann 429 mit `retry-after: 60`, und der strenge Tarif getrennt bei 3.

## CSP: durchsetzend, mit einer Einschränkung, die genannt gehört

Die Regel setzt seit diesem Deploy durch, nachdem jede Seite unter genau dieser
Regel durchlaufen wurde — Startseite, `/karten`, Kartendetail, `/checkout`,
`/account`, `/admin`, `/anfragen`, `/verkaufen`. Keine Blockade, kein
Konsolenfehler.

**Sie stoppt SEC-01-artige Lücken aber nicht vollständig.** vinext liefert acht
Inline-`<script>`-Blöcke je Seite (RSC-Parameter, Navigationszustand, der
Browser-Einstieg). `script-src` muss deshalb `'unsafe-inline'` tragen — und
damit sind auch Inline-Eventhandler erlaubt. Ein künftig eingeschleustes
`<img onerror=…>` **liefe**.

Was die Regel dennoch bringt, ist die zweite Hälfte eines solchen Angriffs:
`script-src 'self'` verbietet das Nachladen fremder Skripte, und `connect-src`
begrenzt das Ziel jeder Übertragung auf diese Herkunft und Supabase. Ein
gestohlenes Sitzungstoken kommt schwer heraus. Zusammen mit `frame-ancestors`,
`object-src` und `base-uri` ist das echte Tiefenverteidigung — nur nicht die
ganze Mauer.

**Die ganze Mauer braucht Nonces statt `'unsafe-inline'`**, also ein Umschreiben
jedes Inline-Skript-Tags auf dem Weg nach draußen (`HTMLRewriter` im Worker).
Das ist neue Maschinerie und gehört nicht ungetestet in denselben Durchlauf wie
ein Deploy. Steht als Aufgabe in [ai-todo.md](ai-todo.md).

## HSTS: gesetzt, in der vorsichtigen Form

Gemessen war: die Antwort trug **kein** `strict-transport-security`, HSTS war
also aus. Jetzt gesetzt als `max-age=31536000` — **ohne** `includeSubDomains`
und **ohne** `preload`. Ersteres würde jeden anderen Host unter
`brandycards.de` mitbinden, auch solche, von denen dieses Projekt nichts weiß;
Letzteres ist der einzige Schritt, der sich nicht durch einen weiteren Deploy
zurücknehmen ließe. Rückweg: `max-age=0` setzen und deployen.

## Nebenbefund: der lokale eBay-Token ist abgelaufen

`EBAY_REFRESH_TOKEN` in der lokalen `.env.local` wird von eBay mit
„invalid or was issued to another client" abgelehnt. **Produktion ist nicht
betroffen** — dort liegt der Token als Cloudflare-Secret, und der Import um
09:00 lief erfolgreich. Folge ist allein, dass sich das eBay-Kontingent von
hier aus nicht abfragen ließ und lokale Entwicklung nicht mit eBay sprechen
kann. Beim nächsten OAuth-Durchlauf im Adminbereich mit erneuern.

---

# Gesamteinschätzung

**Wo die Plattform steht:** Deutlich besser, als eine selbstgebaute
Shop-Software es üblicherweise ist. Die Stellen, an denen Geld bewegt wird, sind
mit erkennbarer Sorgfalt gebaut: Beträge werden nie aus dem Browser übernommen,
der Webhook wird echt verifiziert und ist idempotent, Statusübergänge sind mit
`changes !== 1`-Wächtern gegen Nebenläufigkeit gesichert, jede Route filtert nach
dem angemeldeten Nutzer. Es gibt kein SQL-Injection-Problem, kein IDOR und keinen
Weg zur Rechteausweitung. Der viel gescholtene eigene Sanitizer ist tatsächlich
solide.

**Das größte Einzelrisiko** ist nicht eine einzelne Lücke, sondern ein Muster:
**Der Shop hat keine wirksame Mengenbegrenzung.** `/api/products`,
`/api/products/[id]`, `/api/orders` und die drei Formularrouten sind alle ohne
funktionierende Bremse erreichbar — und drei davon kosten je Aufruf messbar Geld
oder Bestand. Das Rate-Limit, das es geben sollte, ist seit dem ersten Deploy
wirkungslos und meldet das nicht. Ein einzelnes Skript kann damit an einem
Nachmittag das D1-Tageskontingent aufbrauchen, das eBay-Kontingent verbrennen
oder den gesamten Bestand für Stunden blockieren — ohne eine einzige Zeile
Angriffscode, nur mit Wiederholung.

Der **schwerwiegendste einzelne Fehler** ist
[SEC-01](#sec-01--der-html-sanitizer-wird-nach-seinem-lauf-wieder-aufgehoben):
Ein Filter, der korrekt arbeitet, dessen Ergebnis aber danach wieder aufgehoben
wird. Er steht nicht ganz oben, weil sein Eingabeweg über eBay führt — aber wenn
er greift, ist die Folge Kontoübernahme, nicht ein Schönheitsfehler.

**Empfohlene Reihenfolge:**

| # | Befund | Warum an dieser Stelle |
|---|---|---|
| 1 | [SEC-01](#sec-01--der-html-sanitizer-wird-nach-seinem-lauf-wieder-aufgehoben) | Höchster Schaden je Vorfall, Korrektur ist klein und risikolos |
| 2 | [SEC-02](#sec-02--rate-limiting-ist-in-produktion-wirkungslos) | Voraussetzung für SEC-03, SEC-04 und die Formularrouten |
| 3 | [SEC-03](#sec-03--ein-einziges-konto-kann-den-gesamten-bestand-blockieren) | Direkter Umsatzausfall, billig auslösbar |
| 4 | [SEC-05](#sec-05--apiproducts-liefert-128-kb-und-1-725-d1-zeilen-je-aufruf) | Eine Kopfzeile `cache-control` nimmt den größten Teil der Last weg |
| 5 | [SEC-04](#sec-04--jeder-kann-über-apiproductsid-ebay-kontingent-verbrennen) | Schützt den Import — und damit indirekt vor Doppelverkäufen |
| 6 | [SEC-06](#sec-06--keine-einzige-sicherheits-kopfzeile) | Schadensbegrenzung für alles Künftige; CSP getrennt entscheiden |
| 7 | [SEC-07](#sec-07--die-registrierung-schickt-das-klartextpasswort-an-den-eigenen-server), [SEC-11](#sec-11--toter-authentifizierungscode-der-http-kopfzeilen-vertraut), [SEC-12](#sec-12--die-ebay-oauth-rückseite-zeigt-den-refresh-token-ohne-anmeldung) | Je Minuten Aufwand, kein Risiko |
| 8 | [SEC-08](#sec-08--die-upload-größengrenze-lässt-sich-durch-weglassen-von-content-length-umgehen), [SEC-09](#sec-09--jede-angemeldete-anfrage-schreibt-in-users-und-ruft-supabase), [SEC-10](#sec-10--bestandsbuchung-liest-und-schreibt-absolute-mengen), [SEC-17](#sec-17--rate-limit-schlüssel-vertraut-auf-x-forwarded-for) | Kleine Härtungen, mitzuerledigen |
| 9 | [SEC-13](#sec-13--abhängigkeiten-18-offene-meldungen-next-neun-advisories-hinter-dem-patchstand), [SEC-14](#sec-14--ci-prüft-weder-typen-noch-abhängigkeiten-actions-sind-nicht-gepinnt) | Wirkt erst mit dem nächsten Deploy |
| 10 | [SEC-15](#sec-15--kein-selbstbedienungs-auskunfts--oder-löschweg-unbegrenzte-aufbewahrung), [SEC-16](#sec-16--bilder-kommen-direkt-von-ebays-cdn) | Vor dem Verkaufsstart, nicht davor |

**Ein Satz zum Schluss:** Der Shop ist nicht offen wie ein Scheunentor — er ist
an den teuren Stellen sorgfältig gebaut. Was fehlt, ist die Bremse. Nichts hier
verlangt einen Umbau; die drei wichtigsten Korrekturen sind zusammen weniger als
ein Arbeitstag.

---

## Nachtrag nach Phase 3

Die Bremse ist eingebaut. 15 von 17 Befunden sind geschlossen, einer
(SEC-15) wartet auf eine Festlegung des Betreibers, einer (SEC-12) bleibt
bewusst offen, weil die richtige Lösung eine Migration braucht und der
naheliegende Fix den eBay-Anschluss zerstört hätte.

**Das Bild hat sich damit verschoben.** Vor der Prüfung war das größte Risiko
die fehlende Mengenbegrenzung — jede öffentliche Route war ohne Bremse
erreichbar. Danach ist das größte verbleibende Risiko ein anderes, und es ist
kein Codeproblem:

> **Nichts davon wirkt, bevor deployed wurde.** Das Rate-Limit lebt vom
> Binding, und das Binding entsteht erst beim Deploy. Bis dahin steht in
> Produktion exakt der Code, den diese Prüfung als angreifbar beschrieben hat.

Danach bleiben zwei Dinge offen, in dieser Reihenfolge:

1. **Die CSP scharf schalten.** Sie läuft berichtend, was heute nichts
   verhindert. Erst wenn sie durchsetzt, ist SEC-01 auch gegen den nächsten
   Fehler dieser Art abgesichert — und XSS bedeutet hier Kontoübernahme.
2. **SEC-12 richtig schließen**, beim nächsten ohnehin nötigen Schemaschritt.

*(Punkt 1 ist am selben Tag erledigt worden, siehe
[Deploy](#deploy-am-2026-08-07) — allerdings mit einer Einschränkung, die dort
benannt ist.)*

**Nachtrag 2026-08-07, zweite Runde.** Der Betreiber hat die offenen
Entscheidungen getroffen. Damit sind SEC-15 (90 Tage Aufbewahrung) und SEC-16
(Datenschutztext) umgesetzt — **16 von 17 Befunden geschlossen.**

Der bestätigte **Free-Tarif** verschiebt das Bild noch einmal: SEC-05 ist kein
Kostenproblem, sondern ein Ausfallproblem. Rund 2 900 Aufrufe eines
ungeschützten Endpunkts legen den ganzen Shop für den Rest des Tages still.
Zusammen mit dem bislang wirkungslosen Rate-Limit war das der billigste Weg,
den Laden zuzumachen — und beides wird erst durch den Deploy behoben.

Was diese Prüfung **nicht** beantwortet hat, steht unter
[Offene Unsicherheiten](#offene-unsicherheiten).

**Nachtrag 2026-08-07, dritte Runde: deployed.** Beide Versionen sind live,
alles in Produktion nachgeprüft — Einzelheiten unter
[Deploy](#deploy-am-2026-08-07). Damit wirkt zum ersten Mal, was hier steht:
das Rate-Limit hat sein Binding, der Katalog wird am Rand zwischengespeichert,
die Kopfzeilen sind gesetzt, und die CSP setzt durch.

Von den drei offenen Nachschlagearbeiten sind zwei erledigt: HSTS war **aus**
und ist jetzt gesetzt; das eBay-Kontingent ließ sich nicht abfragen, weil der
Token in der lokalen `.env.local` abgelaufen ist (Produktion ist gesund). Offen
bleibt allein die **Supabase-Passwortrichtlinie** — sie ist über keinen
öffentlichen Endpunkt lesbar, und die einzige Alternative wäre gewesen, mit
schwachen Passwörtern Konten in der Produktions-Instanz anzulegen. Das ist
nachzusehen unter *Authentication → Policies*: Mindestlänge, Prüfung gegen
bekannte Leaks, JWT-Laufzeit.

**Was jetzt noch aussteht, ist keine Lücke, sondern eine Steigerung:** Die CSP
trägt `'unsafe-inline'` für Skripte, weil vinext acht Inline-Skripte je Seite
ausliefert. Das lässt Inline-Eventhandler zu. Der Weg dahin — Nonces statt
`'unsafe-inline'` — ist neue Maschinerie im Worker und gehört in einen eigenen,
getesteten Durchlauf.

---

# Wartet auf Entscheidung

Diese Punkte ändern die Bedienung, verursachen laufende Kosten, binden fremde
Dienste ein oder greifen in Produktionsdaten ein. Sie werden **nicht**
eigenmächtig umgesetzt.

**Stand 2026-08-07:** Alle vorgelegten Punkte sind entschieden. Was der
Betreiber gewählt hat, steht jeweils direkt beim Punkt.

| Punkt | Entscheidung |
|---|---|
| E-1 Content-Security-Policy | **a, dann b** — erst berichtend, nach Auswertung durchsetzend |
| E-2 Bot-Schutz | **b + c** — Honeypot und Zeitschwelle, kein Turnstile |
| E-3 Seitenaufteilung | **nicht** — Zwischenspeicherung löst es billiger |
| E-4 Spalte `description_fetched_at` | **warten** auf den nächsten Schemaschritt |
| E-5 Cron auf 10 Minuten | offen — hängt an der eBay-Kontingentfrage |
| E-6 Deploy | **der Betreiber deployt selbst** |
| SEC-15 Aufbewahrungsfrist | **90 Tage** — umgesetzt |
| SEC-16 Datenschutztext | **ergänzen** — umgesetzt |
| SEC-12 Migration | **warten** auf den nächsten Schemaschritt |
| Cloudflare-Tarif | **Free** — SEC-05 auf hoch hochgestuft |

### E-1 — Content-Security-Policy · **entschieden: erst a, später b**

Wäre die wirksamste einzelne Härtung (siehe
[SEC-01](#sec-01--der-html-sanitizer-wird-nach-seinem-lauf-wieder-aufgehoben)),
kann den Shop aber unbrauchbar machen, wenn sie zu streng ausfällt. Optionen:

| Option | Wirkung | Risiko |
|---|---|---|
| **a) Nur `Report-Only`** | sammelt Verstöße, blockiert nichts | keins — aber schützt auch nicht |
| **b) Durchsetzend, mit `'unsafe-inline'` für Styles** | blockiert fremde Skripte, erlaubt React/vinext-Inline-Styles | gering; muss gegen das echte Bundle getestet werden |
| **c) Durchsetzend mit Nonces** | strengste Variante | vinext müsste Nonces durchreichen — offen, ob es das kann |

Empfehlung: **b**, nach einem Testlauf mit **a**.
Zu beachten: `img-src` muss `https://i.ebayimg.com` und `data:` erlauben,
`connect-src` die Supabase-Projektdomäne.

### E-2 — Bot-Schutz auf den öffentlichen Formularen (Auftrag 6.5) · **entschieden: b + c, umgesetzt**

Auch ein funktionierendes Rate-Limit ist nur die halbe Antwort. Optionen:

| Option | Bedienung | Kosten | Wirkung |
|---|---|---|---|
| **a) Cloudflare Turnstile** | sichtbares Widget, meist ohne Klick | kostenlos | hoch |
| **b) Honeypot-Feld** | unsichtbar, keine Änderung für Kunden | keine | mittel — hält einfache Bots |
| **c) Zeitschwelle** (Formular < 2 s abgeschickt) | unsichtbar | keine | niedrig bis mittel |
| **d) Nur Rate-Limit** | keine Änderung | keine | begrenzt |

Empfehlung: **b + c sofort** (unsichtbar, kostenlos, keine Verhaltensänderung) —
**a** erst, wenn tatsächlich Missbrauch auftritt. Turnstile ist ein zusätzlicher
Fremddienst und in der Datenschutzerklärung anzugeben.

### E-3 — Seitenaufteilung für `/api/products` (Teil von SEC-05)

Ändert `/karten` spürbar: Die Suche läuft heute clientseitig über den kompletten
Katalog. Mit Seitenaufteilung müsste sie serverseitig werden. Empfehlung:
**vorerst nicht** — `cache-control` löst das Problem billiger und ohne
Verhaltensänderung.

### E-4 — Spalte `description_fetched_at` (dauerhafte Lösung für SEC-04)

Braucht eine Migration und damit einen **schreibenden Eingriff in die
Produktionsdatenbank**. Zusätzlich ist `drizzle/meta/_journal.json` veraltet
(siehe [CLAUDE.md](../CLAUDE.md)), das müsste zuerst nachgezogen werden.
Empfehlung: erst das Rate-Limit, die Spalte beim nächsten ohnehin nötigen
Schemaschritt.

### E-5 — Cron auf 10 Minuten

Steht als Punkt 1 in [ai-todo.md](ai-todo.md) und würde das Zeitfenster in
[SEC-03](#sec-03--ein-einziges-konto-kann-den-gesamten-bestand-blockieren) von
75 auf 25 Minuten verkürzen. Sechsfacher eBay-API-Verbrauch — das ist eine
Abwägung gegen [SEC-04](#sec-04--jeder-kann-über-apiproductsid-ebay-kontingent-verbrennen)
und gehört gemeinsam entschieden.

### E-6 — Deploy · **entschieden: der Betreiber deployt selbst**

Keine der Korrekturen wirkt in Produktion ohne Deploy — SEC-02 wirkt
**ausschließlich** durch ihn, weil das Binding zur Laufzeit kommt.

Schrittfolge, aus dem **Hauptverzeichnis** (nicht aus einem Worktree — die
ignorierte `.env.local` wird dorthin nicht vererbt, und genau so ging schon
ein Deploy schief):

```bash
git checkout agent/initial-brandycards && git pull && ls .env.local && npm ci && npx tsc --noEmit && npm run lint && npm test && grep -rl "supabase.co" dist/client/assets && npx wrangler deploy
```

Der `grep` ist die Probe aufs Exempel: Findet er nichts, fehlte `.env.local`
beim Build, und `/admin` sowie `/account` kommen kaputt heraus, während
Startseite und `/api/*` gesund aussehen.

**Nach dem Deploy prüfen** — in dieser Reihenfolge, weil die ersten beiden auch
dann gesund aussehen, wenn das Bundle kaputt ist:

1. `https://shop.brandycards.de/account` lädt und zeigt das Anmeldeformular
   (**nicht** „Supabase ist noch nicht konfiguriert")
2. `https://shop.brandycards.de/admin` nach Anmeldung zeigt die Übersicht
3. Kopfzeilen sind da:
   ```bash
   curl -sI https://shop.brandycards.de/ | grep -iE "content-security-policy|referrer-policy|x-content-type|permissions-policy|x-frame"
   ```
4. Der Katalog wird zwischengespeichert:
   ```bash
   curl -sI https://shop.brandycards.de/api/products | grep -i cache-control
   ```
5. Im Cloudflare-Dashboard unter *Workers → brandycards-webshop → Settings →
   Bindings* stehen **RATE_LIMITER** und **RATE_LIMITER_STRICT**

**Das Rate-Limit nicht gegen Produktion testen.** Es ist lokal nachgewiesen
(10 Anfragen durch, dann 429 mit `retry-after: 60`); ein Test gegen die
Produktion wäre genau die Last, gegen die es schützt.

**Danach:** Die CSP läuft berichtend. Nach ein paar Tagen die Browser-Konsole
auf `Content-Security-Policy-Report-Only`-Meldungen ansehen; sind sie ruhig,
`CSP_HEADER_NAME` in [lib/security-headers.ts](../lib/security-headers.ts) auf
`content-security-policy` umstellen und erneut deployen. Erst dann greift der
Schutz.
