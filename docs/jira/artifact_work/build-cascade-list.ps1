$ErrorActionPreference = 'Stop'

$jiraRoot = Split-Path -Parent $PSScriptRoot
$generatedDir = Join-Path $jiraRoot 'generated'
$outputPath = Join-Path $generatedDir 'brandycards-kaskadische-task-test-liste.txt'

$epicRows = @(Import-Csv (Join-Path $jiraRoot 'brandycards-epics.csv'))
$storyRows = @(Import-Csv (Join-Path $generatedDir 'brandycards-story-acceptance-criteria.csv'))
$taskRows = @(Import-Csv (Join-Path $generatedDir 'brandycards-detailed-tasks.csv'))
$testRows = @(Import-Csv (Join-Path $generatedDir 'brandycards-xray-tests.csv'))
$statusRows = @(Import-Csv (Join-Path $jiraRoot 'story-implementation-status.csv'))

# Xray-Ergebnisse sind optional: Die Liste muss sich auch ohne einen frischen
# Export erzeugen lassen. Fehlt die Datei, entfallen die Ergebniszeilen, statt
# dass der Lauf scheitert.
$xrayPath = Join-Path $jiraRoot 'xray-status-export.csv'
$xrayRows = if (Test-Path $xrayPath) { @(Import-Csv $xrayPath) } else { @() }

$lines = [System.Collections.Generic.List[string]]::new()

function Add-Line([string]$value = '') {
    [void]$script:lines.Add($value)
}

function Add-Block([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return
    }

    foreach ($line in ($value -split "`r?`n")) {
        Add-Line $line.TrimEnd()
    }
}

function Add-IndentedBlock([string]$value, [string]$prefix = '    ') {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return
    }

    foreach ($line in ($value -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            Add-Line ''
        } else {
            Add-Line ($prefix + $line.TrimEnd())
        }
    }
}

function Get-Paragraph([string]$text, [string]$heading) {
    $blocks = $text -split "`r?`n`r?`n"
    foreach ($block in $blocks) {
        if ($block -match ("(?ms)^" + [regex]::Escape($heading) + "`r?`n")) {
            return ($block -replace ("(?ms)^" + [regex]::Escape($heading) + "`r?`n"), '').Trim()
        }
    }

    return ''
}

function Get-Int([string]$value) {
    return [int]($value -replace '[^0-9]', '')
}

function Get-StoryCode([string]$summary) {
    $match = [regex]::Match($summary, '^(E\d+-\d+)')
    if ($match.Success) {
        return $match.Groups[1].Value
    }

    return $summary
}

function Get-StoryNumber([string]$code) {
    return [int]([regex]::Match($code, 'E\d+-(\d+)').Groups[1].Value)
}

function Get-EpicNumber([string]$code) {
    return [int]([regex]::Match($code, '^E(\d+)').Groups[1].Value)
}

function Get-TaskJiraKey([string]$workItemId) {
    return 'KAN-' + (Get-Int $workItemId - 299880)
}

function Get-TestJiraKey([string]$workItemId) {
    return 'KAN-' + (Get-Int $workItemId - 399436)
}

function Get-Stage([string]$code) {
    $number = Get-StoryNumber $code

    if ($code -in @('E7-01', 'E7-02', 'E8-01', 'E8-02') -or ($code -like 'E9-*' -and $number -le 4)) {
        return 0
    }
    if ($code -like 'E1-*') {
        return 1
    }
    if ($code -like 'E2-*') {
        return 2
    }
    if (($code -like 'E5-*' -and $number -le 3) -or ($code -like 'E3-*' -and $number -le 6)) {
        return 3
    }
    if ($code -like 'E5-*' -or $code -like 'E3-*' -or $code -like 'E4-*') {
        return 4
    }
    if ($code -like 'E6-*') {
        return 5
    }
    if ($code -like 'E7-*') {
        return 6
    }
    if ($code -like 'E8-*') {
        return 7
    }
    if ($code -like 'E9-*') {
        return 8
    }

    return 99
}

function Get-StageTitle([int]$stage) {
    switch ($stage) {
        0 { return 'Vorbedingungen: Security, Navigation, Design- und Testgrundlagen' }
        1 { return 'Katalogbasis: Karten, Stammdaten, Bilder, Preise und Bestand' }
        2 { return 'Entdeckung: Suche, Filter, Sortierung, Pagination und Details' }
        3 { return 'Kaufvorbereitung: Kundenkonto-Grundlagen, Warenkorb und Checkout-Basis' }
        4 { return 'Transaktion: Gast-/Konto-Bestellung, Zahlung, Reservierung und Versand' }
        5 { return 'Anbieter: Karten anbieten, Angebote prüfen und Auszahlung' }
        6 { return 'Betrieb: Admin-Dashboard, Bestellungen, Kunden, Synchronisation und Audit' }
        7 { return 'Erlebnis: Responsive, zugängliche und konsistente Shop-Oberflächen' }
        8 { return 'Abnahme: Test-Sets, Testpläne, Ausführung, Regression und Release-Gates' }
        default { return 'Nicht zugeordnete Kaskadenstufe' }
    }
}

function Get-StageReason([int]$stage) {
    switch ($stage) {
        0 { return 'Diese Elemente schaffen die Sicherheits-, Navigations-, Design- und Testbedingungen, auf denen alle weiteren Arbeiten aufbauen.' }
        1 { return 'Ohne konsistente Katalogdaten, Preise, Bilder und Bestände können Suche, Warenkorb, Checkout und Administration keine belastbare Quelle der Wahrheit verwenden.' }
        2 { return 'Die Kundensuche verwendet den zuvor aufgebauten Katalog und liefert die Einstiegspunkte für Produktdetail, Warenkorb und weitere Journeys.' }
        3 { return 'Konto-Grundlagen und Warenkorb-Zustände müssen stehen, bevor Checkout, Bestellstatus und Zahlungsflüsse Ende-zu-Ende geprüft werden.' }
        4 { return 'Die eigentliche Bestellung baut auf Warenkorb, Adress-/Versanddaten, Bestand und Preis auf; Zahlung und Fulfillment folgen deshalb danach.' }
        5 { return 'Anbieterfunktionen verwenden Katalog-, Benutzer- und später administrative Prüfprozesse.' }
        6 { return 'Der Shop-Betrieb verarbeitet die zuvor erzeugten Katalog-, Kunden-, Angebots- und Bestelldaten.' }
        7 { return 'Die UX-Abnahme wird gegen die realisierten Flows ausgeführt; Navigation und Designgrundlagen wurden bereits als Vorbedingung gesetzt.' }
        8 { return 'Xray-Ausführung, Regression und Release-Abnahme benötigen die implementierten und fachlich abgenommenen Funktionen.' }
        default { return 'Reihenfolge aus vorhandenen Parent-/Coverage-Beziehungen abgeleitet.' }
    }
}

function Get-StorySortRank([string]$code) {
    $stage = Get-Stage $code
    $epic = Get-EpicNumber $code
    $number = Get-StoryNumber $code

    if ($stage -eq 0) {
        if ($epic -eq 7) { return 0 * 10000 + $number }
        if ($epic -eq 8) { return 1000 + $number }
        return 2000 + $number
    }
    if ($stage -eq 3) {
        if ($epic -eq 5) { return 30000 + $number }
        return 31000 + $number
    }

    return ($stage * 10000) + ($epic * 100) + $number
}

function Get-Dependencies([string]$code) {
    $number = Get-StoryNumber $code
    $deps = [System.Collections.Generic.List[string]]::new()

    switch -Regex ($code) {
        '^E7-01$' { break }
        '^E7-02$' { [void]$deps.Add('E7-01'); break }
        '^E8-01$' { break }
        '^E8-02$' { [void]$deps.Add('E8-01'); break }
        '^E9-01$' { break }
        '^E9-02$' { [void]$deps.Add('E9-01'); break }
        '^E9-03$' { [void]$deps.Add('E9-02'); break }
        '^E9-04$' { [void]$deps.Add('E9-03'); break }
        '^E1-' {
            [void]$deps.Add('E7-01/E7-02')
            [void]$deps.Add('E8-01/E8-02')
            [void]$deps.Add('E9-01..E9-04')
            if ($number -gt 1) { [void]$deps.Add(('E1-{0:D2}' -f ($number - 1))) }
        }
        '^E2-' {
            [void]$deps.Add('E1-01..E1-11')
            if ($number -gt 1) { [void]$deps.Add(('E2-{0:D2}' -f ($number - 1))) }
        }
        '^E5-' {
            [void]$deps.Add('E7-01/E7-02')
            [void]$deps.Add('E9-01..E9-04')
            if ($number -gt 3) { [void]$deps.Add('E4-01..E4-12') }
            if ($number -gt 1) { [void]$deps.Add(('E5-{0:D2}' -f ($number - 1))) }
        }
        '^E3-' {
            [void]$deps.Add('E1-01..E1-11')
            [void]$deps.Add('E2-01/E2-10')
            if ($number -ge 8) { [void]$deps.Add('E5-01..E5-03') }
            if ($number -gt 1) { [void]$deps.Add(('E3-{0:D2}' -f ($number - 1))) }
        }
        '^E4-' {
            [void]$deps.Add('E3-01..E3-12')
            [void]$deps.Add('E1-08/E1-10')
            if ($number -gt 1) { [void]$deps.Add(('E4-{0:D2}' -f ($number - 1))) }
        }
        '^E6-' {
            [void]$deps.Add('E1-01/E1-06/E1-08')
            [void]$deps.Add('E7-01/E7-02')
            if ($number -gt 1) { [void]$deps.Add(('E6-{0:D2}' -f ($number - 1))) }
        }
        '^E7-' {
            [void]$deps.Add('E1-01..E1-11')
            [void]$deps.Add('E3-01..E3-12')
            [void]$deps.Add('E4-01..E4-12')
            [void]$deps.Add('E6-01..E6-12')
            if ($number -gt 3) { [void]$deps.Add(('E7-{0:D2}' -f ($number - 1))) }
            else { [void]$deps.Add('E7-01/E7-02') }
        }
        '^E8-' {
            [void]$deps.Add('E8-01/E8-02')
            [void]$deps.Add('E1-01..E4-12')
            if ($number -gt 3) { [void]$deps.Add(('E8-{0:D2}' -f ($number - 1))) }
        }
        '^E9-' {
            [void]$deps.Add('E1-01..E8-14')
            if ($number -gt 4) { [void]$deps.Add(('E9-{0:D2}' -f ($number - 1))) }
        }
    }

    if ($deps.Count -eq 0) {
        return 'keine fachliche Vorbedingung aus den Exportdaten; Startpunkt der Kaskade'
    }

    return ($deps -join ', ')
}

function Get-StatusLabel([string]$status) {
    switch ($status) {
        'VORHANDEN' { return 'VORHANDEN im Code' }
        'TEILWEISE' { return 'TEILWEISE vorhanden' }
        'OFFEN' { return 'OFFEN' }
        'AUSSERHALB_CODE' { return 'AUSSERHALB DES CODES (Jira-/Xray-Governance)' }
        default { return 'UNGEPRÜFT' }
    }
}

function Get-RemediationLead([string]$status) {
    switch ($status) {
        'VORHANDEN' {
            return 'Der Funktionsumfang ist im Code belegt. Die vier Tasks dienen hier als Nachweis- und Abnahmeraster, nicht als Neubau: prüfen, ob die Abnahmekriterien am vorhandenen Stand erfüllt sind, und nur die Lücken nacharbeiten.'
        }
        'TEILWEISE' {
            return 'Ein Teil der Funktion ist im Code belegt. Umzusetzen ist nur die oben genannte Lücke; der belegte Teil wird geprüft statt neu gebaut.'
        }
        'OFFEN' {
            return 'Für diese Story gibt es keinen Codebeleg. Die vier Tasks sind vollständig umzusetzen; vorher ist die oben genannte Abhängigkeit zu klären.'
        }
        'AUSSERHALB_CODE' {
            return 'Diese Story wird nicht im Repository umgesetzt, sondern in Jira und Xray. Der tatsächliche Stand ist dort zu prüfen; die Tasks beschreiben die Governance-Arbeit.'
        }
        default {
            return 'Der Umsetzungsstand dieser Story wurde nicht geprüft. Vor der Umsetzung ist er festzustellen.'
        }
    }
}

function Get-TestPrerequisiteText([string]$testType) {
    if ($testType -match 'Happy Path|Treffer|erfolgreich|Operation') {
        return 'Nach Abschluss der vier Story-Tasks; besonders Datenmodell, API/Geschäftslogik, UI und QS/Beobachtung.'
    }
    if ($testType -match 'Negative|Fehler|Grenzwerte|Keine Treffer') {
        return 'Nach Datenmodell- und API-Task; UI-Validierung und Fehlermeldungen müssen reproduzierbar sein.'
    }
    if ($testType -match 'Responsive|Accessibility|Tastatur|Fokus|Screenreader|Bilder') {
        return 'Nach dem UI-Task und dem QS-/Betriebs-Task; die sieben vereinbarten CSS-Viewports und Accessibility-Nachweise sind Pflicht.'
    }
    if ($testType -match 'Berechtigung|Betrieb|Security|Sicherheit|Audit') {
        return 'Nach API-/Geschäftslogik- und QS-/Betriebs-Task; Rollen, direkte Endpunkte, Fehlerwiederaufnahme und Logs müssen vorhanden sein.'
    }
    if ($testType -match 'Test|Regression|Release|Abnahme') {
        return 'Nach den vier Story-Tasks sowie der Xray-Governance bis zur jeweils erforderlichen Stufe.'
    }
    return 'Nach Abschluss der vier Story-Tasks und vorbereiteten Testdaten.'
}

function Get-TestType([string]$text) {
    $match = [regex]::Match($text, '(?m)^Testart:\s*(.+)$')
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }
    return 'nicht angegeben'
}

function Get-TaskPhaseLabel([string]$summary) {
    $suffix = ($summary -replace '^E\d+-\d+ [^–]+ – ', '')
    if ($suffix -match 'Datenmodell|Sicherheitsmodell|Authentifizierung|Verk[aä]uferdom[aä]ne|Warenkorb- und Checkout-Zustand|Bestell- und Zahlungszustandsmaschine|Xray-Repository|Designsystem') {
        return '1/4 Fundament, Domäne und Regeln'
    }
    if ($suffix -match 'API und Geschäftslogik|Such- und Abfragepfad|Validierung, Nebenläufigkeit|Zahlungsintegration|Synchronisation, Fehlerpfade|Prüfung, Verhandlung und Übergabe|Einreichungs- und Upload-Workflow|Traceability und Testplanung') {
        return '2/4 Geschäftslogik, Schnittstellen und Workflow'
    }
    if ($suffix -match 'Oberfl|Detailkomponenten|Responsive') {
        return '3/4 Oberfläche, Nutzerführung und responsive Umsetzung'
    }
    if ($suffix -match 'Tests|Monitoring|Regression|Lebenszyklus|Performance|Fehlerdiagnose|Ausführung, Evidenz|Berechtigungs-, Abrechnungs|Administrations- und Berechtigung') {
        return '4/4 Qualitätssicherung, Betrieb und Abnahme'
    }
    return '4/4 projektspezifischer Abschluss'
}

$epicKeyByWorkItem = @{}
$epicNameByKey = @{}
for ($index = 0; $index -lt $epicRows.Count; $index++) {
    $epicKey = 'KAN-' + ($index + 1)
    $epicKeyByWorkItem[$epicRows[$index].'Work item ID'] = $epicKey
    $epicNameByKey[$epicKey] = $epicRows[$index].Summary
}

$stories = @($storyRows | ForEach-Object {
    [pscustomobject]@{
        Key = $_.'Issue Key'
        Code = Get-StoryCode $_.Summary
        Summary = $_.Summary
        Description = $_.Description
        Priority = $_.Priority
        EpicKey = $_.Epic
        EpicName = $epicNameByKey[$_.Epic]
    }
})

$tasks = @()
for ($taskIndex = 0; $taskIndex -lt $taskRows.Count; $taskIndex++) {
    $row = $taskRows[$taskIndex]
    $storyKey = $row.Parent
    $story = $stories | Where-Object Key -eq $storyKey | Select-Object -First 1
    $tasks += [pscustomobject]@{
        Key = 'KAN-' + (121 + $taskIndex)
        WorkItemId = $row.'Work item ID'
        Summary = $row.Summary
        Description = $row.Description
        Parent = $storyKey
        StoryCode = if ($story) { $story.Code } else { '' }
        StorySummary = if ($story) { $story.Summary } else { '' }
        Stage = if ($story) { Get-Stage $story.Code } else { 99 }
    }
}

$tests = @()
for ($testIndex = 0; $testIndex -lt $testRows.Count; $testIndex++) {
    $row = $testRows[$testIndex]
    $storyKey = $row.Tests
    $story = $stories | Where-Object Key -eq $storyKey | Select-Object -First 1
    $tests += [pscustomobject]@{
        Key = 'KAN-' + (565 + $testIndex)
        WorkItemId = $row.'Work item ID'
        Summary = $row.Summary
        Description = $row.Description
        Covers = $storyKey
        StoryCode = if ($story) { $story.Code } else { '' }
        StorySummary = if ($story) { $story.Summary } else { '' }
        Stage = if ($story) { Get-Stage $story.Code } else { 99 }
    }
}

$storyByKey = @{}
foreach ($story in $stories) {
    $storyByKey[$story.Key] = $story
}

# Der Umsetzungsstand ist eine gepflegte Datenquelle, keine Ableitung zur Laufzeit.
# Fehlt eine Story darin, bricht der Lauf ab: ein stillschweigend leerer Status
# würde als „nichts bekannt“ gelesen, obwohl er nur vergessen wurde.
$statusByStory = @{}
foreach ($statusRow in $statusRows) {
    $statusByStory[$statusRow.'Issue Key'] = $statusRow
}
$xrayByTest = @{}
foreach ($xrayRow in $xrayRows) {
    $xrayByTest[$xrayRow.'Issue Key'] = $xrayRow
}

$missingStatus = @($stories | Where-Object { -not $statusByStory.ContainsKey($_.Key) })
if ($missingStatus.Count -gt 0) {
    throw ('Kein Umsetzungsstand hinterlegt für: {0}. Bitte story-implementation-status.csv ergänzen.' -f (($missingStatus | ForEach-Object { $_.Key }) -join ', '))
}

$taskByStory = @{}
foreach ($task in $tasks) {
    if (-not $taskByStory.ContainsKey($task.Parent)) { $taskByStory[$task.Parent] = [System.Collections.Generic.List[object]]::new() }
    [void]$taskByStory[$task.Parent].Add($task)
}

$testByStory = @{}
foreach ($test in $tests) {
    if (-not $testByStory.ContainsKey($test.Covers)) { $testByStory[$test.Covers] = [System.Collections.Generic.List[object]]::new() }
    [void]$testByStory[$test.Covers].Add($test)
}

Add-Line 'BRANDYCARDS WEBSHOP – KASKADISCHE GESAMTLISTE VON TASKS UND XRAY-TESTS'
Add-Line 'Erstellt: 2026-08-15'
Add-Line 'Quelle: lokale Jira-/Xray-Importdaten im Repository; Jira-Schlüssel aus den bestätigten Importbereichen abgeleitet.'
Add-Line ''
Add-Line 'ZWECK UND LESART'
Add-Line 'Diese Datei enthält alle 444 Jira-Tasks und alle 333 Xray-Testfälle in einer empfohlenen Ausführungsreihenfolge.'
Add-Line 'Die Reihenfolge ist kaskadierend: erst Vorbedingungen, dann Datenmodell und Geschäftslogik, danach Oberflächen, anschließend QS und Tests.'
Add-Line 'Die echte Jira-Beziehung ist jeweils explizit ausgewiesen: Task -> Parent-Story; Xray-Test -> abgedeckte Story.'
Add-Line 'Die fachlichen Querabhängigkeiten und Phasen sind Empfehlungen aus den Story-Inhalten. Sie sind keine zusätzlich in Jira gespeicherten Blocks-Links.'
Add-Line 'Wenn eine Abhängigkeit als Bereich angegeben ist (z. B. E1-01..E1-11), bedeutet das: alle Stories dieses Bereichs sind als fachliche Grundlage einzuplanen.'
Add-Line ''
Add-Line 'VOLLSTÄNDIGKEIT'
Add-Line '- Epics: 9 (KAN-1 bis KAN-9)'
Add-Line '- Stories: 111 (KAN-10 bis KAN-120)'
Add-Line '- Tasks: 444 (KAN-121 bis KAN-564), vier Tasks je Story'
Add-Line '- Xray-Tests: 333 (KAN-565 bis KAN-897), drei Tests je Story'
Add-Line '- Jeder UI-Test enthält die Viewports 1440x900, 1920x1080, 2560x1440, 3440x1440, 3840x2160, 768x1024 und 390x844 CSS-Pixel sowie die Screenshotpflicht je Testschritt.'
Add-Line '- Die Import-CSV enthält keine aktuellen Jira-Ausführungsstatuswerte; diese Datei beschreibt die empfohlene Kaskade und ersetzt keine Live-Statusprüfung in Jira.'
Add-Line ''
Add-Line 'STANDARD-KASKADE INNERHALB JEDER STORY'
Add-Line '1. Datenmodell und Fachregeln: Quelle der Wahrheit, Pflichtfelder, Wertebereiche, Eindeutigkeiten, Migrationen.'
Add-Line '2. API und Geschäftslogik: Use Cases, Autorisierung, Transaktionen, Fehlercodes und idempotente Verarbeitung.'
Add-Line '3. Admin- und Shop-Oberfläche: Formulare, Listen, Details, Lade-/Fehlerzustände und responsive Darstellung.'
Add-Line '4. Qualitätssicherung und Betriebsbeobachtung: Unit-/Integrations-/UI-Tests, Telemetrie, Logs und Korrelation.'
Add-Line '5. Xray-Testausführung: Happy Path, negative/Grenzwertfälle sowie Berechtigungs-, Betriebs-, Responsive- oder Accessibility-Fälle.'
Add-Line 'Ein Test darf erst als vollständige Abnahme gelten, wenn seine vier Story-Tasks abgeschlossen, Testdaten vorbereitet und die geforderten Screenshots je Schritt hinterlegt sind.'
Add-Line ''
Add-Line 'UMSETZUNGSSTAND JE STORY'
Add-Line 'Jede Story trägt einen Vermerk, ob die Funktion im Code dieses Repositorys nachweisbar ist. Er stammt aus story-implementation-status.csv und nennt je Story die Datei, aus der er abgeleitet ist.'
Add-Line '- VORHANDEN im Code: Es gibt einen konkreten Codebeleg. Die Story ist damit umgesetzt, aber nicht fachlich abgenommen.'
Add-Line '- TEILWEISE vorhanden: Ein Teil ist belegt; die fehlende Hälfte steht als „Lücke“ ausdrücklich dabei.'
Add-Line '- OFFEN: Es gibt keinen Codebeleg. Wo der Grund eine fehlende Grundlage ist (z. B. nicht modellierte Kartenattribute), ist die Abhängigkeit genannt.'
Add-Line '- AUSSERHALB DES CODES: Governance-Arbeit in Jira und Xray; der Stand steht dort und nicht im Repository.'
Add-Line 'Wichtig: Der Vermerk ist eine Einschätzung aus Codebelegen, keine Abnahme. „VORHANDEN“ heißt, dass die Funktion existiert — nicht, dass ihr Xray-Test bestanden wurde.'
$statusCounts = $statusRows | Group-Object Status | Sort-Object Name
Add-Line ('Verteilung über alle 111 Stories: ' + (($statusCounts | ForEach-Object { '{0}: {1}' -f (Get-StatusLabel $_.Name), $_.Count }) -join '; ') + '.')
Add-Line ''
Add-Line 'IST-STATUS IN JIRA — MOMENTAUFNAHME VOM 2026-08-15'
Add-Line 'Über die Jira-REST-API aus brandycards.atlassian.net gelesen. Anders als der Umsetzungsstand, der aus dem Repository stammt und mit ihm mitwandert, ist dieser Abschnitt ein Stichtagswert und veraltet, sobald jemand in Jira etwas bewegt.'
Add-Line '- Der Jira-Vorgangsstatus aller 333 Testvorgänge lautet „Zu erledigen" (Statuskategorie „To Do"). Keiner ist „In Arbeit" oder „Fertig".'
Add-Line '- 331 der 333 Testvorgänge tragen Anhänge; ohne Anhang sind KAN-724 (E5-06) und KAN-835 (E8-08).'
Add-Line '- Testplan KAN-898, Testausführung KAN-899 und Test Set KAN-1358 sind vorhanden.'
Add-Line 'Der Jira-Vorgangsstatus ist NICHT das Testergebnis. Xray Cloud führt Ergebnisse in seinem eigenen Speicher; sie wurden separat über die Xray-GraphQL-API geholt und stehen im folgenden Abschnitt.'
if ($xrayRows.Count -gt 0) {
    Add-Line ''
    Add-Line 'XRAY-TESTERGEBNISSE — MOMENTAUFNAHME VOM 2026-08-15'
    Add-Line 'Quelle: xray-status-export.csv, erzeugt von artifact_work/fetch-xray-status.mjs über die Xray-GraphQL-API. Je Test ist das Ergebnis zusätzlich unten am Testeintrag vermerkt.'
    $ergebnisGruppen = $xrayRows | Group-Object 'Xray Status' | Sort-Object Count -Descending
    Add-Line ('Gesamt: ' + $xrayRows.Count + ' Tests — ' + (($ergebnisGruppen | ForEach-Object { '{0}: {1}' -f $_.Name, $_.Count }) -join '; ') + '.')
    Add-Line ''
    Add-Line 'Kreuztabelle Umsetzungsstand (Zeile) gegen Xray-Ergebnis (Spalte):'
    Add-Line '                     PASSED   FAILED  EXECUTING    Summe'
    Add-Line '  VORHANDEN             127       62          0      189'
    Add-Line '  TEILWEISE              37       19          1       57'
    Add-Line '  OFFEN                  31       17          0       48'
    Add-Line '  AUSSERHALB_CODE        25       14          0       39'
    Add-Line '  Summe                 220      112          1      333'
    Add-Line ''
    Add-Line 'DIESE ZAHLEN MESSEN NICHT DIE ANWENDUNG. Der Grund ist geprüft und eindeutig:'
    Add-Line 'Die 333 Testfälle teilen sich insgesamt nur 27 verschiedene Schritt- und Ergebnistexte — genau einen je Testart. Story-spezifisch ist allein der Titel. Alle Tests der Art „Treffer und Navigation" haben denselben Wortlaut, gleich ob sie über E2-01 Karten suchen, E2-02 Suchvorschläge erhalten oder E2-03 Nach Sportart filtern stehen.'
    Add-Line 'Beispiel KAN-601, Titel „E2-02 Suchvorschläge erhalten": Die Schritte lauten Produktdaten vorbereiten, Such- oder Filterkriterien eingeben, Sortierung und Pagination verwenden, Detailansicht öffnen und zurück navigieren. Kein Schritt prüft eine Vorschlagsliste. Das PASS ist deshalb ehrlich — es belegt, dass Suche, Blättern und Detailansicht funktionieren, und sagt über Suchvorschläge nichts aus.'
    Add-Line 'Daraus erklären sich alle Auffälligkeiten der Tabelle: die überall gleiche Bestehensquote, die 31 bestandenen Tests zu Stories ohne Codebeleg und die Fehler, die geschlossen nach Testart auftreten statt nach Funktion (Accessibility und Auflösung 14 von 14, Responsive und Accessibility 13 von 13, Synchronisation und Fehler 13 von 13, Datenschutz und Berechtigung 10 von 10). Identischer Test, identisches Ergebnis.'
    Add-Line 'Weder der Umsetzungsstand noch die Testergebnisse sind also falsch. Die Tests prüfen nur nicht das, was ihr Titel verspricht. Ein Ergebnis darf deshalb NICHT als Abnahme der benannten Story gelesen werden; es gilt jeweils nur für den generischen Ablauf der Testart. Was daraus folgt, steht als Punkt X in docs/ai-todo.md.'
}
Add-Line ''
Add-Line 'MASSNAHMENPLAN FÜR EIN POSITIVES TESTERGEBNIS'
Add-Line '0. Zuerst den Umsetzungsstand der Story lesen. Ist er VORHANDEN, wird geprüft statt gebaut; ist er TEILWEISE, wird nur die genannte Lücke bearbeitet. Das verhindert, dass fertige Funktionen erneut umgesetzt werden.'
Add-Line '1. Mensch oder KI setzt die noch offenen der vier Tasks der abgedeckten Story in der angegebenen Reihenfolge um; die konkreten Änderungen stehen je Story unter „Umsetzungs- und Remediationauftrag“.'
Add-Line '2. Nach jeder Task-Umsetzung werden Ziel und „Erledigt wenn“-Kriterien gegen Code, Konfiguration, Daten, Rollen und UI geprüft; offene Abweichungen werden als Bug oder Folge-Task dokumentiert.'
Add-Line '3. Vor der Xray-Ausführung werden die genannten Testdaten, Benutzerrollen, Umgebungen und Integrationen reproduzierbar vorbereitet.'
Add-Line '4. Der Test wird vollständig ausgeführt. Jeder Schritt erhält ein tatsächliches Ergebnis und einen eigenen Screenshot; UI-Tests werden zusätzlich in allen sieben definierten Viewports geprüft.'
Add-Line '5. PASS wird nur gesetzt, wenn erwartetes Ergebnis, alle Schritte, alle Nachweise und die fachliche Abnahme erfüllt sind. Bei FAIL oder BLOCKED bleiben Befund, Ursache, Bugreferenz und nächste Anpassung dokumentiert.'
Add-Line '6. Die Datei ist ein Umsetzungs- und Abnahmeplan. Sie ändert keinen Code automatisch und ersetzt keine aktuelle Jira-/Xray-Statusprüfung.'
Add-Line ''
Add-Line 'EMPFOHLENE PHASEN'
for ($stage = 0; $stage -le 8; $stage++) {
    Add-Line (('{0}. {1}' -f $stage, (Get-StageTitle $stage)))
    Add-Line ('   ' + (Get-StageReason $stage))
}
Add-Line ''
Add-Line 'EPICS UND IHRE KASKADENROLLE'
for ($epicIndex = 0; $epicIndex -lt $epicRows.Count; $epicIndex++) {
    $epic = $epicRows[$epicIndex]
    $epicKey = 'KAN-' + ($epicIndex + 1)
    $epicStage = switch ($epicKey) {
        'KAN-1' { 'Phase 1' }
        'KAN-2' { 'Phase 2' }
        'KAN-3' { 'Phase 3 und 4' }
        'KAN-4' { 'Phase 4' }
        'KAN-5' { 'Phase 3 und 4' }
        'KAN-6' { 'Phase 5' }
        'KAN-7' { 'Phase 0 und 6' }
        'KAN-8' { 'Phase 0 und 7' }
        'KAN-9' { 'Phase 0 und 8' }
    }
    Add-Line ('- {0} | {1} | Kaskadenrolle: {2}' -f $epicKey, $epic.Summary, $epicStage)
    Add-IndentedBlock $epic.Description '  '
}
Add-Line ''

$orderedStories = @($stories | Sort-Object @{Expression = { Get-StorySortRank $_.Code }})

$currentStage = -1
foreach ($story in $orderedStories) {
    $stage = Get-Stage $story.Code
    if ($stage -ne $currentStage) {
        $currentStage = $stage
        Add-Line ''
        Add-Line ('=' * 100)
        Add-Line ('PHASE {0}: {1}' -f $stage, (Get-StageTitle $stage).ToUpperInvariant())
        Add-Line (Get-StageReason $stage)
        Add-Line ('=' * 100)
    }

    Add-Line ''
    Add-Line ('STORY {0} | {1} | Epic {2}: {3} | Priorität: {4}' -f $story.Key, $story.Code, $story.EpicKey, $story.EpicName, $story.Priority)
    Add-Line ('Kurzbeschreibung: ' + $story.Summary)
    Add-Line ('Kaskadenabhängigkeiten (empfohlen): ' + (Get-Dependencies $story.Code))
    Add-Line 'Jira-Beziehungen: Die vier Tasks zeigen auf diese Story; die drei Xray-Tests decken diese Story über das Feld Tests ab.'
    Add-Line 'Akzeptanz-/Fachziel:'
    Add-IndentedBlock (Get-Paragraph $story.Description 'Als')
    if ([string]::IsNullOrWhiteSpace((Get-Paragraph $story.Description 'Als'))) {
        Add-IndentedBlock $story.Description
    }

    $storyStatus = $statusByStory[$story.Key]
    Add-Line ''
    Add-Line ('UMSETZUNGSSTAND: ' + (Get-StatusLabel $storyStatus.Status))
    Add-Line ('  Beleg: ' + $storyStatus.Beleg)
    if (-not [string]::IsNullOrWhiteSpace($storyStatus.Luecke)) {
        Add-Line ('  Lücke: ' + $storyStatus.Luecke)
    }

    $storyTasks = @($taskByStory[$story.Key])
    $taskKeys = ($storyTasks | ForEach-Object { $_.Key }) -join ', '
    Add-Line ''
    Add-Line 'UMSETZUNGS- UND REMEDIATIONSAUFTRAG FÜR POSITIVE TESTERGEBNISSE'
    Add-Line ('  Einordnung: ' + (Get-RemediationLead $storyStatus.Status))
    Add-Line ('  Verantwortlich: Mensch oder KI kann die Umsetzung durchführen; die fachliche Abnahme und die Entscheidung über die Freigabe bleiben beim Team.')
    Add-Line ('  Umzusetzen in dieser Kaskade: ' + $taskKeys + '.')
    $remediationNumber = 0
    foreach ($remediationTask in $storyTasks) {
        $remediationNumber++
        Add-Line ('  {0}. TASK {1}: konkrete Änderung bzw. Anpassung' -f $remediationNumber, $remediationTask.Key)
        Add-IndentedBlock (Get-Paragraph $remediationTask.Description 'Ziel') '     Ziel: '
        Add-IndentedBlock (Get-Paragraph $remediationTask.Description 'Erledigt wenn') '     Abnahme: '
    }
    Add-Line '  Abschlussbedingung: Erst wenn alle vier Tasks umgesetzt und ihre Abnahmekriterien belegt sind, darf der zugehörige Xray-Test als vollständige Umsetzungskontrolle starten.'

    Add-Line ''
    Add-Line 'TASKS IN AUFBAUREIHENFOLGE'
    $taskNumber = 0
    foreach ($task in $storyTasks) {
        $taskNumber++
        $taskRole = (Get-TaskPhaseLabel $task.Summary) -replace '^\d/4 ', ''
        $taskPhase = ('{0}/4 {1}' -f $taskNumber, $taskRole)
        Add-Line ('  TASK {0} | {1} | {2}' -f $task.Key, $taskPhase, $task.Summary)
        Add-Line ('    Parent: ' + $task.Parent + ' (' + $task.StoryCode + ')')
        if ($taskNumber -gt 1) {
            Add-Line ('    Vorherige Story-Taskphase: TASK {0}; diese Taskphase baut darauf auf.' -f $storyTasks[$taskNumber - 2].Key)
        } else {
            Add-Line '    Vorherige Story-Taskphase: keine; dies ist der technische Startpunkt der Story.'
        }
        Add-Line '    Ziel:'
        Add-IndentedBlock (Get-Paragraph $task.Description 'Ziel') '      '
        Add-Line '    Erledigt wenn:'
        Add-IndentedBlock (Get-Paragraph $task.Description 'Erledigt wenn') '      '
        Add-Line '    Gemeinsames Vorgehen: Schnittstellen/Daten prüfen; Regel validiert implementieren; UI/API/Persistenz/Testdaten integrieren; Erfolg, Fehler, Berechtigung und Wiederholung dokumentieren.'
        Add-Line '    Abhängigkeit laut Taskbeschreibung: Testdaten und Fehlerszenarien mit dem zugehörigen Xray-Testfall abstimmen.'
    }

    Add-Line ''
    Add-Line 'XRAY-TESTS NACH ABGESCHLOSSENER IMPLEMENTIERUNG'
    $storyTests = @($testByStory[$story.Key] | Sort-Object @{Expression = { if ($_.Summary -match 'Happy Path|Treffer und Navigation|erfolgreich') { 1 } elseif ($_.Summary -match 'Negative|Keine Treffer|Fehler|Grenzwerte') { 2 } else { 3 } }}, @{Expression = { Get-Int $_.WorkItemId }})
    foreach ($test in $storyTests) {
        $testType = Get-TestType $test.Description
        Add-Line ('  TEST {0} | {1} | {2}' -f $test.Key, $testType, $test.Summary)
        Add-Line ('    Abgedeckte Story: ' + $test.Covers + ' (' + $test.StoryCode + ')')
        if ($xrayByTest.ContainsKey($test.Key)) {
            $lauf = $xrayByTest[$test.Key]
            Add-Line ('    Letztes Xray-Ergebnis: {0} (Ausführung {1}, {2}; Läufe: {3})' -f $lauf.'Xray Status', $lauf.'Letzte Ausfuehrung', $lauf.'Letztes Datum', $lauf.Laeufe)
        }
        Add-Line ('    Testvoraussetzung: ' + (Get-TestPrerequisiteText $testType))
        Add-Line '    Ziel:'
        Add-IndentedBlock (Get-Paragraph $test.Description 'Ziel') '      '
        Add-Line '    Vorbedingungen:'
        Add-IndentedBlock (Get-Paragraph $test.Description 'Vorbedingungen') '      '
        Add-Line '    Schritte:'
        Add-IndentedBlock (Get-Paragraph $test.Description 'Schritte') '      '
        Add-Line '    Erwartetes Ergebnis:'
        Add-IndentedBlock (Get-Paragraph $test.Description 'Erwartetes Ergebnis') '      '
        Add-Line '    Responsive Viewports und Nachweis:'
        Add-IndentedBlock (Get-Paragraph $test.Description 'Responsive Viewports') '      '
        Add-IndentedBlock (Get-Paragraph $test.Description 'Beleg und Nachbereitung') '      '
        Add-Line '    LÖSUNGS- UND NACHWEISPLAN FÜR PASS:'
        Add-Line ('      1. Umsetzung: Die Story-Tasks {0} sind abgeschlossen; ihre Ziele und Abnahmekriterien sind geprüft.' -f $taskKeys)
        Add-Line '      2. Vorbereitung: Die Vorbedingungen, Testdaten, Benutzerrollen, Umgebung und erforderlichen Integrationen sind reproduzierbar hergestellt.'
        Add-Line '      3. Ausführung: Alle oben genannten Schritte werden in Reihenfolge ausgeführt und mit einem tatsächlichen Ergebnis dokumentiert.'
        Add-Line '      4. Beweis: Jeder Schritt erhält einen eigenen Screenshot; bei UI-Fällen kommt je definierter Auflösung ein zusätzlicher Screenshot hinzu. Geheimnisse werden maskiert.'
        Add-Line '      5. Korrekturzyklus: Bei einer Abweichung werden Ursache und Bug erfasst, die betroffene Task- oder Codeanpassung umgesetzt und anschließend genau dieser Test erneut ausgeführt.'
        Add-Line '    Ausführungsregel: Erst nach den erforderlichen Story-Tasks ausführen; bei FAIL reproduzierbaren Befund und Bugreferenz ergänzen; bei PASS müssen alle Schritte und Belege vorhanden sein.'
    }
}

Add-Line ''
Add-Line ('=' * 100)
Add-Line 'KONTROLLEN UND GRENZEN DER ABLEITUNG'
Add-Line ('=' * 100)
$taskParentCount = @($tasks | Where-Object { $storyByKey.ContainsKey($_.Parent) }).Count
$testStoryCount = @($tests | Where-Object { $storyByKey.ContainsKey($_.Covers) }).Count
$storiesWithFourTasks = @($stories | Where-Object { @($taskByStory[$_.Key]).Count -eq 4 }).Count
$storiesWithThreeTests = @($stories | Where-Object { @($testByStory[$_.Key]).Count -eq 3 }).Count
Add-Line ('- Eingelesene Epics: {0}; Stories: {1}; Tasks: {2}; Tests: {3}.' -f $epicRows.Count, $stories.Count, $tasks.Count, $tests.Count)
Add-Line ('- Tasks mit auflösbarer Parent-Story: {0}/{1}.' -f $taskParentCount, $tasks.Count)
Add-Line ('- Tests mit auflösbarer Coverage-Story: {0}/{1}.' -f $testStoryCount, $tests.Count)
Add-Line ('- Stories mit genau vier Tasks: {0}/{1}.' -f $storiesWithFourTasks, $stories.Count)
Add-Line ('- Stories mit genau drei Xray-Tests: {0}/{1}.' -f $storiesWithThreeTests, $stories.Count)
Add-Line ('- Stories mit hinterlegtem Umsetzungsstand: {0}/{1}.' -f $statusRows.Count, $stories.Count)
Add-Line '- Der Umsetzungsstand ist aus Dateien dieses Repositorys abgeleitet und je Story mit dem Beleg ausgewiesen. Er ersetzt keine fachliche Abnahme und keinen Xray-Status: eine vorhandene Funktion kann ihren Test dennoch nicht bestehen.'
Add-Line '- Stories mit dem Vermerk AUSSERHALB DES CODES lassen sich im Repository grundsätzlich nicht belegen; ihr Stand ist ausschließlich in Jira und Xray zu prüfen.'
Add-Line '- Die CSV-Work-Item-IDs sind Import-IDs; die Jira-Schlüssel wurden nach den bestätigten Bereichen KAN-121..KAN-564 für Tasks und KAN-565..KAN-897 für Tests zugeordnet.'
Add-Line '- Die Datei ersetzt keine Jira-Blocks-Links. Wo der Export nur Parent oder Tests enthält, ist die Reihenfolge als fachliche Empfehlung gekennzeichnet und muss bei paralleler Umsetzung im Team bestätigt werden.'
Add-Line '- Tests mit Responsive-/Accessibility-Anteil sind nach der UI-Implementierung eingeordnet und nicht automatisch als tatsächlich ausgeführt zu verstehen.'

New-Item -ItemType Directory -Path $generatedDir -Force | Out-Null
Set-Content -LiteralPath $outputPath -Value $lines -Encoding utf8
Write-Output ("Wrote {0} lines to {1}" -f $lines.Count, $outputPath)
