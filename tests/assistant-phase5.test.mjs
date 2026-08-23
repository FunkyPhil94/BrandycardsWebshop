/**
 * Phase-5-Abnahme des Desktop-Assistenten.
 *
 * Diese Datei hält die Befunde der Prüfsitzung fest: Fehler-, Timeout- und
 * Widerrufspfade des Servers sowie die beiden konkreten Fehler, die dabei am
 * Desktop-Client gefunden wurden (Body ohne Längenangabe, nicht DPI-skaliertes
 * Setup-Fenster). Der Rest der Prüfung — echter HTTP-Durchlauf, DPI-Messung,
 * Tastatur- und Screenreader-Bedienung — steht in docs/ai-handover.md.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  HybridAssistantPlanner,
  OpenAIResponsesAssistantPlanner,
  RuleBasedAssistantPlanner,
} = await import("../lib/assistant/planner.ts");
const { AssistantOrchestrator } = await import("../lib/assistant/orchestrator.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("ein Modellfehler wird weitergereicht statt als Antwort erfunden", async () => {
  const planner = new OpenAIResponsesAssistantPlanner("server-secret", "test-model", async () =>
    new Response("{\"error\":{\"message\":\"invalid_api_key\"}}", { status: 401 }));
  await assert.rejects(() => planner.plan("Was ging zuletzt weg?"), (error) => {
    assert.match(error.message, /HTTP 401/u);
    assert.doesNotMatch(error.message, /server-secret/u, "der Schlüssel darf in keiner Fehlermeldung stehen");
    return true;
  });
});

/** Dieser Test wartet bewusst die echten 15 Sekunden ab: Er ist der einzige
 *  Beleg dafür, dass ein hängender Provider die Geräteanfrage nicht endlos
 *  offen hält. `AbortSignal.timeout` lässt sich nicht künstlich vorstellen. */
test("die Modellplanung läuft unter einem Abbruchsignal und endet im Timeout", async () => {
  let seenSignal = null;
  const planner = new OpenAIResponsesAssistantPlanner("server-secret", "test-model", (_url, init) => {
    seenSignal = init.signal;
    // Ein Provider, der nie antwortet: nur das Signal beendet die Anfrage.
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
    });
  });

  const pending = planner.plan("Eine Formulierung, die der lokale Planer nicht kennt.");
  await assert.rejects(pending, (error) => error instanceof Error);
  assert.ok(seenSignal instanceof AbortSignal, "ohne Signal könnte eine Modellanfrage endlos hängen");
});

test("der Hybridplaner versteckt einen Modellfehler nicht", async () => {
  // **Diese Prüfung hat am 2026-08-17 ihre Form geändert, nicht ihre Absicht.**
  // Bis dahin verlangte sie, dass der Fehler durchgeworfen wird. Das erzeugte
  // in der Route ein 503 für die ganze Anfrage — und damit bei einem falsch
  // gesetzten Schlüssel *weniger* Auskunft, als ein gar nicht eingerichtetes
  // Modell liefert. Eine Aktivierung darf das Verhalten nicht verschlechtern,
  // wenn sie misslingt.
  //
  // Versteckt wird der Fehler trotzdem nicht: Er wird serverseitig
  // protokolliert, und die Antwort trägt `FAILED` — ausdrücklich **nicht**
  // `UNSUPPORTED`, denn ob die Frage beantwortbar wäre, ist unbekannt.
  // Einzelheiten in tests/assistant-model-planner.test.mjs.
  const originalError = console.error;
  console.error = () => {};
  try {
    const planner = new HybridAssistantPlanner(new RuleBasedAssistantPlanner(), {
      async plan() { throw new Error("Provider nicht erreichbar"); },
    });
    // Lokal erkannte Fragen bleiben von einem kaputten Provider unberührt.
    assert.equal((await planner.plan("Welche Bestellungen sind neu?")).tools[0].tool, "new_orders");
    assert.deepEqual(
      await planner.plan("Eine völlig freie Formulierung ohne Schlüsselwort."),
      { tools: [], reason: "MODEL_FAILED" },
    );
  } finally {
    console.error = originalError;
  }
});

test("ein fehlgeschlagener Planer erzeugt keine Antwort, sondern einen Fehler", async () => {
  const orchestrator = new AssistantOrchestrator(
    { async plan() { throw new Error("Planung fehlgeschlagen"); } },
    { async execute() { throw new Error("darf nie aufgerufen werden"); } },
  );
  await assert.rejects(() => orchestrator.ask({ message: "Statistik" }), /Planung fehlgeschlagen/u);
});

test("die Route bildet jeden Fehlerfall auf einen eigenen Status ohne Rohdetails ab", async () => {
  const route = await read("app/api/avatar/device/assistant/route.ts");
  assert.match(route, /RateLimitError[\s\S]*status: error\.status[\s\S]*"retry-after"/u);
  assert.match(route, /RequestBodyError \|\| error instanceof AssistantRequestError[\s\S]*status: error\.status/u);
  assert.match(route, /console\.error\("assistant orchestration failed", error\)[\s\S]*status: 503/u);
  assert.match(route, /status: 415/u, "ein falscher Content-Type muss eigens abgewiesen werden");
  assert.match(route, /status: 401/u);
  // Die generische 503-Meldung darf nichts über die Ursache verraten.
  assert.match(route, /"Der freie Assistant ist gerade nicht verfügbar\."/u);
});

test("der Widerruf und der Ablauf eines Gerätetokens sperren den Assistant sofort", async () => {
  const auth = await read("lib/avatar-device-auth.ts");
  assert.match(auth, /isNull\(avatarDeviceTokens\.revokedAt\)/u);
  assert.match(auth, /expiresAt <= Date\.now\(\)[\s\S]*return null/u);
  assert.match(auth, /deviceScopes\(record\.scopes\)\.includes\(requiredScope\)/u);
});

test("jeder JSON-Body des Desktop-Clients kennt seine Länge", async () => {
  // Gefunden in Phase 5: `PostAsJsonAsync` sendet chunked, worauf die
  // Worker-Laufzeit mit 411 antwortet. Die Kopplung gegen `npm run dev` war
  // dadurch unmöglich.
  const [page, service] = await Promise.all([
    read("avatar/BrandyCards.Desktop/MainPage.xaml.cs"),
    read("avatar/BrandyCards.Desktop/AssistantConversationService.cs"),
  ]);
  for (const [name, source] of [["MainPage.xaml.cs", page], ["AssistantConversationService.cs", service]]) {
    // Die Kommentare beschreiben den Befund und dürfen ihn nennen.
    const code = source.replaceAll(/^\s*\/\/.*$/gmu, "");
    assert.doesNotMatch(code, /PostAsJsonAsync|PutAsJsonAsync|PatchAsJsonAsync/u,
      `${name} darf keinen Body ohne content-length senden`);
  }
  assert.equal((page.match(/new StringContent\(JsonSerializer\.Serialize/gu) ?? []).length, 1);
  assert.match(page, /device\/claim[\s\S]{0,400}new StringContent\(JsonSerializer\.Serialize\(new \{ code \}\)/u);
});

test("alle Fenstergrößen des Launchers werden in physische Pixel umgerechnet", async () => {
  // Gefunden in Phase 5: Das Setup-Fenster wurde mit 520x760 *physischen*
  // Pixeln erzeugt und war bei 150 % DPI nur 347x507 effektive Pixel groß.
  const window = await read("avatar/BrandyCards.Desktop/MainWindow.xaml.cs");
  const sizeCalls = window.match(/(?:Resize|MoveAndResize)\(new (?:SizeInt32|RectInt32)\(([^)]*)\)/gu) ?? [];
  assert.ok(sizeCalls.length >= 2, "Setup- und Launcherfenster müssen beide geprüft werden");
  for (const call of sizeCalls) {
    assert.doesNotMatch(call, /\b\d{3,}\b/u, `feste Pixelmaße ignorieren die DPI: ${call}`);
  }
  // Im Konstruktor gibt es noch kein XamlRoot; ohne DPI-Rückfall bliebe der
  // Faktor dort auf 1.0 stehen.
  assert.match(window, /RootFrame\.XamlRoot\?\.RasterizationScale \?\? 0/u);
  assert.match(window, /GetDpiForWindow\(Win32Interop\.GetWindowFromWindowId\(AppWindow\.Id\)\)/u);
});

test("das transparente Pet bleibt vom Assistant getrennt", async () => {
  const overlay = await read("avatar/BrandyCards.Desktop/NativePetOverlay.cs");
  assert.doesNotMatch(overlay, /HttpClient|Assistant|api\/avatar|SpeechRecognition/u,
    "das Pet-Overlay darf weder Netzwerk noch Assistant kennen");
});

test("Audio und Transkript verlassen den lokalen Prozess nicht", async () => {
  const speech = await read("avatar/BrandyCards.Desktop/WindowsSpeechRecognitionService.cs");
  assert.doesNotMatch(speech, /HttpClient|https?:\/\/|Upload|Stream\s+\w*[Uu]pload/u);
  assert.match(speech, /SetInputToDefaultAudioDevice/u);
  // Jeder Ausfallgrund braucht einen eigenen, konkreten Hinweis.
  for (const failure of [
    "UnauthorizedAccessException",
    "PlatformNotSupportedException",
    "COMException",
    "InvalidOperationException",
    "ArgumentException",
  ]) {
    assert.match(speech, new RegExp(`catch \\(${failure}\\)`, "u"), `${failure} braucht eine eigene Meldung`);
  }
  assert.match(speech, /Es wurde kein Diktat erkannt/u);
});

test("jedes Bedienelement des Panels ist benannt und hat eine eindeutige Tab-Position", async () => {
  const xaml = await read("avatar/BrandyCards.Desktop/MainPage.xaml");
  for (const control of [
    "LauncherButton",
    "CloseAssistantButton",
    "AssistantInputTextBox",
    "DictateAssistantButton",
    "SendAssistantButton",
    "ChangeConnectionButton",
  ]) {
    const element = xaml.match(new RegExp(`x:Name="${control}"[\\s\\S]*?/?>`, "u"))?.[0] ?? "";
    assert.match(element, /AutomationProperties\.Name="/u, `${control} braucht einen zugänglichen Namen`);
    assert.match(element, /TabIndex="\d"/u, `${control} braucht eine Tab-Position`);
  }
  // Zwei getrennte Ansichten teilen sich die Zählung; innerhalb der
  // Assistant-Ansicht muss jede Position genau einmal vorkommen und aufsteigend
  // stehen.
  //
  // **Seit dem 2026-08-18 ist die Reihe nicht mehr lückenlos, und das ist
  // Absicht.** Position 2 gehört den Beispielfragen, die aus
  // `KarlPersona.Beispielfragen` im Code entstehen — sie hier auszuschreiben
  // hieße, dieselbe Liste zweimal zu pflegen. Geprüft wird deshalb die
  // Eigenschaft, auf die es ankommt (eindeutig und aufsteigend), statt einer
  // festen Liste, und die Lücke wird unten belegt.
  const panel = xaml.slice(xaml.indexOf('x:Name="ConnectedSurface"'));
  const positions = [...panel.matchAll(/TabIndex="(\d)"/gu)].map((match) => Number(match[1]));
  assert.equal(positions[0], 0, "die Tab-Reihe der Assistant-Ansicht beginnt bei 0");
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "die Tab-Positionen müssen aufsteigend stehen");
  assert.equal(new Set(positions).size, positions.length, "keine Tab-Position darf doppelt vergeben sein");

  // Die Lücke füllen die Chips, und auch sie brauchen einen Namen.
  const page = await read("avatar/BrandyCards.Desktop/MainPage.xaml.cs");
  const fehlend = [...Array(Math.max(...positions)).keys()].filter((wert) => !positions.includes(wert));
  assert.deepEqual(fehlend, [2], "nur die Chip-Position darf im XAML fehlen");
  assert.match(page, /TabIndex = 2,/u, "die Beispielfragen brauchen ihre Tab-Position");
  assert.match(page, /AutomationProperties\.SetName\(chip, \$"Beispielfrage: \{frage\}"\)/u);
  // Status- und Fehlermeldungen müssen angesagt werden.
  assert.equal((xaml.match(/AutomationProperties\.LiveSetting="Polite"/gu) ?? []).length, 2);
});

test("Antworten und Fehlermeldungen erreichen den Screenreader als benannte Elemente", async () => {
  const page = await read("avatar/BrandyCards.Desktop/MainPage.xaml.cs");
  // **Seit dem 2026-08-18 ohne die Klammerform der Verweise.** Der Antworttext
  // trägt Links als `[Text](URL)`; ein Vorleser, der „eckige Klammer auf, Titel,
  // eckige Klammer zu, runde Klammer auf, h t t p s Doppelpunkt …" sagt, macht
  // die Antwort unbenutzbar. Der Screenreader bekommt deshalb denselben Satz
  // ohne die Auszeichnung — die Zusicherung bleibt, ihr Inhalt wird lesbarer.
  assert.match(page, /AutomationProperties\.SetName\(messageBorder, \$"\{author\}: \{OhneVerweisklammern\(message\)\}"\)/u);
  assert.match(page, /internal static string OhneVerweisklammern/u);
  // Nur http und https werden zu Bedienelementen: Ein Verweis aus einer Antwort
  // öffnet den Browser des Betreibers, und `file:` wäre eine Startrampe.
  assert.match(page, /\\\[\(\[\^\\\]\]\+\)\\\]\\\(\(https\?:\/\/\[\^\\s\)\]\+\)\\\)/u);
  // Beim Öffnen in die Eingabe, beim Schließen zurück auf den Launcher.
  assert.match(page, /EnsureConversationInitialized\(\);\s*AssistantInputTextBox\.Focus\(FocusState\.Programmatic\)/u);
  assert.match(page, /else\s*\{\s*LauncherButton\.Focus\(FocusState\.Programmatic\)/u);
  assert.match(page, /VirtualKey\.Escape && _assistantPanelExpanded/u);
  // Während Diktat oder Abfrage bleiben alle drei Eingabewege gesperrt.
  assert.match(page, /var isBusy = _assistantRequestRunning \|\| _speechRecognitionRunning;[\s\S]*AssistantInputTextBox\.IsEnabled = !isBusy;[\s\S]*DictateAssistantButton\.IsEnabled = !isBusy;[\s\S]*SendAssistantButton\.IsEnabled = !isBusy;/u);
});
