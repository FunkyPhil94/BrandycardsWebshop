using System.IO;
using System.Text;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using Windows.UI;

namespace BrandyCards_Desktop;

/// <summary>
/// Setzt eine Statistikansicht aus fertigen Texten und einem textfreien Bild
/// zusammen.
///
/// **Warum der Text nicht im Bild steckt.** Direct2D — und damit
/// `SvgImageSource` — stellt `<text>` nicht dar und überspringt es
/// stillschweigend. Am 2026-08-17 kamen die Statistikbilder deshalb ohne eine
/// einzige Beschriftung im Assistenten an: Balken und Gitterlinien sichtbar,
/// alles Geschriebene weg.
///
/// **Hier wird nichts formatiert.** Leitzahl, Kacheln, Achsenwerte und Hinweis
/// kommen fertig vom Server; diese Klasse platziert sie nur. Damit bleibt die
/// Trennung aus Phase 4 gewahrt — und der Text wird scharf, folgt der DPI und
/// ist vorlesbar, was ein Bild nie war.
/// </summary>
internal static class StatistikAnsicht
{
    /// <summary>
    /// Baut die Ansicht.
    /// </summary>
    /// <param name="kompakt">
    /// Im Panel (520 Punkte breit) ist für Kacheln und sechs Umschalter kein
    /// Platz — der Screenshot des Betreibers zeigte den letzten Knopf
    /// abgeschnitten. Kompakt heißt: Leitzahl, Diagramm, Hinweis. Alles Weitere
    /// gehört ins Vollbildfenster.
    /// </param>
    public static FrameworkElement Baue(
        IReadOnlyList<AssistantConversationService.AssistantVisual> bilder,
        bool kompakt,
        Action? grossAnzeigen = null)
    {
        var wurzel = new StackPanel { Spacing = kompakt ? 8 : 14 };
        if (bilder.Count == 0) return wurzel;

        var heroLabel = Text(11, "AvatarMutedBrush");
        var heroWert = Text(kompakt ? 28 : 40, "AvatarTextBrush", fett: true);
        var hinweis = Text(11, "AvatarMutedBrush");
        var spitze = Text(11, "AvatarMutedBrush");
        var zeitraum = Text(11, "AvatarMutedBrush");
        var bild = new Image { Stretch = Stretch.Fill, Height = kompakt ? 150 : 260 };
        var achse = new StackPanel { Width = 62, VerticalAlignment = VerticalAlignment.Stretch };
        var kacheln = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        var legende = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12 };

        // --- Kopf ------------------------------------------------------------
        var kopf = new StackPanel { Spacing = 1 };
        kopf.Children.Add(heroLabel);
        kopf.Children.Add(heroWert);
        wurzel.Children.Add(kopf);

        if (!kompakt) wurzel.Children.Add(kacheln);

        // --- Umschalter ------------------------------------------------------
        // Im Panel nur die Fenster der aktuellen Kennzahl, damit die Reihe nicht
        // über den Rand läuft; im Vollbild alle.
        var schalter = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 4 };
        AutomationProperties.SetName(schalter, "Ansicht der Statistik");
        var sichtbare = kompakt ? bilder.Where(b => b.Schluessel.EndsWith("-umsatz", StringComparison.Ordinal)).ToList() : bilder.ToList();
        if (sichtbare.Count == 0) sichtbare = bilder.ToList();
        if (sichtbare.Count > 1) wurzel.Children.Add(schalter);

        // --- Diagramm mit Achse ----------------------------------------------
        var plot = new Grid();
        plot.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        plot.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        Grid.SetColumn(achse, 0);
        Grid.SetColumn(bild, 1);
        plot.Children.Add(achse);
        plot.Children.Add(bild);
        wurzel.Children.Add(plot);

        var fuss = new StackPanel { Spacing = 1 };
        fuss.Children.Add(zeitraum);
        fuss.Children.Add(legende);
        fuss.Children.Add(hinweis);
        if (!kompakt) fuss.Children.Add(spitze);
        wurzel.Children.Add(fuss);

        if (kompakt && grossAnzeigen is not null)
        {
            var gross = new Button { Content = "Groß anzeigen", MinHeight = 30, HorizontalAlignment = HorizontalAlignment.Left };
            AutomationProperties.SetName(gross, "Statistik in einem eigenen Fenster groß anzeigen");
            gross.Click += (_, _) => grossAnzeigen();
            wurzel.Children.Add(gross);
        }

        foreach (var eintrag in sichtbare)
        {
            var knopf = new Button { Content = kompakt ? $"{eintrag.Fenster} Tage" : eintrag.Titel, MinHeight = 30 };
            AutomationProperties.SetName(knopf, $"Ansicht {eintrag.Titel}");
            knopf.Click += (_, _) => Zeige(eintrag);
            schalter.Children.Add(knopf);
        }

        Zeige(sichtbare[0]);
        return wurzel;

        async void Zeige(AssistantConversationService.AssistantVisual eintrag)
        {
            heroLabel.Text = eintrag.HeroLabel;
            heroWert.Text = eintrag.HeroWert;
            hinweis.Text = eintrag.Hinweis;
            zeitraum.Text = eintrag.Zeitraum;
            spitze.Text = eintrag.Spitze ?? string.Empty;

            // Achsenwerte an denselben vier Teilungen wie die Gitterlinien.
            achse.Children.Clear();
            foreach (var wert in eintrag.Achse)
            {
                var zeile = Text(10, "AvatarMutedBrush");
                zeile.Text = wert;
                zeile.TextAlignment = TextAlignment.Right;
                zeile.Height = bild.Height / Math.Max(1, eintrag.Achse.Count);
                achse.Children.Add(zeile);
            }

            legende.Children.Clear();
            foreach (var eintragLegende in eintrag.Legende)
            {
                var zeile = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 5 };
                zeile.Children.Add(new Border
                {
                    Width = 9, Height = 9, CornerRadius = new CornerRadius(2),
                    VerticalAlignment = VerticalAlignment.Center,
                    Background = new SolidColorBrush(Farbe(eintragLegende.Farbe)),
                });
                var name = Text(11, "AvatarMutedBrush");
                name.Text = eintragLegende.Name;
                zeile.Children.Add(name);
                legende.Children.Add(zeile);
            }

            kacheln.Children.Clear();
            foreach (var kachel in eintrag.Kacheln)
            {
                var inhalt = new StackPanel { Spacing = 2 };
                var label = Text(10, "AvatarMutedBrush");
                label.Text = kachel.Label;
                label.TextWrapping = TextWrapping.Wrap;
                var wert = Text(19, "AvatarTextBrush", fett: true);
                wert.Text = kachel.Wert;
                inhalt.Children.Add(label);
                inhalt.Children.Add(wert);
                kacheln.Children.Add(new Border
                {
                    Style = (Style)Application.Current.Resources["AssistantMessageBorderStyle"],
                    Width = 132,
                    Child = inhalt,
                });
            }

            foreach (var knopf in schalter.Children.OfType<Button>())
            {
                var gewaehlt = (string)AutomationProperties.GetName(knopf) == $"Ansicht {eintrag.Titel}";
                knopf.IsEnabled = !gewaehlt;
            }

            if (string.IsNullOrWhiteSpace(eintrag.Svg))
            {
                bild.Source = null;
                bild.Visibility = Visibility.Collapsed;
                return;
            }

            bild.Visibility = Visibility.Visible;
            // **Auf das Laden wird gewartet:** Ohne `await` verlässt der Strom
            // seinen Gültigkeitsbereich, bevor `SvgImageSource` ihn gelesen hat.
            var quelle = new SvgImageSource();
            using (var strom = new MemoryStream(Encoding.UTF8.GetBytes(eintrag.Svg)))
            {
                await quelle.SetSourceAsync(strom.AsRandomAccessStream());
            }
            bild.Source = quelle;
            AutomationProperties.SetName(bild, $"{eintrag.HeroLabel}: {eintrag.HeroWert}. {eintrag.Hinweis}");
        }
    }

    private static TextBlock Text(double groesse, string pinsel, bool fett = false) => new()
    {
        FontSize = groesse,
        FontWeight = fett ? Microsoft.UI.Text.FontWeights.SemiBold : Microsoft.UI.Text.FontWeights.Normal,
        Foreground = (Brush)Application.Current.Resources[pinsel],
        TextWrapping = TextWrapping.Wrap,
    };

    /// <summary>Übersetzt `#rrggbb` aus der Serverantwort in eine Farbe.
    ///  Unlesbares fällt auf Grau zurück, statt zu werfen — eine kaputte Farbe
    ///  darf die Ansicht nicht verhindern.</summary>
    private static Color Farbe(string hex)
    {
        if (hex.Length == 7 && hex[0] == '#'
            && byte.TryParse(hex[1..3], System.Globalization.NumberStyles.HexNumber, null, out var r)
            && byte.TryParse(hex[3..5], System.Globalization.NumberStyles.HexNumber, null, out var g)
            && byte.TryParse(hex[5..7], System.Globalization.NumberStyles.HexNumber, null, out var b))
        {
            return Color.FromArgb(255, r, g, b);
        }
        return Color.FromArgb(255, 0x88, 0x88, 0x88);
    }
}
