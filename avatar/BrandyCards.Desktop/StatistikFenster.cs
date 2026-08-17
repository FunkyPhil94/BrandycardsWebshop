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
    public StatistikFenster(IReadOnlyList<AssistantConversationService.AssistantVisual> bilder, ElementTheme thema)
    {
        Title = "BrandyCards Statistik";

        var inhalt = StatistikAnsicht.Baue(bilder, kompakt: false);
        var rahmen = new ScrollViewer
        {
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            Padding = new Thickness(20),
            Content = inhalt,
        };

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
