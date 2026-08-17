using Microsoft.CognitiveServices.Speech;
using Microsoft.CognitiveServices.Speech.Audio;

namespace BrandyCards_Desktop;

/// <summary>Was der Shop zum Sprechen freigibt: ein kurzlebiges Token und die Region.</summary>
internal readonly record struct SpeechTokenGrant(string Token, string Region, int ExpiresInSeconds);

/// <summary>
/// Das Ergebnis der Tokenanfrage: entweder ein Token — oder ein Grund.
///
/// **Warum nicht einfach `null`.** Genau das war es bis zum 2026-08-17, und es
/// hat einen halben Abend Fehlersuche gekostet: Fünf verschiedene Fehlschläge
/// sahen im Panel identisch aus („lokale Erkennung"), während der Server den
/// Grund samt Azure-Statuscode längst mitlieferte. Ein Zustand, der nur sagt
/// *dass* etwas schiefging, verschiebt die Arbeit auf den Menschen davor.
/// </summary>
internal readonly record struct SpeechTokenOutcome(SpeechTokenGrant? Grant, string Reason)
{
    public static SpeechTokenOutcome Granted(SpeechTokenGrant grant) => new(grant, string.Empty);

    public static SpeechTokenOutcome Failed(string reason) => new(null, reason);
}

/// <summary>
/// Erkennt eine einzelne Äußerung über Azure Speech.
///
/// **Warum dieser Dienst und nicht die lokale Windows-Erkennung.** Die
/// SAPI-Engine (`Microsoft Speech Recognizer 8.0`) stammt aus Windows-7-Zeiten
/// und kennt kein neuronales Modell. Zwei Ausbaustufen davor — beste Alternative
/// statt erster, dann eine Domänengrammatik — haben daran nichts Spürbares
/// geändert; sie optimierten die Ansteuerung einer Engine, die selbst die
/// Grenze war. Der Betreiber hat am 2026-08-17 die Windows-Diktierfunktion
/// (Win+H) an derselben Stelle geprüft und sie lief gut. Win+H wird von Azure
/// Speech betrieben — dieser Dienst ist damit an derselben Stimme, demselben
/// Mikrofon und demselben Vokabular belegt.
///
/// **Der Abonnementschlüssel ist hier nicht bekannt.** Der Worker stellt ein
/// Token aus, das von allein verfällt; diese Klasse kennt weder Schlüssel noch
/// Abrechnung. Dasselbe Prinzip wie beim Modell-Planer aus Phase 4.
///
/// Die lokale Erkennung bleibt als Rückfall bestehen: ohne Netz oder Token ist
/// eine schlechte Erkennung immer noch besser als ein toter Knopf.
/// </summary>
internal sealed class AzureSpeechRecognitionService
{
    private const string RecognitionLanguage = "de-DE";

    /// <summary>
    /// Wie lange auf den Sprechbeginn gewartet wird. Bewusst derselbe Wert wie
    /// bei der lokalen Erkennung, damit sich der Knopf gleich anfühlt,
    /// unabhängig davon, welcher Weg gerade greift.
    /// </summary>
    private const string InitialSilenceTimeoutMs = "12000";

    public async Task<SpeechTranscriptionResult> TranscribeOnceAsync(SpeechTokenGrant grant, IReadOnlyList<string>? phrases)
    {
        try
        {
            var config = SpeechConfig.FromAuthorizationToken(grant.Token, grant.Region);
            config.SpeechRecognitionLanguage = RecognitionLanguage;
            // Ohne das ausführliche Format gibt Azure nur eine Lesart zurück --
            // und damit fiele die Vorauswahl aus Variante 1 in sich zusammen.
            config.OutputFormat = OutputFormat.Detailed;
            config.SetProperty(PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, InitialSilenceTimeoutMs);

            using var audioConfig = AudioConfig.FromDefaultMicrophoneInput();
            using var recognizer = new SpeechRecognizer(config, audioConfig);
            ApplyPhraseList(recognizer, phrases);

            var result = await recognizer.RecognizeOnceAsync();
            return Interpret(result, grant.Region);
        }
        catch (ApplicationException exception)
        {
            // Das SDK meldet ein fehlendes oder belegtes Mikrofon so.
            return new SpeechTranscriptionResult(
                null,
                $"Das Mikrofon konnte für die Online-Erkennung nicht geöffnet werden: {exception.Message}",
                null,
                grant.Region);
        }
    }

    /// <summary>
    /// Spannt die Erkennung auf die tatsächlichen Fragemuster vor.
    ///
    /// **Das ist Variante 2, unverändert weitergenutzt.** Die Phrasen stammen
    /// aus `ASSISTANT_SPEECH_PHRASES` und werden vom Shop ausgeliefert; ein Test
    /// hält sie am Planer fest. Anders als bei SAPI ist die Liste hier keine
    /// geschlossene Grammatik, sondern eine Gewichtung — alles andere bleibt
    /// weiterhin erkennbar. Genau deshalb entfällt hier die Konfidenzschwelle,
    /// die es lokal brauchte.
    /// </summary>
    private static void ApplyPhraseList(SpeechRecognizer recognizer, IReadOnlyList<string>? phrases)
    {
        if (phrases is null || phrases.Count == 0) return;

        var phraseList = PhraseListGrammar.FromRecognizer(recognizer);
        foreach (var phrase in phrases)
        {
            if (!string.IsNullOrWhiteSpace(phrase)) phraseList.AddPhrase(phrase.Trim());
        }
    }

    private static SpeechTranscriptionResult Interpret(SpeechRecognitionResult result, string region)
    {
        switch (result.Reason)
        {
            case ResultReason.RecognizedSpeech when !string.IsNullOrWhiteSpace(result.Text):
                return new SpeechTranscriptionResult(result.Text.Trim(), "Diktat erkannt (Azure, Deutsch)", CollectCandidates(result), region);

            case ResultReason.NoMatch:
                return new SpeechTranscriptionResult(null, "Es wurde kein Diktat erkannt. Bitte sprich nach dem Signal erneut.", null, region);

            case ResultReason.Canceled:
                return new SpeechTranscriptionResult(null, DescribeCancellation(result), null, region);

            default:
                return new SpeechTranscriptionResult(null, "Die Online-Spracherkennung hat kein Ergebnis geliefert.", null, region);
        }
    }

    /// <summary>
    /// Übersetzt einen Abbruch in einen Satz, mit dem der Nutzer etwas anfangen
    /// kann. Ein abgelaufenes oder falsches Token ist ein Betreiberproblem und
    /// muss als solches erkennbar sein — sonst sucht jemand am Mikrofon.
    /// </summary>
    private static string DescribeCancellation(SpeechRecognitionResult result)
    {
        var details = CancellationDetails.FromResult(result);
        return details.ErrorCode switch
        {
            CancellationErrorCode.AuthenticationFailure =>
                "Die Anmeldung an der Spracherkennung wurde abgelehnt. Vermutlich ist AZURE_SPEECH_KEY oder AZURE_SPEECH_REGION im Shop falsch gesetzt.",
            CancellationErrorCode.ConnectionFailure or CancellationErrorCode.ServiceTimeout =>
                "Die Spracherkennung war nicht erreichbar. Prüfe die Internetverbindung; es wurde nichts erkannt.",
            CancellationErrorCode.TooManyRequests or CancellationErrorCode.Forbidden =>
                "Die Spracherkennung hat abgelehnt — möglicherweise ist das kostenlose Kontingent für diesen Monat aufgebraucht.",
            _ => "Die Spracherkennung wurde abgebrochen; es wurde nichts erkannt. Bitte erneut versuchen.",
        };
    }

    /// <summary>
    /// Die Lesarten, beste zuerst — dieselbe Form, die die Vorauswahl aus
    /// Variante 1 erwartet. Azure liefert sie im ausführlichen Format als
    /// N-Best-Liste; der Planer entscheidet danach wie bisher.
    /// </summary>
    private static IReadOnlyList<string> CollectCandidates(SpeechRecognitionResult result)
    {
        var candidates = new List<string>(WindowsSpeechRecognitionService.MaxCandidates);
        var lesarten = new[] { result.Text }.Concat(result.Best().Select(alternative => alternative.Text));

        foreach (var reading in lesarten)
        {
            if (candidates.Count == WindowsSpeechRecognitionService.MaxCandidates) break;
            var trimmed = reading?.Trim();
            if (string.IsNullOrEmpty(trimmed)) continue;
            if (candidates.Contains(trimmed, StringComparer.OrdinalIgnoreCase)) continue;
            candidates.Add(trimmed);
        }

        return candidates;
    }
}
