/**
 * Liest die Testergebnisse aller Xray-Tests des Projekts KAN und schreibt sie
 * nach docs/jira/xray-status-export.csv.
 *
 * Warum ein eigenes Skript und nicht der Atlassian-MCP-Server: Xray Cloud führt
 * Testergebnisse in seinem eigenen Speicher, nicht in Jira-Feldern. Über die
 * Jira-REST-API sind sie grundsätzlich nicht lesbar — siehe docs/ai-agent-log.md,
 * Eintrag vom 2026-08-15.
 *
 * Zugangsdaten:
 *   Ein API-Schlüsselpaar aus den Xray-Einstellungen (Global Settings -> API Keys).
 *   Es wird ausschließlich aus der Umgebung gelesen und niemals ausgegeben:
 *
 *     XRAY_CLIENT_ID       Client ID
 *     XRAY_CLIENT_SECRET   Client Secret
 *     XRAY_BASE_URL        optional, für regionale Instanzen
 *                          (z. B. https://us.xray.cloud.getxray.app)
 *
 *   Die Werte gehören niemals ins Repository, in wrangler.toml oder .env.example.
 *
 * Aufruf:
 *   node docs/jira/artifact_work/fetch-xray-status.mjs
 *   node docs/jira/artifact_work/fetch-xray-status.mjs --jql "project = KAN AND key = KAN-565"
 */

import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const jiraRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(jiraRoot, "xray-status-export.csv");
const erwarteteTestsPfad = join(jiraRoot, "generated", "brandycards-xray-tests.csv");

const BASE_URL = (process.env.XRAY_BASE_URL ?? "https://xray.cloud.getxray.app").replace(/\/+$/, "");
const CLIENT_ID = process.env.XRAY_CLIENT_ID;
const CLIENT_SECRET = process.env.XRAY_CLIENT_SECRET;

/** Xray begrenzt jede Verbindung auf 100 Elemente je Anfrage. Nicht erhöhen. */
const SEITENGROESSE = 100;

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const JQL = argument("--jql", "project = KAN AND issuetype = Test");

/**
 * Bricht mit einer lesbaren Meldung ab. Bewusst über eine Ausnahme und nicht
 * über process.exit(): Solange eine fetch-Verbindung offen ist, reißt ein
 * sofortiger Exit den Node-Prozess unter Windows in eine libuv-Assertion und
 * liefert Exitcode 127 statt 1 — ein Aufrufer könnte den Fehlschlag so nicht
 * mehr sauber erkennen.
 */
class Abbruch extends Error {}

function abbruch(nachricht) {
  throw new Abbruch(nachricht);
}

/**
 * Der Authentifizierungsendpunkt antwortet mit dem Token als JSON-String, also
 * inklusive Anführungszeichen. Ohne JSON.parse landen die Zeichen im Header und
 * jede Folgeanfrage scheitert mit 401 — eine Fehlersuche, die man sich sparen kann.
 */
async function token() {
  const antwort = await fetch(`${BASE_URL}/api/v2/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });

  if (!antwort.ok) {
    // Der Text kann die Zugangsdaten nicht enthalten, aber wir geben trotzdem
    // nur den Statuscode aus statt der vollständigen Antwort.
    abbruch(`Anmeldung an Xray fehlgeschlagen (HTTP ${antwort.status}). Schlüsselpaar und XRAY_BASE_URL prüfen.`);
  }

  return JSON.parse(await antwort.text());
}

async function graphql(bearer, query, variables) {
  const antwort = await fetch(`${BASE_URL}/api/v2/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ query, variables }),
  });

  if (!antwort.ok) abbruch(`GraphQL-Anfrage fehlgeschlagen (HTTP ${antwort.status}).`);

  const body = await antwort.json();
  if (body.errors?.length) {
    abbruch(`GraphQL meldet einen Fehler: ${body.errors.map((f) => f.message).join("; ")}`);
  }
  return body.data;
}

const ABFRAGE = `
  query ($jql: String!, $limit: Int!, $start: Int!) {
    getTests(jql: $jql, limit: $limit, start: $start) {
      total
      start
      limit
      results {
        issueId
        jira(fields: ["key", "summary"])
        testRuns(limit: 100) {
          total
          results {
            status { name }
            startedOn
            finishedOn
            testExecution { jira(fields: ["key"]) }
          }
        }
      }
    }
  }
`;

/**
 * Ein Test kann mehrfach ausgeführt worden sein. Welcher Lauf „der aktuelle" ist,
 * entscheidet das Skript nicht selbst still: Es nennt den jüngsten Lauf nach
 * Datum und weist die Gesamtzahl sowie alle vorkommenden Ergebnisse getrennt aus.
 * Wer eine Bilanz zieht, sieht damit sofort, ob sie auf einem eindeutigen Stand
 * beruht oder auf einer Auswahl.
 */
function ergebnisFuerTest(test) {
  const laeufe = test.testRuns?.results ?? [];
  if (laeufe.length === 0) {
    return { status: "KEIN_LAUF", anzahl: 0, alle: "", ausfuehrung: "", datum: "" };
  }

  const zeit = (lauf) => Date.parse(lauf.finishedOn ?? lauf.startedOn ?? "") || 0;
  const juengster = [...laeufe].sort((a, b) => zeit(b) - zeit(a))[0];
  const alle = [...new Set(laeufe.map((lauf) => lauf.status?.name ?? "OHNE_STATUS"))].sort();

  return {
    status: juengster.status?.name ?? "OHNE_STATUS",
    anzahl: test.testRuns?.total ?? laeufe.length,
    alle: alle.join("|"),
    ausfuehrung: juengster.testExecution?.jira?.key ?? "",
    datum: juengster.finishedOn ?? juengster.startedOn ?? "",
  };
}

function csvFeld(wert) {
  const text = String(wert ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Zählt die Datensätze einer CSV, nicht ihre Zeilen. Der Unterschied ist hier
 * kein Detail: Die Testbeschreibungen enthalten Zeilenumbrüche innerhalb
 * gequoteter Felder, weshalb ein naives Zählen der Zeilen 10323 statt 333
 * ergibt — und damit einen Abgleich, der reihenweise Lücken meldet, die es
 * nicht gibt.
 */
function csvDatensaetze(text) {
  let anzahl = 0;
  let inFeld = false;
  let zeileHatInhalt = false;

  for (let i = 0; i < text.length; i++) {
    const zeichen = text[i];
    if (inFeld) {
      if (zeichen === '"') {
        if (text[i + 1] === '"') i++;
        else inFeld = false;
      }
      continue;
    }
    if (zeichen === '"') { inFeld = true; zeileHatInhalt = true; continue; }
    if (zeichen === "\r") continue;
    if (zeichen === "\n") {
      if (zeileHatInhalt) anzahl++;
      zeileHatInhalt = false;
      continue;
    }
    zeileHatInhalt = true;
  }
  if (zeileHatInhalt) anzahl++;
  return anzahl;
}

function erwarteteSchluessel() {
  try {
    const text = readFileSync(erwarteteTestsPfad, "utf8").replace(/^﻿/, "");
    // Die Datei führt keine Jira-Schlüssel, sondern Import-IDs. Die bestätigte
    // Zuordnung ist KAN-565..KAN-897 in Dateireihenfolge (siehe Kaskadenliste).
    const anzahl = csvDatensaetze(text) - 1; // ohne Kopfzeile
    return new Set(Array.from({ length: anzahl }, (_, i) => `KAN-${565 + i}`));
  } catch {
    return null;
  }
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    abbruch(
      "XRAY_CLIENT_ID und XRAY_CLIENT_SECRET müssen gesetzt sein.\n" +
      "  PowerShell:  $env:XRAY_CLIENT_ID = '...'; $env:XRAY_CLIENT_SECRET = '...'\n" +
      "  Bash:        export XRAY_CLIENT_ID=... XRAY_CLIENT_SECRET=...\n" +
      "Die Werte stammen aus Xray -> Global Settings -> API Keys und gehören nicht ins Repository.",
    );
  }

  const bearer = await token();

  const tests = [];
  let start = 0;
  let gesamt = null;

  do {
    const daten = await graphql(bearer, ABFRAGE, { jql: JQL, limit: SEITENGROESSE, start });
    const seite = daten.getTests;
    gesamt = seite.total;
    tests.push(...seite.results);
    start += SEITENGROESSE;
    process.stderr.write(`\rGelesen: ${tests.length}/${gesamt}`);
  } while (start < gesamt);

  process.stderr.write("\n");

  const zeilen = tests.map((test) => {
    const ergebnis = ergebnisFuerTest(test);
    return {
      key: test.jira?.key ?? "",
      summary: test.jira?.summary ?? "",
      ...ergebnis,
    };
  });
  zeilen.sort((a, b) => Number(a.key.replace(/\D/g, "")) - Number(b.key.replace(/\D/g, "")));

  const kopf = ["Issue Key", "Summary", "Xray Status", "Laeufe", "Alle Ergebnisse", "Letzte Ausfuehrung", "Letztes Datum"];
  const csv = [kopf.join(",")]
    .concat(zeilen.map((z) => [z.key, z.summary, z.status, z.anzahl, z.alle, z.ausfuehrung, z.datum].map(csvFeld).join(",")))
    .join("\r\n");

  writeFileSync(outputPath, `﻿${csv}\r\n`, "utf8");

  // Bilanz. Absichtlich auf stderr, damit die CSV-Ausgabe unberührt bleibt.
  const nachStatus = new Map();
  for (const zeile of zeilen) nachStatus.set(zeile.status, (nachStatus.get(zeile.status) ?? 0) + 1);

  console.error(`\nGeschrieben: ${outputPath}`);
  console.error(`Tests gelesen: ${zeilen.length} (Xray meldet ${gesamt})`);
  console.error("Verteilung:");
  for (const [status, anzahl] of [...nachStatus].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${status}: ${anzahl}`);
  }

  const mehrfach = zeilen.filter((z) => z.anzahl > 1);
  if (mehrfach.length) {
    console.error(`\nHinweis: ${mehrfach.length} Tests haben mehr als einen Lauf. Ausgewiesen ist der jüngste; Spalte „Alle Ergebnisse" zeigt die übrigen.`);
  }

  // Vollständigkeit gegen die Importliste — fehlende Schlüssel werden benannt,
  // nicht verschwiegen. Eine unvollständige Bilanz ist schlimmer als keine.
  const erwartet = erwarteteSchluessel();
  if (erwartet) {
    const vorhanden = new Set(zeilen.map((z) => z.key));
    const fehlend = [...erwartet].filter((key) => !vorhanden.has(key));
    const unbekannt = [...vorhanden].filter((key) => !erwartet.has(key));
    console.error(`\nAbgleich gegen brandycards-xray-tests.csv (${erwartet.size} erwartete Schlüssel):`);
    console.error(`  fehlend:   ${fehlend.length}${fehlend.length ? ` -> ${fehlend.slice(0, 10).join(", ")}${fehlend.length > 10 ? " …" : ""}` : ""}`);
    console.error(`  unbekannt: ${unbekannt.length}${unbekannt.length ? ` -> ${unbekannt.slice(0, 10).join(", ")}${unbekannt.length > 10 ? " …" : ""}` : ""}`);
  }
}

try {
  await main();
} catch (fehler) {
  if (fehler instanceof Abbruch) {
    console.error(`\nAbbruch: ${fehler.message}\n`);
    process.exitCode = 1;
  } else {
    throw fehler;
  }
}
