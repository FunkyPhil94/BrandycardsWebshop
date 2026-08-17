import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("jede Testdatei steht auch im test-Skript", async () => {
  // **Die Falle vom 2026-08-17:** `npm test` zaehlt die Dateien einzeln in
  // package.json auf, statt sie zu suchen. Zwei neu geschriebene Dateien liefen
  // deshalb nur von Hand -- in der CI nie. Der Lauf war gruen und sagte
  // trotzdem nichts ueber die neue Arbeit aus.
  const skript = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).scripts.test;
  const dateien = (await readdir(new URL("../tests", import.meta.url))).filter((name) => name.endsWith(".test.mjs"));
  const fehlend = dateien.filter((name) => !skript.includes(`tests/${name}`));
  assert.deepEqual(fehlend, [], `nicht im test-Skript eingetragen: ${fehlend.join(", ")}`);
});
