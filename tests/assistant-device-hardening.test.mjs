import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const PAGE = "avatar/BrandyCards.Desktop/MainPage.xaml.cs";

/** Nur der Code, ohne Kommentarzeilen.
 *
 * Gebraucht für Prüfungen der Form „das darf nirgends stehen": Die
 * Begründungen in dieser Datei nennen die verbotenen Bezeichner
 * absichtlich, um zu erklären, warum sie verboten sind. */
const ohneKommentare = (quelle) => quelle.replaceAll(/^\s*\/\/.*$/gmu, "");

test("das Gerätetoken liegt nicht mehr im Klartext auf der Platte", async () => {
  const page = await read(PAGE);
  const beginn = page.indexOf("private static class SettingsStore");
  assert.notEqual(beginn, -1, "SettingsStore fehlt");
  const store = page.slice(beginn);

  // An das Windows-Benutzerkonto gebunden -- ein anderes Konto auf demselben
  // Rechner kann den Wert nicht entschluesseln.
  assert.match(store, /ProtectedData\.Protect\([\s\S]*DataProtectionScope\.CurrentUser\)/u);
  assert.match(store, /ProtectedData\.Unprotect\([\s\S]*DataProtectionScope\.CurrentUser\)/u);
  // Zusaetzliche Entropie bindet die Verschluesselung an diesen Zweck.
  assert.match(store, /private static readonly byte\[\] Entropy/u);
  // Und der Klartext verschwindet beim Speichern, sonst waere die
  // Verschluesselung nur eine zweite Kopie desselben Geheimnisses.
  assert.match(store, /settings\.LegacyDeviceToken = null;/u);
});

test("das entschlüsselte Token wird nie in die Datei geschrieben", async () => {
  const page = await read(PAGE);
  const feld = page.match(/\[JsonIgnore\]\s*public string\? DeviceToken \{ get; set; \}/u);
  assert.ok(feld, "DeviceToken muss von der Serialisierung ausgenommen sein");
});

test("die Migration trifft die Schreibweise, die tatsächlich auf der Platte steht", async () => {
  // **Der teuerste Fehler dieser Aufgabe, beinahe passiert.** In den
  // bestehenden Dateien heisst das Feld `DeviceToken` mit grossem D, und
  // `JsonSerializer` liest ohne `PropertyNameCaseInsensitive` case-sensitiv.
  // Mit `deviceToken` haette die Migration nicht gegriffen: Das Token waere als
  // verloren gewertet worden und der Nutzer haette neu koppeln muessen -- ohne
  // Fehlermeldung, die den Grund nennt.
  const page = await read(PAGE);
  assert.match(page, /\[JsonPropertyName\("DeviceToken"\)\]\s*public string\? LegacyDeviceToken/u,
    "der Legacy-Name muss genau der Schreibweise auf der Platte entsprechen");
  // Und es darf keine Option geben, die das versehentlich wieder aufweicht:
  // Wer `PropertyNameCaseInsensitive` ergaenzt, aendert stillschweigend, welche
  // Dateien noch gelesen werden.
  assert.doesNotMatch(ohneKommentare(page), /PropertyNameCaseInsensitive/u);
  // Migriert wird nur, wenn kein verschluesselter Wert vorliegt -- sonst wuerde
  // ein alter Klartextrest einen neueren Token ueberschreiben.
  assert.match(page, /if \(settings\.DeviceToken is null && !string\.IsNullOrWhiteSpace\(settings\.LegacyDeviceToken\)\)/u);
});

test("ein nicht entschlüsselbares Token gilt als nicht gekoppelt, nicht als Fehler", async () => {
  // Eine kopierte Datei auf einem anderen Rechner *soll* sich nicht
  // entschluesseln lassen. Das ist der Zweck von DPAPI und kein Defekt.
  const page = await read(PAGE);
  assert.match(page, /catch \(Exception exception\) when \(exception is CryptographicException or FormatException\)\s*\{\s*return null;/u);
});

test("die Shop-Adresse muss HTTPS sein, außer auf localhost", async () => {
  const page = await read(PAGE);
  const pruefung = page.match(/private static string NormalizeShopUrl[\s\S]*?\n    \}/u)?.[0] ?? "";
  assert.ok(pruefung, "NormalizeShopUrl fehlt");

  // Ueber diese Adresse geht das Token als Authorization-Kopfzeile hinaus.
  assert.match(pruefung, /uri\.Scheme == Uri\.UriSchemeHttp && !uri\.IsLoopback/u);
  assert.match(pruefung, /muss https:\/\/ verwenden/u);
  // Loopback bleibt erlaubt, sonst waere `npm run dev` nicht mehr erreichbar --
  // der in der README beschriebene Entwicklungsweg.
  assert.match(pruefung, /IsLoopback/u);
});

test("die Kopplung warnt vor ihrem Ablauf, statt still zu enden", async () => {
  const page = await read(PAGE);
  // Der Shop liefert expiresAt beim Koppeln; bis heute wurde es verworfen.
  assert.match(page, /\[property: JsonPropertyName\("expiresAt"\)\] DateTimeOffset\? ExpiresAt/u);
  assert.match(page, /ExpiresAt = claim\.ExpiresAt/u, "der Wert muss auch gespeichert werden");
  assert.match(page, /private const int PairingExpiryWarningDays = \d+;/u);
  // Eine aeltere Kopplung kennt den Zeitpunkt nicht. Dann wird nichts
  // behauptet -- eine erfundene Frist waere schlechter als keine.
  assert.match(page, /if \(_settings\.ExpiresAt is not \{ \} ablauf\) return;/u);
  assert.match(page, /WarnIfPairingExpiresSoon\(\);/u);
});
