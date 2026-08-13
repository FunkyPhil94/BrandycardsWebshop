import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const root = "C:/Projekte/BrandyCards WebShop";
const sourcePath = `${root}/docs/jira/brandycards-user-stories.csv`;
const outputDir = `${root}/docs/jira/generated`;

await fs.mkdir(outputDir, { recursive: true });

const sourceText = await fs.readFile(sourcePath, "utf8");
const sourceWorkbook = await Workbook.fromCSV(sourceText, { sheetName: "Source" });
const sourceSheet = sourceWorkbook.worksheets.getItem("Source");
const sourceValues = sourceSheet.getUsedRange().values;
const sourceHeaders = sourceValues[0].map((value) => String(value ?? ""));
const indexOf = (name) => sourceHeaders.indexOf(name);
const storyRows = sourceValues.slice(1).filter((row) => row.some((value) => String(value ?? "").trim() !== ""));

if (storyRows.length !== 111) {
  throw new Error(`Erwartet 111 Stories, gefunden: ${storyRows.length}`);
}

const storyHeaders = ["Issue Key", "Work type", "Summary", "Description", "Priority", "Epic"];
const taskHeaders = ["Work type", "Summary", "Description", "Work item ID", "Parent", "Priority"];
const testHeaders = ["Work type", "Summary", "Description", "Work item ID", "Tests", "Priority"];

const csvEscape = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const toCsv = (headers, rows) => `${[headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n")}\r\n`;

const epicNumber = (summary) => {
  const match = String(summary).match(/^(E\d+)/);
  if (!match) throw new Error(`Epic-Code fehlt in Summary: ${summary}`);
  return match[1];
};

const priorityFor = (issueKey) => {
  const number = Number(issueKey.split("-")[1]);
  const highest = new Set([
    10, 11, 12, 13, 14, 15, 16, 17, 19, 20,
    21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33,
    34, 35, 36, 37, 38, 40, 42, 43, 44, 45,
    46, 47, 48, 49, 50, 51, 52, 53, 54, 55,
    80, 81, 82, 83, 84, 85, 86, 87, 89, 90, 91, 92,
  ]);
  const high = new Set([
    18, 22, 32, 39, 41, 56,
    58, 59, 60, 61, 62, 63, 64, 65,
    93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106,
    107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
  ]);
  const medium = new Set([57, 66, 67, 88]);
  if (highest.has(number)) return "Highest";
  if (high.has(number)) return "High";
  if (medium.has(number)) return "Medium";
  return "Lowest";
};

const criteriaByEpic = {
  E1: [
    "Pflichtfelder, Datentypen und fachliche Wertebereiche werden vor dem Speichern validiert.",
    "Eine erfolgreiche Änderung ist nach dem erneuten Laden konsistent sichtbar und beeinflusst nur den betroffenen Katalogeintrag.",
    "Ungültige oder unvollständige Eingaben werden verständlich markiert, ohne bereits gültige Eingaben zu verlieren.",
    "Berechtigungen werden geprüft; nicht berechtigte Nutzer können den Vorgang weder ausführen noch über einen direkten Aufruf umgehen.",
    "Dubletten, verwaiste Datensätze und widersprüchliche Zustände werden erkannt und nachvollziehbar behandelt.",
    "Die Funktion ist für relevante Desktop- und Smartphone-Breakpoints bedienbar und erzeugt strukturierte Logs für Fehlerfälle.",
  ],
  E2: [
    "Die Suche beziehungsweise Filterung liefert bei gültigen Eingaben reproduzierbare Ergebnisse aus dem aktuellen Produktbestand.",
    "Mehrere Kriterien werden logisch korrekt kombiniert; Trefferzahl, Sortierung und Pagination bleiben konsistent.",
    "Leere, ungültige und technische Fehlerzustände werden verständlich unterschieden und bieten eine sinnvolle nächste Aktion.",
    "Die URL beziehungsweise der Zustand kann bei unterstützten Filtern sicher geteilt oder erneut geladen werden.",
    "Die Funktion ist tastaturbedienbar, responsiv und bleibt auch bei langen Ergebnismengen performant.",
    "Nicht verfügbare oder unvollständige Produktdaten werden nicht irreführend als kaufbar dargestellt.",
  ],
  E3: [
    "Der Warenkorb beziehungsweise Checkout hält Mengen, Preise und Verfügbarkeit über alle relevanten Schritte konsistent.",
    "Jede Änderung aktualisiert Zwischensummen, Versandkosten und Gesamtbetrag nachvollziehbar.",
    "Nicht verfügbare oder zwischenzeitlich geänderte Artikel werden vor dem Kauf erkannt und sicher behandelt.",
    "Gast- und Kundenkonto-Flows verwenden dieselben fachlichen Preis-, Bestands- und Validierungsregeln.",
    "Adress-, Versand- und Formulareingaben werden feldgenau validiert und verständlich erklärt.",
    "Vor dem Absenden kann der Nutzer alle kaufrelevanten Daten prüfen; ein erneutes Absenden erzeugt keine Doppelbestellung.",
  ],
  E4: [
    "Der Zahlbetrag wird vor der Zahlung aus den serverseitig ermittelten Bestelldaten gebildet und korrekt an den Zahlungsdienst übergeben.",
    "Reservierung, Zahlung, Bestellung und Freigabe folgen einer nachvollziehbaren Zustandsmaschine.",
    "Fehlgeschlagene, abgebrochene und doppelt zugestellte Zahlungsereignisse sind idempotent und erzeugen keinen falschen Bestand oder Umsatz.",
    "Administrative Folgeaktionen sind berechtigt, protokolliert und für Support und Versand nachvollziehbar.",
    "Kunde und Betreiber erhalten bei relevanten Statusänderungen klare, konsistente Informationen.",
    "Erstattungen und Stornierungen berücksichtigen Bestand, Zahlungsstatus und bereits ausgeführte Folgeaktionen.",
  ],
  E5: [
    "Registrierung, Anmeldung, Abmeldung und Passwortwiederherstellung behandeln Authentifizierung und Fehlversuche sicher.",
    "Bestätigte Kontodaten werden korrekt gespeichert; unbestätigte oder abgelaufene Nachweise werden verständlich behandelt.",
    "Persönliche Daten und Bestellhistorie sind ausschließlich für das berechtigte Konto sichtbar.",
    "Adressen und Kontodaten werden vor dem Speichern validiert und bei Änderungen konsistent verwendet.",
    "Datenschutzrelevante Aktionen wie Löschung oder Export sind nachvollziehbar, vollständig und gegen Fehlbedienung geschützt.",
    "Die Oberfläche ist responsiv, tastaturbedienbar und liefert klare Zustände für Laden, Erfolg und Fehler.",
  ],
  E6: [
    "Verkäuferdaten, Bilder, Zustandsangaben und Preiswünsche werden vollständig und validiert erfasst.",
    "Ein Angebot besitzt einen eindeutigen, nachvollziehbaren Status und kann nicht unbemerkt in einen widersprüchlichen Zustand wechseln.",
    "Berechtigungen verhindern Zugriff auf fremde Angebote und schützen sensible Auszahlungs- und Kontodaten.",
    "Annahme, Ablehnung, Rückfragen und Übergabe erzeugen klare Status- und Benachrichtigungsinformationen.",
    "Fehler bei Upload, Speicherung oder Statuswechseln sind wiederholbar und hinterlassen keine halbfertigen Angebote.",
    "Die Funktion ist für Desktop und Smartphone verständlich und enthält Hinweise zu nächsten Schritten und Verantwortlichkeiten.",
  ],
  E7: [
    "Administrative Aktionen erfordern die richtige Rolle und werden serverseitig autorisiert.",
    "Listen, Detailansichten und Formulare zeigen den aktuellen Datenstand und validieren Änderungen vor dem Speichern.",
    "Kritische Änderungen an Produkten, Beständen, Bestellungen und Konten sind nachvollziehbar protokolliert.",
    "Synchronisationen sind wiederholbar, idempotent und zeigen Laufstatus, Ergebnis und Fehlerursache.",
    "Fehlerhafte Datensätze werden isoliert behandelt, ohne gültige Bestände oder Bestellungen zu beschädigen.",
    "Das Admin-Interface ist für die vorgesehenen Breakpoints bedienbar und schützt irreversible Aktionen vor Fehlbedienung.",
  ],
  E8: [
    "Navigation, Seitenhierarchie und aktive Zustände sind ohne visuelle Rätsel verständlich.",
    "Layouts, Komponenten, Abstände, Farben und Typografie folgen einem konsistenten Designsystem.",
    "Die Oberfläche funktioniert bei den definierten Desktop-, Tablet- und Smartphone-Breiten ohne horizontales Überlaufen.",
    "Lade-, Leer-, Fehler- und Erfolgsmeldungen sind unterscheidbar, verständlich und nicht nur farblich codiert.",
    "Interaktive Elemente haben sichtbare Fokus- und Aktivzustände und sind vollständig per Tastatur bedienbar.",
    "Kontraste, Beschriftungen, semantische Struktur und Alternativtexte unterstützen Screenreader und assistive Technologien.",
    "Bilder, Schriftgrößen und Inhalte bleiben bei unterschiedlichen Auflösungen scharf, lesbar und ohne Layoutsprünge.",
  ],
  E9: [
    "Testfälle besitzen eindeutige Vorbedingungen, Testdaten, Schritte und erwartete Ergebnisse.",
    "Stories, Tests, Test Sets, Pläne und Ausführungen sind nachvollziehbar miteinander verknüpft.",
    "Positive, negative, Grenzwert-, Berechtigungs- und Gerätefälle werden angemessen abgedeckt.",
    "Testergebnisse und Belege können pro Schritt dokumentiert und einem reproduzierbaren Lauf zugeordnet werden.",
    "Fehlgeschlagene Tests führen zu nachvollziehbaren Fehlern mit ausreichendem Kontext für die Analyse.",
    "Testabdeckung und Release-Abnahme lassen sich nach Epic, Priorität und Status auswerten.",
  ],
};

const taskBlueprints = {
  E1: [
    ["Datenmodell und Fachregeln umsetzen", "Domänenmodell, Pflichtfelder, Wertebereiche, Eindeutigkeiten und Migrationsbedarf für die Story definieren und implementieren.", "Persistenz ist migrationssicher, validiert ungültige Eingaben und hält bestehende Katalogdaten kompatibel."],
    ["API und Geschäftslogik implementieren", "Use Cases, serverseitige Autorisierung, Transaktionen, Fehlercodes und idempotente Verarbeitung für die Story bereitstellen.", "Der Use Case funktioniert unabhängig vom UI, ist gegen direkte Manipulation geschützt und liefert stabile Verträge."],
    ["Admin- und Shop-Oberfläche bauen", "Formulare, Listen, Detailansichten, Ladezustände, Fehlerfälle und responsive Darstellung für die Story umsetzen.", "Die Oberfläche führt Nutzer verständlich durch den Vorgang und verhindert inkonsistente Eingaben."],
    ["Qualitätssicherung und Betriebsbeobachtung ergänzen", "Unit-, Integrations- und UI-Tests, Telemetrie sowie nachvollziehbare Logs für Erfolg und Fehler hinzufügen.", "Die Akzeptanzkriterien sind automatisiert oder reproduzierbar geprüft; Fehler enthalten eine verwertbare Korrelation."],
  ],
  E2: [
    ["Such- und Abfragepfad implementieren", "Filter, Sortierung, Pagination, Normalisierung von Suchbegriffen und die fachliche Query-Logik für die Story umsetzen.", "Treffer sind korrekt, stabil sortiert, paginiert und gegen ungültige oder missbräuchliche Eingaben geschützt."],
    ["Ergebnis- und Detailkomponenten umsetzen", "Listen-, Karten- und Detailkomponenten mit URL-Zustand, Verfügbarkeit, Bildern und responsiven Varianten bauen.", "Der relevante Zustand bleibt beim Navigieren erhalten und ist auf den unterstützten Viewports nutzbar."],
    ["Leere, Fehler- und Performancepfade absichern", "Keine-Treffer-, Fehler-, langsame Antwort- und große Ergebnismengen mit verständlicher Rückmeldung und geeigneten Limits behandeln.", "Kein Zustand wirkt wie ein erfolgreicher Treffer; Ladezeiten und Requests bleiben kontrollierbar."],
    ["Accessibility- und Regressionstests ergänzen", "Tastaturpfade, Screenreader-Namen, Fokusreihenfolge, visuelle Regression und repräsentative Datenvarianten testen.", "Die wichtigsten Nutzungspfade sind reproduzierbar geprüft und die Ergebnisse im Testmanagement verwertbar."],
  ],
  E3: [
    ["Warenkorb- und Checkout-Zustand modellieren", "Artikel, Mengen, Preise, Verfügbarkeit, Gast-/Konto-Kontext und Zustandsübergänge serverseitig definieren.", "Der Server ist die Quelle der Wahrheit und verhindert Preis-, Bestands- oder Mengenabweichungen."],
    ["Checkout-Oberfläche und Nutzerführung bauen", "Warenkorb, Adressen, Versandart, Zusammenfassung und Fortschrittsanzeige mit klaren Aktionen implementieren.", "Der Nutzer kann jeden Schritt verstehen, ändern und ohne Datenverlust zurückgehen."],
    ["Validierung, Nebenläufigkeit und Fehlerbehandlung absichern", "Formularfehler, abgelaufene Warenkörbe, Nichtverfügbarkeit, wiederholte Requests und Abbruchpfade behandeln.", "Fehler sind verständlich; Reservierungen und Bestellungen bleiben auch bei Wiederholung konsistent."],
    ["End-to-End- und Zahlungsübergabetests erstellen", "Gast- und Konto-Flows mit realistischen Artikeln, Adressen, Versandkosten und simulierten Zahlungsantworten prüfen.", "Der vollständige Kaufpfad ist für Erfolg, Abbruch und Fehlzahlung reproduzierbar abgesichert."],
  ],
  E4: [
    ["Bestell- und Zahlungszustandsmaschine implementieren", "Zahlbetrag, Bestellung, Reservierung, Capture, Fehlzahlung, Erstattung und Statusübergänge als explizite Regeln umsetzen.", "Nur erlaubte Übergänge sind möglich; jeder Zustand ist eindeutig und wiederherstellbar."],
    ["Zahlungsintegration und Idempotenz absichern", "Provider-Aufrufe, Signatur-/Statusprüfung, Webhook-Verarbeitung, Wiederholungen und Timeoutpfade implementieren.", "Doppelte Ereignisse erzeugen keine doppelten Bestellungen, Captures, Nachrichten oder Bestandsänderungen."],
    ["Admin-, Versand- und Supportabläufe integrieren", "Bestellansicht, Versandvorbereitung, Tracking, Storno und Erstattung mit Berechtigungen und Audit-Spuren umsetzen.", "Support kann den Bestellstatus erklären und jede Aktion nachvollziehen."],
    ["Monitoring und Fehlerdiagnose ergänzen", "Metriken, strukturierte Logs, Alarmbedingungen und sichere Supportinformationen für Zahlungs- und Synchronisationsfehler definieren.", "Fehler sind ohne sensible Zahlungsdaten diagnostizierbar und mit einer Bestellkorrelation auffindbar."],
  ],
  E5: [
    ["Authentifizierung und Kontosicherheit implementieren", "Registrierung, Bestätigung, Login, Logout, Passwortreset, Sessions und Rate Limits sicher umsetzen.", "Fehlversuche, abgelaufene Tokens und unbestätigte Konten werden sicher und verständlich behandelt."],
    ["Konto- und Adressoberflächen bauen", "Persönliche Daten, Lieferadressen, Bestellhistorie und Kontostatus mit Validierung und responsiver Nutzerführung umsetzen.", "Nutzer sehen und ändern ausschließlich eigene Daten; Änderungen sind nach Reload konsistent."],
    ["Datenschutz- und Lebenszyklusfälle behandeln", "Export, Löschung, Re-Authentifizierung, abhängige Bestellungen und Benachrichtigungen fachlich klären und implementieren.", "Datenschutzaktionen sind vollständig, nachvollziehbar und gegen versehentliche Ausführung geschützt."],
    ["Sicherheits- und Regressionstests ergänzen", "Berechtigungsgrenzen, Sessionablauf, Passwortreset, Kontodaten und wichtige Kaufpfade automatisiert prüfen.", "Kein Test kann auf fremde Kontodaten zugreifen; kritische Flows sind reproduzierbar abgesichert."],
  ],
  E6: [
    ["Verkäuferdomäne und Angebotsstatus modellieren", "Angebot, Verkäufer, Artikel, Zustandsdaten, Preise, Statusübergänge und Auszahlungsinformationen fachlich definieren.", "Statuswechsel sind eindeutig, berechtigt und gegen widersprüchliche Übergänge geschützt."],
    ["Einreichungs- und Upload-Workflow bauen", "Formular, Medien-Upload, Validierung, Entwurfsspeicherung und Fehlerwiederaufnahme für Verkäufer umsetzen.", "Verkäufer verlieren bei Validierungs- oder Uploadfehlern keine gültigen Daten."],
    ["Prüfung, Verhandlung und Übergabe implementieren", "Adminprüfung, Preisangebot, Annahme/Ablehnung, Übergabe und Auszahlung mit Benachrichtigungen verbinden.", "Alle Beteiligten sehen den gleichen Status und die nächsten Verantwortlichkeiten."],
    ["Berechtigungs-, Abrechnungs- und Workflowtests ergänzen", "Fremdzugriff, Mehrfachaktionen, Mediengrenzen, Statusrennen und Auszahlungsvoraussetzungen testen.", "Sensible Daten sind geschützt und jeder kritische Übergang ist reproduzierbar geprüft."],
  ],
  E7: [
    ["Admin-Sicherheitsmodell umsetzen", "Rollen, Berechtigungen, Session-Schutz, Audit-Anforderungen und sichere Admin-Anmeldung für die Story implementieren.", "Nicht berechtigte Zugriffe werden serverseitig abgewiesen und relevante Aktionen protokolliert."],
    ["Administrationsoberfläche und Datenoperationen bauen", "Listen, Filter, Formulare, Bulk-Aktionen, Bestätigungsdialoge und sichere Mutationen für die Story umsetzen.", "Admin-Aktionen sind verständlich, validiert und nach Abschluss direkt nachvollziehbar."],
    ["Synchronisation, Fehlerpfade und Audit integrieren", "Jobstatus, Wiederholbarkeit, Konfliktbehandlung, Fehleranzeige und Änderungsverlauf für die Story bereitstellen.", "Ein fehlerhafter Datensatz blockiert nicht den übrigen Lauf; Ursachen und Änderungen bleiben sichtbar."],
    ["Administrations- und Berechtigungstests ausführen", "Rollenmatrix, kritische CRUD-Aktionen, Synchronisationsfehler und irreversible Aktionen mit Testdaten prüfen.", "Die Rollenmatrix ist dokumentiert und alle kritischen Adminpfade liefern erwartete Ergebnisse."],
  ],
  E8: [
    ["Designsystem und Komponentenregeln definieren", "Farben, Typografie, Abstände, Zustände, Icons, Formelemente und responsive Breakpoints als wiederverwendbare Regeln festlegen.", "Neue Oberflächen verwenden konsistente Tokens und vermeiden lokale Sonderlösungen."],
    ["Responsive Oberflächen umsetzen", "Navigation, Produktlisten, Detailansichten, Formulare und Checkout für Desktop, Tablet und Smartphone implementieren.", "Kein horizontaler Überlauf; Inhalte und Aktionen bleiben bei den Zielbreiten nutzbar."],
    ["Accessibility-, Lade- und Fehlzustände integrieren", "Fokus, Tastatur, Screenreader-Struktur, Loading-Skeletons, Leerzustände, Fehlermeldungen und sichere Kontraste umsetzen.", "Alle Zustände sind wahrnehmbar, verständlich und ohne Maus bedienbar."],
    ["Visuelle Regression und Bildperformance absichern", "Referenzansichten, Bildgrößen, Lazy Loading, Layoutstabilität und relevante Browser-/Auflösungskombinationen testen.", "Darstellung bleibt stabil und Bilder sind scharf, performant und nicht irreführend zugeschnitten."],
  ],
  E9: [
    ["Xray-Repository und Testfallstandard einrichten", "Ordner, Benennung, Vorbedingungen, Testdaten, Schritte, erwartete Ergebnisse und Belegregeln als Teamstandard festlegen.", "Neue Tests sind einheitlich aufgebaut und ohne Rückfragen ausführbar."],
    ["Traceability und Testplanung implementieren", "Stories, Tests, Test Sets, Test Plan und Test Execution sinnvoll verknüpfen und Namenskonventionen anwenden.", "Abdeckung ist pro Epic und Release nachvollziehbar; fehlende Links werden sichtbar."],
    ["Ausführung, Evidenz und Fehlerprozess definieren", "Testergebnisse, Screenshots/Logs, Wiederholungen, fehlgeschlagene Schritte und Bug-Eröffnung mit Mindestinformationen festlegen.", "Ein Dritter kann einen Fehlschlag reproduzieren und die Ursache vom Testlauf bis zum Bug verfolgen."],
    ["Regression und Release-Abnahme verifizieren", "Browser-/Gerätematrix, Regressionstestsuite, Abnahmekriterien und Coverage-Reports für den MVP einrichten.", "Ein Release kann anhand klarer Kriterien freigegeben oder begründet zurückgestellt werden."],
  ],
};

const testBlueprints = {
  E1: [
    ["Happy Path", "Mit gültigen Pflichtdaten arbeiten", ["Mit berechtigtem Nutzer anmelden.", "Gültige Story-Daten erfassen.", "Vorgang speichern oder ausführen.", "Ergebnis erneut laden."], "Der Vorgang wird einmalig erfolgreich verarbeitet; alle relevanten Daten sind konsistent sichtbar."],
    ["Negative und Grenzwerte", "Ungültige Eingaben und Grenzwerte prüfen", ["Pflichtfelder leer lassen.", "Ungültige Formate und Grenzwerte verwenden.", "Dubletten- oder Konfliktfall simulieren.", "Aktion erneut ausführen."], "Jeder Fehler wird am richtigen Feld erklärt; es entsteht kein halbfertiger oder doppelter Datensatz."],
    ["Berechtigung und Betrieb", "Rollen, Reload und Fehlerwiederaufnahme prüfen", ["Mit nicht berechtigter Rolle aufrufen.", "Direkten Endpunkt beziehungsweise Deep Link verwenden.", "Technischen Fehler simulieren und erneut laden.", "Änderungsverlauf oder Log prüfen."], "Nicht berechtigte Zugriffe werden abgewiesen; nach einem Fehler bleibt der Zustand nachvollziehbar und wiederholbar."],
  ],
  E2: [
    ["Treffer und Navigation", "Relevante Produkte finden und öffnen", ["Repräsentative Produktdaten vorbereiten.", "Such- oder Filterkriterien eingeben.", "Sortierung und Pagination verwenden.", "Detailansicht öffnen und zurück navigieren."], "Die richtigen Treffer erscheinen in stabiler Reihenfolge; der Zustand und die Produktdetails stimmen."],
    ["Keine Treffer und Fehler", "Leere und technische Ergebnisse unterscheiden", ["Kriterium ohne Treffer verwenden.", "Ungültige Eingabe senden.", "Langsame oder fehlerhafte Antwort simulieren.", "Wiederholen oder Filter zurücksetzen."], "Leere und technische Zustände sind verständlich getrennt; die angebotenen Folgeaktionen funktionieren."],
    ["Responsive und Accessibility", "Suche und Detailansicht ohne Maus nutzen", ["Desktop-, Tablet- und Smartphone-Breite testen.", "Nur Tastatur verwenden.", "Fokus und Screenreader-Namen prüfen.", "Bilder und Text bei anderer Auflösung prüfen."], "Kein Überlauf oder Fokusverlust tritt auf; Inhalte und Aktionen bleiben wahrnehmbar und bedienbar."],
  ],
  E3: [
    ["Kauf erfolgreich", "Ein Produkt als Gast durch den Checkout führen", ["Verfügbares Produkt auswählen.", "In den Warenkorb legen und Menge prüfen.", "Gastdaten, Adresse und Versandart eingeben.", "Zusammenfassung prüfen und Bestellung absenden."], "Warenkorb, Versand, Gesamtbetrag und Bestellung stimmen; der Artikel ist reserviert beziehungsweise verarbeitet."],
    ["Abbruch und Nichtverfügbarkeit", "Checkout bei Fehlern sicher abbrechen", ["Artikel zwischen zwei Schritten unverfügbar machen.", "Pflichtfeld und ungültige Adresse verwenden.", "Zurück navigieren und Daten ändern.", "Checkout erneut laden."], "Die Ursache wird verständlich angezeigt; es entsteht keine falsche Bestellung und gültige Eingaben bleiben erhalten."],
    ["Doppelte Aktion und Kontoflow", "Wiederholung und Kundenkonto prüfen", ["Submit beziehungsweise Reload mehrfach auslösen.", "Mit Kundenkonto denselben Kauf starten.", "Bestellstatus und Warenkorb danach prüfen.", "Serverseitige Datensätze abgleichen."], "Es gibt genau eine fachliche Bestellung; Gast- und Kontoflow verwenden identische Preis- und Bestandsregeln."],
  ],
  E4: [
    ["Zahlung erfolgreich", "Eine Zahlung bis zum bestätigten Auftrag durchführen", ["Bestellung mit bekanntem Betrag vorbereiten.", "Zahlung beim Provider autorisieren.", "Capture/Callback abwarten.", "Bestellung, Bestand und Kommunikation prüfen."], "Zahlbetrag, Zahlungsstatus, Bestellung und Bestand sind konsistent und genau einmal aktualisiert."],
    ["Fehlzahlung und Abbruch", "Fehlgeschlagene Zahlung sicher behandeln", ["Provider-Fehler oder Abbruch simulieren.", "Zurück zum Checkout navigieren.", "Reservierung und Bestellstatus prüfen.", "Erneuten Zahlungsversuch durchführen."], "Keine falsche Zahlung oder doppelte Reservierung entsteht; der Nutzer erhält eine verständliche nächste Aktion."],
    ["Idempotenz und Adminbetrieb", "Doppelte Ereignisse und Folgeaktionen prüfen", ["Dasselbe Zahlungsereignis zweimal zustellen.", "Bestellung administrativ öffnen.", "Versand, Storno oder Erstattung nach erlaubtem Status ausführen.", "Audit und Logs prüfen."], "Doppelte Ereignisse haben keine Nebenwirkung; nur erlaubte Folgeaktionen werden ausgeführt und protokolliert."],
  ],
  E5: [
    ["Konto-Lebenszyklus", "Konto sicher registrieren und anmelden", ["Registrierung mit gültiger Adresse durchführen.", "Bestätigung abschließen.", "Anmelden, abmelden und erneut anmelden.", "Passwortreset durchführen."], "Nur bestätigte und korrekte Zugangsdaten erlauben Zugriff; Tokens und Fehlermeldungen verhalten sich sicher."],
    ["Eigene Daten und Historie", "Konto- und Bestelldaten verwalten", ["Persönliche Daten und Adresse ändern.", "Bestellung mit Konto durchführen.", "Historie und Status öffnen.", "Seite neu laden und erneut prüfen."], "Nur eigene Daten sind sichtbar; Änderungen und Bestellstatus bleiben konsistent."],
    ["Datenschutz und Berechtigung", "Kontogrenzen und Datenschutzaktionen prüfen", ["Fremde Konto-URL beziehungsweise API-ID verwenden.", "Export oder Löschung anfordern.", "Bestätigung beziehungsweise Re-Authentifizierung prüfen.", "Folgezugriff und Audit kontrollieren."], "Fremdzugriff ist unmöglich; Datenschutzaktionen sind vollständig, bestätigt und nachvollziehbar."],
  ],
  E6: [
    ["Angebot einreichen", "Eine vollständige Karte als Verkäufer anbieten", ["Verkäufer anmelden.", "Kartendaten, Bilder, Zustand und Preis erfassen.", "Angebot speichern beziehungsweise einreichen.", "Status und Bestätigung prüfen."], "Das Angebot ist vollständig, eindeutig und im erwarteten Status sichtbar."],
    ["Ungültige und fremde Daten", "Verkäuferfehler und Berechtigungen prüfen", ["Fehlende oder ungültige Daten senden.", "Zu große oder falsche Bilder verwenden.", "Fremdes Angebot über URL/API aufrufen.", "Fehler beheben und erneut speichern."], "Fehler sind verständlich; fremde Daten bleiben geschützt; gültige Teildaten gehen nicht verloren."],
    ["Angebotsstatus und Auszahlung", "Prüfung, Verhandlung und Übergabe verfolgen", ["Adminprüfung durchführen.", "Preisangebot annehmen oder ablehnen.", "Übergabe- und Auszahlungsstatus ändern.", "Benachrichtigungen und Audit prüfen."], "Jeder Übergang ist nachvollziehbar, berechtigt und erzeugt die richtigen Informationen für alle Beteiligten."],
  ],
  E7: [
    ["Admin-Operation erfolgreich", "Eine berechtigte Verwaltungsaktion ausführen", ["Als passende Adminrolle anmelden.", "Datensatz suchen und öffnen.", "Änderung validiert speichern.", "Liste, Detail und Audit erneut laden."], "Die Änderung ist einmalig wirksam, sichtbar und mit verantwortlicher Rolle nachvollziehbar."],
    ["Rolle und Risikoaktion", "Unberechtigte und irreversible Aktionen prüfen", ["Mit eingeschränkter Rolle aufrufen.", "Direkten API-/Deep-Link nutzen.", "Irreversible Aktion abbrechen und bestätigen.", "Berechtigung und Audit prüfen."], "Unberechtigte Aktionen werden abgewiesen; kritische Aktionen benötigen bewusste Bestätigung."],
    ["Synchronisation und Fehler", "Synchronisationslauf reproduzierbar behandeln", ["Lauf mit gültigen Daten starten.", "Konflikt oder Fehlerdatensatz simulieren.", "Status und Fehlerdetails prüfen.", "Lauf sicher wiederholen."], "Gültige Daten werden verarbeitet; Fehler sind isoliert, erklärbar und ohne Doppelverarbeitung wiederholbar."],
  ],
  E8: [
    ["Visueller Standardpfad", "Die Oberfläche auf allen Zielbreiten prüfen", ["Relevante Seite mit Referenzdaten öffnen.", "Desktop-, Tablet- und Smartphone-Breite verwenden.", "Navigation und Kernaktion ausführen.", "Screenshot oder Referenzabgleich erstellen."], "Layout, Typografie, Abstände, Bilder und primäre Aktionen entsprechen dem Designsystem ohne Überlauf."],
    ["Zustände und Formulare", "Loading, Leer, Fehler und Erfolg prüfen", ["Laden verzögern.", "Keine Daten liefern.", "Validierungs- und Serverfehler auslösen.", "Erfolgreiche Aktion durchführen."], "Jeder Zustand ist eindeutig, verständlich und bietet die richtige nächste Aktion."],
    ["Accessibility und Auflösung", "Die Oberfläche ohne Maus und bei anderer Auflösung nutzen", ["Nur Tastatur verwenden.", "Fokusreihenfolge und sichtbaren Fokus prüfen.", "Screenreader-Struktur und Alternativtexte prüfen.", "Zoom und hohe Auflösung verwenden."], "Alle Kernaktionen sind erreichbar; Fokus, Kontrast, Semantik und Text-/Bildqualität bleiben erhalten."],
  ],
  E9: [
    ["Testfall ausführbar", "Einen vollständigen Xray-Test ausführen", ["Test aus Repository öffnen.", "Vorbedingungen und Testdaten herstellen.", "Schritte in Reihenfolge ausführen.", "Ergebnisse und Beleg speichern."], "Der Test ist ohne Rückfragen ausführbar und Ergebnis sowie Evidenz sind dem Lauf zugeordnet."],
    ["Traceability und Abdeckung", "Story, Test Set und Test Plan nachvollziehen", ["Test mit Story verknüpfen.", "In Test Set und Plan aufnehmen.", "Execution starten.", "Coverage und Status prüfen."], "Die Story-Abdeckung ist sichtbar und der Teststatus fließt in Set, Plan und Release-Ansicht ein."],
    ["Fehler und Regression", "Fehlgeschlagenen Test reproduzieren und zurücksetzen", ["Negativ- oder Regressionstest ausführen.", "Fehlschlag mit Kontext dokumentieren.", "Bug beziehungsweise Abweichung erfassen.", "Korrektur erneut testen."], "Der Fehler ist reproduzierbar beschrieben; Retest und Regression aktualisieren die Abdeckung korrekt."],
  ],
};

const storyData = [];
const acceptanceRows = [];
const taskRows = [];
const testRows = [];
let taskId = 300001;
let testId = 400001;

for (let index = 0; index < storyRows.length; index += 1) {
  const row = storyRows[index];
  const summary = String(row[indexOf("Summary")] ?? "");
  const description = String(row[indexOf("Description")] ?? "");
  const epic = epicNumber(summary);
  const issueKey = `KAN-${index + 10}`;
  const storyPriority = priorityFor(issueKey);
  const storyCode = summary.match(/^(E\d+-\d+)/)?.[1] ?? issueKey;
  const title = summary.replace(/^E\d+-\d+\s*/, "");
  const criteria = criteriaByEpic[epic];
  const expandedDescription = `${description}\n\nAkzeptanzkriterien\n${criteria.map((item, i) => `${i + 1}. ${item}`).join("\n")}`;

  storyData.push({ issueKey, summary, description, epic, storyCode, title, priority: storyPriority, criteria });
  acceptanceRows.push([issueKey, "Story", summary, expandedDescription, storyPriority, `KAN-${epic.slice(1)}`]);

  const taskBlueprint = taskBlueprints[epic];
  for (const [taskTitle, taskGoal, taskDone] of taskBlueprint) {
    const taskSummary = `${storyCode} ${title} – ${taskTitle}`;
    const taskDescription = [
      `Zugehörige Story: ${issueKey} – ${summary}`,
      `Priorität der Story: ${storyPriority}`,
      "",
      "Ziel",
      taskGoal,
      "",
      "Vorgehen",
      `1. Bestehende Schnittstellen, Daten und Randbedingungen für „${title}“ prüfen.`,
      "2. Die fachliche Regel an der zuständigen Schicht implementieren und gegen ungültige Eingaben absichern.",
      "3. UI, API, Persistenz oder Testdaten so integrieren, dass der Ablauf reproduzierbar bleibt.",
      "4. Erfolgs-, Fehler-, Berechtigungs- und Wiederholungsfall dokumentieren.",
      "",
      "Erledigt wenn",
      `- ${taskDone}`,
      "- Die relevanten Akzeptanzkriterien der Story sind nachweisbar erfüllt.",
      "- Automatisierte oder reproduzierbare Tests sind vorhanden und im Review nachvollziehbar.",
      "- Keine bestehende Funktion außerhalb des Story-Scopes wird unbeabsichtigt verändert.",
      "",
      "Abhängigkeiten",
      `- Parent: ${issueKey}`,
      "- Testdaten und Fehlerszenarien werden mit dem zugehörigen Xray-Testfall abgestimmt.",
    ].join("\n");
    taskRows.push(["Task", taskSummary, taskDescription, taskId, issueKey, storyPriority]);
    taskId += 1;
  }

  const tests = testBlueprints[epic];
  for (const [testType, testGoal, steps, expected] of tests) {
    const testSummary = `${storyCode} ${title} – ${testType}`;
    const testDescription = [
      `Abgedeckte Story: ${issueKey} – ${summary}`,
      `Testart: ${testType}`,
      `Priorität der Story: ${storyPriority}`,
      "",
      "Ziel",
      testGoal,
      "",
      "Vorbedingungen",
      "- Die Anwendung ist erreichbar und die erforderlichen Testdaten sind vorbereitet.",
      "- Der Test wird in einer isolierten Umgebung mit nachvollziehbaren Benutzerrollen ausgeführt.",
      "",
      "Schritte",
      steps.map((step, i) => `${i + 1}. ${step}`).join("\n"),
      "",
      "Erwartetes Ergebnis",
      expected,
      "",
      "Beleg und Nachbereitung",
      "- Ergebnis pro Schritt dokumentieren; bei Fehlern Screenshot, Request-/Correlation-ID und relevante Daten sichern.",
      "- Bei Fehlschlag einen Bug mit Reproduktionsschritten und Verweis auf diesen Test anlegen.",
    ].join("\n");
    testRows.push(["Test", testSummary, testDescription, testId, issueKey, storyPriority]);
    testId += 1;
  }
}

await fs.writeFile(`${outputDir}/brandycards-story-acceptance-criteria.csv`, toCsv(storyHeaders, acceptanceRows), "utf8");
await fs.writeFile(`${outputDir}/brandycards-detailed-tasks.csv`, toCsv(taskHeaders, taskRows), "utf8");
await fs.writeFile(`${outputDir}/brandycards-xray-tests.csv`, toCsv(testHeaders, testRows), "utf8");

const reviewWorkbook = Workbook.create();
const summarySheet = reviewWorkbook.worksheets.add("Summary");
const storiesSheet = reviewWorkbook.worksheets.add("Acceptance Criteria");
const tasksSheet = reviewWorkbook.worksheets.add("Tasks");
const testsSheet = reviewWorkbook.worksheets.add("Xray Tests");

const addTableSheet = (sheet, headers, rows, descriptionWidth) => {
  const values = [headers, ...rows];
  const endColumn = String.fromCharCode(64 + headers.length);
  sheet.getRange(`A1:${endColumn}${values.length}`).values = values;
  sheet.getRange(`A1:${endColumn}1`).format = { fill: "#1F2937", font: { bold: true, color: "#FFFFFF" }, wrapText: true };
  sheet.getRange(`A2:${endColumn}${values.length}`).format = { wrapText: true };
  sheet.getRange(`A1:${endColumn}${values.length}`).format.borders = { preset: "inside", style: "thin", color: "#D1D5DB" };
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
  sheet.getRange(`A1:${endColumn}${values.length}`).format.autofitColumns();
  if (descriptionWidth) {
    const descriptionColumn = headers.indexOf("Description") + 1;
    if (descriptionColumn > 0) {
      const letter = String.fromCharCode(64 + descriptionColumn);
      sheet.getRange(`${letter}1:${letter}${values.length}`).format.columnWidth = descriptionWidth;
    }
  }
};

const distribution = [
  ["Metrik", "Wert"],
  ["Stories", storyData.length],
  ["Akzeptanzkriterien-Updates", acceptanceRows.length],
  ["Tasks", taskRows.length],
  ["Xray-Testfälle", testRows.length],
  ["Highest", storyData.filter((item) => item.priority === "Highest").length],
  ["High", storyData.filter((item) => item.priority === "High").length],
  ["Medium", storyData.filter((item) => item.priority === "Medium").length],
  ["Lowest", storyData.filter((item) => item.priority === "Lowest").length],
];
summarySheet.getRange(`A1:B${distribution.length}`).values = distribution;
summarySheet.getRange("A1:B1").format = { fill: "#1F2937", font: { bold: true, color: "#FFFFFF" } };
summarySheet.getRange(`A1:B${distribution.length}`).format.borders = { preset: "all", style: "thin", color: "#D1D5DB" };
summarySheet.getRange(`A1:B${distribution.length}`).format.autofitColumns();
summarySheet.getRange("A1:B1").format.columnWidth = 28;
summarySheet.showGridLines = false;

addTableSheet(storiesSheet, storyHeaders, acceptanceRows, 72);
addTableSheet(tasksSheet, taskHeaders, taskRows, 72);
addTableSheet(testsSheet, testHeaders, testRows, 72);

const previewTargets = [
  ["Summary", "A1:B9", "preview-summary.png"],
  ["Acceptance Criteria", "A1:F6", "preview-acceptance.png"],
  ["Tasks", "A1:F5", "preview-tasks.png"],
  ["Xray Tests", "A1:F5", "preview-tests.png"],
];
for (const [sheetName, range, fileName] of previewTargets) {
  const preview = await reviewWorkbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${fileName}`, new Uint8Array(await preview.arrayBuffer()));
}

const inspect = await reviewWorkbook.inspect({ kind: "sheet,table", maxChars: 3000, tableMaxRows: 3, tableMaxCols: 6 });
console.log(inspect.ndjson);

const reviewXlsx = await SpreadsheetFile.exportXlsx(reviewWorkbook);
await reviewXlsx.save(`${outputDir}/brandycards-jira-expansion-review.xlsx`);

console.log(JSON.stringify({
  stories: storyData.length,
  acceptanceCriteria: acceptanceRows.length,
  tasks: taskRows.length,
  tests: testRows.length,
  outputDir,
}));
