using System.Text;
using System.Text.Json;

namespace BrandyCards_Desktop;

internal sealed class AssistantConversationService(HttpClient httpClient)
{
    /// <summary>
    /// Wie lange der Desktop höchstens auf eine Assistant-Antwort wartet.
    ///
    /// Der serverseitige Modell-Planer darf allein 15 s laufen
    /// (`MODEL_TIMEOUT_MS` in lib/assistant/planner.ts). Danach folgen noch die
    /// registrierten Read-only-Abfragen auf D1 und der Rückweg durchs Netz. Der
    /// vorherige Wert von 12 s lag *unter* dem Modellzeitrahmen: Sobald der
    /// Modell-Planer serverseitig scharf geschaltet wird, hätte der Desktop
    /// abgebrochen, während der Server noch an derselben Frage arbeitet — der
    /// Nutzer sähe einen Fehler für eine Anfrage, die gleich beantwortet
    /// worden wäre. (Der Zugang dazu ist und bleibt allein Sache des Servers;
    /// diese Datei kennt weder Anbieter noch Schlüssel.)
    ///
    /// 30 s lassen dem Serverpfad den doppelten Modellzeitrahmen und bleiben
    /// trotzdem eine harte Obergrenze: Eine hängende Anfrage endet, sie wartet
    /// nicht endlos. Der Ereignisabruf behält seinen eigenen, kurzen Zeitrahmen
    /// (`MainPage.ShopRequestTimeout`), weil er sich alle drei Sekunden
    /// wiederholt. `tests/assistant-phase5b.test.mjs` hält beide Werte
    /// gegeneinander fest.
    /// </summary>
    public static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Obergrenze für den gelesenen Antwortkörper.
    ///
    /// Gemessen in Phase 6: Der vorherige Weg über `ReadFromJsonAsync` las den
    /// Körper vollständig in den Speicher, ohne jede Grenze — ein Testserver
    /// mit zwei Millionen Zeichen kam ungebremst durch. Zwischen Desktop und
    /// Shop steht im Ernstfall ein fremder Zwischenknoten (Proxy, Portalseite,
    /// Fehlerseite des Betreibers); dessen Antwortlänge bestimmt sonst der
    /// Absender. 64 KiB liegen weit über der längsten Antwort, die der
    /// Orchestrator erzeugen kann (sechs Werkzeuge à höchstens zwanzig
    /// Einträgen), und weit unter allem, was dem Fenster gefährlich wird.
    /// </summary>
    internal const int MaxResponseBytes = 64 * 1024;

    /// <summary>
    /// Obergrenze für den angezeigten Antworttext. Deutlich über der längsten
    /// echten Antwort, damit keine gültige Auskunft beschnitten wird.
    /// </summary>
    internal const int MaxAnswerCharacters = 20_000;

    /// <summary>
    /// Obergrenze für eine vom Server gelieferte Fehlermeldung. Die Meldungen
    /// der eigenen Route sind alle unter 100 Zeichen lang; alles darüber kommt
    /// nicht von ihr und gehört nicht ungekürzt in die Unterhaltung.
    /// </summary>
    internal const int MaxErrorCharacters = 500;

    /// <summary>
    /// Was im Panel steht — und ob es eine Auskunft ist oder eine Absage.
    ///
    /// Vorher gab diese Klasse in beiden Fällen nur einen Text zurück. Die
    /// Kurzstatuszeile meldete deshalb auch bei HTTP 503 „Antwort empfangen".
    /// </summary>
    internal readonly record struct AssistantAnswer(bool Succeeded, string Text);

    /// <summary>
    /// Zeitrahmen der Lesartenprüfung — deutlich kürzer als der einer Frage.
    ///
    /// Die Prüfung entscheidet serverseitig allein nach Regeln, ohne Datenbank
    /// und ohne Modell; sie ist in Millisekunden fertig oder gar nicht. Sie
    /// steht außerdem **vor** der eigentlichen Frage: Was sie an Zeit
    /// verbraucht, wartet der Nutzer zusätzlich. Bleibt sie aus, geht die erste
    /// Lesart hinaus wie bisher — deshalb darf hier früh aufgegeben werden.
    /// </summary>
    public static readonly TimeSpan ProbeTimeout = TimeSpan.FromSeconds(8);

    /// <summary>
    /// Wählt aus den Lesarten eines Diktats die erste, die der Shop einem
    /// Werkzeug zuordnen kann. Gibt <c>null</c> zurück, wenn keine passt oder
    /// die Prüfung nicht durchkam.
    ///
    /// **Ein Fehlschlag ist hier kein Fehler**, sondern ein Verzicht auf eine
    /// Verbesserung: Der Aufrufer bleibt dann beim ersten Kandidaten und
    /// bekommt das bisherige Verhalten. Eine gescheiterte Vorauswahl darf die
    /// Frage nicht verhindern — deshalb fängt diese Methode alles ab, statt zu
    /// werfen.
    /// </summary>
    public async Task<string?> SelectCandidateAsync(string shopUrl, string deviceToken, IReadOnlyList<string> candidates, CancellationToken cancellationToken = default)
    {
        if (candidates.Count < 2) return null;

        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(ProbeTimeout);

            using var request = new HttpRequestMessage(HttpMethod.Post, $"{shopUrl}/api/avatar/device/assistant/probe")
            {
                Content = new StringContent(JsonSerializer.Serialize(new { candidates }), Encoding.UTF8, "application/json"),
            };
            request.Headers.Authorization = new("Bearer", deviceToken);

            using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
            if (!response.IsSuccessStatusCode) return null;

            var body = await ReadBoundedBodyAsync(response, timeout.Token);
            if (body.Outcome != BodyOutcome.Complete) return null;

            var selected = ReadStringField(body.Text, "selected");
            if (selected.Kind != FieldKind.Found || string.IsNullOrWhiteSpace(selected.Value)) return null;

            // **Nur eine der gesendeten Lesarten wird übernommen.** Die Antwort
            // bestimmt sonst, was der Desktop als Frage stellt und im Panel als
            // eigene Eingabe anzeigt; zwischen Desktop und Shop steht im
            // Ernstfall ein fremder Zwischenknoten. Die Prüfung darf auswählen,
            // nicht diktieren.
            return candidates.FirstOrDefault(candidate => string.Equals(candidate, selected.Value!.Trim(), StringComparison.Ordinal));
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException or OperationCanceledException or JsonException)
        {
            return null;
        }
    }

    public async Task<AssistantAnswer> AskAsync(string shopUrl, string deviceToken, string message, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{shopUrl}/api/avatar/device/assistant")
        {
            // StringContent kennt die Byte-Länge vor dem Senden. Damit passiert
            // die Anfrage auch den serverseitigen Body-Guard ohne chunked Body.
            Content = new StringContent(JsonSerializer.Serialize(new { message }), Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new("Bearer", deviceToken);

        // `ResponseHeadersRead` ist hier keine Feinheit, sondern die Bedingung
        // dafür, dass die Obergrenze unten überhaupt greift: In der
        // Voreinstellung liest `SendAsync` den gesamten Körper in den Speicher,
        // bevor es zurückkehrt. Der Testserver mit zwei Millionen Zeichen war
        // damit längst gepuffert, als die Grenze zuschlug.
        using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            return new AssistantAnswer(false, "Diese Kopplung darf den Assistant nicht verwenden oder ist abgelaufen. Bitte ändere die Verbindung und kopple das Gerät erneut.");
        }

        var body = await ReadBoundedBodyAsync(response, cancellationToken);
        if (body.Outcome == BodyOutcome.Aborted)
        {
            return new AssistantAnswer(false, "Die Verbindung zum Shop ist abgebrochen, bevor die Antwort vollständig war. Die Frage wurde nicht beantwortet; bitte erneut stellen.");
        }
        if (body.Outcome == BodyOutcome.TooLarge)
        {
            return new AssistantAnswer(false, $"Der Shop hat mehr als {MaxResponseBytes / 1024} KiB geschickt. Das ist keine Antwort dieses Assistants; die Frage wurde nicht beantwortet.");
        }

        var field = ReadStringField(body.Text, response.IsSuccessStatusCode ? "answer" : "error");

        if (!response.IsSuccessStatusCode)
        {
            // Eine Fehlerseite eines Zwischenknotens ist HTML, kein JSON. Dann
            // bleibt nur der Statuscode — die Rohseite gehört nicht ins Panel.
            return new AssistantAnswer(false, field.Kind == FieldKind.Found
                ? $"{Shorten(field.Value!, MaxErrorCharacters)} (HTTP {(int)response.StatusCode})"
                : $"Der Assistant ist gerade nicht erreichbar (HTTP {(int)response.StatusCode}).");
        }

        return field.Kind switch
        {
            // Gemessen in Phase 6: Vorher warf `ReadFromJsonAsync` hier eine
            // JsonException, deren englischer Text bis in die Unterhaltung
            // durchschlug — inklusive des internen Typnamens
            // („…could not be converted to …+AssistantReply"). Ein 200 mit
            // HTML-Körper ist genau der Fall, den ein Portal oder ein
            // fehlkonfigurierter Proxy erzeugt.
            FieldKind.NotJson => new AssistantAnswer(false, "Der Shop hat auf diese Frage keine lesbare Antwort geschickt (kein gültiges JSON). Die Frage wurde nicht beantwortet; bitte erneut stellen."),
            FieldKind.Found when !string.IsNullOrWhiteSpace(field.Value) => new AssistantAnswer(true, Shorten(field.Value!.Trim(), MaxAnswerCharacters)),
            _ => new AssistantAnswer(false, "Der Assistant hat keine lesbare Textantwort geliefert."),
        };
    }

    private enum BodyOutcome { Complete, TooLarge, Aborted }

    private readonly record struct BoundedBody(BodyOutcome Outcome, string Text);

    /// <summary>
    /// Liest den Antwortkörper mit fester Obergrenze.
    ///
    /// Ein Byte mehr als erlaubt wird angefordert: Nur so ist „genau voll" von
    /// „zu groß" unterscheidbar. Ein Abbruch mitten in der Antwort endet hier
    /// als eigener Fall, damit im Panel ein deutscher Satz steht statt der
    /// englischen Framework-Meldung.
    /// </summary>
    private static async Task<BoundedBody> ReadBoundedBodyAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        // Eine angekündigte Übergröße lässt sich ablehnen, ohne sie zu lesen.
        // Verlassen darf man sich darauf nicht — bei chunked fehlt die Angabe,
        // und gelogen sein kann sie ohnehin. Die Grenze unten bleibt deshalb.
        if (response.Content.Headers.ContentLength > MaxResponseBytes)
        {
            return new BoundedBody(BodyOutcome.TooLarge, string.Empty);
        }

        try
        {
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var buffer = new byte[MaxResponseBytes + 1];
            var total = 0;
            while (total < buffer.Length)
            {
                var read = await stream.ReadAsync(buffer.AsMemory(total, buffer.Length - total), cancellationToken);
                if (read == 0) break;
                total += read;
            }

            return total > MaxResponseBytes
                ? new BoundedBody(BodyOutcome.TooLarge, string.Empty)
                : new BoundedBody(BodyOutcome.Complete, Encoding.UTF8.GetString(buffer, 0, total));
        }
        catch (Exception exception) when (exception is IOException or HttpRequestException)
        {
            // Der Zeitrahmen bleibt davon unberührt: Ein Abbruch wegen
            // Zeitüberschreitung ist eine OperationCanceledException und wird
            // hier bewusst nicht gefangen.
            return new BoundedBody(BodyOutcome.Aborted, string.Empty);
        }
    }

    private enum FieldKind { Found, Missing, NotJson }

    private readonly record struct JsonField(FieldKind Kind, string? Value);

    private static JsonField ReadStringField(string body, string field)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.ValueKind != JsonValueKind.Object) return new JsonField(FieldKind.Missing, null);
            if (!document.RootElement.TryGetProperty(field, out var value)) return new JsonField(FieldKind.Missing, null);
            // Ein Zahlenwert in `answer` warf vorher ebenfalls eine
            // JsonException; hier ist er schlicht kein Text.
            return value.ValueKind == JsonValueKind.String
                ? new JsonField(FieldKind.Found, value.GetString())
                : new JsonField(FieldKind.Missing, null);
        }
        catch (JsonException)
        {
            return new JsonField(FieldKind.NotJson, null);
        }
    }

    /// <summary>
    /// Kürzt auf eine Höchstlänge und entfernt Steuerzeichen.
    ///
    /// Zeilenumbrüche bleiben erhalten — der Antwortformatierer erzeugt echte
    /// mehrzeilige Listen. Alles andere unterhalb von U+0020 fliegt raus,
    /// insbesondere U+001B: Ein Fehlertext mit ANSI-Sequenzen kam im Test
    /// unverändert durch.
    /// </summary>
    private static string Shorten(string value, int maximumCharacters)
    {
        var builder = new StringBuilder(Math.Min(value.Length, maximumCharacters));
        foreach (var character in value)
        {
            if (character == '\r') continue;
            if (character < ' ' && character != '\n') continue;
            if (builder.Length == maximumCharacters) return builder.Append(" … (gekürzt)").ToString();
            builder.Append(character);
        }

        return builder.ToString();
    }
}
