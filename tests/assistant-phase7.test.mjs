/**
 * Phase 7: Desktop-Stabilität — der Rest, den Phase 6 ausdrücklich offen ließ.
 *
 * Zwei Themen, die eine Servertestreihe nie erwischt, weil der Server dabei
 * nicht beteiligt ist:
 *
 * 1. Der DPI-Wechsel zwischen Bildschirmen. Die Fenstergröße entstand mit der
 *    Skalierung des Bildschirms, auf dem das Fenster *herkam*, und wurde danach
 *    auf den Bildschirm des Pets geschoben.
 * 2. Der Fehlerpfad. `exception.Message` stand unbesehen in der Oberfläche.
 *
 * Was hier geprüft werden kann, ist die Rechenvorschrift und die Herkunft der
 * Zahlen — nicht der Zweischirmbetrieb selbst: Am Prüfgerät hängt genau ein
 * Monitor. Die gemessenen Zahlen stehen in docs/ai-agent-log.md; erzeugt haben
 * sie zwei Wegwerf-Prüfprogramme, die die echten Quelldateien eingebunden
 * beziehungsweise ausgelesen haben. Sie liegen bewusst nicht im Repository —
 * das eine öffnet Sockets, das andere braucht ein WinUI-freies Abbild der
 * Positionsrechnung. Was von ihnen dauerhaft gilt, steht als Zusicherung hier.
 *
 * Kein Test hier ruft einen externen Anbieter.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/** Kommentare dürfen den Befund beim Namen nennen — der Code nicht mehr. */
const codeOnly = (source) => source.replaceAll(/^\s*(?:\/\/|\/\/\/).*$/gmu, "");

const CLIENT = "avatar/BrandyCards.Desktop/AssistantConversationService.cs";
const ERRORS = "avatar/BrandyCards.Desktop/DesktopErrorMessages.cs";
const PAGE = "avatar/BrandyCards.Desktop/MainPage.xaml.cs";
const WINDOW = "avatar/BrandyCards.Desktop/MainWindow.xaml.cs";
const OVERLAY = "avatar/BrandyCards.Desktop/NativePetOverlay.cs";
const DESKTOP_README = "avatar/BrandyCards.Desktop/README.md";

// ---------------------------------------------------------------------------
// 1. Per-Monitor-DPI-Wechsel
// ---------------------------------------------------------------------------

test("die Fenstergröße entsteht mit der Skalierung des Zielbildschirms", async () => {
  const window = await read(WINDOW);
  // Der Kern des Befunds: Erst das Ziel bestimmen, dann damit rechnen.
  // Vorher stand `ToPhysicalPixels(...)` vor jeder Kenntnis des Ziels und
  // benutzte stillschweigend die Skalierung des eigenen Bildschirms.
  const configure = window.match(/public void ConfigureLauncherWindow\([\s\S]*?\n    \}/u)?.[0] ?? "";
  assert.ok(configure, "ConfigureLauncherWindow muss auffindbar bleiben");
  const petIndex = configure.indexOf("petPlacement ?? FallbackPlacement()");
  const scaleIndex = configure.indexOf("MonitorScale(");
  const sizeIndex = configure.indexOf("ToPhysicalPixels(");
  assert.ok(petIndex >= 0, "die Lage des Pets muss aufgelöst werden");
  assert.ok(scaleIndex > petIndex, "die Skalierung wird aus der Lage des Pets bestimmt");
  assert.ok(sizeIndex > scaleIndex, "erst die Skalierung, dann die Größe");
});

test("die Skalierung kommt aus einer echten Monitorabfrage, nicht aus einer Annahme", async () => {
  const window = await read(WINDOW);
  // MDT_EFFECTIVE_DPI ist genau der Wert, den der Nutzer als Skalierung
  // eingestellt hat; MONITOR_DEFAULTTONEAREST liefert auch für ein Rechteck
  // auf einem abgehängten Bildschirm einen Monitor statt NULL.
  assert.match(window, /GetDpiForMonitor\(monitor, MdtEffectiveDpi, out var dpiX, out _\)/u);
  assert.match(window, /MonitorFromRect\(ref rect, MonitorDefaultToNearest\)/u);
  assert.match(window, /MdtEffectiveDpi = 0/u);
  assert.match(window, /MonitorDefaultToNearest = 0x00000002/u);
  assert.match(window, /DllImport\("shcore\.dll"\)/u);
  assert.match(window, /return dpiX > 0 \? dpiX \/ 96\.0 : null;/u);
});

test("ohne belastbaren Wert wird nichts geraten", async () => {
  const window = await read(WINDOW);
  const scale = window.match(/private static double\? MonitorScale\([\s\S]*?\n    \}/u)?.[0] ?? "";
  assert.ok(scale, "MonitorScale muss auffindbar bleiben");
  // Jeder Fehlweg endet in `null` — nicht in 1.0 und nicht in 96.
  assert.equal((scale.match(/return null;/gu) ?? []).length, 2,
    "beide Fehlwege (kein Monitor, kein DPI) müssen null melden");
  assert.doesNotMatch(scale, /\?\?\s*1\.0|return 1\.0|= 96\b/u,
    "ein erfundener Standardfaktor wäre genau der veraltete Wert, der behoben werden soll");
  // Der Rückfall ist ausdrücklich die bisherige Rechnung, nicht eine Zahl.
  assert.match(window, /MonitorScale\(pet\.Left, pet\.Top, pet\.Right, pet\.Bottom\) \?\? RasterizationScale\(\)/u);
});

test("es gibt keine Umrechnung mehr, die sich ihren Faktor still selbst nimmt", async () => {
  const window = await read(WINDOW);
  const code = codeOnly(window);
  // Vorher: `ToPhysicalPixels(int effectivePixels)` griff intern auf
  // RasterizationScale() zu. Damit war an der Aufrufstelle nicht zu sehen,
  // welcher Bildschirm gemeint war.
  assert.doesNotMatch(code, /ToPhysicalPixels\(int effectivePixels\)\s*\n?\s*\{/u,
    "keine Umrechnung ohne ausdrücklichen Faktor");
  assert.match(window, /private static int ToPhysicalPixels\(int effectivePixels, double scale\)/u);
  const calls = (code.match(/ToPhysicalPixels\(/gu) ?? []).length - 1;
  const withScale = (code.match(/ToPhysicalPixels\([^)]*,\s*(?:scale|_appliedScale)\)/gu) ?? []).length;
  assert.ok(calls >= 4, "alle Größen laufen über dieselbe Umrechnung");
  assert.equal(withScale, calls, "jeder Aufruf gibt seinen Faktor ausdrücklich mit");
});

test("ein DPI-Wechsel unter dem Fenster wird nachgeführt", async () => {
  const window = await read(WINDOW);
  // Die zweite Richtung: nicht das Pet, sondern der Launcher wandert. Die
  // Fenstergröße in physischen Pixeln bliebe sonst stehen, während der Inhalt
  // sofort mit dem neuen Faktor gezeichnet wird.
  assert.match(window, /xamlRoot\.Changed \+= XamlRoot_Changed;/u);
  assert.match(window, /private void XamlRoot_Changed\(XamlRoot sender, XamlRootChangedEventArgs args\)/u);
  assert.match(window, /var scale = sender\.RasterizationScale;/u);
  // Changed feuert auch bei jeder Größenänderung; ohne Schranke löst das
  // eigene MoveAndResize sich selbst erneut aus.
  assert.match(window, /Math\.Abs\(scale - _appliedScale\) < 0\.001\) return;/u);
  // XamlRoot existiert erst nach dem Navigieren, ConfigureSetupWindow läuft
  // schon im Konstruktor — die Anmeldung muss wiederholbar sein.
  assert.match(window, /if \(_watchingScale\) return;/u);
  assert.match(window, /if \(xamlRoot is null\) return;/u);
});

test("das nachgeführte Fenster bleibt im Arbeitsbereich seines Bildschirms", async () => {
  const window = await read(WINDOW);
  const handler = window.match(/private void XamlRoot_Changed\([\s\S]*?\n    \}/u)?.[0] ?? "";
  assert.ok(handler, "der Handler muss auffindbar bleiben");
  // Die Lage bleibt, wo der Nutzer sie hingezogen hat; nur die Größe wächst.
  // Ein gewachsenes Fenster darf dabei nicht über den Rand hinausragen.
  assert.match(handler, /var position = AppWindow\.Position;/u);
  assert.match(handler, /Math\.Clamp\(x, work\.Left/u);
  assert.match(handler, /Math\.Clamp\(y, work\.Top/u);
  assert.match(window, /GetMonitorInfo\(monitor, ref info\) \? info\.WorkArea : null/u);
});

test("bei einem Bildschirm ändert sich an der Rechnung nichts", async () => {
  const window = await read(WINDOW);
  // Der Rückfall für die Zeit vor dem ersten Show() bleibt die alte
  // Primärschirmrechnung — sonst wäre die Startlage eine andere als bisher.
  assert.match(window, /DisplayArea\.Primary\.WorkArea/u);
  // Und die Positionierung selbst ist unverändert die aus Phase 6.
  assert.match(window, /var x = pet\.Left - LauncherGap - width;/u);
  assert.match(window, /var y = pet\.Bottom - height;/u);
  assert.match(window, /Math\.Clamp\(x, pet\.WorkLeft/u);
  assert.match(window, /Math\.Clamp\(y, pet\.WorkTop/u);
});

// ---------------------------------------------------------------------------
// 2. Fehlernachrichten
// ---------------------------------------------------------------------------

test("keine Ausnahmemeldung erreicht die Oberfläche", async () => {
  const page = codeOnly(await read(PAGE));
  // Vorher standen hier vier Stellen mit `{ex.Message}` — in der Statuszeile
  // und in der Unterhaltung.
  assert.doesNotMatch(page, /\{ex\.Message\}|\bex\.Message\b/u,
    "der Text einer Ausnahme gehört nicht ins Fenster");
  assert.doesNotMatch(page, /\.StackTrace|GetType\(\)/u,
    "Stacktrace und Typname erst recht nicht");
  // Jeder Auffangzweig läuft über dieselbe Stelle.
  const catches = (page.match(/catch \(Exception ex\)/gu) ?? []).length;
  const described = (page.match(/DesktopErrorMessages\.Describe\(ex\)/gu) ?? []).length;
  assert.ok(catches >= 3, "die drei Netzwege haben je einen allgemeinen Auffangzweig");
  assert.ok(described >= catches, "jeder davon muss durch die Übersetzung laufen");
});

test("die Unterscheidung kommt aus Aufzählungswerten, nicht aus Text", async () => {
  const errors = await read(ERRORS);
  // Der Punkt: Auf einem englischen Windows steht in Message etwas anderes als
  // auf einem deutschen. Ein Textvergleich wäre damit geraten.
  assert.match(errors, /SocketError\.ConnectionRefused/u);
  assert.match(errors, /SocketError\.HostNotFound/u);
  assert.match(errors, /HttpRequestError\.SecureConnectionError/u);
  assert.match(errors, /HttpRequestError\.NameResolutionError/u);
  const code = codeOnly(errors);
  assert.doesNotMatch(code, /Message\.Contains|Message\.StartsWith|Message\.IndexOf/u,
    "kein Schluss aus dem Meldungstext");
  // Genau eine Stelle darf einen Text weiterreichen: die eigene Ausnahme.
  const passthrough = (code.match(/exception\.Message/gu) ?? []).length;
  assert.equal(passthrough, 2, "einmal in die Fehlersuche, einmal für die eigene Meldung");
  assert.match(errors, /Debug\.WriteLine/u, "der technische Anlass bleibt für die Fehlersuche erhalten");
  assert.match(errors, /InvalidOperationException => SingleLine\(exception\.Message, MaxCharacters\)/u);
});

test("die gesicherte Verbindung wird vor dem Socket entschieden", async () => {
  const errors = await read(ERRORS);
  const method = errors.match(/private static string Unreachable\([\s\S]*?\n    \}/u)?.[0] ?? "";
  assert.ok(method, "Unreachable muss auffindbar bleiben");
  // Gemessen gegen einen HTTPS-Aufruf auf einen reinen HTTP-Zuhörer: Im
  // Fehlerbaum steht zusätzlich ein zurückgesetzter Socket. Mit der
  // Socket-Prüfung zuerst meldete die Anzeige „unterwegs getrennt" statt auf
  // die gesicherte Verbindung zu zeigen.
  const secure = method.indexOf("HttpRequestError.SecureConnectionError");
  const socket = method.indexOf("FindSocketError(exception)");
  assert.ok(secure >= 0 && socket >= 0);
  assert.ok(secure < socket, "die TLS-Fälle müssen vor der Socket-Prüfung stehen");
});

test("ein abgerissener Antwortkörper hat einen eigenen Fall", async () => {
  const errors = await read(ERRORS);
  // Gemessen: Wird der Körper nach ResponseHeadersRead gelesen und die
  // Gegenstelle legt mittendrin auf, kommt eine nackte IOException an — nicht
  // in eine HttpRequestException verpackt. Sie lief vorher in den
  // allgemeinen Fall.
  assert.match(errors, /IOException => "Die Verbindung zum Shop ist abgebrochen/u);
  const order = errors.indexOf("IOException =>");
  const fallback = errors.indexOf("_ => Unexpected,");
  assert.ok(order >= 0 && fallback > order, "der Sonderfall steht vor dem allgemeinen Fall");
});

test("jeder angezeigte Satz ist deutsch, begrenzt und einzeilig", async () => {
  const errors = await read(ERRORS);
  const limit = Number(errors.match(/MaxCharacters = ([\d_]+)/u)[1].replaceAll("_", ""));
  assert.ok(limit >= 100 && limit <= 1000, `${limit} ist keine brauchbare Grenze`);

  // Zeilenumbrüche gehören hier — anders als im Antwortpfad — zu Leerzeichen
  // zusammengezogen: Ziel ist die einzeilige Statuszeile.
  const single = errors.match(/private static string SingleLine\([\s\S]*?\n    \}/u)?.[0] ?? "";
  assert.ok(single, "SingleLine muss auffindbar bleiben");
  assert.match(single, /char\.IsControl\(character\)/u,
    "IsControl deckt auch U+007F und den C1-Bereich ab");
  assert.match(single, /builder\.Length == maximumCharacters/u);
  assert.match(errors, /gekürzt/u, "eine Kürzung muss sichtbar sein");

  // Alle angezeigten Sätze sind fest im Programm formuliert und deutsch.
  const sentences = [...errors.matchAll(/"(Der Shop [^"]+|Die (?:Anfrage|Verbindung) [^"]+|Unter dieser Adresse [^"]+)"/gu)]
    .map((match) => match[1]);
  assert.ok(sentences.length >= 8, `nur ${sentences.length} feste Meldungen gefunden`);
  for (const sentence of sentences) {
    assert.ok(sentence.length <= limit, `zu lang: ${sentence}`);
    assert.match(sentence, /[.?]$/u, `kein ganzer Satz: ${sentence}`);
    assert.doesNotMatch(sentence, /Exception|System\.|null|HTTP \d|0x/u, `technisch: ${sentence}`);
  }
});

test("der Antwortpfad aus Phase 6 bleibt unangetastet", async () => {
  // Die neue Übersetzung darf die dort gesetzten Grenzen nicht ersetzen: Der
  // Antworttext ist mehrzeilig und hat seine eigene, viel größere Grenze.
  const client = await read(CLIENT);
  assert.match(client, /MaxResponseBytes = 64 \* 1024/u);
  assert.match(client, /MaxAnswerCharacters = 20_000/u);
  assert.match(client, /HttpCompletionOption\.ResponseHeadersRead/u);
  assert.doesNotMatch(client, /DesktopErrorMessages/u,
    "der Antwortpfad formuliert seine Meldungen weiterhin selbst");
});

// ---------------------------------------------------------------------------
// 3. Pet-Größe: ausdrücklich unverändert
// ---------------------------------------------------------------------------

test("Pet-Größe, Atlas und Zeichenweg sind unverändert", async () => {
  const overlay = await read(OVERLAY);
  // Ohne höher aufgelöstes Ausgangsmaterial wäre jede Vergrößerung eine
  // Interpolation von Material mit weicher Kante (5,3 % teiltransparente
  // Pixel je Kachel, gemessen). Der Auftrag verbietet das ausdrücklich.
  assert.match(overlay, /FrameWidth = 192/u);
  assert.match(overlay, /FrameHeight = 208/u);
  assert.match(overlay, /WindowWidth = 260/u);
  assert.match(overlay, /WindowHeight = 300/u);
  assert.match(overlay, /graphics\.DrawImageUnscaled\(frame, \(WindowWidth - FrameWidth\) \/ 2, 42\)/u);
  const code = codeOnly(overlay);
  assert.doesNotMatch(code, /InterpolationMode|SmoothingMode|DrawImage\(frame,\s*new Rectangle/u,
    "keine Interpolation ohne ausdrücklichen Folgeauftrag");
  // Der Alpha-Pfad bleibt per-Pixel, nicht per-Fenster.
  assert.match(overlay, /PixelFormat\.Format32bppPArgb/u);
  assert.match(overlay, /UpdateLayeredWindow\(/u);
  // Und die Trennung aus Phase 5 gilt weiter.
  assert.doesNotMatch(overlay, /HttpClient|Assistant|api\/avatar|SpeechRecognition|OPENAI/u);
});

test("die Anforderungen an 2x-Material sind festgehalten", async () => {
  const readme = await read(DESKTOP_README);
  // Damit die spätere Grafikarbeit nicht raten muss: gemessene Maße statt
  // „doppelt so groß".
  assert.match(readme, /3072×3744/u, "das Gesamtmaß des 2x-Atlas gehört dokumentiert");
  assert.match(readme, /384×416/u, "das Kachelmaß ebenso");
  assert.match(readme, /1536×1872/u, "und das gemessene Maß des vorhandenen Materials");
  assert.match(readme, /nativ in doppelter Auflösung gezeichnet/u,
    "ein hochskalierter Atlas erfüllt den Zweck nicht");
  assert.match(readme, /nicht.{0,4}vormultipliziert/u, "das Alphaformat ist die Falle dabei");
  assert.match(readme, /173×200/u, "die heutige Wirkung bei 150 % gehört dazu");
});

// ---------------------------------------------------------------------------
// 4. Sicherheitsgrenze
// ---------------------------------------------------------------------------

test("der Modell-Planer bleibt aus dem Desktop heraus", async () => {
  const [errors, window, page] = await Promise.all([read(ERRORS), read(WINDOW), read(PAGE)]);
  for (const source of [errors, window, page]) {
    assert.doesNotMatch(source, /OPENAI|openai\.com|api\.anthropic|Bearer sk-/u);
  }
  // Und die neue Datei kennt kein Netz, sondern nur Ausnahmen.
  assert.doesNotMatch(errors, /HttpClient|SendAsync|api\/avatar/u);
});
