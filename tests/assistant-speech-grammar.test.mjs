import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { ASSISTANT_SPEECH_PHRASES } = await import("../lib/assistant/contracts.ts");
const { RuleBasedAssistantPlanner } = await import("../lib/assistant/planner.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const SPEECH = "avatar/BrandyCards.Desktop/WindowsSpeechRecognitionService.cs";
const SERVICE = "avatar/BrandyCards.Desktop/AssistantConversationService.cs";

test("jede Phrase der Sprachgrammatik wird vom Planer verstanden", async () => {
  // **Der Test, der die Grammatik ersetzt, die es nicht zweimal geben darf.**
  // Eine Phrase, die der Erkenner perfekt trifft und der Planer nicht kennt,
  // wäre der ärgerlichste denkbare Fehler: Der Nutzer spricht die vorgesehene
  // Frage sauber aus und bekommt "kein passendes Werkzeug" zurück.
  const planner = new RuleBasedAssistantPlanner();
  for (const phrase of ASSISTANT_SPEECH_PHRASES) {
    const plan = await planner.plan(phrase);
    assert.ok(plan.tools.length > 0, `der Planer versteht die Grammatikphrase nicht: „${phrase}"`);
    assert.equal(plan.reason, "READY", phrase);
  }
});

test("die Grammatik deckt die Werkzeuge breit ab und wiederholt sich nicht", async () => {
  const planner = new RuleBasedAssistantPlanner();
  const abgedeckt = new Set();
  for (const phrase of ASSISTANT_SPEECH_PHRASES) {
    for (const tool of (await planner.plan(phrase)).tools) abgedeckt.add(tool.tool);
  }
  // Eine Grammatik, die nur zwei Werkzeuge erreicht, verengt den Suchraum auf
  // den falschen Ausschnitt: Alles andere fiele zurück ins freie Diktat.
  assert.ok(abgedeckt.size >= 10, `nur ${abgedeckt.size} Werkzeuge über die Grammatik erreichbar`);
  assert.equal(new Set(ASSISTANT_SPEECH_PHRASES).size, ASSISTANT_SPEECH_PHRASES.length,
    "doppelte Phrasen vergrößern die Grammatik ohne Nutzen");
  for (const phrase of ASSISTANT_SPEECH_PHRASES) {
    assert.ok(phrase.trim() === phrase && phrase.length > 0, `„${phrase}" ist nicht sauber getrimmt`);
  }
});

test("die Phrasen werden ausgeliefert, nicht im Desktop nachgebaut", async () => {
  const [route, speech] = await Promise.all([
    read("app/api/avatar/device/assistant/route.ts"),
    read(SPEECH),
  ]);
  assert.match(route, /speechPhrases: ASSISTANT_SPEECH_PHRASES/u);
  // Der Desktop darf die Fragemuster nirgends fest verdrahten -- sonst driften
  // Grammatik und Planerregeln auseinander, sobald einer der beiden wächst.
  for (const phrase of ASSISTANT_SPEECH_PHRASES) {
    assert.doesNotMatch(speech, new RegExp(phrase.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
      `„${phrase}" steht fest im Desktop und wäre eine zweite Regelkopie`);
  }
});

test("ohne erreichbare Phrasen erkennt der Desktop weiter wie bisher", async () => {
  const [speech, service] = await Promise.all([read(SPEECH), read(SERVICE)]);
  // Die Grammatik ist eine Verbesserung, keine Voraussetzung. Ein alter Server
  // oder ein Netzfehler darf die Spracheingabe nicht abschalten.
  assert.match(speech, /if \(phrases is null \|\| phrases\.Count == 0\) return null;/u);
  assert.match(service, /catch \(Exception exception\) when \(exception is HttpRequestException or IOException or OperationCanceledException or JsonException\)\s*\{\s*return null;/u);
  assert.match(speech, /LoadGrammar\(new DictationGrammar\(\)\)/u,
    "das freie Diktat bleibt geladen, sonst presst die Grammatik jede fremde Formulierung in die naechste Phrase");
});

test("eine deutsche Grammatik wird keinem englischen Erkenner untergeschoben", async () => {
  const speech = await read(SPEECH);
  // GrammarBuilder und Erkenner muessen dieselbe Kultur haben; sonst wirft
  // System.Speech beim Laden. Auf einem Geraet ohne deutsche Sprachfunktion
  // bleibt es deshalb beim Diktat.
  assert.match(speech, /TwoLetterISOLanguageName == "de"/u);
  assert.match(speech, /Culture = recognizerInfo\.Culture/u);
});

test("die verwendete Erkennersprache wird nicht mehr verschwiegen", async () => {
  // Nebenbefund aus Phase 10: SelectRecognizer faellt notfalls auf einen
  // englischen Erkenner zurueck -- stillschweigend. Eine deutsche Frage an eine
  // englische Erkennung erklaert jede Ungenauigkeit.
  const speech = await read(SPEECH);
  assert.match(speech, /RecognizerCulture/u);
  assert.match(speech, /Diktat erkannt \(\{/u, "die Statusmeldung nennt die Sprache");
});
