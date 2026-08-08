import assert from "node:assert/strict";
import test from "node:test";

const {
  cardSubmissionReceived, escapeHtml, formatMoney, inquiryReceived,
  bestandshinweis, offerAccepted, offerRejected, orderConfirmation, sanitizeSubject, sellerOrderNotification,
} = await import("../lib/email/templates.ts");

const SHOP = "https://shop.brandycards.de";
const EUR = (cents) => ({ cents, currency: "EUR" });

/** Eine Gegenstelle, die nie antwortet — und den Event-Loop dabei wach hält.
 *
 * **Der ref'd Timer ist der Kern und keine Zutat.** `AbortSignal.timeout()`
 * benutzt intern einen unref'd Timer, hält Node also nicht am Leben. Ist die
 * stumme Zusage das einzige offene Handle, stellt Node fest, dass nichts mehr
 * Fortschritt machen kann, und räumt den Test ab, **bevor** die Zeitgrenze
 * greift — als `cancelledByParent`. Node 24 gewinnt dieses Rennen meist,
 * Node 22 verliert es; die CI läuft auf 22. Genau daran ist am 2026-08-07
 * schon `tests/ebay-sync-timeout.test.mjs` gescheitert, und ich bin am
 * 2026-08-08 in dieselbe Falle gelaufen.
 *
 * Im Worker gibt es das Problem nicht: Dort hält die laufende Anfrage den
 * Kontext offen. Der Timer bildet also nur nach, was in Produktion ohnehin
 * gilt.
 */
function stummeGegenstelle() {
  return (_url, init) => new Promise((_aufloesen, ablehnen) => {
    const wachhalten = setTimeout(() => {}, 5_000);
    init?.signal?.addEventListener("abort", () => {
      clearTimeout(wachhalten);
      ablehnen(new Error("aborted"));
    });
  });
}

/** Der Versender liest `process.env` beim Aufruf, nicht beim Laden. Jeder Test
 *  setzt die Umgebung deshalb selbst und räumt hinterher auf. */
async function mitUmgebung(werte, aufgabe) {
  const vorher = {};
  for (const [schluessel, wert] of Object.entries(werte)) {
    vorher[schluessel] = process.env[schluessel];
    if (wert === undefined) delete process.env[schluessel];
    else process.env[schluessel] = wert;
  }
  try {
    return await aufgabe();
  } finally {
    for (const [schluessel, wert] of Object.entries(vorher)) {
      if (wert === undefined) delete process.env[schluessel];
      else process.env[schluessel] = wert;
    }
  }
}

// --- Maskierung -------------------------------------------------------------

test("HTML-Sonderzeichen werden maskiert", () => {
  assert.equal(escapeHtml('<b>"x"&\'y\'</b>'), "&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/b&gt;");
});

/** Kartentitel kommen von eBay, sind also Fremdeingabe. */
test("ein praeparierter Kartentitel kann kein Markup einschleusen", () => {
  const boese = `<img src=x onerror="alert(1)">`;
  const nachricht = inquiryReceived({ title: boese, shopUrl: SHOP });
  assert.ok(!nachricht.html.includes("<img"), "rohes Markup im HTML-Teil");
  assert.ok(!nachricht.html.includes("onerror=\""), "lebender Eventhandler im HTML-Teil");
  assert.ok(nachricht.html.includes("&lt;img"), "der Titel fehlt ganz");
  // Im Nur-Text-Teil darf er unveraendert stehen, dort ist er harmlos.
  assert.ok(nachricht.text.includes(boese));
});

// --- Betreffzeile -----------------------------------------------------------

test("Zeilenumbrueche fliegen aus dem Betreff", () => {
  const eingeschleust = sanitizeSubject("Karte\r\nBcc: opfer@example.com");
  assert.ok(!eingeschleust.includes("\n"));
  assert.ok(!eingeschleust.includes("\r"));
  assert.equal(eingeschleust, "Karte Bcc: opfer@example.com");
});

test("ein ueberlanger Betreff wird gekuerzt", () => {
  const lang = sanitizeSubject("A".repeat(500));
  assert.ok(lang.length <= 160);
  assert.ok(lang.endsWith("…"));
});

test("ein praeparierter Titel erreicht den Betreff nicht mehrzeilig", () => {
  const nachricht = offerRejected({ title: "Karte\nBcc: x@y.z", productUrl: SHOP, shopUrl: SHOP });
  assert.ok(!nachricht.subject.includes("\n"));
});

// --- Betraege ---------------------------------------------------------------

test("Betraege stehen in deutscher Schreibweise", () => {
  assert.match(formatMoney(EUR(4050)), /40,50/u);
  assert.match(formatMoney(EUR(0)), /0,00/u);
});

// --- Bestellbestaetigung ----------------------------------------------------

const BESTELLUNG = {
  orderNumber: "BC-2026-0001",
  items: [
    { title: "Topps Chrome Musiala", quantity: 1, unitPrice: EUR(1200) },
    { title: "Topps Museum Boniface", quantity: 2, unitPrice: EUR(1700) },
  ],
  subtotal: EUR(4600),
  shipping: EUR(345),
  total: EUR(4945),
  shopUrl: SHOP,
};

test("die Bestellbestaetigung nennt Nummer, Karten und Summen", () => {
  const nachricht = orderConfirmation(BESTELLUNG);
  assert.ok(nachricht.subject.includes("BC-2026-0001"));
  for (const teil of [nachricht.text, nachricht.html]) {
    assert.ok(teil.includes("BC-2026-0001"), "Bestellnummer fehlt");
    assert.ok(teil.includes("Topps Chrome Musiala"), "Karte fehlt");
    assert.match(teil, /49,45/u, "Gesamtsumme fehlt");
    assert.match(teil, /3,45/u, "Versand fehlt");
  }
});

/** Der Zeilenpreis ist Stueckpreis mal Menge - nicht der Stueckpreis. */
test("mehrere Stueck derselben Karte werden multipliziert", () => {
  const nachricht = orderConfirmation(BESTELLUNG);
  assert.match(nachricht.text, /34,00/u, "2 x 17,00 EUR fehlt");
  assert.match(nachricht.html, /34,00/u);
});

test("die Bestellbestaetigung duzt und laesst Behoerdendeutsch weg", () => {
  const nachricht = orderConfirmation(BESTELLUNG);
  assert.ok(!/Sehr geehrte/u.test(nachricht.text));
  assert.match(nachricht.text, /deine Bestellung/u);
});

test("jede Nachricht traegt Impressum und Datenschutz im Fuss", () => {
  const alle = [
    orderConfirmation(BESTELLUNG),
    offerAccepted({ title: "Karte", price: EUR(999), expiresAt: "2026-08-09T10:00:00.000Z", productUrl: `${SHOP}/karten/x`, shopUrl: SHOP }),
    offerRejected({ title: "Karte", productUrl: `${SHOP}/karten/x`, shopUrl: SHOP }),
    inquiryReceived({ title: "Karte", shopUrl: SHOP }),
    cardSubmissionReceived({ title: "Karte", shopUrl: SHOP }),
  ];
  for (const nachricht of alle) {
    assert.ok(nachricht.text.includes("/impressum"), `Impressum fehlt im Text: ${nachricht.subject}`);
    assert.ok(nachricht.html.includes("/impressum"), `Impressum fehlt im HTML: ${nachricht.subject}`);
    assert.ok(nachricht.subject.length > 0);
    // Rein transaktional: ein Abmeldelink waere irrefuehrend.
    assert.ok(!/abmelden|unsubscribe/iu.test(nachricht.text), `Abmeldelink in ${nachricht.subject}`);
  }
});

test("keine Gedankenstriche in den Nachrichten", () => {
  const alle = [
    orderConfirmation(BESTELLUNG),
    offerAccepted({ title: "Karte", price: EUR(999), expiresAt: "2026-08-09T10:00:00.000Z", productUrl: SHOP, shopUrl: SHOP }),
    offerRejected({ title: "Karte", productUrl: SHOP, shopUrl: SHOP }),
    inquiryReceived({ title: "Karte", shopUrl: SHOP }),
    cardSubmissionReceived({ title: "Karte", shopUrl: SHOP }),
  ];
  for (const nachricht of alle) {
    assert.ok(!nachricht.text.includes("—"), `Gedankenstrich im Text: ${nachricht.subject}`);
    assert.ok(!nachricht.html.includes("—"), `Gedankenstrich im HTML: ${nachricht.subject}`);
  }
});

// --- Preisvorschlaege -------------------------------------------------------

test("die Zusage nennt Betrag, Frist und Link", () => {
  const nachricht = offerAccepted({
    title: "Topps Chrome Musiala",
    price: EUR(3500),
    expiresAt: "2026-08-09T10:00:00.000Z",
    productUrl: `${SHOP}/karten/abc`,
    shopUrl: SHOP,
  });
  assert.match(nachricht.text, /35,00/u);
  assert.match(nachricht.text, /9\. August 2026/u, "Frist fehlt oder ist nicht deutsch formatiert");
  assert.ok(nachricht.text.includes(`${SHOP}/karten/abc`));
  assert.ok(nachricht.html.includes(`${SHOP}/karten/abc`));
});

/** Fehlt die Frist wider Erwarten, darf dort nicht "Invalid Date" stehen. */
test("eine fehlende Frist laesst die Zeile weg statt Unsinn zu schreiben", () => {
  const nachricht = offerAccepted({ title: "Karte", price: EUR(100), expiresAt: "", productUrl: SHOP, shopUrl: SHOP });
  assert.ok(!/Invalid Date/u.test(nachricht.text));
  assert.ok(!/Invalid Date/u.test(nachricht.html));
  assert.ok(!/Gültig/u.test(nachricht.text));
});

test("die Absage bleibt freundlich und laedt zu einem neuen Vorschlag ein", () => {
  const nachricht = offerRejected({ title: "Karte", productUrl: SHOP, shopUrl: SHOP });
  assert.match(nachricht.text, /neuer Vorschlag ist jederzeit willkommen/u);
  assert.ok(!/Sehr geehrte/u.test(nachricht.text));
});

// --- Der Versand: die zentrale Zusage ---------------------------------------

test("ohne Schluessel wird nichts verschickt und nichts geworfen", async () => {
  await mitUmgebung({ RESEND_API_KEY: undefined }, async () => {
    const { sendEmail } = await import("../lib/email/send.ts");
    const ergebnis = await sendEmail("kunde@example.com", inquiryReceived({ title: "K", shopUrl: SHOP }));
    assert.equal(ergebnis.ok, false);
    assert.equal(ergebnis.grund, "nicht-konfiguriert");
  });
});

test("eine unbrauchbare Empfaengeradresse fuehrt nicht zum Fremdaufruf", async () => {
  await mitUmgebung({ RESEND_API_KEY: "re_test" }, async () => {
    const { sendEmail } = await import("../lib/email/send.ts");
    const echtesFetch = globalThis.fetch;
    let aufgerufen = false;
    globalThis.fetch = async () => { aufgerufen = true; return new Response("{}", { status: 200 }); };
    try {
      for (const kaputt of ["", "   ", "keine-adresse", "a@b", "@example.com"]) {
        const ergebnis = await sendEmail(kaputt, inquiryReceived({ title: "K", shopUrl: SHOP }));
        assert.equal(ergebnis.ok, false, `"${kaputt}" galt als gültig`);
      }
      assert.equal(aufgerufen, false, "es wurde trotzdem gesendet");
    } finally {
      globalThis.fetch = echtesFetch;
    }
  });
});

/** Die wichtigste Zusage des Moduls: Ein kaputter Versand darf die auslösende
 *  Aktion nie reißen. Ein bezahlter Kunde bekommt seine Karten auch dann. */
test("sendEmail wirft nie, egal was die Gegenstelle tut", async () => {
  await mitUmgebung({ RESEND_API_KEY: "re_test", EMAIL_TIMEOUT_MS: "80" }, async () => {
    const { sendEmail } = await import("../lib/email/send.ts");
    const echtesFetch = globalThis.fetch;
    const faelle = [
      ["Netzfehler", async () => { throw new Error("ECONNREFUSED"); }],
      ["Fehlerstatus", async () => new Response("nope", { status: 500 })],
      ["kaputtes JSON", async () => new Response("<html>", { status: 200 })],
      ["haengt", stummeGegenstelle()],
    ];
    try {
      for (const [name, stub] of faelle) {
        globalThis.fetch = stub;
        const ergebnis = await sendEmail("kunde@example.com", inquiryReceived({ title: "K", shopUrl: SHOP }));
        assert.equal(typeof ergebnis.ok, "boolean", `${name}: kein Ergebnis`);
        if (name === "kaputtes JSON") assert.equal(ergebnis.ok, true, "ein 200 ohne JSON gilt als zugestellt");
        else assert.equal(ergebnis.ok, false, `${name}: galt als erfolgreich`);
      }
    } finally {
      globalThis.fetch = echtesFetch;
    }
  });
});

test("eine haengende Gegenstelle laeuft in die Zeitgrenze statt ewig zu warten", async () => {
  await mitUmgebung({ RESEND_API_KEY: "re_test", EMAIL_TIMEOUT_MS: "120" }, async () => {
    const { sendEmail } = await import("../lib/email/send.ts");
    const echtesFetch = globalThis.fetch;
    globalThis.fetch = stummeGegenstelle();
    try {
      const start = Date.now();
      const ergebnis = await sendEmail("kunde@example.com", inquiryReceived({ title: "K", shopUrl: SHOP }));
      const gedauert = Date.now() - start;
      assert.equal(ergebnis.ok, false);
      assert.ok(gedauert < 3_000, `hat ${gedauert} ms gewartet`);
    } finally {
      globalThis.fetch = echtesFetch;
    }
  });
});

test("versucheVersand schluckt auch Fehler beim Zusammenbauen", async () => {
  const { versucheVersand } = await import("../lib/email/send.ts");
  let danach = false;
  await versucheVersand("Test", async () => { throw new Error("Verknüpfung fehlt"); });
  danach = true;
  assert.equal(danach, true, "der Aufrufer wurde gerissen");
});

// --- Protokollierung -------------------------------------------------------

/** Fängt ab, was auf die Konsole geht, damit sich die Zeilen prüfen lassen. */
function mitProtokoll(aufgabe) {
  const echteLog = console.log;
  const echterError = console.error;
  const zeilen = [];
  console.log = (...teile) => zeilen.push({ art: "log", teile });
  console.error = (...teile) => zeilen.push({ art: "error", teile });
  try {
    aufgabe();
  } finally {
    console.log = echteLog;
    console.error = echterError;
  }
  return zeilen;
}

test("ein erfolgreicher Versand hinterlaesst eine Zeile mit Kennung", async () => {
  const { protokolliereVersand } = await import("../lib/email/send.ts");
  const zeilen = mitProtokoll(() => {
    protokolliereVersand("Bestellbestätigung", { ok: true, id: "msg_42" }, { orderId: "abc123" });
  });
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].art, "log");
  assert.match(zeilen[0].teile[0], /Bestellbestätigung zugestellt/u);
  assert.deepEqual(zeilen[0].teile[1], { resendId: "msg_42", orderId: "abc123" });
});

/** Die Adresse gehoert nicht in die Cloudflare-Protokolle: Sie laege dort
 *  dauerhaft, ohne einen Zweck zu erfuellen. Die Resend-Kennung genuegt. */
test("die Empfaengeradresse steht in keiner Protokollzeile", async () => {
  await mitUmgebung({ RESEND_API_KEY: "re_test" }, async () => {
    const { sendEmail, protokolliereVersand } = await import("../lib/email/send.ts");
    const echtesFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ id: "msg_7" }), { status: 200 });
    try {
      const ergebnis = await sendEmail("kunde@example.com", inquiryReceived({ title: "K", shopUrl: SHOP }));
      const zeilen = mitProtokoll(() => protokolliereVersand("Anfragebestätigung", ergebnis));
      const alles = JSON.stringify(zeilen);
      assert.ok(!alles.includes("kunde@example.com"), "die Adresse steht im Protokoll");
      assert.ok(alles.includes("msg_7"), "die Resend-Kennung fehlt");
    } finally {
      globalThis.fetch = echtesFetch;
    }
  });
});

test("ein Fehlschlag wird weiterhin als Fehler protokolliert", async () => {
  const { protokolliereVersand } = await import("../lib/email/send.ts");
  const zeilen = mitProtokoll(() => {
    protokolliereVersand("Ankaufbestätigung", { ok: false, grund: "unerreichbar", detail: "timeout" });
  });
  assert.equal(zeilen.length, 1);
  assert.equal(zeilen[0].art, "error");
  assert.match(zeilen[0].teile[0], /nicht zugestellt/u);
  assert.equal(zeilen[0].teile[1].grund, "unerreichbar");
});

test("der Versand schickt Betreff, Text und HTML an Resend", async () => {
  await mitUmgebung({ RESEND_API_KEY: "re_test", EMAIL_FROM: "BrandyCards <post@example.com>" }, async () => {
    const { sendEmail } = await import("../lib/email/send.ts");
    const echtesFetch = globalThis.fetch;
    let gesendet = null;
    globalThis.fetch = async (url, init) => {
      gesendet = { url: String(url), kopf: init.headers, koerper: JSON.parse(init.body) };
      return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
    };
    try {
      const ergebnis = await sendEmail("kunde@example.com", orderConfirmation(BESTELLUNG));
      assert.equal(ergebnis.ok, true);
      assert.equal(ergebnis.id, "msg_1");
      assert.equal(gesendet.url, "https://api.resend.com/emails");
      assert.equal(gesendet.kopf.Authorization, "Bearer re_test");
      assert.deepEqual(gesendet.koerper.to, ["kunde@example.com"]);
      assert.equal(gesendet.koerper.from, "BrandyCards <post@example.com>");
      assert.ok(gesendet.koerper.subject.includes("BC-2026-0001"));
      assert.ok(gesendet.koerper.text.length > 0);
      assert.ok(gesendet.koerper.html.startsWith("<div"));
    } finally {
      globalThis.fetch = echtesFetch;
    }
  });
});

// --- Die Verkäufernachricht: ohne sie kein Versandetikett -------------------
//
// Bis zum 2026-08-08 verschickte der Shop nur eine Bestätigung an den Kunden.
// Die Lieferadresse stand ausschließlich in der Datenbank; der Betreiber erfuhr
// von einer Bestellung nur über PayPal — ohne zu wissen, wohin das Paket soll.

const VERKAUF = {
  orderNumber: "BC-20260808-89309FCA",
  paidAt: "2026-08-08T08:29:48.098Z",
  items: [{ title: "Panini Prizm Bellingham", quantity: 1, unitPrice: EUR(4500) }],
  subtotal: EUR(4500),
  shipping: EUR(345),
  total: EUR(4845),
  address: { name: "Erika Mustermann", street: "Musterweg 12", postalCode: "51373", city: "Leverkusen", country: "DE" },
  customerEmail: "kundin@example.org",
  shopUrl: SHOP,
};

test("die Verkäufernachricht trägt die vollständige Lieferadresse", () => {
  const nachricht = sellerOrderNotification(VERKAUF);
  for (const teil of ["Erika Mustermann", "Musterweg 12", "51373", "Leverkusen"]) {
    assert.ok(nachricht.text.includes(teil), `fehlt im Text: ${teil}`);
    assert.ok(nachricht.html.includes(teil), `fehlt im HTML: ${teil}`);
  }
});

test("der Betreff nennt Bestellnummer und Empfänger", () => {
  const nachricht = sellerOrderNotification(VERKAUF);
  assert.ok(nachricht.subject.includes("BC-20260808-89309FCA"));
  assert.ok(nachricht.subject.includes("Erika Mustermann"));
});

test("die Verkäufernachricht nennt Inhalt, Beträge und den Kunden", () => {
  const nachricht = sellerOrderNotification(VERKAUF);
  assert.ok(nachricht.text.includes("Panini Prizm Bellingham"));
  assert.ok(nachricht.text.includes("48,45"), "der Gesamtbetrag gehört hinein");
  assert.ok(nachricht.text.includes("kundin@example.org"), "für Rückfragen");
});

test("auch der Name auf dem Etikett wird maskiert", () => {
  // Der Name kommt aus einem Formular und ist damit Fremdeingabe.
  const nachricht = sellerOrderNotification({
    ...VERKAUF,
    address: { ...VERKAUF.address, name: '<img src=x onerror="alert(1)">' },
  });
  assert.ok(!nachricht.html.includes("<img src=x"), "unmaskiertes Markup in der Nachricht");
  assert.ok(nachricht.html.includes("&lt;img"), "maskiert erwartet");
});

test("der Betreff bleibt einzeilig, auch bei präpariertem Namen", () => {
  // Zeilenumbrüche im Betreff könnten eine Kopfzeile einschleusen.
  const nachricht = sellerOrderNotification({
    ...VERKAUF,
    address: { ...VERKAUF.address, name: "Otto\nBcc: fremd@example.org" },
  });
  assert.ok(!nachricht.subject.includes("\n"));
});

// --- Der Hinweis, wenn die Bestandsprüfung nicht laufen konnte --------------

test("bei geprüftem Bestand steht kein Hinweis in der Nachricht", () => {
  // Eine Zeile „alles geprüft" in **jeder** Mail stumpft ab. Gewarnt wird nur,
  // wenn es etwas zu warnen gibt — sonst wird die Warnung überlesen, wenn sie
  // einmal zählt.
  assert.equal(bestandshinweis("OK"), null);
  assert.equal(bestandshinweis(undefined), null);
  const nachricht = sellerOrderNotification({ ...VERKAUF, bestandspruefung: "OK" });
  assert.ok(!nachricht.text.includes("ACHTUNG"));
  assert.ok(!nachricht.html.includes("ACHTUNG"));
});

test("ein eBay-Ausfall wird dem Verkäufer gemeldet, bevor er packt", () => {
  // Die Prüfung an der Kasse lässt bei einem eBay-Ausfall bewusst durch --
  // aber lautlos. Hier ist der letzte Moment, in dem der Verkäufer noch
  // selbst nachsehen kann.
  const hinweis = bestandshinweis("FEHLGESCHLAGEN");
  assert.match(hinweis, /ACHTUNG/);
  assert.match(hinweis, /nicht geantwortet/);
  const nachricht = sellerOrderNotification({ ...VERKAUF, bestandspruefung: "FEHLGESCHLAGEN" });
  assert.ok(nachricht.text.includes("ACHTUNG"), "im Text");
  assert.ok(nachricht.html.includes("ACHTUNG"), "und im HTML");
});

test("über den Webhook abgerechnete Bestellungen nennen den anderen Grund", () => {
  // Dieser Weg ruft den Wächter gar nicht auf. Das ist ein anderer Fall als
  // „eBay antwortete nicht", und der Verkäufer soll wissen, welcher vorliegt.
  const hinweis = bestandshinweis("NICHT_GELAUFEN");
  assert.match(hinweis, /Webhook/);
  assert.ok(!/nicht geantwortet/.test(hinweis), "kein erfundener eBay-Ausfall");
});

test("der Hinweis wird maskiert und kann kein Markup einschleusen", () => {
  const nachricht = sellerOrderNotification({ ...VERKAUF, bestandspruefung: "FEHLGESCHLAGEN" });
  assert.ok(!/<script/i.test(nachricht.html));
  assert.ok(nachricht.html.includes("&mdash;") || !nachricht.html.includes("<b>"), "kein rohes Markup aus dem Hinweis");
});
