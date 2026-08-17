import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const PAGE = "avatar/BrandyCards.Desktop/MainPage.xaml.cs";
const SERVICE = "avatar/BrandyCards.Desktop/AssistantConversationService.cs";

test("der Desktop zeigt an und zeichnet nicht", async () => {
  // Phase 4 hat jede Formatierung aus dem Client entfernt. Titel und Hinweis
  // kommen fertig vom Server; hier wird nichts zusammengesetzt.
  const page = await read(PAGE);
  assert.match(page, /AutomationProperties\.SetName\(bild, \$"\{eintrag\.Titel\}\. \{eintrag\.Hinweis\}"\)/u);
  assert.match(page, /hinweis\.Text = eintrag\.Hinweis;/u);
  // Kein Rechnen, kein Formatieren von Zahlen im Bildpfad.
  // Ab der **Definition**, nicht ab der Aufrufstelle -- sonst faengt der
  // Ausschnitt fremden Code davor mit ein.
  const block = page.slice(page.indexOf("private void AddConversationVisuals"), page.indexOf("private void SetAssistantBusy"));
  assert.ok(block.length > 200, "der Ausschnitt muss die Methode wirklich enthalten");
  assert.doesNotMatch(block, /ToString\("|toLocaleString|\/ 100|Math\./u, "im Bildpfad wird nicht gerechnet");
});

test("das Bild kommt aus dem Speicher, nicht von einer Adresse", async () => {
  const page = await read(PAGE);
  assert.match(page, /new MemoryStream\(Encoding\.UTF8\.GetBytes\(eintrag\.Svg\)\)/u);
  assert.doesNotMatch(page, /new SvgImageSource\(new Uri/u, "keine Adresse, die aufgeloest werden koennte");
});

test("auf das Laden wird gewartet, sonst bleibt das Bild manchmal leer", async () => {
  // Ohne await verlaesst der Strom seinen Gueltigkeitsbereich, bevor
  // SvgImageSource ihn gelesen hat -- und zwar nur manchmal, je nachdem wer
  // schneller ist. Der Compiler meldete das als CS4014.
  const page = await read(PAGE);
  assert.match(page, /await quelle\.SetSourceAsync\(strom\.AsRandomAccessStream\(\)\)/u);
});

test("der Text bleibt neben dem Bild stehen", async () => {
  // Ein Bild hat keine Trefferflaechen und ist fuer einen Screenreader stumm.
  const page = await read(PAGE);
  assert.match(page, /AddConversationMessage\("Assistant", reply\.Text, isUser: false\);\s*\n\s*AddConversationVisuals\(reply\.Visuals\);/u);
});

test("ohne Bilder ändert sich nichts am Panel", async () => {
  const page = await read(PAGE);
  assert.match(page, /if \(bilder\.Count == 0\) return;/u);
  // Ein einzelner Umschalter waere eine Bedienung, die nichts bewirkt.
  assert.match(page, /if \(bilder\.Count > 1\)/u);
});

test("das Thema geht mit der Frage, weil ein Bild nicht auf die Systemeinstellung reagiert", async () => {
  const [page, service] = await Promise.all([read(PAGE), read(SERVICE)]);
  assert.match(page, /ActualTheme == ElementTheme\.Dark \? "dunkel" : "hell"/u);
  assert.match(service, /JsonSerializer\.Serialize\(new \{ message, thema \}\)/u);
});

test("nur SVG wird angezeigt, und die Zahl der Bilder ist gedeckelt", async () => {
  const service = await read(SERVICE);
  assert.match(service, /StartsWith\("<svg", StringComparison\.OrdinalIgnoreCase\)/u,
    "alles andere waere Inhalt, den dieser Client nicht angefordert hat");
  assert.match(service, /if \(bilder\.Count == MaxVisuals\) break;/u);
  // Unvollstaendige Eintraege werden uebersprungen statt halb angezeigt.
  assert.match(service, /if \(string\.IsNullOrWhiteSpace\(svg\) \|\| string\.IsNullOrWhiteSpace\(schluessel\)\) continue;/u);
});

test("die Antwortgrenze wurde erhöht und die alte Begründung ersetzt", async () => {
  const service = await read(SERVICE);
  assert.match(service, /internal const int MaxResponseBytes = 512 \* 1024;/u);
  // Die alte Begruendung ("weit ueber der laengsten Textantwort") stimmt nicht
  // mehr, seit Bilder mitkommen -- sie darf nicht stehenbleiben.
  assert.doesNotMatch(service, /64 KiB liegen weit über der längsten Antwort/u);
  assert.match(service, /Sechs Ansichten wogen gemessen/u);
});

test("ein fehlendes visuals-Feld ist kein Fehler", async () => {
  // Eine aeltere Serverfassung schickt es nicht, und eine Antwort ohne Bild ist
  // der Normalfall.
  const service = await read(SERVICE);
  assert.match(service, /TryGetProperty\("visuals", out var liste\) \|\| liste\.ValueKind != JsonValueKind\.Array\) return bilder;/u);
  assert.match(service, /catch \(JsonException\)\s*\{\s*return \[\];/u);
});
