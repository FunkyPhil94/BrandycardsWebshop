import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const { readFormMetadata } = await import("../lib/form-metadata.ts");
const { VORSCHLAG_STATUS, ANGEBOT_STATUS, statusText } = await import("../app/account/status.ts");

test("die Kontoansichten lesen ausschliesslich die eigenen Vorgaenge", async () => {
  // Der teuerste denkbare Fehler an dieser Stelle waere, eine Kennung aus der
  // Anfrage zu uebernehmen: Dann saehe jeder Kunde fremde Angebote und fremde
  // Bilder. Die Zuordnung darf nur aus der Anmeldung stammen.
  for (const path of [
    "app/api/account/price-offers/route.ts",
    "app/api/account/card-submissions/route.ts",
    "app/api/account/card-submissions/assets/route.ts",
  ]) {
    const route = await read(path);
    assert.match(route, /getAuthenticatedAppUser/u, `${path} muss die Anmeldung pruefen`);
    assert.match(route, /kontoZuordnung\(appUser\.id, appUser\.email\)/u, `${path} muss die gemeinsame Zuordnung benutzen`);
    assert.match(route, /Nicht authentifiziert/u, `${path} muss ohne Anmeldung 401 geben`);
    assert.doesNotMatch(route, /searchParams\.get\("(userId|email|submissionId)"\)/u,
      `${path} darf keine Eigentuemerkennung aus der Anfrage uebernehmen`);
  }

  // Der Bildabruf prueft in der Abfrage, nicht danach im Code: Ein `if` hinter
  // dem Laden waere eine Zeile, die beim naechsten Umbau verschwindet.
  const assets = await read("app/api/account/card-submissions/assets/route.ts");
  assert.match(assets, /innerJoin\(cardSubmissions/u, "die Einsendung wird mitgelesen");
  assert.match(assets, /and\(\s*eq\(cardSubmissionAssets\.id, assetId\),\s*gehoertZu\(/u,
    "Bildkennung und Eigentuemerschaft stehen in derselben Bedingung");
});

test("der Kassen-Endpunkt bleibt von der neuen Ansicht unberuehrt", async () => {
  // An `/api/account/offers` haengt der Preis, der abgebucht wird. Die Historie
  // hat einen eigenen Endpunkt, damit Anzeige und Geldentscheidung nicht an
  // derselben Antwort haengen.
  const kasse = await read("app/api/account/offers/route.ts");
  assert.match(kasse, /acceptedOffersForUser/u);
  assert.doesNotMatch(kasse, /REJECTED|WITHDRAWN/u, "der Kassenweg kennt nur angenommene Angebote");
});

test("Statusnamen fuer Kunden stehen an einer Stelle und ohne internen Wortlaut", () => {
  for (const [status, text] of [...Object.entries(VORSCHLAG_STATUS), ...Object.entries(ANGEBOT_STATUS)]) {
    assert.doesNotMatch(text, /^[A-Z_]+$/u, `${status} darf nicht als interner Name durchgereicht werden`);
  }
  assert.equal(statusText(VORSCHLAG_STATUS, "NEW"), "Wird geprüft");
  assert.equal(statusText(ANGEBOT_STATUS, "REJECTED"), "Nicht angekauft");
  // Derselbe Text fuer zwei verschiedene Vorgaenge im selben Konto verwirrt:
  // „Abgeschlossen" ist bereits der Stand einer Bestellung.
  assert.notEqual(ANGEBOT_STATUS.CLOSED, "Abgeschlossen");
  // Ein unbekannter Stand faellt auf sich selbst zurueck statt zu verschwinden.
  assert.equal(statusText(VORSCHLAG_STATUS, "SONDERFALL"), "SONDERFALL");
});

test("der Titel eines Kartenangebots wird an einer Stelle ausgelesen", async () => {
  assert.deepEqual(readFormMetadata(JSON.stringify({ title: "Panini 2024", message: "zwei Karten" })), { title: "Panini 2024", text: "zwei Karten" });
  // Beschaedigte oder alte Zeilen duerfen die Liste nicht sprengen.
  assert.deepEqual(readFormMetadata("kein json"), { title: "Kartenangebot", text: null });
  assert.deepEqual(readFormMetadata(null), { title: "Kartenangebot", text: null });
  assert.deepEqual(readFormMetadata(JSON.stringify({ title: "   ", message: "  " })), { title: "Kartenangebot", text: null });

  // Und zwar wirklich an einer: Das Dashboard hat seine eigene Fassung verloren.
  const dashboard = await read("app/api/admin/dashboard/route.ts");
  assert.match(dashboard, /readFormMetadata/u);
  assert.doesNotMatch(dashboard, /JSON\.parse\(submission\.message\)/u);
});

test("ein Vorschlag laesst sich nur zurueckziehen, solange niemand entschieden hat", async () => {
  const route = await read("app/api/account/price-offers/route.ts");
  // Die drei Bedingungen stehen in *einer* Abfrage: Wer sie als `if` davorlegt,
  // laesst zwischen Pruefen und Schreiben einen zweiten Aufruf zu.
  assert.match(route, /export async function PATCH/u);
  assert.match(route, /inArray\(priceOffers\.status, \["NEW", "IN_REVIEW"\]\)/u,
    "entschiedene Angebote bleiben, wie sie sind");
  assert.match(route, /gehoertZu\(priceOffers\.userId, priceOffers\.guestEmail\)/u, "nur eigene");
  assert.match(route, /status: "WITHDRAWN"/u);
  // Fremd, unbekannt und laengst entschieden geben dieselbe Antwort.
  assert.match(route, /changes !== 1[\s\S]{0,220}409/u);

  // Und der freigewordene Versuch ist kein Zufall: `offerAttempts` zaehlt
  // `WITHDRAWN` ausdruecklich nicht mit.
  const zaehlung = await read("lib/price-offers.ts");
  assert.match(zaehlung, /status\} <> 'WITHDRAWN'/u);
});

test("der Stand Rueckfrage traegt immer eine Frage und erreicht den Kunden", async () => {
  const admin = await read("app/api/admin/card-submissions/route.ts");
  // Ohne Frage waere es wieder die Sackgasse: Der Kunde saehe nur das Wort.
  assert.match(admin, /status === "NEEDS_INFO" && !frage/u, "Rueckfrage ohne Frage wird abgewiesen");
  assert.match(admin, /notifyCardSubmissionQuestion/u, "der Kunde bekommt eine E-Mail");
  // Die Mail darf den gespeicherten Stand nicht gefaehrden.
  assert.match(admin, /recordAdminAudit[\s\S]{0,400}notifyCardSubmissionQuestion/u,
    "erst speichern und protokollieren, dann senden");

  // Der Kunde sieht die Frage auch dort, wo er ohnehin nachsieht.
  const konto = await read("app/account/kartenangebote/page.tsx");
  assert.match(konto, /adminQuestion/u);
  const endpunkt = await read("app/api/account/card-submissions/route.ts");
  assert.match(endpunkt, /adminQuestion: cardSubmissions\.adminQuestion/u);

  // Spalte und Migration gehoeren zusammen.
  assert.match(await read("db/schema.ts"), /adminQuestion: text\("admin_question"\)/u);
  assert.match(await read("drizzle/0017_card_submission_question.sql"), /ADD COLUMN admin_question TEXT/u);
});

test("die Rueckfrage-Mail nennt Karte, Frage und den Weg zur Antwort", async () => {
  const { cardSubmissionQuestion } = await import("../lib/email/templates.ts");
  const de = cardSubmissionQuestion({ title: "Panini 2024", question: "Ist die Ecke geknickt?", shopUrl: "https://shop.example" });
  assert.match(de.subject, /Panini 2024/u);
  assert.match(de.text, /Ist die Ecke geknickt\?/u);
  assert.match(de.text, /Antworte einfach auf diese E-Mail/u);
  assert.match(de.html, /Ist die Ecke geknickt\?/u);
  const en = cardSubmissionQuestion({ title: "Panini 2024", question: "Is the corner bent?", shopUrl: "https://shop.example", locale: "en" });
  assert.match(en.subject, /question about your card/u);
  assert.match(en.text, /Just reply to this email/u);
});
