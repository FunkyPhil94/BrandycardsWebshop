import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// SEC-15: Auskunft und Löschung zur Selbstbedienung. Der gefährliche Fehler ist
// nicht ein Absturz, sondern eine **stille Lücke** — jemand ergänzt später eine
// Tabelle mit `user_id`, und die Auskunft liefert sie nicht mit, die Löschung
// lässt sie stehen. Beides fällt niemandem auf. Diese Tests lesen deshalb das
// Schema und halten es gegen die beiden Funktionen.

const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
const accountData = await readFile(new URL("../lib/account-data.ts", import.meta.url), "utf8");
const deleteRoute = await readFile(new URL("../app/api/account/delete/route.ts", import.meta.url), "utf8");

/** Alle Tabellen des Schemas, die auf `users` zeigen. */
function tabellenMitNutzerbezug() {
  const treffer = [];
  const tabellen = schema.matchAll(/export const (\w+) = sqliteTable\("(\w+)", \{([\s\S]*?)\n\}, \(table\)/gu);
  for (const [, variable, tabelle, koerper] of tabellen) {
    if (/references\(\(\) => users\.id/u.test(koerper)) treffer.push({ variable, tabelle });
  }
  return treffer;
}

// Bewusst getroffene Entscheidungen, jede mit Grund. Wer eine Tabelle hier
// einträgt, muss den Grund danebenschreiben — das ist der Sinn der Liste.
const AUSNAHMEN = {
  // Rechnungsbelege: Art. 17 Abs. 3 lit. b DSGVO nimmt sie vom Löschanspruch
  // aus. Sie stehen in der Auskunft, werden aber nicht gelöscht.
  orders: "Aufbewahrungspflicht",
  // Enthält keine Kundendaten, sondern Verwaltungsspuren; `actor_user_id` fällt
  // beim Löschen der Kontozeile per ON DELETE SET NULL von selbst weg.
  audit_events: "kein Kundeninhalt",
  // Bestandssperren, keine Auskunftsdaten. Werden mitgelöscht, tauchen in der
  // Auskunft aber nicht auf — sie sagen einem Kunden nichts.
  reservations: "kein Auskunftsinhalt",
  // `created_by_user_id` zeigt auf den Admin, der eine Karte angelegt hat, nicht
  // auf einen Kunden. Karten sind Warenbestand und dürfen nicht verschwinden,
  // weil jemand sein Konto löscht; die Spalte fällt per SET NULL weg.
  products: "Warenbestand, kein Kundeninhalt",
};

test("jede Tabelle mit Nutzerbezug ist in der Auskunft oder begründet ausgenommen", () => {
  const tabellen = tabellenMitNutzerbezug();
  assert.ok(tabellen.length >= 5, `zu wenige Tabellen gefunden (${tabellen.length}) — der Scan greift ins Leere`);

  const fehlend = tabellen.filter(({ variable, tabelle }) =>
    !(tabelle in AUSNAHMEN) && !new RegExp(`\\b${variable}\\b`, "u").test(accountData));
  assert.deepEqual(fehlend.map((eintrag) => eintrag.tabelle), [],
    "diese Tabellen zeigen auf users, kommen aber in lib/account-data.ts nicht vor — die Auskunft wäre unvollständig");
});

test("jede Tabelle mit Nutzerbezug wird gelöscht oder steht begründet in den Ausnahmen", () => {
  const geloescht = [...accountData.matchAll(/db\.delete\((\w+)\)/gu)].map(([, variable]) => variable);
  const tabellen = tabellenMitNutzerbezug();

  const uebrig = tabellen.filter(({ variable, tabelle }) => !(tabelle in AUSNAHMEN) && !geloescht.includes(variable));
  assert.deepEqual(uebrig.map((eintrag) => eintrag.tabelle), [],
    "diese Tabellen überleben die Kontolöschung, ohne in den Ausnahmen begründet zu sein");

  // Die Kontozeile selbst muss zuletzt fallen, sonst greift ON DELETE SET NULL
  // auf den anderen Tabellen, bevor sie gelesen wurden.
  assert.ok(geloescht.at(-1) === "users", "die users-Zeile muss als Letztes gelöscht werden");
});

test("Bestellungen werden nie gelöscht", () => {
  assert.ok(!/db\.delete\(orders\)/u.test(accountData),
    "Rechnungsbelege unterliegen der Aufbewahrungspflicht und dürfen nicht gelöscht werden");
});

test("die Rohantwort von PayPal steht nicht in der Kundenauskunft", () => {
  // `payments.raw_data` enthält die vollständige PayPal-Antwort. Sie in eine
  // Auskunft zu schreiben wäre kein Datenschutz, sondern ein Leck nach außen.
  // Deshalb werden die Spalten einzeln ausgewählt — ein `select()` über die
  // ganze Tabelle würde sie stillschweigend mitnehmen.
  assert.ok(!/rawData/u.test(accountData), "raw_data darf in der Auskunft nirgends vorkommen");
  assert.ok(!/db\.select\(\)\.from\(payments\)/u.test(accountData), "Zahlungszeilen nur spaltenweise lesen");
});

test("ohne Service-Role-Key wird gar nicht erst gelöscht", () => {
  // Der halbe Zustand — Shopdaten weg, Anmeldung da — ist schlechter als der
  // heutige. Der Abbruch muss **vor** dem ersten Schreibzugriff stehen.
  const abbruch = deleteRoute.indexOf("hasSupabaseAdminAccess()");
  const loeschen = deleteRoute.indexOf("deleteAccountData(");
  assert.ok(abbruch > 0 && abbruch < loeschen, "die Prüfung auf den Service-Role-Key muss vor dem Löschen stehen");
});

test("laufende Bestellungen blockieren die Löschung", () => {
  // Mitten in einem Checkout oder einem PayPal-Einzug zu löschen, schneidet in
  // einen Geldvorgang. Beide Zustände müssen blockieren.
  assert.match(accountData, /BLOCKING_ORDER_STATUSES = \["PENDING", "PROCESSING"\]/u);
  const pruefung = deleteRoute.indexOf("blockingOrders(");
  const loeschen = deleteRoute.indexOf("deleteAccountData(");
  assert.ok(pruefung > 0 && pruefung < loeschen, "die Prüfung muss vor dem Löschen stehen");
});

test("das Anmeldekonto fällt erst nach den Shopdaten", () => {
  // Andersherum stünde ein Kunde nach einem Fehlschlag ohne Login, aber mit
  // seinen Daten da — und käme an den Selbstbedienungsweg nicht mehr heran.
  const shop = deleteRoute.indexOf("deleteAccountData(");
  const auth = deleteRoute.indexOf("deleteSupabaseUser(");
  assert.ok(shop > 0 && shop < auth, "erst die Shopdaten, dann das Anmeldekonto");
});
