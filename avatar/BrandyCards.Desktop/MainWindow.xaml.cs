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
        AppWindow.Resize(new SizeInt32(520, 760));

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
        var scale = RootFrame.XamlRoot?.RasterizationScale ?? 1.0;
        return (int)Math.Round(effectivePixels * scale);
    }

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
