import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();

function wranglerInvocation(args) {
  return process.platform === "win32"
    ? { command: process.execPath, args: [path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js"), ...args] }
    : { command: "npx", args: ["wrangler", ...args] };
}

function runWrangler(args) {
  return new Promise((resolve, reject) => {
    const invocation = wranglerInvocation(args);
    const child = spawn(invocation.command, invocation.args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(`Wrangler fehlgeschlagen (${code}): ${stderr.trim() || stdout.trim()}`));
    });
  });
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function mapWithConcurrency(values, limit, task) {
  const results = new Array(values.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      results[index] = await task(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

function splitSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let inString = false;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (character !== "'") {
      if (character === ";" && !inString) {
        const statement = sql.slice(start, index + 1).trim();
        if (statement) statements.push(statement);
        start = index + 1;
      }
      continue;
    }
    if (inString && sql[index + 1] === "'") {
      index += 1;
      continue;
    }
    inString = !inString;
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

function orderForLocalD1Restore(sql) {
  const tables = [];
  const indexes = [];
  const data = [];
  const other = [];
  for (const statement of splitSqlStatements(sql)) {
    if (/^CREATE TABLE\b/iu.test(statement)) tables.push(statement);
    else if (/^CREATE (?:UNIQUE )?INDEX\b/iu.test(statement)) indexes.push(statement);
    else if (/^(?:INSERT|UPDATE|DELETE)\b/iu.test(statement)) data.push(statement);
    else if (!/^PRAGMA\b/iu.test(statement)) other.push(statement);
  }
  const tableNames = new Set();
  const dependencies = new Map();
  for (const statement of tables) {
    const tableMatch = statement.match(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?([A-Za-z0-9_]+)["`]?/iu);
    if (!tableMatch) continue;
    const table = tableMatch[1];
    tableNames.add(table);
    dependencies.set(table, new Set([...statement.matchAll(/REFERENCES\s+["`]?([A-Za-z0-9_]+)["`]?/giu)].map((match) => match[1])));
  }

  const dataByTable = new Map();
  const unclassifiedData = [];
  for (const statement of data) {
    const tableMatch = statement.match(/^(?:INSERT INTO|UPDATE|DELETE FROM)\s+["`]?([A-Za-z0-9_]+)["`]?/iu);
    const table = tableMatch?.[1];
    if (!table || !tableNames.has(table)) unclassifiedData.push(statement);
    else dataByTable.set(table, [...(dataByTable.get(table) ?? []), statement]);
  }

  const remaining = new Set(tableNames);
  const orderedTables = [];
  while (remaining.size) {
    const ready = [...remaining].filter((table) => [...(dependencies.get(table) ?? [])].every((dependency) => !remaining.has(dependency)));
    const batch = ready.length ? ready : [...remaining];
    for (const table of batch) {
      orderedTables.push(table);
      remaining.delete(table);
    }
  }
  const orderedData = orderedTables.flatMap((table) => dataByTable.get(table) ?? []);
  return ["PRAGMA foreign_keys=OFF;", ...tables, ...indexes, ...other, ...orderedData, ...unclassifiedData].join("\n");
}

async function main() {
  const backupDir = path.resolve(process.argv[2] ?? "");
  if (!process.argv[2] || process.argv.includes("--remote")) throw new Error("Restore braucht ein Backup-Verzeichnis und läuft ausschließlich lokal.");
  const manifest = JSON.parse(await readFile(path.join(backupDir, "manifest.json"), "utf8"));
  if (manifest.format !== "brandycards-production-backup-v1") throw new Error("Unbekanntes Backup-Format.");
  if (manifest.missingObjects?.length && !process.argv.includes("--allow-missing")) {
    throw new Error(`Backup ist unvollständig: ${manifest.missingObjects.length} referenzierte R2-Objekte fehlen. Für einen ausdrücklich partiellen Test --allow-missing angeben.`);
  }
  const persistTo = path.resolve(process.env.BRANDYCARDS_RESTORE_STATE ?? path.join(os.tmpdir(), `brandycards-restore-${Date.now()}`));
  await mkdir(persistTo, { recursive: true });

  // D1 export interleaves table creation and inserts. Local SQLite otherwise
  // rejects inserts into tables whose parents appear later. Reorder only the
  // isolated import: all tables and indexes are created first, then data is
  // inserted. Production is never touched by this script.
  const databaseFile = path.join(backupDir, manifest.databaseFile);
  const localImportFile = path.join(persistTo, "database-import.sql");
  await writeFile(localImportFile, orderForLocalD1Restore(await readFile(databaseFile, "utf8")), "utf8");
  await runWrangler(["d1", "execute", "DB", "--local", "--persist-to", persistTo, "--file", localImportFile, "--yes"]);
  const countsResult = await runWrangler(["d1", "execute", "DB", "--local", "--persist-to", persistTo, "--json", "--command", "SELECT (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM payments) AS payments, (SELECT count(*) FROM webhook_events) AS webhook_events"]);
  const countSets = JSON.parse(countsResult.stdout);
  const restoredCounts = (Array.isArray(countSets) ? countSets[0]?.results?.[0] : countSets?.results?.[0]) ?? {};
  for (const name of ["products", "orders", "payments", "webhook_events"]) {
    if (Number(restoredCounts[name]) !== Number(manifest.rowCounts[name])) throw new Error(`D1-Wiederherstellung weicht bei ${name} ab.`);
  }

  const verificationDir = path.join(persistTo, "r2-verification");
  await mapWithConcurrency(manifest.objects, 8, async (object) => {
    const source = path.join(backupDir, object.file);
    await runWrangler(["r2", "object", "put", `UPLOADS/${object.key}`, "--local", "--persist-to", persistTo, "--file", source, "-y"]);
    const restored = path.join(verificationDir, object.file);
    await mkdir(path.dirname(restored), { recursive: true });
    await runWrangler(["r2", "object", "get", `UPLOADS/${object.key}`, "--local", "--persist-to", persistTo, "--file", restored]);
    if (await sha256(restored) !== object.sha256) throw new Error(`R2-Wiederherstellung weicht bei ${object.key} ab.`);
  });
  console.log(JSON.stringify({ persistTo, databaseRows: manifest.rowCounts, objects: manifest.objects.length }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
