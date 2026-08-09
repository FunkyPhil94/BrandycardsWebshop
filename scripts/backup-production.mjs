import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DATABASE = "brandycards-production";
const BUCKET = "brandycards-uploads";
const R2_KEY_QUERY = "SELECT storage_key AS key FROM product_assets WHERE storage_key LIKE 'products/%' UNION SELECT storage_key FROM card_submission_assets WHERE storage_key LIKE 'card-submissions/%' ORDER BY key";
const EXTERNAL_ASSET_QUERY = "SELECT storage_key AS key, source_url AS sourceUrl FROM product_assets WHERE storage_key LIKE 'ebay/%' ORDER BY key";
const COUNT_QUERY = "SELECT (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM payments) AS payments, (SELECT count(*) FROM webhook_events) AS webhook_events";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

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

function rowsFromJson(text) {
  const value = JSON.parse(text);
  const resultSets = Array.isArray(value) ? value : [value];
  return resultSets.flatMap((result) => Array.isArray(result?.results) ? result.results : []);
}

function validStorageKey(key) {
  return typeof key === "string"
    && (key.startsWith("products/") || key.startsWith("card-submissions/"))
    && !key.includes("..")
    && !key.includes("\\")
    && !key.startsWith("/");
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

async function main() {
  const stamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
  const output = path.resolve(argument("--output") ?? path.join(ROOT, "..", "brandycards-backups", stamp));
  const relative = path.relative(ROOT, output);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error("Backups mit personenbezogenen Daten müssen außerhalb des Repositorys liegen.");
  }
  await mkdir(path.join(output, "r2"), { recursive: true });

  const databaseFile = path.join(output, "database.sql");
  await runWrangler(["d1", "export", DATABASE, "--remote", "--output", databaseFile, "--skip-confirmation"]);
  const [keysResult, externalAssetsResult, countsResult] = await Promise.all([
    runWrangler(["d1", "execute", DATABASE, "--remote", "--json", "--command", R2_KEY_QUERY]),
    runWrangler(["d1", "execute", DATABASE, "--remote", "--json", "--command", EXTERNAL_ASSET_QUERY]),
    runWrangler(["d1", "execute", DATABASE, "--remote", "--json", "--command", COUNT_QUERY]),
  ]);
  const keys = rowsFromJson(keysResult.stdout).map((row) => row.key);
  if (keys.some((key) => !validStorageKey(key))) throw new Error("Die Datenbank enthält einen unerwarteten R2-Schlüssel.");
  const externalAssets = rowsFromJson(externalAssetsResult.stdout)
    .filter((asset) => typeof asset.key === "string" && typeof asset.sourceUrl === "string")
    .map(({ key, sourceUrl }) => ({ key, sourceUrl }));
  const counts = rowsFromJson(countsResult.stdout)[0] ?? {};
  const objects = await mapWithConcurrency(keys, 8, async (key) => {
    const file = path.join("r2", key);
    const destination = path.join(output, file);
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      await runWrangler(["r2", "object", "get", `${BUCKET}/${key}`, "--remote", "--file", destination]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("specified key does not exist")) throw new Error(`R2-Download fehlgeschlagen für ${key}. ${message}`);
      return { key, missing: true, reason: "not_found" };
    }
    return { key, file, bytes: (await readFile(destination)).byteLength, sha256: await sha256(destination) };
  });

  const missingObjects = objects.filter((object) => object.missing).map(({ key, reason }) => ({ key, reason }));
  const presentObjects = objects.filter((object) => !object.missing);

  const manifest = {
    format: "brandycards-production-backup-v1",
    createdAt: new Date().toISOString(),
    database: DATABASE,
    databaseFile: "database.sql",
    bucket: BUCKET,
    rowCounts: counts,
    objects: presentObjects,
    missingObjects,
    externalAssets,
  };
  await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output, objects: presentObjects.length, missingObjects: missingObjects.length, externalAssets: externalAssets.length, rowCounts: counts }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
