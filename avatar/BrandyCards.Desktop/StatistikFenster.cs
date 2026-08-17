using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Windows.Graphics;
using WinRT.Interop;

namespace BrandyCards_Desktop;

/// <summary>
/// Die Statistik groß, in einem eigenen Fenster.
///
/// **Warum überhaupt.** Das Assistenten-Panel ist rund 520 Punkte breit. Kacheln
/// und sechs Umschalter passen dort nicht nebeneinander — im Screenshot des
/// Betreibers war der letzte Knopf abgeschnitten, und das Diagramm blieb
/// briefmarkengroß. Statt alles zu quetschen zeigt das Panel eine kompakte
/// Fassung und verweist hierher.
///
/// Das Pet-Overlay bleibt unberührt: Dies ist ein gewöhnliches Fenster und
/// hat mit dem `WS_EX_LAYERED`-Overlay nichts zu tun.
/// </summary>
internal sealed class StatistikFenster : Window
{
    public StatistikFenster(
        IReadOnlyList<AssistantConversationService.AssistantVisual> bilder,
        ElementTheme thema,
        Func<int, Task<IReadOnlyList<AssistantConversationService.AssistantVisual>>>? holeZeitraum = null)
    {
        Title = "BrandyCards Statistik";

        var rahmen = new ScrollViewer
        {
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            Padding = new Thickness(20),
        };

        var inhalt = new StackPanel { Spacing = 12 };
        var ansicht = new ContentControl { HorizontalContentAlignment = HorizontalAlignment.Stretch };
        var stand = new TextBlock { FontSize = 11, TextWrapping = TextWrapping.Wrap, Visibility = Visibility.Collapsed };

        // **Der frei wählbare Zeitraum.** Die Umschalter bieten nur die Fenster,
        // die mitgeliefert wurden; wer einen anderen will, stellt ihn hier ein.
        // Das fragt den Shop erneut — der Zeitraum überschreibt dort nur die
        // Spanne, nicht die Werkzeugwahl.
        if (holeZeitraum is not null)
        {
            var zeile = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, VerticalAlignment = VerticalAlignment.Center };
            var beschriftung = new TextBlock { Text = "Eigener Zeitraum:", FontSize = 12, VerticalAlignment = VerticalAlignment.Center };
            var eingabe = new NumberBox
            {
                Value = 30, Minimum = 1, Maximum = 90, Width = 120,
                SpinButtonPlacementMode = NumberBoxSpinButtonPlacementMode.Inline,
            };
            AutomationProperties.SetName(eingabe, "Zeitraum in Tagen, 1 bis 90");
            var tage = new TextBlock { Text = "Tage", FontSize = 12, VerticalAlignment = VerticalAlignment.Center };
            var holen = new Button { Content = "Anzeigen", MinHeight = 32 };
            AutomationProperties.SetName(holen, "Statistik für den eingestellten Zeitraum anzeigen");

            holen.Click += async (_, _) =>
            {
                var gewaehlt = (int)Math.Clamp(double.IsNaN(eingabe.Value) ? 30 : eingabe.Value, 1, 90);
                holen.IsEnabled = false;
                stand.Visibility = Visibility.Visible;
                stand.Text = $"Hole {gewaehlt} Tage …";
                try
                {
                    var neue = await holeZeitraum(gewaehlt);
                    if (neue.Count == 0)
                    {
                        stand.Text = "Für diesen Zeitraum kam keine Statistik zurück.";
                        return;
                    }
                    ansicht.Content = StatistikAnsicht.Baue(neue, kompakt: false);
                    stand.Visibility = Visibility.Collapsed;
                }
                catch (Exception fehler)
                {
                    // Ein Fehlschlag laesst die vorherige Ansicht stehen, statt
                    // sie durch eine leere zu ersetzen.
                    stand.Text = DesktopErrorMessages.Describe(fehler);
                }
                finally
                {
                    holen.IsEnabled = true;
                }
            };

            zeile.Children.Add(beschriftung);
            zeile.Children.Add(eingabe);
            zeile.Children.Add(tage);
            zeile.Children.Add(holen);
            inhalt.Children.Add(zeile);
            inhalt.Children.Add(stand);
        }

        ansicht.Content = StatistikAnsicht.Baue(bilder, kompakt: false);
        inhalt.Children.Add(ansicht);
        rahmen.Content = inhalt;

        var wurzel = new Grid
        {
            Background = (Brush)Application.Current.Resources["AvatarSurfaceBrush"],
            RequestedTheme = thema,
        };
        wurzel.Children.Add(rahmen);
        AutomationProperties.SetName(wurzel, "Statistik in voller Größe");

        // Escape schließt — dieselbe Erwartung wie beim Assistant-Panel.
        wurzel.KeyDown += (_, e) =>
        {
            if (e.Key == Windows.System.VirtualKey.Escape)
            {
                e.Handled = true;
                Close();
            }
        };
        wurzel.Loaded += (_, _) => wurzel.Focus(FocusState.Programmatic);
        wurzel.IsTabStop = true;

        Content = wurzel;
        SetzeGroesse();
    }

    /// <summary>
    /// Setzt die Fenstergröße in **physischen** Pixeln, aus effektiven
    /// gerechnet.
    ///
    /// Dieselbe Falle wie in Phase 5: Ein festes `Resize(900, 700)` ergäbe bei
    /// 150 % DPI nur 600×467 effektive Punkte — also ein Fenster, das kleiner
    /// wirkt als gewollt, je höher die Skalierung ist.
    /// </summary>
    private void SetzeGroesse()
    {
        var griff = WindowNative.GetWindowHandle(this);
        var skalierung = GetDpiForWindow(griff) / 96.0;
        if (skalierung <= 0) skalierung = 1.0;

        var fenster = AppWindow.GetFromWindowId(Win32Interop.GetWindowIdFromWindow(griff));
        fenster.Resize(new SizeInt32((int)(900 * skalierung), (int)(720 * skalierung)));
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr hwnd);
}
