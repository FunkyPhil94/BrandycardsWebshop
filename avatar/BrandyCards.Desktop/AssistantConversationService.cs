using System.Net.Http.Json;
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

    public async Task<string> AskAsync(string shopUrl, string deviceToken, string message, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{shopUrl}/api/avatar/device/assistant")
        {
            // StringContent kennt die Byte-Länge vor dem Senden. Damit passiert
            // die Anfrage auch den serverseitigen Body-Guard ohne chunked Body.
            Content = new StringContent(JsonSerializer.Serialize(new { message }), Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new("Bearer", deviceToken);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var error = await TryReadErrorAsync(response, cancellationToken);
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                return "Diese Kopplung darf den Assistant nicht verwenden oder ist abgelaufen. Bitte ändere die Verbindung und kopple das Gerät erneut.";
            }
            return error ?? $"Der Assistant ist gerade nicht erreichbar (HTTP {(int)response.StatusCode}).";
        }

        var payload = await response.Content.ReadFromJsonAsync<AssistantReply>(cancellationToken: cancellationToken);
        return string.IsNullOrWhiteSpace(payload?.Answer)
            ? "Der Assistant hat keine lesbare Textantwort geliefert."
            : payload.Answer.Trim();
    }

    private static async Task<string?> TryReadErrorAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            var payload = await response.Content.ReadFromJsonAsync<ApiError>(cancellationToken: cancellationToken);
            return payload?.Error;
        }
        catch
        {
            return null;
        }
    }

    private sealed record AssistantReply(string Answer);
    private sealed record ApiError(string Error);
}
