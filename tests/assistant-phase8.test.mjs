import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  ASSISTANT_TOOL_DEFINITIONS,
  ASSISTANT_TOOL_NAMES,
  ASSISTANT_UNAVAILABLE_CODES,
  parseAssistantToolInput,
  availableAssistantResult,
  unavailableAssistantResult,
} = await import("../lib/assistant/contracts.ts");
const { ebayReadAvailability } = await import("../lib/assistant/ebay-availability.ts");
const { formatAssistantToolResult, ASSISTANT_TOOL_LABELS } = await import("../lib/assistant/response-formatter.ts");
const { RuleBasedAssistantPlanner } = await import("../lib/assistant/planner.ts");
const { isEbayReadSyncDue, readSyncFailure, EBAY_READ_SYNC_INTERVAL_MS, EBAY_READ_SYNC_BLOCKED_BACKOFF_MS } =
  await import("../lib/ebay-read-sync.ts");
const { EbayReadError } = await import("../lib/ebay-read-api.ts");

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const plan = async (frage) => (await new RuleBasedAssistantPlanner().plan(frage)).tools.map((tool) => tool.tool);

// ---------------------------------------------------------------------------
// Die drei neuen Fragen
// ---------------------------------------------------------------------------

test("die drei Phase-8-Fragen finden ihre Werkzeuge", async () => {
  // **Wortlaut wie gefragt wird**, mit Umlauten: `normalizeQuestion` faltet
  // Diakritika (ä -> a), aber nicht die Ersatzschreibweise „ae".
  assert.deepEqual(await plan("Welche meiner Angebote haben die meisten Aufrufe?"), ["ebay_most_viewed"],
    "„Angebote\" enthaelt „gebot\" -- diese Frage darf keine Preisvorschlaege nach sich ziehen");
  assert.deepEqual(await plan("Gibt es neue eBay-Nachrichten?"), ["ebay_messages"]);
  // Ohne Nennung einer Seite sind **beide** Quellen gemeint. Nur eine zu
  // beantworten hiesse, die andere stillschweigend zu verschweigen.
  assert.deepEqual(await plan("Gibt es neue Käufer-Preisvorschläge?"), ["open_shop_offers", "ebay_buyer_offers"]);
});

test("eine ausdruecklich genannte Seite grenzt die Preisvorschlaege ein", async () => {
  assert.deepEqual(await plan("Gibt es neue eBay-Preisvorschläge?"), ["ebay_buyer_offers"]);
  assert.deepEqual(await plan("Welche Preisvorschläge liegen im Shop?"), ["open_shop_offers"]);
});

test("Umschreibungen der Aufrufzahlen treffen dasselbe Werkzeug", async () => {
  for (const frage of [
    "Welche Karte wurde am haeufigsten angesehen?",
    "Wie viele Views hatte mein bestes Angebot?",
    "Zeig mir die Einblendungen meiner Angebote",
    "Welches Angebot hat die meisten Klicks?",
  ]) {
    assert.ok((await plan(frage)).includes("ebay_most_viewed"), frage);
  }
});

test("die Frage nach fehlenden eBay-Daten fragt alle drei Quellen ab", async () => {
  assert.deepEqual(await plan("Welche eBay Daten fehlen?"), ["ebay_most_viewed", "ebay_messages", "ebay_buyer_offers"]);
});

test("Shop-Fragen ziehen keine eBay-Werkzeuge nach", async () => {
  assert.deepEqual(await plan("Was wurde zuletzt verkauft?"), ["latest_sale"]);
  assert.deepEqual(await plan("Gibt es neue Shop-Anfragen?"), ["new_shop_inquiries"]);
});

// ---------------------------------------------------------------------------
// UNAVAILABLE: die sechs Gruende bleiben unterscheidbar
// ---------------------------------------------------------------------------

test("jeder Zustand einer eBay-Lesequelle bekommt einen eigenen Grund", () => {
  const fuer = (status, lastSuccessAt = null) => ebayReadAvailability({ status, lastSuccessAt }, "eBay-Postfach");

  assert.deepEqual(fuer("OK", "2026-08-16T09:00:00.000Z"), { available: true, freshness: "2026-08-16T09:00:00.000Z" });
  assert.equal(fuer("NOT_CONFIGURED").code, "SOURCE_NOT_CONNECTED");
  assert.equal(fuer("SCOPE_NOT_GRANTED").code, "SCOPE_NOT_GRANTED");
  assert.equal(fuer("RATE_LIMITED").code, "RATE_LIMITED");
  assert.equal(fuer("UPSTREAM_ERROR").code, "UPSTREAM_ERROR");
  // **Der Fall, um den es geht.** Keine Zeile in der Tabelle kann heissen
  // "Postfach leer" oder "nie nachgesehen". Ohne diesen Zweig waeren beide
  // ununterscheidbar, und die Antwort waere geraten.
  assert.equal(ebayReadAvailability(undefined, "eBay-Postfach").code, "NOT_SYNCED");

  for (const code of ASSISTANT_UNAVAILABLE_CODES) {
    assert.equal(typeof code, "string");
  }
});

test("bei den Aufrufzahlen nennt der Scope-Fehler den konkreten Weg heraus", () => {
  const aufrufe = ebayReadAvailability({ status: "SCOPE_NOT_GRANTED", lastSuccessAt: null }, "Aufrufzahlen");
  assert.match(aufrufe.message, /sell\.analytics\.readonly/u);
  assert.match(aufrufe.message, /erneuert werden/u, "ein Scope laesst sich nicht nachtraeglich anheften");

  // Bei den anderen beiden waere derselbe Satz eine Vermutung -- die
  // Trading-Aufrufe kommen mit dem Basis-Scope aus.
  const postfach = ebayReadAvailability({ status: "SCOPE_NOT_GRANTED", lastSuccessAt: null }, "eBay-Postfach");
  assert.doesNotMatch(postfach.message, /sell\.analytics\.readonly/u);
});

test("ein alter Stand wird nicht als aktueller ausgegeben", () => {
  const alt = ebayReadAvailability({ status: "RATE_LIMITED", lastSuccessAt: "2026-08-01T00:00:00.000Z" }, "eBay-Postfach");
  assert.equal(alt.available, false);
  assert.match(alt.message, /älterer Stand vor/u);
  assert.equal(Object.hasOwn(alt, "freshness"), false, "ein unverfuegbares Ergebnis hat keinen Datenstand");
});

test("eBay-Fehlertexte gelangen nicht in die Antwort", () => {
  const roh = "The requested scope is invalid, unknown, malformed, or exceeds the scope granted to the client";
  const antwort = ebayReadAvailability({ status: "UPSTREAM_ERROR", lastSuccessAt: null }, "Kaeufer-Preisvorschlaege");
  assert.doesNotMatch(antwort.message, /scope granted to the client/u);
  assert.equal(antwort.message.includes(roh), false);
  assert.match(antwort.message, /fehlgeschlagen/u);
});

// ---------------------------------------------------------------------------
// Antwortformatierung: Quelle, Stand, Leerzustand
// ---------------------------------------------------------------------------

const quelleUndStand = /Quelle: .+ · Stand: .+/u;

test("jede der drei Antworten nennt Quelle und Datenstand", () => {
  const ergebnisse = [
    availableAssistantResult("ebay_most_viewed", { rangeStart: "20260717", rangeEnd: "20260815", listings: [] }, ["EBAY_READ_API"], "2026-08-16T09:00:00.000Z"),
    availableAssistantResult("ebay_messages", { unreadCount: 0, messages: [] }, ["EBAY_READ_API"], "2026-08-16T09:00:00.000Z"),
    availableAssistantResult("ebay_buyer_offers", { offers: [] }, ["EBAY_READ_API"], "2026-08-16T09:00:00.000Z"),
  ];
  for (const ergebnis of ergebnisse) {
    const text = formatAssistantToolResult(ergebnis);
    assert.match(text, quelleUndStand, ergebnis.tool);
    assert.match(text, /eBay-Leseschnittstelle/u);
  }
});

test("Leerzustaende werden als solche ausgesprochen, nicht als leere Liste", () => {
  assert.match(
    formatAssistantToolResult(availableAssistantResult("ebay_most_viewed", { rangeStart: null, rangeEnd: null, listings: [] }, ["EBAY_READ_API"], null)),
    /keinem Angebot Aufrufzahlen gemeldet/u,
  );
  assert.match(
    formatAssistantToolResult(availableAssistantResult("ebay_messages", { unreadCount: 0, messages: [] }, ["EBAY_READ_API"], null)),
    /keine eBay-Nachrichten vor/u,
  );
  assert.match(
    formatAssistantToolResult(availableAssistantResult("ebay_buyer_offers", { offers: [] }, ["EBAY_READ_API"], null)),
    /keine offenen Kaeufer-Preisvorschlaege|keine offenen Käufer-Preisvorschläge/u,
  );
});

test("die Aufrufzahlen nennen den Zeitraum, weil eine Summe ohne Fenster keine Auskunft ist", () => {
  const text = formatAssistantToolResult(availableAssistantResult("ebay_most_viewed", {
    rangeStart: "20260717",
    rangeEnd: "20260815",
    listings: [
      { ebayItemId: "1", title: "Lamine Yamal Finest", listingUrl: null, viewsTotal: 412, impressionsTotal: 9000 },
      { ebayItemId: "2", title: null, listingUrl: null, viewsTotal: 7, impressionsTotal: null },
    ],
  }, ["EBAY_READ_API"], "2026-08-16T09:00:00.000Z"));

  assert.match(text, /vom 17\.07\.2026 bis 15\.08\.2026/u);
  assert.match(text, /Lamine Yamal Finest: 412 Aufrufe, 9000 Einblendungen/u);
  // Ohne Titel bleibt die Angebotsnummer -- besser als eine erfundene
  // Bezeichnung, und wiederauffindbar.
  assert.match(text, /eBay-Angebot 2: 7 Aufrufe$/mu);
});

test("eine nicht gemeldete Aufrufzahl steht als solche da", () => {
  const text = formatAssistantToolResult(availableAssistantResult("ebay_most_viewed", {
    rangeStart: "20260717", rangeEnd: "20260815",
    listings: [{ ebayItemId: "1", title: "Karte", listingUrl: null, viewsTotal: null, impressionsTotal: null }],
  }, ["EBAY_READ_API"], null));
  assert.match(text, /nicht gemeldet/u);
  assert.doesNotMatch(text, /0 Aufrufe/u, "null Aufrufe waere eine erfundene Zahl");
});

test("die Postfach-Antwort trennt gelesen von ungelesen", () => {
  const text = formatAssistantToolResult(availableAssistantResult("ebay_messages", {
    unreadCount: 1,
    messages: [
      { ebayMessageId: "m1", sender: "kaeufer1", subject: "Frage zur Karte", ebayItemId: null, receivedAt: "2026-08-15T10:00:00.000Z", read: false },
      { ebayMessageId: "m2", sender: null, subject: "Versand", ebayItemId: null, receivedAt: null, read: true },
    ],
  }, ["EBAY_READ_API"], "2026-08-16T09:00:00.000Z"));

  assert.match(text, /2 eBay-Nachricht\(en\)\. Davon ungelesen: 1\./u);
  assert.match(text, /Frage zur Karte von kaeufer1, ungelesen/u);
  assert.match(text, /Versand, gelesen, eingegangen nicht gemeldet/u);
});

test("die Preisvorschlaege nennen Karte, Betrag und Frist", () => {
  const text = formatAssistantToolResult(availableAssistantResult("ebay_buyer_offers", {
    offers: [{
      bestOfferId: "o1", ebayItemId: "398200679813", title: "Lamine Yamal Finest",
      amountCents: 1250, listPriceAmountCents: 1900, currency: "EUR", quantity: 1,
      status: "Pending", hasBuyerMessage: true, expiresAt: "2026-08-18T10:00:00.000Z",
    }],
  }, ["EBAY_READ_API"], "2026-08-16T09:00:00.000Z"));

  assert.match(text, /Lamine Yamal Finest/u);
  assert.match(text, /12,50\s?€/u);
  assert.match(text, /gegen 19,00\s?€ Angebotspreis/u);
  assert.match(text, /Status Pending/u);
  assert.match(text, /mit Käufernachricht/u);
  assert.match(text, /zuerst ablaufende zuerst/u, "ohne Eingangszeit ist der Ablauf die einzige ehrliche Ordnung");
});

test("ein unverfuegbares Werkzeug nennt den Grund statt einer leeren Liste", () => {
  const text = formatAssistantToolResult(unavailableAssistantResult(
    "ebay_most_viewed", "SCOPE_NOT_GRANTED",
    "Aufrufzahlen: eBay verweigert den lesenden Zugriff.", ["EBAY_READ_API"],
  ));
  assert.match(text, /eBay-Aufrufzahlen: Aufrufzahlen: eBay verweigert/u);
  assert.match(text, quelleUndStand);
  assert.match(text, /Stand: nicht gemeldet/u, "ohne Abruf gibt es keinen Datenstand");
});

// ---------------------------------------------------------------------------
// Drosselung und Fehlerbuchung des Lesesyncs
// ---------------------------------------------------------------------------

test("der Lesesync laeuft nicht im Cron-Takt mit", () => {
  const jetzt = new Date("2026-08-16T12:00:00.000Z");
  const vorMinuten = (n) => new Date(jetzt.getTime() - n * 60_000).toISOString();

  assert.equal(isEbayReadSyncDue(undefined, jetzt), true, "ohne Zeile ist immer faellig");
  assert.equal(isEbayReadSyncDue({ status: "OK", lastAttemptAt: vorMinuten(3) }, jetzt), false);
  assert.equal(isEbayReadSyncDue({ status: "OK", lastAttemptAt: vorMinuten(16) }, jetzt), true);
  // Ein unlesbarer Zeitstempel darf eine Quelle nicht fuer immer stilllegen.
  assert.equal(isEbayReadSyncDue({ status: "OK", lastAttemptAt: "kaputt" }, jetzt), true);
  // Beide D1-Zeitformate, wie in lib/sync-lock.ts beschrieben.
  assert.equal(isEbayReadSyncDue({ status: "OK", lastAttemptAt: "2026-08-16 11:59:00" }, jetzt), false);
});

test("ein Fehler, den kein Wiederholungsversuch behebt, bekommt eine laengere Frist", () => {
  const jetzt = new Date("2026-08-16T12:00:00.000Z");
  const vorStunden = (n) => new Date(jetzt.getTime() - n * 3_600_000).toISOString();

  // Gegen einen fehlenden Scope alle 15 Minuten anzulaufen kostet nur
  // Tokenanfragen -- herauskommen kann man da nur ueber eine neue Zustimmung.
  assert.equal(isEbayReadSyncDue({ status: "SCOPE_NOT_GRANTED", lastAttemptAt: vorStunden(1) }, jetzt), false);
  assert.equal(isEbayReadSyncDue({ status: "SCOPE_NOT_GRANTED", lastAttemptAt: vorStunden(7) }, jetzt), true);
  assert.equal(isEbayReadSyncDue({ status: "NOT_CONFIGURED", lastAttemptAt: vorStunden(1) }, jetzt), false);
  // Ein Rate Limit dagegen geht von selbst vorbei.
  assert.equal(isEbayReadSyncDue({ status: "RATE_LIMITED", lastAttemptAt: vorStunden(1) }, jetzt), true);
  assert.ok(EBAY_READ_SYNC_BLOCKED_BACKOFF_MS > EBAY_READ_SYNC_INTERVAL_MS);
});

test("jeder Fehlschlag wird als solcher gebucht, nie als OK", () => {
  assert.deepEqual(readSyncFailure(new EbayReadError("SCOPE_NOT_GRANTED", "invalid_scope")).status, "SCOPE_NOT_GRANTED");
  assert.deepEqual(readSyncFailure(new EbayReadError("RATE_LIMITED", "zu viele")).status, "RATE_LIMITED");
  assert.deepEqual(readSyncFailure(new Error("eBay ist noch nicht konfiguriert.")).status, "NOT_CONFIGURED");
  assert.deepEqual(readSyncFailure(new Error("irgendwas")).status, "UPSTREAM_ERROR");
  assert.deepEqual(readSyncFailure("kein Error-Objekt").status, "UPSTREAM_ERROR");
  assert.equal(readSyncFailure(new Error("A".repeat(1000))).detail.length, 300);
});

// ---------------------------------------------------------------------------
// Verdrahtung und Grenzen
// ---------------------------------------------------------------------------

test("die Registry kennt alle drei eBay-Werkzeuge und nur lesende", async () => {
  const registry = await read("lib/assistant/server-tool-registry.ts");
  for (const name of ["ebay_most_viewed", "ebay_messages", "ebay_buyer_offers"]) {
    assert.ok(ASSISTANT_TOOL_NAMES.includes(name), name);
    assert.match(registry, new RegExp(`${name}:\\s*\\(input\\)`, "u"), `${name} muss in der Registry haengen`);
    assert.ok(ASSISTANT_TOOL_LABELS[name], `${name} braucht eine Beschriftung`);
    assert.deepEqual(parseAssistantToolInput({ tool: name }), { tool: name, limit: 10 });
  }
  const definitionen = new Map(ASSISTANT_TOOL_DEFINITIONS.map((tool) => [tool.name, tool.availability]));
  for (const name of ["ebay_most_viewed", "ebay_messages", "ebay_buyer_offers"]) {
    assert.equal(definitionen.get(name), "SOURCE_DEPENDENT",
      "ein festes READY waere eine Zusage, die von einer fremden Schnittstelle abhaengt");
  }
});

test("die Assistant-Werkzeuge fragen die eigene Datenbank, nicht eBay", async () => {
  // Sonst haenge eine Nutzerfrage an eBays Antwortzeit, und jede Frage nagte
  // am Tageskontingent, aus dem die Kasse ihre Bestandspruefung bezahlt.
  for (const pfad of ["lib/assistant/tools/ebay.ts", "lib/assistant/tools/messages.ts"]) {
    const source = await read(pfad);
    // Gegen den Aufruf, nicht gegen die Erwähnung: Auf `lib/ebay-read-api.ts`
    // darf ein Kommentar durchaus verweisen, importieren darf es nicht.
    assert.doesNotMatch(source, /^import[^\n]*ebay-read-api/mu, `${pfad} darf die eBay-Abrufe nicht einbinden`);
    assert.doesNotMatch(source, /\bfetchEbay\w*\(/u, `${pfad} darf eBay nicht direkt aufrufen`);
    assert.match(source, /readEbayReadSyncStates/u, `${pfad} muss den Quellzustand mitlesen`);
  }
});

test("der Lesesync schreibt nichts, wenn der Abruf fehlschlaegt", async () => {
  const source = await read("lib/ebay-read-sync.ts");
  // Erst vollstaendig holen, dann schreiben: Ein eBay-Ausfall laesst den
  // letzten guten Stand stehen, statt ihn zu leeren.
  for (const [holen, schreiben] of [
    ["fetchEbayListingTraffic", "ebayListingTraffic"],
    ["fetchEbayInboxMessages", "ebayInboxMessages"],
    ["fetchEbayBuyerOffers", "ebayBuyerOffers"],
  ]) {
    assert.ok(source.indexOf(holen) < source.indexOf(`db.insert(${schreiben})`), `${holen} muss vor dem Schreiben stehen`);
    assert.ok(source.indexOf(holen) < source.indexOf(`db.delete(${schreiben})`), `${holen} muss vor dem Loeschen stehen`);
  }
  // Idempotenz: geschrieben wird mit einem Stempel, geloescht wird alles
  // andere. Zweimal derselbe eBay-Inhalt ergibt denselben Tabelleninhalt.
  assert.equal(source.match(/onConflictDoUpdate/gu).length, 5, "vier Datentabellen und die Zustandstabelle");
  // **Die Verkaufstabelle wird als einzige nicht abgeraeumt.** Bei den drei
  // Quellen oben heisst "meldet eBay nicht mehr" auch "gilt nicht mehr"; ein
  // Verkauf dagegen ist eine Tatsache, die nur aus dem Abfragefenster rutscht.
  // Ein delete auf ebaySales wuerde die Historie bei jedem Lauf mitschrumpfen.
  assert.doesNotMatch(source, /db\.delete\(ebaySales\)/u, "Verkaufshistorie wird nie geloescht");
  assert.ok(source.indexOf("fetchEbaySales") < source.indexOf("db.insert(ebaySales)"), "erst holen, dann schreiben");
  assert.equal(source.match(/ne\(ebay\w+\.collectedAt, stamp\)/gu).length, 3);
});

test("der Desktop-Pet bekommt keine neue Schnittstelle", async () => {
  const [service, route] = await Promise.all([
    read("avatar/BrandyCards.Desktop/AssistantConversationService.cs"),
    read("app/api/avatar/device/assistant/route.ts"),
  ]);
  // Phase 8 fuegt Werkzeuge hinzu, keinen Weg nach draussen. Der Pet spricht
  // weiter genau einen Endpunkt an, und der bleibt der orchestrierte.
  //
  // Seit Variante 1 der Spracherkennung (2026-08-16) kommt genau ein zweiter
  // Pfad dazu: die Lesartenpruefung. Sie fuehrt kein Werkzeug aus und liest
  // keine Geschaeftsdaten -- sie meldet nur, welche Lesart eines Diktats
  // zuordenbar waere, damit die Regeln serverseitig bleiben. Die Liste bleibt
  // eine Gleichheitspruefung: Ein dritter Pfad faellt weiterhin auf.
  const pfade = [...service.matchAll(/\/api\/[a-z0-9/-]+/gu)].map((match) => match[0]);
  assert.deepEqual([...new Set(pfade)].sort(), [
    "/api/avatar/device/assistant",
    "/api/avatar/device/assistant/probe",
  ]);
  assert.doesNotMatch(service, /ebay/iu, "der Pet kennt keine eBay-Begriffe");
  assert.match(route, /createServerAssistantOrchestrator/u);
});

test("Pet-Darstellung und DPI-Positionierung bleiben unberuehrt", async () => {
  // Phase 8 ist eine Server- und Datenaenderung. Waechst der Diff in die
  // Fensterdateien hinein, ist etwas schiefgelaufen. Die Merkmale stammen aus
  // Phase 6 und 7 und muessen unveraendert dastehen.
  const [overlay, window] = await Promise.all([
    read("avatar/BrandyCards.Desktop/NativePetOverlay.cs"),
    read("avatar/BrandyCards.Desktop/MainWindow.xaml.cs"),
  ]);
  assert.match(overlay, /public PetPlacement\? CurrentPlacement\(\)/u, "die Lage-Auskunft aus Phase 6");
  assert.match(overlay, /MonitorFromWindow/u);
  assert.match(overlay, /UpdateLayeredWindow/u, "der Alpha-Zeichenweg des transparenten Pets");
  assert.match(window, /MonitorFromRect/u, "die Per-Monitor-DPI-Aufloesung aus Phase 7");
  assert.match(window, /GetDpiForMonitor\(monitor, MdtEffectiveDpi/u);
  // Die Kachelmasse des Atlas: Phase 6 und 7 haben sie ausdruecklich nicht
  // angefasst, weil es kein hoeher aufgeloestes Material gibt.
  assert.match(overlay, /FrameWidth = 192/u);
  assert.match(overlay, /FrameHeight = 208/u);
});

test("die Zustimmung fragt genau die drei benannten Rechte an, keines mehr", async () => {
  const [route, beispiel, wrangler] = await Promise.all([
    read("app/api/admin/ebay/oauth/start/route.ts"),
    read(".env.example"),
    read("wrangler.toml"),
  ]);
  // **Keine stille Rechteausweitung.** Ohne EBAY_OAUTH_CONSENT_SCOPES muss
  // exakt derselbe eine Scope angefragt werden wie vor Phase 8, sonst wuerde
  // ein Klick auf "eBay verbinden" mehr verlangen als der Betreiber wollte.
  assert.match(route, /process\.env\.EBAY_OAUTH_CONSENT_SCOPES/u);
  assert.match(route, /return process\.env\.EBAY_WRITE_OAUTH_SCOPE \|\| "https:\/\/api\.ebay\.com\/oauth\/api_scope\/sell\.inventory"/u);
  // **Seit dem 2026-08-16 ist die Variable gesetzt** -- auf ausdrueckliche
  // Anforderung des Betreibers, um erst die Aufrufzahlen und dann die
  // Verkaufsuebersicht freizuschalten. Bis dahin pruefte diese Stelle, dass sie
  // *fehlt*. Der Zweck bleibt derselbe und wird schaerfer geprueft: nicht
  // "nichts steht da", sondern "genau diese drei stehen da". Ein spaeter
  // angehaengter vierter Scope faellt hier auf, statt beim naechsten
  // Zustimmungsklick unbemerkt mitzulaufen.
  //
  // Alle drei sind benannt und begruendet: sell.inventory traegt die Ruecknahme
  // verkaufter Karten, die beiden readonly-Scopes tragen Aufrufzahlen und
  // Verkaufshistorie. Kein weiteres Schreibrecht.
  const gesetzt = wrangler.match(/^EBAY_OAUTH_CONSENT_SCOPES = "([^"]+)"/mu);
  assert.ok(gesetzt, "die Produktionskonfiguration benennt die angefragten Rechte");
  assert.deepEqual(gesetzt[1].split(/\s+/u), [
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  ]);
  // Kein Schreibrecht ausser dem einen, das es schon gab.
  assert.doesNotMatch(gesetzt[1], /sell\.fulfillment(?!\.readonly)|sell\.account|sell\.marketing(?!\.readonly)/u);
  // Dokumentiert, aber auskommentiert: ein Refresh-Token gehoert nicht in einen
  // Commit. Die Rechteliste oben ist keiner -- der Token ist ein Secret.
  const beispielZeile = beispiel.match(/^# EBAY_OAUTH_CONSENT_SCOPES=(.*)$/mu);
  assert.ok(beispielZeile, "der Weg steht dokumentiert in .env.example");
  assert.match(beispielZeile[1], /sell\.analytics\.readonly/u);
  assert.match(beispielZeile[1], /sell\.fulfillment\.readonly/u);
  assert.doesNotMatch(beispiel, /^EBAY_OAUTH_CONSENT_SCOPES=/mu);
});

test("keine modellgenerierten Abfragen: der Planer waehlt Namen, nie SQL", async () => {
  const planner = await read("lib/assistant/planner.ts");
  // Das Modell bekommt ausschliesslich `limit` als Parameter. Ein Freitextfeld
  // waere die Stelle, an der eine Abfrage von aussen hereinkaeme.
  const parameter = planner.slice(planner.indexOf("properties: {"), planner.indexOf("additionalProperties: false"));
  assert.match(parameter, /limit:/u);
  assert.doesNotMatch(parameter, /sql|query|table|filter|where/iu);
  assert.match(planner, /nicht registriertes Assistant-Werkzeug/u);
});
