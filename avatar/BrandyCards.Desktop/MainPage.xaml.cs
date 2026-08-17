using System.IO;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using VirtualKey = Windows.System.VirtualKey;

namespace BrandyCards_Desktop;

public sealed partial class MainPage : Page
{
    /// <summary>
    /// Der Name, unter dem der Assistent im Gesprächsverlauf spricht.
    ///
    /// **K**artenshop-**A**uskunft für **R**echerche und **L**agebericht — vom
    /// Betreiber am 2026-08-17 gewählt.
    ///
    /// Steht als Konstante da, weil der Name an sechs Stellen im Verlauf
    /// auftaucht. Sechsmal als Zeichenkette geschrieben liefe er beim nächsten
    /// Umbenennen auseinander, und im selben Gespräch stünden zwei verschiedene
    /// Sprecher.
    /// </summary>
    private const string AssistantName = "K.A.R.L.";

    private const int FrameWidth = 192;
    private const int FrameHeight = 208;

    /// <summary>
    /// Zeitrahmen für Kopplung und Ereignisabruf — bewusst kurz.
    ///
    /// Der Abruf wiederholt sich alle drei Sekunden und darf nicht auf den
    /// langen Assistant-Zeitrahmen warten; ein vorübergehend stummer Shop soll
    /// binnen Sekunden als „nicht erreichbar" sichtbar werden. Der gemeinsame
    /// <see cref="HttpClient"/> ist deshalb auf den *längsten* Fall eingestellt,
    /// und die kurzen Pfade setzen ihre eigene Grenze je Aufruf.
    /// </summary>
    private static readonly TimeSpan ShopRequestTimeout = TimeSpan.FromSeconds(12);

    private readonly HttpClient _httpClient = new();
    private readonly DispatcherTimer _pollTimer;
    private readonly DispatcherTimer _animationTimer;
    private readonly DispatcherTimer _idleTimer;
    private readonly DispatcherQueue _dispatcherQueue;
    private readonly Queue<PendingAnimation> _animationQueue = new();
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);
    private readonly AssistantConversationService _assistantService;
    private readonly WindowsSpeechRecognitionService _speechRecognitionService = new();
    private readonly AzureSpeechRecognitionService _onlineSpeechRecognitionService = new();
    private AvatarSettings _settings = new();
    private DeviceCursor? _cursor;
    private NativePetOverlay? _petOverlay;
    private AnimationSpec _currentAnimation = AnimationSpec.Idle;
    private int _frameIndex;
    private bool _polling;
    private bool _initialized;
    private bool _assistantPanelExpanded;
    private bool _assistantRequestRunning;
    private bool _speechRecognitionRunning;
    private IReadOnlyList<string>? _speechPhrases;
    private SpeechTokenGrant? _speechToken;
    private DateTimeOffset _speechTokenValidUntil;
    private bool _conversationInitialized;
    private StatistikFenster? _statistikFenster;

    private static readonly IReadOnlyDictionary<string, AnimationSpec> Animations = new Dictionary<string, AnimationSpec>(StringComparer.OrdinalIgnoreCase)
    {
        ["OFFER_RECEIVED"] = new("Neuer Preisvorschlag eingegangen.", 6, 6, 3.0),
        ["OFFER_ACCEPTED"] = new("Preisvorschlag angenommen.", 3, 4, 2.5),
        ["OFFER_REJECTED"] = new("Preisvorschlag abgelehnt.", 5, 8, 3.0),
        ["CARD_SOLD"] = new("Karte verkauft.", 4, 5, 3.0),
    };

    public MainPage()
    {
        InitializeComponent();
        _dispatcherQueue = DispatcherQueue.GetForCurrentThread();
        _pollTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
        _pollTimer.Tick += PollTimer_Tick;
        _animationTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(140) };
        _animationTimer.Tick += AnimationTimer_Tick;
        _idleTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(160) };
        _idleTimer.Tick += IdleTimer_Tick;
        // `HttpClient.Timeout` ist eine Obergrenze für den gesamten Client und
        // lässt sich je Aufruf nicht verlängern, nur verkürzen. Deshalb steht
        // hier der längste Fall — die Assistant-Anfrage — und die kurzen Pfade
        // begrenzen sich selbst über `ShopRequestTimeout`.
        _httpClient.Timeout = AssistantConversationService.RequestTimeout;
        _assistantService = new AssistantConversationService(_httpClient);
        SpriteImage.Source = new BitmapImage(new Uri(Path.Combine(AppContext.BaseDirectory, "Assets", "spritesheet.png")));
        ApplyFrame();
    }

    private async void Page_Loaded(object sender, RoutedEventArgs e)
    {
        if (_initialized) return;
        _initialized = true;
        _settings = await SettingsStore.LoadAsync();
        ShopUrlTextBox.Text = string.IsNullOrWhiteSpace(_settings.ShopUrl) ? "http://localhost:3000" : _settings.ShopUrl;

        if (!string.IsNullOrWhiteSpace(_settings.DeviceToken))
        {
            _cursor = _settings.Cursor;
            await StartConnectedAsync();
        }
    }

    private async void ConnectButton_Click(object sender, RoutedEventArgs e)
    {
        ConnectButton.IsEnabled = false;
        StatusTextBlock.Text = "Verbindung wird hergestellt …";
        try
        {
            var shopUrl = NormalizeShopUrl(ShopUrlTextBox.Text);
            var code = PairingCodeTextBox.Text.Trim();
            if (code.Length < 12)
            {
                throw new InvalidOperationException("Bitte zuerst einen gültigen Pairing-Code eingeben.");
            }

            // PostAsJsonAsync kennt die Body-Länge nicht und sendet deshalb
            // chunked. Ein Worker-Laufzeitsystem beantwortet einen Body ohne
            // Längenangabe mit 411 — die Kopplung gegen `npm run dev` schlug
            // genau daran fehl. StringContent setzt content-length, wie im
            // AssistantConversationService auch.
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{shopUrl}/api/avatar/device/claim")
            {
                Content = new StringContent(JsonSerializer.Serialize(new { code }), Encoding.UTF8, "application/json"),
            };
            using var timeout = new CancellationTokenSource(ShopRequestTimeout);
            using var response = await _httpClient.SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException(await ReadApiErrorAsync(response));
            }

            var claim = await response.Content.ReadFromJsonAsync<DeviceClaimResponse>(_jsonOptions)
                ?? throw new InvalidOperationException("Die Antwort des Shops war leer.");
            if (string.IsNullOrWhiteSpace(claim.DeviceToken))
            {
                throw new InvalidOperationException("Der Shop hat kein Geräte-Token zurückgegeben.");
            }

            _settings = new AvatarSettings { ShopUrl = shopUrl, DeviceToken = claim.DeviceToken, ExpiresAt = claim.ExpiresAt };
            _cursor = null;
            await SettingsStore.SaveAsync(_settings);
            await StartConnectedAsync();
        }
        catch (OperationCanceledException)
        {
            StatusTextBlock.Text = $"Der Shop hat innerhalb von {ShopRequestTimeout.TotalSeconds:0} Sekunden nicht geantwortet. Bitte Adresse prüfen und erneut versuchen.";
        }
        catch (Exception ex)
        {
            StatusTextBlock.Text = DesktopErrorMessages.Describe(ex);
        }
        finally
        {
            ConnectButton.IsEnabled = true;
        }
    }

    private async Task StartConnectedAsync()
    {
        EnterPetMode();
        await PollEventsAsync();
        if (_petOverlay is not null)
        {
            _pollTimer.Start();
        }
    }

    private async void PollTimer_Tick(object? sender, object e) => await PollEventsAsync();

    private async Task PollEventsAsync()
    {
        if (_polling || string.IsNullOrWhiteSpace(_settings.DeviceToken)) return;
        _polling = true;
        try
        {
            var shopUrl = NormalizeShopUrl(_settings.ShopUrl);
            var query = new List<string>();
            if (_cursor is not null)
            {
                query.Add($"since={Uri.EscapeDataString(_cursor.Since)}");
                query.Add($"afterId={Uri.EscapeDataString(_cursor.AfterId)}");
            }

            var eventsUrl = $"{shopUrl}/api/avatar/device/events";
            if (query.Count > 0) eventsUrl += $"?{string.Join("&", query)}";
            using var request = new HttpRequestMessage(HttpMethod.Get, eventsUrl);
            request.Headers.Authorization = new("Bearer", _settings.DeviceToken);
            using var timeout = new CancellationTokenSource(ShopRequestTimeout);
            using var response = await _httpClient.SendAsync(request, timeout.Token);
            if (!response.IsSuccessStatusCode)
            {
                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    Disconnect("Die Desktop-Kopplung ist nicht mehr gültig. Bitte neu koppeln.");
                }
                else
                {
                    StatusTextBlock.Text = "Shop vorübergehend nicht erreichbar";
                }
                return;
            }

            var feed = await response.Content.ReadFromJsonAsync<DeviceEventsResponse>(_jsonOptions);
            if (feed is null) return;
            foreach (var avatarEvent in feed.Events)
            {
                if (Animations.TryGetValue(avatarEvent.EventType, out var animation))
                {
                    _animationQueue.Enqueue(new PendingAnimation(animation, avatarEvent));
                }
            }
            StartNextAnimationIfIdle();

            _cursor = feed.NextCursor;
            _settings.Cursor = _cursor;
            await SettingsStore.SaveAsync(_settings);
        }
        catch (OperationCanceledException)
        {
            // Der nächste Tick kommt in drei Sekunden; deshalb reicht hier ein
            // Hinweis ohne die englische Framework-Meldung.
            StatusTextBlock.Text = "Shop antwortet nicht; Verbindung wird erneut versucht …";
        }
        catch (Exception ex)
        {
            // Der nächste Tick kommt gleich wieder; deshalb steht hier der
            // Anlass in einem Satz und nicht die Framework-Meldung.
            StatusTextBlock.Text = $"Verbindung wird erneut versucht … {DesktopErrorMessages.Describe(ex)}";
        }
        finally
        {
            _polling = false;
        }
    }

    private void StartNextAnimationIfIdle()
    {
        if (_animationTimer.IsEnabled || _animationQueue.Count == 0) return;
        var next = _animationQueue.Dequeue();
        _currentAnimation = next.Animation;
        _frameIndex = 0;
        ApplyFrame();
        _animationTimer.Interval = TimeSpan.FromMilliseconds(Math.Max(90, next.Animation.Duration.TotalMilliseconds / next.Animation.FrameCount));
        _animationTimer.Start();
    }

    private void AnimationTimer_Tick(object? sender, object e)
    {
        _frameIndex++;
        if (_frameIndex >= _currentAnimation.FrameCount)
        {
            _animationTimer.Stop();
            _currentAnimation = AnimationSpec.Idle;
            _frameIndex = 0;
            StartNextAnimationIfIdle();
        }
        ApplyFrame();
    }

    private void IdleTimer_Tick(object? sender, object e)
    {
        if (_animationTimer.IsEnabled || _animationQueue.Count > 0) return;
        _currentAnimation = AnimationSpec.Idle;
        _frameIndex = (_frameIndex + 1) % _currentAnimation.FrameCount;
        ApplyFrame();
    }

    private void ApplyFrame()
    {
        Canvas.SetLeft(SpriteImage, -_frameIndex * FrameWidth);
        Canvas.SetTop(SpriteImage, -_currentAnimation.Row * FrameHeight);
        _petOverlay?.SetFrame(_currentAnimation.Row, _frameIndex);
    }

    private void ChangeConnectionButton_Click(object sender, RoutedEventArgs e)
    {
        Disconnect("Bitte einen neuen Pairing-Code eingeben.", clearToken: true);
    }

    private void LauncherButton_Click(object sender, RoutedEventArgs e) => SetAssistantPanelExpanded(!_assistantPanelExpanded);

    private void CloseAssistantButton_Click(object sender, RoutedEventArgs e) => SetAssistantPanelExpanded(false);

    private void Page_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == VirtualKey.Escape && _assistantPanelExpanded)
        {
            SetAssistantPanelExpanded(false);
            e.Handled = true;
        }
    }

    private async void SendAssistantButton_Click(object sender, RoutedEventArgs e) => await SendTypedMessageAsync();

    /// <summary>
    /// Eingabetaste sendet, Alt+Eingabetaste bricht die Zeile um.
    ///
    /// **`PreviewKeyDown`, nicht `KeyDown`.** Das Feld nimmt Zeilenumbrüche an
    /// (`AcceptsReturn`), und die TextBox verarbeitet die Eingabetaste selbst.
    /// Ein bubbelnder Handler käme erst danach an die Reihe — die Zeile wäre
    /// dann schon eingefügt und ließe sich nur noch nachträglich entfernen.
    /// Die tunnelnde Fassung kommt vorher dran und kann das unterbinden.
    ///
    /// `e.KeyStatus.IsMenuKeyDown` ist die Alt-Taste. Sie hier abzufragen ist
    /// verlässlicher als ein späterer Blick auf den Tastaturzustand, denn sie
    /// beschreibt die Lage **zum Zeitpunkt dieses Anschlags**.
    /// </summary>
    private async void AssistantInputTextBox_PreviewKeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key != VirtualKey.Enter) return;

        // In beiden Zweigen behandelt: Sonst fügte die TextBox zusätzlich zu
        // dem, was hier geschieht, noch ihren eigenen Umbruch ein.
        e.Handled = true;

        if (e.KeyStatus.IsMenuKeyDown)
        {
            InsertNewlineAtCaret();
            return;
        }

        await SendTypedMessageAsync();
    }

    /// <summary>
    /// Setzt den Umbruch selbst, weil das unterdrückte Standardverhalten ihn
    /// nicht mehr erzeugt. Eine markierte Auswahl wird dabei ersetzt, wie man
    /// es von jedem Textfeld erwartet.
    ///
    /// WinUI führt Zeilenumbrüche in `TextBox.Text` als `\r`; ein `\n` würde
    /// hier zwar angezeigt, käme beim Auslesen aber anders zurück.
    /// </summary>
    private void InsertNewlineAtCaret()
    {
        var start = AssistantInputTextBox.SelectionStart;
        var laenge = AssistantInputTextBox.SelectionLength;
        var text = AssistantInputTextBox.Text;

        // `MaxLength` gilt für getippte Zeichen, nicht für gesetzten Text --
        // ohne diese Prüfung ließe sich die Grenze mit Umbrüchen überschreiten.
        if (text.Length - laenge >= AssistantInputTextBox.MaxLength) return;

        AssistantInputTextBox.Text = text.Remove(start, laenge).Insert(start, "\r");
        AssistantInputTextBox.SelectionStart = start + 1;
        AssistantInputTextBox.SelectionLength = 0;
    }

    private async Task SendTypedMessageAsync()
    {
        if (_assistantRequestRunning || _speechRecognitionRunning) return;

        var message = AssistantInputTextBox.Text.Trim();
        if (message.Length == 0)
        {
            AssistantStatusTextBlock.Text = "Bitte gib zuerst eine Nachricht ein.";
            AssistantInputTextBox.Focus(FocusState.Programmatic);
            return;
        }

        AssistantInputTextBox.Text = string.Empty;
        await SendAssistantMessageAsync(message);
    }

    private async void DictateAssistantButton_Click(object sender, RoutedEventArgs e)
    {
        if (_assistantRequestRunning || _speechRecognitionRunning) return;

        SetSpeechRecognitionBusy(true);
        try
        {
            // Fragemuster und Sprachtoken holen, bevor das Mikrofon aufgeht --
            // danach kostet das Diktat keine zusätzliche Wartezeit.
            var phrases = await EnsureSpeechPhrasesAsync();
            var outcome = await EnsureSpeechTokenAsync();
            var grant = outcome.Grant;

            // **Die Entscheidung fällt vor dem Zuhören, nicht danach.** Ein
            // Rückfall nach einer gescheiterten Online-Erkennung nützte nichts:
            // Das Gesagte ist dann bereits verklungen und müsste ohnehin
            // wiederholt werden.
            AssistantStatusTextBlock.Text = grant is null
                ? LokaleErkennungStatus(outcome.Reason)
                : "Hört zu …";
            var transcription = grant is null
                ? await _speechRecognitionService.TranscribeOnceAsync(phrases)
                : await _onlineSpeechRecognitionService.TranscribeOnceAsync(grant.Value, phrases);
            if (!transcription.Succeeded)
            {
                AssistantStatusTextBlock.Text = transcription.StatusMessage;
                return;
            }

            var message = transcription.Text!;
            AssistantStatusTextBlock.Text = "Diktat erkannt; Lesarten werden geprüft …";
            var better = await ResolveDictatedReadingAsync(transcription.Readings);
            var corrected = better is not null && !string.Equals(better, message, StringComparison.Ordinal);
            if (corrected) message = better!;

            AssistantInputTextBox.Text = message;
            AssistantStatusTextBlock.Text = corrected
                // Die Ansage nennt die Korrektur, weil der Nutzer sonst nur
                // wahrnimmt, dass etwas anderes im Feld steht, als er gesagt hat.
                ? "Eine spätere Lesart des Diktats passte besser und wird verwendet."
                : "Diktat erkannt; Frage wird an den Assistant übergeben …";
            message = AssistantInputTextBox.Text.Trim();
            AssistantInputTextBox.Text = string.Empty;
            await SendAssistantMessageAsync(message);
        }
        finally
        {
            SetSpeechRecognitionBusy(false);
            AssistantInputTextBox.Focus(FocusState.Programmatic);
        }
    }

    /// <summary>
    /// Besorgt ein gültiges Token für die Online-Spracherkennung.
    ///
    /// Das Token wird wiederverwendet, solange es gilt — ein Aufruf je Diktat
    /// wäre gegen die Ratenbegrenzung verschwenderisch, die sich Prüfroute und
    /// Frage ohnehin teilen. Erneuert wird mit dem Vorlauf, den der Shop
    /// mitgibt, damit es nicht mitten in einer Aufnahme reißt.
    ///
    /// <c>null</c> heißt: lokal weitermachen. Kein Netz, keine Kopplung oder
    /// eine serverseitig nicht eingerichtete Spracherkennung sind allesamt
    /// Gründe, die den Knopf nicht unbrauchbar machen dürfen.
    /// </summary>
    private async Task<SpeechTokenOutcome> EnsureSpeechTokenAsync()
    {
        if (_speechToken is not null && DateTimeOffset.UtcNow < _speechTokenValidUntil) return SpeechTokenOutcome.Granted(_speechToken.Value);
        if (string.IsNullOrWhiteSpace(_settings.DeviceToken)) return SpeechTokenOutcome.Failed("Gerät ist nicht gekoppelt");

        var outcome = await _assistantService.GetSpeechTokenAsync(NormalizeShopUrl(_settings.ShopUrl), _settings.DeviceToken);
        var grant = outcome.Grant;
        _speechToken = grant;
        // Eine unsinnige oder fehlende Angabe des Servers darf kein ewig
        // gültiges Token vortäuschen; 30 Sekunden sind die Untergrenze.
        _speechTokenValidUntil = grant is null
            ? DateTimeOffset.MinValue
            : DateTimeOffset.UtcNow.AddSeconds(Math.Max(30, grant.Value.ExpiresInSeconds));
        return outcome;
    }

    /// <summary>
    /// Die Statuszeile für ein Diktat auf der schwächeren Erkennung.
    ///
    /// **Der Grund gehört dazu.** Ohne ihn stand dort nur „lokale Erkennung",
    /// und aufgebrauchtes Guthaben (HTTP 401/403) war von der Tarifgrenze des
    /// kostenlosen Tarifs (HTTP 429) nicht zu unterscheiden — zwei völlig
    /// verschiedene Reparaturen. Gekürzt wird, weil die Statuszeile eine Zeile
    /// ist und keine Ablage für Fremdtexte.
    /// </summary>
    private static string LokaleErkennungStatus(string grund)
    {
        const string basis = "Windows hört zu … (lokale Erkennung, eingeschränkte Genauigkeit";
        if (string.IsNullOrWhiteSpace(grund)) return $"{basis})";
        var kurz = grund.Trim();
        if (kurz.Length > AssistantConversationService.MaxSpeechTokenReasonLength)
        {
            kurz = kurz[..AssistantConversationService.MaxSpeechTokenReasonLength] + "…";
        }
        return $"{basis} — {kurz})";
    }

    /// <summary>
    /// Holt die Fragemuster für die Spracherkennung einmal je Sitzung.
    ///
    /// Gescheiterte Versuche werden nicht gemerkt: Wer beim ersten Diktat
    /// offline war, soll beim zweiten die Grammatik bekommen. Ein Erfolg wird
    /// gemerkt, damit nicht jedes Diktat eine Anfrage kostet.
    /// </summary>
    private async Task<IReadOnlyList<string>?> EnsureSpeechPhrasesAsync()
    {
        if (_speechPhrases is not null) return _speechPhrases;
        if (string.IsNullOrWhiteSpace(_settings.DeviceToken)) return null;
        _speechPhrases = await _assistantService.GetSpeechPhrasesAsync(NormalizeShopUrl(_settings.ShopUrl), _settings.DeviceToken);
        return _speechPhrases;
    }

    /// <summary>
    /// Fragt den Shop, welche Lesart des Diktats zu einem Werkzeug führt.
    ///
    /// Die Zuordnungsregeln liegen serverseitig und bleiben dort — der Desktop
    /// baut sie nicht nach, sondern fragt. Bei einer einzigen Lesart, ohne
    /// Kopplung oder bei jedem Fehlschlag kommt <c>null</c> zurück, und der
    /// Aufrufer bleibt beim ersten Kandidaten.
    /// </summary>
    private async Task<string?> ResolveDictatedReadingAsync(IReadOnlyList<string> readings)
    {
        if (readings.Count < 2 || string.IsNullOrWhiteSpace(_settings.DeviceToken)) return null;
        return await _assistantService.SelectCandidateAsync(NormalizeShopUrl(_settings.ShopUrl), _settings.DeviceToken, readings);
    }

    private async Task SendAssistantMessageAsync(string message)
    {
        AddConversationMessage("Du", message, isUser: true);
        SetAssistantBusy(true);
        try
        {
            if (string.IsNullOrWhiteSpace(_settings.DeviceToken))
            {
                throw new InvalidOperationException("Der Assistant ist nicht gekoppelt. Bitte ändere die Verbindung und kopple das Gerät erneut.");
            }

            var shopUrl = NormalizeShopUrl(_settings.ShopUrl);
            // Das Thema geht mit: Ein serverseitig gezeichnetes Bild kann nicht
            // auf die Systemeinstellung reagieren, also muss die Oberfläche
            // sagen, gegen welche Fläche gezeichnet wird.
            var thema = ActualTheme == ElementTheme.Dark ? "dunkel" : "hell";
            var reply = await _assistantService.AskAsync(shopUrl, _settings.DeviceToken, message, thema);
            AddConversationMessage(AssistantName, reply.Text, isUser: false);
            AddConversationVisuals(reply.Visuals, message);
            // Eine Absage des Shops ist keine empfangene Antwort. Vorher stand
            // auch bei HTTP 503 „Antwort empfangen" in der Statuszeile.
            AssistantStatusTextBlock.Text = reply.Succeeded ? "Antwort empfangen" : "Shop meldet einen Fehler";
        }
        catch (OperationCanceledException)
        {
            // Die einzige Abbruchquelle ist der Zeitrahmen des HttpClient; die
            // Framework-Meldung dazu ist englisch und nennt eine Zahl, die der
            // Nutzer nicht einordnen kann.
            AddConversationMessage(
                AssistantName,
                $"Der Shop hat innerhalb von {AssistantConversationService.RequestTimeout.TotalSeconds:0} Sekunden nicht geantwortet. Die Frage wurde nicht beantwortet; bitte erneut stellen.",
                isUser: false);
            AssistantStatusTextBlock.Text = "Zeitüberschreitung";
        }
        catch (HttpRequestException ex)
        {
            AddConversationMessage(AssistantName, DesktopErrorMessages.Describe(ex), isUser: false);
            AssistantStatusTextBlock.Text = "Shop nicht erreichbar";
        }
        catch (Exception ex)
        {
            AddConversationMessage(AssistantName, DesktopErrorMessages.Describe(ex), isUser: false);
            AssistantStatusTextBlock.Text = "Anfrage fehlgeschlagen";
        }
        finally
        {
            SetAssistantBusy(false);
        }
    }

    private void SetAssistantPanelExpanded(bool expanded)
    {
        _assistantPanelExpanded = expanded;
        AssistantPanel.Visibility = expanded ? Visibility.Visible : Visibility.Collapsed;
        LauncherSubtitleTextBlock.Text = expanded ? "Textpanel geöffnet" : "Textpanel öffnen";
        LauncherChevronIcon.Glyph = expanded ? "\uE70E" : "\uE70D";
        AutomationProperties.SetName(LauncherButton, expanded ? "BrandyCards Assistant schließen" : "BrandyCards Assistant öffnen");
        // Die tatsächliche Lage des Pets mitgeben: Es ist verschiebbar, und ohne
        // sie springt dieses Fenster beim Öffnen oder Schließen an die Stelle
        // zurück, an der das Pet nur beim Start stand.
        ((App)Application.Current).MainWindow?.ConfigureLauncherWindow(expanded, _petOverlay?.CurrentPlacement());

        if (expanded)
        {
            EnsureConversationInitialized();
            AssistantInputTextBox.Focus(FocusState.Programmatic);
        }
        else
        {
            LauncherButton.Focus(FocusState.Programmatic);
        }
    }

    /// <summary>
    /// Wie viele Tage vor Ablauf der Kopplung gewarnt wird.
    ///
    /// Die Verbindung gilt 90 Tage (`claim/route.ts`). Ohne Vorwarnung verlangt
    /// die App am 90. Tag aus dem Nichts einen neuen Pairing-Code — dieselbe
    /// Sorte stiller Bruch wie eine ablaufende Cloud-Testversion. Sieben Tage
    /// sind reichlich Zeit für einen Handgriff, der zwei Minuten dauert, und
    /// selten genug, um nicht zum Hintergrundrauschen zu werden.
    /// </summary>
    private const int PairingExpiryWarningDays = 7;

    private void EnsureConversationInitialized()
    {
        if (_conversationInitialized) return;
        _conversationInitialized = true;
        AddConversationMessage(
            AssistantName,
            "Hallo! Stelle mir freie Fragen zu Verkäufen, Listings, Bestellungen, Preisvorschlägen, Bestand, Anfragen, eBay-Daten und Statistiken. Ich verwende dafür ausschließlich registrierte Lesewerkzeuge.",
            isUser: false);
        WarnIfPairingExpiresSoon();
    }

    /// <summary>
    /// Sagt es, solange man noch handeln kann.
    ///
    /// Der Zeitpunkt steht erst seit dem 2026-08-17 in den Einstellungen; bei
    /// einer älteren, noch gültigen Kopplung ist er <c>null</c>. Dann wird
    /// nichts behauptet — eine erfundene Frist wäre schlechter als keine.
    /// </summary>
    private void WarnIfPairingExpiresSoon()
    {
        if (_settings.ExpiresAt is not { } ablauf) return;

        var restTage = (ablauf - DateTimeOffset.UtcNow).TotalDays;
        if (restTage > PairingExpiryWarningDays) return;

        AddConversationMessage(
            AssistantName,
            restTage <= 0
                ? "Hinweis: Die Verbindung zu diesem Shop ist abgelaufen. Bitte über „Verbindung ändern\" einen neuen Pairing-Code aus dem Adminbereich eingeben."
                : $"Hinweis: Die Verbindung zu diesem Shop läuft in {Math.Ceiling(restTage):0} Tagen ab. Danach brauchst du über „Verbindung ändern\" einen neuen Pairing-Code aus dem Adminbereich.",
            isUser: false);
    }

    private void AddConversationMessage(string author, string message, bool isUser)
    {
        var text = new TextBlock
        {
            Text = message,
            Style = (Style)Application.Current.Resources["ConversationBodyTextStyle"],
        };
        var authorText = new TextBlock
        {
            Text = author,
            Style = (Style)Application.Current.Resources["ConversationAuthorTextStyle"],
        };
        var content = new StackPanel { Spacing = 3 };
        content.Children.Add(authorText);
        content.Children.Add(text);

        var messageBorder = new Border
        {
            Style = (Style)Application.Current.Resources[isUser ? "UserMessageBorderStyle" : "AssistantMessageBorderStyle"],
            MaxWidth = 420,
            HorizontalAlignment = isUser ? HorizontalAlignment.Right : HorizontalAlignment.Left,
            Child = content,
        };
        AutomationProperties.SetName(messageBorder, $"{author}: {message}");
        ConversationPanel.Children.Add(messageBorder);
        ConversationScrollViewer.UpdateLayout();
        ConversationScrollViewer.ChangeView(null, ConversationScrollViewer.ScrollableHeight, null);
    }

    /// <summary>
    /// Hängt die Statistikansicht unter die Antwort.
    ///
    /// **Kompakt**, weil das Panel rund 520 Punkte breit ist: Leitzahl,
    /// Diagramm, Hinweis und ein Knopf ins Vollbild. Kacheln und die vollständige
    /// Umschalterreihe würden hier gequetscht — im Screenshot vom 2026-08-17 war
    /// der letzte Knopf abgeschnitten.
    ///
    /// **Der Text bleibt darüber stehen.** Die Zahlen sind auch ohne Bild
    /// erreichbar, und für einen Screenreader ist der Antworttext die
    /// verlässlichere Quelle.
    /// </summary>
    private void AddConversationVisuals(IReadOnlyList<AssistantConversationService.AssistantVisual> bilder, string frage)
    {
        if (bilder.Count == 0) return;

        var inhalt = StatistikAnsicht.Baue(bilder, kompakt: true, () => ZeigeStatistikGross(bilder, frage));
        ConversationPanel.Children.Add(new Border
        {
            Style = (Style)Application.Current.Resources["AssistantMessageBorderStyle"],
            HorizontalAlignment = HorizontalAlignment.Stretch,
            Child = inhalt,
        });
        ConversationScrollViewer.UpdateLayout();
        ConversationScrollViewer.ChangeView(null, ConversationScrollViewer.ScrollableHeight, null);
    }

    /// <summary>
    /// Öffnet die Statistik in einem eigenen Fenster.
    ///
    /// Genau eines: Ein zweiter Klick holt das vorhandene nach vorn, statt
    /// Fenster zu stapeln.
    /// </summary>
    private void ZeigeStatistikGross(IReadOnlyList<AssistantConversationService.AssistantVisual> bilder, string frage)
    {
        _statistikFenster?.Close();
        _statistikFenster = new StatistikFenster(bilder, ActualTheme, HoleZeitraum);
        async Task<IReadOnlyList<AssistantConversationService.AssistantVisual>> HoleZeitraum(int tage)
        {
            if (string.IsNullOrWhiteSpace(_settings.DeviceToken)) return [];
            var antwort = await _assistantService.AskAsync(
                NormalizeShopUrl(_settings.ShopUrl), _settings.DeviceToken, frage,
                ActualTheme == ElementTheme.Dark ? "dunkel" : "hell", tage);
            return antwort.Visuals;
        }
        _statistikFenster.Closed += (_, _) => _statistikFenster = null;
        _statistikFenster.Activate();
    }

    private void SetAssistantBusy(bool isBusy)
    {
        _assistantRequestRunning = isBusy;
        AssistantProgressRing.IsActive = isBusy;
        AssistantProgressRing.Visibility = isBusy ? Visibility.Visible : Visibility.Collapsed;
        UpdateAssistantControlState();
        if (isBusy) AssistantStatusTextBlock.Text = "Assistant liest Daten …";
    }

    private void SetSpeechRecognitionBusy(bool isBusy)
    {
        _speechRecognitionRunning = isBusy;
        UpdateAssistantControlState();
    }

    private void UpdateAssistantControlState()
    {
        var isBusy = _assistantRequestRunning || _speechRecognitionRunning;
        AssistantInputTextBox.IsEnabled = !isBusy;
        DictateAssistantButton.IsEnabled = !isBusy;
        SendAssistantButton.IsEnabled = !isBusy;
    }

    private void Disconnect(string message, bool clearToken = true)
    {
        _pollTimer.Stop();
        _animationTimer.Stop();
        _idleTimer.Stop();
        _animationQueue.Clear();
        if (clearToken)
        {
            _settings.DeviceToken = null;
            _settings.Cursor = null;
            _ = SettingsStore.SaveAsync(_settings);
        }
        EnterSetupMode();
        StatusTextBlock.Text = message;
        PairingCodeTextBox.Text = string.Empty;
    }

    private void EnterSetupMode()
    {
        _petOverlay?.Hide();
        _assistantPanelExpanded = false;
        SetupSurface.Visibility = Visibility.Visible;
        ConnectedSurface.Visibility = Visibility.Collapsed;
        AvatarPanel.Visibility = Visibility.Collapsed;
        ((App)Application.Current).MainWindow?.ConfigureSetupWindow();
    }

    private void EnterPetMode()
    {
        SetupSurface.Visibility = Visibility.Collapsed;
        ConnectedSurface.Visibility = Visibility.Visible;
        AvatarPanel.Visibility = Visibility.Collapsed;
        _petOverlay ??= new NativePetOverlay(
            Path.Combine(AppContext.BaseDirectory, "Assets", "spritesheet.png"),
            () => _dispatcherQueue.TryEnqueue(() => Disconnect("Bitte erneut koppeln.", clearToken: true)));
        // Erst das Pet setzen, dann danebenstellen: Vor `Show()` liegt das
        // native Fenster noch bei 0/0, und die Lage wäre die linke obere Ecke.
        _petOverlay.Show();
        ((App)Application.Current).MainWindow?.ConfigureLauncherWindow(petPlacement: _petOverlay.CurrentPlacement());
        _idleTimer.Start();
    }

    /// <summary>
    /// Prüft die Shop-Adresse und **verlangt HTTPS**.
    ///
    /// Über diese Adresse geht das Gerätetoken in jeder Anfrage als
    /// `Authorization`-Kopfzeile hinaus. Unverschlüsselt wäre es für jeden
    /// mitlesbar, der auf dem Weg sitzt — und ein Tippfehler im Schema ist
    /// schnell passiert, während die Folge unsichtbar bleibt.
    ///
    /// **Loopback bleibt erlaubt**, sonst wäre die Entwicklung gegen
    /// `npm run dev` auf `http://localhost:3000` nicht mehr möglich; das ist der
    /// in der README beschriebene Weg. Dort verlässt nichts das Gerät.
    /// </summary>
    private static string NormalizeShopUrl(string value)
    {
        if (!Uri.TryCreate(value.Trim().TrimEnd('/'), UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new InvalidOperationException("Bitte eine gültige Shop-Adresse mit http:// oder https:// eingeben.");
        }
        if (uri.Scheme == Uri.UriSchemeHttp && !uri.IsLoopback)
        {
            throw new InvalidOperationException(
                $"Die Shop-Adresse muss https:// verwenden. Über „{uri.Host}\" würde das Geräte-Token unverschlüsselt übertragen. Nur localhost darf http:// benutzen.");
        }
        return uri.ToString().TrimEnd('/');
    }

    private static async Task<string> ReadApiErrorAsync(HttpResponseMessage response)
    {
        try
        {
            var error = await response.Content.ReadFromJsonAsync<ApiError>();
            return error?.Error ?? $"Shop antwortete mit {(int)response.StatusCode}.";
        }
        catch
        {
            return $"Shop antwortete mit {(int)response.StatusCode}.";
        }
    }

    private sealed class AvatarSettings
    {
        public string ShopUrl { get; set; } = "http://localhost:3000";

        /// <summary>
        /// **Nur noch für die Migration da.** Bis zum 2026-08-17 stand das
        /// Gerätetoken hier im Klartext auf der Platte. `SettingsStore` liest
        /// das Feld beim Laden noch, verschlüsselt den Wert und leert es wieder;
        /// geschrieben wird es nie erneut. Ohne diesen Weg müsste jede
        /// vorhandene Kopplung erneuert werden, nur weil die Ablage sicherer
        /// wurde.
        ///
        /// **Die Schreibweise ist keine Geschmacksfrage.** In den bestehenden
        /// Dateien steht `DeviceToken` mit großem D, und `JsonSerializer` liest
        /// ohne `PropertyNameCaseInsensitive` **case-sensitiv**. Ein
        /// kleingeschriebener Name hier hieße: Migration greift nicht, Token
        /// gilt als weg, Nutzer muss neu koppeln — und zwar stillschweigend.
        /// </summary>
        [JsonPropertyName("DeviceToken")]
        public string? LegacyDeviceToken { get; set; }

        /// <summary>
        /// Das Gerätetoken, mit DPAPI an das Windows-Benutzerkonto gebunden
        /// (Base64). Ein anderes Konto oder ein anderer Rechner kann es nicht
        /// entschlüsseln — genau das ist der Zweck.
        /// </summary>
        [JsonPropertyName("DeviceTokenProtected")]
        public string? ProtectedDeviceToken { get; set; }

        /// <summary>
        /// Wann die Kopplung endet, wie vom Shop beim Koppeln gemeldet. Wird
        /// gespeichert, damit die App **vorher** warnen kann: Ohne diesen Wert
        /// verlangte sie am 90. Tag ohne Ankündigung eine neue Kopplung.
        /// </summary>
        [JsonPropertyName("ExpiresAt")]
        public DateTimeOffset? ExpiresAt { get; set; }

        public DeviceCursor? Cursor { get; set; }

        /// <summary>Das entschlüsselte Token, oder <c>null</c>.</summary>
        [JsonIgnore]
        public string? DeviceToken { get; set; }
    }

    private sealed record DeviceClaimResponse(
        [property: JsonPropertyName("deviceToken")] string DeviceToken,
        [property: JsonPropertyName("expiresAt")] DateTimeOffset? ExpiresAt);
    private sealed record ApiError([property: JsonPropertyName("error")] string Error);

    private sealed class DeviceEventsResponse
    {
        [JsonPropertyName("events")]
        public List<AvatarEvent> Events { get; set; } = [];

        [JsonPropertyName("nextCursor")]
        public DeviceCursor NextCursor { get; set; } = new();
    }

    private sealed class DeviceCursor
    {
        [JsonPropertyName("since")]
        public string Since { get; set; } = DateTime.UtcNow.AddMinutes(-5).ToString("O");

        [JsonPropertyName("afterId")]
        public string AfterId { get; set; } = string.Empty;
    }

    private sealed class AvatarEvent
    {
        [JsonPropertyName("eventType")]
        public string EventType { get; set; } = string.Empty;

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }
    }

    private sealed record AnimationSpec(string Label, int Row, int FrameCount, double DurationSeconds)
    {
        public static AnimationSpec Idle { get; } = new("Warte auf Shop-Ereignisse …", 0, 6, 0);
        public TimeSpan Duration => TimeSpan.FromSeconds(DurationSeconds);
    }

    private sealed record PendingAnimation(AnimationSpec Animation, AvatarEvent Event);

    /// <summary>
    /// Die Einstellungen auf der Platte — mit dem Gerätetoken **nicht** im
    /// Klartext.
    ///
    /// Das Token berechtigt zum Lesen der Geschäftsdaten und seit dem
    /// 2026-08-17 zusätzlich dazu, Azure-Sprachtoken auf Kosten des Betreibers
    /// ausstellen zu lassen. Als lesbare Zeile in einer JSON-Datei im
    /// Benutzerprofil war das zu viel Vertrauen in die Umgebung.
    ///
    /// DPAPI bindet den Wert an das Windows-Benutzerkonto. Ein anderes Konto
    /// auf demselben Rechner kann ihn nicht entschlüsseln, eine kopierte Datei
    /// auf einem anderen Rechner ebenfalls nicht.
    /// </summary>
    private static class SettingsStore
    {
        private static readonly string DirectoryPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BrandyCards", "DesktopAvatar");
        private static readonly string FilePath = Path.Combine(DirectoryPath, "settings.json");

        /// <summary>
        /// Zusätzliche Entropie. Sie ist kein Geheimnis — sie bindet die
        /// Verschlüsselung an diesen Zweck, damit ein anderswo im Profil
        /// abgelegter DPAPI-Wert hier nicht verwendbar ist.
        /// </summary>
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("BrandyCards.DesktopAvatar.DeviceToken.v1");

        public static async Task<AvatarSettings> LoadAsync()
        {
            AvatarSettings settings;
            try
            {
                if (!File.Exists(FilePath)) return new AvatarSettings();
                await using var stream = File.OpenRead(FilePath);
                settings = await JsonSerializer.DeserializeAsync<AvatarSettings>(stream) ?? new AvatarSettings();
            }
            catch
            {
                return new AvatarSettings();
            }

            settings.DeviceToken = Unprotect(settings.ProtectedDeviceToken);

            // **Migration der Klartextablage, genau einmal.** Eine vorhandene
            // Kopplung soll die Härtung überleben; sie erneut einzurichten wäre
            // ein Preis, den der Betreiber für eine Verbesserung zahlen müsste.
            if (settings.DeviceToken is null && !string.IsNullOrWhiteSpace(settings.LegacyDeviceToken))
            {
                settings.DeviceToken = settings.LegacyDeviceToken.Trim();
                await SaveAsync(settings);
            }

            return settings;
        }

        public static async Task SaveAsync(AvatarSettings settings)
        {
            Directory.CreateDirectory(DirectoryPath);
            settings.ProtectedDeviceToken = Protect(settings.DeviceToken);
            // Der Klartext verschwindet aus der Datei, sobald einmal gespeichert
            // wurde -- sonst waere die Verschluesselung nur eine zweite Kopie.
            settings.LegacyDeviceToken = null;
            await File.WriteAllTextAsync(FilePath, JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true }));
        }

        private static string? Protect(string? token)
        {
            if (string.IsNullOrWhiteSpace(token)) return null;
            var geschuetzt = ProtectedData.Protect(Encoding.UTF8.GetBytes(token), Entropy, DataProtectionScope.CurrentUser);
            return Convert.ToBase64String(geschuetzt);
        }

        /// <summary>
        /// Entschlüsselt das Token, oder gibt <c>null</c> zurück.
        ///
        /// **Ein Fehlschlag ist hier der gewünschte Effekt, kein Defekt.** Eine
        /// Datei aus einem anderen Konto oder von einem anderen Rechner *soll*
        /// sich nicht entschlüsseln lassen. Die App gilt dann als nicht
        /// gekoppelt und fragt nach einem neuen Pairing-Code.
        /// </summary>
        private static string? Unprotect(string? geschuetzt)
        {
            if (string.IsNullOrWhiteSpace(geschuetzt)) return null;
            try
            {
                var klar = ProtectedData.Unprotect(Convert.FromBase64String(geschuetzt), Entropy, DataProtectionScope.CurrentUser);
                var token = Encoding.UTF8.GetString(klar);
                return string.IsNullOrWhiteSpace(token) ? null : token;
            }
            catch (Exception exception) when (exception is CryptographicException or FormatException)
            {
                return null;
            }
        }
    }
}
