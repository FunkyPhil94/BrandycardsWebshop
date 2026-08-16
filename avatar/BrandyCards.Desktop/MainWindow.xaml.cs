using System.Runtime.InteropServices;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Windows.Graphics;

namespace BrandyCards_Desktop;

public sealed partial class MainWindow : Window
{
    private const int PetWidth = 260;
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

    public void ConfigureLauncherWindow(bool assistantPanelExpanded = false)
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

        PositionBesidePet(width, height);
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

    private void PositionBesidePet(int width, int height)
    {
        var workArea = DisplayArea.Primary.WorkArea;
        var x = workArea.X + workArea.Width - PetRightOffset - PetWidth - LauncherGap - width;
        var y = workArea.Y + workArea.Height - PetBottomOffset - height;
        x = Math.Max(workArea.X + LauncherGap, x);
        y = Math.Max(workArea.Y + LauncherGap, y);
        AppWindow.MoveAndResize(new RectInt32(x, y, width, height));
    }
}
