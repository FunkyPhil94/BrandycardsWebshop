using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Windows.Graphics;

namespace BrandyCards_Desktop;

public sealed partial class MainWindow : Window
{
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

    public void ConfigurePetWindow()
    {
        AppWindow.Hide();
    }
}
