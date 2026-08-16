using System.Runtime.InteropServices;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Windows.Graphics;

namespace BrandyCards_Desktop;

public sealed partial class MainWindow : Window
{
    private const int PetWidth = 260;
    private const int PetHeight = 300;
    private const int PetRightOffset = 32;
    private const int PetBottomOffset = 48;
    private const int LauncherGap = 16;
    private const int LauncherWidth = 400;
    private const int LauncherHeight = 104;
    private const int AssistantWidth = 520;
    private const int AssistantHeight = 680;
    private const int SetupWidth = 520;
    private const int SetupHeight = 760;

    public MainWindow()
    {
        InitializeComponent();
        AppWindow.SetIcon("Assets/AppIcon.ico");
        ConfigureSetupWindow();
        RootFrame.Navigate(typeof(MainPage));
    }

    public void ConfigureSetupWindow()
    {
        AppWindow.Show();
        AppWindow.Resize(new SizeInt32(ToPhysicalPixels(SetupWidth), ToPhysicalPixels(SetupHeight)));

        if (AppWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.SetBorderAndTitleBar(true, true);
            presenter.IsAlwaysOnTop = true;
            presenter.IsResizable = true;
            presenter.IsMaximizable = false;
        }
    }

    public void ConfigureLauncherWindow(bool assistantPanelExpanded = false, PetPlacement? petPlacement = null)
    {
        var width = ToPhysicalPixels(assistantPanelExpanded ? AssistantWidth : LauncherWidth);
        var height = ToPhysicalPixels(assistantPanelExpanded ? AssistantHeight : LauncherHeight);
        AppWindow.Show();

        if (AppWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.SetBorderAndTitleBar(true, true);
            presenter.IsAlwaysOnTop = true;
            presenter.IsResizable = assistantPanelExpanded;
            presenter.IsMaximizable = false;
            presenter.IsMinimizable = true;
        }

        PositionBesidePet(width, height, petPlacement);
    }

    private int ToPhysicalPixels(int effectivePixels)
    {
        return (int)Math.Round(effectivePixels * RasterizationScale());
    }

    /// <summary>
    /// Skalierungsfaktor des Monitors, auf dem dieses Fenster gerade liegt.
    ///
    /// `ConfigureSetupWindow` läuft schon im Konstruktor, also bevor der
    /// Frame navigiert ist und ein `XamlRoot` existiert. Ohne den DPI-Rückfall
    /// blieb das Setup-Fenster deshalb bei 520x760 *physischen* Pixeln und war
    /// bei 150 % nur 347x507 effektive Pixel groß.
    /// </summary>
    private double RasterizationScale()
    {
        var scale = RootFrame.XamlRoot?.RasterizationScale ?? 0;
        if (scale > 0) return scale;
        var dpi = GetDpiForWindow(Win32Interop.GetWindowFromWindowId(AppWindow.Id));
        return dpi > 0 ? dpi / 96.0 : 1.0;
    }

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr windowHandle);

    /// <summary>
    /// Stellt das Fenster links neben das Pet, Unterkanten bündig.
    ///
    /// Maßgeblich ist die *tatsächliche* Lage des Pets, nicht die aus den
    /// Rändern zurückgerechnete. Das Pet ist verschiebbar (`HTCAPTION`), und
    /// vorher rechnete diese Stelle unbeirrt gegen
    /// <see cref="DisplayArea.Primary"/>: Ein an den linken Rand gezogenes Pet
    /// ließ das Fenster beim nächsten Öffnen unten rechts stehen — bei mehreren
    /// Bildschirmen sogar auf einem anderen als das Pet.
    ///
    /// Geklemmt wird gegen den Arbeitsbereich des Bildschirms, auf dem das Pet
    /// liegt. Bei genau einem Bildschirm ist das derselbe Bereich wie zuvor,
    /// die Position ändert sich dort also nur, wenn das Pet bewegt wurde.
    /// </summary>
    private void PositionBesidePet(int width, int height, PetPlacement? petPlacement)
    {
        var pet = petPlacement ?? FallbackPlacement();

        var x = pet.Left - LauncherGap - width;
        var y = pet.Bottom - height;

        // Links kein Platz mehr: dann lieber rechts neben das Pet als darüber.
        if (x < pet.WorkLeft && pet.Right + LauncherGap + width <= pet.WorkRight)
        {
            x = pet.Right + LauncherGap;
        }

        x = Math.Clamp(x, pet.WorkLeft, Math.Max(pet.WorkLeft, pet.WorkRight - width));
        y = Math.Clamp(y, pet.WorkTop, Math.Max(pet.WorkTop, pet.WorkBottom - height));
        AppWindow.MoveAndResize(new RectInt32(x, y, width, height));
    }

    /// <summary>
    /// Wo das Pet stehen *wird*, solange es noch nicht sichtbar ist.
    ///
    /// Gilt für die Setup-Ansicht und den ersten Aufbau. Dieselbe Rechnung wie
    /// in `NativePetOverlay.Show()` und mit denselben Rändern; die Gleichheit
    /// der Konstanten hält `tests/assistant-phase5b.test.mjs` fest.
    /// </summary>
    private static PetPlacement FallbackPlacement()
    {
        var workArea = DisplayArea.Primary.WorkArea;
        var right = workArea.X + workArea.Width - PetRightOffset;
        var bottom = workArea.Y + workArea.Height - PetBottomOffset;
        return new PetPlacement(
            right - PetWidth,
            bottom - PetHeight,
            right,
            bottom,
            workArea.X,
            workArea.Y,
            workArea.X + workArea.Width,
            workArea.Y + workArea.Height);
    }
}
