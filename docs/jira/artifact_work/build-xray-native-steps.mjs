import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const generatedDir = path.join(root, "docs", "jira", "generated");
const inputPath = path.join(generatedDir, "brandycards-xray-tests.csv");
const outputPath = path.join(generatedDir, "brandycards-xray-native-steps.json");

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...body] = rows;
  return body.filter((values) => values.length > 1).map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])));
};

const dataByType = {
  "Happy Path": [
    "Berechtigter Testnutzer; gültige Pflichtdaten; Story-Kontext",
    "Gültige Eingabewerte für die zugehörige Story; keine Dublette",
    "Speichern bzw. fachliche Aktion einmal ausführen",
    "Testschlüssel und Zielobjekt; Reload ohne Datenänderung",
  ],
  "Negative und Grenzwerte": [
    "Leere Pflichtfelder; vorbereitete Fehlerdaten",
    "Ungültige Formate; Minimal-, Maximal- und Grenzwerte",
    "Dubletten- bzw. Konfliktfall; Aktion erneut ausführen",
    "Fehlerfall; unveränderte Ausgangsdaten; erneuter Versuch",
  ],
  "Berechtigung und Betrieb": [
    "Nicht berechtigte Rolle; geschützter Zielbereich",
    "Direkter Endpunkt bzw. Deep Link; gleiche Benutzerrolle",
    "Simulierter technischer Fehler; anschließender Reload",
    "Änderungsverlauf, Log und wiederholbarer Systemzustand",
  ],
  "Treffer und Navigation": [
    "Repräsentative Produktdaten; veröffentlichter Bestand",
    "Suchbegriff bzw. Filterkriterien; gewünschte Sortierung",
    "Pagination; stabile Trefferliste; gewählte Seite",
    "Produktdetail; Zurück-Navigation; vorheriger Suchzustand",
  ],
  "Keine Treffer und Fehler": [
    "Kriterium ohne Treffer; leerer Ergebniszustand",
    "Ungültige Such- oder Filtereingabe",
    "Verzögerte bzw. fehlerhafte Antwort",
    "Wiederholen und Filter zurücksetzen",
  ],
  "Responsive und Accessibility": [
    "Desktop-, Tablet- und Smartphone-Breite",
    "Tastaturnavigation ohne Maus",
    "Fokusreihenfolge; Screenreader-Name; sichtbarer Fokus",
    "Bilder, Text und Aktion bei anderer Auflösung",
  ],
  "Kauf erfolgreich": [
    "Verfügbares Produkt; korrekter Preis und Bestand",
    "Warenkorbposition; Menge; Gastdaten; Lieferadresse; Versandart",
    "Checkout-Zusammenfassung; Versand- und Gesamtbetrag",
    "Bestellung absenden; Reservierung bzw. Verarbeitung",
  ],
  "Abbruch und Nichtverfügbarkeit": [
    "Artikel zwischen zwei Checkout-Schritten unverfügbar",
    "Leeres Pflichtfeld; ungültige Adresse",
    "Zurück-Navigation; korrigierbare Eingaben",
    "Checkout-Reload; erneut verfügbare Testdaten",
  ],
  "Doppelte Aktion und Kontoflow": [
    "Submit bzw. Reload mehrfach; identischer Warenkorb",
    "Kundenkonto; gleicher Kauf mit identischen Produktdaten",
    "Bestellstatus und Warenkorb nach Wiederholung",
    "Serverseitige Bestellung; Ereignis- und Bestandsabgleich",
  ],
  "Zahlung erfolgreich": [
    "Bestellung mit bekanntem Betrag; reservierter Bestand",
    "Zahlungsprovider; autorisierter Betrag",
    "Capture bzw. Callback; einmaliges Ereignis",
    "Bestellung, Bestand, Zahlungsstatus und Kommunikation",
  ],
  "Fehlzahlung und Abbruch": [
    "Provider-Fehler bzw. bewusst abgebrochene Zahlung",
    "Zurück zum Checkout; unveränderte Bestellung",
    "Reservierung und Bestellstatus nach Fehlzahlung",
    "Erneuter Zahlungsversuch mit gültigen Daten",
  ],
  "Idempotenz und Adminbetrieb": [
    "Dasselbe Zahlungsereignis zweimal; identische Ereignis-ID",
    "Berechtigte Adminrolle; Bestellung im richtigen Status",
    "Erlaubte Versand-, Storno- oder Erstattungsaktion",
    "Audit-Log; Zahlungs- und Bestellereignisse",
  ],
  "Konto-Lebenszyklus": [
    "Neue, gültige E-Mail-Adresse; starkes Testpasswort",
    "Bestätigungslink bzw. bestätigter Account",
    "Anmelden, abmelden und erneut anmelden",
    "Passwortreset; neues Passwort; alte Zugangsdaten",
  ],
  "Eigene Daten und Historie": [
    "Angemeldetes Kundenkonto; eigene Stammdaten",
    "Eigene Adresse; gespeicherte Kontoänderung",
    "Eigene Bestellung; Historie und Status",
    "Reload; erneut angemeldetes Konto; unveränderte Historie",
  ],
  "Datenschutz und Berechtigung": [
    "Fremde Konto-URL bzw. fremde API-ID",
    "Export- oder Löschanforderung; bestätigte Identität",
    "Re-Authentifizierung; Datenschutzbestätigung",
    "Folgezugriff; Audit- und Löschstatus",
  ],
  "Angebot einreichen": [
    "Angemeldeter Verkäufer; vollständige Kartendaten",
    "Bilder, Zustand, Preis und sonstige Pflichtfelder",
    "Angebot speichern bzw. einreichen",
    "Angebotsstatus und Einreichungsbestätigung",
  ],
  "Ungültige und fremde Daten": [
    "Fehlende bzw. ungültige Verkäuferdaten",
    "Zu große, falsche oder nicht unterstützte Bilder",
    "Fremdes Angebot über URL bzw. API-ID",
    "Korrigierte Daten; erneutes Speichern",
  ],
  "Angebotsstatus und Auszahlung": [
    "Eingereichtes Angebot; berechtigte Adminrolle",
    "Preisangebot; Annahme- bzw. Ablehnungsentscheidung",
    "Übergabe- und Auszahlungsstatus",
    "Benachrichtigungen; Audit; Verkäufer- und Adminsicht",
  ],
  "Admin-Operation erfolgreich": [
    "Passende Adminrolle; zulässiger Datensatz",
    "Suchkriterium; geöffnete Detailansicht",
    "Validierte Änderung; einmaliger Speichervorgang",
    "Liste, Detailansicht und Audit nach Reload",
  ],
  "Rolle und Risikoaktion": [
    "Eingeschränkte Rolle; geschützter Bereich",
    "Direkter API- bzw. Deep-Link ohne Berechtigung",
    "Irreversible Aktion; bewusster Abbruch und Bestätigung",
    "Berechtigungsentscheidung und Audit-Eintrag",
  ],
  "Synchronisation und Fehler": [
    "Gültiger Synchronisationslauf; definierter Datenbestand",
    "Konflikt- bzw. Fehlerdatensatz",
    "Laufstatus und technische Fehlerdetails",
    "Sicherer Wiederholungslauf; gleiche Eingabedaten",
  ],
  "Visueller Standardpfad": [
    "Referenzdaten; relevante Shopseite",
    "1440x900, 1920x1080, 2560x1440, 3440x1440, 3840x2160, 768x1024, 390x844 CSS-Pixel",
    "Navigation und primäre Kernaktion",
    "Screenshot je Viewport; Referenzabgleich",
  ],
  "Zustände und Formulare": [
    "Künstlich verzögertes Laden",
    "Keine Daten; leerer Ergebniszustand",
    "Validierungs- und Serverfehler",
    "Gültige Eingabe; erfolgreiche Aktion",
  ],
  "Accessibility und Auflösung": [
    "Tastatur-only; keine Maus",
    "Fokusreihenfolge; sichtbarer Fokus",
    "Screenreader-Struktur; Alternativtexte",
    "Zoom; hohe Auflösung; definierte CSS-Viewportmatrix",
  ],
  "Testfall ausführbar": [
    "Test aus Repository; Testschlüssel und Zielumgebung",
    "Vorbedingungen; Testdaten; isolierte Benutzerrolle",
    "Native Schritte 1-4; definierte Viewports",
    "Tester, Datum, Ergebnis und Screenshot je Schritt/Viewport",
  ],
  "Traceability und Abdeckung": [
    "Story, Test und Testschlüssel",
    "Test Set E9-Nachweise; Test Plan KAN-898",
    "Test Execution KAN-899",
    "Coverage, Status und Release-Ansicht",
  ],
  "Fehler und Regression": [
    "Negativ- bzw. Regressionstest; definierte Viewports",
    "Tatsächliches Ergebnis; Browser/Version; Testdaten; Screenshots",
    "Jira-Bug mit Reproduktionsschritten; Testschlüssel",
    "Korrektur-Build; Retest; Regression",
  ],
};

const rows = parseCsv(await fs.readFile(inputPath, "utf8"));
const result = rows.map((row, index) => {
  const issueKey = `KAN-${565 + index}`;
  const storyMatch = row.Description.match(/^Abgedeckte Story: (KAN-\d+)/m);
  const testTypeMatch = row.Description.match(/^Testart: (.+)$/m);
  const expectedMatch = row.Description.match(/^Erwartetes Ergebnis\n([\s\S]*?)\n\nResponsive Viewports/m);
  const stepMatches = [...row.Description.matchAll(/^\d+\. (.+)$/gm)].map((match) => match[1]);
  const testType = testTypeMatch?.[1] ?? "";
  if (!storyMatch || !testType || stepMatches.length !== 4 || !dataByType[testType]) {
    throw new Error(`Unvollständige Vorlage für ${issueKey}: ${row.Summary}`);
  }
  const overall = expectedMatch?.[1]?.trim() ?? "Das erwartete Testergebnis ist erreicht.";
  const rowsForTest = stepMatches.map((action, stepIndex) => ({
    action,
    data: `${dataByType[testType][stepIndex]}; Story ${storyMatch[1]}; Test ${issueKey}`,
    expected: `Der Schritt „${action}“ ist nachvollziehbar abgeschlossen. ${overall}`,
  }));
  return {
    issueKey,
    summary: row.Summary,
    storyKey: storyMatch[1],
    testType,
    rows: rowsForTest,
  };
});

await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`Generated ${result.length} tests with ${result.reduce((sum, test) => sum + test.rows.length, 0)} native steps.`);
