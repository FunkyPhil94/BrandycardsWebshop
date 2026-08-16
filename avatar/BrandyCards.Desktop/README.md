# BrandyCards Desktop Avatar

Die App läuft unabhängig vom Webshop als echtes Desktop-Pet mit per-pixel-transparentem Overlay und fragt ausschließlich den geschützten Avatar-Ereignisfeed ab. eBay-, Cloudflare- und Supabase-Geheimnisse werden nicht in die App übernommen.

## Lokal starten

1. Shop starten: `npm run dev`
2. `http://localhost:3000/admin` öffnen und unter **Desktop-Verbindung** einen Pairing-Code erzeugen.
3. App starten:

   ```powershell
   dotnet run --project avatar/BrandyCards.Desktop/BrandyCards.Desktop.csproj -c Debug -p:Platform=x64 --launch-profile "BrandyCards.Desktop (Unpackaged)"
   ```

4. `http://localhost:3000` und den einmaligen Code in der App eingeben.

Der Code ist zehn Minuten gültig. Danach speichert die App nur das Geräte-Token lokal unter `%LOCALAPPDATA%\BrandyCards\DesktopAvatar\settings.json` und fragt alle drei Sekunden nach neuen Ereignissen.

## Text-Assistant

Nach erfolgreicher Kopplung bleiben zwei voneinander getrennte Fenster sichtbar:

- Das bestehende per-pixel-transparente Desktop-Pet zeigt unverändert seine Animationen.
- Links daneben öffnet der WinUI-Launcher auf Klick oder per Tastatur das Textpanel.

Das Textpanel ist vollständig mit Tab, Umschalt+Tab, Enter/Leertaste und Escape bedienbar. Textfragen gehen an den zentralen serverseitigen Orchestrator. Er wählt ausschließlich Werkzeuge aus der festen Read-only-Registry aus; SQL, Tabellen- oder Schreibfunktionen sind kein Modellwerkzeug. Bekannte und zusammengesetzte Fragen werden bereits vom geschlossenen lokalen Planer erkannt. Ist serverseitig `OPENAI_API_KEY` gesetzt, kann der Modell-Planer zusätzlich freie Formulierungen zuordnen. Die endgültige deutsche Textantwort wird immer deterministisch aus den typisierten Tool-Rückgaben erzeugt und enthält nach Möglichkeit Quelle und Datenstand.

Der Mikrofon-Button startet eine einzelne Diktatsitzung über die lokale Windows-Desktop-Spracherkennung. Audio verlässt den lokalen Prozess nicht. Der erkannte Text wird anschließend wie eine geschriebene Frage an denselben serverseitigen Orchestrator gesendet; bei einer freien, lokal nicht erkannten Formulierung kann der Server diesen Text an den konfigurierten Modell-Provider geben. Die Antwort bleibt ausschließlich Text, eine Sprachausgabe gibt es nicht. Voraussetzung sind ein verfügbares Mikrofon, die Windows-Freigabe für Desktop-Apps sowie eine installierte Spracherkennung für die bevorzugte Windows-Sprache. Ist eine Voraussetzung nicht erfüllt, zeigt das Statusfeld eine konkrete, zugängliche Hinweisnachricht.

## Pet-Größe und hochauflösendes Ausgangsmaterial

Das Pet wird in **physischen** Pixeln gezeichnet: `NativePetOverlay` legt eine
Kachel von 192×208 unskaliert (`DrawImageUnscaled`) in ein Fenster von 260×300
physischen Pixeln. Der Launcher daneben rechnet dagegen in effektiven Pixeln und
skaliert mit der DPI seines Bildschirms. Das Pet schrumpft deshalb relativ zu
allem anderen, je höher die Anzeigeskalierung steht:

| Skalierung | Pet, effektive Pixel |
| --- | --- |
| 100 % | 260×300 |
| 150 % | 173×200 |
| 200 % | 130×150 |

**Das wird bewusst nicht durch Interpolation behoben.** Gemessen: Der Atlas
`Assets/spritesheet.png` ist 1536×1872 (8×9 Kacheln à 192×208), und
`avatar/brandycards-avatar/spritesheet.webp` hat exakt dieselben Maße — es gibt
also kein höher aufgelöstes Original. In einer Leerlaufkachel sind 5,3 % der
Pixel teiltransparent (76,1 % ganz leer, 18,6 % ganz deckend); diese weiche
Kante ist genau das, was eine 1,5-fache Vergrößerung sichtbar ausfransen ließe.
Der Weg über `UpdateLayeredWindow` zeigt das Ergebnis ungefiltert, ohne
Hintergrund, der Artefakte kaschieren würde.

### Anforderungen an neues 2×-Material

Damit das Pet bei hoher Skalierung mitwachsen kann, ohne interpoliert zu werden,
muss ein zweiter Atlas **nativ in doppelter Auflösung gezeichnet** werden — ein
hochskalierter bestehender Atlas erfüllt den Zweck nicht.

| Eigenschaft | Anforderung |
| --- | --- |
| Dateiname | `Assets/spritesheet.2x.png` (neben dem bestehenden, nicht statt seiner) |
| Gesamtmaß | 3072×3744 Pixel |
| Kachelraster | 8 Spalten × 9 Zeilen, Kachel 384×416 |
| Zeilenbelegung | identisch zur 1×-Fassung (Zeile 0 Leerlauf mit 6 Bildern, Zeile 3 Winken, Zeile 4 Sprung, Zeile 5 Fehlschlag, Zeile 6 Warten) |
| Farbformat | PNG, 32 bpp mit echtem Alphakanal, **nicht** vormultipliziert |
| Zeichenraster | Motiv an denselben relativen Positionen wie 1×, damit die Animation nicht springt |
| Rand | umlaufend mindestens 2 Pixel vollständig transparent, sonst schneidet die Kachelgrenze die weiche Kante an |

Sind diese Bedingungen erfüllt, wäre der Eingriff im Programm klein: Auswahl des
Atlas nach der DPI des Pet-Bildschirms, `FrameWidth`/`FrameHeight` und
`WindowWidth`/`WindowHeight` entsprechend verdoppelt. Zu beachten ist dabei, dass
`WindowWidth`/`WindowHeight` zugleich in `MainWindow` als `PetWidth`/`PetHeight`
liegen — beide Stellen gehören zusammen, `tests/assistant-phase6.test.mjs` hält
das fest.

### Optionen, falls kein neues Material entsteht

1. **Nichts tun.** Das Pet bleibt bei hoher Skalierung kleiner als gedacht. Das
   ist der aktuelle Zustand und kostet nichts.
2. **Beim Zeichnen skalieren** (`DrawImage` mit Zielrechteck). Nicht empfohlen:
   Der Eingriff berührt den Alpha-Pfad (vormultipliziertes PArgb →
   `UpdateLayeredWindow`), jede Kachel jeder Animationszeile und die
   Bezugsgrößen der Positionierung — bei Faktor 1,5 mit sichtbarem
   Qualitätsverlust an der ohnehin weichen Kante.
3. **Neues 2×-Material nach obiger Tabelle.** Die saubere Lösung; sie braucht
   Grafikarbeit, keine Programmänderung ins Blaue.

Ohne ausdrücklichen Folgeauftrag bleiben Atlas, Pet-Größe und `NativePetOverlay`
unverändert.

## Ereignisse

| Shop-Ereignis | Avatar-Reaktion |
| --- | --- |
| Neuer Preisvorschlag | Wartende Animation |
| Preisvorschlag angenommen | Winken |
| Preisvorschlag abgelehnt | Fehlgeschlagene Animation |
| Karte verkauft | Sprung |

## Produktivbetrieb

Vor der produktiven Kopplung muss die Migration `drizzle/0010_avatar_device_pairing.sql` in der produktiven D1-Datenbank angewendet und der Worker mit den neuen Routen deployed werden. Danach wird im produktiven Adminbereich ein neuer Pairing-Code erzeugt und in der App die Produktionsadresse des Shops eingetragen. Die lokale `.env` wird dafür nicht kopiert.
