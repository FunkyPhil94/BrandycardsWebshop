import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const quelle = await readFile(new URL("../lib/assistant/tools/sales.ts", import.meta.url), "utf8");
const koerper = quelle.slice(
  quelle.indexOf("export async function getLatestSale"),
  quelle.indexOf("export async function getSalesOverview"),
);

test("der letzte Verkauf wird aus drei Quellen gezogen, nicht aus zwei", () => {
  // **Der Befund vom 2026-08-17:** Ein Verkauf von vor einer Stunde erschien
  // nicht. Gelesen wurde fuer eBay allein `avatar_events` (der Webhook) --
  // produktiv 5 Ereignisse gegen 156 Verkaufszeilen, der neueste Webhook zwei
  // Tage alt. Die Auskunft war um Tage veraltet, nicht um Minuten.
  assert.match(koerper, /from\(ebaySales\)/u, "die Verkaufszeilen des Lesesyncs muessen gelesen werden");
  assert.match(koerper, /from\(avatarEvents\)/u, "der Webhook bleibt Quelle: er meldet in Sekunden");
  assert.match(koerper, /from\(orders\)/u);
});

test("genommen wird die neueste der drei, nicht die erstbeste", () => {
  for (const zeit of [/const shopZeit =/u, /const ereignisZeit =/u, /const verkaufZeit =/u]) {
    assert.match(koerper, zeit);
  }
  // Beide Vergleiche stehen da: Ohne den zweiten schlaege die Verkaufszeile den
  // Webhook auch dann, wenn dieser neuer ist -- und der ist schneller.
  assert.match(koerper, /verkaufZeit > shopZeit && verkaufZeit >= ereignisZeit/u);
  assert.match(koerper, /ereignisZeit > shopZeit/u);
});

test("die Verkaufszeile zaehlt nur, wenn der Lesesync sie verantworten kann", () => {
  // Sonst stuende eine veraltete Zeile als „letzter Verkauf" da, ohne dass der
  // fehlende Abgleich erwaehnt wuerde -- derselbe Fehler in neuer Gestalt.
  assert.match(koerper, /const verkaufAbrufbar = ebayReadAvailability\(syncStates\.get\("SALES"\)/u);
  assert.match(koerper, /ebaySale && verkaufAbrufbar &&/u);
});

test("die Herkunft wird nicht falsch ausgewiesen", () => {
  // Eine Zeile aus dem Lesesync ist kein Webhook-Ereignis. Steht die falsche
  // Quelle dabei, sucht der Betreiber den Fehler an der falschen Stelle.
  assert.match(koerper, /\}, \["EBAY_READ_API"\], assistantTimestamp\(ebaySale\.soldAt\)\)/u);
});
