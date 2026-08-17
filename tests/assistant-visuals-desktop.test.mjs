import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const PAGE = "avatar/BrandyCards.Desktop/MainPage.xaml.cs";
const ANSICHT = "avatar/BrandyCards.Desktop/StatistikAnsicht.cs";
const FENSTER = "avatar/BrandyCards.Desktop/StatistikFenster.cs";
const SERVICE = "avatar/BrandyCards.Desktop/AssistantConversationService.cs";

test("der Desktop platziert Text, er formatiert ihn nicht", async () => {
  // Phase 4 hat jede Formatierung aus dem Client entfernt. Leitzahl, Kacheln,
  // Achsenwerte und Hinweis kommen fertig vom Server.
  const ansicht = await read(ANSICHT);
  for (const zuweisung of [
    /heroLabel\.Text = eintrag\.HeroLabel;/u,
    /heroWert\.Text = eintrag\.HeroWert;/u,
    /hinweis\.Text = eintrag\.Hinweis;/u,
    /zeile\.Text = eintrag\.Achse\[i\];/u,
    /zelle\.Text = beschriftung;/u,
  ]) assert.match(ansicht, zuweisung);
  // Nirgends wird gerechnet oder eine Zahl gesetzt.
  assert.doesNotMatch(ansicht, /ToString\("[NCF]|\/ 100|toLocaleString/u, "hier wird nicht formatiert");
});

test("der Text steht nicht mehr im Bild — Direct2D zeichnet keinen", async () => {
  // **Der Befund vom 2026-08-17:** Balken und Gitterlinien kamen an, jede
  // Beschriftung fehlte. Direct2D unterstuetzt <text> nicht und ueberspringt es
  // stillschweigend.
  const visual = await read("lib/assistant/statistics-visual.ts");
  const plot = visual.slice(visual.indexOf("function zeichnePlot"), visual.indexOf("export function rendereStatistikBilder"));
  assert.doesNotMatch(plot, /<text/u, "im Plot darf kein Textelement stehen");
  assert.match(plot, /<line /u);
  assert.match(plot, /<rect /u);
});

test("Kacheln und alle Umschalter gehören ins Vollbild, nicht ins Panel", async () => {
  // Auf 520 Punkten Breite war im Screenshot der letzte Knopf abgeschnitten.
  const ansicht = await read(ANSICHT);
  assert.match(ansicht, /if \(!kompakt\) wurzel\.Children\.Add\(kacheln\);/u);
  assert.match(ansicht, /kompakt \? bilder\.Where\(b => b\.Schluessel\.EndsWith\("-umsatz"/u);
  assert.match(ansicht, /Groß anzeigen/u);
});

test("das Vollbild ist ein eigenes Fenster und rechnet die DPI mit", async () => {
  const fenster = await read(FENSTER);
  assert.match(fenster, /internal sealed class StatistikFenster : Window/u);
  // Dieselbe Falle wie in Phase 5: Feste Pixelmasse ergeben bei 150 % DPI ein
  // zu kleines Fenster.
  assert.match(fenster, /GetDpiForWindow\(griff\) \/ 96\.0/u);
  assert.doesNotMatch(fenster, /Resize\(new SizeInt32\(\d{3,}, \d{3,}\)\)/u, "keine festen Pixelmasse");
  // Escape schliesst -- dieselbe Erwartung wie beim Panel.
  assert.match(fenster, /VirtualKey\.Escape/u);
});

test("es gibt höchstens ein Statistikfenster", async () => {
  const page = await read(PAGE);
  assert.match(page, /_statistikFenster\?\.Close\(\);/u, "ein zweiter Klick stapelt keine Fenster");
  assert.match(page, /_statistikFenster = null;/u);
});

test("das Bild kommt aus dem Speicher, nicht von einer Adresse", async () => {
  const page = await read(ANSICHT);
  assert.match(page, /new MemoryStream\(Encoding\.UTF8\.GetBytes\(eintrag\.Svg\)\)/u);
  assert.doesNotMatch(page, /new SvgImageSource\(new Uri/u, "keine Adresse, die aufgeloest werden koennte");
});

test("auf das Laden wird gewartet, sonst bleibt das Bild manchmal leer", async () => {
  // Ohne await verlaesst der Strom seinen Gueltigkeitsbereich, bevor
  // SvgImageSource ihn gelesen hat -- und zwar nur manchmal, je nachdem wer
  // schneller ist. Der Compiler meldete das als CS4014.
  const page = await read(ANSICHT);
  assert.match(page, /await quelle\.SetSourceAsync\(strom\.AsRandomAccessStream\(\)\)/u);
});

test("der Text bleibt neben dem Bild stehen", async () => {
  // Ein Bild hat keine Trefferflaechen und ist fuer einen Screenreader stumm.
  const page = await read(PAGE);
  // Die Frage geht mit, damit das Statistikfenster sie für einen anderen
  // Zeitraum erneut stellen kann — der Client formuliert dabei nichts selbst.
  assert.match(page, /AddConversationMessage\("Assistant", reply\.Text, isUser: false\);\s*\n\s*AddConversationVisuals\(reply\.Visuals, message\);/u);
});

test("ohne Bilder ändert sich nichts am Panel", async () => {
  const [page, ansicht] = await Promise.all([read(PAGE), read(ANSICHT)]);
  assert.match(page, /if \(bilder\.Count == 0\) return;/u);
  // Ein einzelner Umschalter waere eine Bedienung, die nichts bewirkt.
  assert.match(ansicht, /if \(sichtbare\.Count > 1\)/u);
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
  // Ein Eintrag ohne Schluessel wird uebersprungen statt halb angezeigt. Ein
  // leeres SVG ist dagegen erlaubt: Eine reine Kennzahlenansicht hat kein
  // Diagramm, wohl aber Text.
  assert.match(service, /if \(string\.IsNullOrWhiteSpace\(schluessel\)\) continue;/u);
  assert.match(service, /if \(svg\.Length > 0 && !svg\.TrimStart\(\)\.StartsWith/u);
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

test("das Zeitfenster wird übertragen — sonst heißen die Knöpfe „0 Tage“", async () => {
  // **Genau das war der Fehler:** Der Orchestrator bildete `fenster` nicht ab,
  // und im Panel standen drei Knoepfe mit derselben Beschriftung.
  const orchestrator = await read("lib/assistant/orchestrator.ts");
  assert.match(orchestrator, /fenster: bild\.fenster/u);
  const service = await read(SERVICE);
  assert.match(service, /Zahl\(eintrag, "fenster"\)/u);
});

test("die x-Achse ist beschriftet, und nicht unter jeder Säule", async () => {
  const [visual, ansicht] = await Promise.all([
    read("lib/assistant/statistics-visual.ts"),
    read(ANSICHT),
  ]);
  assert.match(visual, /xAchse: liste\.map/u);
  // Bei dreissig Saeulen stuende sonst Datum an Datum.
  assert.match(visual, /i % Math\.ceil\(liste\.length \/ 6\) === 0 \? s\.kurz : ""/u);
  // Gleich breite Spalten -- dieselbe Aufteilung wie die Saeulen im Bild.
  assert.match(ansicht, /xAchse\.ColumnDefinitions\.Add\(new ColumnDefinition \{ Width = new GridLength\(1, GridUnitType\.Star\) \}\)/u);
});

test("die y-Werte sitzen auf ihren Gitterlinien, nicht darüber", async () => {
  // Gestapelte Textbloecke sassen ueber den Linien. Halbe Randzeilen ruecken
  // die Beschriftungen auf 0, 1/4, 1/2, 3/4 und 1 der Plothoehe.
  const ansicht = await read(ANSICHT);
  assert.match(ansicht, /new\[\] \{ 0\.5, 1\.0, 1\.0, 1\.0, 0\.5 \}/u);
  assert.match(ansicht, /VerticalAlignment\.Top[\s\S]*VerticalAlignment\.Bottom[\s\S]*VerticalAlignment\.Center/u);
});

test("der freie Zeitraum fragt neu und überschreibt nur die Spanne", async () => {
  const [fenster, orchestrator] = await Promise.all([read(FENSTER), read("lib/assistant/orchestrator.ts")]);
  assert.match(fenster, /Eigener Zeitraum:/u);
  assert.match(fenster, /Minimum = 1, Maximum = 90/u);
  // Der Planer bleibt der Einzige, der entscheidet, *was* gefragt wird.
  assert.match(orchestrator, /tool\.tool === "sales_overview" \? \{ \.\.\.tool, days: input\.tage \} : tool/u);
  // Ein Fehlschlag laesst die vorherige Ansicht stehen.
  assert.match(fenster, /catch \(Exception fehler\)/u);
});
