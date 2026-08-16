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

    private int _effectiveWidth = SetupWidth;
    private int _effectiveHeight = SetupHeight;
    private double _appliedScale;
    private bool _watchingScale;

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
        // Das Setup-Fenster wird nicht verschoben; maßgeblich ist deshalb die
        // Skalierung des Bildschirms, auf dem es bereits liegt.
        Remember(SetupWidth, SetupHeight, RasterizationScale());
        AppWindow.Resize(new SizeInt32(
            ToPhysicalPixels(SetupWidth, _appliedScale),
            ToPhysicalPixels(SetupHeight, _appliedScale)));

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
        // Erst das Ziel bestimmen, dann damit rechnen. Dieses Fenster zieht
        // gleich neben das Pet — bei mehreren Bildschirmen möglicherweise auf
        // einen anderen als den, auf dem es gerade liegt. Die Größe muss
        // deshalb mit der Skalierung des *Zielbildschirms* entstehen.
        var pet = petPlacement ?? FallbackPlacement();
        var scale = MonitorScale(pet.Left, pet.Top, pet.Right, pet.Bottom) ?? RasterizationScale();

        var width = ToPhysicalPixels(assistantPanelExpanded ? AssistantWidth : LauncherWidth, scale);
        var height = ToPhysicalPixels(assistantPanelExpanded ? AssistantHeight : LauncherHeight, scale);
        Remember(assistantPanelExpanded ? AssistantWidth : LauncherWidth,
            assistantPanelExpanded ? AssistantHeight : LauncherHeight, scale);
        AppWindow.Show();

        if (AppWindow.Presenter is OverlappedPresenter presenter)
        {
            presenter.SetBorderAndTitleBar(true, true);
            presenter.IsAlwaysOnTop = true;
            presenter.IsResizable = assistantPanelExpanded;
            presenter.IsMaximizable = false;
            presenter.IsMinimizable = true;
        }

        PositionBesidePet(width, height, pet);
    }

    private void Remember(int effectiveWidth, int effectiveHeight, double scale)
    {
        _effectiveWidth = effectiveWidth;
        _effectiveHeight = effectiveHeight;
        _appliedScale = scale;
        EnsureScaleWatcher();
    }

    private static int ToPhysicalPixels(int effectivePixels, double scale)
    {
        return (int)Math.Round(effectivePixels * scale);
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

    /// <summary>
    /// Skalierung des Bildschirms, auf dem ein *Rechteck* liegt — oder `null`,
    /// wenn sie sich nicht ermitteln lässt.
    ///
    /// <see cref="RasterizationScale"/> beantwortet eine andere Frage: Sie gilt
    /// für den Bildschirm, auf dem *dieses Fenster* gerade liegt. Solange das
    /// Fenster gleich dorthin zieht, wo das Pet steht, ist das der falsche
    /// Bezug: Bei zwei Bildschirmen mit verschiedener Skalierung entstünde die
    /// Fenstergröße mit dem Faktor des Herkunfts- statt des Zielbildschirms,
    /// und `WM_DPICHANGED` käme erst *nach* dem Verschieben — die Größe wäre
    /// also mit einem bereits veralteten Faktor gerechnet.
    ///
    /// `MDT_EFFECTIVE_DPI` ist genau der Wert, den der Nutzer in den
    /// Anzeigeeinstellungen als Skalierung gewählt hat; der Prozess ist laut
    /// `app.manifest` `PerMonitorV2`, bekommt hier also den echten Wert des
    /// Bildschirms und nicht den System-DPI-Ersatz. `MONITOR_DEFAULTTONEAREST`
    /// liefert auch für ein Rechteck, das auf keinem Bildschirm mehr liegt
    /// (abgehängter Monitor), den nächstgelegenen statt `NULL` — nachgemessen.
    ///
    /// Gibt es keinen belastbaren Wert, wird bewusst `null` gemeldet statt ein
    /// geratener Faktor: Der Aufrufer fällt dann auf die bisherige Rechnung
    /// zurück, statt mit einer erfundenen Zahl zu arbeiten.
    /// </summary>
    private static double? MonitorScale(int left, int top, int right, int bottom)
    {
        var rect = new Rect { Left = left, Top = top, Right = right, Bottom = bottom };
        var monitor = MonitorFromRect(ref rect, MonitorDefaultToNearest);
        if (monitor == IntPtr.Zero) return null;
        if (GetDpiForMonitor(monitor, MdtEffectiveDpi, out var dpiX, out _) != 0) return null;
        return dpiX > 0 ? dpiX / 96.0 : null;
    }

    /// <summary>
    /// Hört einmalig zu, ob sich die Skalierung unter dem Fenster ändert.
    ///
    /// Das ist die zweite Richtung desselben Themas: Nicht das Pet, sondern der
    /// Launcher selbst wandert auf einen Bildschirm mit anderer Skalierung —
    /// gezogen am Titelbalken, oder weil jemand die Anzeigeeinstellung im
    /// laufenden Betrieb ändert. Die Fenstergröße in physischen Pixeln bleibt
    /// dabei stehen, während der XAML-Inhalt sofort mit dem neuen Faktor
    /// gezeichnet wird; ohne Korrektur wäre das Panel abgeschnitten.
    ///
    /// `XamlRoot` existiert erst nach dem Navigieren — `ConfigureSetupWindow`
    /// läuft schon im Konstruktor. Deshalb wird die Anmeldung bei jedem
    /// Konfigurieren erneut versucht und beim ersten Erfolg festgehalten.
    /// </summary>
    private void EnsureScaleWatcher()
    {
        if (_watchingScale) return;
        var xamlRoot = RootFrame.XamlRoot;
        if (xamlRoot is null) return;
        xamlRoot.Changed += XamlRoot_Changed;
        _watchingScale = true;
    }

    private void XamlRoot_Changed(XamlRoot sender, XamlRootChangedEventArgs args)
    {
        var scale = sender.RasterizationScale;
        // Nur ein echter Skalierungswechsel zählt. `Changed` feuert auch bei
        // jeder Größenänderung; ohne diese Schranke würde das eigene
        // `MoveAndResize` unten sich selbst erneut auslösen.
        if (scale <= 0 || Math.Abs(scale - _appliedScale) < 0.001) return;
        _appliedScale = scale;

        var width = ToPhysicalPixels(_effectiveWidth, scale);
        var height = ToPhysicalPixels(_effectiveHeight, scale);

        // Die Lage bleibt, wo der Nutzer sie hingezogen hat — nur die Größe
        // wird nachgeführt. Geklemmt wird gegen den Arbeitsbereich des
        // Bildschirms, auf dem das Fenster jetzt liegt, damit das gewachsene
        // Fenster nicht über dessen Rand hinausragt.
        var position = AppWindow.Position;
        var x = position.X;
        var y = position.Y;
        if (WorkArea(x, y, x + width, y + height) is { } work)
        {
            x = Math.Clamp(x, work.Left, Math.Max(work.Left, work.Right - width));
            y = Math.Clamp(y, work.Top, Math.Max(work.Top, work.Bottom - height));
        }

        AppWindow.MoveAndResize(new RectInt32(x, y, width, height));
    }

    private static Rect? WorkArea(int left, int top, int right, int bottom)
    {
        var rect = new Rect { Left = left, Top = top, Right = right, Bottom = bottom };
        var monitor = MonitorFromRect(ref rect, MonitorDefaultToNearest);
        if (monitor == IntPtr.Zero) return null;
        var info = new MonitorInfo { Size = (uint)Marshal.SizeOf<MonitorInfo>() };
        return GetMonitorInfo(monitor, ref info) ? info.WorkArea : null;
    }

    private const uint MonitorDefaultToNearest = 0x00000002;
    private const int MdtEffectiveDpi = 0;

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MonitorInfo
    {
        public uint Size;
        public Rect Monitor;
        public Rect WorkArea;
        public uint Flags;
    }

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr windowHandle);

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromRect(ref Rect rect, uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);

    [DllImport("shcore.dll")]
    private static extern int GetDpiForMonitor(IntPtr monitor, int type, out uint dpiX, out uint dpiY);

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
