import assert from "node:assert/strict";
import test from "node:test";

const {
  cardSubmissionReceived, escapeHtml, formatMoney, inquiryReceived,
  offerAccepted, offerRejected, orderConfirmation, sanitizeSubject,
} = await import("../lib/email/templates.ts");

const SHOP = "https://shop.brandycards.de";
const EUR = (cents) => ({ cents, currency: "EUR" });

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
      ["haengt", (_u, init) => new Promise((_aufloesen, ablehnen) => {
        init?.signal?.addEventListener("abort", () => ablehnen(new Error("aborted")));
      })],
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
    globalThis.fetch = (_u, init) => new Promise((_aufloesen, ablehnen) => {
      // Ein ref'd Timer haelt den Event-Loop wach; ohne ihn raeumt Node den
      // Versuch ab, bevor die Zeitgrenze greift (siehe ebay-sync-timeout).
      const halten = setTimeout(() => {}, 5_000);
      init?.signal?.addEventListener("abort", () => { clearTimeout(halten); ablehnen(new Error("aborted")); });
    });
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
