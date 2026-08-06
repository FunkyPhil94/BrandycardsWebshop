# Offene Aufgaben

Arbeitsvorrat für kommende KI-Sitzungen. Von oben nach unten abarbeiten — die
Reihenfolge ist bewusst nach Nutzen und Risiko sortiert, nicht nach Aufwand.

**Vor jedem Punkt:** Eintrag in [ai-handover.md](ai-handover.md) anlegen (Regel
in [CLAUDE.md](../CLAUDE.md)). **Nach jedem Punkt:** Ergebnis nachtragen,
committen und pushen. Erledigte Punkte wandern nach unten unter „Erledigt".

Jede Aufgabe steht für sich: Datei-Hinweise, Begründung und Abnahmekriterien
stehen dabei, damit niemand den Gesprächsverlauf braucht.

---

## 1. Checkout zeigt den ausgehandelten Preis

**Warum:** Nach einer angenommenen Preisverhandlung zeigt der Checkout weiterhin
den Listenpreis. Der Rabatt taucht erst in der Serverantwort und bei PayPal auf.
Kunden zahlen nie zu viel, sehen den Vorteil aber zu spät — und in Deutschland
ist eine transparente Preisangabe vor dem Bestellabschluss auch rechtlich das
saubere Vorgehen.

**Stand:** `app/checkout/page.tsx` rechnet Zwischensumme und Gesamt clientseitig
aus `product.priceAmountCents`. Die serverseitige Auflösung liegt in
`lib/price-offers.ts` (`acceptedOfferPrices`) und wird von
`app/api/orders/route.ts` benutzt.

**Vorgehen:** Eine Route wie `GET /api/account/offers` bauen, die für den
angemeldeten Nutzer alle angenommenen, unverfallenen Angebote als
`productId → Betrag` liefert. Der Checkout ruft sie auf und zeigt je Position
den ausgehandelten Preis, den durchgestrichenen Listenpreis und die Ersparnis.

**Achtung:** Die Anzeige bleibt reine Darstellung. Der verbindliche Preis wird
weiterhin ausschließlich serverseitig in `app/api/orders/route.ts` bestimmt —
niemals einen Betrag aus dem Browser übernehmen.

**Fertig, wenn:** Ein Konto mit angenommenem Angebot sieht im Checkout denselben
Betrag, den die Bestellung anschließend tatsächlich berechnet.

---

## 2. Doppelverkaufsrisiko entschärfen

**Warum:** Alle 296 Karten sind Einzelstücke und stehen gleichzeitig hier und
auf eBay. Beide Richtungen können kollidieren:

- **Richtung A — auf eBay verkauft, Shop weiß es nicht.** Der Import läuft
  stündlich; bis zu 60 Minuten lang ist die Karte hier noch kaufbar.
- **Richtung B — im Shop verkauft, eBay weiß es nicht.** Der Schreibpfad ist
  unterbrochen: `mapActiveListing` in `lib/ebay-sync.ts` setzt `ebayOfferId` fest
  auf `null`, weil `GetMyeBaySelling` nur eine ItemID liefert. Dadurch bekommt
  `enqueueEbayWithdraw` nie einen Auftrag. Aktuell nur dadurch entschärft, dass
  `EBAY_WRITE_ENABLED=false` steht.

**Empfohlene Reihenfolge — klein anfangen, das meiste Risiko fällt zuerst weg:**

**2a. Live-Bestandsprüfung unmittelbar vor der Zahlung** *(größter Nutzen, kleinster Aufwand)*
Vor dem Anlegen der PayPal-Bestellung — besser noch vor dem Capture in
`app/api/paypal/capture/route.ts` — für die betroffenen Karten ein `GetItem`
gegen eBay und prüfen, ob `QuantityAvailable > 0`. Ein Aufruf je Karte, nur im
Moment der Kaufentscheidung. Das schließt Richtung A fast vollständig, weil
genau dann geprüft wird, wenn Geld fließt. `getEbayItemDescription` in
`lib/ebay-client.ts` zeigt bereits, wie ein `GetItem`-Aufruf aussieht.

**2b. Sync häufiger laufen lassen**
`crons = ["0 * * * *"]` in `wrangler.toml` auf `*/10 * * * *` stellen. Der Lauf
dauert rund 30 Sekunden, das trägt problemlos. Verkleinert das Fenster in
Richtung A von 60 auf 10 Minuten. Eine Zeile Änderung.

**2c. Schreibpfad reparieren** *(löst Richtung B, der größere Brocken)*
Die Outbox in `lib/ebay-outbox.ts` ist fertig — Dedupe-Key, Lease, Backoff,
Fehlerstatus — und wartet nur auf Aufträge. Zu ändern sind Operation und
Identifikator: statt Inventory-API `offer/{offerId}/withdraw` die Trading-API
mit der ItemID. Zwei Varianten:

- `ReviseInventoryStatus` mit Menge 0 — **umkehrbar**. Läuft eine Bestellung ins
  Leere oder verfällt die Reservierung, lässt sich die Menge zurücksetzen.
  Deshalb die sicherere Wahl für den ersten Schritt.
- `EndItem` / `EndFixedPriceItem` — beendet das Angebot endgültig, Wiedereinstellen
  nur als neues Listing mit neuer ItemID.

Vorher den benötigten OAuth-Scope prüfen und `EBAY_WRITE_ENABLED` erst
umstellen, wenn der Weg an **einer** Testkarte nachgewiesen ist. Der Schalter
existiert genau dafür.

**Fertig, wenn:** 2a und 2b laufen; 2c mindestens an einer Karte nachgewiesen,
bevor `EBAY_WRITE_ENABLED=true` gesetzt wird.

---

## 3. Kunden-E-Mails

**Warum:** Preisvorschläge werden aktuell still entschieden. Der Kunde muss von
sich aus auf die Kartenseite zurückkehren, um zu sehen, ob angenommen wurde.

**Fehlt komplett:** Es gibt keinerlei Versand-Infrastruktur. Supabase verschickt
nur seine eigenen Anmelde-Mails. Für eigene Nachrichten braucht es einen
Anbieter — auf Cloudflare Workers bieten sich Resend oder MailChannels an. Der
API-Schlüssel gehört als Cloudflare-Secret hinterlegt, niemals ins Repository.

**Anlässe, nach Wichtigkeit:**
1. Preisvorschlag angenommen (mit Betrag, Gültigkeit und Link zur Karte)
2. Preisvorschlag abgelehnt
3. Bestellbestätigung nach erfolgreicher Zahlung
4. Eingangsbestätigung für Anfrage und Kartenankauf

**Ton:** Professionell, aber nicht steif — BrandyCards ist ein Familienprojekt
zweier Brüder, das darf man hören. Kein „Sehr geehrte Damen und Herren", kein
Behördendeutsch. Persönlich, knapp, freundlich, geduzt wie im übrigen Shop.

**Nicht vergessen:** Pflichtangaben im Fußbereich (Impressum-Link), Abmeldung
ist bei transaktionalen Mails nicht nötig, bei Werbung schon. Fehlgeschlagener
Versand darf **nie** die auslösende Aktion scheitern lassen — Muster wie bei der
Beschreibungsabfrage in `app/api/products/[id]/route.ts`: Fehler protokollieren,
Ablauf fortsetzen.

---

## 4. Verhandeln auf der Seite bewerben

**Warum:** Die Funktion existiert, aber niemand erfährt davon. Genau sie ist die
Antwort auf „warum hier bestellen statt auf eBay".

**Wo:**
- Landingpage: ein eigener Abschnitt oder eine Erweiterung der Verweiskacheln
- `/karten`: ein Hinweis über dem Raster
- Kartendetailseite: das Angebotsformular ist da, darf aber deutlicher einladen

**Botschaft:** Jeder Preis kann so angenommen **oder** verhandelt werden. Der
Gedanke dahinter ist, dem Hobby etwas zurückzugeben — das ist der eigentliche
Grund und darf ruhig so gesagt werden. Regeln transparent nennen: nur mit
Kundenkonto, drei Vorschläge je Karte, angenommene Preise gelten 48 Stunden.

**Achtung:** Bei Auktionen gibt es kein Verhandeln, dort wird auf eBay geboten.
Der Text darf das nicht versprechen.

---

## 5. Englische Sprachversion

**Warum:** Ausdrücklich für später vorgesehen. Sammelkarten sind ein
internationaler Markt.

**Umfang, ehrlich:** Das ist die größte Aufgabe auf dieser Liste. Sämtliche
Oberflächentexte liegen fest verdrahtet in den Komponenten, dazu die
Fehlermeldungen der API-Routen (`lib/public-form.ts` und alle Routen) sowie die
Rechtstexte. Erst Bestandsaufnahme, dann entscheiden.

**Zu klären, bevor irgendetwas gebaut wird:**
- Nur Oberfläche, oder auch Rechtstexte? Letztere brauchen fachliche Prüfung.
- Kartentitel und eBay-Beschreibungen kommen von eBay und sind deutsch — die
  lassen sich nicht mitübersetzen. Wie geht der Shop damit um?
- Wie soll die Sprache in der URL erscheinen (`/en/...`) oder gar nicht?
- Preise und Versandkosten bleiben in Euro.

**Empfehlung:** Vor der Umsetzung ausdrücklich mit dem Nutzer abstimmen. Ohne
Bibliothek anfangen wäre ein Fehler; vinext/Next.js bringt Routing-Bausteine
mit, die dafür gedacht sind.

---

## Dauerregeln

- **Alles committen und pushen.** Am Ende jeder Sitzung darf nichts unversioniert
  liegen bleiben. Prüfen mit `git status --short` und
  `git log --oneline origin/agent/initial-brandycards..HEAD` — beides muss leer
  sein. Der lokale DNS-Resolver fällt sporadisch aus, `git push` daher notfalls
  wiederholen.
- **Vor jedem Deploy:** `.env.local` muss im Build-Verzeichnis liegen, sonst
  brechen `/admin` und `/account`. Danach `npx tsc --noEmit`, `npm run lint`,
  `npm test` — CI prüft keine Typen.
- **Produktionsdaten** nur lesend anfassen, schreibende Eingriffe nach Rücksprache.

---

## Erledigt

_(Erledigte Punkte hierher verschieben, mit Datum und Commit.)_
