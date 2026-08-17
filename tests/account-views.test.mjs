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
