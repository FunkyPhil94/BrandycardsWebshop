/**
 * Phase 6: die verbleibenden Produktionsrisiken des Desktop-Assistenten.
 *
 * Alle drei Befunde hier wurden gegen einen lokalen Wegwerf-Testserver
 * gemessen, nicht aus dem Code erschlossen. Was sie gemeinsam haben: Sie
 * treten erst auf, wenn zwischen Desktop und Shop etwas *anderes* antwortet
 * als die eigene Route — ein Proxy, eine Portalseite, ein halb gestorbener
 * Server — oder wenn der Nutzer das Pet anfasst. Genau das prüft kein
 * Servertest, weil der Server dabei gar nicht beteiligt ist.
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
const PAGE = "avatar/BrandyCards.Desktop/MainPage.xaml.cs";
const WINDOW = "avatar/BrandyCards.Desktop/MainWindow.xaml.cs";
const OVERLAY = "avatar/BrandyCards.Desktop/NativePetOverlay.cs";

test("der Antwortkörper wird gestreamt und begrenzt gelesen", async () => {
  // Gemessen: Ein Testserver mit zwei Millionen Zeichen kam ungebremst durch.
  // `ReadFromJsonAsync` liest ohne Grenze, und in der Voreinstellung hat
  // `SendAsync` den Körper längst gepuffert, bevor irgendeine Grenze greifen
  // könnte. Ohne ResponseHeadersRead ist die Obergrenze unten wirkungslos.
  const client = await read(CLIENT);
  assert.match(client, /HttpCompletionOption\.ResponseHeadersRead/u,
    "ohne ResponseHeadersRead puffert SendAsync den ganzen Körper vorab");
  assert.match(client, /MaxResponseBytes = 64 \* 1024/u);
  assert.doesNotMatch(codeOnly(client), /ReadFromJsonAsync/u,
    "ReadFromJsonAsync liest unbegrenzt und wirft bei kaputtem JSON");
  // Ein Byte mehr als erlaubt: sonst ist „genau voll" nicht von „zu groß"
  // unterscheidbar.
  assert.match(client, /new byte\[MaxResponseBytes \+ 1\]/u);
  assert.match(client, /total > MaxResponseBytes/u);
});

test("kein englischer JSON-Ausnahmetext erreicht die Unterhaltung", async () => {
  // Gemessen gegen 200 mit HTML-Körper:
  //   "'<' is an invalid start of a value. Path: $ | LineNumber: 0 …"
  // und gegen {"answer": 42} sogar der interne Typname:
  //   "…could not be converted to …AssistantConversationService+AssistantReply"
  // Beides stand wörtlich im Panel.
  const client = await read(CLIENT);
  assert.match(client, /JsonDocument\.Parse\(body\)/u);
  assert.match(client, /catch \(JsonException\)/u,
    "ungültiges JSON muss als eigener Fall enden, nicht als Ausnahme");
  assert.match(client, /kein gültiges JSON/u, "der Fall braucht eine deutsche Anzeige");
  // Ein Zahlenwert in `answer` ist kein Text und darf nicht werfen.
  assert.match(client, /ValueKind == JsonValueKind\.String/u);
});

test("angezeigter Text ist in jeder Richtung längenbegrenzt", async () => {
  const client = await read(CLIENT);
  const answer = Number(client.match(/MaxAnswerCharacters = ([\d_]+)/u)[1].replaceAll("_", ""));
  const error = Number(client.match(/MaxErrorCharacters = ([\d_]+)/u)[1].replaceAll("_", ""));

  // Die längste echte Antwort entsteht aus sechs Werkzeugen à höchstens
  // zwanzig Einträgen (MAX_PLANNED_TOOLS/Limit in lib/assistant). Die Grenze
  // muss darüber liegen, sonst schneidet sie gültige Auskünfte ab.
  assert.ok(answer >= 6 * 20 * 120, `${answer} Zeichen schneiden echte Antworten ab`);
  // Die Fehlermeldungen der eigenen Route sind alle unter 100 Zeichen lang.
  assert.ok(error >= 100 && error < answer, `${error} ist keine brauchbare Fehlergrenze`);

  // Jeder Aufruf muss seine Grenze mitgeben; ein Standardwert würde die
  // Entscheidung unsichtbar machen.
  const code = codeOnly(client);
  const declarations = (code.match(/string Shorten\(/gu) ?? []).length;
  assert.equal(declarations, 1, "es gibt genau eine Kürzungsstelle");
  const calls = (code.match(/\bShorten\(/gu) ?? []).length - declarations;
  const bounded = (code.match(/,\s*Max\w+Characters\)/gu) ?? []).length;
  assert.ok(calls >= 2, "Antwort und Fehlertext werden beide gekürzt");
  assert.equal(bounded, calls, "jeder Shorten-Aufruf braucht eine ausdrückliche Grenze");
  assert.doesNotMatch(code, /string Shorten\(string value\)/u, "keine stille Standardgrenze");
  assert.match(client, /gekürzt/u, "eine Kürzung muss sichtbar sein");
});

test("Steuerzeichen fliegen raus, Zeilenumbrüche bleiben", async () => {
  // Der Antwortformatierer erzeugt echte mehrzeilige Listen (`join("\n")` in
  // lib/assistant/response-formatter.ts) — die dürfen nicht verloren gehen.
  // Ein Fehlertext mit ANSI-Sequenzen kam dagegen unverändert durch.
  const client = await read(CLIENT);
  const shorten = client.match(/private static string Shorten\([\s\S]*?\n    \}/u)?.[0] ?? "";
  assert.ok(shorten, "Shorten muss auffindbar bleiben");
  assert.match(shorten, /character != '\\n'/u, "Zeilenumbrüche gehören erhalten");
  assert.match(shorten, /character < ' '/u, "alles unterhalb U+0020 gehört entfernt");
});

test("eine Absage des Shops ist keine empfangene Antwort", async () => {
  const [client, page] = await Promise.all([read(CLIENT), read(PAGE)]);
  assert.match(client, /record struct AssistantAnswer\(bool Succeeded, string Text\)/u);
  assert.match(client, /Task<AssistantAnswer> AskAsync/u);
  // Vorher meldete die Statuszeile auch bei HTTP 503 „Antwort empfangen".
  assert.match(page, /reply\.Succeeded \? "Antwort empfangen" : "Shop meldet einen Fehler"/u);
  // Erfolg gibt es nur mit echtem Text.
  assert.match(client, /new AssistantAnswer\(true,/u);
  assert.equal((client.match(/new AssistantAnswer\(true,/gu) ?? []).length, 1,
    "genau ein Pfad darf als Erfolg gelten");
});

test("das Pet meldet seine tatsächliche Lage samt zugehörigem Bildschirm", async () => {
  const overlay = await read(OVERLAY);
  // Das Pet ist verschiebbar: WM_NCHITTEST antwortet mit HTCAPTION, die
  // gesamte Fläche ist ein Ziehgriff. Aus den Rändern zurückgerechnete
  // Positionen sind danach falsch.
  assert.match(overlay, /return new IntPtr\(HtCaption\)/u);
  assert.match(overlay, /public PetPlacement\? CurrentPlacement\(\)/u);
  // MonitorFromWindow liefert den Bildschirm, auf dem das Fenster liegt —
  // bei mehreren Bildschirmen nicht zwingend der primäre.
  assert.match(overlay, /MonitorFromWindow\(_windowHandle, MonitorDefaultToNearest\)/u);
  assert.match(overlay, /GetMonitorInfo\(monitor, ref info\)/u);
  assert.match(overlay, /MonitorDefaultToNearest = 0x00000002/u);
  // Vor Show() steht das Fenster bei 0/0 und darf keine Lage behaupten.
  assert.match(overlay, /if \(_disposed \|\| _windowHandle == IntPtr\.Zero \|\| !_placed\) return null;/u);
  assert.match(overlay, /_placed = true;/u);
  assert.match(overlay, /_placed = false;/u);
});

test("der Launcher folgt dem Pet statt dem Primärbildschirm", async () => {
  const window = await read(WINDOW);
  assert.match(window, /PositionBesidePet\(int width, int height, PetPlacement\? petPlacement\)/u);
  // Maßgeblich ist die tatsächliche Lage, nicht die zurückgerechnete.
  assert.match(window, /var x = pet\.Left - LauncherGap - width;/u);
  assert.match(window, /var y = pet\.Bottom - height;/u);
  // Geklemmt wird gegen den Arbeitsbereich des Bildschirms, auf dem das Pet
  // liegt — sonst landet das Fenster bei einem Pet in der Ecke außerhalb.
  assert.match(window, /Math\.Clamp\(x, pet\.WorkLeft/u);
  assert.match(window, /Math\.Clamp\(y, pet\.WorkTop/u);
  // Ohne Platz links wird rechts danebengestellt statt darüber.
  assert.match(window, /x = pet\.Right \+ LauncherGap;/u);
  // Solange das Pet nicht sichtbar ist, gilt weiter die alte Rechnung.
  assert.match(window, /DisplayArea\.Primary\.WorkArea/u);
});

test("Pet und Launcher rechnen mit derselben Pet-Größe", async () => {
  // Die Breite hält bereits tests/assistant-phase5b.test.mjs fest. Die Höhe
  // kam mit dem Rückfall dazu und ist genauso ein Wert an zwei Stellen.
  const [overlay, window] = await Promise.all([read(OVERLAY), read(WINDOW)]);
  assert.equal(
    overlay.match(/WindowHeight = (\d+)/u)[1],
    window.match(/PetHeight = (\d+)/u)[1],
    "PetHeight muss der Fensterhöhe des Pets entsprechen",
  );
});

test("die Lage des Pets wird gesetzt, bevor danebengestellt wird", async () => {
  const page = await read(PAGE);
  // Umgekehrte Reihenfolge hieße: danebenstellen zu einem Fenster, das noch
  // bei 0/0 liegt.
  assert.match(page, /_petOverlay\.Show\(\);\s*\(\(App\)Application\.Current\)\.MainWindow\?\.ConfigureLauncherWindow\(petPlacement: _petOverlay\.CurrentPlacement\(\)\);/u);
  // Auch beim Auf- und Zuklappen zählt die aktuelle Lage, nicht die vom Start.
  assert.match(page, /ConfigureLauncherWindow\(expanded, _petOverlay\?\.CurrentPlacement\(\)\)/u);
});

test("das Pet-Overlay kennt weiterhin weder Netzwerk noch Modellzugang", async () => {
  // Die neue Lagemeldung darf die Trennung aus Phase 5 nicht aufweichen.
  const overlay = await read(OVERLAY);
  assert.doesNotMatch(overlay, /HttpClient|Assistant|api\/avatar|SpeechRecognition|OPENAI/u);
});
