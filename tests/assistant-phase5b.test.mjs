/**
 * Phase 5b: Produktionsvorbereitung des Desktop-Assistenten.
 *
 * Zwei Invarianten werden hier festgehalten, die sich beide nur über
 * Dateigrenzen hinweg prüfen lassen und deshalb in keinem der beiden
 * beteiligten Projekte allein auffallen würden:
 *
 * 1. Der Desktop-Client muss länger warten als der längste Serverpfad. Der
 *    Zeitrahmen steht in C#, der des Modell-Planers in TypeScript; wer einen
 *    davon anfasst, sieht den anderen nicht.
 * 2. Das transparente Pet und das danebenliegende Fenster ankern beide am
 *    Arbeitsbereich mit denselben Rändern. Sonst stehen sie nicht auf einer
 *    Linie und das Pet liegt unter der Taskleiste.
 *
 * Kein Test hier ruft einen externen Anbieter. Der Modellpfad wird
 * ausschließlich über den lokalen Planer und ein Doppel geprüft.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { HybridAssistantPlanner, RuleBasedAssistantPlanner, createServerAssistantPlanner } =
  await import("../lib/assistant/planner.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const CLIENT = "avatar/BrandyCards.Desktop/AssistantConversationService.cs";
const PAGE = "avatar/BrandyCards.Desktop/MainPage.xaml.cs";
const WINDOW = "avatar/BrandyCards.Desktop/MainWindow.xaml.cs";
const OVERLAY = "avatar/BrandyCards.Desktop/NativePetOverlay.cs";

/** Netzpuffer zwischen Server- und Client-Grenze: Verbindungsaufbau, TLS,
 *  Rückweg und die Read-only-Abfragen nach der Planung. */
const MIN_NETWORK_BUFFER_MS = 5_000;
/** Eine begrenzte Wartezeit bleibt Pflicht — der Client darf nicht endlos hängen. */
const MAX_CLIENT_TIMEOUT_MS = 60_000;

async function clientTimeoutMs() {
  const source = await read(CLIENT);
  const match = source.match(/RequestTimeout\s*=\s*TimeSpan\.FromSeconds\((\d+)\)/u);
  assert.ok(match, `${CLIENT} muss RequestTimeout als TimeSpan.FromSeconds(...) benennen`);
  return Number(match[1]) * 1000;
}

async function serverModelTimeoutMs() {
  const source = await read("lib/assistant/planner.ts");
  const match = source.match(/MODEL_TIMEOUT_MS\s*=\s*([\d_]+)/u);
  assert.ok(match, "lib/assistant/planner.ts muss MODEL_TIMEOUT_MS benennen");
  return Number(match[1].replaceAll("_", ""));
}

test("der Desktop-Client bricht nicht vor dem Serverpfad ab", async () => {
  // Der eigentliche Befund aus Phase 5: 12 s Client gegen 15 s Modellpfad. Mit
  // gesetztem OPENAI_API_KEY hätte der Desktop eine Anfrage als gescheitert
  // gemeldet, die der Server noch beantwortet hätte.
  const [client, server] = await Promise.all([clientTimeoutMs(), serverModelTimeoutMs()]);
  assert.ok(
    client >= server + MIN_NETWORK_BUFFER_MS,
    `der Client wartet ${client} ms, der Modellpfad darf ${server} ms laufen — ` +
    `es fehlen mindestens ${MIN_NETWORK_BUFFER_MS} ms Netzpuffer`,
  );
});

test("die Wartezeit bleibt begrenzt", async () => {
  const client = await clientTimeoutMs();
  assert.ok(client <= MAX_CLIENT_TIMEOUT_MS, `${client} ms sind keine brauchbare Obergrenze mehr`);
  for (const path of [CLIENT, PAGE]) {
    assert.doesNotMatch(await read(path), /InfiniteTimeSpan|Timeout\.Infinite/u,
      `${path} darf keine unbegrenzte Anfrage zulassen`);
  }
});

test("der gemeinsame HttpClient übernimmt den Assistant-Zeitrahmen, die kurzen Pfade begrenzen sich selbst", async () => {
  const page = await read(PAGE);
  // `HttpClient.Timeout` ist eine Obergrenze für den ganzen Client. Stünde hier
  // erneut ein Literal, wäre der Zusammenhang zum Serverpfad wieder verloren.
  assert.match(page, /_httpClient\.Timeout = AssistantConversationService\.RequestTimeout;/u);
  assert.doesNotMatch(page, /_httpClient\.Timeout\s*=\s*TimeSpan\.From/u,
    "der Zeitrahmen gehört an eine Stelle, nicht als Zahl in die Seite");

  // Kopplung und Ereignisabruf dürfen nicht auf den langen Rahmen warten: Der
  // Abruf wiederholt sich alle drei Sekunden.
  assert.match(page, /ShopRequestTimeout = TimeSpan\.FromSeconds\((\d+)\)/u);
  const short = Number(page.match(/ShopRequestTimeout = TimeSpan\.FromSeconds\((\d+)\)/u)[1]) * 1000;
  assert.ok(short < await clientTimeoutMs(), "der kurze Pfad muss kürzer sein als der Assistant-Pfad");
  assert.equal(
    (page.match(/new CancellationTokenSource\(ShopRequestTimeout\)/gu) ?? []).length, 2,
    "Kopplung und Ereignisabruf brauchen jeweils ihre eigene Grenze",
  );
  for (const call of page.match(/_httpClient\.SendAsync\([^)]*\)/gu) ?? []) {
    assert.match(call, /,\s*\w+\.Token\)/u, `${call} läuft sonst in den langen Zeitrahmen`);
  }
});

test("Zeitüberschreitung, Nichterreichbarkeit und Serverfehler haben je eine eigene deutsche Anzeige", async () => {
  const [page, client] = await Promise.all([read(PAGE), read(CLIENT)]);

  // Ein Abbruch entsteht hier ausschließlich aus dem Zeitrahmen. Ohne eigenen
  // Zweig stünde die englische Framework-Meldung im Panel.
  assert.match(page, /catch \(OperationCanceledException\)[\s\S]*?AssistantStatusTextBlock\.Text = "Zeitüberschreitung"/u);
  assert.match(page, /RequestTimeout\.TotalSeconds/u, "die Anzeige muss die tatsächliche Wartezeit nennen");
  assert.match(page, /catch \(HttpRequestException ex\)[\s\S]*?AssistantStatusTextBlock\.Text = "Shop nicht erreichbar"/u);
  assert.match(page, /AssistantStatusTextBlock\.Text = "Anfrage fehlgeschlagen"/u);
  // Auch der Abrufpfad darf im Abbruchfall keine englische Meldung zeigen.
  assert.match(page, /catch \(OperationCanceledException\)[\s\S]*?Shop antwortet nicht/u);

  // Der Serverfehler kommt als Status zurück, nicht als Ausnahme.
  assert.match(client, /HttpStatusCode\.Unauthorized[\s\S]*?erneut/u);
  assert.match(client, /nicht erreichbar \(HTTP \{\(int\)response\.StatusCode\}\)/u);
});

test("ohne OPENAI_API_KEY bleibt der Modellpfad unerreichbar und nichts verlässt den Rechner", async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const planner = createServerAssistantPlanner();
    // Lokal erkannte Fragen laufen weiter durch.
    assert.equal((await planner.plan("Was wurde zuletzt verkauft?")).tools[0].tool, "latest_sale");
    // Eine freie Formulierung endet als ausdrücklich unkonfiguriert — ohne
    // Werkzeug und ohne einen einzigen ausgehenden Aufruf.
    const free = await planner.plan("Erzähl mir irgendwas über den Laden.");
    assert.deepEqual(free.tools, []);
    assert.equal(free.reason, "MODEL_NOT_CONFIGURED");
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }

  assert.equal((await new HybridAssistantPlanner(new RuleBasedAssistantPlanner(), null)
    .plan("Eine völlig freie Formulierung.")).reason, "MODEL_NOT_CONFIGURED");
});

test("der Modellzugang bleibt serverseitig", async () => {
  // `tests/assistant-orchestrator.test.mjs` hält das bereits für
  // AssistantConversationService.cs fest. Der längere Zeitrahmen ist aber
  // gerade *wegen* des Modellpfads gewählt — deshalb hier die übrigen
  // Desktop-Dateien und die Route dazu, damit der Anlass nicht irgendwann
  // dazu verleitet, den Anbieter in den Client zu ziehen.
  for (const path of [PAGE, WINDOW, OVERLAY]) {
    assert.doesNotMatch(await read(path), /OPENAI|api\.openai\.com/iu,
      `${path} darf den Modellzugang nicht kennen`);
  }
  // Die Route gibt Ursachen nie weiter — ein Anbieterfehler wird zu 503.
  assert.doesNotMatch(await read("app/api/avatar/device/assistant/route.ts"), /OPENAI/u);
});

test("das Pet ankert am Arbeitsbereich statt an der Bildschirmfläche", async () => {
  // Gemessen bei 150 % auf 2160x1440: Arbeitsbereich endet bei 1368, die
  // Taskleiste ist 72 Pixel hoch. Mit `SM_CYSCREEN` minus 48 lag die Unterkante
  // bei 1392 — 24 Pixel unter der Taskleiste.
  const overlay = await read(OVERLAY);
  const show = overlay.match(/public void Show\(\)[\s\S]*?\n    \}/u)?.[0] ?? "";
  assert.ok(show, "Show() muss auffindbar bleiben");
  assert.match(show, /PrimaryWorkArea\(\)/u);
  assert.doesNotMatch(show, /GetSystemMetrics/u, "die volle Bildschirmfläche ignoriert die Taskleiste");
  assert.match(overlay, /SystemParametersInfo\(SpiGetWorkArea, 0, ref workArea, 0\)/u);
  assert.match(overlay, /SpiGetWorkArea = 0x0030/u);
  // Ohne Arbeitsbereich bleibt die alte Position als Rückfall bestehen.
  assert.match(overlay, /Right = GetSystemMetrics\(SmCxScreen\)[\s\S]*?Bottom = GetSystemMetrics\(SmCyScreen\)/u);
});

test("Pet und Launcher verwenden denselben Bezug und dieselben Ränder", async () => {
  const [overlay, window] = await Promise.all([read(OVERLAY), read(WINDOW)]);
  const constant = (source, name) => {
    const match = source.match(new RegExp(`${name} = (\\d+)`, "u"));
    assert.ok(match, `${name} fehlt`);
    return Number(match[1]);
  };

  assert.equal(constant(overlay, "RightMargin"), constant(window, "PetRightOffset"));
  assert.equal(constant(overlay, "BottomMargin"), constant(window, "PetBottomOffset"));
  assert.equal(constant(overlay, "WindowWidth"), constant(window, "PetWidth"));
  // Beide rechnen gegen den Arbeitsbereich; sonst stehen sie nicht auf einer Linie.
  assert.match(window, /DisplayArea\.Primary\.WorkArea/u);
});

test("Größe, Transparenz und Animation des Pets bleiben unverändert", async () => {
  const overlay = await read(OVERLAY);
  // Die Positionsänderung darf das per-pixel-transparente Zeichnen nicht berühren.
  assert.equal(overlay.match(/WindowWidth = (\d+)/u)[1], "260");
  assert.equal(overlay.match(/WindowHeight = (\d+)/u)[1], "300");
  assert.equal(overlay.match(/FrameWidth = (\d+)/u)[1], "192");
  assert.equal(overlay.match(/FrameHeight = (\d+)/u)[1], "208");
  assert.match(overlay, /UpdateLayeredWindow\(_windowHandle, screenDc, ref destination, ref size, memoryDc,\s*ref source, 0, ref blend, UlwAlpha\)/u);
  assert.match(overlay, /AlphaFormat = AcSrcAlpha/u);
  assert.match(overlay, /PixelFormat\.Format32bppPArgb/u);
  assert.match(overlay, /graphics\.Clear\(Color\.Transparent\)/u);
  // Der Zeichenpunkt folgt dem Fenster, egal wohin es gesetzt wurde.
  assert.match(overlay, /GetWindowRect\(_windowHandle, out var windowRect\)/u);
  // Der Bildausschnitt je Einzelbild bleibt an das Raster gebunden.
  assert.match(overlay, /new Rectangle\(column \* FrameWidth, row \* FrameHeight, FrameWidth, FrameHeight\)/u);
});
