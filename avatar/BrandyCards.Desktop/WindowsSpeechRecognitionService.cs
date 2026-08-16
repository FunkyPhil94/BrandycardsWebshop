using System.Globalization;
using System.Runtime.InteropServices;
using System.Speech.Recognition;

namespace BrandyCards_Desktop;

internal sealed record SpeechTranscriptionResult(string? Text, string StatusMessage)
{
    public bool Succeeded => !string.IsNullOrWhiteSpace(Text);
}

/// <summary>
/// Runs a single local Windows Desktop Speech recognition session. No audio or
/// transcription leaves the process; the caller decides what to do with the text.
/// </summary>
internal sealed class WindowsSpeechRecognitionService
{
    private static readonly TimeSpan InitialSilenceTimeout = TimeSpan.FromSeconds(12);

    public Task<SpeechTranscriptionResult> TranscribeOnceAsync() => Task.Run(TranscribeOnce);

    private static SpeechTranscriptionResult TranscribeOnce()
    {
        try
        {
            var recognizerInfo = SelectRecognizer();
            if (recognizerInfo is null)
            {
                return new SpeechTranscriptionResult(
                    null,
                    "Die lokale Windows-Spracherkennung ist nicht installiert. Installiere in Windows eine Sprachfunktion mit Spracherkennung und versuche es erneut.");
            }

            using var recognizer = new SpeechRecognitionEngine(recognizerInfo);
            recognizer.LoadGrammar(new DictationGrammar());
            recognizer.SetInputToDefaultAudioDevice();
            var result = recognizer.Recognize(InitialSilenceTimeout);

            return string.IsNullOrWhiteSpace(result?.Text)
                ? new SpeechTranscriptionResult(null, "Es wurde kein Diktat erkannt. Bitte sprich nach dem Signal erneut.")
                : new SpeechTranscriptionResult(result.Text.Trim(), "Diktat erkannt");
        }
        catch (UnauthorizedAccessException)
        {
            return new SpeechTranscriptionResult(
                null,
                "Der Mikrofonzugriff wurde von Windows verweigert. Erlaube Desktop-Apps den Mikrofonzugriff unter Einstellungen → Datenschutz & Sicherheit → Mikrofon.");
        }
        catch (PlatformNotSupportedException)
        {
            return new SpeechTranscriptionResult(null, "Die lokale Windows-Spracherkennung wird auf diesem Gerät nicht unterstützt.");
        }
        catch (COMException)
        {
            return new SpeechTranscriptionResult(
                null,
                "Windows konnte Mikrofon oder Spracherkennung nicht starten. Prüfe Mikrofonzugriff, die ausgewählte Eingabe und die installierte Sprachfunktion.");
        }
        catch (InvalidOperationException)
        {
            return new SpeechTranscriptionResult(
                null,
                "Windows konnte das Mikrofon nicht verwenden. Prüfe, ob ein Mikrofon angeschlossen und der Zugriff für Desktop-Apps erlaubt ist.");
        }
        catch (ArgumentException)
        {
            return new SpeechTranscriptionResult(
                null,
                "Für die aktuelle Windows-Sprache ist keine lokale Spracherkennung installiert. Installiere die Sprachfunktion mit Spracherkennung und versuche es erneut.");
        }
    }

    private static RecognizerInfo? SelectRecognizer()
    {
        var installedRecognizers = SpeechRecognitionEngine.InstalledRecognizers();
        return installedRecognizers.FirstOrDefault(recognizer => recognizer.Culture.Equals(CultureInfo.CurrentUICulture))
            ?? installedRecognizers.FirstOrDefault(recognizer => recognizer.Culture.TwoLetterISOLanguageName == CultureInfo.CurrentUICulture.TwoLetterISOLanguageName)
            ?? installedRecognizers.FirstOrDefault();
    }
}
