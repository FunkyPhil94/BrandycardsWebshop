using System.Diagnostics;
using System.Net.Http;
using System.Net.Sockets;
using System.Text;

namespace BrandyCards_Desktop;

/// <summary>
/// Übersetzt eine Ausnahme in einen kurzen deutschen Satz für die Oberfläche.
///
/// Der Anlass steht in der Übergabe zu Phase 6: Der Fehlerpfad hängte
/// `exception.Message` unbesehen an eine deutsche Einleitung. Auf dem
/// Prüfgerät war das erträglich, weil .NET die Socket-Meldungen dort deutsch
/// lokalisiert ausgibt — das ist aber eine Eigenschaft *dieses* Rechners, kein
/// Merkmal des Programms. Auf einem englischen Windows steht dort
/// „An error occurred while sending the request."; der generische
/// `catch (Exception)` konnte darüber hinaus jeden beliebigen Framework-Text
/// samt Typnamen, Pfaden und inneren Details in die Statuszeile und in die
/// Unterhaltung tragen.
///
/// Deshalb gilt hier: **Für Fremdausnahmen wird `Message` nie angezeigt.** Die
/// Unterscheidung entsteht ausschließlich aus <see cref="SocketError"/> und
/// <see cref="HttpRequestError"/> — das sind Aufzählungswerte, kein
/// übersetzter Fließtext. Damit ist die Anzeige unabhängig von Windows-Sprache
/// und .NET-Version.
///
/// Eigene Ausnahmen sind die Ausnahme von der Regel: Deren Text ist im
/// Programm selbst geschrieben, deutsch und für den Nutzer gedacht. Er wird
/// weitergereicht, aber begrenzt — auch dieser Weg trägt fremden Text, sobald
/// er aus einer Shop-Antwort stammt.
/// </summary>
internal static class DesktopErrorMessages
{
    /// <summary>
    /// Obergrenze für eine angezeigte Meldung.
    ///
    /// Betrifft in der Praxis nur den durchgereichten Text der eigenen
    /// Ausnahmen: `MainPage.ReadApiErrorAsync` gibt das Feld `error` aus der
    /// Shop-Antwort zurück, und dessen Länge bestimmt der Absender, nicht
    /// dieses Programm. Phase 6 hat denselben Weg im Assistant-Pfad begrenzt,
    /// den Kopplungspfad aber nicht — hier wird das nachgeholt. Die eigenen
    /// Meldungen der Route liegen alle unter 100 Zeichen.
    /// </summary>
    internal const int MaxCharacters = 300;

    internal const string Unexpected = "Die Anfrage konnte nicht ausgeführt werden. Bitte erneut versuchen.";

    /// <summary>Kurzer deutscher Satz zu dieser Ausnahme.</summary>
    public static string Describe(Exception exception)
    {
        // Der technische Anlass bleibt für die Fehlersuche erhalten, aber nur
        // dort, wo ihn der Nutzer nicht sieht.
        Debug.WriteLine($"[BrandyCards] {exception.GetType().FullName}: {exception.Message}");

        return exception switch
        {
            HttpRequestException http => Unreachable(http),
            // Gemessen: Wird der Körper nach `ResponseHeadersRead` gelesen und
            // die Gegenstelle legt mittendrin auf, kommt eine nackte
            // IOException an — nicht in eine HttpRequestException verpackt.
            // Der Assistant-Pfad fängt sie schon in `ReadBoundedBodyAsync`; der
            // Ereignisabruf lief bis hierher in den allgemeinen Fall.
            IOException => "Die Verbindung zum Shop ist abgebrochen, bevor die Antwort vollständig war. Bitte erneut versuchen.",
            // Die einzige Abbruchquelle ist ein gesetzter Zeitrahmen. Die
            // Aufrufer fangen den Fall meist selbst mit ihrer eigenen Zahl ab;
            // dies ist der Rückfall.
            OperationCanceledException => "Der Shop hat nicht rechtzeitig geantwortet. Bitte erneut versuchen.",
            // Nur hier steht ein Text aus dem Programm selbst.
            InvalidOperationException => SingleLine(exception.Message, MaxCharacters),
            _ => Unexpected,
        };
    }

    /// <summary>
    /// Warum der Shop nicht erreichbar war — abgeleitet aus Aufzählungswerten,
    /// nicht aus dem Meldungstext.
    ///
    /// Die Reihenfolge ist gemessen, nicht geraten. Zuerst die Fälle, die
    /// <see cref="HttpRequestError"/> genauer kennt als jeder Socket: Bei einer
    /// gescheiterten TLS-Aushandlung steht im Fehlerbaum *zusätzlich* ein
    /// zurückgesetzter Socket, und mit der Socket-Prüfung zuvor hätte die
    /// Anzeige „unterwegs getrennt" gemeldet statt auf die gesicherte
    /// Verbindung zu zeigen — genau so gemessen gegen einen HTTPS-Aufruf auf
    /// einen reinen HTTP-Zuhörer.
    ///
    /// Danach der innere <see cref="SocketException"/>: Er benennt den Anlass
    /// des Verbindungsaufbaus am genauesten (abgelehnt, unbekannter Name, kein
    /// Netz), wo <see cref="HttpRequestError"/> nur `ConnectionError` weiß.
    /// Zuletzt die gröberen Aufzählungswerte als Rückfall.
    /// </summary>
    private static string Unreachable(HttpRequestException exception)
    {
        switch (exception.HttpRequestError)
        {
            case HttpRequestError.SecureConnectionError:
                return "Der Shop ist nicht erreichbar: Die gesicherte Verbindung kam nicht zustande. Bitte Adresse und Zertifikat prüfen.";
            case HttpRequestError.NameResolutionError:
                return "Der Shop ist nicht erreichbar: Die Adresse konnte keinem Rechner zugeordnet werden. Bitte die Schreibweise prüfen.";
            case HttpRequestError.ProxyTunnelError:
                return "Der Shop ist nicht erreichbar: Ein zwischengeschalteter Proxy hat die Verbindung nicht durchgelassen.";
            case HttpRequestError.UserAuthenticationError:
                return "Der Shop ist nicht erreichbar: Die Verbindung verlangt eine Anmeldung, die dieser Desktop nicht leisten kann.";
        }

        switch (FindSocketError(exception))
        {
            case SocketError.ConnectionRefused:
                return "Der Shop ist nicht erreichbar: Die Gegenstelle hat die Verbindung abgelehnt. Läuft der Shop unter dieser Adresse und diesem Port?";
            case SocketError.HostNotFound:
            case SocketError.NoData:
            case SocketError.TryAgain:
                return "Der Shop ist nicht erreichbar: Die Adresse konnte keinem Rechner zugeordnet werden. Bitte die Schreibweise prüfen.";
            case SocketError.TimedOut:
                return "Der Shop ist nicht erreichbar: Der Verbindungsaufbau lief in eine Zeitüberschreitung.";
            case SocketError.NetworkDown:
            case SocketError.NetworkUnreachable:
            case SocketError.HostUnreachable:
                return "Der Shop ist nicht erreichbar: Es besteht gerade keine Netzwerkverbindung.";
            case SocketError.ConnectionReset:
            case SocketError.ConnectionAborted:
                return "Die Verbindung zum Shop wurde unterwegs getrennt. Bitte erneut versuchen.";
        }

        return exception.HttpRequestError switch
        {
            HttpRequestError.ResponseEnded =>
                "Die Verbindung zum Shop ist abgebrochen, bevor die Antwort vollständig war. Bitte erneut versuchen.",
            HttpRequestError.InvalidResponse or HttpRequestError.HttpProtocolError or HttpRequestError.VersionNegotiationError =>
                "Unter dieser Adresse antwortet kein Shop, sondern etwas anderes. Bitte die Adresse prüfen.",
            _ => "Der Shop ist gerade nicht erreichbar. Bitte Adresse und Netzwerkverbindung prüfen.",
        };
    }

    private static SocketError? FindSocketError(Exception exception)
    {
        for (var current = exception.InnerException; current is not null; current = current.InnerException)
        {
            if (current is SocketException socket) return socket.SocketErrorCode;
        }

        return null;
    }

    /// <summary>
    /// Macht aus einem durchgereichten Text eine einzelne, begrenzte Zeile.
    ///
    /// Anders als `AssistantConversationService.Shorten` werden Zeilenumbrüche
    /// hier *nicht* bewahrt, sondern zu Leerzeichen: Das Ziel dieser Texte ist
    /// die einzeilige Statuszeile, und ein mehrzeiliger Text aus einer fremden
    /// Antwort würde sie auseinanderziehen. <see cref="char.IsControl(char)"/>
    /// deckt dabei mehr ab als ein Vergleich gegen U+0020 — auch U+007F und den
    /// C1-Bereich U+0080..U+009F. Nichts davon gehört in ein Anzeigeelement,
    /// insbesondere nicht U+001B: Ein Fehlertext mit ANSI-Sequenzen kam in
    /// Phase 6 unverändert durch.
    /// </summary>
    private static string SingleLine(string value, int maximumCharacters)
    {
        var builder = new StringBuilder(Math.Min(value.Length, maximumCharacters));
        var pendingSpace = false;
        foreach (var character in value)
        {
            if (char.IsControl(character))
            {
                pendingSpace = builder.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                pendingSpace = false;
                if (builder.Length > 0 && builder[^1] != ' ')
                {
                    if (builder.Length == maximumCharacters) return Truncated(builder);
                    builder.Append(' ');
                }
            }

            if (builder.Length == maximumCharacters) return Truncated(builder);
            builder.Append(character);
        }

        var result = builder.ToString().Trim();
        return result.Length > 0 ? result : Unexpected;
    }

    private static string Truncated(StringBuilder builder) => builder.Append(" … (gekürzt)").ToString();
}
