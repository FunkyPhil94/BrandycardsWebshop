/**
 * Legt Epics, Stories, Tasks und Testfälle im Jira-Projekt an und schreibt die
 * tatsächlich vergebenen Schlüssel nach docs/jira/board-key-map.csv.
 *
 * Warum ein Skript und nicht der CSV-Import von Jira: Die Verknüpfungen hängen
 * an Schlüsseln, die erst beim Anlegen entstehen. Der alte Bestand ist genau
 * daran gescheitert — seine CSVs verwiesen auf Nummern des damaligen Boards und
 * waren nie wieder importierbar. Hier läuft jede Runde gegen die echten
 * Schlüssel der Vorrunde, und die Zuordnung wird festgehalten statt gerechnet.
 *
 * Zugangsdaten (nur aus der Umgebung, niemals im Repository):
 *   JIRA_BASE_URL   z. B. https://brandycards.atlassian.net
 *   JIRA_EMAIL      Konto-E-Mail
 *   JIRA_API_TOKEN  API-Token aus id.atlassian.com -> Sicherheit -> API-Token
 *   JIRA_PROJECT    Projektschlüssel, Standard BWS
 *
 * Aufruf:
 *   node docs/jira/artifact_work/import-board.mjs --runde epics
 *   node docs/jira/artifact_work/import-board.mjs --runde stories
 *   node docs/jira/artifact_work/import-board.mjs --runde tasks
 *   node docs/jira/artifact_work/import-board.mjs --runde tests
 *   node docs/jira/artifact_work/import-board.mjs --runde alle
 *
 * Mit --trocken wird nichts geschrieben, sondern nur gezeigt, was entstünde.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const jiraRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const generatedDir = join(jiraRoot, "generated");
const keyMapPath = join(jiraRoot, "board-key-map.csv");

const BASE_URL = (process.env.JIRA_BASE_URL ?? "").replace(/\/+$/, "");
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT = process.env.JIRA_PROJECT ?? "BWS";

const TROCKEN = process.argv.includes("--trocken");
const RUNDE = (() => {
  const i = process.argv.indexOf("--runde");
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : "alle";
})();

class Abbruch extends Error {}
const abbruch = (nachricht) => { throw new Abbruch(nachricht); };

/** Minimaler CSV-Leser, der Zeilenumbrüche in gequoteten Feldern aushält. */
function csvLesen(pfad) {
  const text = readFileSync(pfad, "utf8").replace(/^﻿/, "");
  const zeilen = [];
  let feld = "";
  let zeile = [];
  let inFeld = false;

  for (let i = 0; i < text.length; i++) {
    const z = text[i];
    if (inFeld) {
      if (z === '"') {
        if (text[i + 1] === '"') { feld += '"'; i++; }
        else inFeld = false;
      } else feld += z;
      continue;
    }
    if (z === '"') { inFeld = true; continue; }
    if (z === ",") { zeile.push(feld); feld = ""; continue; }
    if (z === "\r") continue;
    if (z === "\n") { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ""; continue; }
    feld += z;
  }
  if (feld !== "" || zeile.length) { zeile.push(feld); zeilen.push(zeile); }

  const kopf = zeilen.shift();
  return zeilen
    .filter((z) => z.some((w) => w.trim() !== ""))
    .map((z) => Object.fromEntries(kopf.map((k, i) => [k, z[i] ?? ""])));
}

function csvFeld(wert) {
  const t = String(wert ?? "");
  return /[",\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
}

/** Die Zuordnung ist die eigentliche Ausbeute des Laufs und überlebt ihn. */
function keyMapLaden() {
  if (!existsSync(keyMapPath)) return [];
  return csvLesen(keyMapPath);
}

function keyMapSchreiben(eintraege) {
  const kopf = ["Typ", "Referenz", "Summary", "Jira Key"];
  const csv = [kopf.join(",")]
    .concat(eintraege.map((e) => [e.Typ, e.Referenz, e.Summary, e["Jira Key"]].map(csvFeld).join(",")))
    .join("\r\n");
  writeFileSync(keyMapPath, `﻿${csv}\r\n`, "utf8");
}

async function jira(pfad, methode = "GET", koerper) {
  const antwort = await fetch(`${BASE_URL}/rest/api/3${pfad}`, {
    method: methode,
    headers: {
      Authorization: `Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: koerper ? JSON.stringify(koerper) : undefined,
  });

  const text = await antwort.text();
  if (!antwort.ok) {
    abbruch(`Jira antwortet mit HTTP ${antwort.status} auf ${methode} ${pfad}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** Jira Cloud erwartet Beschreibungen im Atlassian Document Format. */
function adf(text) {
  return {
    type: "doc",
    version: 1,
    content: text.split(/\n/).map((zeile) => (
      zeile.trim() === ""
        ? { type: "paragraph", content: [] }
        : { type: "paragraph", content: [{ type: "text", text: zeile }] }
    )),
  };
}

async function vorgangAnlegen({ typ, summary, description, parentKey }) {
  const fields = {
    project: { key: PROJECT },
    issuetype: { name: typ },
    summary,
  };
  if (description) fields.description = adf(description);
  if (parentKey) fields.parent = { key: parentKey };

  if (TROCKEN) {
    console.log(`  [trocken] ${typ}: ${summary}${parentKey ? ` (Parent ${parentKey})` : ""}`);
    return { key: `TROCKEN-${Math.random().toString(36).slice(2, 7)}` };
  }
  return jira("/issue", "POST", { fields });
}

/**
 * Ein zweiter Lauf darf nichts verdoppeln. Deshalb wird jede Referenz vor dem
 * Anlegen gegen die bestehende Zuordnung geprüft. Ohne das erzeugt ein Abbruch
 * mitten in Runde drei beim Wiederholen 444 Dubletten.
 */
async function runde(name, typ, eintraege, keyMap) {
  const vorhanden = new Map(keyMap.filter((e) => e.Typ === name).map((e) => [e.Referenz, e["Jira Key"]]));
  let neu = 0;
  let uebersprungen = 0;

  for (const eintrag of eintraege) {
    if (vorhanden.has(eintrag.referenz)) { uebersprungen++; continue; }

    const ergebnis = await vorgangAnlegen({
      typ,
      summary: eintrag.summary,
      description: eintrag.description,
      parentKey: eintrag.parentKey,
    });

    keyMap.push({ Typ: name, Referenz: eintrag.referenz, Summary: eintrag.summary, "Jira Key": ergebnis.key });
    vorhanden.set(eintrag.referenz, ergebnis.key);
    neu++;
    if (!TROCKEN) keyMapSchreiben(keyMap); // nach jedem Vorgang, damit ein Abbruch nichts verliert
    process.stderr.write(`\r${name}: ${neu} neu, ${uebersprungen} übersprungen`);
  }

  process.stderr.write(`\r${name}: ${neu} neu, ${uebersprungen} übersprungen\n`);
  return keyMap;
}

function storyCodeAus(summary) {
  const treffer = /^(E\d+-\d+)/.exec(summary);
  return treffer ? treffer[1] : summary;
}

async function main() {
  if (!BASE_URL || !EMAIL || !TOKEN) {
    abbruch(
      "JIRA_BASE_URL, JIRA_EMAIL und JIRA_API_TOKEN müssen gesetzt sein.\n" +
      "  Token erzeugen: id.atlassian.com -> Sicherheit -> API-Token erstellen.\n" +
      "  cmd:  set \"JIRA_BASE_URL=https://brandycards.atlassian.net\" && set \"JIRA_EMAIL=...\" && set \"JIRA_API_TOKEN=...\"\n" +
      "Die Werte gehören nicht ins Repository.",
    );
  }

  let keyMap = keyMapLaden();
  const epicRows = csvLesen(join(jiraRoot, "brandycards-epics.csv"));
  const storyRows = csvLesen(join(jiraRoot, "brandycards-user-stories.csv"));
  const taskRows = csvLesen(join(generatedDir, "brandycards-detailed-tasks.csv"));

  const tun = (n) => RUNDE === "alle" || RUNDE === n;

  if (tun("epics")) {
    keyMap = await runde("Epic", "Epic", epicRows.map((r, i) => ({
      referenz: `E${i + 1}`,
      summary: r.Summary,
      description: r.Description,
    })), keyMap);
  }

  // Stories haengen an Epics. Die Reihenfolge der Epic-Datei ist die Zuordnung
  // E1..E9; der Story-Code traegt die Epic-Nummer im Praefix.
  const epicKeyByNr = new Map(keyMap.filter((e) => e.Typ === "Epic").map((e) => [e.Referenz, e["Jira Key"]]));

  if (tun("stories")) {
    keyMap = await runde("Story", "Story", storyRows.map((r) => {
      const code = storyCodeAus(r.Summary);
      const epicNr = `E${/^E(\d+)/.exec(code)?.[1] ?? ""}`;
      const parentKey = epicKeyByNr.get(epicNr);
      if (!parentKey) abbruch(`Kein Epic-Schlüssel für ${epicNr} — bitte zuerst die Runde epics ausführen.`);
      return { referenz: code, summary: r.Summary, description: r.Description, parentKey };
    }), keyMap);
  }

  const storyKeyByCode = new Map(keyMap.filter((e) => e.Typ === "Story").map((e) => [e.Referenz, e["Jira Key"]]));

  if (tun("tasks")) {
    // Die Task-CSV verweist auf Schluessel des alten Boards. Verwendet wird
    // deshalb der Story-Code aus dem Titel, nicht die Parent-Spalte.
    keyMap = await runde("Task", "Task", taskRows.map((r, i) => {
      const code = storyCodeAus(r.Summary);
      const parentKey = storyKeyByCode.get(code);
      if (!parentKey) abbruch(`Keine Story für Task „${r.Summary}" (Code ${code}) — bitte zuerst die Runde stories ausführen.`);
      return { referenz: `T${i + 1}`, summary: r.Summary, description: r.Description, parentKey };
    }), keyMap);
  }

  if (tun("tests")) {
    const testPfad = join(jiraRoot, "new-test-cases.csv");
    const testRows = csvLesen(testPfad);
    keyMap = await runde("Test", process.env.JIRA_TEST_TYPE ?? "Test", testRows.map((r) => ({
      referenz: `TC${r.Nr}`,
      summary: r.Summary,
      description: r.Description,
      // Absichtlich kein parent: Ein Test deckt eine Story ab, er ist kein
      // Unterpunkt von ihr. Die Verknuepfung entsteht im naechsten Schritt als
      // Issue-Link, sobald der Vorgangstyp und die Linkart feststehen.
    })), keyMap);
  }

  if (!TROCKEN) keyMapSchreiben(keyMap);

  const nachTyp = new Map();
  for (const e of keyMap) nachTyp.set(e.Typ, (nachTyp.get(e.Typ) ?? 0) + 1);
  console.error(`\nZuordnung: ${keyMapPath}`);
  for (const [typ, anzahl] of nachTyp) console.error(`  ${typ}: ${anzahl}`);
}

try {
  await main();
} catch (fehler) {
  if (fehler instanceof Abbruch) {
    console.error(`\nAbbruch: ${fehler.message}\n`);
    process.exitCode = 1;
  } else throw fehler;
}
