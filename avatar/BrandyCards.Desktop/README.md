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

## Ereignisse

| Shop-Ereignis | Avatar-Reaktion |
| --- | --- |
| Neuer Preisvorschlag | Wartende Animation |
| Preisvorschlag angenommen | Winken |
| Preisvorschlag abgelehnt | Fehlgeschlagene Animation |
| Karte verkauft | Sprung |

## Produktivbetrieb

Vor der produktiven Kopplung muss die Migration `drizzle/0010_avatar_device_pairing.sql` in der produktiven D1-Datenbank angewendet und der Worker mit den neuen Routen deployed werden. Danach wird im produktiven Adminbereich ein neuer Pairing-Code erzeugt und in der App die Produktionsadresse des Shops eingetragen. Die lokale `.env` wird dafür nicht kopiert.
