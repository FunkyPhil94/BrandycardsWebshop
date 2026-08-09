# eBay-Notifications einrichten

Der produktive Endpoint ist:

`https://shop.brandycards.de/api/ebay/notifications`

Er beantwortet die eBay-Endpointprüfung per `GET` und verarbeitet ausschließlich
signierte `ORDER_CONFIRMATION`-Events per `POST`. Eine gültige Meldung wird über
`notificationId` dedupliziert, auf `ebay_item_id` oder `ebay_listing_id`
abgebildet und bucht die lokale Menge atomar herunter. Ein nicht zuordenbares
Listing erzeugt einen Betriebsalarm und wird nicht erneut von eBay angefordert.

## Einmalige Betreiber-Schritte

1. Einen zufälligen Verifikationstoken mit 32–80 Zeichen erzeugen, zum Beispiel
   aus Buchstaben, Zahlen, `-` und `_`. Den Wert nur in Cloudflare und eBay
   eintragen, niemals in Git:

   ```powershell
   npx wrangler secret put EBAY_NOTIFICATION_VERIFICATION_TOKEN
   ```

2. Im eBay Developer Portal unter der Notification API eine HTTPS-Destination
   mit exakt dieser URL und demselben Verifikationstoken anlegen. eBay prüft die
   URL dabei über `GET ...?challenge_code=...`.

3. Die eBay-OAuth-Verbindung im Adminbereich nach der Scope-Erweiterung neu
   autorisieren und den neu ausgegebenen Refresh-Token als Cloudflare-Secret
   `EBAY_REFRESH_TOKEN` speichern. Für `ORDER_CONFIRMATION` benötigt eBay neben
   der allgemeinen Berechtigung `sell.fulfillment` und
   `sell.fulfillment.readonly`.

4. Für die Destination eine Subscription für `ORDER_CONFIRMATION` anlegen und
   aktivieren. Danach die eBay-Testzustellung auslösen. Der Test darf keine
   Produktionskarte simuliert verändern; erst eine echte eBay-Zustellung darf
   den Verkaufsnachweis liefern.

5. Nach einer Testzustellung lesend prüfen:

   ```powershell
   npx wrangler d1 execute brandycards-production --remote --json --command "SELECT provider, external_event_id, event_type, status, received_at, processed_at FROM webhook_events WHERE provider = 'EBAY' ORDER BY received_at DESC LIMIT 10"
   ```

   Bei einem echten Verkauf zusätzlich Listing- und Inventory-Menge sowie den
   Betreiberalarm prüfen. Keine D1-Schreibbefehle verwenden.

Die Signaturprüfung lädt den eBay-Public-Key mit einem Application-Token und
cacht ihn im Worker für eine Stunde. Die Implementierung unterstützt die von
eBay im Signaturheader ausgewiesenen ECDSA-Digests SHA-1 und SHA-256; ein
fehlender oder ungültiger Header erreicht die Datenbank nie.
