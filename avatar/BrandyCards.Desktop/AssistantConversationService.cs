using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace BrandyCards_Desktop;

internal sealed class AssistantConversationService(HttpClient httpClient)
{
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
