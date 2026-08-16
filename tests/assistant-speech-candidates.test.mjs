import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  AssistantRequestError,
  MAX_ASSISTANT_CANDIDATES,
  parseAssistantCandidateProbeInput,
} = await import("../lib/assistant/contracts.ts");
const { selectResolvableCandidate } = await import("../lib/assistant/candidate-probe.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const PROBE_ROUTE = "app/api/avatar/device/assistant/probe/route.ts";
const SPEECH = "avatar/BrandyCards.Desktop/WindowsSpeechRecognitionService.cs";
const SERVICE = "avatar/BrandyCards.Desktop/AssistantConversationService.cs";
const PAGE = "avatar/BrandyCards.Desktop/MainPage.xaml.cs";

test("die Lesartenprüfung nimmt ausschließlich eine begrenzte Kandidatenliste", () => {
  assert.deepEqual(
    parseAssistantCandidateProbeInput({ candidates: ["  Welche Bestellungen sind neu?  ", "Welche Besteller sind neu?"] }),
    { candidates: ["Welche Bestellungen sind neu?", "Welche Besteller sind neu?"] },
  );

  assert.throws(() => parseAssistantCandidateProbeInput({ candidates: [] }), /nicht leer/u);
  assert.throws(() => parseAssistantCandidateProbeInput({ candidates: "Bestellungen" }), /Liste/u);
  assert.throws(() => parseAssistantCandidateProbeInput({ candidates: ["Bestellungen", 7] }), /Text/u);
  assert.throws(() => parseAssistantCandidateProbeInput({ candidates: ["Bestellungen", "   "] }), /nicht leer/u);
  assert.throws(() => parseAssistantCandidateProbeInput({ candidates: ["x".repeat(1001)] }), /höchstens 1000/u);
  assert.throws(
    () => parseAssistantCandidateProbeInput({ candidates: Array.from({ length: MAX_ASSISTANT_CANDIDATES + 1 }, () => "Bestellungen") }),
    new RegExp(`höchstens ${MAX_ASSISTANT_CANDIDATES} Lesarten`, "u"),
  );
  // Die Prüfroute darf kein Schlupfloch für andere Felder sein.
  assert.throws(() => parseAssistantCandidateProbeInput({ candidates: ["Bestellungen"], message: "x" }), /Nicht unterstützte Felder/u);
  assert.throws(() => parseAssistantCandidateProbeInput({ message: "Bestellungen" }), AssistantRequestError);
});

test("liegt die beste Lesart daneben, gewinnt die erste zuordenbare", async () => {
  // Abnahmekriterium 1: Die erste Erkennung trifft nichts, die zweite trifft.
  const probe = await selectResolvableCandidate([
    "Der Baum steht im Garten",
    "Wie viele Verkäufe hatte ich in den letzten 7 Tagen?",
  ]);
  assert.deepEqual(probe, {
    readOnly: true,
    selectedIndex: 1,
    selected: "Wie viele Verkäufe hatte ich in den letzten 7 Tagen?",
  });
});

test("ohne zuordenbare Lesart wird nichts erraten", async () => {
  // Abnahmekriterium 2: Kein Treffer ist ein Ergebnis, kein Notbehelf. Der
  // Desktop bleibt danach beim ersten Kandidaten und bekommt UNSUPPORTED.
  const probe = await selectResolvableCandidate(["Der Baum steht im Garten", "Erzähl mir einen Witz"]);
  assert.deepEqual(probe, { readOnly: true, selectedIndex: null, selected: null });
});

test("die Prüfung hält beim ersten Treffer an und plant nicht weiter", async () => {
  const gefragt = [];
  const planner = {
    async plan(message) {
      gefragt.push(message);
      return { tools: message === "zweite" ? [{ tool: "new_orders", limit: 10 }] : [], reason: "READY" };
    },
  };
  const probe = await selectResolvableCandidate(["erste", "zweite", "dritte"], planner);
  assert.equal(probe.selectedIndex, 1);
  assert.deepEqual(gefragt, ["erste", "zweite"], "nach dem Treffer darf keine weitere Lesart geplant werden");
});

test("die Vorauswahl bleibt beim Regelplaner und ruft kein Modell", async () => {
  // Fünf Kandidaten am Modell-Planer wären im schlechtesten Fall fünfmal
  // MODEL_TIMEOUT_MS -- über eine Minute Wartezeit vor der eigentlichen Frage.
  const probe = await read("lib/assistant/candidate-probe.ts");
  assert.match(probe, /RuleBasedAssistantPlanner/u);
  assert.doesNotMatch(probe, /OpenAI|HybridAssistantPlanner|createServerAssistantPlanner/u);
});

test("die Prüfroute führt kein Werkzeug aus und teilt sich die Ratenbegrenzung", async () => {
  const route = await read(PROBE_ROUTE);
  // Ohne Registry und ohne Orchestrator kann diese Route keine Geschäftsdaten
  // lesen -- sie beantwortet ausschließlich, ob ein Text zuordenbar wäre.
  assert.doesNotMatch(route, /assistantToolRegistry|createServerAssistantOrchestrator|server-tool-registry/u);
  assert.match(route, /enforcePublicRateLimit\(request, "avatar-assistant"\)/u,
    "ein eigener Bereich verdoppelte das Kontingent eines gekoppelten Geräts");
  assert.match(route, /authenticateAvatarDevice\(request, "ASSISTANT_READ"\)/u);
  // Die Begrenzung greift vor dem Token-Lookup, wie in der Frageroute.
  assert.match(route, /enforcePublicRateLimit[\s\S]*authenticateAvatarDevice/u);
  assert.match(route, /readTextBody\(request, MAX_PROBE_REQUEST_BYTES\)/u);
});

test("Desktop und Server nennen dieselbe Kandidatengrenze", async () => {
  const speech = await read(SPEECH);
  const desktopGrenze = Number(speech.match(/internal const int MaxCandidates = (\d+);/u)?.[1]);
  assert.equal(desktopGrenze, MAX_ASSISTANT_CANDIDATES,
    "eine höhere Desktop-Grenze liefe in die Abweisung des Servers");
  // Abnahmekriterium 4: die Zahl ist gedeckelt und im Code begründet.
  assert.match(speech, /`MAX_ASSISTANT_CANDIDATES` in lib\/assistant\/contracts\.ts/u);
});

test("die Erkennung reicht die Alternativen heraus, statt sie zu verwerfen", async () => {
  const speech = await read(SPEECH);
  // Ohne MaxAlternates bleibt die zweitbeste Lesart im Erkenner liegen.
  assert.match(speech, /recognizer\.MaxAlternates = MaxCandidates;/u);
  assert.match(speech, /lesarten\.AddRange\(result\.Alternates\);/u);
  assert.match(speech, /if \(candidates\.Count == MaxCandidates\) break;/u);
  // Die beste Lesart steht in der Liste vorn, damit das freie Diktat seine
  // eigene Reihenfolge behält. Seit Variante 2 dürfen Grammatiktreffer davor
  // -- aber nur sie, und nur oberhalb der Konfidenzschwelle.
  assert.match(speech, /new List<RecognizedPhrase> \{ result \}/u);
  assert.match(speech, /\.Where\(IstGrammatiktreffer\)[\s\S]*OrderByDescending\(phrase => phrase\.Confidence\)/u);
  assert.match(speech, /candidates\.Contains\(trimmed, StringComparer\.OrdinalIgnoreCase\)/u);
  // Phase 3 gilt weiter: Audio und Transkript bleiben lokal.
  assert.doesNotMatch(speech, /HttpClient|https?:\/\//u);
});

test("eine gescheiterte Vorauswahl verhindert die Frage nicht", async () => {
  const service = await read(SERVICE);
  assert.match(service, /if \(candidates\.Count < 2\) return null;/u,
    "eine einzige Lesart braucht keine Anfrage");
  assert.match(service, /catch \(Exception exception\) when \(exception is HttpRequestException or IOException or OperationCanceledException or JsonException\)\s*\{\s*return null;/u);
  assert.match(service, /if \(!response\.IsSuccessStatusCode\) return null;/u,
    "auch 429 und 503 enden in der bisherigen Lesart");
  // Der Zeitrahmen der Prüfung liegt vor der Frage und muss kürzer sein.
  const probeSekunden = Number(service.match(/ProbeTimeout = TimeSpan\.FromSeconds\((\d+)\)/u)?.[1]);
  const frageSekunden = Number(service.match(/RequestTimeout = TimeSpan\.FromSeconds\((\d+)\)/u)?.[1]);
  assert.ok(probeSekunden > 0 && probeSekunden < frageSekunden,
    `die Prüfung (${probeSekunden}s) darf nicht so lange warten wie die Frage (${frageSekunden}s)`);
});

test("die Prüfung darf auswählen, aber nicht diktieren", async () => {
  // Ein fremder Zwischenknoten könnte sonst bestimmen, welche Frage der
  // Desktop stellt und im Panel als eigene Eingabe anzeigt.
  const service = await read(SERVICE);
  assert.match(service, /candidates\.FirstOrDefault\(candidate => string\.Equals\(candidate, selected\.Value!\.Trim\(\), StringComparison\.Ordinal\)\)/u);
});

test("die Auswahl liegt vor dem gemeinsamen Sendepfad, nicht daneben", async () => {
  // Abnahmekriterium 3: Der Diktatpfad endet weiterhin in derselben Methode
  // wie die Texteingabe -- geprüft wird das unverändert in
  // tests/assistant-orchestrator.test.mjs. Hier steht die Reihenfolge:
  // erkennen, auswählen, dann senden.
  const page = await read(PAGE);
  assert.match(page, /transcription\.Text![\s\S]*ResolveDictatedReadingAsync\(transcription\.Readings\)[\s\S]*await SendAssistantMessageAsync\(message\)/u);
  assert.match(page, /if \(readings\.Count < 2 \|\| string\.IsNullOrWhiteSpace\(_settings\.DeviceToken\)\) return null;/u);
  // Der Nutzer erfährt, dass eine andere Lesart im Feld steht als die gesagte.
  assert.match(page, /Eine spätere Lesart des Diktats passte besser/u);
});
