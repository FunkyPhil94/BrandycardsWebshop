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

Das Textpanel ist vollständig mit Tab, Umschalt+Tab, Enter/Leertaste und Escape bedienbar. Es ordnet natürlich formulierte Fragen lokal und deterministisch einer festen read-only Funktion der Assistant-API zu. Unterstützt werden Verkäufe, Listings, Bestellungen, Preisvorschläge, Bestandsprüfung, Shop-Anfragen, eBay-Datenverfügbarkeit, eBay-Sync und Statistiken. Unbekannte Fragen lösen keinen freien Modell- oder SQL-Aufruf aus, sondern zeigen die unterstützten Beispiele. Spracheingabe und freie Orchestrierung sind nicht Bestandteil dieser Phase.

## Ereignisse

| Shop-Ereignis | Avatar-Reaktion |
| --- | --- |
| Neuer Preisvorschlag | Wartende Animation |
| Preisvorschlag angenommen | Winken |
| Preisvorschlag abgelehnt | Fehlgeschlagene Animation |
| Karte verkauft | Sprung |

## Produktivbetrieb

Vor der produktiven Kopplung muss die Migration `drizzle/0010_avatar_device_pairing.sql` in der produktiven D1-Datenbank angewendet und der Worker mit den neuen Routen deployed werden. Danach wird im produktiven Adminbereich ein neuer Pairing-Code erzeugt und in der App die Produktionsadresse des Shops eingetragen. Die lokale `.env` wird dafür nicht kopiert.
