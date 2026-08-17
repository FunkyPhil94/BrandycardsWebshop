import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { issueSpeechToken, SpeechTokenUnavailableError } = await import("../lib/assistant/speech-token.ts");
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const ROUTE = "app/api/avatar/device/assistant/speech-token/route.ts";

function withEnv(werte, fn) {
  const vorher = { AZURE_SPEECH_KEY: process.env.AZURE_SPEECH_KEY, AZURE_SPEECH_REGION: process.env.AZURE_SPEECH_REGION };
  Object.assign(process.env, werte);
  for (const [name, wert] of Object.entries(werte)) if (wert === undefined) delete process.env[name];
  return (async () => fn())().finally(() => {
    for (const [name, wert] of Object.entries(vorher)) {
      if (wert === undefined) delete process.env[name];
      else process.env[name] = wert;
    }
  });
}

test("fehlende Zugangsdaten werden einzeln benannt, nicht zusammengefasst", async () => {
  // Dieselbe Lehre wie bei PAYPAL_ENVIRONMENT: Ein stiller Sammelzustand
  // verbirgt, welcher der beiden Werte fehlt -- und der Betreiber sucht
  // an der falschen Stelle.
  await withEnv({ AZURE_SPEECH_KEY: undefined, AZURE_SPEECH_REGION: "westeurope" }, async () => {
    await assert.rejects(() => issueSpeechToken(async () => new Response("x")), /AZURE_SPEECH_KEY fehlt/u);
  });
  await withEnv({ AZURE_SPEECH_KEY: "geheim", AZURE_SPEECH_REGION: undefined }, async () => {
    await assert.rejects(() => issueSpeechToken(async () => new Response("x")), /AZURE_SPEECH_REGION fehlt/u);
  });
});

test("das Token wird bei Azure geholt und der Schlüssel bleibt im Kopf der Anfrage", async () => {
  await withEnv({ AZURE_SPEECH_KEY: "geheimer-schluessel", AZURE_SPEECH_REGION: "westeurope" }, async () => {
    let gesehen = null;
    const grant = await issueSpeechToken(async (url, init) => {
      gesehen = { url, init };
      return new Response("  ein.jwt.token  ", { status: 200 });
    });

    assert.equal(gesehen.url, "https://westeurope.api.cognitive.microsoft.com/sts/v1.0/issueToken");
    assert.equal(gesehen.init.method, "POST");
    assert.equal(gesehen.init.headers["Ocp-Apim-Subscription-Key"], "geheimer-schluessel");
    assert.equal(grant.token, "ein.jwt.token", "das Token wird getrimmt weitergereicht");
    assert.equal(grant.region, "westeurope");
    // Der Client soll erneuern, bevor das Token reisst -- nicht danach.
    assert.ok(grant.expiresInSeconds > 0 && grant.expiresInSeconds < 600,
      `Vorlauf fehlt: ${grant.expiresInSeconds}s`);
  });
});

test("eine Fehlerantwort von Azure gibt ihren Körper nicht weiter", async () => {
  await withEnv({ AZURE_SPEECH_KEY: "geheimer-schluessel", AZURE_SPEECH_REGION: "westeurope" }, async () => {
    await assert.rejects(
      () => issueSpeechToken(async () => new Response("Invalid subscription key geheimer-schluessel für Konto 12345", { status: 401 })),
      (error) => {
        assert.ok(error instanceof SpeechTokenUnavailableError);
        assert.match(error.message, /HTTP 401/u);
        // Azures Diagnosetext kann Schluessel oder Kontodetails enthalten.
        assert.doesNotMatch(error.message, /geheimer-schluessel|12345/u);
        return true;
      },
    );
  });
});

test("ein leeres Token gilt als Fehlschlag, nicht als Erfolg", async () => {
  await withEnv({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "westeurope" }, async () => {
    await assert.rejects(() => issueSpeechToken(async () => new Response("   ", { status: 200 })), /leeres Sprachtoken/u);
  });
});

test("die Token-Route ist bewacht und wird nirgends zwischengespeichert", async () => {
  const route = await read(ROUTE);
  assert.match(route, /enforcePublicRateLimit\(request, "avatar-assistant"\)/u);
  assert.match(route, /authenticateAvatarDevice\(request, "ASSISTANT_READ"\)/u);
  assert.match(route, /enforcePublicRateLimit[\s\S]*authenticateAvatarDevice/u, "die Begrenzung greift vor dem Token-Lookup");
  assert.match(route, /"cache-control": "no-store"/u);
  // Nur POST: Ein GET waere fuer Proxies und Verlauf eine abrufbare Adresse,
  // an deren Ende ein gueltiges Fremdanbieter-Token steht.
  assert.doesNotMatch(route, /export async function GET/u);
});

test("der Abonnementschlüssel verlässt den Server nicht", async () => {
  const [route, modul] = await Promise.all([read(ROUTE), read("lib/assistant/speech-token.ts")]);
  // Die Route reicht nur durch, was `issueSpeechToken` zurueckgibt -- und das
  // ist Token, Region und Laufzeit. Ein direkter Zugriff auf den Schluessel in
  // der Route waere der Weg, auf dem er in eine Antwort geriete.
  assert.doesNotMatch(route, /AZURE_SPEECH_KEY/u);
  assert.match(modul, /process\.env\.AZURE_SPEECH_KEY/u);
  assert.doesNotMatch(modul, /console\.(log|error|warn)\([^)]*key/iu, "der Schluessel gehoert in kein Protokoll");
});

test("der Desktop kennt weder Schlüssel noch Anbieterkonto", async () => {
  const [azure, service] = await Promise.all([
    read("avatar/BrandyCards.Desktop/AzureSpeechRecognitionService.cs"),
    read("avatar/BrandyCards.Desktop/AssistantConversationService.cs"),
  ]);
  for (const [name, quelle] of [["AzureSpeechRecognitionService.cs", azure], ["AssistantConversationService.cs", service]]) {
    // `FromSubscription` und der Schluesselkopf sind die beiden Wege, auf denen
    // ein Abonnementschluessel ueberhaupt in einen Client geraten koennte.
    assert.doesNotMatch(quelle, /FromSubscription|Ocp-Apim-Subscription-Key/u,
      `${name} darf den Abonnementschluessel nicht verwenden`);
    // Und er darf auch nicht aus der Umgebung oder den Einstellungen gelesen
    // werden -- der Desktop hat keine Quelle dafuer und soll keine bekommen.
    assert.doesNotMatch(quelle, /Environment\.GetEnvironmentVariable|_settings\.\w*(Key|Secret)/u,
      `${name} darf sich keinen Schluessel beschaffen`);
  }
  // Der Name des Secrets darf vorkommen -- er steht in einem Hinweis, der dem
  // Betreiber sagt, wo er suchen muss. Der Wert kommt hier nie an.
  assert.match(azure, /SpeechConfig\.FromAuthorizationToken\(grant\.Token, grant\.Region\)/u);
  assert.equal((azure.match(/SpeechConfig\.From\w+/gu) ?? []).length, 1,
    "es darf genau einen Weg geben, die Erkennung zu konfigurieren");
});

test("die Online-Erkennung hört auf Deutsch und nutzt die Phrasen aus Variante 2", async () => {
  const azure = await read("avatar/BrandyCards.Desktop/AzureSpeechRecognitionService.cs");
  assert.match(azure, /RecognitionLanguage = "de-DE"/u);
  assert.match(azure, /PhraseListGrammar\.FromRecognizer\(recognizer\)/u);
  // Ohne das ausfuehrliche Format gibt Azure nur eine Lesart zurueck, und die
  // Vorauswahl aus Variante 1 haette nichts mehr zu waehlen.
  assert.match(azure, /OutputFormat = OutputFormat\.Detailed/u);
  assert.match(azure, /result\.Best\(\)\.Select\(alternative => alternative\.Text\)/u);
  // Dieselbe Obergrenze wie lokal -- eine zweite Zahl waere eine zweite Wahrheit.
  assert.match(azure, /WindowsSpeechRecognitionService\.MaxCandidates/u);
});

test("ein abgelehntes Token wird als Betreiberproblem benannt, nicht als Mikrofonfehler", async () => {
  // Sonst sucht jemand stundenlang am Headset, waehrend ein Secret falsch ist.
  const azure = await read("avatar/BrandyCards.Desktop/AzureSpeechRecognitionService.cs");
  assert.match(azure, /CancellationErrorCode\.AuthenticationFailure/u);
  assert.match(azure, /AZURE_SPEECH_KEY oder AZURE_SPEECH_REGION im Shop falsch gesetzt/u);
  assert.match(azure, /CancellationErrorCode\.TooManyRequests or CancellationErrorCode\.Forbidden/u,
    "das aufgebrauchte Freikontingent braucht eine eigene Erklaerung");
});

test("ohne Token bleibt der Knopf benutzbar, und die Wahl fällt vor dem Zuhören", async () => {
  const page = await read("avatar/BrandyCards.Desktop/MainPage.xaml.cs");
  // Ein Rueckfall nach gescheiterter Online-Erkennung naehme nichts zurueck:
  // Das Gesagte ist dann verklungen und muesste ohnehin wiederholt werden.
  assert.match(page, /var outcome = await EnsureSpeechTokenAsync\(\);[\s\S]*var transcription = grant is null[\s\S]*_speechRecognitionService\.TranscribeOnceAsync\(phrases\)[\s\S]*_onlineSpeechRecognitionService\.TranscribeOnceAsync\(grant\.Value, phrases\)/u);
  // Der Nutzer muss erkennen koennen, dass gerade die schwaechere Erkennung laeuft.
  assert.match(page, /lokale Erkennung, eingeschränkte Genauigkeit/u);
  // **Und woran es lag.** Ohne den Grund war aufgebrauchtes Guthaben (401/403)
  // nicht von der Tarifgrenze (429) zu unterscheiden -- zwei voellig
  // verschiedene Reparaturen, und der Betreiber sah fuer beide denselben Satz.
  assert.match(page, /LokaleErkennungStatus\(outcome\.Reason\)/u);
  // Ein Token je Diktat waere gegen die geteilte Ratenbegrenzung verschwenderisch.
  assert.match(page, /if \(_speechToken is not null && DateTimeOffset\.UtcNow < _speechTokenValidUntil\) return SpeechTokenOutcome\.Granted\(_speechToken\.Value\);/u);
  assert.match(page, /Math\.Max\(30, grant\.Value\.ExpiresInSeconds\)/u,
    "eine unsinnige Serverangabe darf kein ewig gueltiges Token vortaeuschen");
});

test("Schlüssel und Region sind dokumentiert, samt der Falle nach 30 Tagen", async () => {
  const beispiel = await read(".env.example");
  assert.match(beispiel, /^AZURE_SPEECH_KEY=$/mu);
  assert.match(beispiel, /^AZURE_SPEECH_REGION=$/mu);
  assert.doesNotMatch(beispiel, /NEXT_PUBLIC_AZURE/u, "der Schluessel darf nie ins Client-Bundle");
  // Ohne diesen Hinweis bricht die Spracherkennung nach Ablauf der Testversion
  // still ab, und niemand weiss warum.
  assert.match(beispiel, /Nutzungsbasierte Bezahlung/u);
});

test("ein gescheitertes Sprachtoken nennt den Grund statt nur zu scheitern", async () => {
  // **Der Befund vom 2026-08-17.** Die Spracheingabe war "ploetzlich total
  // schlecht": Die App lief auf der lokalen Erkennung, weil kein Azure-Token
  // kam. Der Server meldete den Grund samt HTTP-Status -- der Client warf ihn
  // in fuenf verschiedenen `return null` weg, und es wurde geraten statt
  // abgelesen.
  const service = await read("avatar/BrandyCards.Desktop/AssistantConversationService.cs");
  const azure = await read("avatar/BrandyCards.Desktop/AzureSpeechRecognitionService.cs");

  // Kein blosses `null` mehr: Das Ergebnis traegt entweder ein Token oder einen Grund.
  assert.match(azure, /internal readonly record struct SpeechTokenOutcome\(SpeechTokenGrant\? Grant, string Reason\)/u);
  assert.match(service, /public async Task<SpeechTokenOutcome> GetSpeechTokenAsync/u);
  assert.doesNotMatch(service.slice(service.indexOf("GetSpeechTokenAsync"), service.indexOf("private static int? ReadIntField")),
    /return null;/u, "kein ununterscheidbarer Fehlschlag mehr");

  // Der Text des Servers wird durchgereicht -- er nennt den Azure-Statuscode.
  assert.match(service, /ReadStringField\(body\.Text, "error"\)/u);
  // Fehlt er, bleibt wenigstens der HTTP-Status des Shops.
  assert.match(service, /Shop antwortet mit HTTP \{\(int\)response\.StatusCode\}/u);
  // Der Ausnahmetext geht **nicht** mit: Er kann Adressen und interne Pfade tragen.
  assert.doesNotMatch(service, /Failed\(exception\.Message\)/u);
});

test("der Grund wird gekürzt, die Statuszeile bleibt eine Zeile", async () => {
  const page = await read("avatar/BrandyCards.Desktop/MainPage.xaml.cs");
  const service = await read("avatar/BrandyCards.Desktop/AssistantConversationService.cs");
  assert.match(service, /internal const int MaxSpeechTokenReasonLength = 120;/u);
  assert.match(page, /kurz\.Length > AssistantConversationService\.MaxSpeechTokenReasonLength/u);
  // Ohne Grund faellt die Meldung auf ihren alten Wortlaut zurueck, statt eine
  // leere Klammer anzuhaengen.
  assert.match(page, /if \(string\.IsNullOrWhiteSpace\(grund\)\) return \$"\{basis\}\)";/u);
});
