namespace BrandyCards_Desktop;

/// <summary>
/// K.A.R.L.s Stimme in der <b>Oberfläche</b> — und nur dort.
///
/// <para><b>Warum es diese Datei neben <c>lib/assistant/persona.ts</c> gibt, und
/// wo die Grenze verläuft.</b> Die Stimme der <i>Antwort</i> gehört auf den
/// Server: Dort entstehen die Antworten, und Phase 4 hat dem Client das
/// Formatieren von Daten ausdrücklich entzogen. Begrüßung beim Öffnen des
/// Panels, Statuszeile und Platzhaltertext entstehen dagegen an Stellen, die der
/// Server nie zu sehen bekommt — er weiß nicht, dass ein Fenster aufgeklappt
/// wurde, und kann es nicht wissen.</para>
///
/// <para>Die Trennung ist scharf und soll es bleiben: <b>Der Server textet nie
/// über Bedienelemente, dieser Client textet nie über Daten.</b> Käme hier je ein
/// Satz über Verkäufe, Bestände oder Zahlen hinzu, wäre die Grenze verletzt —
/// dann gehört er auf die andere Seite.</para>
///
/// <para><b>Kein Zufall</b>, aus demselben Grund wie serverseitig: Ein
/// <c>Random</c> macht jede Anzeige unprüfbar. Gewählt wird über einen
/// Streuwert; die Begrüßung wechselt mit dem Tag, die Statussprüche mit dem
/// Zählwert der Anfrage.</para>
/// </summary>
internal static class KarlPersona
{
    /// <summary>Der Name, ausgeschrieben — die Auflösung der Abkürzung.</summary>
    internal const string Langname = "Kartenshop-Auskunft für Recherche und Lagebericht";

    /// <summary>FNV-1a, 32 Bit — dieselbe Wahlmechanik wie serverseitig.</summary>
    private static int Streuwert(string text)
    {
        unchecked
        {
            var hash = (uint)0x811c9dc5;
            foreach (var zeichen in text)
            {
                hash ^= zeichen;
                hash *= 0x01000193;
            }
            return (int)(hash % int.MaxValue);
        }
    }

    private static string Waehle(IReadOnlyList<string> varianten, string streutext)
    {
        return varianten[Streuwert(streutext) % varianten.Count];
    }

    /// <summary>
    /// Die Tageszeit, aus der lokalen Uhr des Rechners.
    ///
    /// Anders als serverseitig wird hier <b>nicht</b> auf Europa/Berlin
    /// umgerechnet: Dieser Satz begrüßt den Menschen, der vor dem Bildschirm
    /// sitzt, und für den gilt seine eigene Uhr.
    /// </summary>
    internal static string Tageszeitgruss(DateTimeOffset jetzt) => jetzt.Hour switch
    {
        < 5 => "Nachtschicht?",
        < 11 => "Guten Morgen.",
        < 14 => "Mahlzeit.",
        < 18 => "Guten Tag.",
        < 22 => "Guten Abend.",
        _ => "Noch wach?",
    };

    /// <summary>Der erste Satz, wenn das Panel aufgeht.</summary>
    internal static string Begruessung(DateTimeOffset jetzt)
    {
        var varianten = new[]
        {
            "K.A.R.L. am Start, Karteikasten aufgeklappt. Frag mich was zu Verkäufen, Bestellungen, Vorschlägen, Bestand, Anfragen, eBay oder Statistik — ich sehe nach, anfassen darf ich nichts.",
            "Ich bin K.A.R.L. und habe nichts Besseres vor, als in deinen Daten zu blättern. Verkäufe, Bestellungen, Preisvorschläge, Bestand, Anfragen, eBay, Statistik — nur lesend, versteht sich.",
            "Da bin ich. Reine Leserechte, dafür bestens sortiert: Verkäufe, Bestellungen, Vorschläge, Bestand, Anfragen, eBay-Daten und Statistiken.",
        };
        return $"{Tageszeitgruss(jetzt)} {Waehle(varianten, jetzt.ToString("yyyy-MM-dd"))}";
    }

    /// <summary>Was in der Statuszeile steht, während gelesen wird.</summary>
    internal static string Liest(int anfrageNummer) => Waehle(
        [
            "Blättere im Karteikasten …",
            "Sehe nach …",
            "Einen Moment, ich zähle nach …",
        ],
        $"liest {anfrageNummer}");

    /// <summary>Was danach dort steht.</summary>
    internal static string Fertig(int anfrageNummer) => Waehle(
        [
            "Hab ich.",
            "Bitte sehr.",
            "Fertig.",
        ],
        $"fertig {anfrageNummer}");

    /// <summary>Der Ruhezustand.</summary>
    internal const string Bereit = "Bereit, wenn du es bist.";

    /// <summary>
    /// Der Text neben der Tippanzeige.
    ///
    /// Getrennt von <see cref="Liest"/>, weil beide gleichzeitig sichtbar sind:
    /// „Sehe nach …" zweimal untereinander läse sich wie ein Anzeigefehler.
    /// </summary>
    internal const string TipptGerade = "K.A.R.L. schlägt nach";

    /// <summary>Der Platzhalter im Eingabefeld.</summary>
    internal const string EingabePlatzhalter = "Frag mich was …";

    /// <summary>
    /// Die anklickbaren Beispielfragen.
    ///
    /// <b>Sie sind mehr als Zierde:</b> Vor dieser Fassung stand dieselbe
    /// Aufzählung als grauer Fließtext unter dem Verlauf und musste abgetippt
    /// werden. Als Knopf ist sie ein Klick — und zeigt nebenbei, welche
    /// Formulierungen der Planer sicher versteht.
    /// </summary>
    internal static readonly IReadOnlyList<string> Beispielfragen =
    [
        "Was wurde zuletzt verkauft?",
        "Zeig offene Preisvorschläge",
        "Umsatz der letzten 7 Tage",
        "Wie ist der eBay-Abgleich?",
    ];
}
