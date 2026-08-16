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
/// <param name="RecognizerCulture">
/// Die Sprache, in der tatsächlich zugehört wurde. Bis Phase 10 blieb sie
/// verborgen: `SelectRecognizer()` fällt notfalls auf einen englischen Erkenner
/// zurück, und eine deutsche Frage an eine englische Erkennung erklärt jede
/// Ungenauigkeit — nur merkt es niemand.
/// </param>
internal sealed record SpeechTranscriptionResult(string? Text, string StatusMessage, IReadOnlyList<string>? Candidates = null, string? RecognizerCulture = null)
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

    /// <summary>Name der Domänengrammatik, um ihre Treffer wiederzuerkennen.</summary>
    private const string DomainGrammarName = "BrandyCardsFragen";

    /// <summary>
    /// Ab welcher Konfidenz ein Grammatiktreffer den Lesarten des freien
    /// Diktats vorgezogen wird.
    ///
    /// Eine geschlossene Grammatik liefert auch dann eine Phrase, wenn etwas
    /// ganz anderes gesagt wurde — sie kennt ja nur diese Sätze. Die Konfidenz
    /// trennt „das war eine dieser Fragen" von „das war es nicht, hier ist die
    /// ähnlichste". Ohne die Schwelle presste die Grammatik jede fremde
    /// Äußerung in den nächstgelegenen Satz.
    ///
    /// **0,5 ist ein Startwert, kein Messergebnis.** Er lässt sich erst am
    /// Gerät beurteilen: Greift die Grammatik zu selten, muss er runter; zieht
    /// sie fremde Sätze an sich, muss er hoch.
    /// </summary>
    private const float MinimumDomainConfidence = 0.5f;

    public Task<SpeechTranscriptionResult> TranscribeOnceAsync(IReadOnlyList<string>? phrases = null) => Task.Run(() => TranscribeOnce(phrases));

    private static SpeechTranscriptionResult TranscribeOnce(IReadOnlyList<string>? phrases)
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

            var sprache = recognizerInfo.Culture.NativeName;
            using var recognizer = new SpeechRecognitionEngine(recognizerInfo);

            // **Die Domänengrammatik zuerst, das Diktat daneben.** Die
            // Grammatik verengt den Suchraum auf die Sätze, die hier
            // tatsächlich gefragt werden -- der Betriebsfall, für den SAPI
            // gebaut ist. Das freie Diktat bleibt trotzdem geladen, sonst
            // presste die Grammatik jede ungewöhnliche Formulierung in den
            // nächstgelegenen Satz, statt sie durchzulassen.
            var domainGrammar = BuildDomainGrammar(recognizerInfo, phrases);
            if (domainGrammar is not null) recognizer.LoadGrammar(domainGrammar);
            recognizer.LoadGrammar(new DictationGrammar());

            // Ohne diese Zeile bleibt die zweitbeste Lesart im Erkenner liegen.
            // Genau sie ist der Gewinn: Bei Fachvokabular greift die erste
            // regelmäßig daneben, während eine der folgenden trifft.
            recognizer.MaxAlternates = MaxCandidates;
            recognizer.SetInputToDefaultAudioDevice();
            var result = recognizer.Recognize(InitialSilenceTimeout);

            return string.IsNullOrWhiteSpace(result?.Text)
                ? new SpeechTranscriptionResult(null, $"Es wurde kein Diktat erkannt ({sprache}). Bitte sprich nach dem Signal erneut.", null, sprache)
                : new SpeechTranscriptionResult(result.Text.Trim(), $"Diktat erkannt ({sprache})", CollectCandidates(result), sprache);
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
    /// <summary>
    /// Baut die Grammatik aus den vom Shop gelieferten Fragemustern.
    ///
    /// **Die Phrasen werden nicht hier gepflegt.** Sie stammen aus
    /// `ASSISTANT_SPEECH_PHRASES` in lib/assistant/contracts.ts, wo auch die
    /// Planerregeln liegen, und ein Test hält beide aneinander fest. Eine
    /// Kopie an dieser Stelle wäre genau die Doppelpflege, die Phase 4
    /// beseitigt hat.
    ///
    /// Zwei Gründe, aus denen es hier <c>null</c> geben kann, und beide sind
    /// harmlos: Ohne erreichbare Phrasen bleibt es beim freien Diktat wie
    /// bisher. Und einem Erkenner, der kein Deutsch spricht, darf eine deutsche
    /// Grammatik nicht untergeschoben werden — `GrammarBuilder` und Erkenner
    /// müssen dieselbe Kultur haben, sonst wirft das Laden.
    /// </summary>
    private static Grammar? BuildDomainGrammar(RecognizerInfo recognizerInfo, IReadOnlyList<string>? phrases)
    {
        if (phrases is null || phrases.Count == 0) return null;

        var sprichtDeutsch = recognizerInfo.Culture.TwoLetterISOLanguageName == "de";
        if (!sprichtDeutsch) return null;

        var saetze = phrases
            .Where(phrase => !string.IsNullOrWhiteSpace(phrase))
            .Select(phrase => phrase.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (saetze.Length == 0) return null;

        var builder = new GrammarBuilder(new Choices(saetze)) { Culture = recognizerInfo.Culture };
        return new Grammar(builder) { Name = DomainGrammarName };
    }

    private static bool IstGrammatiktreffer(RecognizedPhrase phrase) =>
        phrase.Grammar?.Name == DomainGrammarName && phrase.Confidence >= MinimumDomainConfidence;

    private static IReadOnlyList<string> CollectCandidates(RecognitionResult result)
    {
        // Alle Lesarten in einer Liste: `RecognitionResult` ist selbst eine
        // `RecognizedPhrase`, und `Alternates` enthält sie in aller Regel mit.
        var lesarten = new List<RecognizedPhrase> { result };
        lesarten.AddRange(result.Alternates);

        // **Grammatiktreffer nach vorn.** Sie sind Sätze, von denen feststeht,
        // dass der Planer sie versteht -- ein Test verlangt das für jeden
        // einzelnen. Danach folgt das freie Diktat in seiner eigenen
        // Reihenfolge, angeführt von der besten Lesart.
        var geordnet = lesarten
            .Where(IstGrammatiktreffer)
            .OrderByDescending(phrase => phrase.Confidence)
            .Concat(lesarten.Where(phrase => !IstGrammatiktreffer(phrase)))
            .Select(phrase => phrase.Text);

        var candidates = new List<string>(MaxCandidates);
        foreach (var reading in geordnet)
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
