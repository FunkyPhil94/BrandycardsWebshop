using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;

namespace BrandyCards_Desktop;

internal sealed class AssistantConversationService(HttpClient httpClient)
{
    private static readonly string[] SupportedExamples =
    [
        "Was wurde zuletzt verkauft?",
        "Welche Karte wurde zuletzt eingestellt?",
        "Gibt es neue Bestellungen?",
        "Zeig offene Angebote.",
        "Welche Karten brauchen Aufmerksamkeit?",
        "Welches eBay-Angebot hat die meisten Aufrufe?",
        "Gibt es neue eBay-Nachrichten?",
        "Gibt es neue Shop-Anfragen?",
        "Wie ist der eBay-Sync?",
        "Zeig mir die aktuelle Statistik.",
    ];

    public async Task<string> AskAsync(string shopUrl, string deviceToken, string message, CancellationToken cancellationToken = default)
    {
        var tool = ResolveTool(message);
        if (tool is null)
        {
            return "Ich kann in Phase 2 ausschließlich feste, lesende Abfragen ausführen. Versuche zum Beispiel:\n• " +
                string.Join("\n• ", SupportedExamples);
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{shopUrl}/api/avatar/device/assistant")
        {
            Content = JsonContent.Create(new { tool, limit = 10 }),
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

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        return FormatResponse(tool, document.RootElement);
    }

    internal static string? ResolveTool(string message)
    {
        var text = message.Trim().ToLowerInvariant();
        if (text.Length == 0) return null;

        if (ContainsAny(text, "statistik", "kennzahl", "übersicht", "uebersicht")) return "assistant_statistics";
        if (ContainsAny(text, "sync", "abgleich", "rücknahme", "ruecknahme", "outbox")) return "ebay_sync_health";
        if (ContainsAny(text, "aufruf", "view", "angesehen")) return "ebay_most_viewed";
        if (ContainsAny(text, "ebay") && ContainsAny(text, "nachricht", "postfach")) return "ebay_messages";
        if (ContainsAny(text, "anfrage", "kontakt")) return "new_shop_inquiries";
        if (ContainsAny(text, "bestand", "nachfüll", "nachfuell", "auffüllen", "auffuellen", "prüfbedarf", "pruefbedarf", "aufmerksamkeit")) return "inventory_review";
        if (ContainsAny(text, "angebot", "preisvorschlag")) return "open_shop_offers";
        if (ContainsAny(text, "bestellung", "order")) return "new_orders";
        if (ContainsAny(text, "eingestellt", "listing", "gelistet", "inseriert")) return "latest_listing";
        if (ContainsAny(text, "verkauft", "verkauf", "sale")) return "latest_sale";
        return null;
    }

    private static string FormatResponse(string tool, JsonElement root)
    {
        if (root.TryGetProperty("status", out var status) && status.GetString() == "UNAVAILABLE")
        {
            return GetString(root, "message") ?? "Diese Information ist derzeit nicht verfügbar.";
        }

        if (!root.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
        {
            return "Der Assistant hat keine lesbaren Daten geliefert.";
        }

        return tool switch
        {
            "latest_sale" => FormatLatestSale(data),
            "latest_listing" => FormatLatestListing(data),
            "new_orders" => FormatOrders(data),
            "open_shop_offers" => FormatOffers(data),
            "inventory_review" => FormatInventory(data),
            "new_shop_inquiries" => FormatInquiries(data),
            "ebay_sync_health" => FormatSyncHealth(data),
            "assistant_statistics" => FormatStatistics(data),
            _ => "Die Abfrage wurde ausgeführt, für die Antwort gibt es aber noch keine lokale Darstellung.",
        };
    }

    private static string FormatLatestSale(JsonElement data)
    {
        if (!data.TryGetProperty("sale", out var sale) || sale.ValueKind == JsonValueKind.Null)
        {
            return "Es wurde noch kein Verkauf gefunden.";
        }

        var items = sale.TryGetProperty("items", out var list) ? list.EnumerateArray().ToArray() : [];
        var itemText = items.Length == 0
            ? "ohne verfügbare Artikeldetails"
            : string.Join(", ", items.Select(item => $"{GetInt(item, "quantity") ?? 1}× {GetString(item, "title") ?? "Unbekannte Karte"}"));
        var source = GetString(sale, "source") == "EBAY" ? "eBay" : "Shop";
        return $"Der letzte Verkauf kam aus dem {source}: {itemText}. Status: {GetString(sale, "status") ?? "unbekannt"}.";
    }

    private static string FormatLatestListing(JsonElement data)
    {
        if (!data.TryGetProperty("listing", out var listing) || listing.ValueKind == JsonValueKind.Null)
        {
            return "Es wurde noch keine eingestellte Karte gefunden.";
        }

        var title = GetString(listing, "title") ?? "Unbekannte Karte";
        var price = FormatMoney(GetInt(listing, "priceAmountCents"), GetString(listing, "priceCurrency"));
        var source = GetString(listing, "source") == "EBAY" ? "eBay" : "Shop";
        return $"Zuletzt eingestellt wurde „{title}“ im {source}{(price is null ? "." : $" für {price}.")}";
    }

    private static string FormatOrders(JsonElement data)
    {
        var orders = GetArray(data, "orders");
        if (orders.Length == 0) return "Es gibt aktuell keine neuen bezahlten oder zu bearbeitenden Shop-Bestellungen.";

        var lines = orders.Select(order =>
        {
            var number = GetString(order, "orderNumber") ?? GetString(order, "id") ?? "ohne Nummer";
            var total = FormatMoney(GetInt(order, "totalAmountCents"), GetString(order, "currency")) ?? "Betrag unbekannt";
            return $"• {number}: {total}, Status {GetString(order, "status") ?? "unbekannt"}";
        });
        return $"Ich habe {orders.Length} neue oder zu bearbeitende Bestellung(en) gefunden:\n{string.Join("\n", lines)}";
    }

    private static string FormatOffers(JsonElement data)
    {
        var offers = GetArray(data, "offers");
        if (offers.Length == 0) return "Es gibt aktuell keine offenen Preisvorschläge im Shop.";

        var lines = offers.Select(offer =>
        {
            var amount = FormatMoney(GetInt(offer, "proposedAmountCents"), GetString(offer, "currency")) ?? "Betrag unbekannt";
            return $"• {GetString(offer, "title") ?? "Unbekannte Karte"}: {amount}";
        });
        return $"Es gibt {offers.Length} offene Preisvorschläge:\n{string.Join("\n", lines)}";
    }

    private static string FormatInventory(JsonElement data)
    {
        var items = GetArray(data, "items");
        if (items.Length == 0) return "Der Bestand enthält aktuell keine Karten mit Nachfüll- oder Prüfbedarf.";

        var lines = items.Select(item =>
        {
            var attention = GetString(item, "attention") == "REFILL" ? "nachfüllen" : "prüfen";
            return $"• {GetString(item, "title") ?? "Unbekannte Karte"}: {attention}";
        });
        return $"{items.Length} Karte(n) brauchen Aufmerksamkeit:\n{string.Join("\n", lines)}";
    }

    private static string FormatInquiries(JsonElement data)
    {
        var inquiries = GetArray(data, "inquiries");
        if (inquiries.Length == 0) return "Es gibt aktuell keine neuen Shop-Anfragen.";

        var lines = inquiries.Select(inquiry =>
        {
            var product = GetString(inquiry, "productTitle");
            return $"• {GetString(inquiry, "title") ?? "Anfrage"}{(string.IsNullOrWhiteSpace(product) ? string.Empty : $" zu {product}")}";
        });
        return $"Es gibt {inquiries.Length} neue Shop-Anfrage(n):\n{string.Join("\n", lines)}";
    }

    private static string FormatSyncHealth(JsonElement data)
    {
        var unresolved = GetInt(data, "unresolvedOutboxCount") ?? 0;
        var latestStatus = data.TryGetProperty("latestRun", out var latestRun) && latestRun.ValueKind == JsonValueKind.Object
            ? GetString(latestRun, "status")
            : null;
        var freshness = GetString(data, "dataFreshness");
        return $"Der letzte eBay-Abgleich hat den Status {latestStatus ?? "unbekannt"}. Offene Rücknahmeaufträge: {unresolved}. Datenstand: {FormatDate(freshness)}.";
    }

    private static string FormatStatistics(JsonElement data)
    {
        return "Aktuelle Übersicht:\n" +
            $"• Verkaufbare Karten: {GetInt(data, "sellableCards") ?? 0}\n" +
            $"• Offene Preisvorschläge: {GetInt(data, "openShopOffers") ?? 0}\n" +
            $"• Zu bearbeitende Bestellungen: {GetInt(data, "actionableOrders") ?? 0}\n" +
            $"• Neue Shop-Anfragen: {GetInt(data, "newShopInquiries") ?? 0}\n" +
            $"• Offene eBay-Aufträge: {GetInt(data, "unresolvedEbayJobs") ?? 0}";
    }

    private static bool ContainsAny(string text, params string[] terms) => terms.Any(text.Contains);

    private static JsonElement[] GetArray(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.Array
            ? value.EnumerateArray().ToArray()
            : [];

    private static string? GetString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static int? GetInt(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) ? number : null;

    private static string? FormatMoney(int? amountCents, string? currency)
    {
        if (amountCents is null) return null;
        var culture = CultureInfo.GetCultureInfo("de-DE");
        var amount = amountCents.Value / 100m;
        return string.Equals(currency, "EUR", StringComparison.OrdinalIgnoreCase)
            ? amount.ToString("C", culture)
            : $"{amount.ToString("N2", culture)} {currency ?? ""}".TrimEnd();
    }

    private static string FormatDate(string? value) =>
        DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var date)
            ? date.ToLocalTime().ToString("g", CultureInfo.GetCultureInfo("de-DE"))
            : "unbekannt";

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

    private sealed record ApiError(string Error);
}
