<#
.SYNOPSIS
    Baut KARL als eine einzige, für sich lauffähige .exe und legt sie auf den Desktop.

.DESCRIPTION
    Ergebnis ist eine Datei ohne Begleitordner: .NET-Laufzeit, Windows App SDK und
    der Sprite-Atlas stecken darin. Ein Doppelklick startet den Assistenten, eine
    Konsole wird nicht gebraucht.

    Warum die Schalter so stehen:

    * `--self-contained` samt `WindowsAppSDKSelfContained` -- ohne beides müsste auf
      dem Rechner die passende .NET-Laufzeit *und* das Windows App SDK installiert
      sein. Genau das soll der Betreiber nicht mehr vorhalten müssen.
    * `PublishTrimmed=false` -- die Projektdatei stellt Release auf Trimmen. WinUI
      lädt XAML-Typen über Reflexion; der Trimmer sieht diese Verwendung nicht und
      entfernt sie. Das fällt erst beim Start auf, nicht beim Bauen.
    * `EnableMsixTooling=true` -- ohne das bricht `PublishSingleFile` im Windows App
      SDK ab ("requires EnableMsixTooling for embedded resources.pri generation").
      Ein MSIX-Paket entsteht dadurch nicht, `WindowsPackageType` bleibt `None`.
    * `PublishReadyToRun=false` -- vorkompilierter Code macht die Datei deutlich
      größer und den ersten Start nur wenig schneller.

.PARAMETER Destination
    Zielordner der fertigen Datei. Standard ist der Desktop des angemeldeten Kontos.

.PARAMETER Name
    Dateiname ohne Endung, gleichzeitig Assemblyname. Standard `KARL`.

.NOTES
    Der Name wird über `AssemblyName` gesetzt und die fertige Datei **nicht**
    umbenannt. Gemessen am 2026-08-17: Eine nachträglich von
    `BrandyCards.Desktop.exe` in `KARL.exe` umbenannte Einzeldatei startet nicht
    -- sie stirbt an einer Ausnahme in `Microsoft.UI.Xaml.dll` (0xc000027b,
    0x80004005 in `combase.dll`). Ursache: Die eingebettete `resources.pri` hält
    die XAML-Seiten unter einer Ressourcenkarte, die den Namen der Anwendung
    trägt; heißt die Datei anders, findet WinUI `MainWindow.xaml` nicht mehr.
    Unter dem Originalnamen lief dieselbe Datei einwandfrei.
#>
[CmdletBinding()]
param(
    [string]$Destination = [Environment]::GetFolderPath('Desktop'),
    [string]$Name = 'KARL'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repoRoot 'avatar\BrandyCards.Desktop\BrandyCards.Desktop.csproj'
$staging = Join-Path $env:TEMP "karl-single-file-publish"

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }

Write-Host "Baue $Name aus $project ..."

dotnet publish $project `
    -c Release `
    -r win-x64 `
    -p:Platform=x64 `
    -p:AssemblyName=$Name `
    --self-contained true `
    -p:WindowsAppSDKSelfContained=true `
    -p:WindowsPackageType=None `
    -p:EnableMsixTooling=true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:PublishTrimmed=false `
    -p:PublishReadyToRun=false `
    -o $staging

if ($LASTEXITCODE -ne 0) { throw "dotnet publish endete mit $LASTEXITCODE." }

$built = Join-Path $staging "$Name.exe"
if (-not (Test-Path $built)) { throw "Erwartete Datei fehlt: $built" }

$target = Join-Path $Destination "$Name.exe"

# Eine laufende KARL-Instanz hält ihre eigene Datei gesperrt; das Kopieren
# scheiterte dann mit einem Zugriffsfehler, dessen Grund nicht dabeisteht.
if (Test-Path $target) {
    $running = Get-Process -Name $Name -ErrorAction SilentlyContinue
    if ($running) {
        throw "$Name läuft gerade (PID $($running.Id -join ', ')). Bitte schließen und erneut ausführen."
    }
}

Copy-Item $built $target -Force

$size = [math]::Round((Get-Item $target).Length / 1MB, 1)
Write-Host "Fertig: $target ($size MB). Doppelklick startet KARL."
