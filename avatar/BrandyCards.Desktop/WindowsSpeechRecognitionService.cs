using System.Globalization;
using System.Runtime.InteropServices;
using System.Speech.Recognition;

namespace BrandyCards_Desktop;

/// <param name="Text">Die wahrscheinlichste Lesart — was die Erkennung von sich aus liefert.</param>
/// <param name="Candidates">
/// Alle Lesarten desselben Diktats, nach Konfidenz absteigend, <paramref name="Text"/>
/// an erster Stelle. Der Aufrufer darf daraus eine andere wählen; die Erkennung
/// selbst trifft diese Entscheidung nicht, weil sie den Fachbereich nicht kennt.
/// </param>
internal sealed record SpeechTranscriptionResult(string? Text, string StatusMessage, IReadOnlyList<string>? Candidates = null)
{
    public bool Succeeded => !string.IsNullOrWhiteSpace(Text);

    /// <summary>
    /// Die Lesarten als verlässliche Liste — leer, wenn nichts erkannt wurde.
    /// Ein Ausfallgrund trägt keine Kandidaten, soll die Aufrufseite aber nicht
    /// zu einer Null-Prüfung zwingen.
    /// </summary>
    public IReadOnlyList<string> Readings => Candidates ?? (Succeeded ? [Text!] : []);
}

/// <summary>
/// Runs a single local Windows Desktop Speech recognition session. No audio or
/// transcription leaves the process; the caller decides what to do with the text.
/// </summary>
internal sealed class WindowsSpeechRecognitionService
{
    private static readonly TimeSpan InitialSilenceTimeout = TimeSpan.FromSeconds(12);

    /// <summary>
    /// Wie viele Lesarten desselben Diktats höchstens weitergereicht werden.
    ///
    /// Der Wert entspricht `MAX_ASSISTANT_CANDIDATES` in lib/assistant/contracts.ts
    /// und ist dort begründet: Der Server prüft alle Lesarten in **einer**
    /// Anfrage, und mehr als fünf würde er abweisen. Er ist keine Zielgröße —
    /// die Erkennung liefert oft weniger, und das ist in Ordnung.
    /// </summary>
    internal const int MaxCandidates = 5;

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
            // Ohne diese Zeile bleibt die zweitbeste Lesart im Erkenner liegen.
            // Genau sie ist der Gewinn: Bei Fachvokabular greift die erste
            // regelmäßig daneben, während eine der folgenden trifft.
            recognizer.MaxAlternates = MaxCandidates;
            recognizer.SetInputToDefaultAudioDevice();
            var result = recognizer.Recognize(InitialSilenceTimeout);

            return string.IsNullOrWhiteSpace(result?.Text)
                ? new SpeechTranscriptionResult(null, "Es wurde kein Diktat erkannt. Bitte sprich nach dem Signal erneut.")
                : new SpeechTranscriptionResult(result.Text.Trim(), "Diktat erkannt", CollectCandidates(result));
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

    /// <summary>
    /// Die Lesarten eines Diktats, beste zuerst, ohne Wiederholungen.
    ///
    /// `Alternates` enthält die beste Lesart in aller Regel selbst mit; sie
    /// wird trotzdem ausdrücklich vorangestellt, damit Position 0 verlässlich
    /// das ist, was die Erkennung von sich aus geliefert hätte. Die
    /// Entdoppelung ist deshalb keine Kosmetik: Ohne sie stünde derselbe Text
    /// zweimal in der Liste und verbrauchte einen der fünf Plätze.
    /// </summary>
    private static IReadOnlyList<string> CollectCandidates(RecognitionResult result)
    {
        var candidates = new List<string>(MaxCandidates);
        foreach (var reading in new[] { result.Text }.Concat(result.Alternates.Select(alternate => alternate.Text)))
        {
            if (candidates.Count == MaxCandidates) break;
            var trimmed = reading?.Trim();
            if (string.IsNullOrEmpty(trimmed)) continue;
            if (candidates.Contains(trimmed, StringComparer.OrdinalIgnoreCase)) continue;
            candidates.Add(trimmed);
        }

        return candidates;
    }

    private static RecognizerInfo? SelectRecognizer()
    {
        var installedRecognizers = SpeechRecognitionEngine.InstalledRecognizers();
        return installedRecognizers.FirstOrDefault(recognizer => recognizer.Culture.Equals(CultureInfo.CurrentUICulture))
            ?? installedRecognizers.FirstOrDefault(recognizer => recognizer.Culture.TwoLetterISOLanguageName == CultureInfo.CurrentUICulture.TwoLetterISOLanguageName)
            ?? installedRecognizers.FirstOrDefault();
    }
}
