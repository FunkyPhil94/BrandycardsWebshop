import assert from "node:assert/strict";
import test from "node:test";

// Der Ausfall vom 2026-08-07: Ein Sync-Lauf blieb auf RUNNING hängen und legte
// den Import über eine Stunde still. Was hier geprüft wird, ist die Kette, die
// das möglich gemacht hat — jeder Test stellt ein Glied davon nach.
//
// Gegen eBay wird nichts ausgeführt: `fetch` wird gestubbt wie in
// tests/ebay-availability.test.mjs.

const { getActiveEbayListings, getEbayItemDescription } = await import("../lib/ebay-client.ts");
const { ExpiringLock, isSyncRunStale, withDeadline } = await import("../lib/sync-lock.ts");

function setzeZugangsdaten() {
  process.env.EBAY_CLIENT_ID = "id";
  process.env.EBAY_CLIENT_SECRET = "secret";
  process.env.EBAY_REFRESH_TOKEN = "refresh";
  // Ohne diese Übersteuerung liefe jeder Test hier 30 Sekunden.
  process.env.EBAY_FETCH_TIMEOUT_MS = "80";
}

/** Eine eBay-API, die nie antwortet — aber ein `AbortSignal` respektiert.
 *
 * Genau das ist der Punkt: Ohne Zeitgrenze am Aufruf kommt hier nie ein
 * Signal an, die Zusage bleibt für immer offen und der Test läuft in sein
 * Zeitlimit. Mit Zeitgrenze bricht er ab.
 */
function stubStummeEbayApi({ tokenAntwortet = true } = {}) {
  const calls = [];
  globalThis.fetch = (url, init) => {
    const istToken = String(url).includes("/identity/");
    calls.push(istToken ? "token" : "trading");
    if (istToken && tokenAntwortet) {
      return Promise.resolve(new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 }));
    }
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal.reason ?? new Error("aborted")));
    });
  };
  return calls;
}

// --- Zeitgrenzen an den eBay-Aufrufen ---------------------------------------

test("ein stummer GetMyeBaySelling-Aufruf endet mit Fehler statt zu hängen", { timeout: 5_000 }, async () => {
  setzeZugangsdaten();
  const calls = stubStummeEbayApi();
  await assert.rejects(() => getActiveEbayListings());
  // Der Token-Aufruf ging durch, erst die Aktivliste blieb stumm.
  assert.ok(calls.includes("trading"));
});

test("auch ein stummer OAuth-Aufruf endet mit Fehler statt zu hängen", { timeout: 5_000 }, async () => {
  setzeZugangsdaten();
  stubStummeEbayApi({ tokenAntwortet: false });
  await assert.rejects(() => getActiveEbayListings());
});

test("die Beschreibungsabfrage hängt ebenfalls nicht", { timeout: 5_000 }, async () => {
  setzeZugangsdaten();
  stubStummeEbayApi();
  await assert.rejects(() => getEbayItemDescription("123456789012"));
});

// --- Veraltet-Prüfung: das Zeitformat aus SQLite ----------------------------

test("ein gerade gestarteter Lauf gilt nicht als verwaist", () => {
  // Der Fehler, den dieser Test festhält: `started_at` kommt als
  // `2026-08-07 13:20:40`, die Grenze als `2026-08-07T13:15:40.000Z`. Als
  // Zeichenketten verglichen sortiert das Leerzeichen vor dem `T` — jeder
  // laufende Import galt damit als verwaist, auch ein zehn Sekunden alter.
  const now = new Date("2026-08-07T13:20:50.000Z");
  assert.equal(isSyncRunStale("2026-08-07 13:20:40", now), false);
});

test("ein Lauf jenseits der Frist gilt als verwaist", () => {
  const now = new Date("2026-08-07T13:26:40.000Z");
  assert.equal(isSyncRunStale("2026-08-07 13:20:40", now), true);
});

test("beide Zeitformate werden gleich behandelt", () => {
  const now = new Date("2026-08-07T13:26:40.000Z");
  assert.equal(isSyncRunStale("2026-08-07T13:20:40.000Z", now), true);
  assert.equal(isSyncRunStale("2026-08-07T13:25:40.000Z", now), false);
});

test("ohne verwertbaren Zeitstempel wird nichts freigegeben", () => {
  assert.equal(isSyncRunStale(null), false);
  assert.equal(isSyncRunStale("keine Zeit"), false);
});

// --- Die Sperre, die sich nicht verklemmt -----------------------------------

test("die Sperre lässt keinen zweiten Lauf herein, solange sie frisch ist", () => {
  const lock = new ExpiringLock();
  assert.equal(lock.tryAcquire(1_000, 60_000), true);
  assert.equal(lock.tryAcquire(2_000, 60_000), false);
});

test("eine Sperre, die niemand freigibt, verfällt von selbst", () => {
  // Das Glied, das den Ausfall dauerhaft machte: Der frühere Wahrheitswert
  // wurde nur im `finally` eines `await` zurückgesetzt. Kam dieses `await` nie
  // zurück, blieb die Sperre für die Lebensdauer des Isolates gesetzt.
  const lock = new ExpiringLock();
  assert.equal(lock.tryAcquire(1_000, 60_000), true);
  assert.equal(lock.tryAcquire(60_500, 60_000), false, "innerhalb der Frist bleibt zu");
  assert.equal(lock.tryAcquire(61_000, 60_000), true, "nach der Frist geht sie wieder auf");
});

// --- Der ganze Lauf unter einer Frist ---------------------------------------

test("ein Lauf, der nie zurückkommt, endet mit Fehler und gibt die Sperre frei", { timeout: 5_000 }, async () => {
  // Das Abnahmekriterium aus docs/ai-todo.md, Punkt 1: Der Lauf endet mit einem
  // Fehler statt zu hängen — und der nächste Lauf startet danach wieder.
  const lock = new ExpiringLock();
  const laufe = async () => {
    if (!lock.tryAcquire()) throw new Error("eBay-Synchronisierung läuft bereits.");
    try {
      return await withDeadline(new Promise(() => {}), 50, "Zeitgrenze überschritten");
    } finally {
      lock.release();
    }
  };

  await assert.rejects(laufe, /Zeitgrenze/);
  assert.equal(lock.isHeld(), false, "die Sperre darf der abgebrochene Lauf nicht behalten");

  // Der nächste Lauf kommt wieder durch — hier mit einem Ergebnis.
  assert.equal(await (async () => {
    if (!lock.tryAcquire()) throw new Error("eBay-Synchronisierung läuft bereits.");
    try {
      return await withDeadline(Promise.resolve("fertig"), 5_000, "Zeitgrenze überschritten");
    } finally {
      lock.release();
    }
  })(), "fertig");
});

test("eine erfüllte Zusage überlebt die Frist unbeschadet", { timeout: 5_000 }, async () => {
  assert.equal(await withDeadline(Promise.resolve(42), 1_000, "zu spät"), 42);
  await assert.rejects(() => withDeadline(Promise.reject(new Error("echter Fehler")), 1_000, "zu spät"), /echter Fehler/);
});
