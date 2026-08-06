# BrandyCards Agentenprotokoll

Dieses Protokoll hält fest, welche spezialisierten Agents im Projekt eingesetzt wurden, welche Prüfaufträge sie erhielten und wie ihre Ergebnisse in die Umsetzung eingeflossen sind.

## 2026-08-06 – Capture/Expiry-Prüfung

- Agent: Dewey (`gpt-5.6-luna`, mittleres Reasoning)
- Auftrag: Capture- und Reservierungsablauf auf Rennen zwischen PayPal-Capture und Ablaufbereinigung prüfen.
- Ergebnis: Ein Vorab-Status-Read war nicht ausreichend; ein Capture konnte parallel zur Freigabe laufen.
- Umsetzung: Bestellung erhält vor dem externen Capture atomar den Status `PROCESSING`; Freigabe beansprucht eine Bestellung atomar über `PENDING → CANCELLED`; unklare Capture-Fehler werden nicht automatisch zurückgesetzt.

## 2026-08-06 – Bestell-/Webhook-Idempotenz

- Agent: Faraday (`gpt-5.6-luna`, mittleres Reasoning)
- Auftrag: Race Conditions und doppelte Verarbeitung in Bestellung, Settlement und PayPal-Webhooks prüfen.
- Ergebnis: Inventar-Updates mussten anhand betroffener Zeilen geprüft werden; Settlement und Webhook-Zustände mussten idempotent und monoton werden.
- Umsetzung: Bestandsreservierung prüft D1-Änderungszahlen, Teilreservierungen werden kompensiert, Settlement bucht nur nach erfolgreichem `ACTIVE → CONVERTED`, und PayPal-Events können nach `FAILED` erneut verarbeitet werden.

## 2026-08-06 – eBay-Synchronisierung

- Agent: Pauli (`gpt-5.6-luna`, mittleres Reasoning)
- Auftrag: Bestehenden eBay-Code und die Einbindung für Verkaufsbenachrichtigungen prüfen.
- Ergebnis: Der aktuelle eBay-Code ist lesend; für bidirektionale Synchronisierung müssen Angebots-ID, Benachrichtigungsroute und retry-fähige Schreibvorgänge ergänzt werden. Menge 0 darf außerdem nicht wieder als aktives Produkt erscheinen.
- Umsetzung: `ebayOfferId` wird separat persistiert, und eBay-Angebote mit Menge 0 werden lokal als beendet/inaktiv geführt. Die nächste Ausbaustufe ist die idempotente eBay-Verkaufsbenachrichtigung und eine Outbox für eBay-Bestandsänderungen.

## Arbeitsweise

Agents erhalten klar abgegrenzte Prüf- oder Implementierungsaufträge. Ihre Ergebnisse werden vor Übernahme geprüft. Änderungen werden anschließend lokal getestet, committed und nach GitHub gepusht.
