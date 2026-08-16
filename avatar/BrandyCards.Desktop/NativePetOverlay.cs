using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace BrandyCards_Desktop;

internal sealed class NativePetOverlay : IDisposable
{
    private const int FrameWidth = 192;
    private const int FrameHeight = 208;
    private const int WindowWidth = 260;
    private const int WindowHeight = 300;
    private const int WsPopup = unchecked((int)0x80000000);
    private const int WsExLayered = 0x00080000;
    private const int WsExToolWindow = 0x00000080;
    private const int WsExNoActivate = 0x08000000;
    private const int SwHide = 0;
    private const int SwShowNoActivate = 4;
    private const uint SwpNoActivate = 0x0010;
    private const uint SwpShowWindow = 0x0040;
    private const uint UlwAlpha = 0x00000002;
    private const byte AcSrcOver = 0;
    private const byte AcSrcAlpha = 1;
    private const uint SmCxScreen = 0;
    private const uint SmCyScreen = 1;
    private const uint WmNchittest = 0x0084;
    private const uint WmLbuttonDblclk = 0x0203;
    private const uint WmRbuttonUp = 0x0205;
    private const int HtCaption = 2;

    private readonly Bitmap _atlas;
    private readonly Action _onRequestSetup;
    private readonly WndProcDelegate _wndProc;
    private readonly string _className = $"BrandyCardsPetOverlay_{Environment.ProcessId}";
    private readonly IntPtr _moduleHandle;
    private IntPtr _windowHandle;
    private bool _disposed;

    public NativePetOverlay(string atlasPath, Action onRequestSetup)
    {
        _atlas = new Bitmap(atlasPath);
        _onRequestSetup = onRequestSetup;
        _wndProc = WindowProc;
        _moduleHandle = GetModuleHandle(null);

        var windowClass = new WndClassEx
        {
            Size = (uint)Marshal.SizeOf<WndClassEx>(),
            WindowProc = Marshal.GetFunctionPointerForDelegate(_wndProc),
            Instance = _moduleHandle,
            ClassName = _className,
        };

        if (RegisterClassEx(ref windowClass) == 0 && Marshal.GetLastWin32Error() != 1410)
        {
            throw new InvalidOperationException("Das native Pet-Fenster konnte nicht registriert werden.");
        }

        _windowHandle = CreateWindowEx(
            WsExLayered | WsExToolWindow | WsExNoActivate,
            _className,
            "BrandyCards Pet",
            WsPopup,
            0,
            0,
            WindowWidth,
            WindowHeight,
            IntPtr.Zero,
            IntPtr.Zero,
            _moduleHandle,
            IntPtr.Zero);

        if (_windowHandle == IntPtr.Zero)
        {
            throw new InvalidOperationException("Das native Pet-Fenster konnte nicht erstellt werden.");
        }

    }

    public void Show()
    {
        ThrowIfDisposed();
        var x = GetSystemMetrics(SmCxScreen) - WindowWidth - 32;
        var y = GetSystemMetrics(SmCyScreen) - WindowHeight - 48;
        SetWindowPos(_windowHandle, new IntPtr(-1), x, y, WindowWidth, WindowHeight, SwpNoActivate | SwpShowWindow);
        ShowWindow(_windowHandle, SwShowNoActivate);
        SetFrame(0, 0);
    }

    public void Hide()
    {
        if (!_disposed && _windowHandle != IntPtr.Zero)
        {
            ShowWindow(_windowHandle, SwHide);
        }
    }

    public void SetFrame(int row, int column)
    {
        ThrowIfDisposed();
        var sourceRect = new Rectangle(column * FrameWidth, row * FrameHeight, FrameWidth, FrameHeight);
        using var frame = _atlas.Clone(sourceRect, PixelFormat.Format32bppPArgb);
        using var canvas = new Bitmap(WindowWidth, WindowHeight, PixelFormat.Format32bppPArgb);
        using (var graphics = Graphics.FromImage(canvas))
        {
            graphics.Clear(Color.Transparent);
            graphics.DrawImageUnscaled(frame, (WindowWidth - FrameWidth) / 2, 42);
        }

        UpdateLayeredBitmap(canvas);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        Hide();
        if (_windowHandle != IntPtr.Zero)
        {
            DestroyWindow(_windowHandle);
            _windowHandle = IntPtr.Zero;
        }

        UnregisterClass(_className, _moduleHandle);
        _atlas.Dispose();
    }

    private void UpdateLayeredBitmap(Bitmap bitmap)
    {
        var screenDc = GetDC(IntPtr.Zero);
        if (screenDc == IntPtr.Zero)
        {
            return;
        }

        var memoryDc = CreateCompatibleDC(screenDc);
        var dib = bitmap.GetHbitmap(Color.FromArgb(0, 0, 0, 0));
        if (dib == IntPtr.Zero || memoryDc == IntPtr.Zero)
        {
            if (dib != IntPtr.Zero) DeleteObject(dib);
            if (memoryDc != IntPtr.Zero) DeleteDC(memoryDc);
            ReleaseDC(IntPtr.Zero, screenDc);
            throw new InvalidOperationException("Der transparente Pet-Frame konnte nicht vorbereitet werden.");
        }

        try
        {
            var previousBitmap = SelectObject(memoryDc, dib);
            GetWindowRect(_windowHandle, out var windowRect);
            var destination = new Point(windowRect.Left, windowRect.Top);
            var size = new Size(bitmap.Width, bitmap.Height);
            var source = new Point(0, 0);
            var blend = new BlendFunction
            {
                Operation = AcSrcOver,
                Flags = 0,
                SourceConstantAlpha = 255,
                AlphaFormat = AcSrcAlpha,
            };

            var updateSucceeded = UpdateLayeredWindow(_windowHandle, screenDc, ref destination, ref size, memoryDc,
                ref source, 0, ref blend, UlwAlpha);
            if (!updateSucceeded)
            {
                throw new InvalidOperationException(
                    $"Der transparente Pet-Frame konnte nicht angezeigt werden (Win32 {Marshal.GetLastWin32Error()}).");
            }
            SelectObject(memoryDc, previousBitmap);
        }
        finally
        {
            DeleteObject(dib);
            DeleteDC(memoryDc);
            ReleaseDC(IntPtr.Zero, screenDc);
        }
    }

    private IntPtr WindowProc(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam)
    {
        if (message == WmNchittest)
        {
            return new IntPtr(HtCaption);
        }

        if (message == WmLbuttonDblclk || message == WmRbuttonUp)
        {
            _onRequestSetup();
            return IntPtr.Zero;
        }

        return DefWindowProc(hWnd, message, wParam, lParam);
    }

    private void ThrowIfDisposed()
    {
        ObjectDisposedException.ThrowIf(_disposed, this);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WndClassEx
    {
        public uint Size;
        public uint Style;
        public IntPtr WindowProc;
        public int ClassExtra;
        public int WindowExtra;
        public IntPtr Instance;
        public IntPtr Icon;
        public IntPtr Cursor;
        public IntPtr Background;
        [MarshalAs(UnmanagedType.LPWStr)] public string? MenuName;
        [MarshalAs(UnmanagedType.LPWStr)] public string ClassName;
        public IntPtr SmallIcon;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BlendFunction
    {
        public byte Operation;
        public byte Flags;
        public byte SourceConstantAlpha;
        public byte AlphaFormat;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Point
    {
        public int X;
        public int Y;

        public Point(int x, int y)
        {
            X = x;
            Y = y;
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Size
    {
        public int Width;
        public int Height;

        public Size(int width, int height)
        {
            Width = width;
            Height = height;
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    private delegate IntPtr WndProcDelegate(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr GetModuleHandle(string? moduleName);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern ushort RegisterClassEx(ref WndClassEx windowClass);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool UnregisterClass(string className, IntPtr instance);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateWindowEx(int extendedStyle, string className, string windowName, int style,
        int x, int y, int width, int height, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr parameter);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool DestroyWindow(IntPtr windowHandle);

    [DllImport("user32.dll")]
    private static extern IntPtr DefWindowProc(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(uint index);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr windowHandle, int command);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr windowHandle, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr windowHandle, out Rect rect);

    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr windowHandle);

    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr windowHandle, IntPtr deviceContext);

    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateCompatibleDC(IntPtr deviceContext);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteDC(IntPtr deviceContext);

    [DllImport("gdi32.dll")]
    private static extern IntPtr SelectObject(IntPtr deviceContext, IntPtr objectHandle);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr objectHandle);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UpdateLayeredWindow(IntPtr windowHandle, IntPtr screenDeviceContext,
        ref Point destination, ref Size size, IntPtr sourceDeviceContext, ref Point source,
        uint colorKey, ref BlendFunction blend, uint flags);
}
